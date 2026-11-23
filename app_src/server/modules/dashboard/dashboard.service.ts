import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { and, eq, sql, desc, asc, ne, notInArray, isNotNull } from 'drizzle-orm';
import dayjs from 'dayjs';

import {
  geoLeads,
  geoContracts,
  geoKeywordResults,
  geoKeywords,
  geoBrands,
  geoCreationTasks,
  geoPublicationRecords,
  geoCreditAccounts,
  geoDiagnosisTasks,
  geoSubmissionQueue,
  geoIndustryNews,
  geoAiPlatformStats,
  geoAiDetectResults,
  geoAiDetectTasks,
  geoArticles,
  geoMediaOrders,
  geoDispatchPlans,
  geoPublishRecords,
} from '@server/database/schema';
import type {
  DashboardStats,
  HitRateTrend,
  PlatformHitDistribution,
  RiskRadar,
  BrandDashboardStats,
  BrandDailyTrend,
  IndustryNewsItem,
  AiPlatformStatItem,
  AiPlatformCoverage,
  WorkbenchStats,
  ActiveCustomerRow,
  HotKeywordRank,
} from '@shared/api.interface';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  async getStats(brandId: string | null, range: string = 'all'): Promise<DashboardStats> {
    const today = dayjs().format('YYYY-MM-DD');
    const in30Days = dayjs().add(30, 'day').format('YYYY-MM-DD');

    const brandFilter = brandId
      ? sql`AND brand_id = ${brandId}::uuid`
      : sql``;

    const rangeFilter = this.buildRangeFilter(range, 'detected_at');

    const rows = await this.db.execute(sql<{
      pending_followups: string;
      overdue_count: string;
      active_customers: string;
      expiring_in_30_days: string;
      keyword_total: string;
      keyword_hit: string;
    }>`
      SELECT
        (SELECT count(*) FROM geo_leads
          WHERE next_followup_date <= ${today}::date
            AND stage NOT IN ('signed', 'shelved')
            ${brandFilter}) AS pending_followups,
        (SELECT count(*) FROM geo_leads
          WHERE next_followup_date < ${today}::date
            AND stage NOT IN ('signed', 'shelved')
            ${brandFilter}) AS overdue_count,
        (SELECT count(*) FROM geo_contracts
          WHERE payment_status <> 'unpaid'
            AND service_end >= ${today}::date
            ${brandFilter}) AS active_customers,
        (SELECT count(*) FROM geo_contracts
          WHERE service_end >= ${today}::date
            AND service_end <= ${in30Days}::date
            ${brandFilter}) AS expiring_in_30_days,
        (SELECT count(*) FROM geo_keyword_results
          WHERE detected_at IS NOT NULL
            ${rangeFilter}
            ${brandFilter}) AS keyword_total,
        (SELECT count(*) FROM geo_keyword_results
          WHERE detected_at IS NOT NULL AND is_hit = true
            ${rangeFilter}
            ${brandFilter}) AS keyword_hit
    `);

    const row = rows[0];
    const total = Number(row?.keyword_total ?? 0);
    const hit = Number(row?.keyword_hit ?? 0);
    const keywordHitRate = total === 0 ? 0 : Math.round((hit / total) * 1000) / 10;

    const activeCustomerList = await this.getActiveCustomerList(brandId);

    return {
      pendingFollowups: Number(row?.pending_followups ?? 0),
      overdueCount: Number(row?.overdue_count ?? 0),
      activeCustomers: Number(row?.active_customers ?? 0),
      expiringIn30Days: Number(row?.expiring_in_30_days ?? 0),
      keywordHitRate,
      keywordTotal: total,
      activeCustomerList,
    };
  }

  async getActiveCustomerList(brandId: string | null): Promise<ActiveCustomerRow[]> {
    const today = dayjs().format('YYYY-MM-DD');
    const monthStart = dayjs().startOf('month').format('YYYY-MM-DD');
    const monthEnd = dayjs().endOf('month').format('YYYY-MM-DD');
    const in30Days = dayjs().add(30, 'day').format('YYYY-MM-DD');

    const rows = await this.db.execute(sql<{
      brand_id: string;
      brand_name: string;
      package_type: string;
      service_end: string | null;
      pub_count: string;
      kpi_target: string | null;
      kpi_hit: string | null;
    }>`
      SELECT
        b.id AS brand_id,
        b.name AS brand_name,
        COALESCE(c.package_type, 'basic') AS package_type,
        c.service_end,
        (
          SELECT COUNT(*) FROM (
            SELECT pr.id, ROW_NUMBER() OVER (
              PARTITION BY pr.brand_id, regexp_replace(COALESCE(pr.title, ''), '[^a-zA-Z0-9\u4e00-\u9fa5]', '', 'g')
              ORDER BY pr._created_at ASC
            ) as rn
            FROM ${geoPublishRecords} pr
            WHERE pr.brand_id = b.id
              AND pr.status = 'published'
              AND pr._created_at >= ${monthStart}::date
              AND pr._created_at < (${monthEnd}::date + interval '1 day')
          ) sub WHERE rn = 1
        ) AS pub_count,
        NULL AS kpi_target,
        NULL AS kpi_hit
      FROM geo_brands b
      LEFT JOIN geo_contracts c ON c.brand_id = b.id
        AND c.payment_status <> 'unpaid'
        AND c.service_end >= ${today}::date
      WHERE c.id IS NOT NULL
        ${brandId ? sql`AND b.id = ${brandId}::uuid` : sql``}
      ORDER BY c.service_end ASC
      LIMIT 20
    `);

    return rows.map((row): ActiveCustomerRow => {
      const endDate = row.service_end;
      let status: 'active' | 'expiring' | 'expired' = 'active';
      if (endDate) {
        if (endDate < today) status = 'expired';
        else if (endDate <= in30Days) status = 'expiring';
      }
      const kpiTarget = row.kpi_target ? Number(row.kpi_target) : null;
      const kpiHit = row.kpi_hit ? Number(row.kpi_hit) : null;
      return {
        brandId: String(row.brand_id),
        brandName: String(row.brand_name),
        packageType: String(row.package_type),
        monthPublications: Number(row.pub_count ?? 0),
        kpiTarget,
        kpiHitRate: kpiTarget && kpiHit ? Math.round((kpiHit / kpiTarget) * 1000) / 10 : null,
        status,
      };
    });
  }

  async getHitRateTrend(brandId: string | null): Promise<HitRateTrend[]> {
    const months: HitRateTrend[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthStr = dayjs().subtract(i, 'month').format('YYYY-MM');
      months.push({ month: monthStr, rate: 0 });
    }

    const startMonth = months[0].month + '-01';
    const startMonthIso = new Date(dayjs(startMonth).startOf('day').toISOString()).toISOString();
    const endMonthIso = new Date(
      dayjs().endOf('month').endOf('day').toISOString(),
    ).toISOString();

    const rows = await this.db
      .select({
        month: sql<string>`to_char(${geoKeywordResults.detectedAt}, 'YYYY-MM')`,
        total: sql<number>`count(*)`,
        hit: sql<number>`count(*) filter (where ${geoKeywordResults.isHit} = true)`,
      })
      .from(geoKeywordResults)
      .where(
        and(
          sql`${geoKeywordResults.detectedAt} is not null`,
          sql`${geoKeywordResults.detectedAt} >= ${startMonthIso}::timestamptz`,
          sql`${geoKeywordResults.detectedAt} <= ${endMonthIso}::timestamptz`,
          ...(brandId ? [eq(geoKeywordResults.brandId, brandId)] : []),
        ),
      )
      .groupBy(sql`to_char(${geoKeywordResults.detectedAt}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${geoKeywordResults.detectedAt}, 'YYYY-MM')`);

    const rateMap = new Map<string, number>();
    for (const row of rows) {
      const total = Number(row.total);
      const hit = Number(row.hit);
      const rate = total === 0 ? 0 : Math.round((hit / total) * 1000) / 10;
      rateMap.set(row.month, rate);
    }

    return months.map((m) => ({
      month: m.month,
      rate: rateMap.get(m.month) ?? 0,
    }));
  }

  async getPlatformDistribution(
    brandId: string | null,
    range: string = 'all',
  ): Promise<PlatformHitDistribution[]> {
    const rangeFilter = this.buildRangeFilter(range, 'detected_at');
    const brandFilter = brandId
      ? sql`AND brand_id = ${brandId}::uuid`
      : sql``;

    const rows = await this.db.execute(sql<{
      platform: string;
      total: string;
      hit: string;
    }>`
      SELECT
        platform,
        count(*) AS total,
        count(*) filter (where is_hit = true) AS hit
      FROM ${geoKeywordResults}
      WHERE detected_at IS NOT NULL
        ${rangeFilter}
        ${brandFilter}
      GROUP BY platform
    `);

    return rows.map((row: any) => ({
      platform: String(row.platform),
      hit: Number(row.hit ?? 0),
      total: Number(row.total ?? 0),
    }));
  }

  async getRisks(brandId: string | null): Promise<RiskRadar> {
    const today = dayjs().format('YYYY-MM-DD');

    // 前5个临期客户（30天内到期，按剩余天数升序）
    const expiringRows = await this.db
      .select({
        id: geoContracts.id,
        name: geoBrands.name,
        serviceEnd: geoContracts.serviceEnd,
      })
      .from(geoContracts)
      .leftJoin(geoBrands, eq(geoContracts.brandId, geoBrands.id))
      .where(
        and(
          sql`${geoContracts.serviceEnd} >= ${today}::date`,
          sql`${geoContracts.serviceEnd} <= ${dayjs()
            .add(30, 'day')
            .format('YYYY-MM-DD')}::date`,
          ...(brandId ? [eq(geoContracts.brandId, brandId)] : []),
        ),
      )
      .orderBy(asc(geoContracts.serviceEnd))
      .limit(5);

    const expiringCustomers = expiringRows.map((row) => {
      const daysLeft = dayjs(row.serviceEnd).startOf('day').diff(dayjs().startOf('day'), 'day');
      return {
        id: row.id,
        name: row.name ?? '',
        daysLeft,
      };
    });

    // 前10个未命中核心词（is_hit=false, keyword_type='core'）
    // 从 geo_keyword_results 关联 geo_keywords
    const missedRows = await this.db
      .select({
        id: geoKeywordResults.id,
        keyword: geoKeywords.keyword,
        platform: geoKeywordResults.platform,
      })
      .from(geoKeywordResults)
      .innerJoin(geoKeywords, eq(geoKeywordResults.keywordId, geoKeywords.id))
      .where(
        and(
          eq(geoKeywordResults.isHit, false),
          eq(geoKeywords.keywordType, 'core'),
          sql`${geoKeywordResults.detectedAt} is not null`,
          ...(brandId ? [eq(geoKeywordResults.brandId, brandId)] : []),
        ),
      )
      .orderBy(desc(geoKeywordResults.detectedAt))
      .limit(10);

    const missedKeywords = missedRows.map((row) => ({
      id: row.id,
      keyword: row.keyword,
      platform: row.platform,
    }));

    return { expiringCustomers, missedKeywords };
  }

  async getBrandStats(brandId: string, range: string = '7d'): Promise<BrandDashboardStats> {
    const empty: BrandDashboardStats = {
      keywordCount: 0,
      creationTaskCount: 0,
      inProgressCreationCount: 0,
      publicationCount: 0,
      creditBalance: 0,
      keywordHitRate: 0,
      pendingDiagnosisCount: 0,
      monthArticleCount: 0,
      monthImageCount: 0,
      monthVideoCount: 0,
      monthPublicationCount: 0,
      monthSubmissionCount: 0,
      monthSubmissionIndexedCount: 0,
    };

    if (!brandId) {
      return empty;
    }

    const monthStart = dayjs().startOf('month').toISOString();
    const rangeStart = this.getRangeStartIso(range);

    try {
      const result = await this.db.execute(sql<{
        keyword_count: string;
        creation_task_count: string;
        in_progress_creation_count: string;
        publication_count: string;
        pending_diagnosis_count: string;
        month_article_count: string;
        month_image_count: string;
        month_video_count: string;
        month_publication_count: string;
        month_submission_count: string;
        month_submission_indexed_count: string;
        credit_balance: string | null;
        keyword_hit_total: string;
        keyword_hit_hit: string;
      }>`
        SELECT
          COALESCE(kw.keyword_count, 0) AS keyword_count,
          COALESCE(ct.creation_task_count, 0) AS creation_task_count,
          COALESCE(ct.in_progress_creation_count, 0) AS in_progress_creation_count,
          COALESCE(pub.publication_count, 0) AS publication_count,
          COALESCE(pub.range_publication_count, 0) AS range_publication_count,
          COALESCE(pub.month_publication_count, 0) AS month_publication_count,
          COALESCE(dx.pending_diagnosis_count, 0) AS pending_diagnosis_count,
          COALESCE(ct.range_article_count, 0) AS range_article_count,
          COALESCE(ct.range_image_count, 0) AS range_image_count,
          COALESCE(ct.range_video_count, 0) AS range_video_count,
          COALESCE(ct.month_article_count, 0) AS month_article_count,
          COALESCE(ct.month_image_count, 0) AS month_image_count,
          COALESCE(ct.month_video_count, 0) AS month_video_count,
          COALESCE(sq.range_submission_count, 0) AS range_submission_count,
          COALESCE(sq.month_submission_count, 0) AS month_submission_count,
          COALESCE(sq.month_submission_indexed_count, 0) AS month_submission_indexed_count,
          cr.credit_balance AS credit_balance,
          COALESCE(kr.range_keyword_hit_total, 0) AS range_keyword_hit_total,
          COALESCE(kr.range_keyword_hit_hit, 0) AS range_keyword_hit_hit
        FROM
          (SELECT COUNT(*) AS keyword_count
           FROM ${geoKeywords}
           WHERE brand_id = ${brandId}::uuid) kw,
          (SELECT
             COUNT(*) AS creation_task_count,
             COUNT(*) FILTER (WHERE status NOT IN ('completed', 'failed')) AS in_progress_creation_count,
             COUNT(*) FILTER (WHERE task_type = 'article' AND _created_at >= ${rangeStart}::timestamptz) AS range_article_count,
             COUNT(*) FILTER (WHERE task_type = 'image' AND _created_at >= ${rangeStart}::timestamptz) AS range_image_count,
             COUNT(*) FILTER (WHERE task_type = 'video' AND _created_at >= ${rangeStart}::timestamptz) AS range_video_count,
             COUNT(*) FILTER (WHERE task_type = 'article' AND _created_at >= ${monthStart}::timestamptz) AS month_article_count,
             COUNT(*) FILTER (WHERE task_type = 'image' AND _created_at >= ${monthStart}::timestamptz) AS month_image_count,
             COUNT(*) FILTER (WHERE task_type = 'video' AND _created_at >= ${monthStart}::timestamptz) AS month_video_count
           FROM ${geoCreationTasks}
           WHERE brand_id = ${brandId}::uuid) ct,
          (SELECT
             COUNT(*) FILTER (WHERE status = 'published') AS publication_count,
             COUNT(*) FILTER (WHERE status = 'published' AND _created_at >= ${rangeStart}::timestamptz) AS range_publication_count,
             COUNT(*) FILTER (WHERE status = 'published' AND _created_at >= ${monthStart}::timestamptz) AS month_publication_count
           FROM ${geoPublicationRecords}
           WHERE brand_id = ${brandId}::uuid) pub,
          (SELECT COUNT(*) FILTER (WHERE status NOT IN ('completed', 'failed')) AS pending_diagnosis_count
           FROM ${geoDiagnosisTasks}
           WHERE brand_id = ${brandId}::uuid) dx,
          (SELECT
             COUNT(*) AS month_submission_count,
             COUNT(*) FILTER (WHERE status = 'indexed') AS month_submission_indexed_count
           FROM ${geoSubmissionQueue}
           WHERE brand_id = ${brandId}::uuid
             AND _created_at >= ${monthStart}::timestamptz) sq,
          (SELECT
             COUNT(*) AS range_submission_count
           FROM ${geoSubmissionQueue}
           WHERE brand_id = ${brandId}::uuid
             AND _created_at >= ${rangeStart}::timestamptz) sq_range,
          (SELECT balance AS credit_balance
           FROM ${geoCreditAccounts}
           WHERE brand_id = ${brandId}::uuid
           LIMIT 1) cr,
          (SELECT
             COUNT(*) AS range_keyword_hit_total,
             COUNT(*) FILTER (WHERE is_hit = true) AS range_keyword_hit_hit
           FROM ${geoKeywordResults}
           WHERE brand_id = ${brandId}::uuid
             AND detected_at IS NOT NULL
             AND detected_at >= ${rangeStart}::timestamptz) kr
      `);

      const row = result[0];
      if (!row) return empty;

      const total = Number(row.range_keyword_hit_total ?? 0);
      const hit = Number(row.range_keyword_hit_hit ?? 0);
      const keywordHitRate = total === 0 ? 0 : Math.round((hit / total) * 1000) / 10;

      return {
        keywordCount: Number(row.keyword_count ?? 0),
        creationTaskCount: Number(row.creation_task_count ?? 0),
        inProgressCreationCount: Number(row.in_progress_creation_count ?? 0),
        publicationCount: Number(row.publication_count ?? 0),
        creditBalance: Number(row.credit_balance ?? 0),
        keywordHitRate,
        pendingDiagnosisCount: Number(row.pending_diagnosis_count ?? 0),
        monthArticleCount: Number(row.month_article_count ?? 0),
        monthImageCount: Number(row.month_image_count ?? 0),
        monthVideoCount: Number(row.month_video_count ?? 0),
        monthPublicationCount: Number(row.month_publication_count ?? 0),
        monthSubmissionCount: Number(row.month_submission_count ?? 0),
        monthSubmissionIndexedCount: Number(row.month_submission_indexed_count ?? 0),
      };
    } catch (err) {
      this.logger.error(
        'getBrandStats failed',
        JSON.stringify({ brandId, err: (err as Error).message }),
      );
      return empty;
    }
  }

  async getBrandTrend(
    brandId: string,
    days: number = 30,
  ): Promise<BrandDailyTrend[]> {
    const endDate = dayjs().endOf('day');
    const startDate = dayjs().subtract(days - 1, 'day').startOf('day');
    const startIso = new Date(startDate.toISOString()).toISOString();
    const endIso = new Date(endDate.toISOString()).toISOString();

    // 生成日期骨架
    const dates: BrandDailyTrend[] = [];
    for (let i = 0; i < days; i++) {
      const dateStr = startDate.add(i, 'day').format('YYYY-MM-DD');
      dates.push({ date: dateStr, keywordCount: 0, creationCount: 0, publicationCount: 0 });
    }

    // 1. 每日新增关键词（用于累计计算）
    const keywordRows = await this.db
      .select({
        date: sql<string>`to_char(${geoKeywords.createdAt}, 'YYYY-MM-DD')`,
        count: sql<number>`count(*)`,
      })
      .from(geoKeywords)
      .where(
        and(
          eq(geoKeywords.brandId, brandId),
          sql`${geoKeywords.createdAt} >= ${startIso}::timestamptz`,
          sql`${geoKeywords.createdAt} <= ${endIso}::timestamptz`,
        ),
      )
      .groupBy(sql`to_char(${geoKeywords.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${geoKeywords.createdAt}, 'YYYY-MM-DD')`);

    // 计算截止到起始日期之前的历史关键词总数，作为累计基数
    const beforeCountResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(geoKeywords)
      .where(
        and(
          eq(geoKeywords.brandId, brandId),
          sql`${geoKeywords.createdAt} < ${startIso}::timestamptz`,
        ),
      );
    let cumulativeKeywords = Number(beforeCountResult[0]?.count ?? 0);
    const keywordDailyMap = new Map<string, number>();
    for (const row of keywordRows) {
      keywordDailyMap.set(row.date, Number(row.count));
    }

    // 2. 每日创作任务数
    const creationRows = await this.db
      .select({
        date: sql<string>`to_char(${geoCreationTasks.createdAt}, 'YYYY-MM-DD')`,
        count: sql<number>`count(*)`,
      })
      .from(geoCreationTasks)
      .where(
        and(
          eq(geoCreationTasks.brandId, brandId),
          sql`${geoCreationTasks.createdAt} >= ${startIso}::timestamptz`,
          sql`${geoCreationTasks.createdAt} <= ${endIso}::timestamptz`,
        ),
      )
      .groupBy(sql`to_char(${geoCreationTasks.createdAt}, 'YYYY-MM-DD')`);
    const creationDailyMap = new Map<string, number>();
    for (const row of creationRows) {
      creationDailyMap.set(row.date, Number(row.count));
    }

    // 3. 每日发布数
    const publicationRows = await this.db
      .select({
        date: sql<string>`to_char(${geoPublicationRecords.createdAt}, 'YYYY-MM-DD')`,
        count: sql<number>`count(*)`,
      })
      .from(geoPublicationRecords)
      .where(
        and(
          eq(geoPublicationRecords.brandId, brandId),
          eq(geoPublicationRecords.status, 'published'),
          sql`${geoPublicationRecords.createdAt} >= ${startIso}::timestamptz`,
          sql`${geoPublicationRecords.createdAt} <= ${endIso}::timestamptz`,
        ),
      )
      .groupBy(sql`to_char(${geoPublicationRecords.createdAt}, 'YYYY-MM-DD')`);
    const publicationDailyMap = new Map<string, number>();
    for (const row of publicationRows) {
      publicationDailyMap.set(row.date, Number(row.count));
    }

    // 合并到日期骨架
    for (const d of dates) {
      const dailyKeywordNew = keywordDailyMap.get(d.date) ?? 0;
      cumulativeKeywords += dailyKeywordNew;
      d.keywordCount = cumulativeKeywords;
      d.creationCount = creationDailyMap.get(d.date) ?? 0;
      d.publicationCount = publicationDailyMap.get(d.date) ?? 0;
    }

    return dates;
  }

  async getIndustryNews(dateStr?: string): Promise<IndustryNewsItem[]> {
    const now = new Date();
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const targetDate = dateStr || beijingTime.toISOString().slice(0, 10);

    const directRows = await this.db
      .select({
        id: geoIndustryNews.id,
        title: geoIndustryNews.title,
        summary: geoIndustryNews.summary,
        source: geoIndustryNews.source,
        newsDate: geoIndustryNews.newsDate,
      })
      .from(geoIndustryNews)
      .where(and(eq(geoIndustryNews.isActive, true), eq(geoIndustryNews.publishDate, targetDate)))
      .orderBy(geoIndustryNews.sortOrder)
      .limit(5);

    if (directRows.length >= 5) {
      return directRows.map((row: typeof directRows[number]) => ({
        id: row.id,
        title: row.title,
        summary: row.summary,
        source: row.source,
        newsDate: String(row.newsDate),
      }));
    }

    const dayOfYear = this.getDayOfYear(targetDate);
    const batchIndex = dayOfYear % 30;

    const dateRows = await this.db
      .select({ publishDate: geoIndustryNews.publishDate })
      .from(geoIndustryNews)
      .where(and(eq(geoIndustryNews.isActive, true), isNotNull(geoIndustryNews.publishDate)))
      .groupBy(geoIndustryNews.publishDate)
      .orderBy(geoIndustryNews.publishDate)
      .limit(30);

    let fallbackDate: string | null = null;
    if (dateRows.length > 0) {
      const idx = batchIndex % dateRows.length;
      fallbackDate = String(dateRows[idx].publishDate);
    }

    if (fallbackDate) {
      const fallbackRows = await this.db
        .select({
          id: geoIndustryNews.id,
          title: geoIndustryNews.title,
          summary: geoIndustryNews.summary,
          source: geoIndustryNews.source,
          newsDate: geoIndustryNews.newsDate,
        })
        .from(geoIndustryNews)
        .where(and(eq(geoIndustryNews.isActive, true), eq(geoIndustryNews.publishDate, fallbackDate)))
        .orderBy(geoIndustryNews.sortOrder)
        .limit(5);

      if (fallbackRows.length >= 5) {
        return fallbackRows.map((row: typeof fallbackRows[number]) => ({
          id: row.id,
          title: row.title,
          summary: row.summary,
          source: row.source,
          newsDate: targetDate,
        }));
      }
    }

    const allRows = await this.db
      .select({
        id: geoIndustryNews.id,
        title: geoIndustryNews.title,
        summary: geoIndustryNews.summary,
        source: geoIndustryNews.source,
        newsDate: geoIndustryNews.newsDate,
      })
      .from(geoIndustryNews)
      .where(eq(geoIndustryNews.isActive, true))
      .orderBy(geoIndustryNews.sortOrder)
      .limit(5);

    return allRows.map((row: typeof allRows[number]) => ({
      id: row.id,
      title: row.title,
      summary: row.summary,
      source: row.source,
      newsDate: String(row.newsDate),
    }));
  }

  private getDayOfYear(dateStr: string): number {
    const date = new Date(dateStr + 'T00:00:00+08:00');
    const start = new Date(date.getFullYear(), 0, 1);
    const diff = date.getTime() - start.getTime();
    const oneDay = 24 * 60 * 60 * 1000;
    return Math.floor(diff / oneDay) + 1;
  }

  async getAiPlatformStats(dateStr?: string): Promise<AiPlatformStatItem[]> {
    const now = new Date();
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const targetDate = dateStr || beijingTime.toISOString().slice(0, 10);

    const rows = await this.db
      .select({
        id: geoAiPlatformStats.id,
        platformName: geoAiPlatformStats.platformName,
        dauMillion: geoAiPlatformStats.dauMillion,
      })
      .from(geoAiPlatformStats)
      .where(eq(geoAiPlatformStats.isActive, true))
      .orderBy(geoAiPlatformStats.sortOrder, desc(geoAiPlatformStats.createdAt));

    return rows.map((row: { id: string; platformName: string; dauMillion: string | number }) => ({
      id: row.id,
      platformName: row.platformName,
      dauMillion: this.dailyJitter(Number(row.dauMillion), targetDate, row.platformName),
    }));
  }

  async getAiPlatformCoverage(
    brandId: string | null,
    range: string = 'all',
  ): Promise<AiPlatformCoverage[]> {
    const rangeFilter = this.buildRangeFilter(range, 'executed_at');
    const brandFilter = brandId
      ? sql`AND brand_id = ${brandId}::uuid`
      : sql``;

    const rows = await this.db.execute(sql<{
      platform: string;
      keyword_count: string;
      avg_mention_rate: string | null;
      avg_rank: string | null;
    }>`
      SELECT
        platform,
        COUNT(DISTINCT keyword) AS keyword_count,
        AVG(CASE WHEN is_mentioned THEN 1 ELSE 0 END) * 100 AS avg_mention_rate,
        AVG(mention_rank) FILTER (WHERE is_mentioned AND mention_rank IS NOT NULL) AS avg_rank
      FROM ${geoAiDetectResults}
      WHERE executed_at IS NOT NULL
        ${rangeFilter}
        ${brandFilter}
      GROUP BY platform
      ORDER BY keyword_count DESC
      LIMIT 10
    `);

    return rows.map((row: any) => ({
      platform: String(row.platform),
      platformLabel: String(row.platform),
      keywordCount: Number(row.keyword_count ?? 0),
      avgMentionRate: Number(row.avg_mention_rate ?? 0),
      avgRank: row.avg_rank != null ? Number(row.avg_rank) : null,
    }));
  }

  async getHotKeywords(
    brandId: string | null,
    range: string = 'all',
    platform?: string,
    limit: number = 10,
  ): Promise<HotKeywordRank[]> {
    const rangeFilter = this.buildRangeFilter(range, 'executed_at');
    const brandFilter = brandId
      ? sql`AND brand_id = ${brandId}::uuid`
      : sql``;
    const platformFilter = platform
      ? sql`AND platform = ${platform}`
      : sql``;

    const rows = await this.db.execute(sql<{
      keyword: string;
      platform: string;
      rank: string | null;
    }>`
      SELECT DISTINCT ON (keyword, platform)
        keyword,
        platform,
        mention_rank AS rank
      FROM ${geoAiDetectResults}
      WHERE is_mentioned = true
        AND mention_rank IS NOT NULL
        AND executed_at IS NOT NULL
        ${rangeFilter}
        ${brandFilter}
        ${platformFilter}
      ORDER BY keyword, platform, mention_rank ASC
    `);

    return rows
      .map((row: any) => ({
        keyword: String(row.keyword),
        extendedKeyword: String(row.keyword),
        platform: String(row.platform),
        platformLabel: String(row.platform),
        rank: row.rank != null ? Number(row.rank) : 999,
      }))
      .sort((a, b) => a.rank - b.rank)
      .slice(0, limit);
  }

  async getWorkbenchStats(
    brandId: string | null,
    range: string = 'all',
  ): Promise<WorkbenchStats> {
    const rangeStart = this.getRangeStartIso(range);
    const brandFilter = brandId
      ? sql`AND brand_id = ${brandId}::uuid`
      : sql``;

    const pubRangeFilter = range === 'all'
      ? sql``
      : sql`AND _created_at >= ${rangeStart}::timestamptz`;
    const aiRangeFilter = range === 'all'
      ? sql``
      : sql`AND executed_at >= ${rangeStart}::timestamptz`;

    const result = await this.db.execute(sql<{
      ai_mention_count: string;
      media_order_count: string;
      media_revenue_cents: string;
      delivery_article_count: string;
      delivery_scheduled_count: string;
      delivery_published_count: string;
      delivery_pending_count: string;
      delivery_monthly_spend_cents: string;
    }>`
      SELECT
        (SELECT COUNT(*) FROM ${geoAiDetectResults} WHERE is_mentioned = true ${aiRangeFilter} ${brandFilter}) AS ai_mention_count,
        (SELECT COUNT(*) FROM ${geoMediaOrders} WHERE status != 'refunded' ${pubRangeFilter} ${brandFilter}) AS media_order_count,
        (SELECT COALESCE(SUM(price_cents), 0) FROM ${geoMediaOrders} WHERE status = 'published' ${pubRangeFilter} ${brandFilter}) AS media_revenue_cents,
        (SELECT COUNT(*) FROM ${geoArticles}
           WHERE status != 'failed'
             AND title NOT LIKE '%测试%'
             AND title NOT LIKE '%可删除%'
             AND _created_at >= ${rangeStart}::timestamptz
             ${brandFilter}) AS delivery_article_count,
        (SELECT COUNT(*) FROM ${geoDispatchPlans} WHERE status = 'planned' AND plan_date >= CURRENT_DATE ${brandFilter}) AS delivery_scheduled_count,
        (SELECT COUNT(*) FROM (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY brand_id, regexp_replace(COALESCE(title, ''), '[^a-zA-Z0-9\u4e00-\u9fa5]', '', 'g')
            ORDER BY _created_at ASC
          ) as rn
          FROM ${geoPublishRecords}
          WHERE status = 'published'
            AND date_trunc('month', _created_at) = date_trunc('month', CURRENT_TIMESTAMP)
            ${brandFilter}
        ) sub WHERE rn = 1) AS delivery_published_count,
        (SELECT COUNT(*) FROM ${geoDispatchPlans} WHERE status = 'planned' AND plan_date < CURRENT_DATE ${brandFilter}) AS delivery_pending_count,
        (SELECT COALESCE(SUM(price_cents), 0) FROM ${geoMediaOrders} WHERE status != 'refunded' AND date_trunc('month', _created_at) = date_trunc('month', CURRENT_TIMESTAMP) ${brandFilter}) AS delivery_monthly_spend_cents
    `);

    const articleRows = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(geoArticles)
      .where(
        and(
          ne(geoArticles.status, 'failed'),
          sql`${geoArticles.title} NOT LIKE '%测试%'`,
          sql`${geoArticles.title} NOT LIKE '%可删除%'`,
          sql`${geoArticles.createdAt} >= ${rangeStart}::timestamptz`,
          ...(brandId ? [eq(geoArticles.brandId, brandId)] : []),
        ),
      );

    const pubRows = await this.db.execute(sql`
      SELECT COUNT(*) as count
      FROM (
        SELECT pr.id, ROW_NUMBER() OVER (
          PARTITION BY pr.brand_id, regexp_replace(COALESCE(pr.title, ''), '[^a-zA-Z0-9\u4e00-\u9fa5]', '', 'g')
          ORDER BY pr._created_at ASC
        ) as rn
        FROM ${geoPublishRecords} pr
        WHERE pr.status = 'published'
          AND pr._created_at >= ${rangeStart}::timestamptz
          ${brandId ? sql`AND pr.brand_id = ${brandId}::uuid` : sql``}
      ) sub
      WHERE rn = 1
    `);

    const aiTaskRows = await this.db.execute(sql<{
      task_id: string;
      total_count: string;
    }>`
      SELECT id AS task_id, total_count
      FROM ${geoAiDetectTasks}
      WHERE status = 'completed'
        ${brandFilter}
      ORDER BY completed_at DESC NULLS LAST
      LIMIT 1
    `);

    const latestTaskId = aiTaskRows[0]?.task_id ?? null;
    const aiTaskFilter = latestTaskId
      ? sql`AND task_id = ${latestTaskId}::uuid`
      : sql`AND FALSE`;

    const aiStatsRows = await this.db.execute(sql<{
      ai_mention_count: string;
      ai_sample_count: string;
    }>`
      SELECT
        COUNT(*) FILTER (WHERE is_mentioned = true) AS ai_mention_count,
        COUNT(*) AS ai_sample_count
      FROM ${geoAiDetectResults}
      WHERE executed_at IS NOT NULL
        ${aiTaskFilter}
        ${brandFilter}
    `);

    const aiPlatformRows = await this.db.execute(sql<{
      platform: string;
      sample_count: string;
      hit_count: string;
    }>`
      SELECT
        platform,
        COUNT(*) AS sample_count,
        COUNT(*) FILTER (WHERE is_mentioned = true) AS hit_count
      FROM ${geoAiDetectResults}
      WHERE executed_at IS NOT NULL
        ${aiTaskFilter}
        ${brandFilter}
      GROUP BY platform
      ORDER BY sample_count DESC, platform ASC
    `);

    const aiPlatformDistribution = aiPlatformRows.map((row: { platform: string; sample_count: string; hit_count: string }) => {
      const sampleCount = Number(row.sample_count);
      const hitCount = Number(row.hit_count);
      return {
        platform: String(row.platform),
        sampleCount,
        hitCount,
        hitRate: sampleCount > 0 ? (hitCount / sampleCount) * 100 : 0,
      };
    });

    const row = result[0];
    const aiMentionCount = Number(row?.ai_mention_count ?? 0);
    const aiSampleCount = Number(aiStatsRows[0]?.ai_sample_count ?? 0);
    const aiTaskHitCount = Number(aiStatsRows[0]?.ai_mention_count ?? 0);
    return {
      articleCount: Number(articleRows[0]?.count ?? 0),
      publicationCount: Number(pubRows[0]?.count ?? 0),
      aiMentionCount,
      aiSampleCount,
      aiHitRate: aiSampleCount > 0 ? (aiTaskHitCount / aiSampleCount) * 100 : 0,
      aiPlatformDistribution,
      mediaOrderCount: Number(row?.media_order_count ?? 0),
      mediaRevenueCents: Number(row?.media_revenue_cents ?? 0),
      deliveryArticleCount: Number(row?.delivery_article_count ?? 0),
      deliveryScheduledCount: Number(row?.delivery_scheduled_count ?? 0),
      deliveryPublishedCount: Number(row?.delivery_published_count ?? 0),
      deliveryPendingCount: Number(row?.delivery_pending_count ?? 0),
      deliveryMonthlySpendCents: Number(row?.delivery_monthly_spend_cents ?? 0),
    };
  }

  private buildRangeFilter(range: string, dateCol: string): import('drizzle-orm').SQL {
    if (range === 'all' || !range) {
      return sql``;
    }
    const startIso = this.getRangeStartIso(range);
    return sql`AND ${sql.identifier(dateCol)} >= ${startIso}::timestamptz`;
  }

  private getRangeStartIso(range: string): string {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : range === 'today' ? 1 : 7;
    return dayjs().subtract(days, 'day').startOf('day').toISOString();
  }

  private dailyJitter(base: number, dateStr: string, name: string): number {
    let hash = 0;
    const s = dateStr + '|' + name;
    for (let i = 0; i < s.length; i += 1) {
      hash = ((hash << 5) - hash) + s.charCodeAt(i);
      hash = hash & hash;
    }
    const ratio = ((Math.abs(hash) % 800) / 10000) - 0.04;
    const result = base * (1 + ratio);
    return Math.round(result * 10) / 10;
  }
}
