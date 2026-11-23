import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { sql, eq } from 'drizzle-orm';
import type {
  DeliveryBrandItem,
  DeliveryOverviewResponse,
  DeliveryStatus,
  CustomerExpiryStatus,
  ActivityTimelineItem,
  BrandActivityResponse,
} from '@shared/api.interface';
import { geoBrands } from '@server/database/schema';
import { geoCreditAccounts } from '@server/database/schema';
import { geoCreditPlans } from '@server/database/schema';
import { geoDiagnosisTasks } from '@server/database/schema';
import { geoKeywords, geoKeywordResults } from '@server/database/schema';
import { geoArticles } from '@server/database/schema';
import { geoPublishRecords } from '@server/database/schema';
import { geoCreditTransactions } from '@server/database/schema';

interface OverviewQuery {
  page?: number;
  pageSize?: number;
  deliveryStatus?: DeliveryStatus;
  keyword?: string;
  sortBy?: 'lastActivity' | 'expiry' | 'balance' | 'monthlyArticles';
  sortOrder?: 'asc' | 'desc';
}

const TYPE_LABELS: Record<ActivityTimelineItem['type'], string> = {
  diagnosis: '诊断',
  article: '文章生成',
  publish: '内容发布',
  recharge: '算力充值',
  adjustment: '算力调整',
  keyword: '关键词新增',
};

function computeExpiryStatus(planExpiresAt: string | null): CustomerExpiryStatus {
  if (!planExpiresAt) return 'unset';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const expiry = new Date(planExpiresAt).getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  if (expiry < today) return 'expired';
  if (expiry <= today + sevenDaysMs) return 'warning';
  return 'normal';
}

function getMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

