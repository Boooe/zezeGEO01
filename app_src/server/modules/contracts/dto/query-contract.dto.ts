import { Type } from 'class-transformer';
import {
  IsString,
  IsUUID,
  IsOptional,
  IsIn,
  IsInt,
  Min,
  Max,
} from 'class-validator';

import { PACKAGE_TYPES, PAYMENT_STATUS } from '@shared/api.interface';

export class QueryContractDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsIn(PACKAGE_TYPES)
  packageType?: 'basic' | 'standard' | 'premium';

  @IsOptional()
  @IsIn(PAYMENT_STATUS)
  paymentStatus?: 'unpaid' | 'partial' | 'paid';

  @IsOptional()
  @IsUUID()
  brandId?: string;

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
