import { Type } from 'class-transformer';
import { IsString, IsOptional, IsInt, Min, IsBoolean, IsDate } from 'class-validator';

export class UpdateReportDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  includedCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  prevIncludedCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  improvementCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  contentOutput?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isSent?: boolean;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  sentAt?: Date;
}
