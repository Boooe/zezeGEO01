import { Type, Transform } from 'class-transformer';
import {
  IsString,
  IsUUID,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsIn,
  IsBoolean,
  IsArray,
  IsNumber,
  Matches,
  MaxLength,
} from 'class-validator';

import {
  SUBMISSION_CHANNEL_TYPES,
  SUBMISSION_CHANNEL_STATUSES,
  SUBMISSION_CHANNEL_USAGE_TYPES,
  SUBMISSION_CHANNEL_GROUPS,
  SUBMISSION_AI_SOURCES,
  SUBMISSION_INDUSTRIES,
  SUBMISSION_CHANNEL_TIERS,
  DIAGNOSIS_PLATFORMS,
  INDEX_STATUSES,
  SUBMISSION_LIBRARY_TYPES,
  SUBMISSION_MEDIA_TYPES,
  BATCH_TAG_MODES,
  BATCH_TAG_SCOPES,
  BULK_PRICE_MODES,
} from '@shared/api.interface';
import { ValidateNested, ValidateIf } from 'class-validator';

export class SubmissionChannelQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsIn(SUBMISSION_CHANNEL_TYPES)
  type?: 'self_site' | 'public_submission' | 'authoritative_media' | 'industry_vertical';

  @IsOptional()
  @IsIn(SUBMISSION_CHANNEL_STATUSES)
  status?: 'active' | 'paused';

  @IsOptional()
  @IsIn(SUBMISSION_CHANNEL_USAGE_TYPES)
  usageType?: 'real_submission' | 'info_publish' | 'merchant' | 'lookup' | 'paid_media';

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @Transform(({ obj, key }) => {
    if (obj[key] === 'true') return true;
    if (obj[key] === 'false') return false;
    return obj[key];
  })
  @IsBoolean()
  sellable?: boolean;

  @IsOptional()
  @IsIn(SUBMISSION_CHANNEL_GROUPS)
  channelGroup?: 'common' | 'self_media_pack';

  @IsOptional()
  @IsIn(SUBMISSION_CHANNEL_TIERS)
  tier?: 'S' | 'A' | 'B' | 'C';

  @IsOptional()
  @IsIn(DIAGNOSIS_PLATFORMS)
  platformCoverage?: 'doubao' | 'deepseek' | 'wenxin' | 'tongyi' | 'yuanbao' | 'kimi';

  @IsOptional()
  @IsIn(SUBMISSION_LIBRARY_TYPES)
  libraryType?: 'private' | 'public' | 'authoritative' | 'b2b_alliance' | 'multimodal';

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsIn(SUBMISSION_AI_SOURCES)
  aiPlatform?: 'doubao' | 'deepseek' | 'wenxin' | 'tongyi' | 'yuanbao' | 'kimi';

  @IsOptional()
  @IsIn(SUBMISSION_MEDIA_TYPES)
  mediaType?: 'image_text' | 'video' | 'image_text_video';
}

export class CreateSubmissionChannelDto {
  @IsString()
  name!: string;

  @IsIn(SUBMISSION_CHANNEL_TYPES)
  channelType!: 'self_site' | 'public_submission' | 'authoritative_media' | 'industry_vertical';

  @IsOptional()
  @IsString()
  submitUrl?: string;

  @IsOptional()
  @IsBoolean()
  needAccount?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costPerArticle?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  dailyLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  reviewHours?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  industries?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredFields?: string[];

  @IsOptional()
  @IsArray()
  @IsIn(SUBMISSION_AI_SOURCES, { each: true })
  aiSources?: string[];

  @IsOptional()
  @IsString()
  accountName?: string;

  @IsOptional()
  @IsIn(SUBMISSION_CHANNEL_STATUSES)
  status?: 'active' | 'paused';

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsIn(SUBMISSION_CHANNEL_USAGE_TYPES)
  usageType?: 'real_submission' | 'info_publish' | 'merchant' | 'lookup' | 'paid_media';

  @IsOptional()
  @IsArray()
  @IsIn(DIAGNOSIS_PLATFORMS, { each: true })
  platformCoverage?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  indexRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  citeRate?: number;

  @IsOptional()
  @IsIn(SUBMISSION_CHANNEL_TIERS)
  tier?: 'S' | 'A' | 'B' | 'C';

  @IsOptional()
  @IsIn(INDEX_STATUSES)
  indexStatus?: 'pending' | 'indexed' | 'failed';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  citeSnapshots?: number;

  @IsOptional()
  @IsIn(SUBMISSION_LIBRARY_TYPES)
  libraryType?: 'private' | 'public' | 'authoritative' | 'b2b_alliance' | 'multimodal';

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsArray()
  @IsIn(SUBMISSION_AI_SOURCES, { each: true })
  aiPlatforms?: string[];

  @IsOptional()
  @IsIn(SUBMISSION_MEDIA_TYPES)
  mediaType?: 'image_text' | 'video' | 'image_text_video';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quotaTotal?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quotaUsed?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  followers?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  likes?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  imagePrice?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  videoPrice?: number | null;

  @IsOptional()
  @IsString()
  description?: string | null;
}

export class UpdateChannelPriceDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  salePriceCents!: number;
}

export class BulkChannelPriceDto {
  @IsIn(BULK_PRICE_MODES)
  mode!: 'markup_rate' | 'fixed_delta';

