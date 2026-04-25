import { Controller, Get, Post, Body, Param, Query, HttpException, HttpStatus, Logger } from '@nestjs/common';

  @Controller('mock-hcm')
  export class MockHcmController {
    private readonly logger = new Logger(MockHcmController.name);
    
    // Key format: "employeeId:locationId"
    private mockBalances: Record<string, number> = {
      '123e4567-e89b-12d3-a456-426614174000:NY': 160,
    };

  @Get('balance/:employeeId')
  async getBalance(@Param('employeeId') employeeId: string, @Query('locationId') locationId: string) {
    this.simulateRandomFailure();
    
    const key = `${employeeId}:${locationId}`;
    const balance = this.mockBalances[key] ?? 0;
    this.logger.log(`Mock HCM: Fetching balance for ${key} -> ${balance}`);
    
    return { balance, type: 'PTO', locationId };
  }

  @Post('deduct')
  async deductBalance(@Body() body: { employeeId: string; hours: number; requestId: string; locationId: string }) {
    this.simulateRandomFailure();

    const { employeeId, hours, requestId, locationId } = body;
    const key = `${employeeId}:${locationId}`;
    const currentBalance = this.mockBalances[key] ?? 0;

    if (currentBalance < hours) {
      this.logger.warn(`Mock HCM: Insufficient balance for ${key}. Requested: ${hours}, Available: ${currentBalance}`);
      throw new HttpException('Insufficient balance in HCM', HttpStatus.BAD_REQUEST);
    }

    this.mockBalances[key] -= hours;
    this.logger.log(`Mock HCM: Deducted ${hours} for ${key} (RequestId: ${requestId}). New Balance: ${this.mockBalances[key]}`);

    return { status: 'SUCCESS', transactionId: `hcm-tx-${Date.now()}` };
  }

  @Post('sync-snapshot')
  async getSnapshot() {
    return Object.entries(this.mockBalances).map(([key, balance]) => {
      const [employeeId, locationId] = key.split(':');
      return {
        employeeId,
        locationId,
        balance,
        type: 'PTO',
      };
    });
  }

  private simulateRandomFailure() {
    // Disabled for E2E stability. Set to > 0 to test resilience.
    const failureChance = process.env.HCM_FAILURE_CHANCE ? parseFloat(process.env.HCM_FAILURE_CHANCE) : 0;
    if (Math.random() < failureChance) {
      this.logger.error('Mock HCM: Simulating a random failure (500)');
      throw new HttpException('External Service Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
