import { Type } from 'class-transformer';
import { IsString, IsUUID, IsOptional, IsInt, Min } from 'class-validator';

export class CreateReportDto {
  @IsUUID()
  brandId!: string;

  @IsString()
  reportMonth!: string;

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
}
