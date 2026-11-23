import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { NeedGeoLogin } from '../auth/auth.decorator';
import { GeoLoopService } from './geo-loop.service';
import { OverviewQueryDto } from './dto/overview.dto';
import {
  BrandProfileQueryDto,
  BrandProfileUpsertDto,
} from './dto/brand-profile.dto';
import {
  PillarsGroupedQueryDto,
  PillarCreateDto,
  DispatchPillarsDto,
} from './dto/pillars.dto';
import {
  ContentChecksQueryDto,
  RunContentChecksDto,
} from './dto/content-checks.dto';
import { GapsQueryDto, DispatchGapsDto } from './dto/gaps.dto';
import {
  ActionItemsQueryDto,
  AdoptActionItemsDto,
  UpdateActionItemStatusDto,
} from './dto/action-items.dto';
import {
  DispatchOverviewQueryDto,
  PlatformWeightsQueryDto,
  DispatchPlansQueryDto,
  SmartScheduleDto,
  ConvertToOrdersDto,
} from './dto/dispatch.dto';
import {
  InternalLinksQueryDto,
  GenerateInternalLinksDto,
  CreateInternalLinkDto,
  UpdateInternalLinkStatusDto,
  ExternalLinksQueryDto,
  ExternalLinkOverviewQueryDto,
  CreateExternalLinkDto,
  UpdateExternalLinkStatusDto,
  PageChecksQueryDto,
  CreatePageCheckDto,
  IndexChecksQueryDto,
  CreateIndexCheckDto,
} from './dto/indexing.dto';

@Controller('api/geo-loop')
@NeedGeoLogin()
export class GeoLoopController {
  constructor(private readonly geoLoopService: GeoLoopService) {}

  private getGeoUserId(req: Request): string {
    const geoUser = (req as any).geoUser as
      | { id: string; role: string; brandId: string | null }
      | undefined;
    if (!geoUser) {
      throw new Error('geoUser not found in request');
    }
    return geoUser.id;
  }

  // ============ 概览 ============
  @Get('overview')
  getOverview(@Query() query: OverviewQueryDto) {
    return this.geoLoopService.getOverview(query.brandId);
  }

  // ============ 品牌定位档案 ============
  @Get('brand-profile')
  getBrandProfile(@Query() query: BrandProfileQueryDto) {
    return this.geoLoopService.getBrandProfile(query.brandId);
  }

  @Post('brand-profile')
  upsertBrandProfile(@Body() dto: BrandProfileUpsertDto) {
    return this.geoLoopService.upsertBrandProfile(dto);
  }

  // ============ 内容矩阵 ============
  @Get('pillars/grouped')
  getPillarsGrouped(@Query() query: PillarsGroupedQueryDto) {
    return this.geoLoopService.getPillarsGrouped(query.brandId);
  }

  @Post('pillars')
  createPillar(@Body() dto: PillarCreateDto) {
    return this.geoLoopService.createPillar(dto);
  }

  @Delete('pillars/:id')
  deletePillar(@Param('id') id: string) {
    return this.geoLoopService.deletePillar(id);
  }

  @Post('pillars/dispatch-tasks')
  dispatchPillarTasks(@Body() dto: DispatchPillarsDto, @Req() req: Request) {
    const userId = this.getGeoUserId(req);
    return this.geoLoopService.dispatchPillarTasks(
      dto.pillarIds,
      dto.brandId,
      userId,
    );
  }

  // ============ 内容结构检查 ============
  @Get('content-checks')
  getContentChecks(@Query() query: ContentChecksQueryDto) {
    return this.geoLoopService.getContentChecks(query.brandId);
  }

  @Post('content-checks/run')
  runContentChecks(@Body() dto: RunContentChecksDto) {
    return this.geoLoopService.runContentChecks(
      dto.articleIds,
      dto.brandId,
    );
  }

  // ============ 竞对差距 ============
  @Get('gaps')
  getGaps(@Query() query: GapsQueryDto) {
    return this.geoLoopService.getGaps(query.brandId, query.keyword);
  }

  @Post('gaps/dispatch-tasks')
  dispatchGapTasks(@Body() dto: DispatchGapsDto, @Req() req: Request) {
    const userId = this.getGeoUserId(req);
    return this.geoLoopService.dispatchGapTasks(
      dto.gapIds,
      dto.brandId,
      userId,
    );
  }

  // ============ 优化建议 ============
  @Get('action-items')
  getActionItems(@Query() query: ActionItemsQueryDto) {
    return this.geoLoopService.getActionItems(query.brandId);
  }

  @Post('action-items/adopt')
  adoptActionItems(@Body() dto: AdoptActionItemsDto) {
    return this.geoLoopService.adoptActionItems(dto.brandId);
  }

