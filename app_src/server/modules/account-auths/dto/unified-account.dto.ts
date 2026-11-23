import { Type } from 'class-transformer';
import {
  IsString,
  IsUUID,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsIn,
  IsBoolean,
} from 'class-validator';

import {
  ACCOUNT_PLATFORMS,
  UNIFIED_ACCOUNT_ACCESS_TYPES,
} from '@shared/api.interface';

export class UnifiedAccountListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsIn(ACCOUNT_PLATFORMS)
  platform?:
    | 'baijiahao'
    | 'toutiao'
    | 'sohu'
    | 'wangyi'
    | 'zhihu'
    | 'wechat'
    | 'douyin'
    | 'xiaohongshu'
    | 'weibo'
    | 'bilibili'
    | 'other';

  @IsOptional()
  @IsIn(UNIFIED_ACCOUNT_ACCESS_TYPES as readonly string[])
  accessType?: 'client_auth' | 'local_account' | 'cookie';

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  keyword?: string;
}

export class CreateUnifiedAccountDto {
  @IsIn(ACCOUNT_PLATFORMS)
  platform!:
    | 'baijiahao'
    | 'toutiao'
    | 'sohu'
    | 'wangyi'
    | 'zhihu'
    | 'wechat'
    | 'douyin'
    | 'xiaohongshu'
    | 'weibo'
    | 'bilibili'
    | 'other';

  @IsIn(UNIFIED_ACCOUNT_ACCESS_TYPES as readonly string[])
  accessType!: 'client_auth' | 'local_account' | 'cookie';

  @IsUUID()
  brandId!: string;

  @IsOptional()
  @IsString()
  accountName?: string;

  @IsOptional()
  @IsString()
  accountNameLocal?: string;

  @IsOptional()
  @IsString()
  cookie?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}

export class AuthorizeCodeDto {
  @IsIn(ACCOUNT_PLATFORMS)
  platform!: string;

  @IsUUID()
  brandId!: string;

  @IsIn(['oauth', 'qr', 'password'] as const)
  authMode!: 'oauth' | 'qr' | 'password';
}

export class AccountSessionDto {
  @IsIn(['oauth', 'qr', 'password'] as const)
  authMode!: 'oauth' | 'qr' | 'password';

  @IsOptional()
  @IsString()
  cookieText?: string;

  @IsOptional()
  @IsString()
  token?: string;

  @IsOptional()
  @IsString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  platformAccountName?: string;

  @IsOptional()
  @IsString()
  clientId?: string;
}

export class AccountHeartbeatDto {
  @Type(() => Boolean)
  ok!: boolean;

  @IsOptional()
  @IsString()
  checkedAt?: string;
}
