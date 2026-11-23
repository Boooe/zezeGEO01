import { Type, Transform } from 'class-transformer';
import {
  IsString,
  IsUUID,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsIn,
  IsArray,
  ArrayMinSize,
  IsDateString,
  IsObject,
} from 'class-validator';

import { PUBLISH_STATUS, AUTO_PUBLISH_STATUS, AUTO_PUBLISH_LIBRARY } from '@shared/api.interface';

const CONTENT_TYPES = ['image', 'video', 'article'] as const;
const PLATFORMS = [
  'douyin',
  'xiaohongshu',
  'wechat_mp',
  'video_channel',
  'weibo',
  'bilibili',
  'kuaishou',
  'baidu',
  '360',
  'sogou',
  'toutiao',
  'submission',
] as const;

export class PublishRecordListQueryDto {
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
  @IsIn(CONTENT_TYPES)
  contentType?: 'image' | 'video' | 'article';

  @IsOptional()
  @IsIn(PUBLISH_STATUS)
  status?: 'pending' | 'published' | 'failed' | 'archived';

  @IsOptional()
  @IsIn(PLATFORMS)
  platform?: string;

  @IsOptional()
  @IsString()
  keyword?: string;
}

export class CreatePublishRecordDto {
  @IsUUID()
  brandId!: string;

  @IsOptional()
  @IsUUID()
  taskId?: string;

  @IsIn(CONTENT_TYPES)
  contentType!: 'image' | 'video' | 'article';

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  externalUrl?: string;

  @IsOptional()
  @IsIn(PLATFORMS)
  platform?: string;

  @IsOptional()
  @IsIn(PUBLISH_STATUS)
  status?: 'pending' | 'published' | 'failed' | 'archived';

  @IsOptional()
  @Type(() => Date)
  publishDate?: Date;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePublishRecordDto {
  @IsOptional()
  @IsIn(PUBLISH_STATUS)
  status?: 'pending' | 'published' | 'failed' | 'archived';

  @IsOptional()
  @IsString()
  externalUrl?: string;

  @IsOptional()
  @IsIn(PLATFORMS)
  platform?: string;

  @IsOptional()
  @Transform(({ obj, key, value }) =>
    obj[key] === '' ? undefined : value,
  )
  @Type(() => Date)
  publishDate?: Date | null;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  title?: string;
}

export class AutoPublishTaskListQueryDto {
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
  @IsIn(AUTO_PUBLISH_LIBRARY)
  libraryType?: 'public_private' | 'b2b_alliance';

  @IsOptional()
  @IsIn(AUTO_PUBLISH_STATUS)
  status?: 'running' | 'paused' | 'stopped' | 'completed';

  @IsOptional()
  @IsString()
  keyword?: string;
}

export class CreateAutoPublishTaskDto {
  @IsUUID()
  brandId!: string;

  @IsString()
  taskName!: string;

  @IsIn(['self_media', 'market'])
  channelSource!: 'self_media' | 'market';

  @IsIn(AUTO_PUBLISH_LIBRARY)
  libraryType!: 'public_private' | 'b2b_alliance';

  @IsArray()
  @IsUUID('4', { each: true })
  channelIds!: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  marketChannelIds?: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  articleIds!: string[];

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  dailyLimit!: number;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsObject()
  sourceRule?: Record<string, unknown>;

  @IsOptional()
  @IsIn(['manual', 'auto'])
  sourceSelectionMode?: 'manual' | 'auto';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  budgetCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  publishIntervalMinutes?: number;
}

export class UpdateAutoPublishTaskDto {
  @IsOptional()
  @IsString()
  taskName?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  channelIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  articleIds?: string[];

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dailyLimit?: number;

  @IsOptional()
  @IsIn(AUTO_PUBLISH_STATUS)
  status?: 'running' | 'paused' | 'stopped' | 'completed';

  @IsOptional()
  @IsObject()
  sourceRule?: Record<string, unknown>;

  @IsOptional()
  @IsIn(['manual', 'auto'])
  sourceSelectionMode?: 'manual' | 'auto';
}
