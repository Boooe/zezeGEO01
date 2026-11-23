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
  IsObject,
  IsBoolean,
} from 'class-validator';

import {
  PUBLISH_QUEUE_STATUSES,
  DISPATCH_PLAN_STATUSES,
  CHANNEL_PUBLISH_MODES,
  PUBLISH_QUEUE_SOURCES,
  SUBMISSION_CHANNEL_TYPES,
} from '@shared/api.interface';

const RESULT_STATUSES = ['success', 'failed', 'pending_manual'] as const;

export class PublishQueueListQueryDto {
  @IsOptional()
  @IsString()
  keyword?: string;

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
  @IsUUID()
  channelId?: string;

  @IsOptional()
  @IsIn(DISPATCH_PLAN_STATUSES as readonly string[])
  status?: 'planned' | 'queued' | 'published' | 'failed';

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @Transform(({ obj, key }) => (obj[key] === '' ? undefined : obj[key]))
  @Type(() => Date)
  startDate?: Date;

  @IsOptional()
  @Transform(({ obj, key }) => (obj[key] === '' ? undefined : obj[key]))
  @Type(() => Date)
  endDate?: Date;

  @IsOptional()
  @Transform(({ obj, key }) => obj[key] === 'true' || obj[key] === true)
  @IsBoolean()
  pendingExecution?: boolean;
}

export class EnqueuePublishDto {
  @IsUUID()
  articleId!: string;

  @IsUUID()
  channelId!: string;

  @IsOptional()
  @IsIn(CHANNEL_PUBLISH_MODES as readonly string[])
  mode?: 'local_auto' | 'official_api' | 'manual';

  @IsOptional()
  @IsUUID()
  accountId?: string;
}

export class MarkPublishedDto {
  @IsIn(['manual', 'client'])
  publishMethod!: 'manual' | 'client';

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsString()
  url!: string;

  @Type(() => Date)
  publishedAt!: Date;

  @IsOptional()
  @IsString()
  remark?: string;
}

export class PublishResultDto {
  @IsIn(RESULT_STATUSES)
  status!: 'success' | 'failed' | 'pending_manual';

  @IsOptional()
  @IsString()
  publishUrl?: string;

  @IsOptional()
  @IsString()
  screenshotUrl?: string;

  @IsOptional()
  @IsString()
  error?: string;
}

export class PublishLedgerQueryDto {
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsIn(SUBMISSION_CHANNEL_TYPES as readonly string[])  
  channelType?: 'self_site' | 'public_submission' | 'authoritative_media' | 'industry_vertical';

  @IsOptional()
  @IsIn(PUBLISH_QUEUE_STATUSES as readonly string[])
  status?: 'pending' | 'publishing' | 'pending_manual' | 'published' | 'failed';

  @IsOptional()
  @IsString()
  keyword?: string;

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
  limit?: number;
}
