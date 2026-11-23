import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Query,
  Param,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';

import { CreationService } from './creation.service';
import { NeedGeoLogin, GeoRoles } from '../auth/auth.decorator';
import {
  OverviewQueryDto,
  RecentQueryDto,
  CreationGenerateArticleDto,
  CreationArticleListQueryDto,
  CreationUpdateArticleDto,
  CreationGenerateImageDto,
  CreationImageListQueryDto,
  CreationImageBatchDeleteDto,
  CreationImagePublicationDto,
  CreationGenerateVideoDto,
  CreationVideoListQueryDto,
  CreationVideoPublicationDto,
  CreationUpdateVideoDto,
  CreationTaskListQueryDto,
  CreatePublicationDto,
  PublicationListQueryDto,
  UpdatePublicationDto,
  CreateCreditPlanDto,
  UpdateCreditPlanDto,
  RechargeCreditDto,
  ActivatePlanDto,
  CreditAccountListQueryDto,
  CreditTransactionQueryDto,
  UsageBreakdownQueryDto,
  UnifiedKeywordGroupsQueryDto,
  UnifiedKeywordsQueryDto,
  UnifiedGenerateCopyDto,
  UnifiedSplitImagePromptsDto,
  UnifiedCreateImageTaskDto,
  UnifiedCreateVideoTaskDto,
  UnifiedTaskListQueryDto,
} from './dto/creation.dto';
import type { UserRole } from '@shared/api.interface';

interface GeoUserCtx {
  id: string;
  role: UserRole;
  brandId: string | null;
}

@Controller('api/creation')
@NeedGeoLogin()
export class CreationController {
  constructor(private readonly creationService: CreationService) {}

  private getGeoUser(req: Request): GeoUserCtx {
    const ctx = (req as any).geoUser as
      | { id: string; role: UserRole; brandId: string | null }
      | undefined;
    if (!ctx) {
      throw new Error('geoUser not found in request');
    }
    return {
      id: ctx.id,
      role: ctx.role,
      brandId: ctx.brandId,
    };
  }

  /**
   * client 角色强制使用自己的 brandId，admin/operator 保持 dto/query 原值。
   */
  private resolveWriteBrandId(
    dtoBrandId: string | undefined | null,
    user: GeoUserCtx,
  ): string | undefined {
    if (user.role === 'client' && user.brandId) {
      return user.brandId;
    }
    return dtoBrandId ?? undefined;
  }

  // ============================================================
  //  概览统计
  // ============================================================

  @Get('stats/overview')
  async getOverviewStats(@Query() query: OverviewQueryDto, @Req() req: Request) {
    const user = this.getGeoUser(req);
    return this.creationService.getOverviewStats(query, user);
  }

  // ============================================================
  //  最近生成列表
  // ============================================================

  @Get('recent')
  async getRecentGenerations(@Query() query: RecentQueryDto, @Req() req: Request) {
    const user = this.getGeoUser(req);
    return this.creationService.getRecentGenerations(query, user);
  }

  // ============================================================
  //  文章
  // ============================================================

  @Get('articles')
  async listArticles(@Query() query: CreationArticleListQueryDto, @Req() req: Request) {
    const user = this.getGeoUser(req);
    return this.creationService.listArticles(query, user);
  }

  @Get('articles/:id')
  async getArticle(@Param('id') id: string, @Req() req: Request) {
    const user = this.getGeoUser(req);
    return this.creationService.getArticle(id, user);
  }

  @Post('articles/generate')
  @GeoRoles(['admin', 'operator', 'client'])
  async generateArticles(
    @Body() dto: CreationGenerateArticleDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveWriteBrandId(dto.brandId, user);
    return this.creationService.generateArticles(
      { ...dto, brandId: brandId ?? undefined },
      user,
    );
  }

  @Patch('articles/:id')
  @GeoRoles(['admin', 'operator', 'client'])
  async updateArticle(
    @Param('id') id: string,
    @Body() dto: CreationUpdateArticleDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.creationService.updateArticle(id, dto, user);
  }

  @Delete('articles/:id')
  @GeoRoles(['admin', 'operator', 'client'])
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteArticle(@Param('id') id: string, @Req() req: Request): Promise<void> {
    const user = this.getGeoUser(req);
    await this.creationService.deleteArticle(id, user);
  }

  // ============================================================
  //  图片
  // ============================================================

  @Get('images')
  async listImages(@Query() query: CreationImageListQueryDto, @Req() req: Request) {
    const user = this.getGeoUser(req);
    return this.creationService.listImages(query, user);
  }

  @Post('images/generate')
  @GeoRoles(['admin', 'operator', 'client'])
  async generateImages(
    @Body() dto: CreationGenerateImageDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveWriteBrandId(dto.brandId, user);
    return this.creationService.generateImages(
      { ...dto, brandId: brandId ?? undefined },
      user,
    );
  }

  @Post('images/batch-delete')
  @GeoRoles(['admin', 'operator', 'client'])
  @HttpCode(HttpStatus.OK)
  async batchDeleteImages(
    @Body() dto: CreationImageBatchDeleteDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.creationService.batchDeleteImages(dto, user);
  }

