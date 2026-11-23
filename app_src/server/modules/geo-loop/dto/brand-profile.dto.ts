import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ArrayMinSize,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class BrandProfileQueryDto {
  @IsNotEmpty()
  @IsString()
  @Transform(({ obj, key }) => (obj[key] === '' ? undefined : obj[key]))
  brandId!: string;
}

export class BrandProfileUpsertDto {
  @IsNotEmpty()
  @IsString()
  brandId!: string;

  @IsOptional()
  @IsString()
  positioningTagline?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  targetAudience?: string;

  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  sellingPoints!: string[];

  @IsOptional()
  @IsString()
  forbiddenPhrases?: string;

  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  topQuestions!: string[];
}
