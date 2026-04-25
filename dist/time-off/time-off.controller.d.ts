import { TimeOffService } from './time-off.service';
import { CreateTimeOffRequestDto } from './dto/create-request.dto';
import { ManagerActionDto } from './dto/approve-reject.dto';
export declare class TimeOffController {
    private readonly timeOffService;
    constructor(timeOffService: TimeOffService);
    getBalance(employeeId: string): Promise<import("./entities/time-off-balance.entity").TimeOffBalance[]>;
    createRequest(createDto: CreateTimeOffRequestDto, idempotencyKey?: string): Promise<any>;
    approveRequest(id: string, actionDto: ManagerActionDto): Promise<any>;
    rejectRequest(id: string, actionDto: ManagerActionDto): Promise<import("./entities/time-off-request.entity").TimeOffRequest>;
    syncWithHcm(): Promise<any>;
}
