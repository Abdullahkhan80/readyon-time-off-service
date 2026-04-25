import { IsNotEmpty, IsUUID, IsDateString, IsNumber, Min, IsOptional, IsString } from 'class-validator';

export class CreateTimeOffRequestDto {
  @IsNotEmpty()
  @IsUUID()
  employeeId: string;

  @IsNotEmpty()
  @IsString()
  locationId: string;

  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @IsNotEmpty()
  @IsDateString()
  endDate: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.5)
  requestedHours: number;

  @IsOptional()
  @IsString()
  managerComment?: string; // Used by employees to provide context
}
