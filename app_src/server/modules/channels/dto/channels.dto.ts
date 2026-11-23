import { Type, Transform } from 'class-transformer';
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
  CHANNEL_PLATFORMS,
  CHANNEL_PUBLISH_MODES,
  CHANNEL_STATUSES,
} from '@shared/api.interface';

export class ChannelListQueryDto {
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
  @IsIn(CHANNEL_PLATFORMS)
  platform?: 'baijiahao' | 'toutiao' | 'zhihu' | 'xiaohongshu' | 'wechat' | 'website';

  @IsOptional()
  @IsIn(CHANNEL_STATUSES)
  status?: 'active' | 'paused';
}

export class CreateChannelDto {
  @IsIn(CHANNEL_PLATFORMS)
  platform!: 'baijiahao' | 'toutiao' | 'zhihu' | 'xiaohongshu' | 'wechat' | 'website';

  @IsString()
  accountName!: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsIn(CHANNEL_PUBLISH_MODES)
  publishMode!: 'local_auto' | 'official_api' | 'manual';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  dailyLimit!: number;

  @IsOptional()
  @IsString()
  remark?: string;
}

export class UpdateChannelDto {
  @IsOptional()
  @IsIn(CHANNEL_STATUSES)
  status?: 'active' | 'paused';

  @IsOptional()
  @Transform(({ obj, key, value }) =>
    obj[key] === '' ? undefined : value,
  )
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dailyLimit?: number;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsString()
  accountName?: string;
}
