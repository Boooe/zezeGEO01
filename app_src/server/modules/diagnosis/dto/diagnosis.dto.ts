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
  ArrayMaxSize,
  IsObject,
  ValidateNested,
  MaxLength,
} from 'class-validator';

import { DIAGNOSIS_STATUS, DIAGNOSIS_PLATFORMS } from '@shared/api.interface';
import type { DiagnosisPlatform } from '@shared/api.interface';

// ---------- 诊断任务 ----------

export class CreateDiagnosisTaskDto {
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsString()
  brandName!: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsString()
  city!: string;

  @IsString()
  category!: string;

  @IsArray()
  @IsString({ each: true })
  @IsIn(DIAGNOSIS_PLATFORMS, { each: true })
  @ArrayMinSize(1)
  @Type(() => String)
  platforms!: DiagnosisPlatform[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(3)
  @Type(() => String)
  competitors?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  @Type(() => String)
  brandAliases?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  brandIntro?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsObject({ each: true })
  @Type(() => Object)
  products?: Array<{ name: string }>;
}

export class GenerateQuestionScenariosDto {
  @IsString()
  productName!: string;

  @IsString()
  brandName!: string;

  @IsString()
  city!: string;

  @IsString()
  category!: string;

  @IsOptional()
  @IsString()
  brandId?: string;
}

export class GenerateQuestionsDto {
  @IsString()
  brandName!: string;

  @IsString()
  city!: string;

  @IsString()
  category!: string;

  @IsOptional()
  @IsString()
  brandId?: string;
}

export class RunDiagnosisDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(3)
  @Type(() => String)
  questions!: string[];
}

export class DiagnosisTaskListQueryDto {
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
  @IsIn(DIAGNOSIS_STATUS)
  status?: 'pending' | 'running' | 'completed' | 'failed';

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;
}

// ---------- 诊断报告 ----------

export class DiagnosisReportListQueryDto {
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
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minScore?: number;
}

// ---------- 竞品对比 ----------

export class CompetitorCompareRequestDto {
  @IsUUID()
  brandReportId!: string;

  @IsArray()
  @IsUUID(undefined, { each: true })
  @ArrayMinSize(1)
  @Type(() => String)
  competitorReportIds!: string[];
}

// ---------- 分享 ----------

export interface ShareReportResponse {
  shareToken: string;
  shareUrl: string;
}
