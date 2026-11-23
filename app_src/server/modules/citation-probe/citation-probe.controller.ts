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

import { NeedGeoLogin, GeoRoles } from '../auth/auth.decorator';
import { CitationProbeService } from './citation-probe.service';
import {
  CitationProbeKeywordListQueryDto,
  GenerateQuestionsDto,
  CreateCitationProbeTaskDto,
  CitationProbeTaskListQueryDto,
  CitationProbeResultListQueryDto,
  CreateManualSnapshotDto,
  CitationProbeKpiQueryDto,
  CitationProbePlatformDistributionQueryDto,
} from './dto/citation-probe.dto';
import type { UserRole } from '@shared/api.interface';

@Controller('api/citation-probe')
@NeedGeoLogin()
export class CitationProbeController {
  constructor(private readonly citationProbeService: CitationProbeService) {}

  private getGeoUser(req: Request): { id: string; role: UserRole; brandId: string | null } {
    const user = (req as any).geoUser;
    return {
      id: user.id,
      role: user.role as UserRole,
      brandId: user.brandId ?? null,
    };
  }

  /**
   * client 角色强制使用自己的 brandId，admin/operator 保持 query/dto 原值。
   */
  private resolveBrandId(
    paramBrandId: string | undefined,
    user: { role: UserRole; brandId: string | null },
  ): string | undefined {
    if (user.role === 'client' && user.brandId) {
      return user.brandId;
    }
    return paramBrandId;
  }

  // ---------- 关键词列表 ----------

  @Get('platforms-status')
  @GeoRoles(['admin', 'operator', 'client'])
  async getPlatformsStatus() {
    return this.citationProbeService.getPlatformsStatus();
  }

  @Get('keywords')
  @GeoRoles(['admin', 'operator', 'client'])
  async getKeywords(
    @Query() query: CitationProbeKeywordListQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveBrandId(query.brandId, user);
    if (!brandId) {
      return { items: [] };
    }
    return this.citationProbeService.getKeywordList(brandId);
  }

  // ---------- 生成提问模板 ----------

  @Post('generate-questions')
  @GeoRoles(['admin', 'operator', 'client'])
  async generateQuestions(@Body() dto: GenerateQuestionsDto) {
    return this.citationProbeService.generateQuestions(dto.keywords, dto.count);
  }

  // ---------- 创建任务 ----------

  @Post('tasks')
  @GeoRoles(['admin', 'operator', 'client'])
  async createTask(
    @Body() dto: CreateCitationProbeTaskDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveBrandId(dto.brandId, user);
    return this.citationProbeService.createTask(
      { ...dto, brandId: brandId ?? dto.brandId },
      user,
    );
  }

  // ---------- 任务列表 ----------

  @Get('tasks')
  async listTasks(
    @Query() query: CitationProbeTaskListQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.citationProbeService.listTasks(query, user);
  }

  // ---------- 结果列表 ----------

  @Get('results')
  async listResults(
    @Query() query: CitationProbeResultListQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.citationProbeService.listResults(query, user);
  }

  // ---------- 立即执行（单条结果）----------

  @Post('results/:id/execute')
  @GeoRoles(['admin', 'operator', 'client'])
  async executeResult(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.citationProbeService.executeResult(id, user);
  }

  // ---------- 手工快照录入 ----------

  @Post('results/manual')
  @GeoRoles(['admin', 'operator', 'client'])
  async createManualSnapshot(
    @Body() dto: CreateManualSnapshotDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveBrandId(dto.brandId, user);
    return this.citationProbeService.createManualSnapshot(
      { ...dto, brandId: brandId ?? dto.brandId },
      user,
    );
  }

  // ---------- KPI 统计 ----------

  @Get('kpi')
  async getKpi(
    @Query() query: CitationProbeKpiQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.citationProbeService.getKpi(query, user);
  }

  // ---------- 平台提及分布 ----------

  @Get('platform-distribution')
  async getPlatformDistribution(
    @Query() query: CitationProbePlatformDistributionQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.citationProbeService.getPlatformDistribution(query, user);
  }

  // ---------- 删除结果 ----------

  @Delete('results/:id')
  @GeoRoles(['admin', 'operator', 'client'])
  async deleteResult(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.citationProbeService.deleteResult(id, user);
  }
}
