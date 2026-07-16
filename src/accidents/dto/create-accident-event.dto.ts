import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { AccidentEventType } from '@prisma/client';

export class CreateAccidentEventDto {
  @IsEnum(AccidentEventType)
  eventType!: AccidentEventType;

  @IsOptional()
  @IsDateString()
  detectedAt?: string;
}
