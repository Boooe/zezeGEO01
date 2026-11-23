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

export class CreateContractDto {
  @IsUUID()
  brandId!: string;

  @IsString()
  customerName!: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  contactPerson?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsIn(PACKAGE_TYPES)
  packageType!: 'basic' | 'standard' | 'premium';

  @IsNumber()
  @Min(0)
  contractAmount!: number;

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
