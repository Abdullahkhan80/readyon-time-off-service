import { Injectable, Logger, InternalServerErrorException, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
const CircuitBreaker = require('opossum');

@Injectable()
export class HcmService {
  private readonly logger = new Logger(HcmService.name);
  private breaker: any;
  private readonly hcmBaseUrl = 'http://localhost:3000/mock-hcm';

  constructor(private readonly httpService: HttpService) {
    const options = {
      timeout: 5000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
    };
    
    this.breaker = new CircuitBreaker(this.callHcm.bind(this), options);
    // No global fallback to avoid swallowing original errors.
    // Error handling is done in individual methods.
  }

  private async callHcm(endpoint: string, method: 'GET' | 'POST', data?: any): Promise<any> {
    const url = `${this.hcmBaseUrl}${endpoint}`;
    let attempt = 0;
    const maxRetries = 3;
    
    while (attempt <= maxRetries) {
      try {
        const response = await firstValueFrom(
          method === 'GET' 
            ? this.httpService.get(url) 
            : this.httpService.post(url, data)
        );
        return response.data;
      } catch (error) {
        attempt++;
        if (attempt > maxRetries) throw error;
        const delay = process.env.NODE_ENV === 'test' ? 1 : Math.pow(2, attempt) * 500;
        this.logger.warn(`HCM call failed. Retrying in ${delay}ms... (Attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async validateBalance(employeeId: string, hours: number, locationId: string): Promise<boolean> {
    try {
      const data = await this.breaker.fire(`/balance/${employeeId}?locationId=${locationId}`, 'GET') as { balance: number };
      return data.balance >= hours;
    } catch (error) {
      this.handleError(error, 'validateBalance');
      return false; // Type safety
    }
  }

  async deductBalance(employeeId: string, hours: number, requestId: string, locationId: string): Promise<string> {
    try {
      const data = await this.breaker.fire('/deduct', 'POST', { employeeId, hours, requestId, locationId }) as { transactionId: string };
      return data.transactionId;
    } catch (error) {
      this.handleError(error, 'deductBalance');
      throw error; // HandleError already throws, but JS needs this for flow
    }
  }

  async getBalancesSnapshot(): Promise<any[]> {
    try {
      const data = await this.breaker.fire('/sync-snapshot', 'POST');
      return Array.isArray(data) ? data : [];
    } catch (error) {
      this.logger.error(`Error in HCM Service [getBalancesSnapshot]: ${error.message}`);
      return [];
    }
  }

  private handleError(error: any, context: string): never {
    if (error instanceof ServiceUnavailableException || error instanceof InternalServerErrorException) {
      throw error;
    }
    
    this.logger.error(`Error in HCM Service [${context}]: ${error.message}`);
    const status = error.response?.status || 500;
    const message = error.response?.data?.message || 'External HCM integration error';
    
    if (status === 400) throw new InternalServerErrorException(message);
    throw new ServiceUnavailableException('External HCM system is having issues.');
  }
}
