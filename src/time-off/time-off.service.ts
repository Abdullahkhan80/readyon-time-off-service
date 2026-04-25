import { Injectable, NotFoundException, BadRequestException, Logger, OnApplicationBootstrap, InternalServerErrorException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, OptimisticLockVersionMismatchError } from 'typeorm';
import { Employee } from './entities/employee.entity';
import { TimeOffBalance } from './entities/time-off-balance.entity';
import { TimeOffRequest, RequestStatus } from './entities/time-off-request.entity';
import { IdempotencyKey } from '../common/entities/idempotency-key.entity';
import { AuditLog } from '../common/entities/audit-log.entity';
import { CreateTimeOffRequestDto } from './dto/create-request.dto';
import { ManagerActionDto } from './dto/approve-reject.dto';
import { HcmService } from '../hcm/hcm.service';
import { Mutex } from 'async-mutex';

@Injectable()
export class TimeOffService {
  private readonly logger = new Logger(TimeOffService.name);
  private readonly reservationMutex = new Mutex(); // Protects balance reservations from SQLite transaction overlap

  constructor(
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
    @InjectRepository(TimeOffBalance)
    private balanceRepository: Repository<TimeOffBalance>,
    @InjectRepository(TimeOffRequest)
    private requestRepository: Repository<TimeOffRequest>,
    @InjectRepository(IdempotencyKey)
    private idempotencyRepository: Repository<IdempotencyKey>,
    @InjectRepository(AuditLog)
    private auditRepository: Repository<AuditLog>,
    private hcmService: HcmService,
    private dataSource: DataSource,
  ) {}

  async getBalances(employeeId: string): Promise<TimeOffBalance[]> {
    return await this.balanceRepository.find({ where: { employeeId } });
  }

  async createRequest(dto: CreateTimeOffRequestDto, idempotencyKey?: string): Promise<any> {
    // We use a mutex to serialize reservations. In a distributed system, this would be a Redis lock.
    // This circumvents SQLite's lack of nested/simultaneous transaction support in a single process.
    return await this.reservationMutex.runExclusive(async () => {
      const maxRetries = 3;
      let attempt = 0;

      while (attempt < maxRetries) {
        try {
          return await this.runCreateRequest(dto, idempotencyKey);
        } catch (error) {
          if (error instanceof OptimisticLockVersionMismatchError && attempt < maxRetries - 1) {
            attempt++;
            this.logger.warn(`Concurrency conflict. Retrying... (${attempt}/${maxRetries})`);
            continue;
          }
          throw error;
        }
      }
    });
  }

  private async runCreateRequest(dto: CreateTimeOffRequestDto, idempotencyKey?: string): Promise<any> {
    if (idempotencyKey) {
      const cached = await this.idempotencyRepository.findOne({ where: { key: idempotencyKey } });
      if (cached) return JSON.parse(cached.response);
    }

    return await this.dataSource.transaction(async (manager) => {
      const { employeeId, locationId, requestedHours } = dto;
      
      const balance = await manager.findOne(TimeOffBalance, {
        where: { employeeId, locationId, type: 'PTO' },
      });

      if (!balance) throw new NotFoundException('Time-off balance not found');

      const available = Number(balance.balance) - Number(balance.reservedBalance);
      if (available < requestedHours) {
        throw new BadRequestException(`Insufficient balance. Avail: ${available}, Req: ${requestedHours}`);
      }

      balance.reservedBalance = Number(balance.reservedBalance) + requestedHours;
      await manager.save(balance);

      const request = manager.create(TimeOffRequest, { ...dto, status: RequestStatus.PENDING });
      const savedRequest = await manager.save(request);

      await this.logAction(manager, 'TIME_OFF_REQUEST', savedRequest.id, 'CREATE', `User ${employeeId} initial request`);

      if (idempotencyKey) {
        await manager.save(IdempotencyKey, { key: idempotencyKey, response: JSON.stringify(savedRequest), statusCode: 201 });
      }

      return savedRequest;
    });
  }

