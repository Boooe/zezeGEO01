import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';

import { NeedGeoLogin } from '../auth/auth.decorator';
import { DashboardService } from './dashboard.service';
import type {
  DashboardStats,
  HitRateTrend,
  PlatformHitDistribution,
  RiskRadar,
  BrandDashboardStats,
  BrandDailyTrend,
  IndustryNewsItem,
  AiPlatformStatItem,
  AiPlatformCoverage,
  HotKeywordRank,
  WorkbenchStats,
} from '@shared/api.interface';

@Controller('api/dashboard')
@NeedGeoLogin()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  private getBrandId(req: Request): string | null {
    const geoUser = (req as any).geoUser;
    if (geoUser?.role === 'client' && geoUser?.brandId) {
      return geoUser.brandId;
    }
    return null;
  }

  @Get('stats')
  async getStats(
    @Req() req: Request,
    @Query('range') range?: string,
    @Query('brandId') brandIdQuery?: string,
  ): Promise<DashboardStats> {
    const contextBrandId = this.getBrandId(req);
    const effectiveBrandId = contextBrandId ?? brandIdQuery ?? null;
    return this.dashboardService.getStats(effectiveBrandId, range ?? 'all');
  }

  @Get('trend')
  async getTrend(
    @Req() req: Request,
    @Query('brandId') brandIdQuery?: string,
  ): Promise<HitRateTrend[]> {
    const contextBrandId = this.getBrandId(req);
    const effectiveBrandId = contextBrandId ?? brandIdQuery ?? null;
    return this.dashboardService.getHitRateTrend(effectiveBrandId);
  }

  @Get('platform-distribution')
  async getPlatformDistribution(
    @Req() req: Request,
    @Query('range') range?: string,
  ): Promise<PlatformHitDistribution[]> {
    return this.dashboardService.getPlatformDistribution(
      this.getBrandId(req),
      range ?? 'all',
    );
  }

  @Get('risks')
  async getRisks(@Req() req: Request): Promise<RiskRadar> {
    return this.dashboardService.getRisks(this.getBrandId(req));
  }

  @Get('brand-stats')
  async getBrandStats(
    @Req() req: Request,
    @Query('range') range?: string,
  ): Promise<BrandDashboardStats> {
    const geoUser = (req as any).geoUser;
    let brandId: string;
    if (geoUser?.role === 'client' && geoUser?.brandId) {
      brandId = geoUser.brandId;
    } else {
      brandId = (req.query.brandId as string) ?? '';
    }
    return this.dashboardService.getBrandStats(brandId, range ?? '7d');
  }

  @Get('brand-trend')
  async getBrandTrend(
    @Req() req: Request,
    @Query('days') days?: string,
  ): Promise<BrandDailyTrend[]> {
    const geoUser = (req as any).geoUser;
    let brandId: string;
    if (geoUser?.role === 'client' && geoUser?.brandId) {
      brandId = geoUser.brandId;
    } else {
      brandId = (req.query.brandId as string) ?? '';
    }
    const daysNum = days ? Number(days) : 30;
    return this.dashboardService.getBrandTrend(brandId, daysNum);
  }

  @Get('industry-news')
  async getIndustryNews(@Query('date') date?: string): Promise<IndustryNewsItem[]> {
    return this.dashboardService.getIndustryNews(date);
  }

  @Get('ai-platform-stats')
  async getAiPlatformStats(@Query('date') date?: string): Promise<AiPlatformStatItem[]> {
    return this.dashboardService.getAiPlatformStats(date);
  }

  @Get('ai-platform-coverage')
  async getAiPlatformCoverage(
    @Req() req: Request,
    @Query('range') range?: string,
  ): Promise<AiPlatformCoverage[]> {
    const brandId = this.getBrandId(req);
    const brandIdQuery = req.query.brandId as string;
    const effectiveBrandId = brandId ?? brandIdQuery ?? null;
    return this.dashboardService.getAiPlatformCoverage(effectiveBrandId, range ?? 'all');
  }

  @Get('hot-keywords')
  async getHotKeywords(
    @Req() req: Request,
    @Query('range') range?: string,
    @Query('platform') platform?: string,
    @Query('limit') limit?: string,
  ): Promise<HotKeywordRank[]> {
    const brandId = this.getBrandId(req);
    const brandIdQuery = req.query.brandId as string;
    const effectiveBrandId = brandId ?? brandIdQuery ?? null;
    const limitNum = limit ? Number(limit) : 10;
    return this.dashboardService.getHotKeywords(effectiveBrandId, range ?? 'all', platform, limitNum);
  }

  @Get('workbench-stats')
  async getWorkbenchStats(
    @Req() req: Request,
    @Query('range') range?: string,
  ): Promise<WorkbenchStats> {
    const brandId = this.getBrandId(req);
    const brandIdQuery = req.query.brandId as string;
    const effectiveBrandId = brandId ?? brandIdQuery ?? null;
    return this.dashboardService.getWorkbenchStats(effectiveBrandId, range ?? 'all');
  }
}
