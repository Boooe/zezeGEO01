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

import { MediaWalletService } from './media-wallet.service';
import { NeedGeoLogin, GeoRoles } from '../auth/auth.decorator';
import { AuditLogService } from '../audit-log/audit-log.service';
import { WalletQueryDto, WalletTxQueryDto } from './dto/wallet.dto';
import {
  ApplyRechargeDto,
  RechargeListQueryDto,
  ApproveRechargeDto,
  RejectRechargeDto,
} from './dto/recharge.dto';

@Controller('api/media-wallet')
@NeedGeoLogin()
export class MediaWalletController {
  constructor(
    private readonly mediaWalletService: MediaWalletService,
    private readonly auditLogService: AuditLogService,
  ) {}

  // ========== 钱包 ==========

  @Get('wallet')
  async getWallet(@Req() req: Request, @Query() query: WalletQueryDto) {
    const geoUser = (req as any).geoUser;
    return this.mediaWalletService.getWallet(geoUser, query.brandId);
  }

  @Get('wallet/transactions')
  async getWalletTransactions(
    @Req() req: Request,
    @Query() query: WalletTxQueryDto,
  ) {
    const geoUser = (req as any).geoUser;
    return this.mediaWalletService.getWalletTransactions(geoUser, {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      brandId: query.brandId,
      type: query.type,
    });
  }

  // ========== 充值申请 ==========

  @Post('recharge/apply')
  async applyRecharge(@Req() req: Request, @Body() dto: ApplyRechargeDto) {
    const geoUser = (req as any).geoUser;
    if (geoUser.role !== 'client') {
      throw new ForbiddenException('仅客户角色可申请充值');
    }
    return this.mediaWalletService.applyRecharge(
      geoUser.brandId,
      dto.amountYuan,
    );
  }

  @Get('recharge/applications')
  async listRechargeApplications(
    @Req() req: Request,
    @Query() query: RechargeListQueryDto,
  ) {
    const geoUser = (req as any).geoUser;
    return this.mediaWalletService.listRechargeApplications(geoUser, {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      status: query.status,
      brandId: query.brandId,
      startDate: query.startDate,
      endDate: query.endDate,
    });
  }

  @Get('recharge/applications/:id')
  async getRechargeApplication(
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    const geoUser = (req as any).geoUser;
    return this.mediaWalletService.getRechargeApplication(geoUser, id);
  }

  @Get('recharge/stats')
  @GeoRoles(['admin', 'operator'])
  async getRechargeStats(@Req() req: Request) {
    const geoUser = (req as any).geoUser;
    return this.mediaWalletService.getRechargeStats(geoUser);
  }

  @Post('recharge/applications/:id/approve')
  @GeoRoles(['admin', 'operator'])
  async approveRecharge(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: ApproveRechargeDto,
  ) {
    const geoUser = (req as any).geoUser;
    const result = this.mediaWalletService.approveRecharge(
      id,
      geoUser.id,
      dto.actualAmountYuan,
    );
    this.auditLogService.log({
      action: 'recharge_approve',
      actor: geoUser.username,
      role: geoUser.role,
      target: id,
      detail: `充值审批通过，实充 ${dto.actualAmountYuan} 元`,
      ip: this.getClientIp(req),
    });
    return result;
  }

  @Post('recharge/applications/:id/reject')
  @GeoRoles(['admin', 'operator'])
  async rejectRecharge(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: RejectRechargeDto,
  ) {
    const geoUser = (req as any).geoUser;
    const result = this.mediaWalletService.rejectRecharge(
      id,
      geoUser.id,
      dto.rejectReason,
    );
    this.auditLogService.log({
      action: 'recharge_reject',
      actor: geoUser.username,
      role: geoUser.role,
      target: id,
      detail: `充值审批驳回：${dto.rejectReason}`,
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