  @Post('images/:id/retry')
  @GeoRoles(['admin', 'operator', 'client'])
  async retryImage(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.creationService.retryImage(id, user);
  }

  @Post('images/:id/publication')
  @GeoRoles(['admin', 'operator', 'client'])
  async createImagePublication(
    @Param('id') id: string,
    @Body() dto: CreationImagePublicationDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.creationService.createImagePublication(id, dto, user);
  }

  @Delete('images/:id')
  @GeoRoles(['admin', 'operator', 'client'])
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteImage(@Param('id') id: string, @Req() req: Request): Promise<void> {
    const user = this.getGeoUser(req);
    await this.creationService.deleteImage(id, user);
  }

  // ============================================================
  //  视频
  // ============================================================

  @Get('videos')
  async listVideos(@Query() query: CreationVideoListQueryDto, @Req() req: Request) {
    const user = this.getGeoUser(req);
    return this.creationService.listVideos(query, user);
  }

  @Get('videos/import-article/:articleId')
  async importArticleScript(
    @Param('articleId') articleId: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.creationService.importArticleScript(articleId, user);
  }

  @Post('videos/generate')
  @GeoRoles(['admin', 'operator', 'client'])
  async generateVideo(
    @Body() dto: CreationGenerateVideoDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveWriteBrandId(dto.brandId, user);
    return this.creationService.generateVideo(
      { ...dto, brandId: brandId ?? undefined },
      user,
    );
  }

  @Get('videos/:id')
  async getVideo(@Param('id') id: string, @Req() req: Request) {
    const user = this.getGeoUser(req);
    return this.creationService.getVideo(id, user);
  }

  @Post('videos/:id/retry')
  @GeoRoles(['admin', 'operator', 'client'])
  async retryVideo(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.creationService.retryVideo(id, user);
  }

  @Post('videos/:id/publication')
  @GeoRoles(['admin', 'operator', 'client'])
  async createVideoPublication(
    @Param('id') id: string,
    @Body() dto: CreationVideoPublicationDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.creationService.createVideoPublication(id, dto, user);
  }

  @Patch('videos/:id')
  @GeoRoles(['admin', 'operator', 'client'])
  async updateVideo(
    @Param('id') id: string,
    @Body() dto: CreationUpdateVideoDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.creationService.updateVideo(id, dto, user);
  }

  @Delete('videos/:id')
  @GeoRoles(['admin', 'operator', 'client'])
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteVideo(@Param('id') id: string, @Req() req: Request): Promise<void> {
    const user = this.getGeoUser(req);
    await this.creationService.deleteVideo(id, user);
  }

  // ============================================================
  //  任务队列
  // ============================================================

  @Get('tasks')
  async listTasks(@Query() query: CreationTaskListQueryDto, @Req() req: Request) {
    const user = this.getGeoUser(req);
    return this.creationService.listTasks(query, user);
  }

  // ============================================================
  //  算力套餐管理（管理员）
  // ============================================================

  @Get('credit/plans')
  async listCreditPlans(@Req() req: Request) {
    const user = this.getGeoUser(req);
    // admin/operator 看全部（含停用），client 只看启用的
    if (user.role === 'admin' || user.role === 'operator') {
      return this.creationService.listAllPlans(user);
    }
    return this.creationService.listPlans(user);
  }

  @Post('credit/plans')
  @GeoRoles(['admin'])
  async createCreditPlan(@Body() dto: CreateCreditPlanDto, @Req() req: Request) {
    const user = this.getGeoUser(req);
    return this.creationService.createPlan(dto, user);
  }

  @Put('credit/plans/:id')
  @GeoRoles(['admin'])
  async updateCreditPlan(
    @Param('id') id: string,
    @Body() dto: UpdateCreditPlanDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.creationService.updatePlan(id, dto, user);
  }

  @Delete('credit/plans/:id')
  @GeoRoles(['admin'])
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCreditPlan(@Param('id') id: string, @Req() req: Request): Promise<void> {
    const user = this.getGeoUser(req);
    await this.creationService.deletePlan(id, user);
  }

  // ============================================================
  //  算力账户列表（管理员）
  // ============================================================

  @Get('credit/accounts')
  async listCreditAccounts(
    @Query() query: CreditAccountListQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.creationService.listCreditAccounts(query, user);
  }

  // ============================================================
  //  算力充值 / 套餐激活（管理员）
  // ============================================================

  @Post('credit/recharge')
  @GeoRoles(['admin'])
  async rechargeCredit(@Body() dto: RechargeCreditDto, @Req() req: Request) {
    const user = this.getGeoUser(req);
    await this.creationService.rechargeCredit(dto, user);
    return { success: true };
  }

  @Post('credit/activate-plan')
  @GeoRoles(['admin'])
  async activatePlan(@Body() dto: ActivatePlanDto, @Req() req: Request) {
    const user = this.getGeoUser(req);
    await this.creationService.activatePlan(dto, user);
    return { success: true };
  }

  // ============================================================
  //  我的算力账户 / 流水 / 使用明细
  // ============================================================

