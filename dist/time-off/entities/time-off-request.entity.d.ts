import { Employee } from './employee.entity';
export declare enum RequestStatus {
    SUBMITTED = "SUBMITTED",
    PENDING = "PENDING",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED",
    SYNC_FAILED = "SYNC_FAILED"
}
export declare class TimeOffRequest {
    id: string;
    employeeId: string;
    status: RequestStatus;
    startDate: string;
    endDate: string;
    requestedHours: number;
    managerComment: string | null;
    hcmTransactionId: string;
    employee: Employee;
    createdAt: Date;
    updatedAt: Date;
}
