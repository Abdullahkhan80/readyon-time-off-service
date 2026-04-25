import { Employee } from './employee.entity';
export declare class TimeOffBalance {
    id: string;
    employeeId: string;
    locationId: string;
    balance: number;
    reservedBalance: number;
    type: string;
    version: number;
    employee: Employee;
}
