import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  Res,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { NeedGeoLogin, GeoRoles } from '../auth/auth.decorator';
import { MediaMarketService } from './media-market.service';
import {
  SupplierQueryDto,
  CreateSupplierDto,
  UpdateSupplierDto,
} from './dto/supplier.dto';
import {
  ChannelPricingQueryDto,
  UpdateChannelPricingDto,
  ToggleSellableDto,
  MarketChannelQueryDto,
} from './dto/channel-pricing.dto';
import { ImportPriceDto } from './dto/import.dto';

@Controller('api/media-market/suppliers')
@NeedGeoLogin()
@GeoRoles(['admin', 'operator'])
export class MediaMarketSupplierController {
  constructor(private readonly service: MediaMarketService) {}

  @Get()
  async getSuppliers(@Query() query: SupplierQueryDto) {
    return this.service.getSuppliers(query);
  }

  @Get(':id')
  async getSupplier(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getSupplier(id);
  }

  @Post()
  async createSupplier(@Body() dto: CreateSupplierDto) {
    return this.service.createSupplier(dto);
  }

  @Patch(':id')
  async updateSupplier(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.service.updateSupplier(id, dto);
  }

  @Delete(':id')
  async deleteSupplier(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.deleteSupplier(id);
    return { success: true };
  }

  @Post(':id/recalculate-prices')
  async recalculatePrices(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.recalculatePrices(id);
  }
}

@Controller('api/media-market/channels')
@NeedGeoLogin()
@GeoRoles(['admin', 'operator'])
export class MediaMarketChannelController {
  constructor(private readonly service: MediaMarketService) {}

  @Get()
  async getChannels(@Query() query: ChannelPricingQueryDto) {
    return this.service.getChannelPricingList(query);
  }

  @Get(':id')
  async getChannel(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getChannelPricing(id);
  }

  @Patch(':id/pricing')
  async updatePricing(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateChannelPricingDto,
  ) {
    return this.service.updateChannelPricing(id, dto);
  }

  @Patch(':id/toggle-sellable')
  async toggleSellable(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ToggleSellableDto,
  ) {
    return this.service.toggleSellable(id, dto.sellable);
  }
}

@Controller('api/media-market')
@NeedGeoLogin()
export class MediaMarketController {
  constructor(private readonly service: MediaMarketService) {}

  @Post('channels/import')
  @GeoRoles(['admin', 'operator'])
  async importPrices(@Body() dto: ImportPriceDto) {
    return this.service.importPrices(dto);
  }

  @Get('stats')
  @GeoRoles(['admin', 'operator'])
  async getStats() {
    return this.service.getStats();
  }

  @Get('filters')
  async getFilterOptions() {
    return this.service.getFilterOptions();
  }

  @Get('settlement')
  @GeoRoles(['admin', 'operator'])
  async getSettlement() {
    return this.service.getSettlementStats();
  }

  @Get('template.csv')
  @GeoRoles(['admin', 'operator'])
  async getTemplate(@Res() res: Response) {
    const csv =
      '渠道名称,库类型,供应商,采购价(分),售价(分),时效(小时),库存,行业,粉丝\n' +
      '说明：请填写真实渠道数据；采购价和售价都以分为单位，0表示待定价\n';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="price-import-template.csv"',
    );
    res.send(csv);
  }
}

@Controller('api/media-market/market-channels')
@NeedGeoLogin()
export class MediaMarketChannelClientController {
  constructor(private readonly service: MediaMarketService) {}

  @Get()
  async getMarketChannels(@Query() query: MarketChannelQueryDto) {
    return this.service.getMarketChannels(query);
  }
}
