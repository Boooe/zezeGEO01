import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class PillarsGroupedQueryDto {
  @IsNotEmpty()
  @IsString()
  @Transform(({ obj, key }) => (obj[key] === '' ? undefined : obj[key]))
  brandId!: string;
}

export class PillarCreateDto {
  @IsNotEmpty()
  @IsString()
  brandId!: string;

  @IsNotEmpty()
  @IsString()
  pillarTopic!: string;

  @IsNotEmpty()
  @IsString()
  subTopic!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  coverKeywords?: string[];

  @IsOptional()
  @IsString()
  targetQuestion?: string;

  @IsOptional()
  @IsString()
  contentType?: string;
}

export class DispatchPillarsDto {
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  pillarIds!: string[];

  @IsNotEmpty()
  @IsString()
  brandId!: string;
}
