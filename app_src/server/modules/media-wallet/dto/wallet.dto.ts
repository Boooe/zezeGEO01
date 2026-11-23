import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsIn,
  IsUUID,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { WALLET_TX_TYPES } from '@shared/api.interface';

export class WalletQueryDto {
  @IsOptional()
  @Transform(({ obj, key, value }) =>
    obj[key] === '' ? undefined : value,
  )
  @IsUUID()
  brandId?: string;
}

export class WalletTxQueryDto {
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
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @Transform(({ obj, key, value }) =>
    obj[key] === '' ? undefined : value,
  )
  @IsIn(WALLET_TX_TYPES)
  type?: 'recharge' | 'consume' | 'refund' | 'gift' | 'adjust';
}
