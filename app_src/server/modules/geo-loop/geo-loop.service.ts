import { Inject, Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, inArray, desc, asc, sql, count, gte, lt } from 'drizzle-orm';
import type {
  GeoLoopOverview,
  BrandProfile,
  BrandProfileUpsertRequest,
  ContentPillar,
  PillarsByPillar,
  PillarCreateRequest,
  ContentCheck,
  ContentCheckDetail,
  ContentCheckSuggestion,
  ContentGap,
  ActionItem,
  ActionItemType,
  ActionPriority,
  PlatformWeight,
  DispatchPlan,
  DispatchOverview,
  SmartScheduleRequest,
  InternalLink,
  ExternalLink,
  ExternalLinkOverview,
  PageCheck,
  PageCheckCreateRequest,
  IndexCheck,
  WeightTier,
} from '@shared/api.interface';

import {
  geoBrandProfiles,
  geoContentPillars,
  geoContentChecks,
  geoContentGaps,
  geoActionItems,
  geoArticles,
  geoCreationTasks,
  geoPlatformWeights,
  geoDispatchPlans,
  geoInternalLinks,
  geoExternalLinks,
  geoPageChecks,
  geoIndexChecks,
  geoMediaOrders,
  geoCustomerWallets,
  geoSubmissionChannels,
  geoPublishRecords,
  geoWalletTransactions,
} from '@server/database/schema';

const PROFILE_FIELDS_TOTAL = 6;
const DEFAULT_LIST_LIMIT = 100;

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