  @Patch('action-items/:id/status')
  updateActionItemStatus(
    @Param('id') id: string,
    @Body() dto: UpdateActionItemStatusDto,
  ) {
    return this.geoLoopService.updateActionItemStatus(id, dto.status);
  }

  // ============ 分发节奏 · 概览 ============
  @Get('dispatch/overview')
  getDispatchOverview(@Query() query: DispatchOverviewQueryDto) {
    return this.geoLoopService.getDispatchOverview(query.brandId);
  }

  // ============ 分发节奏 · 平台权重 ============
  @Get('dispatch/platform-weights')
  getPlatformWeights(@Query() query: PlatformWeightsQueryDto) {
    return this.geoLoopService.getPlatformWeights(query.brandId, query.tier);
  }

  // ============ 分发节奏 · 计划列表 ============
  @Get('dispatch/plans')
  getDispatchPlans(@Query() query: DispatchPlansQueryDto) {
    return this.geoLoopService.getDispatchPlans(
      query.brandId,
      query.startDate,
      query.endDate,
    );
  }

  // ============ 分发节奏 · 智能排期 ============
  @Post('dispatch/smart-schedule')
  smartSchedule(@Body() dto: SmartScheduleDto) {
    return this.geoLoopService.smartSchedule(dto);
  }

  // ============ 分发节奏 · 转下单 ============
  @Post('dispatch/convert-orders/preview')
  previewConvertOrders(@Body() dto: ConvertToOrdersDto) {
    return this.geoLoopService.previewConvertOrders(dto.brandId, dto.planIds);
  }

  @Post('dispatch/convert-orders')
  convertToOrders(@Body() dto: ConvertToOrdersDto) {
    return this.geoLoopService.convertToOrders(dto.brandId, dto.planIds);
  }

  // ============ 收录引导 · 内链列表 ============
  @Get('indexing/internal-links')
  getInternalLinks(@Query() query: InternalLinksQueryDto) {
    return this.geoLoopService.getInternalLinks(query.brandId);
  }

  // ============ 收录引导 · 自动生成内链 ============
  @Post('indexing/internal-links/generate')
  generateInternalLinks(@Body() dto: GenerateInternalLinksDto) {
    return this.geoLoopService.generateInternalLinks(dto.brandId);
  }

  // ============ 收录引导 · 新增内链 ============
  @Post('indexing/internal-links')
  createInternalLink(@Body() dto: CreateInternalLinkDto) {
    return this.geoLoopService.createInternalLink(dto);
  }

  // ============ 收录引导 · 更新内链状态 ============
  @Patch('indexing/internal-links/:id')
  updateInternalLinkStatus(
    @Param('id') id: string,
    @Body() dto: UpdateInternalLinkStatusDto,
  ) {
    return this.geoLoopService.updateInternalLinkStatus(id, dto.status);
  }

  // ============ 收录引导 · 外链概览 ============
  @Get('indexing/external-links/overview')
  getExternalLinkOverview(@Query() query: ExternalLinkOverviewQueryDto) {
    return this.geoLoopService.getExternalLinkOverview(query.brandId);
  }

  // ============ 收录引导 · 外链列表 ============
  @Get('indexing/external-links')
  getExternalLinks(@Query() query: ExternalLinksQueryDto) {
    return this.geoLoopService.getExternalLinks(query.brandId);
  }

  // ============ 收录引导 · 新增外链 ============
  @Post('indexing/external-links')
  createExternalLink(@Body() dto: CreateExternalLinkDto) {
    return this.geoLoopService.createExternalLink(dto);
  }

  // ============ 收录引导 · 更新外链状态 ============
  @Patch('indexing/external-links/:id')
  updateExternalLinkStatus(
    @Param('id') id: string,
    @Body() dto: UpdateExternalLinkStatusDto,
  ) {
    return this.geoLoopService.updateExternalLinkStatus(id, dto.status);
  }

  // ============ 收录引导 · 页面体检 ============
  @Get('indexing/page-checks')
  getPageChecks(@Query() query: PageChecksQueryDto) {
    return this.geoLoopService.getPageChecks(query.brandId);
  }

  @Post('indexing/page-checks')
  createPageCheck(@Body() dto: CreatePageCheckDto) {
    return this.geoLoopService.createPageCheck(dto);
  }

  // ============ 收录引导 · 收录提交 ============
  @Get('indexing/index-checks')
  getIndexChecks(@Query() query: IndexChecksQueryDto) {
    return this.geoLoopService.getIndexChecks(query.brandId);
  }

  @Post('indexing/index-checks')
  createIndexCheck(@Body() dto: CreateIndexCheckDto) {
    return this.geoLoopService.createIndexCheck(
      dto.brandId,
      dto.url,
      dto.searchEngine,
    );
  }
}
