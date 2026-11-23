import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { NeedGeoLogin, GeoRoles } from '../auth/auth.decorator';
import { DeliveryService } from './delivery.service';
import type {
  DeliveryOverviewResponse,
  DeliveryStatus,
  BrandActivityResponse,
} from '@shared/api.interface';

@Controller('api/admin/delivery')
@NeedGeoLogin()
@GeoRoles(['admin', 'operator'])
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  /**
   * 交付看板总览
   */
  @Get('overview')
  async getOverview(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('deliveryStatus') deliveryStatus?: DeliveryStatus,
    @Query('keyword') keyword?: string,
    @Query('sortBy') sortBy?: 'lastActivity' | 'expiry' | 'balance' | 'monthlyArticles',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ): Promise<DeliveryOverviewResponse> {
    return this.deliveryService.getOverview({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      deliveryStatus,
      keyword,
      sortBy,
      sortOrder,
    });
  }

  /**
   * 品牌活动时间线
   */
  @Get('brands/:brandId/activity')
  async getBrandActivity(
    @Param('brandId', ParseUUIDPipe) brandId: string,
    @Query('limit') limit?: string,
  ): Promise<BrandActivityResponse> {
    return this.deliveryService.getBrandActivity(
      brandId,
      limit ? Number(limit) : 10,
    );
  }
}
