import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Query,
  Param,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { NeedGeoLogin, GeoRoles } from '../auth/auth.decorator';
import { SubmissionChannelsService } from './submission-channels.service';
import {
  SubmissionChannelQueryDto,
  CreateSubmissionChannelDto,
  UpdateSubmissionChannelDto,
  UpdateSubmitUrlDto,
  SeedSubmissionChannelsDto,
  EliminationBatchDto,
  BatchTagDto,
  BatchSheetQueryDto,
  AutoSelectDto,
  BatchUrlPatchDto,
  UpdateChannelPriceDto,
  BulkChannelPriceDto,
} from './dto/submission-channels.dto';
import type { UserRole } from '@shared/api.interface';

@Controller('api/submission-channels')
@NeedGeoLogin()
export class SubmissionChannelsController {
  constructor(private readonly submissionChannelsService: SubmissionChannelsService) {}

  private getGeoUser(req: Request): { id: string; role: UserRole; brandId: string | null; username: string; displayName: string | null } {
    const user = (req as unknown as { geoUser: { id: string; role: string; brandId?: string | null; username?: string; displayName?: string | null } }).geoUser;
    return {
      id: user.id,
      role: user.role as UserRole,
      brandId: user.brandId ?? null,
      username: user.username ?? '',
      displayName: user.displayName ?? null,
    };
  }

  /**
   * client 角色强制使用自己的 brandId，admin/operator 保持 dto/query 原值。
   */
  private resolveBrandId(
    dtoBrandId: string | undefined,
    user: { role: UserRole; brandId: string | null },
  ): string {
    if (user.role === 'client' && user.brandId) {
      return user.brandId;
    }
    return dtoBrandId ?? '';
  }

  // ---------- 列表 ----------

  @Get()
  async list(
    @Query() query: SubmissionChannelQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.submissionChannelsService.list(query, user);
  }

  // ---------- 详情 ----------

  @Get(':id')
  async getById(@Param('id') id: string, @Req() req: Request) {
    const user = this.getGeoUser(req);
    return this.submissionChannelsService.getById(id, user);
  }

  // ---------- 新增 ----------

  @Post()
  @GeoRoles(['admin', 'operator', 'client'])
  async create(
    @Body() dto: CreateSubmissionChannelDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveBrandId(dto.brandId, user);
    return this.submissionChannelsService.create({ ...dto, brandId }, user);
  }

  // ---------- 一键恢复预置渠道（静态路由必须在动态路由 :id 之前） ----------

  @Post('seed')
  @GeoRoles(['admin', 'operator', 'client'])
  async seed(
    @Body() dto: SeedSubmissionChannelsDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveBrandId(dto.brandId, user);
    return this.submissionChannelsService.seed(brandId, user);
  }

  // ---------- 统计（按类型分组） ----------

  @Get('stats')
  async stats(
    @Query() query: SubmissionChannelQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.submissionChannelsService.stats(query, user);
  }

  // ---------- 月度淘汰扫描（静态路由在动态 :id 之前） ----------

  @Get('elimination/scan')
  @GeoRoles(['admin', 'operator'])
  async eliminationScan(
    @Query() query: SubmissionChannelQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.submissionChannelsService.eliminationScan(query, user);
  }

  @Post('elimination/batch')
  @GeoRoles(['admin', 'operator'])
  async eliminationBatch(
    @Body() dto: EliminationBatchDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.submissionChannelsService.eliminationBatch(dto, user);
  }

  // ---------- 批量导入：预览 ----------

  @Post('import/preview')
  @GeoRoles(['admin', 'operator', 'client'])
  async importPreview(
    @Body() body: { csvContent: string; brandId?: string },
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveBrandId(body.brandId, user);
    return this.submissionChannelsService.importPreview(
      brandId,
      body.csvContent,
      user,
    );
  }

  // ---------- 批量导入：确认 ----------

  @Post('import/confirm')
  @GeoRoles(['admin', 'operator', 'client'])
  async importConfirm(
    @Body() body: { csvContent: string; brandId?: string; importToken?: string },
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveBrandId(body.brandId, user);
    return this.submissionChannelsService.importConfirm(
      brandId,
      body.importToken ?? '',
      body.csvContent,
      user,
    );
  }

  // ---------- 批量打 AI 信源标签 ----------

  @Patch('batch-tags')
  @GeoRoles(['admin', 'operator', 'client'])
  async batchUpdateTags(
    @Body() dto: BatchTagDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.submissionChannelsService.batchUpdateTags(dto, user);
  }

  // ---------- 打标签操作日志 ----------

  @Get('tag-logs')
  @GeoRoles(['admin', 'operator', 'client'])
  async listTagLogs(
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.submissionChannelsService.listTagLogs(user);
  }

