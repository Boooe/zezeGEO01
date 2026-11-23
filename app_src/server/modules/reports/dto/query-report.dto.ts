import { Type } from 'class-transformer';
import {
  IsString,
  IsUUID,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';

export class QueryReportDto {
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsString()
  reportMonth?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isSent?: boolean;

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
}
