import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  Param,
  Req,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';

import { NeedGeoLogin, GeoRoles } from '../auth/auth.decorator';
import { DiagnosisService } from './diagnosis.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  CreateDiagnosisTaskDto,
  GenerateQuestionsDto,
  GenerateQuestionScenariosDto,
  RunDiagnosisDto,
  DiagnosisTaskListQueryDto,
  DiagnosisReportListQueryDto,
  CompetitorCompareRequestDto,
} from './dto/diagnosis.dto';
import type { UserRole } from '@shared/api.interface';

@Controller('api/diagnosis')
@NeedGeoLogin()
export class DiagnosisController {
  constructor(
    private readonly diagnosisService: DiagnosisService,
    private readonly auditLogService: AuditLogService,
  ) {}

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
  ): string | undefined {
    if (user.role === 'client' && user.brandId) {
      return user.brandId;
    }
    return dtoBrandId;
  }

  // ---------- 生成问题 ----------

  @Post('generate-questions')
  @GeoRoles(['admin', 'operator', 'client'])
  async generateQuestions(@Body() dto: GenerateQuestionsDto, @Req() req: Request) {
    const user = this.getGeoUser(req);
    const brandId = dto.brandId ?? user.brandId ?? undefined;
    const questions = await this.diagnosisService.generateQuestions(
      dto.brandName,
      dto.city,
      dto.category,
      user,
      brandId ?? undefined,
    );
    return { questions };
  }

  @Post('generate-question-scenarios')
  @GeoRoles(['admin', 'operator', 'client'])
  async generateQuestionScenarios(
    @Body() dto: GenerateQuestionScenariosDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = dto.brandId ?? user.brandId ?? undefined;
    const scenarios = await this.diagnosisService.generateQuestionScenarios(
      dto.productName,
      dto.brandName,
      dto.city,
      dto.category,
      user,
      brandId ?? undefined,
    );
    return { scenarios };
  }

  @Get('recommend-quota')
  @GeoRoles(['admin', 'operator', 'client'])
  async getRecommendQuota(
    @Query('brandId') brandIdQuery: string | undefined,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = user.role === 'client' && user.brandId
      ? user.brandId
      : brandIdQuery;
    if (!brandId) {
      // 没有品牌上下文时返回默认配额
      return { used: 0, limit: 20, remaining: 20 };
    }
    return this.diagnosisService.getRecommendQuota(user, brandId);
  }

  @Get('credit-info')
  @GeoRoles(['admin', 'operator', 'client'])
  async getCreditInfo(
    @Query('brandId') brandIdQuery: string | undefined,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = user.role === 'client' && user.brandId
      ? user.brandId
      : brandIdQuery;
    if (!brandId) {
      return { balance: 0, unitPricePerQuery: 1, planName: '未开通' };
    }
    return this.diagnosisService.getCreditInfo(user, brandId);
  }

  // ---------- 诊断任务 ----------

  @Post('tasks')
  @GeoRoles(['admin', 'operator', 'client'])
  async createTask(
    @Body() dto: CreateDiagnosisTaskDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveWriteBrandId(dto.brandId, user);
    const result = this.diagnosisService.createTask(
      { ...dto, brandId: brandId ?? undefined },
      user,
    );
    this.auditLogService.log({
      action: 'diagnosis_task_create',
      actor: user.id,
      role: user.role,
      target: dto.brandName,
      detail: `创建品牌诊断任务：${dto.brandName}`,
      ip: this.getClientIp(req),
    });
    return result;
  }

  @Post('tasks/:id/run')
  @GeoRoles(['admin', 'operator', 'client'])
  async runDiagnosis(
    @Param('id') id: string,
    @Body() dto: RunDiagnosisDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.diagnosisService.runDiagnosis(id, dto.questions, user);
  }

  @Get('tasks')
  async listTasks(
    @Query() query: DiagnosisTaskListQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.diagnosisService.listTasks(query, user);
  }

  @Get('tasks/:id')
  async getTask(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const task = await this.diagnosisService.getTaskById(id, user);
    if (!task) {
      throw new NotFoundException('任务不存在');
    }
    return task;
  }

  @Delete('tasks/:id')
  @GeoRoles(['admin', 'operator', 'client'])
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTask(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    const user = this.getGeoUser(req);
    await this.diagnosisService.deleteTask(id, user);
  }

  @Post('tasks/:id/retry')
  @GeoRoles(['admin', 'operator', 'client'])
  async retryTask(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.diagnosisService.retryTask(id, user);
  }

  // ---------- 诊断报告 ----------

  @Get('reports')
  async listReports(
    @Query() query: DiagnosisReportListQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.diagnosisService.listReports(query, user);
  }

  @Get('reports/:id')
  async getReport(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.diagnosisService.getReportById(id, user);
  }

  @Post('reports/:id/share')
  async shareReport(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.diagnosisService.shareReport(id, user);
  }

  // ---------- 检测结果 ----------

  @Get('results/:reportId')
  async getResults(
    @Param('reportId') reportId: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.diagnosisService.getResultsByReportId(reportId, user);
  }

  // ---------- 竞品对比 ----------

  @Post('competitor-compare')
  @GeoRoles(['admin', 'operator', 'client'])
  async competitorCompare(
    @Body() dto: CompetitorCompareRequestDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.diagnosisService.competitorCompare(dto, user);
  }

  private getClientIp(req: Request): string | undefined {
    const forwarded = req.headers['x-forwarded-for'] as string | string[] | undefined;
    if (forwarded) {
      return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
    }
    return req.ip;
  }
}
