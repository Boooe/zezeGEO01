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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';

import { NeedGeoLogin, GeoRoles } from '../auth/auth.decorator';
import { KnowledgeService } from './knowledge.service';
import {
  KnowledgeListQueryDto,
  CreateKnowledgeDto,
  UpdateKnowledgeDto,
  BatchImportKnowledgeDto,
  ActiveKnowledgeListQueryDto,
} from './dto/knowledge.dto';
import type { UserRole } from '@shared/api.interface';

@Controller('api/knowledge')
@NeedGeoLogin()
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

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
   * 写操作第一道防线：防止 client 传其他品牌的 brandId 越权操作。
   */
  private resolveWriteBrandId(
    dtoBrandId: string | null | undefined,
    user: { role: UserRole; brandId: string | null },
  ): string | null {
    if (user.role === 'client') {
      return user.brandId;
    }
    return dtoBrandId ?? null;
  }

  // ---------- 列表 ----------

  @Get()
  async listKnowledge(
    @Query() query: KnowledgeListQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.knowledgeService.listKnowledge(query, user);
  }

  // ---------- 活跃条目列表（不分页，给创作页下拉选用） ----------
  // 注意：静态路由必须在动态路由 :id 之前

  @Get('list/active')
  async listActiveKnowledge(
    @Query() query: ActiveKnowledgeListQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.knowledgeService.listActiveKnowledge(query, user);
  }

  // ---------- 详情 ----------

  @Get(':id')
  async getKnowledge(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.knowledgeService.getKnowledgeById(id, user);
  }

  // ---------- 新增 ----------

  @Post()
  @GeoRoles(['admin', 'operator', 'client'])
  async createKnowledge(
    @Body() dto: CreateKnowledgeDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveWriteBrandId(dto.brandId, user);
    return this.knowledgeService.createKnowledge(
      { ...dto, brandId: brandId ?? undefined },
      user,
    );
  }

  // ---------- 批量导入 ----------

  @Post('batch')
  @GeoRoles(['admin', 'operator', 'client'])
  async batchImport(
    @Body() dto: BatchImportKnowledgeDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    const brandId = this.resolveWriteBrandId(dto.brandId, user);
    return this.knowledgeService.batchImport(
      { ...dto, brandId: brandId ?? undefined },
      user,
    );
  }

  // ---------- 编辑 ----------

  @Patch(':id')
  @GeoRoles(['admin', 'operator', 'client'])
  async updateKnowledge(
    @Param('id') id: string,
    @Body() dto: UpdateKnowledgeDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.knowledgeService.updateKnowledge(id, dto, user);
  }

  // ---------- 删除 ----------

  @Delete(':id')
  @GeoRoles(['admin', 'operator', 'client'])
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteKnowledge(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    const user = this.getGeoUser(req);
    await this.knowledgeService.deleteKnowledge(id, user);
  }
}
