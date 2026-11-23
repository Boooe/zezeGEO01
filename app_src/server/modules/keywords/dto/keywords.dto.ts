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
  IsBoolean,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  Matches,
} from 'class-validator';

import { KEYWORD_TYPES, PLATFORMS, TASK_STATUS, INSPIRATION_INTENT_TYPES, INSPIRATION_INDUSTRIES, LONGTAIL_CONFIG_TYPES } from '@shared/api.interface';

export class KeywordListQueryDto {
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
  @IsIn(KEYWORD_TYPES)
  keywordType?: 'core' | 'longtail';

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  parentKeywordId?: string;
}

// ---------- 词池 ----------

export class PoolListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsIn(KEYWORD_TYPES)
  keywordType?: 'core' | 'longtail';

  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsIn(['default', 'opportunity'])
  sortBy?: 'default' | 'opportunity';

  @IsOptional()
  @Transform(({ obj, key }) => obj[key] === 'true')
  @IsBoolean()
  highOpportunityOnly?: boolean;
}

export class AddPoolKeywordDto {
  @IsUUID()
  brandId!: string;

  @IsString()
  keyword!: string;

  @IsIn(KEYWORD_TYPES)
  keywordType!: 'core' | 'longtail';

  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsOptional()
  @IsString()
  source?: string;
}

export class PoolKeywordItemDto {
  @IsString()
  keyword!: string;

  @IsIn(KEYWORD_TYPES)
  keywordType!: 'core' | 'longtail';
}

export class BatchImportPoolDto {
  @IsUUID()
  brandId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PoolKeywordItemDto)
  keywords!: PoolKeywordItemDto[];

  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsOptional()
  @IsString()
  source?: string;
}

export class BatchMovePoolDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  ids!: string[];
}

export class GenerateLongtailDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  keywords!: string[];

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;
}

// ---------- 词灵感 ----------

export class GenerateInspirationDto {
  @IsString()
  seedKeyword!: string;

  @IsIn(KEYWORD_TYPES)
  keywordType!: 'core' | 'longtail';

  @IsUUID()
  brandId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  count?: number;

  @IsOptional()
  @IsString()
  brandName?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  districts?: string[];

  @IsOptional()
  @IsIn(INSPIRATION_INDUSTRIES)
  industry?: string;

  @IsOptional()
  @Transform(({ obj, key }) => obj[key] === 'true')
  @IsBoolean()
  includeBrand?: boolean;

  @IsOptional()
  @Transform(({ obj, key }) => obj[key] === 'true')
  @IsBoolean()
  includeQuestion?: boolean;

  @IsOptional()
  @Transform(({ obj, key }) => obj[key] === 'true')
  @IsBoolean()
  includeLocal?: boolean;
}

export class InspirationKeywordItemDto {
  @IsString()
  keyword!: string;

  @IsIn(KEYWORD_TYPES)
  keywordType!: 'core' | 'longtail';

  @IsOptional()
  @IsString()
  reason?: string;
}

export class AddInspirationToPoolDto {
  @IsUUID()
  brandId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InspirationKeywordItemDto)
  keywords!: InspirationKeywordItemDto[];

  @IsOptional()
  @IsUUID()
  groupId?: string;
}

export class CreateKeywordDto {
  @IsUUID()
  brandId!: string;

  @IsString()
  keyword!: string;

  @IsIn(KEYWORD_TYPES)
  keywordType!: 'core' | 'longtail';

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isExample?: boolean;

  @IsOptional()
  @IsUUID()
  parentKeywordId?: string;
}

export class BatchImportKeywordDto {
  @IsUUID()
  brandId!: string;

  @IsIn(KEYWORD_TYPES)
  keywordType!: 'core' | 'longtail';

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  keywords!: string[];

  @IsOptional()
  @IsUUID()
  parentKeywordId?: string;
}

export class CreateTasksDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  keywordIds!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(PLATFORMS, { each: true })
  platforms!: string[];

  @IsOptional()
  @IsString()
  city?: string;
}

export class TaskListQueryDto {
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
  @IsIn(TASK_STATUS)
  status?: 'pending' | 'running' | 'completed' | 'failed';

  @IsOptional()
  @IsIn(PLATFORMS)
  platform?: string;
}

export class ReportListQueryDto {
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
  @IsIn(PLATFORMS)
  platform?: string;

  @IsOptional()
  @Transform(({ obj, key }) => {
    const val = obj[key];
    if (val === 'true') return true;
    if (val === 'false') return false;
    return val;
  })
  @IsBoolean()
  isHit?: boolean;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate 格式应为 YYYY-MM-DD' })
  startDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate 格式应为 YYYY-MM-DD' })
  endDate?: string;
}

// ---------- 长尾词配置 ----------

export class LongtailConfigQueryDto {
  @IsUUID()
  brandId!: string;

  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsIn(LONGTAIL_CONFIG_TYPES)
  type!: 'prefix' | 'suffix';
}

export class SaveLongtailConfigDto {
  @IsUUID()
  brandId!: string;

  @IsOptional()
  @IsUUID()
  groupId?: string | null;

  @IsIn(LONGTAIL_CONFIG_TYPES)
  configType!: 'prefix' | 'suffix';

  @IsArray()
  @IsString({ each: true })
  words!: string[];
}

export class LongtailCombinePreviewDto {
  @IsUUID()
  brandId!: string;

  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsArray()
  @IsString({ each: true })
  prefixWords!: string[];

  @IsArray()
  @IsString({ each: true })
  suffixWords!: string[];
}

export class LongtailCombineDto {
  @IsUUID()
  brandId!: string;

  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsArray()
  @IsString({ each: true })
  prefixWords!: string[];

  @IsArray()
  @IsString({ each: true })
  suffixWords!: string[];
}

export class BatchAddKeywordsPoolDto {
  @IsUUID()
  brandId!: string;

  @IsOptional()
  @IsUUID()
  groupId?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  keywords!: string[];

  @IsOptional()
  @IsUUID()
  parentKeywordId?: string;
}

export class ToggleCoreDto {
  @IsBoolean()
  @Type(() => Boolean)
  isCore!: boolean;
}

export class SetParentDto {
  @IsOptional()
  @IsUUID()
  parentKeywordId?: string | null;
}
