import {
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';

export class UpdateAccountProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contactName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactPhone?: string | null;
}

export class ChangePasswordDto {
  @IsString()
  oldPassword!: string;

  @IsString()
  @MinLength(6)
  newPassword!: string;
}
