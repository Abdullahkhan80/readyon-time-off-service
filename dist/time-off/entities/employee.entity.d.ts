import { TimeOffBalance } from './time-off-balance.entity';
import { TimeOffRequest } from './time-off-request.entity';
export declare class Employee {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    balances: TimeOffBalance[];
    requests: TimeOffRequest[];
}
