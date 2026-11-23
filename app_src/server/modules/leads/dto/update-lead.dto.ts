import {
  IsString,
  IsOptional,
  IsIn,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LEAD_STAGES, INTENT_LEVELS } from '@shared/api.interface';

export class UpdateLeadDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  merchantName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  industry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  source?: string;

  @IsOptional()
  @IsString()
  @IsIn(INTENT_LEVELS)
  intentLevel?: 'high' | 'medium' | 'low';

  @IsOptional()
  @IsString()
  @IsIn(LEAD_STAGES)
  stage?: 'pending' | 'contacted' | 'quoted' | 'signed' | 'shelved';

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @Type(() => String)
  @IsString()
  nextFollowupDate?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}
