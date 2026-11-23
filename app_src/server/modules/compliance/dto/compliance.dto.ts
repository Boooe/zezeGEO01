import {
  IsString,
  IsUUID,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class ComplianceCheckDto {
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsUUID()
  articleId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @IsString()
  content!: string;
}
