import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { Employee } from '../src/time-off/entities/employee.entity';
import { TimeOffBalance } from '../src/time-off/entities/time-off-balance.entity';
import { HcmService } from '../src/hcm/hcm.service';

describe('TimeOff (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const getTestUserId = () => '123e4567-e89b-12d3-a456-42661417' + Math.floor(Math.random() * 1000).toString().padStart(4, '0');

  beforeEach(async () => {
    // Unique in-memory DB per test
    const dbId = Math.random().toString(36).substring(7);
    process.env.DATABASE_NAME = `file:memdb-${dbId}?mode=memory&cache=shared`;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
    .overrideProvider(HcmService)
    .useValue({
      validateBalance: jest.fn().mockResolvedValue(true),
      deductBalance: jest.fn().mockResolvedValue('hcm-e2e-tx'),
      getBalancesSnapshot: (uid: string) => jest.fn().mockResolvedValue([{ employeeId: uid, locationId: 'NY', balance: 160, type: 'PTO' }]),
    })
    .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    
    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterEach(async () => {
    await app.close();
  });

  const seed = async (uid: string) => {
    const repo = dataSource.getRepository(Employee);
    const balRepo = dataSource.getRepository(TimeOffBalance);
    await repo.save({ id: uid, firstName: 'John', lastName: 'Doe', email: `${uid}@example.com` });
    await balRepo.save({ employeeId: uid, locationId: 'NY', balance: 160, reservedBalance: 0, type: 'PTO' });
  };

  it('Balance Check', async () => {
    const uid = getTestUserId();
    await seed(uid);
    const res = await request(app.getHttpServer()).get(`/time-off/balance?employeeId=${uid}`).expect(200);
    expect(Number(res.body[0].balance)).toBe(160);
  });

  it('Create Request', async () => {
    const uid = getTestUserId();
    await seed(uid);
    await request(app.getHttpServer()).post('/time-off/request').send({ employeeId: uid, locationId: 'NY', requestedHours: 10, startDate: '2026-01-01', endDate: '2026-01-01' }).expect(201);
    const res = await request(app.getHttpServer()).get(`/time-off/balance?employeeId=${uid}`).expect(200);
    expect(Number(res.body[0].reservedBalance)).toBe(10);
  });

  it('Approval Flow', async () => {
    const uid = getTestUserId();
    await seed(uid);
    const c = await request(app.getHttpServer()).post('/time-off/request').send({ employeeId: uid, locationId: 'NY', requestedHours: 10, startDate: '2026-01-01', endDate: '2026-01-01' });
    await request(app.getHttpServer()).post(`/time-off/approve/${c.body.id}`).send({}).expect(201);
    const res = await request(app.getHttpServer()).get(`/time-off/balance?employeeId=${uid}`).expect(200);
    expect(Number(res.body[0].balance)).toBe(150);
  });

  it('Concurrency', async () => {
    const uid = getTestUserId();
    await seed(uid);
    const payload = { employeeId: uid, locationId: 'NY', requestedHours: 10, startDate: '2026-01-01', endDate: '2026-01-01' };
    const results = await Promise.all([
      request(app.getHttpServer()).post('/time-off/request').send(payload),
      request(app.getHttpServer()).post('/time-off/request').send(payload),
      request(app.getHttpServer()).post('/time-off/request').send(payload),
    ]);
    results.forEach(r => expect(r.status).toBe(201));
    const res = await request(app.getHttpServer()).get(`/time-off/balance?employeeId=${uid}`).expect(200);
    expect(Number(res.body[0].reservedBalance)).toBe(30);
  });
});
