import { Type } from 'class-transformer';
import {
  IsString,
  IsUUID,
  IsOptional,
  IsIn,
  IsNumber,
  Min,
  IsDate,
} from 'class-validator';

import { PACKAGE_TYPES, PAYMENT_STATUS } from '@shared/api.interface';

export class UpdateContractDto {
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  contactPerson?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsIn(PACKAGE_TYPES)
  packageType?: 'basic' | 'standard' | 'premium';

  @IsOptional()
  @IsNumber()
  @Min(0)
  contractAmount?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  signDate?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  serviceStart?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  serviceEnd?: Date;

  @IsOptional()
  @IsIn(PAYMENT_STATUS)
  paymentStatus?: 'unpaid' | 'partial' | 'paid';

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}
