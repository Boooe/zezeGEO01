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
  ValidateNested,
} from 'class-validator';

import { KNOWLEDGE_CATEGORIES } from '@shared/api.interface';

export class KnowledgeListQueryDto {
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
  @IsIn(KNOWLEDGE_CATEGORIES)
  category?: 'general' | 'product' | 'industry' | 'faq' | 'selling_point';

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @Transform(({ obj, key }) => {
    const val = obj[key];
    if (val === 'true') return true;
    if (val === 'false') return false;
    return val;
  })
  @IsBoolean()
  isActive?: boolean;
}

export class CreateKnowledgeDto {
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsIn(KNOWLEDGE_CATEGORIES)
  category!: 'general' | 'product' | 'industry' | 'faq' | 'selling_point';

  @IsString()
  title!: string;

  @IsString()
  content!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}

export class UpdateKnowledgeDto {
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsIn(KNOWLEDGE_CATEGORIES)
  category?: 'general' | 'product' | 'industry' | 'faq' | 'selling_point';

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}

export class BatchImportKnowledgeItemDto {
  @IsIn(KNOWLEDGE_CATEGORIES)
  category!: 'general' | 'product' | 'industry' | 'faq' | 'selling_point';

  @IsString()
  title!: string;

  @IsString()
  content!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class BatchImportKnowledgeDto {
  @IsUUID()
  brandId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BatchImportKnowledgeItemDto)
  items!: BatchImportKnowledgeItemDto[];
}

export class ActiveKnowledgeListQueryDto {
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsIn(KNOWLEDGE_CATEGORIES)
  category?: 'general' | 'product' | 'industry' | 'faq' | 'selling_point';
}
