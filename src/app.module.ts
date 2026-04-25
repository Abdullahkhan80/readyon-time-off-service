import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { TimeOffModule } from './time-off/time-off.module';
import { HcmModule } from './hcm/hcm.module';
import { MockHcmController } from './mock-hcm/mock-hcm.controller';
import { Employee } from './time-off/entities/employee.entity';
import { TimeOffBalance } from './time-off/entities/time-off-balance.entity';
import { TimeOffRequest } from './time-off/entities/time-off-request.entity';
import { IdempotencyKey } from './common/entities/idempotency-key.entity';
import { AuditLog } from './common/entities/audit-log.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: process.env.DATABASE_NAME || 'database.sqlite',
      entities: [Employee, TimeOffBalance, TimeOffRequest, IdempotencyKey, AuditLog],
      synchronize: true,
      enableWAL: true,
    }),
    TimeOffModule,
    HcmModule,
  ],
  controllers: [MockHcmController],
})
export class AppModule {}
