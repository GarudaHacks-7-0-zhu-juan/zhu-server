import { GuardianRelationshipStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class RespondGuardianRequestDto {
  @IsEnum(GuardianRelationshipStatus)
  status!: 'ACCEPTED' | 'DECLINED';
}
