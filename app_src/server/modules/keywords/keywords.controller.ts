import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Query,
  Param,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { NeedGeoLogin, GeoRoles } from '../auth/auth.decorator';
import { KeywordsService } from './keywords.service';
import {
  KeywordListQueryDto,
  CreateKeywordDto,
  BatchImportKeywordDto,
  CreateTasksDto,
  TaskListQueryDto,
  ReportListQueryDto,
  LongtailConfigQueryDto,
  SaveLongtailConfigDto,
  LongtailCombinePreviewDto,
  LongtailCombineDto,
  BatchAddKeywordsPoolDto,
  ToggleCoreDto,
  SetParentDto,
} from './dto/keywords.dto';
import type { UserRole } from '@shared/api.interface';

@Controller('api/keywords')
@NeedGeoLogin()
export class KeywordsController {
  constructor(private readonly keywordsService: KeywordsService) {}

  private getGeoUser(req: Request): { id: string; role: UserRole; brandId: string | null } {
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

  // ---------- 词库 ----------

  @Get()
  async listKeywords(
    @Query() query: KeywordListQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.keywordsService.listKeywords(query, user);
  }

  @Post()
  @GeoRoles(['admin', 'operator', 'client'])
  async createKeyword(
    @Body() dto: CreateKeywordDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveWriteBrandId(dto.brandId, user);
    return this.keywordsService.createKeyword({ ...dto, brandId }, user);
  }

  @Post('batch')
  @GeoRoles(['admin', 'operator', 'client'])
  async batchImport(
    @Body() dto: BatchImportKeywordDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveWriteBrandId(dto.brandId, user);
    return this.keywordsService.batchImport({ ...dto, brandId }, user);
  }

  @Delete(':id')
  @GeoRoles(['admin', 'operator', 'client'])
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteKeyword(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    const user = this.getGeoUser(req);
    await this.keywordsService.deleteKeyword(id, user);
  }

  @Post(':id/toggle-core')
  @GeoRoles(['admin', 'operator', 'client'])
  async toggleCoreKeyword(
    @Param('id') id: string,
    @Body() dto: ToggleCoreDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.keywordsService.toggleCoreKeyword(id, dto.isCore, user);
  }

  @Post(':id/set-parent')
  @GeoRoles(['admin', 'operator', 'client'])
  async setParentKeyword(
    @Param('id') id: string,
    @Body() dto: SetParentDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.keywordsService.setParentKeyword(
      id,
      dto.parentKeywordId ?? null,
      user,
    );
  }

  // ---------- 检测任务 ----------

  @Post('tasks/batch')
  @GeoRoles(['admin', 'operator', 'client'])
  async createTasks(
    @Body() dto: CreateTasksDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.keywordsService.createTasks(dto, user);
  }

  @Get('tasks')
  async listTasks(
    @Query() query: TaskListQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.keywordsService.listTasks(query, user);
  }

  // ---------- 报表 ----------

  @Get('results')
  async listResults(
    @Query() query: ReportListQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.keywordsService.listResults(query, user);
  }

  @Get('results/stats')
  async getResultsStats(
    @Query() query: ReportListQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.keywordsService.getResultsStats(query, user);
  }

  @Get('results/export')
  async exportReports(
    @Query() query: ReportListQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const user = this.getGeoUser(req);
    const csv = await this.keywordsService.exportResultsCsv(query, user);

    const filename = encodeURIComponent(`关键词报表_${Date.now()}.csv`);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);
    // 添加 BOM 以便 Excel 正确识别 UTF-8
    res.send('\uFEFF' + csv);
  }

  // ---------- 首页统计 ----------

  @Get('stats')
  async getStats(@Req() req: Request) {
    const user = this.getGeoUser(req);
    return this.keywordsService.getStats(user);
  }

  // ---------- 长尾词组合配置 ----------

  @Get('longtail/config')
  @GeoRoles(['admin', 'operator', 'client'])
  async getLongtailConfig(
    @Query() query: LongtailConfigQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.keywordsService.getLongtailConfig(query, user);
  }

  @Put('longtail/config')
  @GeoRoles(['admin', 'operator', 'client'])
  async saveLongtailConfig(
    @Body() dto: SaveLongtailConfigDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveWriteBrandId(dto.brandId, user);
    return this.keywordsService.saveLongtailConfig({ ...dto, brandId }, user);
  }

  @Post('longtail/preview')
  @GeoRoles(['admin', 'operator', 'client'])
  async previewLongtailCombine(@Body() dto: LongtailCombinePreviewDto) {
    return this.keywordsService.previewLongtailCombine(dto);
  }

  @Post('longtail/combine')
  @GeoRoles(['admin', 'operator', 'client'])
  async combineLongtail(
    @Body() dto: LongtailCombineDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.keywordsService.combineLongtail(dto, user);
  }

  @Post('longtail/batch-add')
  @GeoRoles(['admin', 'operator', 'client'])
  async batchAddKeywordsPool(
    @Body() dto: BatchAddKeywordsPoolDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveWriteBrandId(dto.brandId, user);
    return this.keywordsService.batchAddKeywordsPool({ ...dto, brandId }, user);
  }
}
