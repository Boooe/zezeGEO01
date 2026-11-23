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
import { SubmissionQueueService } from './submission-queue.service';
import {
  SubmissionQueueListQueryDto,
  EnqueueSubmissionDto,
  SubmissionStatusUpdateDto,
  SubmissionResultDto,
  PendingSubmissionQueryDto,
} from './dto/submission-queue.dto';
import type { UserRole } from '@shared/api.interface';

@Controller('api/submission-queue')
export class SubmissionQueueController {
  constructor(private readonly submissionQueueService: SubmissionQueueService) {}

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
    @Query() query: SubmissionQueueListQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.submissionQueueService.listQueue(query, user);
  }

  // ---------- 入队（需登录）----------

  @Post()
  @NeedGeoLogin()
  async enqueue(
    @Body() dto: EnqueueSubmissionDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.submissionQueueService.enqueue(dto, user);
  }

  // ---------- 状态流转（需登录）----------

  @Post(':id/status')
  @NeedGeoLogin()
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: SubmissionStatusUpdateDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.submissionQueueService.updateStatus(id, dto, user);
  }

  // ---------- 拉取待投稿任务（公开接口，本地投稿器调用，无需登录）----------

  @Get('pending')
  async pullPending(
    @Query() query: PendingSubmissionQueryDto,
  ) {
    const limit = query.limit ?? 10;
    return this.submissionQueueService.pullPending(limit);
  }

  // ---------- 回传结果（公开接口，本地投稿器调用，无需登录）----------

  @Post(':id/result')
  async reportResult(
    @Param('id') id: string,
    @Body() dto: SubmissionResultDto,
  ) {
    return this.submissionQueueService.reportResult(id, dto);
  }

  // ---------- 删除（需登录）----------

  @Delete(':id')
  @NeedGeoLogin()
  async delete(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.submissionQueueService.delete(id, user);
  }
}
