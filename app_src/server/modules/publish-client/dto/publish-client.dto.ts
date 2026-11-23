import { IsString, IsOptional, IsUUID, IsBoolean, MinLength, MaxLength } from 'class-validator';

export class ClientBindDto {
  @IsString()
  @MinLength(6)
  @MaxLength(10)
  authCode!: string;

  @IsOptional()
  @IsString()
  clientVersion?: string;
}

export class ClientHeartbeatDto {
  @IsString()
  token!: string;

  @IsOptional()
  @IsString()
  clientVersion?: string;
}

export class ClientTaskResultDto {
  @IsString()
  token!: string;

  @IsBoolean()
  success!: boolean;

  @IsOptional()
  @IsString()
  publishUrl?: string;

  @IsOptional()
  @IsString()
  error?: string;

  @IsOptional()
  @IsString()
  publishedAt?: string;
}
