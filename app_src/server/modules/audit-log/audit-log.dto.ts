import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { OperationLogListRequest } from '@shared/api.interface';

export class OperationLogListQueryDto implements OperationLogListRequest {
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
  @Transform(({ obj, key, value }) => (obj[key] === '' ? undefined : value))
  @IsString()
  keyword?: string;

  @IsOptional()
  @Transform(({ obj, key, value }) => (obj[key] === '' ? undefined : value))
  @IsString()
  action?: string;

  @IsOptional()
  @Transform(({ obj, key, value }) => (obj[key] === '' ? undefined : value))
  @IsString()
  role?: string;

  @IsOptional()
  @Transform(({ obj, key, value }) => (obj[key] === '' ? undefined : value))
  @IsString()
  startDate?: string;

  @IsOptional()
  @Transform(({ obj, key, value }) => (obj[key] === '' ? undefined : value))
  @IsString()
  endDate?: string;
}