  // ---------- 批次清单 ----------

  @Get('batch-sheet')
  @GeoRoles(['admin', 'operator', 'client'])
  async getBatchSheet(
    @Query() query: BatchSheetQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const baseQuery = query as BatchSheetQueryDto & { brandId?: string };
    const enrichedQuery = {
      ...baseQuery,
      brandId: user.role === 'client' ? user.brandId ?? undefined : baseQuery.brandId,
    };
    return this.submissionChannelsService.getBatchSheet(enrichedQuery, user);
  }

  @Get('batch-sheet/export')
  @GeoRoles(['admin', 'operator', 'client'])
  async exportBatchSheet(
    @Query() query: BatchSheetQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const user = this.getGeoUser(req);
    const baseQuery = query as BatchSheetQueryDto & { brandId?: string };
    const enrichedQuery = {
      ...baseQuery,
      brandId: user.role === 'client' ? user.brandId ?? undefined : baseQuery.brandId,
    };
    const result = await this.submissionChannelsService.getBatchSheet(enrichedQuery, user);

    const header = '地区,行业,渠道总数,已打标,未打标';
    const lines = result.items.map((g) =>
      `"${g.region}","${g.industry}",${g.totalCount},${g.taggedCount},${g.untaggedCount}`,
    );
    const csv = '\ufeff' + [header, ...lines].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="batch-sheet.csv"');
    res.send(csv);
  }

  // ---------- 自动选源 ----------

  @Post('auto-select')
  @GeoRoles(['admin', 'operator', 'client'])
  async autoSelect(
    @Body() dto: AutoSelectDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const enrichedDto = {
      ...dto,
      brandId: this.resolveBrandId(dto.brandId, user),
    };
    return this.submissionChannelsService.autoSelectChannels(enrichedDto, user);
  }

  // ---------- 更新 ----------

  @Patch(':id')
  @GeoRoles(['admin', 'operator', 'client'])
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSubmissionChannelDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.submissionChannelsService.update(id, dto, user);
  }

  // ---------- 更新投稿地址 ----------

  @Patch(':id/submit-url')
  @GeoRoles(['admin', 'operator', 'client'])
  async updateSubmitUrl(
    @Param('id') id: string,
    @Body() dto: UpdateSubmitUrlDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.submissionChannelsService.updateSubmitUrl(id, dto.submitUrl, user);
  }

  // ---------- 删除 ----------

  @Delete(':id')
  @GeoRoles(['admin', 'operator', 'client'])
  async remove(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.submissionChannelsService.remove(id, user);
  }

  // ---------- 单条调价 ----------

  @Patch(':id/price')
  @GeoRoles(['admin'])
  async updatePrice(
    @Param('id') id: string,
    @Body() dto: UpdateChannelPriceDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.submissionChannelsService.updatePrice(
      id,
      dto.salePriceCents,
      user,
    );
  }

  // ---------- 批量调价 ----------

  @Post('bulk-price')
  @GeoRoles(['admin'])
  async bulkUpdatePrice(
    @Body() dto: BulkChannelPriceDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.submissionChannelsService.bulkUpdatePrice(dto, user);
  }

  // ---------- URL 统计 ----------

  @Get('url-stats')
  @GeoRoles(['admin', 'operator', 'client'])
  async getUrlStats(
    @Query() query: SubmissionChannelQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.submissionChannelsService.getUrlStats(query, user);
  }

  // ---------- 批量补录 URL ----------

  @Post('batch-url-patch')
  @GeoRoles(['admin', 'operator', 'client'])
  async batchUrlPatch(
    @Body() dto: BatchUrlPatchDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.submissionChannelsService.batchUrlPatch(dto, user);
  }

  // ---------- URL 补录日志 ----------

  @Get('url-logs')
  @GeoRoles(['admin', 'operator', 'client'])
  async listUrlLogs(@Req() req: Request) {
    const user = this.getGeoUser(req);
    return this.submissionChannelsService.listUrlLogs(user);
  }

  // ---------- 域名映射表批量补录 URL ----------

  @Post('fill-urls-from-map')
  @GeoRoles(['admin', 'operator'])
  async fillUrlsFromMap(@Req() req: Request) {
    const user = this.getGeoUser(req);
    return this.submissionChannelsService.fillUrlsFromMap(user);
  }

  // ---------- 未匹配渠道清单导出 ----------

  @Get('unmatched-export')
  @GeoRoles(['admin', 'operator', 'client'])
  async exportUnmatched(
    @Query() query: SubmissionChannelQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const user = this.getGeoUser(req);
    const csv = await this.submissionChannelsService.exportUnmatchedCsv(query, user);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="unmatched-channels.csv"');
    res.send(csv);
  }
}
