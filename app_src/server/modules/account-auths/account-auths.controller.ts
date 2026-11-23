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

import { NeedGeoLogin, GeoRoles, PublicGeo } from '../auth/auth.decorator';
import { AccountAuthsService } from './account-auths.service';
import {
  AccountAuthListQueryDto,
  CreateAccountAuthDto,
  UpdateAccountAuthDto,
} from './dto/account-auths.dto';
import {
  UnifiedAccountListQueryDto,
  CreateUnifiedAccountDto,
  AuthorizeCodeDto,
  AccountSessionDto,
  AccountHeartbeatDto,
} from './dto/unified-account.dto';
import type { UserRole } from '@shared/api.interface';

@Controller('api/account-auths')
@NeedGeoLogin()
export class AccountAuthsController {
  constructor(private readonly accountAuthsService: AccountAuthsService) {}

  private getGeoUser(req: Request): {
    id: string;
    role: UserRole;
    brandId: string | null;
  } {
    const user = (
      req as unknown as { geoUser: { id: string; role: string; brandId?: string | null } }
    ).geoUser;
    return {
      id: user.id,
      role: user.role as UserRole,
      brandId: user.brandId ?? null,
    };
  }

  /**
   * client 角色强制使用自己的 brandId，admin/operator 保持 dto 原值。
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

  // ---------- 统一账号（静态路由必须在动态路由 :id 之前） ----------

  @Get('platform-capabilities')
  @PublicGeo()
  async getPlatformCapabilities() {
    return this.accountAuthsService.getPlatformCapabilities();
  }

  @Post('authorize-code')
  @GeoRoles(['admin', 'operator'])
  async generateAuthorizeCode(
    @Body() dto: AuthorizeCodeDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveWriteBrandId(dto.brandId, user);
    return this.accountAuthsService.generateAuthorizeCode(
      { ...dto, brandId },
      user,
    );
  }

  @Get('resolve-code')
  @PublicGeo()
  async resolveCode(
    @Query('code') code: string,
  ) {
    return this.accountAuthsService.resolveAuthorizeCode(code);
  }

  @Post(':id/session')
  @PublicGeo()
  async setAccountSession(
    @Param('id') id: string,
    @Body() dto: AccountSessionDto,
  ) {
    return this.accountAuthsService.setAccountSession(id, dto);
  }

  @Post(':id/heartbeat')
  @PublicGeo()
  async heartbeat(
    @Param('id') id: string,
    @Body() dto: AccountHeartbeatDto,
  ) {
    return this.accountAuthsService.heartbeat(id, dto);
  }

  @Delete(':id/session')
  @GeoRoles(['admin', 'operator'])
  async clearSession(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.accountAuthsService.clearSession(id, user);
  }

  @Get('unified/platform-stats')
  async getUnifiedPlatformStats(
    @Query('brandId') brandId: string | undefined,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.accountAuthsService.getPlatformStats(brandId, user);
  }

  @Get('unified')
  async listUnified(
    @Query() query: UnifiedAccountListQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.accountAuthsService.listUnified(query, user);
  }

  @Post('unified')
  @GeoRoles(['admin', 'operator'])
  async createUnified(
    @Body() dto: CreateUnifiedAccountDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveWriteBrandId(dto.brandId, user);
    return this.accountAuthsService.createUnified({ ...dto, brandId }, user);
  }

  // ---------- 平台卡片（静态路由必须在动态路由 :id 之前） ----------

  @Get('platform-cards')
  async platformCards(
    @Query('brandId') brandId: string | undefined,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.accountAuthsService.platformCards(brandId, user);
  }

  // ---------- 列表 ----------

  @Get()
  async list(
    @Query() query: AccountAuthListQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.accountAuthsService.list(query, user);
  }

  // ---------- 创建 ----------

  @Post()
  @GeoRoles(['admin', 'operator'])
  async create(
    @Body() dto: CreateAccountAuthDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveWriteBrandId(dto.brandId, user);
    return this.accountAuthsService.create({ ...dto, brandId }, user);
  }

  // ---------- 生成授权码 ----------

  @Post(':id/auth-code')
  @GeoRoles(['admin', 'operator'])
  async generateAuthCode(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.accountAuthsService.generateAuthCode(id, user);
  }

  // ---------- 解绑 ----------

  @Post(':id/unbind')
  @GeoRoles(['admin', 'operator'])
  async unbind(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.accountAuthsService.unbind(id, user);
  }

  // ---------- 更新 ----------

  @Patch(':id')
  @GeoRoles(['admin', 'operator', 'client'])
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAccountAuthDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.accountAuthsService.update(id, dto, user);
  }

  // ---------- 删除 ----------

  @Delete(':id')
  @GeoRoles(['admin', 'operator'])
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    const user = this.getGeoUser(req);
    await this.accountAuthsService.remove(id, user);
  }
}

