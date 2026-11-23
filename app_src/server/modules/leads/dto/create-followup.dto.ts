import { IsString, IsOptional, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFollowupDto {
  @IsString()
  content!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  followupType?: string;

  @IsOptional()
  @Type(() => String)
  @IsString()
  nextFollowupDate?: string;
}
