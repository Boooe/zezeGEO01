import { IsString, IsOptional, IsArray, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class ImportPriceDto {
  @IsOptional()
  @IsString()
  csvText?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  allowCreate?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportRowItem)
  rows?: ImportRowItem[];
}

export class ImportRowItem {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  libraryType?: string;

  @IsOptional()
  @IsString()
  supplier?: string;

  @IsOptional()
  @IsString()
  costPrice?: string;

  @IsOptional()
  @IsString()
  salePrice?: string;

  @IsOptional()
  @IsString()
  turnaroundHours?: string;

  @IsOptional()
  @IsString()
  stock?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  followers?: string;
}
