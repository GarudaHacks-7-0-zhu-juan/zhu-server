import { Matches } from 'class-validator';

export class CreateGuardianRequestDto {
  @Matches(/^\+[1-9]\d{7,14}$/)
  phoneNumber!: string;
}
