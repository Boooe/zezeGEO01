import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { Request } from 'express';

import { NeedGeoLogin, RequirePermission } from '../auth/auth.decorator';
import { RolesService } from './roles.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/roles.dto';

@Controller('api/roles')
@NeedGeoLogin()
@RequirePermission('system.member')
export class RolesController {
  constructor(
    private readonly rolesService: RolesService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get()
  async list() {
    return this.rolesService.listRoles();
  }

  @Post()
  async create(@Body() dto: CreateRoleDto, @Req() req: Request) {
    const geoUser = (req as any).geoUser;
    const result = await this.rolesService.createRole(dto);
    this.auditLogService.log({
      action: 'role_create',
      actor: geoUser?.username ?? 'system',
      role: geoUser?.role,
      target: result.name,
      detail: `创建角色 ${result.name} (${result.code})，权限 ${result.permissions.length} 项`,
      ip: this.getClientIp(req),
    });
    return result;
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
    @Req() req: Request,
  ) {
    const geoUser = (req as any).geoUser;
    const result = await this.rolesService.updateRole(id, dto);
    this.auditLogService.log({
      action: 'role_update',
      actor: geoUser?.username ?? 'system',
      role: geoUser?.role,
      target: result.name,
      detail: `更新角色 ${result.name}，权限 ${result.permissions.length} 项`,
      ip: this.getClientIp(req),
    });
    return result;
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    const geoUser = (req as any).geoUser;
    // 先查一下角色名用于审计日志
    const list = await this.rolesService.listRoles();
    const target = list.items.find((r) => r.id === id);
    await this.rolesService.deleteRole(id);
    this.auditLogService.log({
      action: 'role_delete',
      actor: geoUser?.username ?? 'system',
      role: geoUser?.role,
      target: target?.name ?? id,
      detail: `删除角色 ${target?.name ?? id}`,
      ip: this.getClientIp(req),
    });
    return { success: true };
  }

  private getClientIp(req: Request): string | undefined {
    const forwarded = req.headers['x-forwarded-for'] as string | string[] | undefined;
    if (forwarded) {
      return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
    }
    return req.ip;
  }
}
