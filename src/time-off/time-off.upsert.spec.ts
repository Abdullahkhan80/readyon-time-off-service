import { Test, TestingModule } from '@nestjs/testing';
import { TimeOffService } from './time-off.service';
import { HcmService } from '../hcm/hcm.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Employee } from './entities/employee.entity';
import { TimeOffBalance } from './entities/time-off-balance.entity';
import { TimeOffRequest } from './entities/time-off-request.entity';
import { IdempotencyKey } from '../common/entities/idempotency-key.entity';
import { AuditLog } from '../common/entities/audit-log.entity';
import { DataSource } from 'typeorm';

describe('TimeOffService Upsert', () => {
  let service: TimeOffService;
  let hcmService: HcmService;

  const mockHcmService = {
    getBalancesSnapshot: jest.fn(),
  };

  const mockRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn((cb) => cb(mockRepo)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimeOffService,
        { provide: HcmService, useValue: mockHcmService },
        { provide: DataSource, useValue: mockDataSource },
        { provide: getRepositoryToken(Employee), useValue: mockRepo },
        { provide: getRepositoryToken(TimeOffBalance), useValue: mockRepo },
        { provide: getRepositoryToken(TimeOffRequest), useValue: mockRepo },
        { provide: getRepositoryToken(IdempotencyKey), useValue: mockRepo },
        { provide: getRepositoryToken(AuditLog), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<TimeOffService>(TimeOffService);
    hcmService = module.get<HcmService>(HcmService);
  });

  it('should create missing balance and employee during reconcile', async () => {
    const snapshot = [{ employeeId: 'new-id', locationId: 'NY', balance: 100, type: 'PTO' }];
    mockHcmService.getBalancesSnapshot.mockResolvedValue(snapshot);
    
    // First findOne for balance returns null
    mockRepo.findOne.mockResolvedValueOnce(null);
    // Second findOne for employee returns null
    mockRepo.findOne.mockResolvedValueOnce(null);
    
    mockRepo.create.mockImplementation((entity, data) => data);
    mockRepo.save.mockResolvedValue({});

    const result = await service.reconcileBalances();
    
    expect(result.created).toBe(1);
    expect(mockRepo.create).toHaveBeenCalledWith(Employee, expect.objectContaining({ id: 'new-id' }));
    expect(mockRepo.create).toHaveBeenCalledWith(TimeOffBalance, expect.objectContaining({ employeeId: 'new-id', balance: 100 }));
  });
});
