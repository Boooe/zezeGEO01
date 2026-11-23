import { IsString, MinLength, MaxLength, IsOptional, IsBoolean } from 'class-validator';
import type { LoginRequest } from '@shared/api.interface';

export class LoginDto implements LoginRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  username!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  password!: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
