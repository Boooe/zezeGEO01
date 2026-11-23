import { Type, Transform } from 'class-transformer';
import {
  IsString,
  IsUUID,
  IsOptional,
  IsInt,
  Min,
  IsIn,
  IsArray,
  IsNotEmpty,
  MaxLength,
  ArrayMinSize,
} from 'class-validator';

import {
  KEYWORD_INDEX_SOURCES,
  KEYWORD_INDEX_PERIODS,
} from '@shared/api.interface';
import type {
  CreateKeywordIndexLogRequest,
  KeywordIndexBatchQuery,
} from '@shared/api.interface';

export class CreateKeywordIndexLogDto implements CreateKeywordIndexLogRequest {
  @IsUUID()
  keywordId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  keywordText!: string;

  @IsIn(KEYWORD_INDEX_SOURCES)
  source!: 'baidu' | 'weixin';

  @Type(() => Number)
  @IsInt()
  @Min(0)
  value!: number;

  @IsIn(KEYWORD_INDEX_PERIODS)
  period!: '7d' | '30d' | '90d';

  @IsString()
  @IsNotEmpty()
  collectedAt!: string;

  @IsString()
  @IsNotEmpty()
  screenshotUrl!: string;

  @IsOptional()
  @IsString()
  ocrText?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}

export class KeywordIndexListQueryDto {
  @IsUUID()
  keywordId!: string;
}

export class BatchQueryDto implements KeywordIndexBatchQuery {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  keywordIds!: string[];
}
