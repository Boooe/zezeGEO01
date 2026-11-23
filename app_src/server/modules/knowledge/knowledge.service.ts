import { Injectable, Inject, Logger, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, ilike, desc, count } from 'drizzle-orm';

import { geoKnowledgeBase } from '@server/database/schema';
import type {
  KnowledgeItem,
  KnowledgeCategory,
  PagedResponse,
  UserRole,
} from '@shared/api.interface';
import {
  KnowledgeListQueryDto,
  CreateKnowledgeDto,
  UpdateKnowledgeDto,
  BatchImportKnowledgeDto,
  ActiveKnowledgeListQueryDto,
} from './dto/knowledge.dto';

interface GeoUserCtx {
  id: string;
  role: UserRole;
  brandId: string | null;
}

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  // ---------- 权限 ----------

  private ensureCanWrite(user: GeoUserCtx, brandId: string | null | undefined): void {
    if (user.role === 'client') {
      if (!user.brandId) {
        throw new ForbiddenException('无操作权限');
      }
      if (brandId && brandId !== user.brandId) {
        throw new ForbiddenException('只能操作所属品牌的数据');
      }
    }
    // admin/operator 可操作所有品牌
  }

  private ensureCanRead(user: GeoUserCtx, brandId: string | null): void {
    if (user.role === 'client' && user.brandId) {
      if (brandId !== user.brandId) {
        throw new ForbiddenException('只能查看所属品牌的数据');
      }
    }
  }

  // ---------- 列表 ----------

  async listKnowledge(
    query: KnowledgeListQueryDto,
    user: GeoUserCtx,
  ): Promise<PagedResponse<KnowledgeItem>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const conditions = this.buildWhere(query, user);

    const baseQuery = this.db
      .select({
        id: geoKnowledgeBase.id,
        brandId: geoKnowledgeBase.brandId,
        category: geoKnowledgeBase.category,
        title: geoKnowledgeBase.title,
        content: geoKnowledgeBase.content,
        tags: geoKnowledgeBase.tags,
        isActive: geoKnowledgeBase.isActive,
        creatorId: geoKnowledgeBase.creatorId,
        createdAt: geoKnowledgeBase.createdAt,
        updatedAt: geoKnowledgeBase.updatedAt,
      })
      .from(geoKnowledgeBase);

    const dataQuery = conditions.length > 0
      ? baseQuery.where(and(...conditions))
      : baseQuery;

    const [itemsRaw, totalResult] = await Promise.all([
      dataQuery
        .orderBy(desc(geoKnowledgeBase.updatedAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db
        .select({ count: count() })
        .from(geoKnowledgeBase)
        .where(conditions.length > 0 ? and(...conditions) : undefined),
    ]);

    const items: KnowledgeItem[] = itemsRaw.map((row) => ({
      id: row.id,
      brandId: row.brandId,
      category: row.category as KnowledgeCategory,
      title: row.title,
      content: row.content,
      tags: row.tags ?? [],
      isActive: row.isActive ?? true,
      creatorId: row.creatorId,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    }));

    return {
      items,
      total: Number(totalResult[0]?.count ?? 0),
      page,
      pageSize,
    };
  }

  private buildWhere(query: KnowledgeListQueryDto, user: GeoUserCtx) {
    const conditions = [];

    // client 角色只能看自己品牌
    if (user.role === 'client' && user.brandId) {
      conditions.push(eq(geoKnowledgeBase.brandId, user.brandId));
    } else if (query.brandId) {
      conditions.push(eq(geoKnowledgeBase.brandId, query.brandId));
    }

    if (query.category) {
      conditions.push(eq(geoKnowledgeBase.category, query.category));
    }

    if (query.keyword) {
      conditions.push(ilike(geoKnowledgeBase.title, `%${query.keyword}%`));
    }

    if (query.isActive !== undefined) {
      conditions.push(eq(geoKnowledgeBase.isActive, query.isActive));
    }

    return conditions;
  }

  // ---------- 详情 ----------

  async getKnowledgeById(id: string, user: GeoUserCtx): Promise<KnowledgeItem> {
    const row = await this.db
      .select({
        id: geoKnowledgeBase.id,
        brandId: geoKnowledgeBase.brandId,
        category: geoKnowledgeBase.category,
        title: geoKnowledgeBase.title,
        content: geoKnowledgeBase.content,
        tags: geoKnowledgeBase.tags,
        isActive: geoKnowledgeBase.isActive,
        creatorId: geoKnowledgeBase.creatorId,
        createdAt: geoKnowledgeBase.createdAt,
        updatedAt: geoKnowledgeBase.updatedAt,
      })
      .from(geoKnowledgeBase)
      .where(eq(geoKnowledgeBase.id, id))
      .limit(1);

    if (row.length === 0) {
      throw new NotFoundException('知识库条目不存在');
    }

    const item = row[0];
    this.ensureCanRead(user, item.brandId);

    return {
      id: item.id,
      brandId: item.brandId,
      category: item.category as KnowledgeCategory,
      title: item.title,
      content: item.content,
      tags: item.tags ?? [],
      isActive: item.isActive ?? true,
      creatorId: item.creatorId,
      createdAt: new Date(item.createdAt).toISOString(),
      updatedAt: new Date(item.updatedAt).toISOString(),
    };
  }

  // ---------- 新增 ----------

  async createKnowledge(dto: CreateKnowledgeDto, user: GeoUserCtx): Promise<KnowledgeItem> {
    this.ensureCanWrite(user, dto.brandId);

    const inserted = await this.db
      .insert(geoKnowledgeBase)
      .values({
        brandId: dto.brandId ?? null,
        category: dto.category,
        title: dto.title.trim(),
        content: dto.content,
        tags: dto.tags ?? [],
        isActive: dto.isActive ?? true,
        creatorId: user.id,
      })
      .returning({ id: geoKnowledgeBase.id });

    const itemId = inserted[0].id;
    return this.getKnowledgeByIdInternal(itemId);
  }

  // ---------- 编辑 ----------

  async updateKnowledge(id: string, dto: UpdateKnowledgeDto, user: GeoUserCtx): Promise<KnowledgeItem> {
    const existing = await this.getKnowledgeByIdInternal(id);
    if (!existing) {
      throw new NotFoundException('知识库条目不存在');
    }

    this.ensureCanWrite(user, existing.brandId);

    const patch: Partial<typeof geoKnowledgeBase.$inferInsert> = {};

    if (dto.brandId !== undefined) patch.brandId = dto.brandId;
    if (dto.category !== undefined) patch.category = dto.category;
    if (dto.title !== undefined) patch.title = dto.title.trim();
    if (dto.content !== undefined) patch.content = dto.content;
    if (dto.tags !== undefined) patch.tags = dto.tags;
    if (dto.isActive !== undefined) patch.isActive = dto.isActive;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    patch.updatedAt = new Date();

    const updated = await this.db
      .update(geoKnowledgeBase)
      .set(patch)
      .where(eq(geoKnowledgeBase.id, id))
      .returning({ id: geoKnowledgeBase.id });

    if (updated.length === 0) {
      throw new NotFoundException('知识库条目不存在');
    }

    return this.getKnowledgeByIdInternal(id);
  }

  // ---------- 删除 ----------

  async deleteKnowledge(id: string, user: GeoUserCtx): Promise<void> {
    const existing = await this.getKnowledgeByIdInternal(id);
    if (!existing) {
      throw new NotFoundException('知识库条目不存在');
    }

    this.ensureCanWrite(user, existing.brandId);

    const deleted = await this.db
      .delete(geoKnowledgeBase)
      .where(eq(geoKnowledgeBase.id, id))
      .returning({ id: geoKnowledgeBase.id });

    if (deleted.length === 0) {
      throw new NotFoundException('知识库条目不存在');
    }
  }

  // ---------- 活跃条目列表（不分页，给创作页下拉选用） ----------

  async listActiveKnowledge(
    query: ActiveKnowledgeListQueryDto,
    user: GeoUserCtx,
  ): Promise<Array<{ id: string; title: string; category: KnowledgeCategory; tags: string[] }>> {
    // client 角色只能看自己品牌
    let brandId: string;
    if (user.role === 'client' && user.brandId) {
      brandId = user.brandId;
    } else {
      if (!query.brandId) {
        throw new BadRequestException('brandId 必填');
      }
      brandId = query.brandId;
    }

    const conditions = [
      eq(geoKnowledgeBase.brandId, brandId),
      eq(geoKnowledgeBase.isActive, true),
    ];

    if (query.category) {
      conditions.push(eq(geoKnowledgeBase.category, query.category));
    }

    const rows = await this.db
      .select({
        id: geoKnowledgeBase.id,
        title: geoKnowledgeBase.title,
        category: geoKnowledgeBase.category,
        tags: geoKnowledgeBase.tags,
      })
      .from(geoKnowledgeBase)
      .where(and(...conditions))
      .orderBy(desc(geoKnowledgeBase.updatedAt));

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      category: row.category as KnowledgeCategory,
      tags: row.tags ?? [],
    }));
  }

  // ---------- 批量导入 ----------

  async batchImport(dto: BatchImportKnowledgeDto, user: GeoUserCtx): Promise<{ success: number }> {
    this.ensureCanWrite(user, dto.brandId);

    if (dto.items.length === 0) {
      throw new BadRequestException('导入列表不能为空');
    }

    const values = dto.items.map((item) => ({
      brandId: dto.brandId,
      category: item.category,
      title: item.title.trim(),
      content: item.content,
      tags: item.tags ?? [],
      isActive: true,
      creatorId: user.id,
    }));

    const batchSize = 200;
    let insertedCount = 0;
    for (let i = 0; i < values.length; i += batchSize) {
      const batch = values.slice(i, i + batchSize);
      const result = await this.db
        .insert(geoKnowledgeBase)
        .values(batch)
        .returning({ id: geoKnowledgeBase.id });
      insertedCount += result.length;
    }

    return { success: insertedCount };
  }

  // ---------- 内部方法 ----------

  private async getKnowledgeByIdInternal(id: string): Promise<KnowledgeItem | null> {
    const row = await this.db
      .select({
        id: geoKnowledgeBase.id,
        brandId: geoKnowledgeBase.brandId,
        category: geoKnowledgeBase.category,
        title: geoKnowledgeBase.title,
        content: geoKnowledgeBase.content,
        tags: geoKnowledgeBase.tags,
        isActive: geoKnowledgeBase.isActive,
        creatorId: geoKnowledgeBase.creatorId,
        createdAt: geoKnowledgeBase.createdAt,
        updatedAt: geoKnowledgeBase.updatedAt,
      })
      .from(geoKnowledgeBase)
      .where(eq(geoKnowledgeBase.id, id))
      .limit(1);

    if (row.length === 0) return null;

    const item = row[0];
    return {
      id: item.id,
      brandId: item.brandId,
      category: item.category as KnowledgeCategory,
      title: item.title,
      content: item.content,
      tags: item.tags ?? [],
      isActive: item.isActive ?? true,
      creatorId: item.creatorId,
      createdAt: new Date(item.createdAt).toISOString(),
      updatedAt: new Date(item.updatedAt).toISOString(),
    };
  }
}
