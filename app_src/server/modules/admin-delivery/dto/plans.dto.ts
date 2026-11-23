import { Type } from 'class-transformer';
import {
  IsString,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsBoolean,
  IsNumber,
  MaxLength,
} from 'class-validator';

export class PlanListQueryDto {
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

export class PlanUpsertDto {
  @IsString()
  @MaxLength(100)
  planName!: string;

  @IsString()
  @MaxLength(50)
  planCode!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  creditAmount!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  validityMonths!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  dailyPublishLimit!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}
