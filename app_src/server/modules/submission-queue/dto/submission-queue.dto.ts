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
  SUBMISSION_QUEUE_STATUSES,
} from '@shared/api.interface';

const RESULT_STATUSES = ['success', 'failed'] as const;

export class SubmissionQueueListQueryDto {
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
  @IsIn(SUBMISSION_QUEUE_STATUSES as readonly string[])
  status?: 'pending' | 'submitted' | 'indexed' | 'rejected' | 'failed' | 'cancelled';

  @IsOptional()
  @Transform(({ obj, key }) => (obj[key] === '' ? undefined : obj[key]))
  @Type(() => Date)
  startDate?: Date;

  @IsOptional()
  @Transform(({ obj, key }) => (obj[key] === '' ? undefined : obj[key]))
  @Type(() => Date)
  endDate?: Date;

  @IsOptional()
  @Transform(({ obj, key }) => (obj[key] === '' ? undefined : obj[key]))
  @IsString()
  keyword?: string;
}

export class EnqueueSubmissionDto {
  @IsUUID()
  articleId!: string;

  @IsUUID()
  channelId!: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;
}

export class SubmissionStatusUpdateDto {
  @IsIn(SUBMISSION_QUEUE_STATUSES as readonly string[])
  status!: 'pending' | 'submitted' | 'indexed' | 'rejected' | 'failed' | 'cancelled';

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  rejectReason?: string;

  @IsOptional()
  @IsString()
  rejectCategory?: string;

  @IsOptional()
  @Type(() => Date)
  indexedAt?: Date;
}

export class SubmissionResultDto {
  @IsIn(RESULT_STATUSES)
  status!: 'success' | 'failed';

  @IsOptional()
  @IsString()
  screenshotUrl?: string;

  @IsOptional()
  @IsString()
  error?: string;
}

export class PendingSubmissionQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
