export declare class MockHcmController {
    private readonly logger;
    private mockBalances;
    getBalance(employeeId: string): Promise<{
        balance: number;
        type: string;
    }>;
    deductBalance(body: {
        employeeId: string;
        hours: number;
        requestId: string;
    }): Promise<{
        status: string;
        transactionId: string;
    }>;
    getSnapshot(): Promise<{
        employeeId: string;
        balance: number;
        type: string;
    }[]>;
    private simulateRandomFailure;
}
