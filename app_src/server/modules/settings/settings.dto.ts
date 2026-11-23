import { IsString, MinLength } from 'class-validator';

export class CreateTokenDto {
  @IsString()
  @MinLength(1)
  name!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  oldPassword!: string;

  @IsString()
  @MinLength(6)
  newPassword!: string;
}
