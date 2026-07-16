import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class RegisterPushDeviceDto {
  @IsString()
  @IsNotEmpty()
  firebaseInstallationId: string;

  @IsIn(['android'])
  platform: 'android';
}
