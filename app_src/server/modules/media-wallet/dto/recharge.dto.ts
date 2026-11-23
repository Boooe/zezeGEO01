import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsIn,
  IsUUID,
  IsNumber,
  IsString,
  IsNotEmpty,
  IsDateString,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { RECHARGE_STATUS } from '@shared/api.interface';

export class ApplyRechargeDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: '最低充值 1 元' })
  amountYuan!: number;
}

export class RechargeListQueryDto {
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
  @IsIn(RECHARGE_STATUS)
  status?: 'pending' | 'approved' | 'rejected';

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
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @Transform(({ obj, key, value }) =>
    obj[key] === '' ? undefined : value,
  )
  @IsDateString()
  endDate?: string;
}

export class ApproveRechargeDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  actualAmountYuan?: number;
}

export class RejectRechargeDto {
  @IsString()
  @IsNotEmpty({ message: '驳回原因不能为空' })
  rejectReason!: string;
}
