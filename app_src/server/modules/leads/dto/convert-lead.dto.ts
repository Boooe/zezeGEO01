import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ConvertLeadDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  industry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactPerson?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  contactPhone?: string;
}
