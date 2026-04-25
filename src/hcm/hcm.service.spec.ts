import { Test, TestingModule } from '@nestjs/testing';
import { HcmService } from './hcm.service';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { ServiceUnavailableException, InternalServerErrorException } from '@nestjs/common';

describe('HcmService', () => {
  let service: HcmService;
  let httpService: HttpService;

  const mockEmployeeId = '123e4567-e89b-12d3-a456-426614174000';
  const mockLocationId = 'NY';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HcmService,
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
            post: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<HcmService>(HcmService);
    httpService = module.get<HttpService>(HttpService);
  });

  describe('validateBalance', () => {
    it('should return true if balance is sufficient', async () => {
      jest.spyOn(httpService, 'get').mockReturnValue(of({ data: { balance: 100 } }) as any);
      const result = await service.validateBalance(mockEmployeeId, 10, mockLocationId);
      expect(result).toBe(true);
      expect(httpService.get).toHaveBeenCalledWith(expect.stringContaining(`/balance/${mockEmployeeId}?locationId=${mockLocationId}`));
    });

    it('should return false if balance is insufficient', async () => {
      jest.spyOn(httpService, 'get').mockReturnValue(of({ data: { balance: 5 } }) as any);
      const result = await service.validateBalance(mockEmployeeId, 10, mockLocationId);
      expect(result).toBe(false);
    });

    it('should retry on failure and eventually succeed', async () => {
      const getSpy = jest.spyOn(httpService, 'get')
        .mockReturnValueOnce(throwError(() => new Error('Transient error')))
        .mockReturnValueOnce(of({ data: { balance: 100 } }) as any);
      
      const result = await service.validateBalance(mockEmployeeId, 10, mockLocationId);
      expect(result).toBe(true);
      expect(getSpy).toHaveBeenCalledTimes(2);
    });

    it('should throw ServiceUnavailableException if all retries fail', async () => {
      jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => ({ response: { status: 500 } })));
      // Note: Opossum might throw eventually, or retry logic will.
      await expect(service.validateBalance(mockEmployeeId, 10, mockLocationId)).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('deductBalance', () => {
    it('should return transaction id on success', async () => {
      jest.spyOn(httpService, 'post').mockReturnValue(of({ data: { transactionId: 'tx-123' } }) as any);
      const result = await service.deductBalance(mockEmployeeId, 10, 'req-1', mockLocationId);
      expect(result).toBe('tx-123');
      expect(httpService.post).toHaveBeenCalledWith(expect.stringContaining('/deduct'), expect.objectContaining({ employeeId: mockEmployeeId, hours: 10, locationId: mockLocationId }));
    });

    it('should throw InternalServerErrorException on 400 error', async () => {
      jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => ({ response: { status: 400, data: { message: 'Bad request from HCM' } } })));
      await expect(service.deductBalance(mockEmployeeId, 10, 'req-1', mockLocationId)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getBalancesSnapshot', () => {
    it('should return snapshot array', async () => {
      const snapshot = [{ employeeId: '1', locationId: 'NY', balance: 10, type: 'PTO' }];
      jest.spyOn(httpService, 'post').mockReturnValue(of({ data: snapshot }) as any);
      const result = await service.getBalancesSnapshot();
      expect(result).toEqual(snapshot);
    });

    it('should return empty array on failure', async () => {
      jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => new Error('Fail')));
      const result = await service.getBalancesSnapshot();
      expect(result).toEqual([]);
    });
  });
});
