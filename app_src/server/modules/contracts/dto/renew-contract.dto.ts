import { IsNumber, Min, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class RenewContractDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  extendMonths!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;
}
