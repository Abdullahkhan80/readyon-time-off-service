import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeOffController } from './time-off.controller';
import { TimeOffService } from './time-off.service';
import { Employee } from './entities/employee.entity';
import { TimeOffBalance } from './entities/time-off-balance.entity';
import { TimeOffRequest } from './entities/time-off-request.entity';
import { IdempotencyKey } from '../common/entities/idempotency-key.entity';
import { AuditLog } from '../common/entities/audit-log.entity';
import { HcmModule } from '../hcm/hcm.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Employee, TimeOffBalance, TimeOffRequest, IdempotencyKey, AuditLog]),
    HcmModule,
  ],
  controllers: [TimeOffController],
  providers: [TimeOffService],
  exports: [TimeOffService],
})
export class TimeOffModule {}
