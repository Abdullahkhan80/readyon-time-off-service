import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TimeOffService } from './time-off.service';
import { Employee } from './entities/employee.entity';
import { TimeOffBalance } from './entities/time-off-balance.entity';
import { TimeOffRequest, RequestStatus } from './entities/time-off-request.entity';
import { IdempotencyKey } from '../common/entities/idempotency-key.entity';
import { AuditLog } from '../common/entities/audit-log.entity';
import { HcmService } from '../hcm/hcm.service';
import { DataSource } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('TimeOffService (Unit)', () => {
  let service: TimeOffService;
  let hcmService: HcmService;
  let requestRepo: any;

  const mockEmployeeId = 'emp-123';
  const mockRequestId = 'req-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimeOffService,
        {
          provide: getRepositoryToken(Employee),
          useValue: { findOne: jest.fn(), count: jest.fn() },
        },
        {
          provide: getRepositoryToken(TimeOffBalance),
          useValue: { findOne: jest.fn(), save: jest.fn(), find: jest.fn() },
        },
        {
          provide: getRepositoryToken(TimeOffRequest),
          useValue: { create: jest.fn(), save: jest.fn(), findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(IdempotencyKey),
          useValue: { findOne: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(AuditLog),
          useValue: { save: jest.fn() },
        },
        {
          provide: HcmService,
          useValue: { 
            validateBalance: jest.fn(), 
            deductBalance: jest.fn(),
            getBalancesSnapshot: jest.fn()
          },
        },
        {
          provide: DataSource,
          useValue: { 
            transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TimeOffService>(TimeOffService);
    hcmService = module.get<HcmService>(HcmService);
    requestRepo = module.get(getRepositoryToken(TimeOffRequest));
  });

  describe('createRequest', () => {
    it('should throw BadRequestException if available balance is insufficient', async () => {
      const dto = { employeeId: mockEmployeeId, locationId: 'NY', requestedHours: 20, startDate: '2026-01-01', endDate: '2026-01-02' };
      
      const mockBalance = { balance: 160, reservedBalance: 150 };
      const mockManager = {
        findOne: jest.fn().mockResolvedValue(mockBalance),
      };
      (service as any).dataSource.transaction = jest.fn(cb => cb(mockManager));
      
      await expect(service.createRequest(dto)).rejects.toThrow(BadRequestException);
    });

    it('should successfully reserve balance and create a request', async () => {
      const dto = { employeeId: mockEmployeeId, locationId: 'NY', requestedHours: 8, startDate: '2026-01-01', endDate: '2026-01-01' };
      
      const mockBalance = { balance: 160, reservedBalance: 0 };
      const mockRequest = { id: mockRequestId, ...dto, status: RequestStatus.PENDING };

      const mockManager = {
        findOne: jest.fn().mockResolvedValue(mockBalance),
        save: jest.fn().mockImplementation((entity) => entity),
        create: jest.fn().mockReturnValue(mockRequest),
      };
      (service as any).dataSource.transaction = jest.fn(cb => cb(mockManager));

      const result = await service.createRequest(dto);

      expect(mockManager.save).toHaveBeenCalledWith(expect.objectContaining({
        reservedBalance: 8
      }));
      expect(result.status).toBe(RequestStatus.PENDING);
    });
  });

  describe('approveRequest', () => {
    it('should throw BadRequestException if HCM validation fails', async () => {
      requestRepo.findOne.mockResolvedValue({ id: mockRequestId, employeeId: mockEmployeeId, locationId: 'NY', requestedHours: 10, status: RequestStatus.PENDING });
      jest.spyOn(hcmService, 'validateBalance').mockResolvedValue(false);

      // Handle the internal transaction for failed approval too
      const mockManager = {
        findOne: jest.fn().mockResolvedValue({ balance: 160, reservedBalance: 10 }),
        save: jest.fn().mockImplementation((entity) => entity),
      };
      (service as any).dataSource.transaction = jest.fn(cb => cb(mockManager));

      await expect(service.approveRequest(mockRequestId, {})).rejects.toThrow(BadRequestException);
    });

    it('should complete approval when HCM deduction succeeds', async () => {
      const mockRequest = { id: mockRequestId, employeeId: mockEmployeeId, locationId: 'NY', requestedHours: 10, status: RequestStatus.PENDING };
      requestRepo.findOne.mockResolvedValue(mockRequest);
      
      jest.spyOn(hcmService, 'validateBalance').mockResolvedValue(true);
      jest.spyOn(hcmService, 'deductBalance').mockResolvedValue('hcm-tx-test');

      const mockBalance = { balance: 160, reservedBalance: 10 };
      const mockManager = {
        findOne: jest.fn().mockImplementation((entity, criteria) => {
          return mockBalance;
        }),
        save: jest.fn().mockImplementation((entity) => entity),
      };
      (service as any).dataSource.transaction = jest.fn(cb => cb(mockManager));

      const result = await service.approveRequest(mockRequestId, { managerComment: 'Enjoy' });

      expect(result.status).toBe('APPROVED_SYNCED');
      expect(mockBalance.balance).toBe(150);
      expect(mockBalance.reservedBalance).toBe(0);
    });
  });

  describe('rejectRequest', () => {
    it('should release reserved balance and set status to REJECTED', async () => {
      const mockRequest = { id: mockRequestId, employeeId: mockEmployeeId, locationId: 'NY', requestedHours: 10, status: RequestStatus.PENDING };
      const mockBalance = { balance: 160, reservedBalance: 10 };
      
      const mockManager = {
        findOne: jest.fn().mockImplementation((entity) => (entity === TimeOffRequest ? mockRequest : mockBalance)),
        save: jest.fn().mockImplementation((entity) => entity),
      };
      (service as any).dataSource.transaction = jest.fn(cb => cb(mockManager));

      const result = await service.rejectRequest(mockRequestId, { managerComment: 'No' });

      expect(result.status).toBe(RequestStatus.REJECTED);
      expect(mockBalance.reservedBalance).toBe(0);
    });
  });

  describe('reconcileBalances', () => {
    it('should correct local balances based on HCM snapshot', async () => {
      const snapshot = [{ employeeId: mockEmployeeId, locationId: 'NY', balance: 200, type: 'PTO' }];
      jest.spyOn(hcmService, 'getBalancesSnapshot').mockResolvedValue(snapshot);

      const mockBalance = { id: 'bal-1', employeeId: mockEmployeeId, balance: 160, type: 'PTO' };
      const mockManager = {
        findOne: jest.fn().mockResolvedValue(mockBalance),
        save: jest.fn().mockImplementation((entity) => entity),
      };
      (service as any).dataSource.transaction = jest.fn(cb => cb(mockManager));

      const result = await service.reconcileBalances();

      expect(result.corrected).toBe(1);
      expect(mockBalance.balance).toBe(200);
    });
  });

  describe('Idempotency', () => {
    it('should return cached response if key exists', async () => {
      const key = 'test-key';
      const cachedResponse = { id: 'cached-1' };
      const idempotencyRepo = (service as any).idempotencyRepository;
      idempotencyRepo.findOne.mockResolvedValue({ key, response: JSON.stringify(cachedResponse) });

      const result = await service.createRequest({} as any, key);
      expect(result.id).toBe('cached-1');
    });
  });
});
