import { Controller, Get, Post, Body, Param, Query, HttpCode, HttpStatus, Headers } from '@nestjs/common';
import { TimeOffService } from './time-off.service';
import { CreateTimeOffRequestDto } from './dto/create-request.dto';
import { ManagerActionDto } from './dto/approve-reject.dto';

@Controller('time-off')
export class TimeOffController {
  constructor(private readonly timeOffService: TimeOffService) {}

  @Get('balance')
  async getBalance(@Query('employeeId') employeeId: string) {
    return this.timeOffService.getBalances(employeeId);
  }

  @Post('request')
  @HttpCode(HttpStatus.CREATED)
  async createRequest(
    @Body() createDto: CreateTimeOffRequestDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    return this.timeOffService.createRequest(createDto, idempotencyKey);
  }

  @Post('approve/:id')
  async approveRequest(
    @Param('id') id: string,
    @Body() actionDto: ManagerActionDto,
  ) {
    return this.timeOffService.approveRequest(id, actionDto);
  }

  @Post('reject/:id')
  async rejectRequest(
    @Param('id') id: string,
    @Body() actionDto: ManagerActionDto,
  ) {
    return this.timeOffService.rejectRequest(id, actionDto);
  }

  // Trigger Batch Sync
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  async syncWithHcm() {
    return this.timeOffService.reconcileBalances();
  }
}