  async approveRequest(requestId: string, dto: ManagerActionDto): Promise<any> {
    const idempotencyKey = `approve-${requestId}`;
    
    const cached = await this.idempotencyRepository.findOne({ where: { key: idempotencyKey } });
    if (cached) return JSON.parse(cached.response);

    const request = await this.requestRepository.findOne({ where: { id: requestId } });
    if (!request || request.status !== RequestStatus.PENDING) {
      throw new BadRequestException('Request not found or not in PENDING state');
    }

    const isHcmValid = await this.hcmService.validateBalance(request.employeeId, request.requestedHours, request.locationId);
    if (!isHcmValid) {
      await this.handleFailedApproval(request, 'Insufficient balance in HCM');
      throw new BadRequestException('Insufficient balance in Source of Truth (HCM)');
    }

    let hcmTxId: string;
    try {
      hcmTxId = await this.hcmService.deductBalance(request.employeeId, request.requestedHours, requestId, request.locationId);
    } catch (error) {
      await this.handleFailedApproval(request, 'HCM Service Failure during deduction');
      throw new InternalServerErrorException('HCM deduction failed.');
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        const balance = await manager.findOne(TimeOffBalance, { where: { employeeId: request.employeeId, locationId: request.locationId, type: 'PTO' } });
        if (balance) {
          balance.balance = Number(balance.balance) - Number(request.requestedHours);
          balance.reservedBalance = Number(balance.reservedBalance) - Number(request.requestedHours);
          await manager.save(balance);
        }

        request.status = RequestStatus.APPROVED;
        request.managerComment = dto.managerComment ?? null;
        request.hcmTransactionId = hcmTxId;
        const savedRequest = await manager.save(request);

        const response = { ...savedRequest, status: 'APPROVED_SYNCED' };
        await this.logAction(manager, 'TIME_OFF_REQUEST', request.id, 'APPROVE', `HCM Tx: ${hcmTxId}`);
        await manager.save(IdempotencyKey, { key: idempotencyKey, response: JSON.stringify(response), statusCode: 200 });

        return response;
      });
    } catch (error) {
      this.logger.error(`CRITICAL inconsistency for Request ${requestId}`);
      throw new InternalServerErrorException('Synchronization inconsistency.');
    }
  }

  async rejectRequest(requestId: string, dto: ManagerActionDto): Promise<TimeOffRequest> {
    return await this.dataSource.transaction(async (manager) => {
      const request = await manager.findOne(TimeOffRequest, { where: { id: requestId } });
      if (!request || request.status !== RequestStatus.PENDING) throw new BadRequestException('Invalid request state');

      const balance = await manager.findOne(TimeOffBalance, { where: { employeeId: request.employeeId, locationId: request.locationId, type: 'PTO' } });
      if (balance) {
        balance.reservedBalance = Math.max(0, Number(balance.reservedBalance) - Number(request.requestedHours));
        await manager.save(balance);
      }

      request.status = RequestStatus.REJECTED;
      request.managerComment = dto.managerComment ?? null;
      const saved = await manager.save(request);
      await this.logAction(manager, 'TIME_OFF_REQUEST', requestId, 'REJECT', 'Released hold');
      return saved;
    });
  }

  async reconcileBalances(): Promise<any> {
    const snapshot = await this.hcmService.getBalancesSnapshot();
    return await this.dataSource.transaction(async (manager) => {
      let corrections = 0;
      for (const item of snapshot) {
        const balance = await manager.findOne(TimeOffBalance, { 
          where: { employeeId: item.employeeId, locationId: item.locationId, type: item.type } 
        });
        if (balance && Number(balance.balance) !== Number(item.balance)) {
          const oldVal = balance.balance;
          balance.balance = item.balance;
          await manager.save(balance);
          await this.logAction(manager, 'BALANCE', balance.id, 'SYNC_ADJUST', `Corrected ${oldVal} -> ${item.balance}`);
          corrections++;
        }
      }
      return { total: snapshot.length, corrected: corrections };
    });
  }

  private async handleFailedApproval(request: TimeOffRequest, reason: string) {
    await this.dataSource.transaction(async (manager) => {
      const balance = await manager.findOne(TimeOffBalance, { 
        where: { employeeId: request.employeeId, locationId: request.locationId, type: 'PTO' } 
      });
      if (balance) {
        balance.reservedBalance = Math.max(0, Number(balance.reservedBalance) - Number(request.requestedHours));
        await manager.save(balance);
      }
      request.status = RequestStatus.SYNC_FAILED;
      request.managerComment = `Auto-rejected: ${reason}`;
      await manager.save(request);
      await this.logAction(manager, 'TIME_OFF_REQUEST', request.id, 'SYNC_FAIL', reason);
    });
  }

  private async logAction(manager: any, type: string, id: string, action: string, details: string) {
    await manager.save(AuditLog, { targetType: type, targetId: id, action: action, details: details, performedBy: 'SYSTEM' });
  }
}
