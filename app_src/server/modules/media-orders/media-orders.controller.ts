import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';

import { MediaOrdersService } from './media-orders.service';
import { NeedGeoLogin, GeoRoles } from '../auth/auth.decorator';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  OrderListAdminQueryDto,
  OrderListClientQueryDto,
  CreateOrderDto,
  BatchCreateOrdersDto,
  SubmitSupplierDto,
  PublishOrderDto,
  RejectRefundDto,
} from './dto/orders.dto';
import type { GeoUser } from '@shared/api.interface';

@Controller('api/media-orders')
@NeedGeoLogin()
export class MediaOrdersController {
  constructor(
    private readonly ordersService: MediaOrdersService,
    private readonly auditLogService: AuditLogService,
  ) {}

  // ========== 列表（admin/operator 视角） ==========

  @Get('admin')
  @GeoRoles(['admin', 'operator'])
  async listAdmin(@Req() req: Request, @Query() query: OrderListAdminQueryDto) {
    const geoUser = (req as any).geoUser as GeoUser;
    return this.ordersService.listAdmin({
      status: query.status,
      brandId: query.brandId,
      supplierId: query.supplierId,
      keyword: query.keyword,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    });
  }

  // ========== 列表（client 视角，我的订单） ==========

  @Get('my')
  async listMy(@Req() req: Request, @Query() query: OrderListClientQueryDto) {
    const geoUser = (req as any).geoUser as GeoUser;
    if (geoUser.role !== 'client') {
      throw new ForbiddenException('仅客户角色可访问我的订单');
    }
    if (!geoUser.brandId) {
      throw new ForbiddenException('用户未绑定品牌');
    }
    return this.ordersService.listClient(geoUser.brandId, {
      status: query.status,
      keyword: query.keyword,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    });
  }

  // ========== 详情 ==========

  @Get(':id')
  async getDetail(@Req() req: Request, @Param('id') id: string) {
    const geoUser = (req as any).geoUser as GeoUser;
    return this.ordersService.getDetail(geoUser, id);
  }

  // ========== 创建订单（client） ==========

  @Post()
  async createOrder(@Req() req: Request, @Body() dto: CreateOrderDto) {
    const geoUser = (req as any).geoUser as GeoUser;
    if (geoUser.role !== 'client') {
      throw new ForbiddenException('仅客户角色可创建订单');
    }
    if (!geoUser.brandId) {
      throw new ForbiddenException('用户未绑定品牌');
    }
    const result = await this.ordersService.createOrder(geoUser.brandId, dto);
    this.auditLogService.log({
      action: 'media_order_create',
      actor: geoUser.username,
      role: geoUser.role,
      target: result.orderNo,
      detail: `媒体商城下单：${result.title}，金额 ${(result.priceCents / 100).toFixed(2)} 元`,
      ip: this.getClientIp(req),
    });
    return result;
  }

  // ========== 批量创建订单（client，一键发稿） ==========

  @Post('batch')
  async batchCreateOrders(@Req() req: Request, @Body() dto: BatchCreateOrdersDto) {
    const geoUser = (req as any).geoUser as GeoUser;
    if (geoUser.role !== 'client') {
      throw new ForbiddenException('仅客户角色可创建订单');
    }
    if (!geoUser.brandId) {
      throw new ForbiddenException('用户未绑定品牌');
    }
    const result = await this.ordersService.batchCreateOrders(geoUser.brandId, dto);
    this.auditLogService.log({
      action: 'media_order_batch_create',
      actor: geoUser.username,
      role: geoUser.role,
      target: 'batch',
      detail: `批量下单：成功 ${result.successCount} 条，失败 ${result.failedCount} 条`,
      ip: this.getClientIp(req),
    });
    return result;
  }

  // ========== 接单 ==========

  @Post(':id/accept')
  @GeoRoles(['admin', 'operator'])
  async acceptOrder(@Req() req: Request, @Param('id') id: string) {
    const geoUser = (req as any).geoUser as GeoUser;
    return this.ordersService.acceptOrder(id, geoUser.id);
  }

  // ========== 提交供应商 ==========

  @Post(':id/submit-supplier')
  @GeoRoles(['admin', 'operator'])
  async submitSupplier(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: SubmitSupplierDto,
  ) {
    const geoUser = (req as any).geoUser as GeoUser;
    return this.ordersService.submitSupplier(id, dto.supplierOrderNo, geoUser.id);
  }

  // ========== 标记已发布 ==========

  @Post(':id/publish')
  @GeoRoles(['admin', 'operator'])
  async publishOrder(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: PublishOrderDto,
  ) {
    const geoUser = (req as any).geoUser as GeoUser;
    return this.ordersService.publishOrder(id, dto.publishedUrl, geoUser.id);
  }

  // ========== 驳回退款 ==========

  @Post(':id/reject-refund')
  @GeoRoles(['admin', 'operator'])
  async rejectRefund(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: RejectRefundDto,
  ) {
    const geoUser = (req as any).geoUser as GeoUser;
    return this.ordersService.rejectRefund(id, dto.rejectReason, geoUser.id);
  }

  private getClientIp(req: Request): string | undefined {
    const forwarded = req.headers['x-forwarded-for'] as string | string[] | undefined;
    if (forwarded) {
      return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
    }
    return req.ip;
  }
}
