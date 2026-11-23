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
  IsDateString,
  IsNumber,
  IsNotEmpty,
  Length,
} from 'class-validator';

import {
  ARTICLE_TYPES,
  ARTICLE_STATUS,
  IMAGE_STYLES,
  IMAGE_PURPOSES,
  VIDEO_TASK_STATUSES,
  VIDEO_DURATIONS,
  VIDEO_RATIOS,
  PUBLICATION_CONTENT_TYPES,
  PUBLICATION_PLATFORMS,
  PUBLICATION_STATUSES,
  CREATION_TASK_TYPES,
  CREATION_TASK_STATUSES,
  CREATION_IMG_MODES,
  CREATION_RATIOS,
  CREATION_VIDEO_DURATIONS,
  CREATION_RESOLUTIONS,
  SUBTITLE_STYLES,
  MATERIAL_STATUS,
  VIDEO_PURPOSES,
  VIDEO_STYLES,
  KEYWORD_TYPES,
} from '@shared/api.interface';

// ---------- 概览统计 ----------

export class OverviewQueryDto {
  @IsOptional()
  @IsUUID()
  brandId?: string;
}

// ---------- 最近生成 ----------

export class RecentQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsUUID()
  brandId?: string;
}

// ---------- 文章 ----------

export class CreationGenerateArticleDto {
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
  @Max(10)
  count!: number;

  @IsOptional()
  @Transform(({ obj, key }) => {
    const val = obj[key];
    if (val === 'true') return true;
    if (val === 'false') return false;
    return val;
  })
  @IsBoolean()
  autoCover?: boolean;

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
  @IsArray()
  @IsString({ each: true })
  knowledgeCategories?: string[];
}

export class CreationArticleListQueryDto {
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
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class CreationUpdateArticleDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsIn(ARTICLE_STATUS)
  status?: 'draft' | 'generating' | 'published' | 'failed';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  coverImages?: string[];
}

// ---------- 图片 ----------

export class CreationGenerateImageDto {
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
  @Max(4)
  count!: number;
}

export class CreationImageListQueryDto {
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
  @IsIn(IMAGE_STYLES)
  style?: 'realistic' | 'illustration' | 'minimal_ecommerce' | 'guochao' | 'tech' | 'fresh_natural';

  @IsOptional()
  @IsIn(IMAGE_PURPOSES)
  imagePurpose?: 'article_illustration' | 'cover' | 'product' | 'store_poster';

  @IsOptional()
  @IsIn(MATERIAL_STATUS)
  status?: 'success' | 'failed' | 'generating';

  @IsOptional()
  @IsString()
  keyword?: string;
}

export class CreationImageBatchDeleteDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  ids!: string[];
}

export class CreationImagePublicationDto {
  @IsIn(PUBLICATION_PLATFORMS)
  platform!: string;

  @IsOptional()
  @IsString()
  mediaLibrary?: string;
}

// ---------- 视频 ----------

export class CreationGenerateVideoDto {
  @IsUUID()
  brandId!: string;

  @IsString()
  taskName!: string;

  @IsOptional()
  @IsIn(VIDEO_PURPOSES)
  purpose?: 'store_intro' | 'product_show' | 'knowledge';

  @IsString()
  script!: string;

  @IsOptional()
  @IsString()
  scriptText?: string;

  @IsIn(VIDEO_DURATIONS)
  duration!: '15s' | '30s' | '60s';

  @IsIn(VIDEO_RATIOS)
  ratio!: '9:16' | '16:9' | '1:1';

  @IsOptional()
  @IsIn(VIDEO_STYLES)
  style?: 'realistic' | 'cartoon' | 'tech' | 'fresh' | 'guochao';

  @IsOptional()
  @IsString()
  coverImage?: string;
}

export class CreationVideoListQueryDto {
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
  purpose?: 'store_intro' | 'product_show' | 'knowledge';

  @IsOptional()
  @IsString()
  keyword?: string;
}

export class CreationVideoPublicationDto {
  @IsIn(PUBLICATION_PLATFORMS)
  platform!: string;

  @IsOptional()
  @IsString()
  mediaLibrary?: string;
}

export class CreationUpdateVideoDto {
  @IsOptional()
  @IsString()
  taskName?: string;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsString()
  videoCoverUrl?: string;

  @IsOptional()
  @IsIn(VIDEO_TASK_STATUSES)
  status?: 'pending' | 'generating' | 'completed' | 'failed';

  @IsOptional()
  @IsString()
  scriptContent?: string;

  @IsOptional()
  @IsString()
  storyboard?: string;
}

// ---------- 任务队列 ----------

export class CreationTaskListQueryDto {
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
  @IsIn(CREATION_TASK_TYPES)
  taskType?: 'article' | 'image' | 'video';

  @IsOptional()
  @IsIn(CREATION_TASK_STATUSES)
  status?: 'pending' | 'generating' | 'completed' | 'failed';

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

// ---------- 发布记录 ----------

export class CreatePublicationDto {
  @IsIn(PUBLICATION_CONTENT_TYPES)
  contentType!: 'article' | 'image' | 'video';

  @IsUUID()
  contentId!: string;

  @IsUUID()
  brandId!: string;

  @IsString()
  mediaLibrary!: string;

