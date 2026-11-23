import {
  IsString,
  IsIn,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsArray,
  ArrayMinSize,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

import { MEDIA_ORDER_STATUS } from '@shared/api.interface';

export class OrderListAdminQueryDto {
  @IsOptional()
  @IsIn(MEDIA_ORDER_STATUS)
  status?: string;

  @IsOptional()
  @IsString()
  brandId?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  keyword?: string;

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
}

export class OrderListClientQueryDto {
  @IsOptional()
  @IsIn(MEDIA_ORDER_STATUS)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  keyword?: string;

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
}

export class CreateOrderDto {
  @IsString()
  channelId!: string;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsString()
  @MaxLength(10000)
  content!: string;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  imageUrls?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @IsOptional()
  @IsString()
  articleId?: string;

  @IsOptional()
  @IsString()
  source?: 'manual' | 'auto_task' | 'batch_publish';

  @IsOptional()
  @IsString()
  taskId?: string;
}

export class BatchCreateOrdersDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  articleIds!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  channelIds!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

export class SubmitSupplierDto {
  @IsString()
  @MaxLength(200)
  supplierOrderNo!: string;
}

export class PublishOrderDto {
  @IsString()
  @MaxLength(1000)
  publishedUrl!: string;
}

export class RejectRefundDto {
  @IsString()
  @MaxLength(500)
  rejectReason!: string;
}
