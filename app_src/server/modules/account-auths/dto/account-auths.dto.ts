import { Type } from 'class-transformer';
import {
  IsString,
  IsUUID,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsIn,
} from 'class-validator';

import {
  ACCOUNT_PLATFORMS,
  AUTH_METHODS,
  AUTH_STATUSES,
} from '@shared/api.interface';

export class AccountAuthListQueryDto {
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
  @IsIn(AUTH_STATUSES)
  authStatus?: 'authorized' | 'unauthorized' | 'expired';

  @IsOptional()
  @IsString()
  keyword?: string;
}

export class CreateAccountAuthDto {
  @IsUUID()
  brandId!: string;

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

  @IsString()
  accountName!: string;

  @IsOptional()
  @IsString()
  accountIdentifier?: string;

  @IsIn(AUTH_METHODS)
  authMethod!: 'qr_code' | 'client' | 'manual';

  @IsOptional()
  @IsString()
  remark?: string;
}

export class UpdateAccountAuthDto {
  @IsOptional()
  @IsString()
  accountName?: string;

  @IsOptional()
  @IsString()
  accountIdentifier?: string;

  @IsOptional()
  @IsIn(AUTH_METHODS)
  authMethod?: 'qr_code' | 'client' | 'manual';

  @IsOptional()
  @IsString()
  remark?: string;
}
