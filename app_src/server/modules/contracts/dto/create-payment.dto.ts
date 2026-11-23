import { Type } from 'class-transformer';
import { IsString, IsOptional, IsNumber, Min, IsDate } from 'class-validator';

export class CreatePaymentDto {
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  paymentDate?: Date;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}
