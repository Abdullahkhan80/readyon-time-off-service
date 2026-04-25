import { IsOptional, IsString } from 'class-validator';

export class ManagerActionDto {
  @IsOptional()
  @IsString()
  managerComment?: string;
}
