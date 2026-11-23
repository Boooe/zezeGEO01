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
  IsObject,
  ValidateNested,
} from 'class-validator';

import { SITE_STATUS } from '@shared/api.interface';

// ---------- 官网设置 ----------

export class WebsiteSettingsQueryDto {
  @IsOptional()
  @IsUUID()
  brandId?: string;
}

export class WebsiteContactInfoDto {
  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;
}

export class SaveWebsiteSettingsDto {
  @IsUUID()
  brandId!: string;

  @IsOptional()
  @IsString()
  domain?: string | null;

  @IsOptional()
  @IsString()
  siteName?: string | null;

  @IsOptional()
  @IsString()
  siteDescription?: string | null;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => WebsiteContactInfoDto)
  contactInfo?: WebsiteContactInfoDto | null;
}

// ---------- TDK 模板 ----------

export class TdkTemplateListQueryDto {
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsString()
  pageType?: string;
}

export class CreateTdkTemplateDto {
  @IsUUID()
  brandId!: string;

  @IsString()
  name!: string;

  @IsString()
  titleTemplate!: string;

  @IsString()
  descriptionTemplate!: string;

  @IsString()
  keywordsTemplate!: string;

  @IsOptional()
  @IsString()
  pageType?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isDefault?: boolean;
}

export class UpdateTdkTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  titleTemplate?: string;

  @IsOptional()
  @IsString()
  descriptionTemplate?: string;

  @IsOptional()
  @IsString()
  keywordsTemplate?: string;

  @IsOptional()
  @IsString()
  pageType?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isDefault?: boolean;
}

export class ApplyTdkTemplateDto {
  @IsString()
  brandName!: string;

  @IsArray()
  @IsString({ each: true })
  keywords!: string[];
}

// ---------- 站群 ----------

export class SiteListQueryDto {
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
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsString()
  brandType?: string;

  @IsOptional()
  @IsIn(SITE_STATUS)
  status?: 'active' | 'inactive' | 'building';

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsIn(['enterprise', 'b2b'])
  siteType?: 'enterprise' | 'b2b';
}

export class CreateSiteDto {
  @IsUUID()
  brandId!: string;

  @IsString()
  siteName!: string;

  @IsString()
  domain!: string;

  @IsOptional()
  @IsIn(SITE_STATUS)
  status?: 'active' | 'inactive' | 'building';

  @IsOptional()
  @IsString()
  cmsType?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsIn(['enterprise', 'b2b'])
  siteType?: 'enterprise' | 'b2b';
}

export class UpdateSiteDto {
  @IsOptional()
  @IsString()
  siteName?: string;

  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsIn(SITE_STATUS)
  status?: 'active' | 'inactive' | 'building';

  @IsOptional()
  @IsString()
  cmsType?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsIn(['enterprise', 'b2b'])
  siteType?: 'enterprise' | 'b2b';
}
