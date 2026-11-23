import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsIn,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { WEIGHT_TIERS, DISPATCH_PLAN_STATUSES } from '@shared/api.interface';

export class DispatchOverviewQueryDto {
  @IsNotEmpty()
  @IsString()
  @Transform(({ obj, key }) => (obj[key] === '' ? undefined : obj[key]))
  brandId!: string;
}

export class PlatformWeightsQueryDto {
  @IsNotEmpty()
  @IsString()
  @Transform(({ obj, key }) => (obj[key] === '' ? undefined : obj[key]))
  brandId!: string;

  @IsOptional()
  @IsString()
  @IsIn(WEIGHT_TIERS)
  tier?: 'A' | 'B' | 'C';
}

export class DispatchPlansQueryDto {
  @IsNotEmpty()
  @IsString()
  @Transform(({ obj, key }) => (obj[key] === '' ? undefined : obj[key]))
  brandId!: string;

  @IsNotEmpty()
  @IsString()
  startDate!: string;

  @IsNotEmpty()
  @IsString()
  endDate!: string;
}

export class SmartScheduleDto {
  @IsNotEmpty()
  @IsString()
  brandId!: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  totalArticles!: number;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  weeks!: number;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  perWeek!: number;

  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  tiers!: Array<'A' | 'B' | 'C'>;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  budgetLimit?: number;
}

export class ConvertToOrdersDto {
  @IsString()
  brandId!: string;

  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  planIds!: string[];
}
