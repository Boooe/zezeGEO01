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
  ARTICLE_TYPES,
  ARTICLE_STATUS,
  BATCH_STATUS,
  MATERIAL_TYPES,
  IMAGE_STYLES,
  IMAGE_PURPOSES,
  CREDIT_TX_TYPES,
  VIDEO_TASK_STATUSES,
  VIDEO_DURATIONS,
  VIDEO_RATIOS,
  VIDEO_PURPOSES,
  VIDEO_STYLES,
} from '@shared/api.interface';

// ---------- 文章 ----------

export class GenerateArticleDto {
  @IsUUID()
  brandId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  keywords!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  longtailKeywords?: string[];

  @IsIn(ARTICLE_TYPES)
  articleType!: 'recommendation' | 'review' | 'story' | 'science' | 'qa';

  @Type(() => Number)
  @IsInt()
  @Min(300)
  @Max(5000)
  targetWordCount!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  count!: number;

  @IsOptional()
  @Transform(({ obj, key }) => {
    const val = obj[key];
    if (val === 'true') return true;
    if (val === 'false') return false;
    return val;
  })
  @IsBoolean()
  useKnowledgeBase?: boolean;

  @IsOptional()
  @Transform(({ obj, key }) => {
    const val = obj[key];
    if (val === 'true') return true;
    if (val === 'false') return false;
    return val;
  })
  @IsBoolean()
  autoCover?: boolean;
}

export class ArticleListQueryDto {
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
  @IsIn(ARTICLE_TYPES)
  articleType?: 'recommendation' | 'review' | 'story' | 'science' | 'qa';

  @IsOptional()
  @IsIn(ARTICLE_STATUS)
  status?: 'draft' | 'generating' | 'published' | 'failed';

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsUUID()
  batchId?: string;

  @IsOptional()
  @Type(() => Date)
  startDate?: Date;

  @IsOptional()
  @Type(() => Date)
  endDate?: Date;
}

export class UpdateArticleDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsIn(ARTICLE_STATUS)
  status?: 'draft' | 'generating' | 'published' | 'failed';
}

// ---------- 批次 ----------

export class CreateBatchDto {
  @IsUUID()
  brandId!: string;

  @IsString()
  batchName!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  keywords!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  longtailKeywords?: string[];

  @IsIn(ARTICLE_TYPES)
  articleType!: 'recommendation' | 'review' | 'story' | 'science' | 'qa';

  @Type(() => Number)
  @IsInt()
  @Min(300)
  @Max(5000)
  targetWordCount!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  totalCount!: number;
}

export class BatchListQueryDto {
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
  @IsIn(BATCH_STATUS)
  status?: 'pending' | 'generating' | 'completed' | 'partial_failed' | 'failed';
}

// ---------- 算力 ----------

export class CreditTransactionQueryDto {
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
  @IsIn(CREDIT_TX_TYPES)
  transactionType?: 'recharge' | 'article_generate' | 'image_generate' | 'video_script' | 'adjustment';
}

// ---------- 图片生成 ----------

export class GenerateImageDto {
  @IsUUID()
  brandId!: string;

  @IsIn(IMAGE_PURPOSES)
  imagePurpose!: 'article_illustration' | 'cover' | 'product' | 'store_poster';

  @IsString()
  prompt!: string;

  @IsIn(IMAGE_STYLES)
  style!: 'realistic' | 'illustration' | 'minimal_ecommerce' | 'guochao' | 'tech' | 'fresh_natural';

  @IsOptional()
  @IsString()
  ratio?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9)
  count!: number;

  @IsOptional()
  @Transform(({ obj, key }) => {
    const val = obj[key];
    if (val === 'true') return true;
    if (val === 'false') return false;
    return val;
  })
  @IsBoolean()
  saveToLibrary?: boolean;
}

// ---------- 素材 ----------

export class MaterialListQueryDto {
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
  @IsIn(MATERIAL_TYPES)
  materialType?: 'image' | 'video' | 'document';

  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsOptional()
  @IsString()
  keyword?: string;
}

export class CreateMaterialGroupDto {
  @IsUUID()
  brandId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsIn(MATERIAL_TYPES)
  groupType?: 'image' | 'video' | 'document';
}

export class UpdateMaterialDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  groupId?: string;
}

export class BatchDeleteMaterialsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  ids!: string[];
}

export class RecordMaterialDto {
  @IsUUID()
  brandId!: string;

  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsIn(MATERIAL_TYPES)
  materialType!: 'image' | 'video' | 'document';

  @IsString()
  name!: string;

  @IsString()
  filePath!: string;

  @IsString()
  bucketId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  fileSize!: number;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  width?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  height?: number;

  @IsOptional()
  @IsString()
  source?: string;
}

export class MaterialGroupListQueryDto {
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsIn(MATERIAL_TYPES)
  materialType?: 'image' | 'video' | 'document';
}

// ---------- 视频脚本 ----------

export class GenerateVideoScriptDto {
  @IsUUID()
  brandId!: string;

  @IsString()
  coreKeyword!: string;

  @IsOptional()
  @IsString()
  purpose?: string;
}

// ---------- 视频任务 ----------

export class CreateVideoTaskDto {
  @IsUUID()
  brandId!: string;

  @IsString()
  taskName!: string;

  @IsString()
  topic!: string;

  @IsIn(VIDEO_DURATIONS)
  duration!: '15s' | '30s' | '60s';

  @IsIn(VIDEO_RATIOS)
  ratio!: '9:16' | '16:9' | '1:1';

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsOptional()
  @IsIn(VIDEO_PURPOSES)
  purpose?: string;

  @IsOptional()
  @IsIn(VIDEO_STYLES)
  style?: string;

  @IsOptional()
  @IsString()
  scriptText?: string;
}

export class VideoTaskListQueryDto {
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
  @IsIn(VIDEO_TASK_STATUSES)
  status?: 'pending' | 'generating' | 'completed' | 'failed';

  @IsOptional()
  @IsIn(VIDEO_PURPOSES)
  purpose?: string;

  @IsOptional()
  @IsIn(VIDEO_STYLES)
  style?: string;
}

export class VideoServiceConfigDto {
  @IsString()
  apiUrl!: string;

  @IsString()
  apiKey!: string;

  @IsString()
  model!: string;

  @IsOptional()
  @IsString()
  callbackUrl?: string;
}

export class ImageServiceConfigDto {
  @IsString()
  apiUrl!: string;

  @IsString()
  apiKey!: string;

  @IsString()
  model!: string;
}
