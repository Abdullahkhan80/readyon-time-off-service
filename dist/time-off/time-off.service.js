"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var TimeOffService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeOffService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const employee_entity_1 = require("./entities/employee.entity");
const time_off_balance_entity_1 = require("./entities/time-off-balance.entity");
const time_off_request_entity_1 = require("./entities/time-off-request.entity");
const idempotency_key_entity_1 = require("../common/entities/idempotency-key.entity");
const audit_log_entity_1 = require("../common/entities/audit-log.entity");
const hcm_service_1 = require("../hcm/hcm.service");
const async_mutex_1 = require("async-mutex");
let TimeOffService = TimeOffService_1 = class TimeOffService {
    employeeRepository;
    balanceRepository;
    requestRepository;
    idempotencyRepository;
    auditRepository;
    hcmService;
    dataSource;
    logger = new common_1.Logger(TimeOffService_1.name);
    reservationMutex = new async_mutex_1.Mutex();
    constructor(employeeRepository, balanceRepository, requestRepository, idempotencyRepository, auditRepository, hcmService, dataSource) {
        this.employeeRepository = employeeRepository;
        this.balanceRepository = balanceRepository;
        this.requestRepository = requestRepository;
        this.idempotencyRepository = idempotencyRepository;
        this.auditRepository = auditRepository;
        this.hcmService = hcmService;
        this.dataSource = dataSource;
    }
    async getBalances(employeeId) {
        return await this.balanceRepository.find({ where: { employeeId } });
    }
    async createRequest(dto, idempotencyKey) {
        return await this.reservationMutex.runExclusive(async () => {
            const maxRetries = 3;
            let attempt = 0;
            while (attempt < maxRetries) {
                try {
                    return await this.runCreateRequest(dto, idempotencyKey);
                }
                catch (error) {
                    if (error instanceof typeorm_2.OptimisticLockVersionMismatchError && attempt < maxRetries - 1) {
                        attempt++;
                        this.logger.warn(`Concurrency conflict. Retrying... (${attempt}/${maxRetries})`);
                        continue;
                    }
                    throw error;
                }
            }
        });
    }
    async runCreateRequest(dto, idempotencyKey) {
        if (idempotencyKey) {
            const cached = await this.idempotencyRepository.findOne({ where: { key: idempotencyKey } });
            if (cached)
                return JSON.parse(cached.response);
        }
        return await this.dataSource.transaction(async (manager) => {
            const { employeeId, requestedHours } = dto;
            const balance = await manager.findOne(time_off_balance_entity_1.TimeOffBalance, {
                where: { employeeId, type: 'PTO' },
            });
            if (!balance)
                throw new common_1.NotFoundException('Time-off balance not found');
            const available = Number(balance.balance) - Number(balance.reservedBalance);
            if (available < requestedHours) {
                throw new common_1.BadRequestException(`Insufficient balance. Avail: ${available}, Req: ${requestedHours}`);
            }
            balance.reservedBalance = Number(balance.reservedBalance) + requestedHours;
            await manager.save(balance);
            const request = manager.create(time_off_request_entity_1.TimeOffRequest, { ...dto, status: time_off_request_entity_1.RequestStatus.PENDING });
            const savedRequest = await manager.save(request);
            await this.logAction(manager, 'TIME_OFF_REQUEST', savedRequest.id, 'CREATE', `User ${employeeId} initial request`);
            if (idempotencyKey) {
                await manager.save(idempotency_key_entity_1.IdempotencyKey, { key: idempotencyKey, response: JSON.stringify(savedRequest), statusCode: 201 });
            }
            return savedRequest;
        });
    }
    async approveRequest(requestId, dto) {
        const idempotencyKey = `approve-${requestId}`;
        const cached = await this.idempotencyRepository.findOne({ where: { key: idempotencyKey } });
        if (cached)
            return JSON.parse(cached.response);
        const request = await this.requestRepository.findOne({ where: { id: requestId } });
        if (!request || request.status !== time_off_request_entity_1.RequestStatus.PENDING) {
            throw new common_1.BadRequestException('Request not found or not in PENDING state');
        }
        const isHcmValid = await this.hcmService.validateBalance(request.employeeId, request.requestedHours);
        if (!isHcmValid) {
            await this.handleFailedApproval(request, 'Insufficient balance in HCM');
            throw new common_1.BadRequestException('Insufficient balance in Source of Truth (HCM)');
        }
        let hcmTxId;
        try {
            hcmTxId = await this.hcmService.deductBalance(request.employeeId, request.requestedHours, requestId);
        }
        catch (error) {
            await this.handleFailedApproval(request, 'HCM Service Failure during deduction');
            throw new common_1.InternalServerErrorException('HCM deduction failed.');
        }
        try {
            return await this.dataSource.transaction(async (manager) => {
                const balance = await manager.findOne(time_off_balance_entity_1.TimeOffBalance, { where: { employeeId: request.employeeId, type: 'PTO' } });
                if (balance) {
                    balance.balance = Number(balance.balance) - Number(request.requestedHours);
                    balance.reservedBalance = Number(balance.reservedBalance) - Number(request.requestedHours);
                    await manager.save(balance);
                }
                request.status = time_off_request_entity_1.RequestStatus.APPROVED;
                request.managerComment = dto.managerComment ?? null;
                request.hcmTransactionId = hcmTxId;
                const savedRequest = await manager.save(request);
                const response = { ...savedRequest, status: 'APPROVED_SYNCED' };
                await this.logAction(manager, 'TIME_OFF_REQUEST', request.id, 'APPROVE', `HCM Tx: ${hcmTxId}`);
                await manager.save(idempotency_key_entity_1.IdempotencyKey, { key: idempotencyKey, response: JSON.stringify(response), statusCode: 200 });
                return response;
            });
        }
        catch (error) {
            this.logger.error(`CRITICAL inconsistency for Request ${requestId}`);
            throw new common_1.InternalServerErrorException('Synchronization inconsistency.');
        }
    }
    async rejectRequest(requestId, dto) {
        return await this.dataSource.transaction(async (manager) => {
            const request = await manager.findOne(time_off_request_entity_1.TimeOffRequest, { where: { id: requestId } });
            if (!request || request.status !== time_off_request_entity_1.RequestStatus.PENDING)
                throw new common_1.BadRequestException('Invalid request state');
            const balance = await manager.findOne(time_off_balance_entity_1.TimeOffBalance, { where: { employeeId: request.employeeId, type: 'PTO' } });
            if (balance) {
                balance.reservedBalance = Math.max(0, Number(balance.reservedBalance) - Number(request.requestedHours));
                await manager.save(balance);
            }
            request.status = time_off_request_entity_1.RequestStatus.REJECTED;
            request.managerComment = dto.managerComment ?? null;
            const saved = await manager.save(request);
            await this.logAction(manager, 'TIME_OFF_REQUEST', requestId, 'REJECT', 'Released hold');
            return saved;
        });
    }
    async reconcileBalances() {
        const snapshot = await this.hcmService.getBalancesSnapshot();
        return await this.dataSource.transaction(async (manager) => {
            let corrections = 0;
            for (const item of snapshot) {
                const balance = await manager.findOne(time_off_balance_entity_1.TimeOffBalance, { where: { employeeId: item.employeeId, type: item.type } });
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
    async handleFailedApproval(request, reason) {
        await this.dataSource.transaction(async (manager) => {
            const balance = await manager.findOne(time_off_balance_entity_1.TimeOffBalance, { where: { employeeId: request.employeeId, type: 'PTO' } });
            if (balance) {
                balance.reservedBalance = Math.max(0, Number(balance.reservedBalance) - Number(request.requestedHours));
                await manager.save(balance);
            }
            request.status = time_off_request_entity_1.RequestStatus.SYNC_FAILED;
            request.managerComment = `Auto-rejected: ${reason}`;
            await manager.save(request);
            await this.logAction(manager, 'TIME_OFF_REQUEST', request.id, 'SYNC_FAIL', reason);
        });
    }
    async logAction(manager, type, id, action, details) {
        await manager.save(audit_log_entity_1.AuditLog, { targetType: type, targetId: id, action: action, details: details, performedBy: 'SYSTEM' });
    }
};
exports.TimeOffService = TimeOffService;
exports.TimeOffService = TimeOffService = TimeOffService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(employee_entity_1.Employee)),
    __param(1, (0, typeorm_1.InjectRepository)(time_off_balance_entity_1.TimeOffBalance)),
    __param(2, (0, typeorm_1.InjectRepository)(time_off_request_entity_1.TimeOffRequest)),
    __param(3, (0, typeorm_1.InjectRepository)(idempotency_key_entity_1.IdempotencyKey)),
    __param(4, (0, typeorm_1.InjectRepository)(audit_log_entity_1.AuditLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        hcm_service_1.HcmService,
        typeorm_2.DataSource])
], TimeOffService);
//# sourceMappingURL=time-off.service.js.map