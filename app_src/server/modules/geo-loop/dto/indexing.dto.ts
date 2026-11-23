import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsIn,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  INTERNAL_LINK_STATUSES,
  EXTERNAL_LINK_STATUSES,
  EXTERNAL_LINK_TYPES,
  SEARCH_ENGINES,
} from '@shared/api.interface';

export class InternalLinksQueryDto {
  @IsNotEmpty()
  @IsString()
  @Transform(({ obj, key }) => (obj[key] === '' ? undefined : obj[key]))
  brandId!: string;
}

export class GenerateInternalLinksDto {
  @IsNotEmpty()
  @IsString()
  brandId!: string;
}

export class CreateInternalLinkDto {
  @IsNotEmpty()
  @IsString()
  brandId!: string;

  @IsOptional()
  @IsString()
  fromUrl?: string;

  @IsOptional()
  @IsString()
  toUrl?: string;

  @IsOptional()
  @IsString()
  anchorText?: string;

  @IsOptional()
  @IsString()
  @IsIn(INTERNAL_LINK_STATUSES)
  status?: 'planned' | 'added' | 'indexed';

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  fromTitle?: string;

  @IsOptional()
  @IsString()
  toTitle?: string;
}

export class UpdateInternalLinkStatusDto {
  @IsNotEmpty()
  @IsString()
  @IsIn(INTERNAL_LINK_STATUSES)
  status!: 'planned' | 'added' | 'indexed';
}

export class ExternalLinksQueryDto {
  @IsNotEmpty()
  @IsString()
  @Transform(({ obj, key }) => (obj[key] === '' ? undefined : obj[key]))
  brandId!: string;
}

export class ExternalLinkOverviewQueryDto {
  @IsNotEmpty()
  @IsString()
  @Transform(({ obj, key }) => (obj[key] === '' ? undefined : obj[key]))
  brandId!: string;
}

export class CreateExternalLinkDto {
  @IsNotEmpty()
  @IsString()
  brandId!: string;

  @IsNotEmpty()
  @IsString()
  resourceName!: string;

  @IsNotEmpty()
  @IsString()
  @IsIn(EXTERNAL_LINK_TYPES)
  resourceType!: 'news' | 'baike' | 'forum' | 'self_media';

  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsString()
  domainWeight?: 'A' | 'B' | 'C';

  @IsOptional()
  @IsString()
  linkUrl?: string;

  @IsOptional()
  @IsString()
  submittedAt?: string;

  @IsOptional()
  @IsString()
  @IsIn(EXTERNAL_LINK_STATUSES)
  status?: 'pending' | 'indexed' | 'rejected';

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateExternalLinkStatusDto {
  @IsNotEmpty()
  @IsString()
  @IsIn(EXTERNAL_LINK_STATUSES)
  status!: 'pending' | 'indexed' | 'rejected';
}

export class PageChecksQueryDto {
  @IsNotEmpty()
  @IsString()
  @Transform(({ obj, key }) => (obj[key] === '' ? undefined : obj[key]))
  brandId!: string;
}

export class CreatePageCheckDto {
  @IsNotEmpty()
  @IsString()
  brandId!: string;

  @IsNotEmpty()
  @IsString()
  pageUrl!: string;

  @IsBoolean()
  @Transform(({ obj, key }) => obj[key] === true || obj[key] === 'true')
  hasJsonld!: boolean;

  @IsBoolean()
  @Transform(({ obj, key }) => obj[key] === true || obj[key] === 'true')
  hasFaq!: boolean;

  @IsBoolean()
  @Transform(({ obj, key }) => obj[key] === true || obj[key] === 'true')
  hasAnswerBlock!: boolean;

  @IsBoolean()
  @Transform(({ obj, key }) => obj[key] === true || obj[key] === 'true')
  hLevelOk!: boolean;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  internalLinkCount!: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class IndexChecksQueryDto {
  @IsNotEmpty()
  @IsString()
  @Transform(({ obj, key }) => (obj[key] === '' ? undefined : obj[key]))
  brandId!: string;
}

export class CreateIndexCheckDto {
  @IsNotEmpty()
  @IsString()
  brandId!: string;

  @IsNotEmpty()
  @IsString()
  url!: string;

  @IsNotEmpty()
  @IsString()
  @IsIn(SEARCH_ENGINES)
  searchEngine!: 'baidu' | 'bing' | '360' | 'doubao';
}
