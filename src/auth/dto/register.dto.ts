import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsOptional()
  @IsString()
  @Matches(/\S/)
  @MaxLength(80)
  displayName?: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @Matches(/^\+[1-9]\d{7,14}$/)
  phoneNumber!: string;
}
