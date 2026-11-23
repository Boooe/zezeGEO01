import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Query,
  Param,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';

import { NeedGeoLogin, GeoRoles } from '../auth/auth.decorator';
import { ContentService } from './content.service';
import {
  GenerateArticleDto,
  ArticleListQueryDto,
  UpdateArticleDto,
  CreateBatchDto,
  BatchListQueryDto,
  CreditTransactionQueryDto,
  GenerateImageDto,
  MaterialListQueryDto,
  CreateMaterialGroupDto,
  UpdateMaterialDto,
  BatchDeleteMaterialsDto,
  GenerateVideoScriptDto,
  CreateVideoTaskDto,
  VideoTaskListQueryDto,
  VideoServiceConfigDto,
  ImageServiceConfigDto,
} from './dto/content.dto';
import type { UserRole } from '@shared/api.interface';

@Controller('api/content')
@NeedGeoLogin()
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

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
    dtoBrandId: string | undefined | null,
    user: { role: UserRole; brandId: string | null },
  ): string | undefined {
    if (user.role === 'client' && user.brandId) {
      return user.brandId;
    }
    return dtoBrandId ?? undefined;
  }

  // ============================================================
  //  文章生成
  // ============================================================

  @Post('articles/generate')
  @GeoRoles(['admin', 'operator', 'client'])
  async generateArticles(
    @Body() dto: GenerateArticleDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveWriteBrandId(dto.brandId, user);
    return this.contentService.generateArticles(
      { ...dto, brandId: brandId ?? undefined },
      user,
    );
  }

  @Get('articles')
  async listArticles(
    @Query() query: ArticleListQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.contentService.listArticles(query, user);
  }

  @Get('articles/:id')
  async getArticle(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.contentService.getArticleDetail(id, user);
  }

  @Patch('articles/:id')
  @GeoRoles(['admin', 'operator', 'client'])
  async updateArticle(
    @Param('id') id: string,
    @Body() dto: UpdateArticleDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.contentService.updateArticle(id, dto, user);
  }

  @Delete('articles/:id')
  @GeoRoles(['admin', 'operator', 'client'])
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteArticle(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    const user = this.getGeoUser(req);
    await this.contentService.deleteArticle(id, user);
  }

  @Post('articles/:id/publish')
  @GeoRoles(['admin', 'operator', 'client'])
  async publishArticle(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.contentService.publishArticle(id, user);
  }

  // ============================================================
  //  批量任务
  // ============================================================

  @Post('batches')
  @GeoRoles(['admin', 'operator', 'client'])
  async createBatch(
    @Body() dto: CreateBatchDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveWriteBrandId(dto.brandId, user);
    return this.contentService.createBatch(
      { ...dto, brandId: brandId ?? undefined },
      user,
    );
  }

  @Get('batches')
  async listBatches(
    @Query() query: BatchListQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.contentService.listBatches(query, user);
  }

  @Get('batches/:id')
  async getBatch(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.contentService.getBatchDetail(id, user);
  }

  // ============================================================
  //  算力账户
  // ============================================================

  @Get('credit/account')
  async getCreditAccount(
    @Query('brandId') brandId: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.contentService.getCreditAccount(brandId, user);
  }

  @Get('credit/transactions')
  async listCreditTransactions(
    @Query() query: CreditTransactionQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.contentService.listCreditTransactions(query, user);
  }

  // ============================================================
  //  图片生成
  // ============================================================

  @Post('images/generate')
  @GeoRoles(['admin', 'operator', 'client'])
  async generateImage(
    @Body() dto: GenerateImageDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveWriteBrandId(dto.brandId, user);
    return this.contentService.generateImage(
      { ...dto, brandId: brandId ?? undefined },
      user,
    );
  }

  // ============================================================
  //  素材库
  // ============================================================

  @Get('materials')
  async listMaterials(
    @Query() query: MaterialListQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.contentService.listMaterials(query, user);
  }

  @Get('material-groups')
  async listMaterialGroups(
    @Query('brandId') brandId: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.contentService.listMaterialGroups(brandId, user);
  }

  @Post('material-groups')
  @GeoRoles(['admin', 'operator', 'client'])
  async createMaterialGroup(
    @Body() dto: CreateMaterialGroupDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveWriteBrandId(dto.brandId, user);
    return this.contentService.createMaterialGroup(
      { ...dto, brandId: brandId ?? undefined },
      user,
    );
  }

  @Delete('materials/:id')
  @GeoRoles(['admin', 'operator', 'client'])
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMaterial(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    const user = this.getGeoUser(req);
    await this.contentService.deleteMaterial(id, user);
  }

  @Patch('materials/:id')
  @GeoRoles(['admin', 'operator', 'client'])
  async updateMaterial(
    @Param('id') id: string,
    @Body() dto: UpdateMaterialDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.contentService.updateMaterial(id, dto, user);
  }

  @Post('materials/batch-delete')
  @GeoRoles(['admin', 'operator', 'client'])
  @HttpCode(HttpStatus.OK)
  async batchDeleteMaterials(
    @Body() dto: BatchDeleteMaterialsDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.contentService.batchDeleteMaterials(dto, user);
  }

  // ============================================================
  //  视频脚本
  // ============================================================

  @Post('video/script')
  @GeoRoles(['admin', 'operator', 'client'])
  async generateVideoScript(
    @Body() dto: GenerateVideoScriptDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveWriteBrandId(dto.brandId, user);
    return this.contentService.generateVideoScript(
      { ...dto, brandId: brandId ?? undefined },
      user,
    );
  }

  // ============================================================
  //  视频生成任务
  // ============================================================

  @Post('video/tasks')
  @GeoRoles(['admin', 'operator', 'client'])
  async createVideoTask(
    @Body() dto: CreateVideoTaskDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveWriteBrandId(dto.brandId, user);
    return this.contentService.createVideoTask(
      { ...dto, brandId: brandId ?? undefined },
      user,
    );
  }

  @Get('video/tasks')
  async listVideoTasks(
    @Query() query: VideoTaskListQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.contentService.listVideoTasks(query, user);
  }

  @Get('video/tasks/:id')
  async getVideoTask(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.contentService.getVideoTaskDetail(id, user);
  }

  @Post('video/tasks/:id/submit')
  @GeoRoles(['admin', 'operator', 'client'])
  async submitVideoTask(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.contentService.submitVideoTask(id, user);
  }

  @Post('video/tasks/:id/poll')
  async pollVideoTask(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.contentService.pollVideoTask(id, user);
  }

  @Delete('video/tasks/:id')
  @GeoRoles(['admin', 'operator', 'client'])
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteVideoTask(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    const user = this.getGeoUser(req);
    await this.contentService.deleteVideoTask(id, user);
  }

  // ============================================================
  //  视频服务配置（admin）
  // ============================================================

  @Get('video/config')
  @GeoRoles(['admin'])
  async getVideoServiceConfig(@Req() req: Request) {
    const user = this.getGeoUser(req);
    return this.contentService.getVideoServiceConfig(user);
  }

  @Put('video/config')
  @GeoRoles(['admin'])
  async updateVideoServiceConfig(
    @Body() dto: VideoServiceConfigDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.contentService.updateVideoServiceConfig(dto, user);
  }

  @Post('video/config/test')
  @GeoRoles(['admin'])
  async testVideoServiceConnection(@Req() req: Request) {
    const user = this.getGeoUser(req);
    return this.contentService.testVideoServiceConnection(user);
  }

  // ============================================================
  //  图片服务配置（admin）
  // ============================================================

  @Get('image/config')
  @GeoRoles(['admin'])
  async getImageServiceConfig(@Req() req: Request) {
    const user = this.getGeoUser(req);
    return this.contentService.getImageServiceConfig(user);
  }

  @Put('image/config')
  @GeoRoles(['admin'])
  async updateImageServiceConfig(
    @Body() dto: ImageServiceConfigDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.contentService.updateImageServiceConfig(dto, user);
  }

  @Post('image/config/test')
  @GeoRoles(['admin'])
  async testImageServiceConnection(@Req() req: Request) {
    const user = this.getGeoUser(req);
    return this.contentService.testImageServiceConnection(user);
  }

  // ============================================================
  //  内容产出统计
  // ============================================================

  @Get('stats/overview')
  async getContentOverview(
    @Query('brandId') brandId: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.contentService.getContentOverview(brandId, user);
  }
}
