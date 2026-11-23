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
import { ChannelsService } from './channels.service';
import {
  ChannelListQueryDto,
  CreateChannelDto,
  UpdateChannelDto,
} from './dto/channels.dto';
import type { UserRole } from '@shared/api.interface';

@Controller('api/channels')
@NeedGeoLogin()
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  private getGeoUser(req: Request): { id: string; role: UserRole; brandId: string | null } {
    const user = (req as unknown as { geoUser: { id: string; role: string; brandId?: string | null } }).geoUser;
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

  @Get()
  async list(
    @Query() query: ChannelListQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.channelsService.list(query, user);
  }

  // ---------- 新增 ----------

  @Post()
  async create(
    @Body() dto: CreateChannelDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveWriteBrandId(dto.brandId, user);
    return this.channelsService.create({ ...dto, brandId }, user);
  }

  // ---------- 更新（静态路由必须在动态路由 :id 之前） ----------
  // 注意: /:id/test 在前，/:id 在后，避免冲突

  // ---------- 测试连接 ----------

  @Post(':id/test')
  @GeoRoles(['admin', 'operator', 'client'])
  async test(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.channelsService.test(id, user);
  }

  // ---------- 更新 ----------

  @Patch(':id')
  @GeoRoles(['admin', 'operator', 'client'])
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateChannelDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.channelsService.update(id, dto, user);
  }

  // ---------- 删除 ----------

  @Delete(':id')
  @GeoRoles(['admin', 'operator', 'client'])
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    const user = this.getGeoUser(req);
    await this.channelsService.remove(id, user);
  }
}
