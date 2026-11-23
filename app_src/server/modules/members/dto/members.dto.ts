import { Type, Transform } from 'class-transformer';
import {
  IsString,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsIn,
  Matches,
} from 'class-validator';

import { MEMBER_STATUSES } from '@shared/api.interface';

export class MemberListQueryDto {
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
  role?: string;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateMemberDto {
  @IsString()
  name!: string;

  @IsString()
  username!: string;

  @IsString()
  @Matches(/^[a-z0-9_]+$/, {
    message: '角色编码只能包含小写字母、数字和下划线',
  })
  role!: string;
}

export class UpdateMemberStatusDto {
  @IsString()
  @IsIn(MEMBER_STATUSES)
  status!: 'active' | 'disabled';
}

export class UpdateMemberRoleDto {
  @IsString()
  roleId!: string;
}
