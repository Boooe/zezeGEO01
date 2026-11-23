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
} from 'class-validator';

import {
  AI_DETECT_PLATFORMS,
  AI_DETECT_TASK_STATUSES,
  PLATFORMS,
  type AiDetectCreateRequest,
  type AiDetectPlatform,
} from '@shared/api.interface';

// ---------- 创建任务 ----------

export class CreateDetectTaskDto implements AiDetectCreateRequest {
  @IsUUID()
  brandId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  keywords!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(AI_DETECT_PLATFORMS, { each: true })
  @Type(() => String)
  platforms!: AiDetectPlatform[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  concurrency?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) =>
    (value ?? []).filter((w: string) => typeof w === 'string' && w.trim()),
  )
  hitWords?: string[];
}

// ---------- 任务列表 ----------

export class DetectTaskListQueryDto {
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
  @IsIn(AI_DETECT_TASK_STATUSES)
  status?: 'pending' | 'running' | 'completed' | 'partial_failed' | 'paused';
}

// ---------- 结果列表 ----------

export class DetectResultQueryDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsIn(AI_DETECT_PLATFORMS)
  platform?: 'volcano' | 'qwen' | 'hunyuan';

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
}

// ---------- 词灵感可见度查询 ----------

export class DetectVisibilityQueryDto {
  @IsUUID()
  brandId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  keywords!: string[];
}

// ---------- 词灵感单测 ----------

export class DetectSingleDto {
  @IsUUID()
  brandId!: string;

  @IsString()
  keyword!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(AI_DETECT_PLATFORMS, { each: true })
  @Type(() => String)
  platforms!: AiDetectPlatform[];
}

// ---------- AI 检测结果列表（报表） ----------

export class AiDetectResultListQueryDto {
  @IsUUID()
  brandId!: string;

  @IsOptional()
  @Type(() => String)
  @IsString()
  @IsIn(AI_DETECT_PLATFORMS)
  platform?: AiDetectPlatform;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @Transform(({ obj, key }) => {
    const val = obj[key];
    if (val === 'true') return true;
    if (val === 'false') return false;
    return val;
  })
  @IsBoolean()
  isMentioned?: boolean;

  @IsOptional()
  @IsUUID()
  taskId?: string;

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
}

// ---------- AI 检测结果统计（报表） ----------

export class AiDetectResultStatsQueryDto {
  @IsUUID()
  brandId!: string;

  @IsOptional()
  @Type(() => String)
  @IsString()
  @IsIn(AI_DETECT_PLATFORMS)
  platform?: AiDetectPlatform;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @Transform(({ obj, key }) => {
    const val = obj[key];
    if (val === 'true') return true;
    if (val === 'false') return false;
    return val;
  })
  @IsBoolean()
  isMentioned?: boolean;
}

// ---------- 旧版搜索引擎结果列表 ----------

export class LegacyResultListQueryDto {
  @IsUUID()
  brandId!: string;

  @IsOptional()
  @IsIn(PLATFORMS)
  platform?: string;

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
  @Max(200)
  pageSize?: number;
}
