import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class RegisterPushDeviceDto {
  @IsString()
  @IsNotEmpty()
  registrationToken: string;

  @IsIn(['android'])
  platform: 'android';
}