  @IsIn(PUBLICATION_PLATFORMS)
  platform!: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  publishUrl?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}

export class PublicationListQueryDto {
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
  @IsIn(PUBLICATION_CONTENT_TYPES)
  contentType?: 'article' | 'image' | 'video';

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsIn(PUBLICATION_STATUSES)
  status?: 'pending' | 'published' | 'failed';

  @IsOptional()
  @IsIn(PUBLICATION_PLATFORMS)
  platform?: string;
}

export class UpdatePublicationDto {
  @IsOptional()
  @IsIn(PUBLICATION_STATUSES)
  status?: 'pending' | 'published' | 'failed';

  @IsOptional()
  @IsString()
  publishUrl?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}

// ============================================================
//  算力套餐管理
// ============================================================

export class CreateCreditPlanDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  planName!: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  planCode!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  creditAmount!: number;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ obj, key }) => {
    const val = obj[key];
    if (val === 'true') return true;
    if (val === 'false') return false;
    return val;
  })
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class UpdateCreditPlanDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  planName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  planCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  creditAmount?: number;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ obj, key }) => {
    const val = obj[key];
    if (val === 'true') return true;
    if (val === 'false') return false;
    return val;
  })
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

// ============================================================
//  算力充值 / 套餐激活
// ============================================================

export class RechargeCreditDto {
  @IsUUID()
  brandId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  amount!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  paymentAmount?: number;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  remark?: string;

  @IsOptional()
  @IsUUID()
  planId?: string;
}

export class ActivatePlanDto {
  @IsUUID()
  brandId!: string;

  @IsUUID()
  planId!: string;
}

// ============================================================
//  算力账户 / 流水 查询
// ============================================================

export class CreditAccountListQueryDto {
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
  @IsString()
  keyword?: string;
}

export class CreditTransactionQueryDto {
  @IsOptional()
  @IsUUID()
  brandId?: string;

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
  @IsString()
  transactionType?: string;
}

export class UsageBreakdownQueryDto {
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsString()
  month?: string;
}

// ============================================================
//  统一创作（图文/视频）新接口 DTO
// ============================================================

// ---------- 关键词分组 ----------

export class UnifiedKeywordGroupsQueryDto {
  @IsOptional()
  @IsUUID()
  brandId?: string;
}

// ---------- 关键词列表 ----------

export class UnifiedKeywordsQueryDto {
  @IsUUID()
  groupId!: string;

  @IsIn(KEYWORD_TYPES)
  type!: 'core' | 'longtail';

  @IsOptional()
  @IsString()
  search?: string;
}

// ---------- AI 生成文案 ----------

export class UnifiedGenerateCopyDto {
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

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsIn(['image', 'video'])
  taskType!: 'image' | 'video';
}

// ---------- 拆分图片提示词 ----------

export class UnifiedSplitImagePromptsDto {
  @IsString()
  @IsNotEmpty()
  content!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  imageCount!: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsString()
  @IsNotEmpty()
  title!: string;
}

// ---------- 提交图文任务 ----------

export class UnifiedCreateImageTaskDto {
  @IsUUID()
  brandId!: string;

  @IsUUID()
  groupId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  keywords!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  longtailKeywords!: string[];

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsIn(CREATION_IMG_MODES)
  imageMode!: 'ai_generate' | 'material' | 'upload';

  @IsOptional()
  @IsString()
  imagePrompt?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9)
  imageCount!: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  referenceImages?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  materialImageIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  uploadedImageUrls?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  perImagePrompts?: string[];

  @IsIn(CREATION_RATIOS)
  ratio!: string;
}

// ---------- 提交视频任务 ----------

export class UnifiedCreateVideoTaskDto {
  @IsUUID()
  brandId!: string;

  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  longtailKeywords?: string[];

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsString()
  @IsNotEmpty()
  @Length(1, 300)
  videoPrompt!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  videoReferenceImages?: string[];

  @IsOptional()
  @IsUUID()
  videoMaterialId?: string;

  @IsIn(CREATION_VIDEO_DURATIONS)
  duration!: '10s' | '15s';

  @IsIn(CREATION_RATIOS)
  ratio!: string;

  @IsIn(CREATION_RESOLUTIONS)
  resolution!: 'hd' | 'full_hd' | '4k';

  @Transform(({ obj, key }) => {
    const val = obj[key];
    if (val === 'true') return true;
    if (val === 'false') return false;
    return val;
  })
  @IsBoolean()
  subtitleEnabled!: boolean;

  @IsOptional()
  @IsIn(SUBTITLE_STYLES)
  subtitleStyle?: 'default' | 'karaoke' | 'bounce' | 'neon';

  @IsOptional()
  @IsString()
  bgmUrl?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  bgmVolume!: number;

  @IsOptional()
  @IsString()
  voiceId?: string;

  @IsOptional()
  @IsString()
  voiceName?: string;

  @Transform(({ obj, key }) => {
    const val = obj[key];
    if (val === 'true') return true;
    if (val === 'false') return false;
    return val;
  })
  @IsBoolean()
  originalAudioEnabled!: boolean;
}

// ---------- 统一任务列表 ----------

export class UnifiedTaskListQueryDto {
  @IsOptional()
  @IsIn(CREATION_TASK_TYPES)
  taskType?: 'article' | 'image' | 'video';

  @IsOptional()
  @IsIn(CREATION_TASK_STATUSES)
  status?: 'pending' | 'generating' | 'completed' | 'failed';

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;
}