@Injectable()
export class GeoLoopService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  // ============ 概览 ============
  async getOverview(brandId: string): Promise<GeoLoopOverview> {
    const [profileRows, pillarCountRow, publishedCountRow, checkStatsRow, gapStatsRow, actionStatsRow] =
      await Promise.all([
        this.db
          .select()
          .from(geoBrandProfiles)
          .where(eq(geoBrandProfiles.brandId, brandId))
          .limit(1),
        this.db
          .select({
            pillarCount: sql<number>`COUNT(DISTINCT ${geoContentPillars.pillarTopic})`,
            subTopicCount: count(),
          })
          .from(geoContentPillars)
          .where(eq(geoContentPillars.brandId, brandId)),
        this.db
          .select({ count: count() })
          .from(geoArticles)
          .where(
            and(
              eq(geoArticles.brandId, brandId),
              eq(geoArticles.status, 'published'),
            ),
          ),
        this.db
          .select({
            count: count(),
            avgScore: sql<number>`AVG(${geoContentChecks.overallScore})`,
          })
          .from(geoContentChecks)
          .innerJoin(
            geoArticles,
            eq(geoContentChecks.articleId, geoArticles.id),
          )
          .where(eq(geoArticles.brandId, brandId)),
        this.db
          .select({
            openCount: sql<number>`SUM(CASE WHEN ${geoContentGaps.status} = 'open' THEN 1 ELSE 0 END)`,
            highCount: sql<number>`SUM(CASE WHEN ${geoContentGaps.status} = 'open' AND ${geoContentGaps.priority} = 'high' THEN 1 ELSE 0 END)`,
          })
          .from(geoContentGaps)
          .where(eq(geoContentGaps.brandId, brandId)),
        this.db
          .select({
            pendingCount: sql<number>`SUM(CASE WHEN ${geoActionItems.status} = 'pending' THEN 1 ELSE 0 END)`,
            highCount: sql<number>`SUM(CASE WHEN ${geoActionItems.status} = 'pending' AND ${geoActionItems.priority} = 'high' THEN 1 ELSE 0 END)`,
          })
          .from(geoActionItems)
          .where(eq(geoActionItems.brandId, brandId)),
      ]);

    const profile = profileRows[0];
    let profileFieldsDone = 0;
    if (profile) {
      if (profile.positioningTagline && profile.positioningTagline.trim()) profileFieldsDone++;
      if (profile.industry && profile.industry.trim()) profileFieldsDone++;
      if (profile.targetAudience && profile.targetAudience.trim()) profileFieldsDone++;
      if (profile.sellingPoints && profile.sellingPoints.length > 0) profileFieldsDone++;
      if (profile.forbiddenPhrases && profile.forbiddenPhrases.trim()) profileFieldsDone++;
      if (profile.topQuestions && profile.topQuestions.length > 0) profileFieldsDone++;
    }

    const pillarCount = Number(pillarCountRow[0]?.pillarCount ?? 0);
    const subTopicCount = Number(pillarCountRow[0]?.subTopicCount ?? 0);
    const publishedArticleCount = Number(publishedCountRow[0]?.count ?? 0);
    const checkedArticleCount = Number(checkStatsRow[0]?.count ?? 0);
    const avgStructureScore = checkStatsRow[0]?.avgScore
      ? Math.round(Number(checkStatsRow[0].avgScore))
      : 0;

    const openGapCount = Number(gapStatsRow[0]?.openCount ?? 0);
    const highPriorityGapCount = Number(gapStatsRow[0]?.highCount ?? 0);
    const pendingActionCount = Number(actionStatsRow[0]?.pendingCount ?? 0);
    const highPriorityActionCount = Number(actionStatsRow[0]?.highCount ?? 0);

    return {
      brandId,
      step1: {
        profileCompleted: profileFieldsDone === PROFILE_FIELDS_TOTAL,
        profileFieldsDone,
        profileFieldsTotal: PROFILE_FIELDS_TOTAL,
        pillarCount,
        subTopicCount,
        publishedArticleCount,
        checkedArticleCount,
        avgStructureScore,
      },
      step2: { status: 'upcoming' },
      step3: { status: 'upcoming' },
      step4: {
        openGapCount,
        highPriorityGapCount,
        pendingActionCount,
        highPriorityActionCount,
      },
    };
  }

  // ============ 品牌定位档案 ============
  async getBrandProfile(brandId: string): Promise<BrandProfile | null> {
    const rows = await this.db
      .select()
      .from(geoBrandProfiles)
      .where(eq(geoBrandProfiles.brandId, brandId))
      .limit(1);
    if (rows.length === 0) return null;
    const row = rows[0];
    return this.mapBrandProfile(row);
  }

  async upsertBrandProfile(
    dto: BrandProfileUpsertRequest,
  ): Promise<BrandProfile> {
    const existing = await this.db
      .select({ id: geoBrandProfiles.id })
      .from(geoBrandProfiles)
      .where(eq(geoBrandProfiles.brandId, dto.brandId))
      .limit(1);

    if (existing.length > 0) {
      await this.db
        .update(geoBrandProfiles)
        .set({
          positioningTagline: dto.positioningTagline ?? null,
          industry: dto.industry ?? null,
          targetAudience: dto.targetAudience ?? null,
          sellingPoints: dto.sellingPoints,
          forbiddenPhrases: dto.forbiddenPhrases ?? null,
          topQuestions: dto.topQuestions,
        })
        .where(eq(geoBrandProfiles.id, existing[0].id));
      return this.getBrandProfile(dto.brandId) as Promise<BrandProfile>;
    }

    const inserted = await this.db
      .insert(geoBrandProfiles)
      .values({
        brandId: dto.brandId,
        positioningTagline: dto.positioningTagline ?? null,
        industry: dto.industry ?? null,
        targetAudience: dto.targetAudience ?? null,
        sellingPoints: dto.sellingPoints,
        forbiddenPhrases: dto.forbiddenPhrases ?? null,
        topQuestions: dto.topQuestions,
      })
      .returning({ id: geoBrandProfiles.id });

    if (inserted.length === 0) {
      throw new Error('Failed to create brand profile');
    }
    return this.getBrandProfile(dto.brandId) as Promise<BrandProfile>;
  }

  private mapBrandProfile(row: typeof geoBrandProfiles.$inferSelect): BrandProfile {
    return {
      id: row.id,
      brandId: row.brandId,
      positioningTagline: row.positioningTagline ?? undefined,
      industry: row.industry ?? undefined,
      targetAudience: row.targetAudience ?? undefined,
      sellingPoints: row.sellingPoints ?? [],
      forbiddenPhrases: row.forbiddenPhrases ?? undefined,
      topQuestions: row.topQuestions ?? [],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  // ============ 内容矩阵 ============
  async getPillarsGrouped(brandId: string): Promise<PillarsByPillar[]> {
    const pillars = await this.db
      .select()
      .from(geoContentPillars)
      .where(eq(geoContentPillars.brandId, brandId))
      .limit(DEFAULT_LIST_LIMIT)
      .orderBy(geoContentPillars.pillarTopic, geoContentPillars.createdAt);

    const groups = new Map<string, PillarsByPillar>();
    for (const row of pillars) {
      const pillar = this.mapContentPillar(row);
      const key = pillar.pillarTopic;
      if (!groups.has(key)) {
        groups.set(key, {
          pillarTopic: key,
          subTopics: [],
          total: 0,
          publishedCount: 0,
        });
      }
      const group = groups.get(key)!;
      group.subTopics.push(pillar);
      group.total += 1;
      if (pillar.status === 'published') {
        group.publishedCount += 1;
      }
    }
    return Array.from(groups.values());
  }

  async createPillar(dto: PillarCreateRequest): Promise<ContentPillar> {
    const inserted = await this.db
      .insert(geoContentPillars)
      .values({
        brandId: dto.brandId,
        pillarTopic: dto.pillarTopic,
        subTopic: dto.subTopic,
        coverKeywords: dto.coverKeywords ?? [],
        targetQuestion: dto.targetQuestion ?? null,
        contentType: dto.contentType ?? 'article',
      })
      .returning({ id: geoContentPillars.id });

    if (inserted.length === 0) {
      throw new Error('Failed to create pillar');
    }
    const rows = await this.db
      .select()
      .from(geoContentPillars)
      .where(eq(geoContentPillars.id, inserted[0].id))
      .limit(1);
    return this.mapContentPillar(rows[0]);
  }

  async deletePillar(id: string): Promise<void> {
    const deleted = await this.db
      .delete(geoContentPillars)
      .where(eq(geoContentPillars.id, id))
      .returning({ id: geoContentPillars.id });
    if (deleted.length === 0) {
      throw new NotFoundException('子话题不存在');
    }
  }

  async dispatchPillarTasks(
    pillarIds: string[],
    brandId: string,
    creatorId: string,
  ): Promise<{ count: number }> {
    if (pillarIds.length === 0) {
      return { count: 0 };
    }

    const pillars = await this.db
      .select()
      .from(geoContentPillars)
      .where(
        and(
          eq(geoContentPillars.brandId, brandId),
          inArray(geoContentPillars.id, pillarIds),
        ),
      )
      .limit(DEFAULT_LIST_LIMIT);

    if (pillars.length === 0) {
      return { count: 0 };
    }

    const taskValues = pillars.map((pillar) => ({
      brandId: pillar.brandId,
      creatorId,
      taskType: 'article',
      taskName: pillar.subTopic,
      title: pillar.targetQuestion || pillar.subTopic,
      keywords: pillar.coverKeywords ?? [],
      longtailKeywords: [],
    }));

    await this.db.insert(geoCreationTasks).values(taskValues);
    await this.db
      .update(geoContentPillars)
      .set({ status: 'writing' })
      .where(inArray(geoContentPillars.id, pillarIds));

    return { count: pillars.length };
  }

  private mapContentPillar(
    row: typeof geoContentPillars.$inferSelect,
  ): ContentPillar {
    return {
      id: row.id,
      brandId: row.brandId,
      pillarTopic: row.pillarTopic,
      subTopic: row.subTopic,
      coverKeywords: row.coverKeywords ?? [],
      targetQuestion: row.targetQuestion ?? undefined,
      contentType: row.contentType,
      status: row.status as ContentPillar['status'],
      articleId: row.articleId ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }

  // ============ 内容结构检查 ============
  async getContentChecks(brandId: string): Promise<ContentCheck[]> {
    const rows = await this.db
      .select()
      .from(geoContentChecks)
      .innerJoin(
        geoArticles,
        eq(geoContentChecks.articleId, geoArticles.id),
      )
      .where(eq(geoArticles.brandId, brandId))
      .orderBy(desc(geoContentChecks.checkedAt))
      .limit(DEFAULT_LIST_LIMIT);

    return rows.map((row) =>
      this.mapContentCheck(row.geo_content_checks, row.geo_articles.title),
    );
  }

  async runContentChecks(
    articleIds: string[],
    brandId: string,
  ): Promise<{ count: number }> {
    if (articleIds.length === 0) {
      return { count: 0 };
    }

    const articles = await this.db
      .select()
      .from(geoArticles)
      .where(
        and(
          eq(geoArticles.brandId, brandId),
          inArray(geoArticles.id, articleIds),
        ),
      )
      .limit(DEFAULT_LIST_LIMIT);

    if (articles.length === 0) {
      return { count: 0 };
    }

    const now = new Date();
    for (const article of articles) {
      const { detail, overallScore, suggestions } = this.evaluateArticle(
        article.title,
        article.content,
        article.wordCount,
        article.keywords ?? [],
      );

      await this.db
        .insert(geoContentChecks)
        .values({
          articleId: article.id,
          overallScore,
          detail: detail as unknown as Record<string, unknown>,
          suggestions: { items: suggestions } as unknown as Record<string, unknown>,
          checkedAt: now,
        })
        .onConflictDoUpdate({
          target: geoContentChecks.articleId,
          set: {
            overallScore,
            detail: detail as unknown as Record<string, unknown>,
            suggestions: { items: suggestions } as unknown as Record<string, unknown>,
            checkedAt: now,
          },
        });
    }

    return { count: articles.length };
  }

  private evaluateArticle(
    title: string,
    content: string,
    wordCount: number,
    keywords: string[],
  ): {
    detail: ContentCheckDetail;
    overallScore: number;
    suggestions: ContentCheckSuggestion[];
  } {
    // 1. titleScore
    const titleLower = title.toLowerCase();
    let titleScore = 0;
    if (keywords.length > 0) {
      for (const kw of keywords) {
        if (kw && titleLower.includes(kw.toLowerCase())) {
          titleScore = 100;
          break;
        }
      }
    }

    // 2. introScore
    const firstPMatch = content.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const introText = firstPMatch ? stripHtml(firstPMatch[1]) : '';
    const introLen = introText.length;
    let introScore = 0;
    if (introLen === 0) {
      introScore = 0;
    } else if (introLen < 40) {
      introScore = 60;
    } else if (introLen <= 80) {
      introScore = 100;
    } else {
      introScore = 70;
    }

    // 3. headingScore
    const headingMatches = Array.from(content.matchAll(/<(h[23])(\s[^>]*)?>([\s\S]*?)<\/\1>/gi));
    const h2List: string[] = [];
    const h3List: string[] = [];
    for (const m of headingMatches) {
      const tag = m[1].toLowerCase();
      if (tag === 'h2') h2List.push(m[3]);
      else if (tag === 'h3') h3List.push(m[3]);
    }
    let headingScore = 0;
    const totalHeadings = h2List.length + h3List.length;
    if (totalHeadings === 0) {
      headingScore = 0;
    } else if (h2List.length === 0 && h3List.length > 0) {
      // 只有 h3 没有 h2 → 直接跳级
      headingScore = 0;
    } else if (h3List.length === 0 && h2List.length >= 1) {
      headingScore = 80;
    } else {
      // 都有，检查跳级
      let hasSkip = false;
      // 用标签顺序判断
      const orderMatches = Array.from(content.matchAll(/<(h[23])[\s>]/gi));
      let lastLevel = 1;
      for (const m of orderMatches) {
        const level = m[1] === 'h2' ? 2 : 3;
        if (level - lastLevel > 1) {
          hasSkip = true;
          break;
        }
        lastLevel = level;
      }
      headingScore = hasSkip ? 80 : 100;
    }

    // 4. faqScore
    let faqScore = 0;
    const hasFaqKeyword =
      content.includes('常见问题') ||
      content.includes('FAQ') ||
      content.includes('问答') ||
      content.includes('Q&A');
    const hasFaqElement = /\s(id|class)="[^"]*faq[^"]*"/i.test(content);
    if (hasFaqKeyword || hasFaqElement) {
      faqScore = 100;
    }

    // 5. citationScore
    let citationScore = 0;
    const hasCitationKeyword =
      content.includes('数据显示') ||
      content.includes('研究表明') ||
      content.includes('据统计') ||
      content.includes('来源') ||
      content.includes('引用');
    const hasCiteTag = /<cite[\s>]/i.test(content);
    const hasBlockquoteTag = /<blockquote[\s>]/i.test(content);
    if (hasCitationKeyword || hasCiteTag || hasBlockquoteTag) {
      citationScore = 100;
    }

    // 6. internalLinkScore
    const linkMatches = content.match(/<a[^>]*href="([^"]+)"[^>]*>/gi);
    let internalLinkCount = 0;
    if (linkMatches) {
      for (const m of linkMatches) {
        const hrefMatch = m.match(/href="([^"]+)"/i);
        if (hrefMatch) {
          const href = hrefMatch[1];
          if (href.startsWith('http') || href.startsWith('/')) {
            internalLinkCount++;
          }
        }
      }
    }
    let internalLinkScore = 0;
    if (internalLinkCount >= 2) internalLinkScore = 100;
    else if (internalLinkCount === 1) internalLinkScore = 50;
    else internalLinkScore = 0;

    // 7. wordCountScore
    let wordCountScore = 0;
    if (wordCount >= 1500) wordCountScore = 100;
    else if (wordCount >= 800) wordCountScore = 80;
    else if (wordCount >= 500) wordCountScore = 60;
    else wordCountScore = 0;

    const detail: ContentCheckDetail = {
      titleScore,
      introScore,
      headingScore,
      faqScore,
      citationScore,
      internalLinkScore,
      wordCountScore,
    };

    const weight = 1 / 7;
    const overallScore = Math.round(
      (titleScore +
        introScore +
        headingScore +
        faqScore +
        citationScore +
        internalLinkScore +
        wordCountScore) *
        weight,
    );

    // 建议：分数 < 60 的项目
    const suggestions: ContentCheckSuggestion[] = [];
    if (titleScore < 60) {
      suggestions.push({
        type: 'title',
        text: '标题建议包含核心关键词或目标问题，提升 SEO 相关性',
      });
    }
    if (introScore < 60) {
      suggestions.push({
        type: 'intro',
        text: '首段建议在40-80字内直接给出答案，符合搜索引擎摘要偏好',
      });
    }
    if (headingScore < 60) {
      suggestions.push({
        type: 'heading',
        text: '建议补充 H2/H3 标题层级且不跳级，提升内容结构可读性',
      });
    }
    if (faqScore < 60) {
      suggestions.push({
        type: 'faq',
        text: '建议增加 FAQ 或问答板块，覆盖长尾搜索意图',
      });
    }
    if (citationScore < 60) {
      suggestions.push({
        type: 'citation',
        text: '建议补充数据来源或权威引用，增强内容可信度',
      });
    }
    if (internalLinkScore < 60) {
      suggestions.push({
        type: 'internal_link',
        text: '建议增加至少 2 条内链，提升站内导航与权重传递',
      });
    }
    if (wordCountScore < 60) {
      suggestions.push({
        type: 'word_count',
        text: '建议正文不少于 800 字，深度内容更容易获得排名',
      });
    }

    return { detail, overallScore, suggestions };
  }

  private mapContentCheck(
    row: typeof geoContentChecks.$inferSelect,
    articleTitle?: string,
  ): ContentCheck {
    const detail = (row.detail ?? {}) as unknown as Partial<ContentCheckDetail>;
    const suggestionsRaw = (row.suggestions ?? { items: [] }) as {
      items: ContentCheckSuggestion[];
    };
    return {
      id: row.id,
      articleId: row.articleId,
      articleTitle,
      overallScore: row.overallScore,
      detail: {
        titleScore: detail.titleScore ?? 0,
        introScore: detail.introScore ?? 0,
        headingScore: detail.headingScore ?? 0,
        faqScore: detail.faqScore ?? 0,
        citationScore: detail.citationScore ?? 0,
        internalLinkScore: detail.internalLinkScore ?? 0,
        wordCountScore: detail.wordCountScore ?? 0,
      },
      suggestions: {
        items: suggestionsRaw.items ?? [],
      },
      checkedAt: row.checkedAt.toISOString(),
    };
  }

  // ============ 竞对差距 ============
  async getGaps(brandId: string, keyword?: string): Promise<ContentGap[]> {
    const whereConditions = [eq(geoContentGaps.brandId, brandId)];
    if (keyword && keyword.trim()) {
      whereConditions.push(
        sql`${geoContentGaps.keyword} ILIKE ${`%${keyword}%`}`,
      );
    }

    const rows = await this.db
      .select()
      .from(geoContentGaps)
      .where(and(...whereConditions))
      .orderBy(desc(geoContentGaps.createdAt))
      .limit(DEFAULT_LIST_LIMIT);

    return rows.map((row) => this.mapContentGap(row));
  }

  async dispatchGapTasks(
    gapIds: string[],
    brandId: string,
    creatorId: string,
  ): Promise<{ count: number; tasks: Array<{ gapId: string; title: string }> }> {
    if (gapIds.length === 0) {
      return { count: 0, tasks: [] };
    }

    const gaps = await this.db
      .select()
      .from(geoContentGaps)
      .where(
        and(
          eq(geoContentGaps.brandId, brandId),
          inArray(geoContentGaps.id, gapIds),
        ),
      )
      .limit(DEFAULT_LIST_LIMIT);

    if (gaps.length === 0) {
      return { count: 0, tasks: [] };
    }

    const taskValues = gaps.map((gap) => ({
      brandId: gap.brandId,
      creatorId,
      taskType: 'article',
      taskName: gap.keyword,
      title: `${gap.keyword}深度解析`,
      keywords: [gap.keyword],
      longtailKeywords: [],
    }));

    await this.db.insert(geoCreationTasks).values(taskValues);
    await this.db
      .update(geoContentGaps)
      .set({ status: 'dispatched' })
      .where(inArray(geoContentGaps.id, gapIds));

    const tasks = gaps.map((gap) => ({
      gapId: gap.id,
      title: `${gap.keyword}深度解析`,
    }));

    return { count: gaps.length, tasks };
  }

  private mapContentGap(
    row: typeof geoContentGaps.$inferSelect,
  ): ContentGap {
    return {
      id: row.id,
      brandId: row.brandId,
      keyword: row.keyword,
      ourCited: row.ourCited,
      ourSourceDomain: row.ourSourceDomain ?? undefined,
      competitorName: row.competitorName,
      competitorDomain: row.competitorDomain ?? undefined,
      gapType: row.gapType,
      priority: row.priority as ContentGap['priority'],
      status: row.status as ContentGap['status'],
      articleId: row.articleId ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }

  // ============ 优化建议 ============
  async getActionItems(brandId: string): Promise<ActionItem[]> {
    const rows = await this.db
      .select()
      .from(geoActionItems)
      .where(eq(geoActionItems.brandId, brandId))
      .orderBy(
        sql`CASE ${geoActionItems.priority}
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
          ELSE 4
        END`,
        desc(geoActionItems.createdAt),
      )
      .limit(DEFAULT_LIST_LIMIT);

    return rows.map((row) => this.mapActionItem(row));
  }

  async adoptActionItems(
    brandId: string,
  ): Promise<{ count: number }> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      lowScoreChecks,
      plannedPillars,
      highPriorityGaps,
      recentPublishedCount,
    ] = await Promise.all([
      this.db
        .select({
          id: geoContentChecks.id,
          overallScore: geoContentChecks.overallScore,
          articleId: geoContentChecks.articleId,
          title: geoArticles.title,
        })
        .from(geoContentChecks)
        .innerJoin(
          geoArticles,
          eq(geoContentChecks.articleId, geoArticles.id),
        )
        .where(
          and(
            eq(geoArticles.brandId, brandId),
            lt(geoContentChecks.overallScore, 70),
          ),
        )
        .limit(DEFAULT_LIST_LIMIT),
      this.db
        .select()
        .from(geoContentPillars)
        .where(
          and(
            eq(geoContentPillars.brandId, brandId),
            eq(geoContentPillars.status, 'planned'),
          ),
        )
        .limit(DEFAULT_LIST_LIMIT),
      this.db
        .select()
        .from(geoContentGaps)
        .where(
          and(
            eq(geoContentGaps.brandId, brandId),
            eq(geoContentGaps.status, 'open'),
            eq(geoContentGaps.priority, 'high'),
          ),
        )
        .limit(DEFAULT_LIST_LIMIT),
      this.db
        .select({ count: count() })
        .from(geoArticles)
        .where(
          and(
            eq(geoArticles.brandId, brandId),
            eq(geoArticles.status, 'published'),
            gte(geoArticles.createdAt, thirtyDaysAgo),
          ),
        ),
    ]);

    const candidateItems: Array<{
      title: string;
      itemType: ActionItemType;
      priority: ActionPriority;
      source: 'auto' | 'manual';
      relatedGapId?: string;
      relatedCheckId?: string;
    }> = [];

    // a. 结构检查低分文章
    for (const check of lowScoreChecks) {
      candidateItems.push({
        title: `重写低分文章：${check.title}`,
        itemType: 'structure',
        priority: check.overallScore < 50 ? 'high' : 'medium',
        source: 'auto',
        relatedCheckId: check.id,
      });
    }

    // b. 矩阵有机无内容：每3条集中生成一条
    const plannedCount = plannedPillars.length;
    if (plannedCount >= 3) {
      const batchCount = Math.floor(plannedCount / 3);
      for (let i = 0; i < batchCount; i++) {
        candidateItems.push({
          title: '补充子话题内容',
          itemType: 'content',
          priority: 'medium',
          source: 'auto',
        });
      }
    }

    // c. 差距清单高优先级
    for (const gap of highPriorityGaps) {
      candidateItems.push({
        title: `补竞对覆盖：${gap.keyword}`,
        itemType: 'content',
        priority: 'high',
        source: 'auto',
        relatedGapId: gap.id,
      });
    }

    // d. 发布节奏低
    const recentPubCount = Number(recentPublishedCount[0]?.count ?? 0);
    if (recentPubCount < 4) {
      candidateItems.push({
        title: '提高内容发布频次',
        itemType: 'distribution',
        priority: 'medium',
        source: 'auto',
      });
    }

    // 去重：按 title + brandId 去重
    const existingItems = await this.db
      .select({ title: geoActionItems.title })
      .from(geoActionItems)
      .where(eq(geoActionItems.brandId, brandId))
      .limit(DEFAULT_LIST_LIMIT);

    const existingTitles = new Set(existingItems.map((r) => r.title));
    const newItems = candidateItems.filter(
      (item) => !existingTitles.has(item.title),
    );

    if (newItems.length === 0) {
      return { count: 0 };
    }

    await this.db.insert(geoActionItems).values(
      newItems.map((item) => ({
        brandId,
        source: item.source,
        title: item.title,
        itemType: item.itemType,
        priority: item.priority,
        relatedGapId: item.relatedGapId ?? null,
        relatedCheckId: item.relatedCheckId ?? null,
      })),
    );

    return { count: newItems.length };
  }

  async updateActionItemStatus(
    id: string,
    status: 'pending' | 'in_progress' | 'done',
  ): Promise<void> {
    const updated = await this.db
      .update(geoActionItems)
      .set({ status })
      .where(eq(geoActionItems.id, id))
      .returning({ id: geoActionItems.id });
    if (updated.length === 0) {
      throw new NotFoundException('建议项不存在');
    }
  }

  private mapActionItem(
    row: typeof geoActionItems.$inferSelect,
  ): ActionItem {
    return {
      id: row.id,
      brandId: row.brandId,
      source: (row.source === 'auto' || row.source === 'manual'
        ? row.source
        : 'auto') as ActionItem['source'],
      title: row.title,
      itemType: row.itemType as ActionItemType,
      priority: row.priority as ActionPriority,
      ownerUserId: row.ownerUserId ?? undefined,
      dueDate: row.dueDate ?? undefined,
      status: row.status as ActionItem['status'],
      relatedGapId: row.relatedGapId ?? undefined,
      relatedCheckId: row.relatedCheckId ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }

  // ============ 分发节奏 · 概览 ============
  async getDispatchOverview(brandId: string): Promise<DispatchOverview> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthStartIso = monthStart.toISOString();
    const monthEndIso = monthEnd.toISOString();

    const [totalRow, publishedRow, tierRows] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(geoDispatchPlans)
        .where(
          and(
            eq(geoDispatchPlans.brandId, brandId),
            gte(geoDispatchPlans.planDate, monthStartIso.slice(0, 10)),
            lt(geoDispatchPlans.planDate, monthEndIso.slice(0, 10)),
          ),
        ),
      this.db
        .select({ count: count() })
        .from(geoPublishRecords)
        .where(
          and(
            eq(geoPublishRecords.brandId, brandId),
            eq(geoPublishRecords.status, 'published'),
            gte(geoPublishRecords.createdAt, monthStart),
            lt(geoPublishRecords.createdAt, monthEnd),
          ),
        ),
      this.db
        .select({
          tier: geoDispatchPlans.weightTier,
          count: count(),
        })
        .from(geoDispatchPlans)
        .where(
          and(
            eq(geoDispatchPlans.brandId, brandId),
            gte(geoDispatchPlans.planDate, monthStartIso.slice(0, 10)),
            lt(geoDispatchPlans.planDate, monthEndIso.slice(0, 10)),
          ),
        )
        .groupBy(geoDispatchPlans.weightTier),
    ]);

    const tierDistribution: { A: number; B: number; C: number } = { A: 0, B: 0, C: 0 };
    for (const row of tierRows) {
      const t = row.tier as WeightTier | null;
      if (t && (t === 'A' || t === 'B' || t === 'C')) {
        tierDistribution[t] = Number(row.count);
      }
    }

    return {
      monthlyPlanned: Number(totalRow[0]?.count ?? 0),
      monthlyPublished: Number(publishedRow[0]?.count ?? 0),
      tierDistribution,
    };
  }

  // ============ 分发节奏 · 平台权重 ============
  async getPlatformWeights(
    brandId: string,
    tier?: WeightTier,
  ): Promise<PlatformWeight[]> {
    const whereConditions = [];
    // brandId is not in geo_platform_weights table (it's a global reference table)
    // We keep brandId param for API consistency but the table is brand-agnostic
    void brandId;
    if (tier) {
      whereConditions.push(eq(geoPlatformWeights.weightTier, tier));
    }

    const rows = await this.db
      .select()
      .from(geoPlatformWeights)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(asc(geoPlatformWeights.domain))
      .limit(DEFAULT_LIST_LIMIT);

    return rows.map((row) => this.mapPlatformWeight(row));
  }

  private mapPlatformWeight(
    row: typeof geoPlatformWeights.$inferSelect,
  ): PlatformWeight {
    return {
      id: row.id,
      domain: row.domain,
      weightTier: (row.weightTier ?? 'B') as WeightTier,
      indexRate: row.indexRate != null ? Number(row.indexRate) : undefined,
      citationRate: row.citationRate != null ? Number(row.citationRate) : undefined,
      aiPlatforms: row.aiPlatforms ?? [],
      collectedAt: row.collectedAt ?? undefined,
    };
  }

  // ============ 分发节奏 · 计划列表 ============
  async getDispatchPlans(
    brandId: string,
    startDate: string,
    endDate: string,
  ): Promise<DispatchPlan[]> {
    // endDate + 1 day for half-open interval [startDate, endDate+1)
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1);
    const endPlusOne = end.toISOString().slice(0, 10);

    const rows = await this.db
      .select()
      .from(geoDispatchPlans)
      .where(
        and(
          eq(geoDispatchPlans.brandId, brandId),
          gte(geoDispatchPlans.planDate, startDate),
          lt(geoDispatchPlans.planDate, endPlusOne),
        ),
      )
      .orderBy(asc(geoDispatchPlans.planDate))
      .limit(DEFAULT_LIST_LIMIT);

    return rows.map((row) => this.mapDispatchPlan(row));
  }

  private mapDispatchPlan(
    row: typeof geoDispatchPlans.$inferSelect,
  ): DispatchPlan {
    return {
      id: row.id,
      brandId: row.brandId,
      planDate: row.planDate,

      channelId: row.channelId ?? undefined,
      articleId: row.articleId ?? undefined,
      status: row.status as DispatchPlan['status'],
      orderId: row.orderId ?? undefined,
      channelName: row.channelName ?? undefined,
      weightTier: (row.weightTier ?? undefined) as WeightTier | undefined,
      title: row.title ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }

  // ============ 分发节奏 · 智能排期 ============
  async smartSchedule(dto: SmartScheduleRequest): Promise<DispatchPlan[]> {
    const { brandId, totalArticles, weeks, perWeek, tiers } = dto;
    const actualTotal = Math.min(totalArticles, weeks * perWeek);

    // Get platform pool by tiers
    const platformRows = await this.db
      .select()
      .from(geoPlatformWeights)
      .where(inArray(geoPlatformWeights.weightTier, tiers))
      .limit(DEFAULT_LIST_LIMIT);

    if (platformRows.length === 0) {
      return [];
    }

    // Calculate next Monday
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sunday, 1=Monday
    const daysUntilNextMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilNextMonday);
    nextMonday.setHours(0, 0, 0, 0);

    // Generate schedule
    const plans: Array<{
      brandId: string;
      planDate: string;
      channelId: string | null;
      channelName: string;
      weightTier: string;
      status: string;
      title: string;
    }> = [];

    let scheduled = 0;
    const weekdays = [0, 1, 2, 3, 4]; // Mon-Fri offsets

    for (let w = 0; w < weeks && scheduled < actualTotal; w++) {
      // Shuffle weekdays for this week for variety
      const shuffledDays = [...weekdays].sort(() => Math.random() - 0.5);
      const perWeekActual = Math.min(perWeek, actualTotal - scheduled);

      // Pick channels for this week, ensuring no duplicates per day
      const dayChannelPool: Map<number, typeof platformRows> = new Map();
      for (const d of shuffledDays) {
        // Fresh pool each day (but same channel can be used on different days)
        dayChannelPool.set(d, [...platformRows]);
      }

      for (let i = 0; i < perWeekActual && scheduled < actualTotal; i++) {
        const dayOffset = shuffledDays[i % shuffledDays.length];
        const pool = dayChannelPool.get(dayOffset)!;
        if (pool.length === 0) continue;

        const randIdx = Math.floor(Math.random() * pool.length);
        const platform = pool[randIdx];
        pool.splice(randIdx, 1); // Remove to avoid same channel on same day

        const planDate = new Date(nextMonday);
        planDate.setDate(nextMonday.getDate() + w * 7 + dayOffset);
        const dateStr = planDate.toISOString().slice(0, 10);

        plans.push({
          brandId,
          planDate: dateStr,
          channelId: platform.channelId ?? null,
          channelName: platform.domain,
          weightTier: platform.weightTier ?? 'B',
          status: 'planned',
          title: `分发任务 ${scheduled + 1}`,
        });
        scheduled++;
      }
    }

    if (plans.length === 0) {
      return [];
    }

    const inserted = await this.db
      .insert(geoDispatchPlans)
      .values(plans)
      .returning();

    return inserted.map((row) => this.mapDispatchPlan(row));
  }

  // ============ 分发节奏 · 转下单 ============
  private async resolveDispatchPlanChannels(
    db: PostgresJsDatabase,
    plans: { id: string; channelId: string | null; channelName: string | null }[],
  ): Promise<Map<string, { channelId: string; priceCents: number; channelName: string; costPriceCents: number; supplierId: string | null }>> {
    const result = new Map<string, { channelId: string; priceCents: number; channelName: string; costPriceCents: number; supplierId: string | null }>();
    if (plans.length === 0) return result;

    // 第一级：channel_id 精确关联 geo_platform_weights → geo_submission_channels
    const platformIds = plans
      .map((p) => p.channelId)
      .filter((id): id is string => !!id);

    const platformPriceMap = new Map<string, { channelId: string; priceCents: number; channelName: string; costPriceCents: number; supplierId: string | null }>();
    if (platformIds.length > 0) {
      const channelRows = await db
        .select({
          platformId: geoPlatformWeights.id,
          channelId: geoSubmissionChannels.id,
          salePriceCents: geoSubmissionChannels.salePriceCents,
          costPriceCents: geoSubmissionChannels.costPriceCents,
          supplierId: geoSubmissionChannels.supplierId,
          channelName: geoSubmissionChannels.name,
        })
        .from(geoPlatformWeights)
        .innerJoin(
          geoSubmissionChannels,
          eq(geoSubmissionChannels.id, geoPlatformWeights.channelId ?? ''),
        )
        .where(inArray(geoPlatformWeights.id, platformIds));

      for (const row of channelRows) {
        if (row.salePriceCents && row.salePriceCents > 0) {
          platformPriceMap.set(row.platformId, {
            channelId: row.channelId,
            priceCents: row.salePriceCents,
            costPriceCents: row.costPriceCents ?? 0,
            supplierId: row.supplierId ?? null,
            channelName: row.channelName,
          });
        }
      }
    }

    // 收集未通过 channel_id 匹配上的计划，走第二级：channel_name 前缀匹配
    const nameMatchCandidates: { id: string; channelName: string }[] = [];
    for (const plan of plans) {
      if (plan.channelId && platformPriceMap.has(plan.channelId)) {
        const info = platformPriceMap.get(plan.channelId)!;
        result.set(plan.id, info);
      } else if (plan.channelName) {
        nameMatchCandidates.push({ id: plan.id, channelName: plan.channelName });
      }
    }

    if (nameMatchCandidates.length === 0) return result;

    // 第二级：用 channel_name 前缀匹配 geo_submission_channels.name
    // 对每个候选名，取 LIKE 'name%' 且售价最小的那条
    const uniqueNames = [...new Set(nameMatchCandidates.map((c) => c.channelName))];
    const namePriceMap = new Map<string, { channelId: string; priceCents: number; channelName: string; costPriceCents: number; supplierId: string | null }>();

    for (const name of uniqueNames) {
      const rows = await db
        .select({
          id: geoSubmissionChannels.id,
          name: geoSubmissionChannels.name,
          salePriceCents: geoSubmissionChannels.salePriceCents,
          costPriceCents: geoSubmissionChannels.costPriceCents,
          supplierId: geoSubmissionChannels.supplierId,
        })
        .from(geoSubmissionChannels)
        .where(
          and(
            sql`${geoSubmissionChannels.name} LIKE ${name + '%'}`,
            eq(geoSubmissionChannels.status, 'active'),
          ),
        )
        .orderBy(asc(geoSubmissionChannels.salePriceCents))
        .limit(1);

      if (rows[0]?.salePriceCents && rows[0].salePriceCents > 0) {
        namePriceMap.set(name, {
          channelId: rows[0].id,
          priceCents: rows[0].salePriceCents,
          costPriceCents: rows[0].costPriceCents ?? 0,
          supplierId: rows[0].supplierId ?? null,
          channelName: rows[0].name,
        });
      }
    }

    for (const candidate of nameMatchCandidates) {
      const info = namePriceMap.get(candidate.channelName);
      if (info) {
        result.set(candidate.id, info);
      }
    }

    return result;
  }

  async previewConvertOrders(
    brandId: string,
    planIds: string[],
  ): Promise<{
    matchedCount: number;
    unmatchedCount: number;
    totalPriceCents: number;
    balanceCents: number;
    sufficient: boolean;
  }> {
    if (planIds.length === 0) {
      const [wallet] = await this.db
        .select({ balanceCents: geoCustomerWallets.balanceCents })
        .from(geoCustomerWallets)
        .where(eq(geoCustomerWallets.brandId, brandId))
        .limit(1);
      return {
        matchedCount: 0,
        unmatchedCount: 0,
        totalPriceCents: 0,
        balanceCents: wallet?.balanceCents ?? 0,
        sufficient: true,
      };
    }

    const plans = await this.db
      .select({
        id: geoDispatchPlans.id,
        channelId: geoDispatchPlans.channelId,
        channelName: geoDispatchPlans.channelName,
      })
      .from(geoDispatchPlans)
      .where(
        and(
          inArray(geoDispatchPlans.id, planIds),
          eq(geoDispatchPlans.status, 'planned'),
          eq(geoDispatchPlans.brandId, brandId),
        ),
      );

    const channelMap = await this.resolveDispatchPlanChannels(this.db, plans);

    let totalPriceCents = 0;
    let matchedCount = 0;
    for (const plan of plans) {
      const info = channelMap.get(plan.id);
      if (info) {
        matchedCount += 1;
        totalPriceCents += info.priceCents;
      }
    }

    const [wallet] = await this.db
      .select({ balanceCents: geoCustomerWallets.balanceCents })
      .from(geoCustomerWallets)
      .where(eq(geoCustomerWallets.brandId, brandId))
      .limit(1);

    const balanceCents = wallet?.balanceCents ?? 0;
    return {
      matchedCount,
      unmatchedCount: plans.length - matchedCount,
      totalPriceCents,
      balanceCents,
      sufficient: balanceCents >= totalPriceCents,
    };
  }

  async convertToOrders(
    brandId: string,
    planIds: string[],
  ): Promise<{ success: number; failed: number; unmatched: number; totalPriceCents: number }> {
    if (planIds.length === 0) {
      return { success: 0, failed: 0, unmatched: 0, totalPriceCents: 0 };
    }

    const result = await this.db.transaction(async (tx) => {
      const plans = await tx
        .select({
          id: geoDispatchPlans.id,
          brandId: geoDispatchPlans.brandId,
          planDate: geoDispatchPlans.planDate,
          articleId: geoDispatchPlans.articleId,
          title: geoDispatchPlans.title,
          channelName: geoDispatchPlans.channelName,
          channelId: geoDispatchPlans.channelId,
        })
        .from(geoDispatchPlans)
        .where(
          and(
            inArray(geoDispatchPlans.id, planIds),
            eq(geoDispatchPlans.status, 'planned'),
            eq(geoDispatchPlans.brandId, brandId),
          ),
        );

      if (plans.length === 0) {
        return { success: 0, failed: planIds.length, unmatched: 0, totalPriceCents: 0 };
      }

      // 1. 解析每条计划对应渠道（channel_id优先，其次channel_name前缀匹配）
      const channelMap = await this.resolveDispatchPlanChannels(tx, plans);

      // 2. 计算匹配到的总价
      let totalPriceCents = 0;
      const matchedPlans: typeof plans = [];
      for (const plan of plans) {
        const info = channelMap.get(plan.id);
        if (info && info.priceCents > 0) {
          matchedPlans.push(plan);
          totalPriceCents += info.priceCents;
        }
      }

      const unmatchedCount = plans.length - matchedPlans.length;
      if (matchedPlans.length === 0) {
        return { success: 0, failed: plans.length, unmatched: unmatchedCount, totalPriceCents: 0 };
      }

      // 3. 校验钱包余额并冻结
      const [wallet] = await tx
        .select({ balanceCents: geoCustomerWallets.balanceCents })
        .from(geoCustomerWallets)
        .where(eq(geoCustomerWallets.brandId, brandId))
        .limit(1);

      if (!wallet) {
        throw new NotFoundException('钱包不存在');
      }
      if (wallet.balanceCents < totalPriceCents) {
        const shortfall = totalPriceCents - wallet.balanceCents;
        throw new ConflictException(
          `钱包余额不足，还需 ¥${(shortfall / 100).toFixed(2)}`,
        );
      }

      await tx
        .update(geoCustomerWallets)
        .set({
          balanceCents: sql`${geoCustomerWallets.balanceCents} - ${totalPriceCents}::bigint`,
          frozenCents: sql`${geoCustomerWallets.frozenCents} + ${totalPriceCents}::bigint`,
        })
        .where(
          and(
            eq(geoCustomerWallets.brandId, brandId),
            sql`${geoCustomerWallets.balanceCents} >= ${totalPriceCents}::bigint`,
          ),
        );

      // 4. 逐条创建订单并更新计划
      const now = new Date();
      let successCount = 0;

      for (const plan of matchedPlans) {
        const info = channelMap.get(plan.id)!;

        const orderNo = this.generateOrderNo();

        const timeline = [
          { status: 'paid', time: now.toISOString(), note: '分发计划转订单，已支付' },
        ];

        const [order] = await tx
          .insert(geoMediaOrders)
          .values({
            orderNo,
            brandId: plan.brandId,
            channelId: info.channelId,
            supplierId: info.supplierId ?? undefined,
            title: plan.title ?? '分发任务',
            priceCents: info.priceCents,
            costPriceCents: info.costPriceCents,
            status: 'paid',
            articleId: plan.articleId ?? undefined,
            source: 'dispatch',
            frozenAmountCents: info.priceCents,
            timeline: timeline as any,
          })
          .returning({ id: geoMediaOrders.id, orderNo: geoMediaOrders.orderNo });

        await tx
          .update(geoDispatchPlans)
          .set({
            status: 'queued',
            orderId: order.orderNo,
          })
          .where(
            and(
              eq(geoDispatchPlans.id, plan.id),
              eq(geoDispatchPlans.status, 'planned'),
            ),
          );

        successCount++;
      }

      // 5. 写钱包流水
      const [walletAfter] = await tx
        .select({ id: geoCustomerWallets.id, balanceCents: geoCustomerWallets.balanceCents })
        .from(geoCustomerWallets)
        .where(eq(geoCustomerWallets.brandId, brandId))
        .limit(1);

      if (walletAfter) {
        await tx.insert(geoWalletTransactions).values({
          walletId: walletAfter.id,
          type: 'freeze',
          amountCents: totalPriceCents,
          balanceAfterCents: walletAfter.balanceCents,
          note: `分发计划批量转订单，${successCount} 条`,
        });
      }

      return {
        success: successCount,
        failed: plans.length - successCount,
        unmatched: unmatchedCount,
        totalPriceCents,
      };
    });

    return result;
  }

  private generateOrderNo(): string {
    const now = new Date();
    const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `MD${datePart}${randomPart}`;
  }

  // ============ 收录引导 · 内链 ============
  async getInternalLinks(brandId: string): Promise<InternalLink[]> {
    const rows = await this.db
      .select()
      .from(geoInternalLinks)
      .where(eq(geoInternalLinks.brandId, brandId))
      .orderBy(desc(geoInternalLinks.createdAt))
      .limit(DEFAULT_LIST_LIMIT);

    return rows.map((row) => this.mapInternalLink(row));
  }

  async generateInternalLinks(brandId: string): Promise<{ generated: number }> {
    const [pillars, articles] = await Promise.all([
      this.db
        .select()
        .from(geoContentPillars)
        .where(eq(geoContentPillars.brandId, brandId))
        .limit(DEFAULT_LIST_LIMIT),
      this.db
        .select()
        .from(geoArticles)
        .where(
          and(
            eq(geoArticles.brandId, brandId),
            eq(geoArticles.status, 'published'),
          ),
        )
        .limit(DEFAULT_LIST_LIMIT),
    ]);

    if (pillars.length === 0 || articles.length < 2) {
      return { generated: 0 };
    }

    // Generate 5-8 suggestions
    const targetCount = Math.min(5 + Math.floor(Math.random() * 4), pillars.length, articles.length - 1);
    const suggestions: Array<{
      brandId: string;
      fromUrl: string | null;
      toUrl: string | null;
      anchorText: string | null;
      status: string;
      fromTitle: string | null;
      toTitle: string | null;
    }> = [];

    // Shuffle pillars and articles
    const shuffledPillars = [...pillars].sort(() => Math.random() - 0.5);
    const shuffledArticles = [...articles].sort(() => Math.random() - 0.5);

    for (let i = 0; i < targetCount; i++) {
      const pillar = shuffledPillars[i % shuffledPillars.length];
      const targetArticle = shuffledArticles[i % shuffledArticles.length];
      // Source article: pick another article (different from target)
      const sourceIdx = (i + 1) % shuffledArticles.length;
      const sourceArticle = shuffledArticles[sourceIdx];

      if (sourceArticle.id === targetArticle.id) continue;

      suggestions.push({
        brandId,
        fromUrl: null,
        toUrl: null,
        anchorText: pillar.subTopic,
        status: 'planned',
        fromTitle: sourceArticle.title,
        toTitle: targetArticle.title,
      });
    }

    if (suggestions.length === 0) {
      return { generated: 0 };
    }

    await this.db.insert(geoInternalLinks).values(suggestions);
    return { generated: suggestions.length };
  }

  async createInternalLink(dto: Partial<InternalLink> & { brandId: string }): Promise<InternalLink> {
    const inserted = await this.db
      .insert(geoInternalLinks)
      .values({
        brandId: dto.brandId,
        fromUrl: dto.fromUrl ?? null,
        toUrl: dto.toUrl ?? null,
        anchorText: dto.anchorText ?? null,
        status: dto.status ?? 'planned',
        note: dto.note ?? null,
        fromTitle: dto.fromTitle ?? null,
        toTitle: dto.toTitle ?? null,
      })
      .returning({ id: geoInternalLinks.id });

    if (inserted.length === 0) {
      throw new Error('Failed to create internal link');
    }

    const rows = await this.db
      .select()
      .from(geoInternalLinks)
      .where(eq(geoInternalLinks.id, inserted[0].id))
      .limit(1);
    return this.mapInternalLink(rows[0]);
  }

  async updateInternalLinkStatus(
    id: string,
    status: 'planned' | 'added' | 'indexed',
  ): Promise<InternalLink> {
    const updated = await this.db
      .update(geoInternalLinks)
      .set({ status })
      .where(eq(geoInternalLinks.id, id))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('内链记录不存在');
    }
    return this.mapInternalLink(updated[0]);
  }

  private mapInternalLink(
    row: typeof geoInternalLinks.$inferSelect,
  ): InternalLink {
    return {
      id: row.id,
      brandId: row.brandId,
      fromUrl: row.fromUrl ?? undefined,
      toUrl: row.toUrl ?? undefined,
      anchorText: row.anchorText ?? undefined,
      status: row.status as InternalLink['status'],
      note: row.note ?? undefined,
      fromTitle: row.fromTitle ?? undefined,
      toTitle: row.toTitle ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }

  // ============ 收录引导 · 外链 ============
  async getExternalLinks(brandId: string): Promise<ExternalLink[]> {
    const rows = await this.db
      .select()
      .from(geoExternalLinks)
      .where(eq(geoExternalLinks.brandId, brandId))
      .orderBy(desc(geoExternalLinks.submittedAt), desc(geoExternalLinks.createdAt))
      .limit(DEFAULT_LIST_LIMIT);

    return rows.map((row) => this.mapExternalLink(row));
  }

  async getExternalLinkOverview(brandId: string): Promise<ExternalLinkOverview> {
    const rows = await this.db
      .select({
        status: geoExternalLinks.status,
        count: count(),
      })
      .from(geoExternalLinks)
      .where(eq(geoExternalLinks.brandId, brandId))
      .groupBy(geoExternalLinks.status);

    let total = 0;
    let indexed = 0;
    let pending = 0;
    for (const row of rows) {
      const c = Number(row.count);
      total += c;
      if (row.status === 'indexed') indexed += c;
      if (row.status === 'pending') pending += c;
    }

    return { total, indexed, pending };
  }

  async createExternalLink(dto: Partial<ExternalLink> & { brandId: string; resourceName: string; resourceType: string }): Promise<ExternalLink> {
    const inserted = await this.db
      .insert(geoExternalLinks)
      .values({
        brandId: dto.brandId,
        resourceName: dto.resourceName,
        resourceType: dto.resourceType,
        domain: dto.domain ?? null,
        domainWeight: dto.domainWeight ?? null,
        linkUrl: dto.linkUrl ?? null,
        submittedAt: dto.submittedAt ?? null,
        status: dto.status ?? 'pending',
        note: dto.note ?? null,
      })
      .returning({ id: geoExternalLinks.id });

    if (inserted.length === 0) {
      throw new Error('Failed to create external link');
    }

    const rows = await this.db
      .select()
      .from(geoExternalLinks)
      .where(eq(geoExternalLinks.id, inserted[0].id))
      .limit(1);
    return this.mapExternalLink(rows[0]);
  }

  async updateExternalLinkStatus(
    id: string,
    status: 'pending' | 'indexed' | 'rejected',
  ): Promise<ExternalLink> {
    const updated = await this.db
      .update(geoExternalLinks)
      .set({ status })
      .where(eq(geoExternalLinks.id, id))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('外链记录不存在');
    }
    return this.mapExternalLink(updated[0]);
  }

  private mapExternalLink(
    row: typeof geoExternalLinks.$inferSelect,
  ): ExternalLink {
    return {
      id: row.id,
      brandId: row.brandId,
      resourceName: row.resourceName,
      resourceType: row.resourceType as ExternalLink['resourceType'],
      domain: row.domain ?? undefined,
      domainWeight: (row.domainWeight ?? undefined) as WeightTier | undefined,
      linkUrl: row.linkUrl ?? undefined,
      submittedAt: row.submittedAt ?? undefined,
      status: row.status as ExternalLink['status'],
      note: row.note ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }

  // ============ 收录引导 · 页面体检 ============
  async getPageChecks(brandId: string): Promise<PageCheck[]> {
    const rows = await this.db
      .select()
      .from(geoPageChecks)
      .where(eq(geoPageChecks.brandId, brandId))
      .orderBy(desc(geoPageChecks.checkedAt), desc(geoPageChecks.createdAt))
      .limit(20);

    return rows.map((row) => this.mapPageCheck(row));
  }

  async createPageCheck(dto: PageCheckCreateRequest): Promise<PageCheck> {
    const { score, suggestions } = this.calculatePageCheckScore(
      dto.hasJsonld,
      dto.hasFaq,
      dto.hasAnswerBlock,
      dto.hLevelOk,
      dto.internalLinkCount,
    );

    const now = new Date();
    const inserted = await this.db
      .insert(geoPageChecks)
      .values({
        brandId: dto.brandId,
        pageUrl: dto.pageUrl,
        hasJsonld: dto.hasJsonld,
        hasFaq: dto.hasFaq,
        hasAnswerBlock: dto.hasAnswerBlock,
        hLevelOk: dto.hLevelOk,
        internalLinkCount: dto.internalLinkCount,
        score,
        suggestions: suggestions as unknown as Record<string, unknown>,
        checkedAt: now,
        note: dto.note ?? null,
      })
      .returning({ id: geoPageChecks.id });

    if (inserted.length === 0) {
      throw new Error('Failed to create page check');
    }

    const rows = await this.db
      .select()
      .from(geoPageChecks)
      .where(eq(geoPageChecks.id, inserted[0].id))
      .limit(1);
    return this.mapPageCheck(rows[0]);
  }

  private calculatePageCheckScore(
    hasJsonld: boolean,
    hasFaq: boolean,
    hasAnswerBlock: boolean,
    hLevelOk: boolean,
    internalLinkCount: number,
  ): { score: number; suggestions: Record<string, string> } {
    const suggestions: Record<string, string> = {};
    let score = 0;

    // 1. JSON-LD 结构化数据 (20分)
    if (hasJsonld) {
      score += 20;
    } else {
      suggestions.jsonld = '建议添加 JSON-LD 结构化数据标记，帮助搜索引擎理解页面内容';
    }

    // 2. FAQ 板块 (20分)
    if (hasFaq) {
      score += 20;
    } else {
      suggestions.faq = '建议增加 FAQ 问答板块，覆盖长尾搜索意图，提升摘要展示机会';
    }

    // 3. 答案块 / 直接答案 (20分)
    if (hasAnswerBlock) {
      score += 20;
    } else {
      suggestions.answerBlock = '建议在首段或醒目位置给出直接答案，提升搜索摘要入选率';
    }

    // 4. 标题层级合理性 (20分)
    if (hLevelOk) {
      score += 20;
    } else {
      suggestions.hLevel = '建议优化 H1-H3 标题层级，避免跳级，提升内容结构可读性';
    }

    // 5. 内链数量 (20分)
    if (internalLinkCount >= 8) {
      score += 20;
    } else if (internalLinkCount >= 5) {
      score += 15;
      suggestions.internalLinks = '当前内链数量中等，建议补充至 8 条以上以增强权重传递';
    } else if (internalLinkCount >= 3) {
      score += 10;
      suggestions.internalLinks = '当前内链数量偏少，建议增加至 5 条以上，覆盖相关主题页面';
    } else {
      suggestions.internalLinks = '页面几乎没有内链，建议至少添加 3 条指向相关内容的内链';
    }

    return { score, suggestions };
  }

  private mapPageCheck(
    row: typeof geoPageChecks.$inferSelect,
  ): PageCheck {
    const suggestions = (row.suggestions ?? {}) as Record<string, string>;
    return {
      id: row.id,
      brandId: row.brandId,
      pageUrl: row.pageUrl,
      hasJsonld: row.hasJsonld ?? false,
      hasFaq: row.hasFaq ?? false,
      hasAnswerBlock: row.hasAnswerBlock ?? false,
      hLevelOk: row.hLevelOk ?? false,
      internalLinkCount: row.internalLinkCount ?? 0,
      score: row.score ?? undefined,
      suggestions,
      checkedAt: row.checkedAt ? row.checkedAt.toISOString() : undefined,
      note: row.note ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }

  // ============ 收录引导 · 收录提交 ============
  async getIndexChecks(brandId: string): Promise<IndexCheck[]> {
    const rows = await this.db
      .select()
      .from(geoIndexChecks)
      .where(eq(geoIndexChecks.brandId, brandId))
      .orderBy(desc(geoIndexChecks.submittedAt), desc(geoIndexChecks.createdAt))
      .limit(20);

    return rows.map((row) => this.mapIndexCheck(row));
  }

  async createIndexCheck(
    brandId: string,
    url: string,
    searchEngine: 'baidu' | 'bing' | '360' | 'doubao',
  ): Promise<IndexCheck> {
    const today = new Date().toISOString().slice(0, 10);

    const inserted = await this.db
      .insert(geoIndexChecks)
      .values({
        brandId,
        url,
        searchEngine,
        submittedAt: today,
        indexed: 'unknown',
      })
      .returning({ id: geoIndexChecks.id });

    if (inserted.length === 0) {
      throw new Error('Failed to create index check');
    }

    const rows = await this.db
      .select()
      .from(geoIndexChecks)
      .where(eq(geoIndexChecks.id, inserted[0].id))
      .limit(1);
    return this.mapIndexCheck(rows[0]);
  }

  private mapIndexCheck(
    row: typeof geoIndexChecks.$inferSelect,
  ): IndexCheck {
    return {
      id: row.id,
      brandId: row.brandId,
      url: row.url,
      searchEngine: row.searchEngine as IndexCheck['searchEngine'],
      submittedAt: row.submittedAt,
      indexed: row.indexed as IndexCheck['indexed'],
      checkedAt: row.checkedAt ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
