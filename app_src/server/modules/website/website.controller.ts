import {
  Controller,
  Get,
  Post,
  Put,
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
import { WebsiteService } from './website.service';
import {
  WebsiteSettingsQueryDto,
  SaveWebsiteSettingsDto,
  TdkTemplateListQueryDto,
  CreateTdkTemplateDto,
  UpdateTdkTemplateDto,
  ApplyTdkTemplateDto,
  SiteListQueryDto,
  CreateSiteDto,
  UpdateSiteDto,
} from './dto/website.dto';
import type { UserRole } from '@shared/api.interface';

@Controller('api/website')
@NeedGeoLogin()
export class WebsiteController {
  constructor(private readonly websiteService: WebsiteService) {}

  private getGeoUser(req: Request): {
    id: string;
    role: UserRole;
    brandId: string | null;
  } {
    const user = (req as any).geoUser;
    return {
      id: user.id,
      role: user.role as UserRole,
      brandId: user.brandId ?? null,
    };
  }

  /**
   * 解析品牌ID：client 强制用自己的；admin/operator 传了就用，不传返回空串由 service 返回空数据。
   */
  private resolveBrandId(
    dtoBrandId: string | undefined,
    user: { role: UserRole; brandId: string | null },
  ): string {
    if (user.role === 'client' && user.brandId) {
      return user.brandId;
    }
    return dtoBrandId ?? '';
  }

  // ---------- 官网设置 ----------

  @Get('settings')
  async getSettings(
    @Query() query: WebsiteSettingsQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveBrandId(query.brandId, user);
    return this.websiteService.getSettings({ ...query, brandId }, user);
  }

  @Put('settings')
  @GeoRoles(['admin', 'operator', 'client'])
  async saveSettings(
    @Body() dto: SaveWebsiteSettingsDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveBrandId(dto.brandId, user);
    return this.websiteService.saveSettings({ ...dto, brandId }, user);
  }

  // ---------- TDK 模板 ----------

  @Get('tdk')
  async listTdkTemplates(
    @Query() query: TdkTemplateListQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveBrandId(query.brandId, user);
    return this.websiteService.listTdkTemplates({ ...query, brandId }, user);
  }

  @Post('tdk')
  @GeoRoles(['admin', 'operator', 'client'])
  async createTdkTemplate(
    @Body() dto: CreateTdkTemplateDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveBrandId(dto.brandId, user);
    return this.websiteService.createTdkTemplate({ ...dto, brandId }, user);
  }

  @Patch('tdk/:id')
  @GeoRoles(['admin', 'operator', 'client'])
  async updateTdkTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateTdkTemplateDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.websiteService.updateTdkTemplate(id, dto, user);
  }

  @Delete('tdk/:id')
  @GeoRoles(['admin', 'operator', 'client'])
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTdkTemplate(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    const user = this.getGeoUser(req);
    await this.websiteService.deleteTdkTemplate(id, user);
  }

  @Post('tdk/:id/apply')
  @GeoRoles(['admin', 'operator', 'client'])
  async applyTdkTemplate(
    @Param('id') id: string,
    @Body() dto: ApplyTdkTemplateDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.websiteService.applyTdkTemplate(id, dto, user);
  }

  // ---------- 站群 ----------

  @Get('sites')
  async listSites(
    @Query() query: SiteListQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveBrandId(query.brandId, user);
    return this.websiteService.listSites({ ...query, brandId }, user);
  }

  @Post('sites')
  @GeoRoles(['admin', 'operator', 'client'])
  async createSite(
    @Body() dto: CreateSiteDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveBrandId(dto.brandId, user);
    return this.websiteService.createSite({ ...dto, brandId }, user);
  }

  @Patch('sites/:id')
  @GeoRoles(['admin', 'operator', 'client'])
  async updateSite(
    @Param('id') id: string,
    @Body() dto: UpdateSiteDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.websiteService.updateSite(id, dto, user);
  }

  @Delete('sites/:id')
  @GeoRoles(['admin', 'operator', 'client'])
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSite(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    const user = this.getGeoUser(req);
    await this.websiteService.deleteSite(id, user);
  }
}
