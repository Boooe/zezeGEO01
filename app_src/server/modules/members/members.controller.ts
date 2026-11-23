import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  Param,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { Request } from 'express';

import { NeedGeoLogin, RequirePermission } from '../auth/auth.decorator';
import { MembersService } from './members.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  MemberListQueryDto,
  CreateMemberDto,
  UpdateMemberStatusDto,
  UpdateMemberRoleDto,
} from './dto/members.dto';

@Controller('api/members')
@NeedGeoLogin()
@RequirePermission('system.member')
export class MembersController {
  constructor(
    private readonly membersService: MembersService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get()
  async list(@Query() query: MemberListQueryDto) {
    return this.membersService.listMembers(query);
  }

  @Post()
  async create(@Body() dto: CreateMemberDto, @Req() req: Request) {
    const geoUser = (req as any).geoUser;
    const result = await this.membersService.createMember(dto);
    this.auditLogService.log({
      action: 'member_create',
      actor: geoUser?.username ?? 'system',
      role: geoUser?.role,
      target: dto.username,
      detail: `创建成员 ${dto.name} (${dto.role})`,
      ip: this.getClientIp(req),
    });
    return result;
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMemberStatusDto,
    @Req() req: Request,
  ) {
    const geoUser = (req as any).geoUser;
    const result = await this.membersService.updateMemberStatus(id, dto, geoUser.username);
    this.auditLogService.log({
      action: dto.status === 'active' ? 'member_enable' : 'member_disable',
      actor: geoUser?.username ?? 'system',
      role: geoUser?.role,
      target: result.username,
      detail: `${dto.status === 'active' ? '启用' : '禁用'}成员 ${result.name}`,
      ip: this.getClientIp(req),
    });
    return result;
  }

  @Patch(':id/role')
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMemberRoleDto,
    @Req() req: Request,
  ) {
    const geoUser = (req as any).geoUser;
    const result = await this.membersService.updateMemberRole(id, dto);
    this.auditLogService.log({
      action: 'member_role_update',
      actor: geoUser?.username ?? 'system',
      role: geoUser?.role,
      target: result.username,
      detail: `修改成员 ${result.name} 的角色为 ${result.role}`,
      ip: this.getClientIp(req),
    });
    return result;
  }

  private getClientIp(req: Request): string | undefined {
    const forwarded = req.headers['x-forwarded-for'] as string | string[] | undefined;
    if (forwarded) {
      return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
    }
    return req.ip;
  }
}
