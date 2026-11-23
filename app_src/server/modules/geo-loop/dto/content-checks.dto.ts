import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class ContentChecksQueryDto {
  @IsNotEmpty()
  @IsString()
  @Transform(({ obj, key }) => (obj[key] === '' ? undefined : obj[key]))
  brandId!: string;
}

export class RunContentChecksDto {
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  articleIds!: string[];

  @IsNotEmpty()
  @IsString()
  brandId!: string;
}
