import { Type, Transform } from 'class-transformer';
import {
  IsString,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsUUID,
  IsIn,
  IsNumber,
  IsArray,
} from 'class-validator';

import { PACKAGE_TYPES } from '@shared/api.interface';

export class CustomerListQueryDto {
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
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  accountStatus?: string;

  @IsOptional()
  @IsString()
  keyword?: string;
}

export class CreateCustomerDto {
  @IsString()
  companyName!: string;

  @IsString()
  brandName!: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsString()
  contactPerson!: string;

  @IsString()
  contactPhone!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  domain?: string;

  @IsString()
  @IsIn(PACKAGE_TYPES)
  packageType!: 'basic' | 'standard' | 'premium';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  initialCredit?: number;

  @IsOptional()
  @IsString()
  remark?: string;
}

export class CreateBrandUserDto {
  @IsUUID()
  brandId!: string;

  @IsString()
  username!: string;

  @IsString()
  password!: string;

  @IsIn(['client', 'operator'])
  role!: 'client' | 'operator';

  @IsOptional()
  @IsString()
  displayName?: string;
}

export class UpdateUserRoleDto {
  @IsIn(['admin', 'operator', 'client'])
  role!: 'admin' | 'operator' | 'client';
}

export class AdjustCreditDto {
  @IsUUID()
  brandId!: string;

  @Type(() => Number)
  @IsInt()
  amount!: number;

  @IsString()
  reason!: string;
}

export class ToggleUserStatusDto {
  @IsIn(['active', 'disabled'])
  status!: 'active' | 'disabled';
}

export class UpdateHitWordsDto {
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) =>
    (value ?? []).filter((w: string) => typeof w === 'string' && w.trim()),
  )
  hitWords!: string[];
}
