import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsNotEmpty,
} from 'class-validator';

export class SignCommitmentDto {}

export class ListSignaturesQueryDto {
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
  keyword?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  versionCode?: string;
}

export class CreateVersionDto {
  @IsNotEmpty()
  @IsString()
  content!: string;
}

export class UpdateVersionDto {
  @IsNotEmpty()
  @IsString()
  content!: string;
}

export class RequireResignDto {
  @IsNotEmpty()
  @IsString()
  userId!: string;
}

export class RemindSignDto {
  @IsNotEmpty()
  @IsString()
  userId!: string;
}
