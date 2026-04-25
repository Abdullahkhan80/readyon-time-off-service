export declare class MockHcmController {
    private readonly logger;
    private mockBalances;
    getBalance(employeeId: string, locationId: string): Promise<{
        balance: number;
        type: string;
        locationId: string;
    }>;
    deductBalance(body: {
        employeeId: string;
        hours: number;
        requestId: string;
        locationId: string;
    }): Promise<{
        status: string;
        transactionId: string;
    }>;
    getSnapshot(): Promise<{
        employeeId: string;
        locationId: string;
        balance: number;
        type: string;
    }[]>;
    private simulateRandomFailure;
}
