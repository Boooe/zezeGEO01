import {
  IsString,
  IsOptional,
  IsIn,
  IsInt,
  Min,
  Max,
  MaxLength,
  IsNumber,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { SUPPLIER_STATUS } from '@shared/api.interface';

export class SupplierQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @IsOptional()
  @Transform(({ obj, key, value }) =>
    obj[key] === '' ? undefined : value,
  )
  @IsString()
  keyword?: string;

  @IsOptional()
  @Transform(({ obj, key, value }) =>
    obj[key] === '' ? undefined : value,
  )
  @IsString()
  @IsIn(SUPPLIER_STATUS)
  status?: 'active' | 'inactive';
}

export class CreateSupplierDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contact?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  settlementCycle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiBase?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @IsIn(SUPPLIER_STATUS)
  status?: 'active' | 'inactive';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  markupRate?: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contact?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  settlementCycle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiBase?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @IsIn(SUPPLIER_STATUS)
  status?: 'active' | 'inactive';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  markupRate?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
