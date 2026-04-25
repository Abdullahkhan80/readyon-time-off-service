import { HttpService } from '@nestjs/axios';
export declare class HcmService {
    private readonly httpService;
    private readonly logger;
    private breaker;
    private readonly hcmBaseUrl;
    constructor(httpService: HttpService);
    private callHcm;
    validateBalance(employeeId: string, hours: number): Promise<boolean>;
    deductBalance(employeeId: string, hours: number, requestId: string): Promise<string>;
    getBalancesSnapshot(): Promise<any[]>;
    private handleError;
}
