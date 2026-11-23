import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, ilike, inArray, desc, sql, count } from 'drizzle-orm';

import {
  geoKeywordPool,
  geoKeywordGroups,
  geoKeywords,
  geoDiagnosisResults,
  geoDiagnosisReports,
  geoArticles,
} from '@server/database/schema';
import type {
  KeywordPoolItem,
  KeywordPoolItemWithOpportunity,
  PagedResponse,
  UserRole,
  GenerateLongtailResponse,
} from '@shared/api.interface';
import {
  PoolListQueryDto,
  AddPoolKeywordDto,
  BatchImportPoolDto,
  GenerateLongtailDto,
} from './dto/keywords.dto';

interface GeoUserCtx {
  id: string;
  role: UserRole;
  brandId: string | null;
}

@Injectable()
export class PoolService {
  private readonly logger = new Logger(PoolService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  // ---------- 列表 ----------

  async listPool(
    query: PoolListQueryDto,
    user: GeoUserCtx,
  ): Promise<PagedResponse<KeywordPoolItemWithOpportunity>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const conditions = this.buildPoolWhere(query, user);

    const baseQuery = this.db
      .select({
        id: geoKeywordPool.id,
        brandId: geoKeywordPool.brandId,
        keyword: geoKeywordPool.keyword,
        keywordType: geoKeywordPool.keywordType,
        groupId: geoKeywordPool.groupId,
        groupName: geoKeywordGroups.name,
        source: geoKeywordPool.source,
        searchVolume: geoKeywordPool.searchVolume,
        competition: geoKeywordPool.competition,
        addedAt: geoKeywordPool.addedAt,
        creatorId: geoKeywordPool.creatorId,
        createdAt: geoKeywordPool.createdAt,
      })
      .from(geoKeywordPool)
      .leftJoin(
        geoKeywordGroups,
        eq(geoKeywordPool.groupId, geoKeywordGroups.id),
      );

    const dataQuery = conditions.length > 0
      ? baseQuery.where(and(...conditions))
      : baseQuery;

    // 先分页取出当页关键词（opportunity 排序时后续再调整）
    const defaultOrder = [
      desc(geoKeywordPool.addedAt),
      desc(geoKeywordPool.createdAt),
    ];

    const [itemsRaw, totalResult] = await Promise.all([
      dataQuery
        .orderBy(...defaultOrder)
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db
        .select({ count: count() })
        .from(geoKeywordPool)
        .where(conditions.length > 0 ? and(...conditions) : undefined),
    ]);

    const baseItems: Array<KeywordPoolItem & { brandId: string }> = itemsRaw.map((row) => ({
      id: row.id,
      brandId: row.brandId,
      keyword: row.keyword,
      keywordType: row.keywordType as KeywordPoolItem['keywordType'],
      groupId: row.groupId,
      groupName: row.groupName ?? null,
      source: row.source as KeywordPoolItem['source'] ?? 'manual',
      searchVolume: row.searchVolume ?? null,
      competition: row.competition !== null && row.competition !== undefined
        ? Number(row.competition)
        : null,
      addedAt: row.addedAt ? new Date(row.addedAt).toISOString() : null,
      creatorId: row.creatorId,
      createdAt: new Date(row.createdAt).toISOString(),
    }));

    // 计算机会分
    const itemsWithOpportunity = await this.computeOpportunityScores(baseItems, user);

    // 如果按 opportunity 排序或 highOpportunityOnly 过滤，需要重新计算（因为分页可能受影响）
    // 简化实现：当页数据计算后在内存中排序/过滤，适用于 pageSize 不大的场景
    let finalItems = itemsWithOpportunity;
    let finalTotal = Number(totalResult[0]?.count ?? 0);

    if (query.sortBy === 'opportunity' || query.highOpportunityOnly) {
      // 需要全量计算机会分后排序/过滤再分页
      const allRows = await dataQuery.orderBy(...defaultOrder);
      const allBaseItems: Array<KeywordPoolItem & { brandId: string }> = allRows.map((row) => ({
        id: row.id,
        brandId: row.brandId,
        keyword: row.keyword,
        keywordType: row.keywordType as KeywordPoolItem['keywordType'],
        groupId: row.groupId,
        groupName: row.groupName ?? null,
        source: row.source as KeywordPoolItem['source'] ?? 'manual',
        searchVolume: row.searchVolume ?? null,
        competition: row.competition !== null && row.competition !== undefined
          ? Number(row.competition)
          : null,
        addedAt: row.addedAt ? new Date(row.addedAt).toISOString() : null,
        creatorId: row.creatorId,
        createdAt: new Date(row.createdAt).toISOString(),
      }));

      const allWithOpp = await this.computeOpportunityScores(allBaseItems, user);
      let filtered = allWithOpp;
      if (query.highOpportunityOnly) {
        filtered = allWithOpp.filter((item) => item.opportunityScore >= 60);
      }
      if (query.sortBy === 'opportunity') {
        filtered = [...filtered].sort((a, b) => b.opportunityScore - a.opportunityScore);
      }
      finalTotal = filtered.length;
      finalItems = filtered.slice((page - 1) * pageSize, page * pageSize);
    }

    return {
      items: finalItems,
      total: finalTotal,
      page,
      pageSize,
    };
  }

