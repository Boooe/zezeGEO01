import { Injectable, Inject, Logger, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, ilike, inArray, desc, sql, count, gte, lt, isNull, aliasedTable } from 'drizzle-orm';

import {
  geoKeywords,
  geoBrands,
  geoKeywordTasks,
  geoKeywordResults,
  geoLongtailConfigs,
  geoKeywordPool,
} from '@server/database/schema';
import type {
  Keyword,
  KeywordTask,
  KeywordResult,
  HitRateTrend,
  PlatformHitDistribution,
  PagedResponse,
  UserRole,
  LongtailConfig,
  LongtailCombineResult,
  LongtailCombinePreview,
} from '@shared/api.interface';
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
} from './dto/keywords.dto';

interface GeoUserCtx {
  id: string;
  role: UserRole;
  brandId: string | null;
}

@Injectable()
export class KeywordsService {
  private readonly logger = new Logger(KeywordsService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  // ---------- 词库 ----------

  async listKeywords(
    query: KeywordListQueryDto,
    user: GeoUserCtx,
  ): Promise<PagedResponse<Keyword>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const parentKeywords = aliasedTable(geoKeywords, 'parent_keywords');
    const conditions = this.buildKeywordWhere(query, user, parentKeywords);

    const baseQuery = this.db
      .select({
        id: geoKeywords.id,
        brandId: geoKeywords.brandId,
        brandName: geoBrands.name,
        keyword: geoKeywords.keyword,
        keywordType: geoKeywords.keywordType,
        isExample: geoKeywords.isExample,
        parentKeywordId: geoKeywords.parentKeywordId,
        parentKeywordName: parentKeywords.keyword,
        createdAt: geoKeywords.createdAt,
      })
      .from(geoKeywords)
      .leftJoin(geoBrands, eq(geoKeywords.brandId, geoBrands.id))
      .leftJoin(parentKeywords, eq(geoKeywords.parentKeywordId, parentKeywords.id));

    const dataQuery = conditions.length > 0
      ? baseQuery.where(and(...conditions))
      : baseQuery;

    const [itemsRaw, totalResult]: [
      Array<{
        id: string;
        brandId: string;
        brandName: string | null;
        keyword: string;
        keywordType: string;
        isExample: boolean;
        parentKeywordId: string | null;
        parentKeywordName: string | null;
        createdAt: Date;
      }>,
      Array<{ count: number }>,
    ] = await Promise.all([
      dataQuery
        .orderBy(desc(geoKeywords.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize) as Promise<Array<{
          id: string;
          brandId: string;
          brandName: string | null;
          keyword: string;
          keywordType: string;
          isExample: boolean;
          parentKeywordId: string | null;
          parentKeywordName: string | null;
          createdAt: Date;
        }>>,
      this.db
        .select({ count: count() })
        .from(geoKeywords)
        .leftJoin(geoBrands, eq(geoKeywords.brandId, geoBrands.id))
        .leftJoin(parentKeywords, eq(geoKeywords.parentKeywordId, parentKeywords.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined) as Promise<Array<{ count: number }>>,
    ]);

    const items: Keyword[] = itemsRaw.map((row) => ({
      id: row.id,
      brandId: row.brandId,
      brandName: row.brandName ?? '',
      keyword: row.keyword,
      keywordType: row.keywordType as Keyword['keywordType'],
      isExample: row.isExample,
      parentKeywordId: row.parentKeywordId ?? null,
      parentKeyword: row.parentKeywordName ?? null,
      createdAt: new Date(row.createdAt).toISOString(),
    }));

    return {
      items,
      total: Number(totalResult[0]?.count ?? 0),
      page,
      pageSize,
    };
  }

  async createKeyword(dto: CreateKeywordDto, user: GeoUserCtx): Promise<Keyword> {
    this.ensureCanWrite(user, dto.brandId);

    // 如果传了 parentKeywordId，校验父关键词存在、同品牌、且为 core 类型
    if (dto.parentKeywordId) {
      await this.validateParentKeyword(dto.parentKeywordId, dto.brandId);
    }

    // 检查同一品牌下是否已存在相同关键词
    const existing = await this.db
      .select({ id: geoKeywords.id })
      .from(geoKeywords)
      .where(
        and(
          eq(geoKeywords.brandId, dto.brandId),
          eq(geoKeywords.keyword, dto.keyword.trim()),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      throw new BadRequestException('该品牌下已存在相同关键词');
    }

    const inserted = await this.db
      .insert(geoKeywords)
      .values({
        brandId: dto.brandId,
        keyword: dto.keyword.trim(),
        keywordType: dto.keywordType,
        isExample: dto.isExample ?? false,
        parentKeywordId: dto.parentKeywordId ?? null,
      })
      .returning({ id: geoKeywords.id });

    const keywordId = inserted[0].id;
    return this.getKeywordById(keywordId);
  }

  async batchImport(dto: BatchImportKeywordDto, user: GeoUserCtx): Promise<{ success: number }> {
    this.ensureCanWrite(user, dto.brandId);

    const trimmed = [...new Set(dto.keywords.map((k: string) => k.trim()).filter(Boolean))];
    if (trimmed.length === 0) {
      throw new BadRequestException('关键词列表不能为空');
    }

    // 如果传了 parentKeywordId，校验父关键词存在、同品牌、且为 core 类型
    if (dto.parentKeywordId) {
      await this.validateParentKeyword(dto.parentKeywordId, dto.brandId);
    }

    // 查出已存在的关键词
    const existingRows = await this.db
      .select({ keyword: geoKeywords.keyword })
      .from(geoKeywords)
      .where(
        and(
          eq(geoKeywords.brandId, dto.brandId),
          inArray(geoKeywords.keyword, trimmed),
        ),
      );

    const existingSet = new Set(existingRows.map((r) => r.keyword));
    const toInsert = trimmed.filter((k: string) => !existingSet.has(k));

    if (toInsert.length === 0) {
      return { success: 0 };
    }

    const values = toInsert.map((k: string) => ({
      brandId: dto.brandId,
      keyword: k,
      keywordType: dto.keywordType,
      isExample: false,
      parentKeywordId: dto.parentKeywordId ?? null,
    }));

    // 分批插入，避免单条 SQL 过大
    const batchSize = 200;
    let insertedCount = 0;
    for (let i = 0; i < values.length; i += batchSize) {
      const batch = values.slice(i, i + batchSize);
      const result = await this.db.insert(geoKeywords).values(batch).returning({ id: geoKeywords.id });
      insertedCount += result.length;
    }

    return { success: insertedCount };
  }

  async deleteKeyword(id: string, user: GeoUserCtx): Promise<void> {
    const keyword = await this.getKeywordById(id);
    if (!keyword) {
      throw new NotFoundException('关键词不存在');
    }

    this.ensureCanWrite(user, keyword.brandId);

    const deleted = await this.db
      .delete(geoKeywords)
      .where(eq(geoKeywords.id, id))
      .returning({ id: geoKeywords.id });

    if (deleted.length === 0) {
      throw new NotFoundException('关键词不存在');
    }
  }

  /**
   * 标记为核心词 / 取消核心词
   * - isCore=true → keywordType 改为 'core'
   * - isCore=false → keywordType 改为 'longtail'，同时把所有以它为父的子词 parentKeywordId 置为 null
   */
  async toggleCoreKeyword(
    id: string,
    isCore: boolean,
    user: GeoUserCtx,
  ): Promise<Keyword> {
    const keyword = await this.getKeywordById(id);
    if (!keyword) {
      throw new NotFoundException('关键词不存在');
    }

    this.ensureCanWrite(user, keyword.brandId);

    const newType: 'core' | 'longtail' = isCore ? 'core' : 'longtail';

    // 类型没变化就直接返回
    if (keyword.keywordType === newType) {
      return keyword;
    }

    if (isCore) {
      // 升级为核心词：更新类型
      const updated = await this.db
        .update(geoKeywords)
        .set({ keywordType: 'core' })
        .where(eq(geoKeywords.id, id))
        .returning({ id: geoKeywords.id });

      if (updated.length === 0) {
        throw new NotFoundException('关键词不存在');
      }
    } else {
      // 降级为长尾词：更新类型 + 把子词的 parentKeywordId 置为 null
      await this.db.transaction(async (tx) => {
        // 1. 更新自身类型
        const updated = await tx
          .update(geoKeywords)
          .set({ keywordType: 'longtail' })
          .where(eq(geoKeywords.id, id))
          .returning({ id: geoKeywords.id });

        if (updated.length === 0) {
          throw new NotFoundException('关键词不存在');
        }

        // 2. 把子词的 parentKeywordId 置为 null
        await tx
          .update(geoKeywords)
          .set({ parentKeywordId: null })
          .where(eq(geoKeywords.parentKeywordId, id));
      });
    }

    return this.getKeywordById(id) as Promise<Keyword>;
  }

  /**
   * 设置/取消父关键词
   * - parentKeywordId 为 null → 取消父级（未归类）
   * - parentKeywordId 非空 → 校验父关键词存在、同品牌、是 core 类型
   */
  async setParentKeyword(
    keywordId: string,
    parentKeywordId: string | null,
    user: GeoUserCtx,
  ): Promise<Keyword> {
    const keyword = await this.getKeywordById(keywordId);
    if (!keyword) {
      throw new NotFoundException('关键词不存在');
    }

    this.ensureCanWrite(user, keyword.brandId);

    // 不能把自己设为自己的父关键词
    if (parentKeywordId && parentKeywordId === keywordId) {
      throw new BadRequestException('不能将关键词设为自身的父关键词');
    }

    // 取消父级
    if (!parentKeywordId) {
      await this.db
        .update(geoKeywords)
        .set({ parentKeywordId: null })
        .where(eq(geoKeywords.id, keywordId));
      return this.getKeywordById(keywordId) as Promise<Keyword>;
    }

    // 设置父级：先校验
    await this.validateParentKeyword(parentKeywordId, keyword.brandId);

    await this.db
      .update(geoKeywords)
      .set({ parentKeywordId })
      .where(eq(geoKeywords.id, keywordId));

    return this.getKeywordById(keywordId) as Promise<Keyword>;
  }

  /**
   * 校验父关键词：存在、同品牌、类型为 core
   */
  private async validateParentKeyword(parentId: string, brandId: string): Promise<void> {
    const parentRows = await this.db
      .select({
        id: geoKeywords.id,
        brandId: geoKeywords.brandId,
        keywordType: geoKeywords.keywordType,
      })
      .from(geoKeywords)
      .where(eq(geoKeywords.id, parentId))
      .limit(1);

    if (parentRows.length === 0) {
      throw new BadRequestException('父关键词不存在');
    }

    const parent = parentRows[0];
    if (parent.brandId !== brandId) {
      throw new BadRequestException('父关键词不属于同一品牌');
    }
    if (parent.keywordType !== 'core') {
      throw new BadRequestException('只有核心词才能作为父关键词');
    }
  }

  // ---------- 检测任务 ----------

  async createTasks(dto: CreateTasksDto, user: GeoUserCtx): Promise<{ created: number }> {
    // 查出关键词
    const keywords = await this.db
      .select({
        id: geoKeywords.id,
        brandId: geoKeywords.brandId,
        isExample: geoKeywords.isExample,
      })
      .from(geoKeywords)
      .where(inArray(geoKeywords.id, dto.keywordIds));

    if (keywords.length === 0) {
      throw new BadRequestException('未找到有效的关键词');
    }

    // 权限校验：client 只能操作自己品牌的关键词
    if (user.role === 'client' && user.brandId) {
      const allOwnBrand = keywords.every((k) => k.brandId === user.brandId);
      if (!allOwnBrand) {
        throw new ForbiddenException('只能操作所属品牌的关键词');
      }
    }

    const tasks: Array<{
      keywordId: string;
      brandId: string;
      platform: string;
      city: string | null;
      isExample: boolean;
      status: string;
    }> = [];

    for (const kw of keywords) {
      for (const platform of dto.platforms) {
        tasks.push({
          keywordId: kw.id,
          brandId: kw.brandId,
          platform,
          city: dto.city ?? null,
          isExample: kw.isExample,
          status: 'pending',
        });
      }
    }

    const batchSize = 200;
    let createdCount = 0;
    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);
      const result = await this.db.insert(geoKeywordTasks).values(batch).returning({ id: geoKeywordTasks.id });
      createdCount += result.length;
    }

    return { created: createdCount };
  }

  async listTasks(
    query: TaskListQueryDto,
    user: GeoUserCtx,
  ): Promise<PagedResponse<KeywordTask>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const conditions = this.buildTaskWhere(query, user);

    const baseQuery = this.db
      .select({
        id: geoKeywordTasks.id,
        keywordId: geoKeywordTasks.keywordId,
        keyword: geoKeywords.keyword,
        brandId: geoKeywordTasks.brandId,
        brandName: geoBrands.name,
        platform: geoKeywordTasks.platform,
        city: geoKeywordTasks.city,
        status: geoKeywordTasks.status,
        isExample: geoKeywordTasks.isExample,
        createdAt: geoKeywordTasks.createdAt,
      })
      .from(geoKeywordTasks)
      .leftJoin(geoKeywords, eq(geoKeywordTasks.keywordId, geoKeywords.id))
      .leftJoin(geoBrands, eq(geoKeywordTasks.brandId, geoBrands.id));

    const dataQuery = conditions.length > 0
      ? baseQuery.where(and(...conditions))
      : baseQuery;

    const [itemsRaw, totalResult] = await Promise.all([
      dataQuery
        .orderBy(desc(geoKeywordTasks.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db
        .select({ count: count() })
        .from(geoKeywordTasks)
        .leftJoin(geoKeywords, eq(geoKeywordTasks.keywordId, geoKeywords.id))
        .leftJoin(geoBrands, eq(geoKeywordTasks.brandId, geoBrands.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined),
    ]);

    const items: KeywordTask[] = itemsRaw.map((row) => ({
      id: row.id,
      keywordId: row.keywordId,
      keyword: row.keyword ?? '',
      brandId: row.brandId,
      brandName: row.brandName ?? '',
      platform: row.platform as KeywordTask['platform'],
      city: row.city,
      status: row.status as KeywordTask['status'],
      isExample: row.isExample,
      createdAt: new Date(row.createdAt).toISOString(),
    }));

    return {
      items,
      total: Number(totalResult[0]?.count ?? 0),
      page,
      pageSize,
    };
  }

  // ---------- 报表 ----------

  async listResults(
    query: ReportListQueryDto,
    user: GeoUserCtx,
  ): Promise<{
    items: KeywordResult[];
    total: number;
    page: number;
    pageSize: number;
    hitCount: number;
    hitRate: number;
    platformCoverage: number;
  }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const conditions = this.buildReportWhere(query, user);

    const baseQuery = this.db
      .select({
        id: geoKeywordResults.id,
        taskId: geoKeywordResults.taskId,
        keywordId: geoKeywordResults.keywordId,
        keyword: geoKeywords.keyword,
        brandId: geoKeywordResults.brandId,
        brandName: geoBrands.name,
        platform: geoKeywordResults.platform,
        city: geoKeywordResults.city,
        isHit: geoKeywordResults.isHit,
        position: geoKeywordResults.position,
        snippet: geoKeywordResults.snippet,
        url: geoKeywordResults.url,
        error: geoKeywordResults.error,
        detectedAt: geoKeywordResults.detectedAt,
        isExample: geoKeywordResults.isExample,
      })
      .from(geoKeywordResults)
      .leftJoin(geoKeywords, eq(geoKeywordResults.keywordId, geoKeywords.id))
      .leftJoin(geoBrands, eq(geoKeywordResults.brandId, geoBrands.id));

    const dataQuery = conditions.length > 0
      ? baseQuery.where(and(...conditions))
      : baseQuery;

    const [itemsRaw, statsResult] = await Promise.all([
      dataQuery
        .orderBy(desc(geoKeywordResults.detectedAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db
        .select({
          total: count(),
          hitCount: sql<number>`count(*) filter (where ${geoKeywordResults.isHit} = true)`,
          platformCoverage: sql<number>`count(distinct ${geoKeywordResults.platform})`,
        })
        .from(geoKeywordResults)
        .leftJoin(geoKeywords, eq(geoKeywordResults.keywordId, geoKeywords.id))
        .leftJoin(geoBrands, eq(geoKeywordResults.brandId, geoBrands.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined),
    ]);

    const items: KeywordResult[] = itemsRaw.map((row) => ({
      id: row.id,
      taskId: row.taskId,
      keywordId: row.keywordId,
      keyword: row.keyword ?? '',
      brandId: row.brandId,
      brandName: row.brandName ?? '',
      platform: row.platform as KeywordResult['platform'],
      city: row.city,
      isHit: row.isHit,
      position: row.position,
      snippet: row.snippet,
      url: row.url,
      error: row.error,
      detectedAt: row.detectedAt ? new Date(row.detectedAt).toISOString() : null,
      isExample: row.isExample,
    }));

    const total = Number(statsResult[0]?.total ?? 0);
    const hitCount = Number(statsResult[0]?.hitCount ?? 0);
    const hitRate = total > 0 ? Number((hitCount / total).toFixed(4)) : 0;
    const platformCoverage = Number(statsResult[0]?.platformCoverage ?? 0);

    return {
      items,
      total,
      page,
      pageSize,
      hitCount,
      hitRate,
      platformCoverage,
    };
  }

  async getResultsStats(
    query: ReportListQueryDto,
    user: GeoUserCtx,
  ): Promise<{
    total: number;
    hitCount: number;
    hitRate: number;
    platformCount: number;
  }> {
    const conditions = this.buildReportWhere(query, user);

    const statsResult = await this.db
      .select({
        total: count(),
        hitCount: sql<number>`count(*) filter (where ${geoKeywordResults.isHit} = true)`,
        platformCount: sql<number>`count(distinct ${geoKeywordResults.platform})`,
      })
      .from(geoKeywordResults)
      .leftJoin(geoKeywords, eq(geoKeywordResults.keywordId, geoKeywords.id))
      .leftJoin(geoBrands, eq(geoKeywordResults.brandId, geoBrands.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = Number(statsResult[0]?.total ?? 0);
    const hitCount = Number(statsResult[0]?.hitCount ?? 0);
    const hitRate = total > 0 ? Number((hitCount / total).toFixed(4)) : 0;
    const platformCount = Number(statsResult[0]?.platformCount ?? 0);

    return { total, hitCount, hitRate, platformCount };
  }

  async exportResultsCsv(
    query: ReportListQueryDto,
    user: GeoUserCtx,
  ): Promise<string> {
    const conditions = this.buildReportWhere(query, user);

    const rows = await this.db
      .select({
        keyword: geoKeywords.keyword,
        platform: geoKeywordResults.platform,
        isHit: geoKeywordResults.isHit,
        position: geoKeywordResults.position,
        detectedAt: geoKeywordResults.detectedAt,
        url: geoKeywordResults.url,
        isExample: geoKeywordResults.isExample,
      })
      .from(geoKeywordResults)
      .leftJoin(geoKeywords, eq(geoKeywordResults.keywordId, geoKeywords.id))
      .leftJoin(geoBrands, eq(geoKeywordResults.brandId, geoBrands.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(geoKeywordResults.detectedAt))
      .limit(5000);

    const header = '序号,核心词,平台,是否命中,排名,检测时间,来源URL,示例标记';
    const lines = rows.map((row, index) => {
      const platformLabel = this.getPlatformLabel(row.platform);
      const hitLabel = row.isHit ? '是' : '否';
      const position = row.position ?? '';
      const detectedAt = row.detectedAt
        ? new Date(row.detectedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
        : '';
      const url = row.url ?? '';
      const exampleLabel = row.isExample ? '示例' : '';
      return [
        index + 1,
        `"${(row.keyword ?? '').replace(/"/g, '""')}"`,
        platformLabel,
        hitLabel,
        position,
        detectedAt,
        `"${url.replace(/"/g, '""')}"`,
        exampleLabel,
      ].join(',');
    });

    return [header, ...lines].join('\n');
  }

  // ---------- 首页统计 ----------

  async getStats(user: GeoUserCtx): Promise<{
    keywordCount: number;
    taskCount: number;
    hitRate: number;
    hitRateTrend: HitRateTrend[];
    platformDistribution: PlatformHitDistribution[];
    riskKeywords: Array<{ id: string; keyword: string; platform: string; brandName: string }>;
  }> {
    const brandCondition = user.role === 'client' && user.brandId
      ? eq(geoKeywords.brandId, user.brandId)
      : undefined;

    const [
      keywordCountResult,
      taskCountResult,
      completedStats,
      trendRows,
      platformRows,
      riskRows,
    ] = await Promise.all([
      // 关键词总数
      this.db
        .select({ count: count() })
        .from(geoKeywords)
        .where(brandCondition ?? undefined),
      // 任务总数
      this.db
        .select({ count: count() })
        .from(geoKeywordTasks)
        .leftJoin(geoKeywords, eq(geoKeywordTasks.keywordId, geoKeywords.id))
        .where(brandCondition ?? undefined),
      // 已完成任务命中率
      this.db
        .select({
          total: count(),
          hitCount: sql<number>`count(*) filter (where ${geoKeywordResults.isHit} = true)`,
        })
        .from(geoKeywordResults)
        .leftJoin(geoKeywords, eq(geoKeywordResults.keywordId, geoKeywords.id))
        .where(
          and(
            ...(brandCondition ? [brandCondition] : []),
            sql`${geoKeywordResults.detectedAt} is not null`,
          ),
        ),
      // 近 6 个月命中率趋势
      this.db
        .select({
          month: sql<string>`to_char(date_trunc('month', ${geoKeywordResults.detectedAt}), 'YYYY-MM')`,
          total: count(),
          hitCount: sql<number>`count(*) filter (where ${geoKeywordResults.isHit} = true)`,
        })
        .from(geoKeywordResults)
        .leftJoin(geoKeywords, eq(geoKeywordResults.keywordId, geoKeywords.id))
        .where(
          and(
            ...(brandCondition ? [brandCondition] : []),
            sql`${geoKeywordResults.detectedAt} >= date_trunc('month', now()) - interval '5 months'`,
          ),
        )
        .groupBy(sql`date_trunc('month', ${geoKeywordResults.detectedAt})`)
        .orderBy(sql`date_trunc('month', ${geoKeywordResults.detectedAt})`),
      // 平台分布
      this.db
        .select({
          platform: geoKeywordResults.platform,
          total: count(),
          hit: sql<number>`count(*) filter (where ${geoKeywordResults.isHit} = true)`,
        })
        .from(geoKeywordResults)
        .leftJoin(geoKeywords, eq(geoKeywordResults.keywordId, geoKeywords.id))
        .where(brandCondition ?? undefined)
        .groupBy(geoKeywordResults.platform),
      // 风险关键词：未命中的核心词，前 10 个
      this.db
        .select({
          id: geoKeywordResults.id,
          keywordId: geoKeywordResults.keywordId,
          keyword: geoKeywords.keyword,
          platform: geoKeywordResults.platform,
          brandName: geoBrands.name,
          keywordType: geoKeywords.keywordType,
        })
        .from(geoKeywordResults)
        .leftJoin(geoKeywords, eq(geoKeywordResults.keywordId, geoKeywords.id))
        .leftJoin(geoBrands, eq(geoKeywordResults.brandId, geoBrands.id))
        .where(
          and(
            ...(brandCondition ? [brandCondition] : []),
            eq(geoKeywordResults.isHit, false),
            eq(geoKeywords.keywordType, 'core'),
          ),
        )
        .orderBy(desc(geoKeywordResults.detectedAt))
        .limit(10),
    ]);

    const keywordCount = Number(keywordCountResult[0]?.count ?? 0);
    const taskCount = Number(taskCountResult[0]?.count ?? 0);
    const completedTotal = Number(completedStats[0]?.total ?? 0);
    const hitCount = Number(completedStats[0]?.hitCount ?? 0);
    const hitRate = completedTotal > 0 ? Number((hitCount / completedTotal).toFixed(4)) : 0;

    const hitRateTrend: HitRateTrend[] = trendRows.map((row) => ({
      month: row.month,
      rate: Number(row.total) > 0 ? Number((Number(row.hitCount) / Number(row.total)).toFixed(4)) : 0,
    }));

    const platformDistribution: PlatformHitDistribution[] = platformRows.map((row) => ({
      platform: row.platform,
      hit: Number(row.hit),
      total: Number(row.total),
    }));

    const riskKeywords = riskRows.map((row) => ({
      id: row.keywordId ?? row.id,
      keyword: row.keyword ?? '',
      platform: row.platform,
      brandName: row.brandName ?? '',
    }));

    return {
      keywordCount,
      taskCount,
      hitRate,
      hitRateTrend,
      platformDistribution,
      riskKeywords,
    };
  }

  // ---------- 辅助方法 ----------

  private async getKeywordById(id: string): Promise<Keyword | null> {
    const parentKeywords = aliasedTable(geoKeywords, 'parent_keywords');
    const rows = await this.db
      .select({
        id: geoKeywords.id,
        brandId: geoKeywords.brandId,
        brandName: geoBrands.name,
        keyword: geoKeywords.keyword,
        keywordType: geoKeywords.keywordType,
        isExample: geoKeywords.isExample,
        parentKeywordId: geoKeywords.parentKeywordId,
        parentKeywordName: parentKeywords.keyword,
        createdAt: geoKeywords.createdAt,
      })
      .from(geoKeywords)
      .leftJoin(geoBrands, eq(geoKeywords.brandId, geoBrands.id))
      .leftJoin(parentKeywords, eq(geoKeywords.parentKeywordId, parentKeywords.id))
      .where(eq(geoKeywords.id, id))
      .limit(1)
      .then((result) => result as Array<{
        id: string;
        brandId: string;
        brandName: string | null;
        keyword: string;
        keywordType: string;
        isExample: boolean;
        parentKeywordId: string | null;
        parentKeywordName: string | null;
        createdAt: Date;
      }>);

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      id: row.id,
      brandId: row.brandId,
      brandName: row.brandName ?? '',
      keyword: row.keyword,
      keywordType: row.keywordType as Keyword['keywordType'],
      isExample: row.isExample,
      parentKeywordId: row.parentKeywordId ?? null,
      parentKeyword: row.parentKeywordName ?? null,
      createdAt: new Date(row.createdAt).toISOString(),
    };
  }

  private buildKeywordWhere(
    query: KeywordListQueryDto,
    user: GeoUserCtx,
    parentKeywords?: typeof geoKeywords,
  ): ReturnType<typeof eq>[] {
    const conditions: ReturnType<typeof eq>[] = [];

    // client 角色强制按 brandId 过滤
    if (user.role === 'client' && user.brandId) {
      conditions.push(eq(geoKeywords.brandId, user.brandId));
    } else if (query.brandId) {
      conditions.push(eq(geoKeywords.brandId, query.brandId));
    }

    if (query.keywordType) {
      conditions.push(eq(geoKeywords.keywordType, query.keywordType));
    }

    if (query.keyword) {
      conditions.push(ilike(geoKeywords.keyword, `%${query.keyword}%`) as ReturnType<typeof eq>);
    }

    // parentKeywordId 过滤
    // - 为 UUID 字符串 → 按父 ID 匹配
    // - 为空串 → 未归类（parentKeywordId is null 且 keywordType = longtail）
    // - 未传 → 不过滤
    if (query.parentKeywordId !== undefined) {
      if (query.parentKeywordId === '') {
        conditions.push(isNull(geoKeywords.parentKeywordId) as ReturnType<typeof eq>);
        conditions.push(eq(geoKeywords.keywordType, 'longtail'));
      } else {
        conditions.push(eq(geoKeywords.parentKeywordId, query.parentKeywordId));
      }
    }

    return conditions;
  }

  private buildTaskWhere(
    query: TaskListQueryDto,
    user: GeoUserCtx,
  ): ReturnType<typeof eq>[] {
    const conditions: ReturnType<typeof eq>[] = [];

    if (user.role === 'client' && user.brandId) {
      conditions.push(eq(geoKeywordTasks.brandId, user.brandId));
    } else if (query.brandId) {
      conditions.push(eq(geoKeywordTasks.brandId, query.brandId));
    }

    if (query.status) {
      conditions.push(eq(geoKeywordTasks.status, query.status));
    }

    if (query.platform) {
      conditions.push(eq(geoKeywordTasks.platform, query.platform));
    }

    return conditions;
  }

  private buildReportWhere(
    query: ReportListQueryDto,
    user: GeoUserCtx,
  ): ReturnType<typeof eq>[] {
    const conditions: ReturnType<typeof eq>[] = [];

    if (user.role === 'client' && user.brandId) {
      conditions.push(eq(geoKeywordResults.brandId, user.brandId));
    } else if (query.brandId) {
      conditions.push(eq(geoKeywordResults.brandId, query.brandId));
    }

    if (query.platform) {
      conditions.push(eq(geoKeywordResults.platform, query.platform));
    }

    if (query.isHit !== undefined) {
      conditions.push(eq(geoKeywordResults.isHit, query.isHit));
    }

    if (query.keyword) {
      conditions.push(ilike(geoKeywords.keyword, `%${query.keyword}%`) as ReturnType<typeof eq>);
    }

    if (query.startDate) {
      conditions.push(gte(geoKeywordResults.detectedAt, new Date(query.startDate)) as ReturnType<typeof eq>);
    }
    if (query.endDate) {
      const end = new Date(query.endDate);
      end.setDate(end.getDate() + 1);
      conditions.push(lt(geoKeywordResults.detectedAt, end) as ReturnType<typeof eq>);
    }

    return conditions;
  }

  private ensureCanWrite(user: GeoUserCtx, brandId: string): void {
    if (user.role === 'client') {
      if (!user.brandId || user.brandId !== brandId) {
        throw new ForbiddenException('只能操作所属品牌的数据');
      }
      // client 角色可操作自己品牌的数据
    }
  }

  private getPlatformLabel(platform: string): string {
    const labels: Record<string, string> = {
      baidu: '百度',
      '360': '360搜索',
      sogou: '搜狗',
      toutiao: '头条',
      douyin: '抖音',
    };
    return labels[platform] ?? platform;
  }

  // ============================================================
  //  长尾词组合配置
  // ============================================================

  async getLongtailConfig(
    query: LongtailConfigQueryDto,
    user: GeoUserCtx,
  ): Promise<{ words: string[] }> {
    this.ensureCanReadBrand(user, query.brandId);

    const conditions = [eq(geoLongtailConfigs.brandId, query.brandId), eq(geoLongtailConfigs.configType, query.type)];
    if (query.groupId) {
      conditions.push(eq(geoLongtailConfigs.groupId, query.groupId));
    } else {
      conditions.push(sql`${geoLongtailConfigs.groupId} IS NULL` as any);
    }

    const rows = await this.db
      .select({ words: geoLongtailConfigs.words })
      .from(geoLongtailConfigs)
      .where(and(...conditions))
      .limit(1);

    return { words: rows[0]?.words ?? [] };
  }

  async saveLongtailConfig(
    dto: SaveLongtailConfigDto,
    user: GeoUserCtx,
  ): Promise<LongtailConfig> {
    this.ensureCanWrite(user, dto.brandId);

    const groupId = dto.groupId ?? null;
    const groupIdForUpsert = groupId ?? '00000000-0000-0000-0000-000000000000';

    const wordsArray = sql`${dto.words}::text[]`;
    const result = await this.db.execute(sql<{
      id: string;
      brand_id: string;
      group_id: string | null;
      config_type: string;
      words: string[];
      _created_at: Date;
      _updated_at: Date;
    }>`
      INSERT INTO ${geoLongtailConfigs} (brand_id, group_id, config_type, words)
      VALUES (${dto.brandId}::uuid, ${groupId ? sql`${groupId}::uuid` : sql`NULL`}, ${dto.configType}, ${wordsArray})
      ON CONFLICT (brand_id, COALESCE(group_id, '00000000-0000-0000-0000-000000000000'::uuid), config_type)
      DO UPDATE SET words = EXCLUDED.words, _updated_at = CURRENT_TIMESTAMP
      RETURNING id, brand_id, group_id, config_type, words, _created_at, _updated_at
    `);

    const row = result[0] as any as {
      id: string;
      brand_id: string;
      group_id: string | null;
      config_type: string;
      words: string[];
      _created_at: Date;
      _updated_at: Date;
    };
    return {
      id: row.id,
      brandId: row.brand_id,
      groupId: row.group_id,
      configType: row.config_type as 'prefix' | 'suffix',
      words: Array.isArray(row.words) ? row.words : [],
      createdAt: new Date(row._created_at).toISOString(),
      updatedAt: new Date(row._updated_at).toISOString(),
    };
  }

  async previewLongtailCombine(
    dto: LongtailCombinePreviewDto,
  ): Promise<LongtailCombinePreview> {
    const total = dto.prefixWords.length * dto.suffixWords.length;
    const combinations = new Set<string>();
    for (const p of dto.prefixWords) {
      for (const s of dto.suffixWords) {
        combinations.add(p + s);
      }
    }
    return { total, deduplicated: combinations.size };
  }

  async combineLongtail(
    dto: LongtailCombineDto,
    user: GeoUserCtx,
  ): Promise<{ items: LongtailCombineResult[] }> {
    this.ensureCanReadBrand(user, dto.brandId);

    const combinations = new Set<string>();
    for (const p of dto.prefixWords) {
      for (const s of dto.suffixWords) {
        combinations.add(p + s);
      }
    }

    const allWords = Array.from(combinations).sort();
    const limitedWords = allWords.slice(0, 500);

    // 查词池中已存在的词
    let existingSet: Set<string> = new Set();
    if (limitedWords.length > 0) {
      const existingRows = await this.db
        .select({ keyword: geoKeywordPool.keyword })
        .from(geoKeywordPool)
        .where(
          and(
            eq(geoKeywordPool.brandId, dto.brandId),
            inArray(geoKeywordPool.keyword, limitedWords),
          ),
        );
      existingSet = new Set(existingRows.map((r) => r.keyword));
    }

    const items: LongtailCombineResult[] = limitedWords.map((word: string) => ({
      word,
      inPool: existingSet.has(word),
    }));

    return { items };
  }

  async batchAddKeywordsPool(
    dto: BatchAddKeywordsPoolDto,
    user: GeoUserCtx,
  ): Promise<{ added: number; skipped: number }> {
    this.ensureCanWrite(user, dto.brandId);

    const trimmed = [...new Set(dto.keywords.map((k: string) => k.trim()).filter(Boolean))];
    if (trimmed.length === 0) {
      return { added: 0, skipped: 0 };
    }

    // 查出已存在的关键词
    const existingRows = await this.db
      .select({ keyword: geoKeywordPool.keyword })
      .from(geoKeywordPool)
      .where(
        and(
          eq(geoKeywordPool.brandId, dto.brandId),
          inArray(geoKeywordPool.keyword, trimmed),
        ),
      );

    const existingSet = new Set(existingRows.map((r) => r.keyword));
    const toInsert = trimmed.filter((k: string) => !existingSet.has(k));
    const skipped = existingSet.size;

    if (toInsert.length === 0) {
      return { added: 0, skipped };
    }

    const values = toInsert.map((k: string) => ({
      brandId: dto.brandId,
      keyword: k,
      keywordType: 'longtail' as const,
      groupId: dto.groupId ?? null,
      source: 'combo',
      addedAt: new Date(),
      creatorId: user.id,
    }));

    const batchSize = 200;
    let addedCount = 0;
    for (let i = 0; i < values.length; i += batchSize) {
      const batch = values.slice(i, i + batchSize);
      try {
        const result = await this.db.insert(geoKeywordPool).values(batch).returning({ id: geoKeywordPool.id });
        addedCount += result.length;
      } catch (err) {
        // 23505 unique violation: 忽略已存在的
        const code = this.extractSqlState(err);
        if (code === '23505') {
          // 有冲突时逐个插入
          for (const item of batch) {
            try {
              const r = await this.db.insert(geoKeywordPool).values(item).returning({ id: geoKeywordPool.id });
              addedCount += r.length;
            } catch (innerErr) {
              const innerCode = this.extractSqlState(innerErr);
              if (innerCode === '23505') {
                // 跳过重复
              } else {
                throw innerErr;
              }
            }
          }
        } else {
          throw err;
        }
      }
    }

    return { added: addedCount, skipped: skipped + (toInsert.length - addedCount) };
  }

  private extractSqlState(error: unknown): string | undefined {
    let current: unknown = error;
    for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth += 1) {
      const { code, cause } = current as { code?: unknown; cause?: unknown };
      if (typeof code === 'string') return code;
      current = cause;
    }
    return undefined;
  }

  private ensureCanReadBrand(user: GeoUserCtx, brandId: string): void {
    if (user.role === 'client' && user.brandId && user.brandId !== brandId) {
      throw new ForbiddenException('只能查看所属品牌的数据');
    }
  }
}
