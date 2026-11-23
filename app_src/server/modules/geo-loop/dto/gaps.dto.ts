import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class GapsQueryDto {
  @IsNotEmpty()
  @IsString()
  @Transform(({ obj, key }) => (obj[key] === '' ? undefined : obj[key]))
  brandId!: string;

  @IsOptional()
  @IsString()
  keyword?: string;
}

export class DispatchGapsDto {
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  gapIds!: string[];

  @IsNotEmpty()
  @IsString()
  brandId!: string;
}