  // ---------- 添加单个 ----------

  async addKeyword(
    dto: AddPoolKeywordDto,
    user: GeoUserCtx,
  ): Promise<KeywordPoolItem> {
    this.ensureCanWrite(user, dto.brandId);

    const trimmedKeyword = dto.keyword.trim();
    if (!trimmedKeyword) {
      throw new BadRequestException('关键词不能为空');
    }

    // 检查同品牌下是否已存在相同关键词（业务层去重）
    const existing = await this.db
      .select({ id: geoKeywordPool.id })
      .from(geoKeywordPool)
      .where(
        and(
          eq(geoKeywordPool.brandId, dto.brandId),
          eq(geoKeywordPool.keyword, trimmedKeyword),
          eq(geoKeywordPool.keywordType, dto.keywordType),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      throw new BadRequestException('词池中已存在相同关键词');
    }

    const inserted = await this.db
      .insert(geoKeywordPool)
      .values({
        brandId: dto.brandId,
        keyword: trimmedKeyword,
        keywordType: dto.keywordType,
        groupId: dto.groupId ?? null,
        source: dto.source ?? 'manual',
        addedAt: new Date(),
        creatorId: user.id,
      })
      .returning({ id: geoKeywordPool.id });

    return this.getPoolItemById(inserted[0].id);
  }

  // ---------- 批量导入 ----------

  async batchImport(
    dto: BatchImportPoolDto,
    user: GeoUserCtx,
  ): Promise<{ added: number; skipped: number }> {
    this.ensureCanWrite(user, dto.brandId);

    const unique = new Map<string, 'core' | 'longtail'>();
    for (const item of dto.keywords) {
      const k = item.keyword.trim();
      if (!k) continue;
      unique.set(k, item.keywordType);
    }
    if (unique.size === 0) {
      throw new BadRequestException('关键词列表不能为空');
    }

    const keywords = Array.from(unique.keys());
    const keywordTypes = Array.from(unique.values());

    // 查出已存在的（brandId + keyword + keywordType 去重）
    const existingRows = await this.db
      .select({
        keyword: geoKeywordPool.keyword,
        keywordType: geoKeywordPool.keywordType,
      })
      .from(geoKeywordPool)
      .where(
        and(
          eq(geoKeywordPool.brandId, dto.brandId),
          inArray(geoKeywordPool.keyword, keywords),
        ),
      );

    const existingSet = new Set(
      existingRows.map((r) => `${r.keyword}:${r.keywordType}`),
    );

    const toInsert: Array<{
      brandId: string;
      keyword: string;
      keywordType: string;
      groupId: string | null;
      source: string;
      addedAt: Date;
      creatorId: string;
    }> = [];

    for (let i = 0; i < keywords.length; i += 1) {
      const kw = keywords[i];
      const kt = keywordTypes[i];
      const key = `${kw}:${kt}`;
      if (existingSet.has(key)) continue;
      toInsert.push({
        brandId: dto.brandId,
        keyword: kw,
        keywordType: kt,
        groupId: dto.groupId ?? null,
        source: dto.source ?? 'import',
        addedAt: new Date(),
        creatorId: user.id,
      });
    }

    if (toInsert.length === 0) {
      return { added: 0, skipped: unique.size };
    }

    const batchSize = 200;
    let insertedCount = 0;
    for (let i = 0; i < toInsert.length; i += batchSize) {
      const batch = toInsert.slice(i, i + batchSize);
      const result = await this.db
        .insert(geoKeywordPool)
        .values(batch)
        .returning({ id: geoKeywordPool.id });
      insertedCount += result.length;
    }

    return {
      added: insertedCount,
      skipped: unique.size - insertedCount,
    };
  }

  // ---------- 长尾词生成（纯模板） ----------

  async generateLongtail(
    dto: GenerateLongtailDto,
  ): Promise<GenerateLongtailResponse> {
    const city = dto.city?.trim() || '石家庄';
    const unique = new Set<string>();

    const intentTemplates = [
      '{city}{keyword}推荐',
      '{city}{keyword}哪家好',
      '{city}{keyword}价格',
      '{city}{keyword}排行',
      '{city}{keyword}多少钱',
      '{city}{keyword}哪里有卖',
    ];

    const scenarioTemplates = [
      '{city}{keyword}配送',
      '{city}{keyword}上门服务',
      '{city}{keyword}实体店',
      '{city}{keyword}培训课程',
      '{city}{keyword}加盟',
      '{city}DIY{keyword}',
    ];

    const questionTemplates = [
      '{city}{keyword}怎么样',
      '{city}{keyword}适合什么人',
      '{city}{keyword}怎么选',
      '{city}{keyword}有什么好处',
      '{city}{keyword}多少钱',
    ];

    const rankingTemplates = [
      '{city}{keyword}十大排名',
      '{city}{keyword}品牌排行榜',
    ];

    const allTemplates = [
      ...intentTemplates,
      ...scenarioTemplates,
      ...questionTemplates,
      ...rankingTemplates,
    ];

    for (const raw of dto.keywords) {
      const keyword = raw.trim();
      if (!keyword) continue;
      for (const tpl of allTemplates) {
        const result = tpl
          .replace(/\{city\}/g, city)
          .replace(/\{keyword\}/g, keyword);
        unique.add(result);
      }
    }

    return {
      keywords: Array.from(unique),
      source: 'template',
    };
  }

  // ---------- 移入词库（单条） ----------

  async moveToLibrary(
    id: string,
    user: GeoUserCtx,
  ): Promise<{ moved: number; skipped: number }> {
    const poolItem = await this.getPoolItemRawById(id);
    if (!poolItem) {
      throw new NotFoundException('词池条目不存在');
    }
    this.ensureCanWrite(user, poolItem.brandId);

    return this.doMoveToLibrary([poolItem], user);
  }

  // ---------- 批量移入词库 ----------

  async batchMoveToLibrary(
    ids: string[],
    user: GeoUserCtx,
  ): Promise<{ moved: number; skipped: number }> {
    const poolItems = await this.db
      .select({
        id: geoKeywordPool.id,
        brandId: geoKeywordPool.brandId,
        keyword: geoKeywordPool.keyword,
        keywordType: geoKeywordPool.keywordType,
        groupId: geoKeywordPool.groupId,
      })
      .from(geoKeywordPool)
      .where(inArray(geoKeywordPool.id, ids));

    if (poolItems.length === 0) {
      throw new NotFoundException('未找到有效的词池条目');
    }

    // 校验品牌权限
    const brandIds = [...new Set(poolItems.map((p) => p.brandId))];
    if (user.role === 'client' && user.brandId) {
      const allOwnBrand = brandIds.every((b) => b === user.brandId);
      if (!allOwnBrand) {
        throw new ForbiddenException('只能操作所属品牌的数据');
      }
    } else if (user.role === 'client') {
      throw new ForbiddenException('权限不足');
    }

    return this.doMoveToLibrary(poolItems, user);
  }

  // ---------- 删除 ----------

  async deletePoolItem(id: string, user: GeoUserCtx): Promise<void> {
    const poolItem = await this.getPoolItemRawById(id);
    if (!poolItem) {
      throw new NotFoundException('词池条目不存在');
    }
    this.ensureCanWrite(user, poolItem.brandId);

    const deleted = await this.db
      .delete(geoKeywordPool)
      .where(eq(geoKeywordPool.id, id))
      .returning({ id: geoKeywordPool.id });

    if (deleted.length === 0) {
      throw new NotFoundException('词池条目不存在');
    }
  }

  // ---------- 私有：执行移入词库 ----------

  private async doMoveToLibrary(
    poolItems: Array<{
      id: string;
      brandId: string;
      keyword: string;
      keywordType: string;
      groupId: string | null;
    }>,
    user: GeoUserCtx,
  ): Promise<{ moved: number; skipped: number }> {
    // 按品牌分组，分别查询词库中已存在的
    const byBrand = new Map<string, typeof poolItems>();
    for (const item of poolItems) {
      const arr = byBrand.get(item.brandId) ?? [];
      arr.push(item);
      byBrand.set(item.brandId, arr);
    }

    const existingKeys = new Set<string>();
    for (const [brandId, items] of byBrand.entries()) {
      const kwList = items.map((i) => i.keyword);
      const rows = await this.db
        .select({
          keyword: geoKeywords.keyword,
          keywordType: geoKeywords.keywordType,
          groupId: geoKeywords.groupId,
        })
        .from(geoKeywords)
        .where(
          and(
            eq(geoKeywords.brandId, brandId),
            inArray(geoKeywords.keyword, kwList),
          ),
        );
      for (const r of rows) {
        existingKeys.add(
          `${brandId}:${r.keyword}:${r.keywordType}:${r.groupId ?? ''}`,
        );
      }
    }

    const toInsert: Array<{
      brandId: string;
      keyword: string;
      keywordType: string;
      groupId: string | null;
      isExample: boolean;
    }> = [];

    const poolIdsToDelete: string[] = [];
    let skipped = 0;

    for (const item of poolItems) {
      const key = `${item.brandId}:${item.keyword}:${item.keywordType}:${item.groupId ?? ''}`;
      if (existingKeys.has(key)) {
        skipped += 1;
        // 词库已存在的，仍然从词池删除（避免重复占用词池）
        poolIdsToDelete.push(item.id);
        continue;
      }
      toInsert.push({
        brandId: item.brandId,
        keyword: item.keyword,
        keywordType: item.keywordType,
        groupId: item.groupId,
        isExample: false,
      });
      poolIdsToDelete.push(item.id);
      // 加入已有集合，防止本批次内部重复
      existingKeys.add(key);
    }

    const batchSize = 200;
    let moved = 0;

    if (toInsert.length > 0) {
      for (let i = 0; i < toInsert.length; i += batchSize) {
        const batch = toInsert.slice(i, i + batchSize);
        const result = await this.db
          .insert(geoKeywords)
          .values(batch)
          .returning({ id: geoKeywords.id });
        moved += result.length;
      }
    }

    // 从词池删除
    if (poolIdsToDelete.length > 0) {
      for (let i = 0; i < poolIdsToDelete.length; i += batchSize) {
        const batch = poolIdsToDelete.slice(i, i + batchSize);
        await this.db
          .delete(geoKeywordPool)
          .where(inArray(geoKeywordPool.id, batch));
      }
    }

    // 如果跳过的数目 + 成功插入不等于总数，说明部分插入失败（理论上不会）
    skipped = poolItems.length - moved;

    return { moved, skipped };
  }

  // ---------- 机会分计算 ----------

  private async computeOpportunityScores(
    items: Array<KeywordPoolItem & { brandId: string }>,
    user: GeoUserCtx,
  ): Promise<KeywordPoolItemWithOpportunity[]> {
    if (items.length === 0) return [];

    const itemIds = items.map((i) => i.id);
    const brandIds = [...new Set(items.map((i) => i.brandId))];
    const keywords = items.map((i) => i.keyword);

    // 1. 批量查文章覆盖：geo_articles 中 brand_id 相同且 keywords 数组包含该关键词
    // 用 SQL array overlap 查询：brand_id + keyword @> ARRAY[keyword]
    const articleRows = await this.db
      .select({
        brandId: geoArticles.brandId,
        keyword: geoArticles.keywords,
      })
      .from(geoArticles)
      .where(
        and(
          inArray(geoArticles.brandId, brandIds),
          sql`${geoArticles.keywords} && ARRAY[${sql.join(keywords.map((k) => sql`${k}`), sql`, `)}]::text[]`,
        ),
      );

    // 构建 brandId:keyword -> 是否已覆盖 的 map
    const coveredSet = new Set<string>();
    for (const row of articleRows) {
      const kwArr: string[] = Array.isArray(row.keyword) ? row.keyword : [];
      for (const kw of kwArr) {
        coveredSet.add(`${row.brandId}:${kw}`);
      }
    }

    // 2. 批量查诊断结果：每个品牌最近一份有结果的报告，查未命中/竞品提到
    // 先查每个 brand 最近一份完成的报告
    const reportRows = await this.db
      .select({
        id: geoDiagnosisReports.id,
        brandId: geoDiagnosisReports.brandId,
        createdAt: geoDiagnosisReports.createdAt,
      })
      .from(geoDiagnosisReports)
      .where(inArray(geoDiagnosisReports.brandId, brandIds))
      .orderBy(desc(geoDiagnosisReports.createdAt));

    // 每个 brand 取最新一份报告
    const latestReportByBrand = new Map<string, string>();
    for (const row of reportRows) {
      if (!latestReportByBrand.has(row.brandId)) {
        latestReportByBrand.set(row.brandId, row.id);
      }
    }

    // 查这些报告的诊断结果
    const latestReportIds = [...latestReportByBrand.values()];
    let diagnosisResults: Array<{
      reportId: string | null;
      question: string;
      isMentioned: boolean;
      otherBrands: string[] | null;
    }> = [];
    if (latestReportIds.length > 0) {
      const resultRows = await this.db
        .select({
          reportId: geoDiagnosisResults.reportId,
          question: geoDiagnosisResults.question,
          isMentioned: geoDiagnosisResults.isMentioned,
          otherBrands: geoDiagnosisResults.otherBrands,
        })
        .from(geoDiagnosisResults)
        .where(inArray(geoDiagnosisResults.reportId, latestReportIds));
      diagnosisResults = resultRows;
    }

    // 构建 reportId -> results 的 map
    const resultsByReport = new Map<string, typeof diagnosisResults>();
    for (const r of diagnosisResults) {
      if (!r.reportId) continue;
      const arr = resultsByReport.get(r.reportId) ?? [];
      arr.push(r);
      resultsByReport.set(r.reportId, arr);
    }

    // 3. 高意向关键词判断
    const HIGH_INTENT_PATTERNS = ['推荐', '对比', '口碑', '哪个好', '怎么样', '哪家好', '排行榜', '最好'];

    // 逐项计算
    return items.map((item): KeywordPoolItemWithOpportunity => {
      const reasons: string[] = [];
      let score = 0;

      // notHit：该关键词在诊断结果的 question 中出现过且 is_mentioned = false
      let notHit = false;
      const reportId = latestReportByBrand.get(item.brandId);
      if (reportId) {
        const results = resultsByReport.get(reportId) ?? [];
        const matchingResults = results.filter((r) =>
          r.question.toLowerCase().includes(item.keyword.toLowerCase()) ||
          item.keyword.toLowerCase().includes(r.question.toLowerCase()),
        );
        if (matchingResults.length > 0) {
          const anyHit = matchingResults.some((r) => r.isMentioned);
          if (!anyHit) {
            notHit = true;
            score += 40;
            reasons.push('检测未命中');
          }
        }
      }

      // competitorMentioned：匹配的问题 other_brands 非空
      let competitorMentioned = false;
      if (reportId) {
        const results = resultsByReport.get(reportId) ?? [];
        const matchingResults = results.filter((r) =>
          r.question.toLowerCase().includes(item.keyword.toLowerCase()) ||
          item.keyword.toLowerCase().includes(r.question.toLowerCase()),
        );
        if (matchingResults.some((r) => r.otherBrands && r.otherBrands.length > 0)) {
          competitorMentioned = true;
          score += 25;
          reasons.push('竞品已布局');
        }
      }

      // highIntent：keyword_type 为 question 类或包含高意向词
      let highIntent = false;
      if (item.keywordType === 'question' as any ||
          HIGH_INTENT_PATTERNS.some((p) => item.keyword.includes(p))) {
        highIntent = true;
        score += 20;
        reasons.push('高意向问题');
      }

      // hasContentCovered：无内容覆盖（文章中没有该关键词）
      const hasContentCovered = coveredSet.has(`${item.brandId}:${item.keyword}`);
      if (!hasContentCovered) {
        score += 15;
        reasons.push('无内容覆盖');
      }

      return {
        ...item,
        opportunityScore: score,
        opportunityReasons: reasons,
        hasContentCovered,
        competitorMentioned,
        notHit,
        highIntent,
      };
    });
  }

  // ---------- 辅助方法 ----------

  private async getPoolItemById(id: string): Promise<KeywordPoolItem> {
    const rows = await this.db
      .select({
        id: geoKeywordPool.id,
        brandId: geoKeywordPool.brandId,
        keyword: geoKeywordPool.keyword,
        keywordType: geoKeywordPool.keywordType,
        groupId: geoKeywordPool.groupId,
        groupName: geoKeywordGroups.name,
        source: geoKeywordPool.source,
        searchVolume: geoKeywordPool.searchVolume,
        competition: geoKeywordPool.competition,
        addedAt: geoKeywordPool.addedAt,
        creatorId: geoKeywordPool.creatorId,
        createdAt: geoKeywordPool.createdAt,
      })
      .from(geoKeywordPool)
      .leftJoin(
        geoKeywordGroups,
        eq(geoKeywordPool.groupId, geoKeywordGroups.id),
      )
      .where(eq(geoKeywordPool.id, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('词池条目不存在');
    }

    const row = rows[0];
    return {
      id: row.id,
      brandId: row.brandId,
      keyword: row.keyword,
      keywordType: row.keywordType as KeywordPoolItem['keywordType'],
      groupId: row.groupId,
      groupName: row.groupName ?? null,
      source: row.source as KeywordPoolItem['source'] ?? 'manual',
      searchVolume: row.searchVolume ?? null,
      competition: row.competition !== null && row.competition !== undefined
        ? Number(row.competition)
        : null,
      addedAt: row.addedAt ? new Date(row.addedAt).toISOString() : null,
      creatorId: row.creatorId,
      createdAt: new Date(row.createdAt).toISOString(),
    };
  }

  private async getPoolItemRawById(
    id: string,
  ): Promise<{
    id: string;
    brandId: string;
    keyword: string;
    keywordType: string;
    groupId: string | null;
  } | null> {
    const rows = await this.db
      .select({
        id: geoKeywordPool.id,
        brandId: geoKeywordPool.brandId,
        keyword: geoKeywordPool.keyword,
        keywordType: geoKeywordPool.keywordType,
        groupId: geoKeywordPool.groupId,
      })
      .from(geoKeywordPool)
      .where(eq(geoKeywordPool.id, id))
      .limit(1);

    return rows[0] ?? null;
  }

  private buildPoolWhere(
    query: PoolListQueryDto,
    user: GeoUserCtx,
  ): ReturnType<typeof eq>[] {
    const conditions: ReturnType<typeof eq>[] = [];

    // client 角色强制按 brandId 过滤
    if (user.role === 'client' && user.brandId) {
      conditions.push(eq(geoKeywordPool.brandId, user.brandId));
    } else if (query.brandId) {
      conditions.push(eq(geoKeywordPool.brandId, query.brandId));
    }

    if (query.keywordType) {
      conditions.push(eq(geoKeywordPool.keywordType, query.keywordType));
    }

    if (query.groupId) {
      conditions.push(eq(geoKeywordPool.groupId, query.groupId));
    }

    if (query.source) {
      conditions.push(eq(geoKeywordPool.source, query.source));
    }

    if (query.keyword) {
      conditions.push(
        ilike(geoKeywordPool.keyword, `%${query.keyword}%`) as ReturnType<
          typeof eq
        >,
      );
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
}
