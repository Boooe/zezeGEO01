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

import {
  AUTO_PUBLISH_STATUS,
  AUTO_PUBLISH_LIBRARY,
} from '@shared/api.interface';

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
  libraryType?: 'public' | 'authoritative' | 'b2b_alliance' | 'multimodal' | 'self_site';

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
  libraryType!: 'public' | 'authoritative' | 'b2b_alliance' | 'multimodal' | 'self_site';

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
  dailyLimit!: number;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsUUID('4')
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
