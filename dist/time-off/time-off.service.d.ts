import { Repository, DataSource } from 'typeorm';
import { Employee } from './entities/employee.entity';
import { TimeOffBalance } from './entities/time-off-balance.entity';
import { TimeOffRequest } from './entities/time-off-request.entity';
import { IdempotencyKey } from '../common/entities/idempotency-key.entity';
import { AuditLog } from '../common/entities/audit-log.entity';
import { CreateTimeOffRequestDto } from './dto/create-request.dto';
import { ManagerActionDto } from './dto/approve-reject.dto';
import { HcmService } from '../hcm/hcm.service';
export declare class TimeOffService {
    private employeeRepository;
    private balanceRepository;
    private requestRepository;
    private idempotencyRepository;
    private auditRepository;
    private hcmService;
    private dataSource;
    private readonly logger;
    private readonly reservationMutex;
    constructor(employeeRepository: Repository<Employee>, balanceRepository: Repository<TimeOffBalance>, requestRepository: Repository<TimeOffRequest>, idempotencyRepository: Repository<IdempotencyKey>, auditRepository: Repository<AuditLog>, hcmService: HcmService, dataSource: DataSource);
    getBalances(employeeId: string): Promise<TimeOffBalance[]>;
    createRequest(dto: CreateTimeOffRequestDto, idempotencyKey?: string): Promise<any>;
    private runCreateRequest;
    approveRequest(requestId: string, dto: ManagerActionDto): Promise<any>;
    rejectRequest(requestId: string, dto: ManagerActionDto): Promise<TimeOffRequest>;
    reconcileBalances(): Promise<any>;
    private handleFailedApproval;
    private logAction;
}
