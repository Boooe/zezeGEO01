import {
  IsString,
  IsIn,
  IsOptional,
  IsInt,
  Min,
  MaxLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

import {
  AI_VENDORS,
  CREDIT_PACKAGES,
  CREDIT_REQUEST_STATUSES,
  type AiKeyUpsertRequest,
  type SetDefaultRequest,
  type CreditRequestCreateRequest,
} from '@shared/api.interface';

export class UpsertAiKeyDto implements AiKeyUpsertRequest {
  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;
}

export class SetDefaultDto implements SetDefaultRequest {
  @IsString()
  @IsIn(AI_VENDORS)
  vendor!: 'volcano' | 'deepseek' | 'qwen' | 'kimi' | 'zhipu' | 'minimax' | 'wenxin' | 'hunyuan' | 'spark' | 'openai' | 'gemini' | 'siliconflow';
}

export class CreateCreditRequestDto implements CreditRequestCreateRequest {
  @IsString()
  @IsIn(CREDIT_PACKAGES)
  packageType!: 'basic' | 'standard' | 'premium';

  @IsString()
  brandId!: string;
}

export class CreditRequestListQueryDto {
  @IsOptional()
  @Transform(({ obj, key }) => (obj[key] === '' ? undefined : obj[key]))
  @IsString()
  @IsIn(CREDIT_REQUEST_STATUSES)
  status?: 'pending' | 'approved' | 'rejected';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}

export class RejectCreditRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