  @Get('credit/account')
  async getCreditAccount(
    @Query('brandId') brandId: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.creationService.getCreditAccountDetail(brandId, user);
  }

  @Get('credit/transactions')
  async listCreditTransactions(
    @Query() query: CreditTransactionQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.creationService.listTransactions(query, user);
  }

  @Get('credit/usage-breakdown')
  async getUsageBreakdown(
    @Query() query: UsageBreakdownQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.creationService.getUsageBreakdown(query, user);
  }

  // ============================================================
  //  发布记录
  // ============================================================

  @Get('publications')
  async listPublications(@Query() query: PublicationListQueryDto, @Req() req: Request) {
    const user = this.getGeoUser(req);
    return this.creationService.listPublications(query, user);
  }

  @Post('publications')
  @GeoRoles(['admin', 'operator', 'client'])
  async createPublication(
    @Body() dto: CreatePublicationDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveWriteBrandId(dto.brandId, user);
    return this.creationService.createPublication(
      { ...dto, brandId: brandId ?? undefined },
      user,
    );
  }

  @Patch('publications/:id')
  @GeoRoles(['admin', 'operator', 'client'])
  async updatePublication(
    @Param('id') id: string,
    @Body() dto: UpdatePublicationDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.creationService.updatePublication(id, dto, user);
  }

  @Delete('publications/:id')
  @GeoRoles(['admin', 'operator', 'client'])
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePublication(@Param('id') id: string, @Req() req: Request): Promise<void> {
    const user = this.getGeoUser(req);
    await this.creationService.deletePublication(id, user);
  }

  // ============================================================
  //  统一创作（图文/视频）新接口
  // ============================================================

  // 1. 关键词分组列表
  @Get('unified/keyword-groups')
  async getUnifiedKeywordGroups(
    @Query() query: UnifiedKeywordGroupsQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.creationService.getUnifiedKeywordGroups(query.brandId, user);
  }

  // 2. 关键词列表
  @Get('unified/keywords')
  async getUnifiedKeywords(
    @Query() query: UnifiedKeywordsQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.creationService.getUnifiedKeywords(
      query.groupId,
      query.type,
      query.search,
      user,
    );
  }

  // 3. AI 生成文案
  @Post('unified/generate-copy')
  @GeoRoles(['admin', 'operator', 'client'])
  async generateUnifiedCopy(
    @Body() dto: UnifiedGenerateCopyDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveWriteBrandId(dto.brandId, user);
    return this.creationService.generateUnifiedCopy(
      { ...dto, brandId: brandId ?? undefined },
      user,
    );
  }

  // 4. 拆分图片提示词
  @Post('unified/split-image-prompts')
  @GeoRoles(['admin', 'operator', 'client'])
  async splitImagePrompts(
    @Body() dto: UnifiedSplitImagePromptsDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.creationService.splitImagePrompts(dto, user);
  }

  // 5. 提交图文任务
  @Post('unified/image')
  @GeoRoles(['admin', 'operator', 'client'])
  async createUnifiedImageTask(
    @Body() dto: UnifiedCreateImageTaskDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveWriteBrandId(dto.brandId, user);
    return this.creationService.createUnifiedImageTask(
      { ...dto, brandId: brandId ?? undefined },
      user,
    );
  }

  // 6. 提交视频任务
  @Post('unified/video')
  @GeoRoles(['admin', 'operator', 'client'])
  async createUnifiedVideoTask(
    @Body() dto: UnifiedCreateVideoTaskDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveWriteBrandId(dto.brandId, user);
    return this.creationService.createUnifiedVideoTask(
      { ...dto, brandId: brandId ?? undefined },
      user,
    );
  }

  // 7. 任务列表
  @Get('unified/tasks')
  async listUnifiedTasks(
    @Query() query: UnifiedTaskListQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.creationService.listUnifiedTasks(query, user);
  }

  // 8. 任务详情
  @Get('unified/tasks/:id')
  async getUnifiedTaskDetail(@Param('id') id: string, @Req() req: Request) {
    const user = this.getGeoUser(req);
    return this.creationService.getUnifiedTaskDetail(id, user);
  }

  // 9. 删除任务
  @Delete('unified/tasks/:id')
  @GeoRoles(['admin', 'operator', 'client'])
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUnifiedTask(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    const user = this.getGeoUser(req);
    await this.creationService.deleteUnifiedTask(id, user);
  }

  // 10. 重试任务
  @Post('unified/tasks/:id/retry')
  @GeoRoles(['admin', 'operator', 'client'])
  async retryUnifiedTask(@Param('id') id: string, @Req() req: Request) {
    const user = this.getGeoUser(req);
    return this.creationService.retryUnifiedTask(id, user);
  }

  // 11. 轮询视频任务状态
  @Post('unified/tasks/:id/poll')
  @GeoRoles(['admin', 'operator', 'client'])
  async pollUnifiedVideoTask(@Param('id') id: string, @Req() req: Request) {
    const user = this.getGeoUser(req);
    return this.creationService.pollUnifiedVideoTask(id, user);
  }
}
