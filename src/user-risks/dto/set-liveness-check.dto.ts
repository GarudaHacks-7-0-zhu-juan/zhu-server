import { IsBoolean } from 'class-validator';

export class SetLivenessCheckDto {
  @IsBoolean()
  enabled!: boolean;
}
