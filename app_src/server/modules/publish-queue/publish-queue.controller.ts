import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  Param,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { NeedGeoLogin } from '../auth/auth.decorator';
import { PublishQueueService } from './publish-queue.service';
import {
  PublishQueueListQueryDto,
  EnqueuePublishDto,
  MarkPublishedDto,
  PublishResultDto,
  PublishLedgerQueryDto,
} from './dto/publish-queue.dto';
import type { UserRole } from '@shared/api.interface';

@Controller('api/publish-queue')
export class PublishQueueController {
  constructor(private readonly publishQueueService: PublishQueueService) {}

  private getGeoUser(req: Request): { id: string; role: UserRole; brandId: string | null } {
    const user = (req as any).geoUser;
    return {
      id: user.id,
      role: user.role as UserRole,
      brandId: user.brandId ?? null,
    };
  }

  // ---------- 列表（需登录）----------

  @Get()
  @NeedGeoLogin()
  async listQueue(
    @Query() query: PublishQueueListQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.publishQueueService.listQueue(query, user);
  }

  // ---------- 加入队列（需登录）----------

  @Post()
  @NeedGeoLogin()
  async enqueue(
    @Body() dto: EnqueuePublishDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.publishQueueService.enqueue(dto, user);
  }

  // ---------- 拉取待发布任务（公开接口，本地助手调用，无需登录）----------

  @Get('pending')
  async pullPending() {
    return this.publishQueueService.pullPending();
  }

  // ---------- 信源投放台账（需登录）----------

  @Get('ledger')
  @NeedGeoLogin()
  async getLedger(
    @Query() query: PublishLedgerQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.publishQueueService.getLedger(query, user);
  }

  @Get('ledger/:channelId/detail')
  @NeedGeoLogin()
  async getLedgerDetail(
    @Param('channelId') channelId: string,
    @Query() query: PublishLedgerQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.publishQueueService.getLedgerDetail(channelId, query, user);
  }

  @Get('ledger/:channelId/accounts')
  @NeedGeoLogin()
  async getLedgerAccounts(
    @Param('channelId') channelId: string,
    @Query() query: PublishLedgerQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.publishQueueService.getLedgerAccountBreakdown(channelId, query, user);
  }

  // ---------- 统一账号下拉（需登录，静态路由在 :id 之前）----------

  @Get('accounts')
  @NeedGeoLogin()
  async getAccounts(
    @Query('brandId') brandId: string | undefined,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.publishQueueService.getAccounts(brandId, user);
  }

  // ---------- 详情（需登录）----------

  @Get(':id')
  @NeedGeoLogin()
  async getDetail(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.publishQueueService.getDetail(id, user);
  }

  // ---------- 删除（需登录，仅待发布/待客户端领取）----------

  @Delete(':id')
  @NeedGeoLogin()
  async deleteQueue(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    await this.publishQueueService.deleteQueueItem(id, user);
    return { ok: true };
  }

  // ---------- 重试（需登录）----------

  @Post(':id/retry')
  @NeedGeoLogin()
  async retry(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.publishQueueService.retry(id, user);
  }

  // ---------- 改为手动（需登录）----------

  @Post(':id/mark-manual')
  @NeedGeoLogin()
  async markManual(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.publishQueueService.markManual(id, user);
  }

  // ---------- 标记已发布（需登录）----------

  @Post(':id/mark-published')
  @NeedGeoLogin()
  async markPublished(
    @Param('id') id: string,
    @Body() dto: MarkPublishedDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.publishQueueService.markPublished(id, dto, user);
  }

  // ---------- 重新排期（需登录，仅待排期dispatch计划）----------

  @Post('dispatch/:id/reschedule')
  @NeedGeoLogin()
  async rescheduleDispatch(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.publishQueueService.rescheduleDispatchPlan(id, user);
  }

  // ---------- 回传结果（公开接口，本地助手调用，无需登录）----------

  @Post(':id/result')
  async reportResult(
    @Param('id') id: string,
    @Body() dto: PublishResultDto,
  ) {
    return this.publishQueueService.reportResult(id, dto);
  }

}
