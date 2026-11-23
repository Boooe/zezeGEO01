import {
  IsIn,
  IsNotEmpty,
  IsString,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ACTION_STATUSES } from '@shared/api.interface';

export class ActionItemsQueryDto {
  @IsNotEmpty()
  @IsString()
  @Transform(({ obj, key }) => (obj[key] === '' ? undefined : obj[key]))
  brandId!: string;
}

export class AdoptActionItemsDto {
  @IsNotEmpty()
  @IsString()
  brandId!: string;
}

export class UpdateActionItemStatusDto {
  @IsNotEmpty()
  @IsString()
  @IsIn(ACTION_STATUSES)
  status!: 'pending' | 'in_progress' | 'done';
}
