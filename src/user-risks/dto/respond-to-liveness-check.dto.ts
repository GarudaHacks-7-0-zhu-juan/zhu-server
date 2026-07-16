import { IsBoolean } from 'class-validator';

export class RespondToLivenessCheckDto {
  @IsBoolean()
  isOkay!: boolean;
}
