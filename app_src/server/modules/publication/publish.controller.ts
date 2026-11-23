import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Query,
  Param,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';

import { NeedGeoLogin, GeoRoles } from '../auth/auth.decorator';
import { PublishService } from './publish.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  PublishRecordListQueryDto,
  CreatePublishRecordDto,
  UpdatePublishRecordDto,
} from './dto/publish.dto';
import type { UserRole } from '@shared/api.interface';

@Controller('api/publish')
@NeedGeoLogin()
export class PublishController {
  constructor(
    private readonly publishService: PublishService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private getGeoUser(req: Request): { id: string; role: UserRole; brandId: string | null } {
    const user = (req as any).geoUser;
    return {
      id: user.id,
      role: user.role as UserRole,
      brandId: user.brandId ?? null,
    };
  }

  /**
   * client 角色强制使用自己的 brandId，admin/operator 保持 dto/query 原值。
   */
  private resolveWriteBrandId(
    dtoBrandId: string | undefined,
    user: { role: UserRole; brandId: string | null },
  ): string {
    if (user.role === 'client' && user.brandId) {
      return user.brandId;
    }
    return dtoBrandId ?? '';
  }

  // ---------- 列表 ----------

  @Get('records')
  async listRecords(
    @Query() query: PublishRecordListQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.publishService.listRecords(query, user);
  }

  // ---------- 按任务查 ----------
  // 静态路由必须在动态路由 :id 之前

  @Get('records/by-task/:taskId')
  async getRecordsByTask(
    @Param('taskId') taskId: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.publishService.getRecordsByTask(taskId, user);
  }

  // ---------- 详情 ----------

  @Get('records/:id')
  async getRecord(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.publishService.getRecord(id, user);
  }

  // ---------- 新增 ----------

  @Post('records')
  async createRecord(
    @Body() dto: CreatePublishRecordDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveWriteBrandId(dto.brandId, user);
    const result = this.publishService.createRecord({ ...dto, brandId }, user);
    this.auditLogService.log({
      action: 'publish_record_create',
      actor: user.id,
      role: user.role,
      target: dto.title || '未命名',
      detail: `发布登记：${dto.title || '未命名'}（${dto.contentType}）`,
      ip: this.getClientIp(req),
    });
    return result;
  }

  // ---------- 更新 ----------

  @Patch('records/:id')
  async updateRecord(
    @Param('id') id: string,
    @Body() dto: UpdatePublishRecordDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.publishService.updateRecord(id, dto, user);
  }

  // ---------- 删除 ----------

  @Delete('records/:id')
  @GeoRoles(['admin', 'operator', 'client'])
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRecord(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    const user = this.getGeoUser(req);
    await this.publishService.deleteRecord(id, user);
  }

  // ---------- 回收外链 ----------

  @Post('records/:id/recycle')
  @GeoRoles(['admin', 'operator', 'client'])
  async recycleRecord(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.publishService.recycleRecord(id, user);
  }

  private getClientIp(req: Request): string | undefined {
    const forwarded = req.headers['x-forwarded-for'] as string | string[] | undefined;
    if (forwarded) {
      return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
    }
    return req.ip;
  }
}
