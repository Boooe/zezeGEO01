import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { Request } from 'express';

import { NeedGeoLogin, GeoRoles } from '../auth/auth.decorator';
import { CustomerAdminService } from './customer-admin.service';
import {
  CreateCustomerFullDto,
  UpdatePlanDto,
  RenewDto,
} from './dto/customer-admin.dto';

@Controller('api/admin/customers')
@NeedGeoLogin()
export class CustomerAdminController {
  constructor(private readonly customerAdminService: CustomerAdminService) {}

  @Post()
  @GeoRoles(['admin'])
  async create(@Body() dto: CreateCustomerFullDto, @Req() req: Request) {
    const ctx = (req as any).geoUser;
    const protocol =
      (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
    const host = req.headers.host || '';
    const appId = process.env.app_id || process.env.MIAODA_APP_ID || '';
    const basePath = appId ? `/app/${appId}` : '';
    const loginUrl = `${protocol}://${host}${basePath}/login`;
    return this.customerAdminService.createCustomerFull(
      dto,
      ctx.id,
      loginUrl,
    );
  }

  @Post(':brandId/users/:userId/disable')
  @GeoRoles(['admin'])
  async disable(
    @Param('brandId', ParseUUIDPipe) brandId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.customerAdminService.disableUser(brandId, userId);
  }

  @Post(':brandId/users/:userId/enable')
  @GeoRoles(['admin'])
  async enable(
    @Param('brandId', ParseUUIDPipe) brandId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.customerAdminService.enableUser(brandId, userId);
  }

  @Post(':brandId/users/:userId/reset-password')
  @GeoRoles(['admin'])
  async resetPassword(
    @Param('brandId', ParseUUIDPipe) brandId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.customerAdminService.resetPassword(brandId, userId);
  }

  @Patch(':brandId/plan')
  @GeoRoles(['admin'])
  async updatePlan(
    @Param('brandId', ParseUUIDPipe) brandId: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.customerAdminService.updatePlan(brandId, dto);
  }

  @Post(':brandId/renew')
  @GeoRoles(['admin'])
  async renew(
    @Param('brandId', ParseUUIDPipe) brandId: string,
    @Body() dto: RenewDto,
    @Req() req: Request,
  ) {
    const ctx = (req as any).geoUser;
    return this.customerAdminService.renew(brandId, dto, ctx.id);
  }

  @Get('expiring-soon')
  @GeoRoles(['admin', 'operator'])
  async expiringSoon() {
    return this.customerAdminService.getExpiringSoonCount();
  }
}
