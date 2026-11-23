import { Type, Expose } from 'class-transformer';
import {
  IsInt,
  Min,
  Max,
  IsOptional,
  IsArray,
  IsString,
  IsBoolean,
  IsNumber,
  IsIn,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';

export class PullTasksQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class TaskResultDto {
  @Expose({ name: 'task_id' })
  @IsString()
  taskId!: string;

  @IsBoolean()
  hit!: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  position?: number;

  @IsOptional()
  @IsString()
  snippet?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  error?: string;
}

// ---------- 视频任务 ----------

export class VideoPullTaskDto {
  @IsString()
  id!: string;

  @IsString()
  brandId!: string;

  @IsString()
  purpose!: string;

  @IsString()
  topic!: string;

  @IsOptional()
  @IsString()
  scriptText?: string;

  @IsString()
  duration!: string;

  @IsString()
  ratio!: string;

  @IsOptional()
  @IsString()
  style?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;
}

export const VIDEO_TASK_RESULT_STATUSES = ['completed', 'failed'] as const;

export class VideoTaskResultDto {
  @Expose({ name: 'task_id' })
  @IsString()
  taskId!: string;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsString()
  coverUrl?: string;

  @IsIn(VIDEO_TASK_RESULT_STATUSES)
  status!: 'completed' | 'failed';

  @IsOptional()
  @IsString()
  error?: string;
}

