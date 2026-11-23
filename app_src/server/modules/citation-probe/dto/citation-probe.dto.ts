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
  IsBoolean,
} from 'class-validator';

import {
  DIAGNOSIS_PLATFORMS,
  CITATION_PROBE_STATUS,
} from '@shared/api.interface';
import type {
  DiagnosisPlatform,
  CitationProbeStatus,
} from '@shared/api.interface';

// ---------- 关键词列表 ----------

export class CitationProbeKeywordListQueryDto {
  @IsUUID()
  brandId!: string;
}

// ---------- 生成提问模板 ----------

export class GenerateQuestionsDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @Type(() => String)
  keywords!: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  count?: number;
}

// ---------- 创建任务 ----------

export class CreateCitationProbeTaskDto {
  @IsUUID()
  brandId!: string;

  @IsString()
  brandName!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  brandAliases?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  @Type(() => String)
  keywordIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  keywords?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsIn(DIAGNOSIS_PLATFORMS, { each: true })
  @ArrayMinSize(1)
  @Type(() => String)
  platforms!: DiagnosisPlatform[];

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @Type(() => String)
  questions!: string[];
}

// ---------- 任务列表 ----------

export class CitationProbeTaskListQueryDto {
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
  @Transform(({ obj, key, value }) =>
    obj[key] === '' ? undefined : value,
  )
  @Type(() => String)
  @IsIn(CITATION_PROBE_STATUS)
  status?: CitationProbeStatus;
}

// ---------- 结果列表 ----------

export class CitationProbeResultListQueryDto {
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
  @Type(() => String)
  @IsIn(DIAGNOSIS_PLATFORMS)
  platform?: DiagnosisPlatform;

  @IsOptional()
  @Transform(({ obj, key }) => {
    if (obj[key] === '' || obj[key] === undefined) return undefined;
    return obj[key] === 'true';
  })
  @IsBoolean()
  isMentioned?: boolean;

  @IsOptional()
  @IsUUID()
  taskId?: string;
}

// ---------- 手工快照录入 ----------

export class CreateManualSnapshotDto {
  @IsUUID()
  brandId!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  brandAliases?: string[];

  @IsString()
  question!: string;

  @Type(() => String)
  @IsIn(DIAGNOSIS_PLATFORMS)
  platform!: DiagnosisPlatform;

  @IsString()
  rawAnswer!: string;

  @IsOptional()
  @IsUUID()
  taskId?: string;
}

// ---------- KPI ----------

export class CitationProbeKpiQueryDto {
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @Type(() => String)
  @IsIn(DIAGNOSIS_PLATFORMS)
  platform?: DiagnosisPlatform;
}

// ---------- 平台分布 ----------

export class CitationProbePlatformDistributionQueryDto {
  @IsOptional()
  @IsUUID()
  brandId?: string;
}