  @ValidateIf((o: BulkChannelPriceDto) => o.mode === 'markup_rate')
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  markupRate?: number;

  @ValidateIf((o: BulkChannelPriceDto) => o.mode === 'fixed_delta')
  @Type(() => Number)
  @IsInt()
  fixedDelta?: number;

  @IsOptional()
  @Transform(({ obj, key }) => (obj[key] === 'true' ? true : obj[key] === 'false' ? false : obj[key]))
  @IsBoolean()
  previewOnly?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => SubmissionChannelQueryDto)
  filter?: SubmissionChannelQueryDto;
}

export class UpdateSubmissionChannelDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(SUBMISSION_CHANNEL_TYPES)
  channelType?: 'self_site' | 'public_submission' | 'authoritative_media' | 'industry_vertical';

  @IsOptional()
  @IsString()
  submitUrl?: string;

  @IsOptional()
  @IsBoolean()
  needAccount?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costPerArticle?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  dailyLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  reviewHours?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  industries?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredFields?: string[];

  @IsOptional()
  @IsArray()
  @IsIn(SUBMISSION_AI_SOURCES, { each: true })
  aiSources?: string[];

  @IsOptional()
  @IsString()
  accountName?: string;

  @IsOptional()
  @IsIn(SUBMISSION_CHANNEL_STATUSES)
  status?: 'active' | 'paused';

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsIn(SUBMISSION_CHANNEL_USAGE_TYPES)
  usageType?: 'real_submission' | 'info_publish' | 'merchant' | 'lookup' | 'paid_media' | null;

  @IsOptional()
  @IsArray()
  @IsIn(DIAGNOSIS_PLATFORMS, { each: true })
  platformCoverage?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  indexRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  citeRate?: number;

  @IsOptional()
  @IsIn(SUBMISSION_CHANNEL_TIERS)
  tier?: 'S' | 'A' | 'B' | 'C';

  @IsOptional()
  @IsIn(INDEX_STATUSES)
  indexStatus?: 'pending' | 'indexed' | 'failed';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  citeSnapshots?: number;

  @IsOptional()
  @IsIn(SUBMISSION_LIBRARY_TYPES)
  libraryType?: 'private' | 'public' | 'authoritative' | 'b2b_alliance' | 'multimodal';

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsArray()
  @IsIn(SUBMISSION_AI_SOURCES, { each: true })
  aiPlatforms?: string[];

  @IsOptional()
  @IsIn(SUBMISSION_MEDIA_TYPES)
  mediaType?: 'image_text' | 'video' | 'image_text_video';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quotaTotal?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quotaUsed?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  followers?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  likes?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  imagePrice?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  videoPrice?: number | null;

  @IsOptional()
  @IsString()
  description?: string | null;
}

export class EliminationBatchDto {
  @IsArray()
  @IsUUID('4', { each: true })
  ids!: string[];

  @IsIn(['keep', 'mark_deprecated', 'archive'])
  action!: 'keep' | 'mark_deprecated' | 'archive';
}

export class UpdateSubmitUrlDto {
  @IsString()
  @Matches(/^https?:\/\//, { message: 'URL 必须以 http:// 或 https:// 开头' })
  @MaxLength(500)
  submitUrl!: string;
}

export class SeedSubmissionChannelsDto {
  @IsOptional()
  @IsUUID()
  brandId?: string;
}

export class BatchTagDto {
  @IsIn(BATCH_TAG_SCOPES)
  scope!: 'selection' | 'filter';

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  ids?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => SubmissionChannelQueryDto)
  filter?: SubmissionChannelQueryDto;

  @IsOptional()
  @IsArray()
  @IsIn(SUBMISSION_AI_SOURCES, { each: true })
  platforms?: string[];

  @IsOptional()
  @IsIn(SUBMISSION_MEDIA_TYPES)
  mediaType?: 'image_text' | 'video' | 'image_text_video';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  imagePrice?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  videoPrice?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quotaTotal?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  followers?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  likes?: number | null;

  @IsIn(BATCH_TAG_MODES)
  mode!: 'append' | 'replace';
}

export const BATCH_SHEET_TAG_STATUSES = ['all', 'tagged', 'untagged'] as const;

export class BatchSheetQueryDto {
  @IsOptional()
  @IsIn(SUBMISSION_LIBRARY_TYPES)
  libraryType?: 'private' | 'public' | 'authoritative' | 'b2b_alliance' | 'multimodal';

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsIn(BATCH_SHEET_TAG_STATUSES)
  tagStatus?: 'all' | 'tagged' | 'untagged';
}

export class AutoSelectDto {
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsIn(SUBMISSION_LIBRARY_TYPES)
  libraryType?: 'private' | 'public' | 'authoritative' | 'b2b_alliance' | 'multimodal';

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aiPlatforms?: string[];

  @IsOptional()
  @IsIn(SUBMISSION_MEDIA_TYPES)
  mediaType?: 'image_text' | 'video' | 'image_text_video';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budgetMax?: number;
}

export class BatchUrlPatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UrlPatchRowDto)
  rows!: UrlPatchRowDto[];

  @IsOptional()
  @IsString()
  brandId?: string;
}

export class UrlPatchRowDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  libraryType?: string;

  @IsString()
  url!: string;
}
