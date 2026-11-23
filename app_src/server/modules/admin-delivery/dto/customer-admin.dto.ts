import { Type } from 'class-transformer';
import {
  IsString,
  IsInt,
  Min,
  IsOptional,
  IsUUID,
  IsNumber,
} from 'class-validator';

export class CreateCustomerFullDto {
  @IsString()
  companyName!: string;

  @IsString()
  brandName!: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  contactPerson?: string;

  @IsString()
  contactPhone!: string;

  @IsUUID()
  planId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  initialCredit!: number;

  @IsString()
  serviceEnd!: string;

  @IsString()
  username!: string;

  @IsString()
  password!: string;
}

export class UpdatePlanDto {
  @IsUUID()
  planId!: string;

  @IsString()
  serviceEnd!: string;
}

export class RenewDto {
  @IsOptional()
  @IsUUID()
  planId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  customAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  customCredit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  customMonths?: number;

  @IsOptional()
  @IsString()
  remark?: string;
}
