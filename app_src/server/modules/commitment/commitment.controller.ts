import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  Param,
  Req,
  Res,
  ForbiddenException,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { NeedGeoLogin, GeoRoles } from '../auth/auth.decorator';
import { CommitmentService } from './commitment.service';
import {
  SignCommitmentDto,
  ListSignaturesQueryDto,
  CreateVersionDto,
  UpdateVersionDto,
} from './dto/commitment.dto';
import type { UserRole } from '@shared/api.interface';

interface GeoUserCtx {
  id: string;
  role: UserRole;
  brandId: string | null;
}

@Controller('api/commitment')
@NeedGeoLogin()
export class CommitmentController {
  constructor(private readonly commitmentService: CommitmentService) {}

  private getGeoUser(req: Request): GeoUserCtx {
    const ctx = (req as any).geoUser as
      | { id: string; role: UserRole; brandId: string | null }
      | undefined;
    if (!ctx) {
      throw new ForbiddenException('未登录');
    }
    return {
      id: ctx.id,
      role: ctx.role,
      brandId: ctx.brandId,
    };
  }

  private ensureAdminOrOperator(user: GeoUserCtx): void {
    if (user.role !== 'admin' && user.role !== 'operator') {
      throw new ForbiddenException('权限不足');
    }
  }

  private ensureAdmin(user: GeoUserCtx): void {
    if (user.role !== 'admin') {
      throw new ForbiddenException('仅管理员可执行此操作');
    }
  }

  private ensureClient(user: GeoUserCtx): void {
    if (user.role !== 'client') {
      throw new ForbiddenException('仅客户角色可执行此操作');
    }
  }

  // ============================================================
  //  版本管理
  // ============================================================

  /**
   * 获取所有版本列表
   */
  @Get('versions')
  async listVersions(@Req() req: Request) {
    const user = this.getGeoUser(req);
    this.ensureAdminOrOperator(user);
    return this.commitmentService.listVersions();
  }

  /**
   * 新建版本（仅 admin）
   */
  @Post('versions')
  @GeoRoles(['admin'])
  async createVersion(@Body() dto: CreateVersionDto, @Req() req: Request) {
    const user = this.getGeoUser(req);
    return this.commitmentService.createVersion(dto, user.id);
  }

  /**
   * 更新版本内容（仅 admin，草稿才可改）
   */
  @Patch('versions/:id')
  @GeoRoles(['admin'])
  async updateVersion(
    @Param('id') id: string,
    @Body() dto: UpdateVersionDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.commitmentService.updateVersion(id, dto, user.id);
  }

  /**
   * 激活某个版本（仅 admin）
   */
  @Post('versions/:id/activate')
  @GeoRoles(['admin'])
  async activateVersion(@Param('id') id: string, @Req() req: Request) {
    const user = this.getGeoUser(req);
    return this.commitmentService.activateVersion(id, user.id);
  }

  // ============================================================
  //  客户端签署相关
  // ============================================================

  /**
   * 获取当前激活版本（所有人可读，用于签署页展示）
   */
  @Get('active')
  async getActiveVersion() {
    return this.commitmentService.getActiveVersion();
  }

  /**
   * 检查当前用户是否需要签署（client 用）
   */
  @Get('check')
  async checkNeedsSign(@Req() req: Request) {
    const user = this.getGeoUser(req);
    return this.commitmentService.checkNeedsSign(user.id);
  }

  /**
   * 签署承诺书（仅 client）
   */
  @Post('sign')
  async signCommitment(@Body() _dto: SignCommitmentDto, @Req() req: Request) {
    const user = this.getGeoUser(req);
    this.ensureClient(user);
    return this.commitmentService.signCommitment(req, user.id);
  }

  // ============================================================
  //  签署记录管理（admin / operator）
  // ============================================================

  /**
   * 签署记录列表（admin/operator）
   */
  @Get('signatures')
  async listSignatures(@Query() query: ListSignaturesQueryDto, @Req() req: Request) {
    const user = this.getGeoUser(req);
    this.ensureAdminOrOperator(user);
    return this.commitmentService.listSignatures(query);
  }

  /**
   * 导出 CSV（admin/operator）— 静态路由必须在 :id 动态路由之前
   */
  @Get('signatures/export')
  async exportSignaturesCsv(
    @Query() query: ListSignaturesQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const user = this.getGeoUser(req);
    this.ensureAdminOrOperator(user);
    const csv = await this.commitmentService.exportSignaturesCsv(query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="commitment-signatures.csv"`,
    );
    res.send(csv);
  }

  /**
   * 签署详情（admin/operator）
   */
  @Get('signatures/:id')
  async getSignatureDetail(@Param('id') id: string, @Req() req: Request) {
    const user = this.getGeoUser(req);
    this.ensureAdminOrOperator(user);
    return this.commitmentService.getSignatureDetail(id);
  }

  /**
   * 要求某客户重签（admin/operator）
   */
  @Post('signatures/:userId/require-resign')
  async requireResign(@Param('userId') userId: string, @Req() req: Request) {
    const user = this.getGeoUser(req);
    this.ensureAdminOrOperator(user);
    return this.commitmentService.requireResign(userId, user.id);
  }

  /**
   * 提醒签署（admin/operator）
   */
  @Post('signatures/:userId/remind')
  async remindSign(@Param('userId') userId: string, @Req() req: Request) {
    const user = this.getGeoUser(req);
    this.ensureAdminOrOperator(user);
    return this.commitmentService.remindSign(userId);
  }

}
