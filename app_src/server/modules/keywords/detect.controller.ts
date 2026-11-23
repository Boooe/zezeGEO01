import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';

import { NeedGeoLogin, GeoRoles } from '../auth/auth.decorator';
import { DetectService } from './detect.service';
import {
  CreateDetectTaskDto,
  DetectTaskListQueryDto,
  DetectResultQueryDto,
  DetectVisibilityQueryDto,
  DetectSingleDto,
  AiDetectResultListQueryDto,
  AiDetectResultStatsQueryDto,
  LegacyResultListQueryDto,
} from './dto/detect.dto';
import type { UserRole, AiDetectPlatform } from '@shared/api.interface';

@Controller('api/keywords/detect')
@NeedGeoLogin()
export class DetectController {
  constructor(private readonly detectService: DetectService) {}

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
   * client 角色强制使用自己的 brandId，admin/operator 保持 dto/query 原值。
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

  private resolveReadBrandId(
    queryBrandId: string | undefined,
    user: { role: UserRole; brandId: string | null },
  ): string | null {
    if (user.role === 'client') {
      return user.brandId;
    }
    return queryBrandId ?? null;
  }

  // ============================================================
  //  创建任务
  // ============================================================

  @Post('tasks')
  @GeoRoles(['admin', 'operator', 'client'])
  async createTask(@Req() req: Request, @Body() dto: CreateDetectTaskDto) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveWriteBrandId(dto.brandId, user);
    return this.detectService.createTask({ ...dto, brandId }, user);
  }

  // ============================================================
  //  运行任务
  // ============================================================

  @Post('tasks/:id/run')
  @GeoRoles(['admin', 'operator', 'client'])
  @HttpCode(HttpStatus.OK)
  async runTask(@Req() req: Request, @Param('id') id: string) {
    const user = this.getGeoUser(req);
    await this.detectService.runTask(id, user);
    return { ok: true };
  }

  // ============================================================
  //  重试失败
  // ============================================================

  @Post('tasks/:id/retry')
  @GeoRoles(['admin', 'operator', 'client'])
  @HttpCode(HttpStatus.OK)
  async retryFailed(@Req() req: Request, @Param('id') id: string) {
    const user = this.getGeoUser(req);
    await this.detectService.retryFailed(id, user);
    return { ok: true };
  }

  // ============================================================
  //  任务列表
  // ============================================================

  @Get('tasks')
  @GeoRoles(['admin', 'operator', 'client'])
  async getTaskList(@Req() req: Request, @Query() query: DetectTaskListQueryDto) {
    const user = this.getGeoUser(req);
    const effectiveBrandId = this.resolveReadBrandId(query.brandId, user);
    return this.detectService.getTaskList(
      { ...query, brandId: effectiveBrandId ?? undefined },
      user,
    );
  }

  // ============================================================
  //  任务详情 + summary
  // ============================================================

  @Get('tasks/:id')
  @GeoRoles(['admin', 'operator', 'client'])
  async getTaskDetail(@Param('id') id: string) {
    return this.detectService.getTaskDetail(id);
  }

  // ============================================================
  //  结果列表
  // ============================================================

  @Get('tasks/:id/results')
  @GeoRoles(['admin', 'operator', 'client'])
  async getTaskResults(
    @Param('id') id: string,
    @Query() query: DetectResultQueryDto,
  ) {
    return this.detectService.getTaskResults(id, query);
  }

  // ============================================================
  //  词灵感可见度查询
  // ============================================================

  @Post('visibility')
  @GeoRoles(['admin', 'operator', 'client'])
  async getVisibility(@Req() req: Request, @Body() dto: DetectVisibilityQueryDto) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveWriteBrandId(dto.brandId, user);
    return this.detectService.getKeywordVisibility({ ...dto, brandId });
  }

  // ============================================================
  //  词灵感单测
  // ============================================================

  @Post('single')
  @GeoRoles(['admin', 'operator', 'client'])
  async runSingle(@Req() req: Request, @Body() dto: DetectSingleDto) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveWriteBrandId(dto.brandId, user);
    return this.detectService.runSingleDetect(
      brandId,
      dto.keyword,
      dto.platforms as AiDetectPlatform[],
      user,
    );
  }

  // ============================================================
  //  样本播种（给 3 个指定品牌批量跑真实检测样本）
  // ============================================================

  @Post('seed-samples')
  @GeoRoles(['admin'])
  @HttpCode(HttpStatus.OK)
  async seedSamples(@Req() req: Request) {
    const user = this.getGeoUser(req);
    return this.detectService.seedSamples(user.id);
  }

  // ============================================================
  //  平台 Key 配置状态
  // ============================================================

  @Get('platforms/status')
  @GeoRoles(['admin', 'operator', 'client'])
  async getPlatformsStatus() {
    return this.detectService.getPlatformsStatus();
  }

  // ============================================================
  //  报表：AI 检测结果列表
  // ============================================================

  @Get('results')
  @GeoRoles(['admin', 'operator', 'client'])
  async getResults(
    @Req() req: Request,
    @Query() query: AiDetectResultListQueryDto,
  ) {
    const user = this.getGeoUser(req);
    const effectiveBrandId = this.resolveReadBrandId(query.brandId, user);
    return this.detectService.getResults(
      { ...query, brandId: effectiveBrandId ?? query.brandId },
      user,
    );
  }

  // ============================================================
  //  报表：AI 检测结果统计
  // ============================================================

  @Get('results/stats')
  @GeoRoles(['admin', 'operator', 'client'])
  async getResultsStats(
    @Req() req: Request,
    @Query() query: AiDetectResultStatsQueryDto,
  ) {
    const user = this.getGeoUser(req);
    const effectiveBrandId = this.resolveReadBrandId(query.brandId, user);
    return this.detectService.getResultsStats(
      { ...query, brandId: effectiveBrandId ?? query.brandId },
      user,
    );
  }

  // ============================================================
  //  报表：旧版搜索引擎记录数量
  // ============================================================

  @Get('results/legacy-count')
  @GeoRoles(['admin', 'operator', 'client'])
  async getLegacyResultsCount(
    @Req() req: Request,
    @Query('brandId') brandId: string,
  ) {
    const user = this.getGeoUser(req);
    const effectiveBrandId = this.resolveReadBrandId(brandId, user);
    return this.detectService.getLegacyResultsCount(
      effectiveBrandId ?? brandId,
      user,
    );
  }

  // ============================================================
  //  报表：旧版搜索引擎记录列表
  // ============================================================

  @Get('results/legacy')
  @GeoRoles(['admin', 'operator', 'client'])
  async getLegacyResults(
    @Req() req: Request,
    @Query() query: LegacyResultListQueryDto,
  ) {
    const user = this.getGeoUser(req);
    const effectiveBrandId = this.resolveReadBrandId(query.brandId, user);
    return this.detectService.getLegacyResults(
      { ...query, brandId: effectiveBrandId ?? query.brandId },
      user,
    );
  }
}