@Injectable()
export class DeliveryService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  async getOverview(query: OverviewQuery): Promise<DeliveryOverviewResponse> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const offset = (page - 1) * pageSize;
    const sortBy = query.sortBy ?? 'lastActivity';
    const sortOrder = query.sortOrder ?? 'desc';

    const { start: monthStart, end: monthEnd } = getMonthRange();
    const monthStartIso = monthStart.toISOString();
    const monthEndIso = monthEnd.toISOString();

    // 基础统计 CTE：品牌 + 账户 + 套餐 + 各维度计数
    const baseCte = sql`
      WITH brand_base AS (
        SELECT
          b.id AS brand_id,
          b.name AS brand_name,
          b.company_name,
          b.status
        FROM ${geoBrands} b
        WHERE b.status = 'active'
          ${query.keyword ? sql`AND b.name ILIKE ${'%' + query.keyword + '%'}` : sql``}
      ),
      brand_stats AS (
        SELECT
          bb.brand_id,
          bb.brand_name,
          bb.company_name,
          cp.plan_name,
          ca.plan_expires_at,
          ca.balance,
          COALESCE(diag.diagnosis_count, 0) AS diagnosis_count,
          diag.last_diagnosis_at,
          COALESCE(kw.keyword_count, 0) AS keyword_count,
          COALESCE(kr.hit_rate, 0) AS keyword_hit_rate,
          kr.has_results AS has_keyword_results,
          COALESCE(art.monthly_articles, 0) AS monthly_articles,
          COALESCE(pub.monthly_publications, 0) AS monthly_publications,
          GREATEST(
            diag.last_diagnosis_at,
            art.last_article_at,
            pub.last_publication_at,
            kw.last_keyword_at
          ) AS last_activity_at
        FROM brand_base bb
        LEFT JOIN ${geoCreditAccounts} ca ON ca.brand_id = bb.brand_id
        LEFT JOIN ${geoCreditPlans} cp ON cp.id = ca.current_plan_id
        LEFT JOIN (
          SELECT brand_id, COUNT(*) AS diagnosis_count, MAX(_created_at) AS last_diagnosis_at
          FROM ${geoDiagnosisTasks}
          GROUP BY brand_id
        ) diag ON diag.brand_id = bb.brand_id
        LEFT JOIN (
          SELECT brand_id, COUNT(*) AS keyword_count, MAX(_created_at) AS last_keyword_at
          FROM ${geoKeywords}
          GROUP BY brand_id
        ) kw ON kw.brand_id = bb.brand_id
        LEFT JOIN (
          SELECT
            brand_id,
            CASE WHEN COUNT(*) > 0 THEN ROUND(100.0 * COUNT(*) FILTER (WHERE is_hit = true) / COUNT(*), 1) ELSE 0 END AS hit_rate,
            COUNT(*) > 0 AS has_results
          FROM ${geoKeywordResults}
          GROUP BY brand_id
        ) kr ON kr.brand_id = bb.brand_id
        LEFT JOIN (
          SELECT brand_id, COUNT(*) AS monthly_articles, MAX(_created_at) AS last_article_at
          FROM ${geoArticles}
          WHERE _created_at >= ${monthStartIso}::timestamptz
            AND _created_at < ${monthEndIso}::timestamptz
          GROUP BY brand_id
        ) art ON art.brand_id = bb.brand_id
        LEFT JOIN (
          SELECT COALESCE(brand_id, '70328f21-69fa-4826-b5ac-6df50b0802ff') AS brand_id, COUNT(*) AS monthly_publications, MAX(_created_at) AS last_publication_at
          FROM ${geoPublishRecords}
          WHERE status = 'published'
            AND _created_at >= ${monthStartIso}::timestamptz
            AND _created_at < ${monthEndIso}::timestamptz
          GROUP BY COALESCE(brand_id, '70328f21-69fa-4826-b5ac-6df50b0802ff')
        ) pub ON pub.brand_id = bb.brand_id
      )
    `;

    // 带状态计算 + 过滤的完整查询
    const fullQuery = sql`
      ${baseCte}
      SELECT
        brand_id AS "brandId",
        brand_name AS "brandName",
        company_name AS "companyName",
        plan_name AS "planName",
        plan_expires_at AS "planExpiresAt",
        balance,
        diagnosis_count AS "diagnosisCount",
        last_diagnosis_at AS "lastDiagnosisAt",
        keyword_count AS "keywordCount",
        keyword_hit_rate AS "keywordHitRate",
        has_keyword_results AS "hasKeywordResults",
        monthly_articles AS "monthlyArticles",
        monthly_publications AS "monthlyPublications",
        last_activity_at AS "lastActivityAt",
        CASE
          WHEN last_activity_at IS NULL THEN 'stagnant'
          WHEN last_activity_at < NOW() - INTERVAL '14 days' THEN 'stagnant'
          WHEN last_activity_at < NOW() - INTERVAL '7 days' THEN 'lagging'
          ELSE 'normal'
        END AS delivery_status
      FROM brand_stats
      WHERE 1=1
        ${query.deliveryStatus ? sql`AND (
          CASE
            WHEN last_activity_at IS NULL THEN 'stagnant'
            WHEN last_activity_at < NOW() - INTERVAL '14 days' THEN 'stagnant'
            WHEN last_activity_at < NOW() - INTERVAL '7 days' THEN 'lagging'
            ELSE 'normal'
          END
        ) = ${query.deliveryStatus}` : sql``}
    `;

    // 排序
    const sortColumnMap: Record<string, string> = {
      lastActivity: 'last_activity_at',
      expiry: 'plan_expires_at',
      balance: 'balance',
      monthlyArticles: 'monthly_articles',
    };
    const sortCol = sortColumnMap[sortBy] ?? 'last_activity_at';
    const sortDir = sortOrder === 'asc' ? 'ASC' : 'DESC';
    const nullsFirst = sortOrder === 'asc' ? 'NULLS FIRST' : 'NULLS LAST';

    const orderedQuery = sql`
      ${fullQuery}
      ORDER BY ${sql.raw(sortCol)} ${sql.raw(sortDir)} ${sql.raw(nullsFirst)}
    `;

    // 总数
    const countResult = await this.db.execute(
      sql<{ total: string }>`
        SELECT COUNT(*) AS total FROM (${orderedQuery}) AS filtered
      `,
    );
    const total = Number(countResult[0]?.total ?? 0);

    // 分页数据
    const rows = await this.db.execute(
      sql<{
        brandId: string;
        brandName: string;
        companyName: string | null;
        planName: string | null;
        planExpiresAt: string | null;
        balance: string | null;
        diagnosisCount: string | number;
        lastDiagnosisAt: string | null;
      keywordCount: string | number;
      keywordHitRate: string | number;
      hasKeywordResults: string | boolean;
      monthlyArticles: string | number;
        monthlyPublications: string | number;
        lastActivityAt: string | null;
        delivery_status: string;
      }>`
        ${orderedQuery}
        LIMIT ${pageSize} OFFSET ${offset}
      `,
    );

    // 构造返回 items
    const items: DeliveryBrandItem[] = rows.map((row: typeof rows[number]) => ({
      brandId: String(row.brandId),
      brandName: String(row.brandName),
      companyName: row.companyName != null ? String(row.companyName) : null,
      planName: row.planName != null ? String(row.planName) : null,
      expiryStatus: computeExpiryStatus(
        row.planExpiresAt != null ? String(row.planExpiresAt) : null,
      ),
      diagnosisCount: Number(row.diagnosisCount),
      lastDiagnosisAt: row.lastDiagnosisAt != null
        ? new Date(String(row.lastDiagnosisAt)).toISOString()
        : null,
      keywordCount: Number(row.keywordCount),
      keywordHitRate: row.hasKeywordResults ? Number(row.keywordHitRate) : null,
      monthlyArticles: Number(row.monthlyArticles),
      monthlyPublications: Number(row.monthlyPublications),
      lastActivityAt: row.lastActivityAt != null
        ? new Date(String(row.lastActivityAt)).toISOString()
        : null,
      deliveryStatus: String(row.delivery_status) as DeliveryStatus,
    }));

    // 顶部 4 个统计数
    const statsRows = await this.db.execute(
      sql<{
        active_total: string;
        producing_total: string;
        lagging_total: string;
        stagnant_total: string;
      }>`
        ${baseCte},
        brand_with_status AS (
          SELECT
            brand_id,
            monthly_articles + monthly_publications > 0 AS is_producing,
            CASE
              WHEN last_activity_at IS NULL THEN 'stagnant'
              WHEN last_activity_at < NOW() - INTERVAL '14 days' THEN 'stagnant'
              WHEN last_activity_at < NOW() - INTERVAL '7 days' THEN 'lagging'
              ELSE 'normal'
            END AS delivery_status
          FROM brand_stats
        )
        SELECT
          COUNT(*) AS active_total,
          COUNT(*) FILTER (WHERE is_producing) AS producing_total,
          COUNT(*) FILTER (WHERE delivery_status = 'lagging') AS lagging_total,
          COUNT(*) FILTER (WHERE delivery_status = 'stagnant') AS stagnant_total
        FROM brand_with_status
      `,
    );
    const stats = statsRows[0];

    return {
      activeCustomers: Number(stats?.active_total ?? 0),
      producingCustomers: Number(stats?.producing_total ?? 0),
      laggingCustomers: Number(stats?.lagging_total ?? 0),
      stagnantCustomers: Number(stats?.stagnant_total ?? 0),
      items,
      total,
    };
  }

  async getBrandActivity(brandId: string, limit = 10): Promise<BrandActivityResponse> {
    // 验证品牌存在
    const brandResult = await this.db
      .select({ id: geoBrands.id, name: geoBrands.name })
      .from(geoBrands)
      .where(eq(geoBrands.id, brandId))
      .limit(1);

    if (brandResult.length === 0) {
      throw new NotFoundException('品牌不存在');
    }
    const brand = brandResult[0];

    const activityLimit = Math.min(50, Math.max(1, limit));

    // 用 UNION ALL 合并各来源，取最新 N 条
    const rows = await this.db.execute(
      sql<{
        id: string;
        type: string;
        title: string;
        amount: string | null;
        created_at: string;
      }>`
        SELECT id, type, title, amount, created_at
        FROM (
          -- 诊断任务
          SELECT
            id::text,
            'diagnosis'::text AS type,
            '诊断任务完成'::text AS title,
            NULL::numeric AS amount,
            _created_at AS created_at
          FROM ${geoDiagnosisTasks}
          WHERE brand_id = ${brandId}::uuid

          UNION ALL

          -- 文章生成
          SELECT
            id::text,
            'article'::text AS type,
            title::text AS title,
            NULL::numeric AS amount,
            _created_at AS created_at
          FROM ${geoArticles}
          WHERE brand_id = ${brandId}::uuid

          UNION ALL

          -- 发布记录
          SELECT
            id::text,
            'publish'::text AS type,
            CONCAT('发布到 ', platform)::text AS title,
            NULL::numeric AS amount,
            _created_at AS created_at
          FROM ${geoPublishRecords}
          WHERE COALESCE(brand_id, '70328f21-69fa-4826-b5ac-6df50b0802ff') = ${brandId}::uuid

          UNION ALL

          -- 算力流水（充值/调整类，正向流水）
          SELECT
            id::text,
            CASE
              WHEN transaction_type IN ('manual_recharge', 'recharge', 'plan_grant') THEN 'recharge'::text
              ELSE 'adjustment'::text
            END AS type,
            CASE
              WHEN transaction_type = 'manual_recharge' THEN '手工充值'::text
              WHEN transaction_type = 'recharge' THEN '续费充值'::text
              WHEN transaction_type = 'plan_grant' THEN '套餐赠送'::text
              WHEN transaction_type = 'adjustment' THEN '算力调整'::text
              WHEN transaction_type = 'refund' THEN '退款'::text
              ELSE transaction_type::text
            END AS title,
            change_amount AS amount,
            _created_at AS created_at
          FROM ${geoCreditTransactions}
          WHERE brand_id = ${brandId}::uuid
            AND change_amount > 0
            AND transaction_type IN ('manual_recharge', 'recharge', 'plan_grant', 'adjustment', 'refund')

          UNION ALL

          -- 关键词新增
          SELECT
            id::text,
            'keyword'::text AS type,
            CONCAT('新增关键词：', keyword)::text AS title,
            NULL::numeric AS amount,
            _created_at AS created_at
          FROM ${geoKeywords}
          WHERE brand_id = ${brandId}::uuid
        ) AS combined
        ORDER BY created_at DESC
        LIMIT ${activityLimit}
      `,
    );

    const items: ActivityTimelineItem[] = rows.map(
      (row: typeof rows[number]) => {
        const type = String(row.type) as ActivityTimelineItem['type'];
        return {
          id: String(row.id),
          type,
          typeLabel: TYPE_LABELS[type] ?? type,
          title: String(row.title),
          amount: row.amount != null ? Number(row.amount) : undefined,
          createdAt: new Date(String(row.created_at)).toISOString(),
        };
      },
    );

    return {
      brandId: brand.id,
      brandName: brand.name,
      items,
    };
  }
}
