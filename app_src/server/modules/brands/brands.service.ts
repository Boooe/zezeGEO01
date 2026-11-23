import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, asc, and, desc, sql, inArray, count } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';

import {
  geoBrands,
  geoBrandProfiles,
  geoKeywords,
  geoAiDetectResults,
  geoPublishRecords,
} from '@server/database/schema';
import type { BrandOption, GeoUser, BrandReadinessResponse } from '@shared/api.interface';

@Injectable()
export class BrandsService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async updateHitWords(brandId: string, hitWords: string[]): Promise<{ hitWords: string[] }> {
    const trimmed = hitWords.map((w) => w.trim()).filter(Boolean);

    if (trimmed.length > 20) {
      throw new BadRequestException('命中词最多 20 个');
    }
    for (const w of trimmed) {
      if (w.length > 50) {
        throw new BadRequestException('每个命中词最多 50 个字符');
      }
    }

    const existing = await this.db
      .select({ id: geoBrands.id })
      .from(geoBrands)
      .where(eq(geoBrands.id, brandId))
      .limit(1);
    if (!existing[0]) {
      throw new NotFoundException('品牌不存在');
    }

    const [updated] = await this.db
      .update(geoBrands)
      .set({ hitWords: trimmed })
      .where(eq(geoBrands.id, brandId))
      .returning({ hitWords: geoBrands.hitWords });

    return { hitWords: (updated?.hitWords as string[]) ?? [] };
  }

  async listOptions(user: GeoUser, includeDemo: boolean = false): Promise<BrandOption[]> {
    const conditions = [eq(geoBrands.status, 'active')];
    if (!includeDemo) {
      conditions.push(eq(geoBrands.isDemo, false));
    }
    if (user.role === 'client' && user.brandId) {
      conditions.push(eq(geoBrands.id, user.brandId));
    }

    if (user.role === 'client') {
      const rows = await this.db
        .select({
          id: geoBrands.id,
          name: geoBrands.name,
          industry: geoBrands.industry,
        })
        .from(geoBrands)
        .where(and(...conditions))
        .orderBy(asc(geoBrands.name));

      return rows.map(
        (row: { id: string; name: string; industry: string | null }) => ({
          id: row.id,
          name: row.name,
          industry: row.industry,
        }),
      );
    }

    const activeBrandRows = await this.db.execute(sql<{ brand_id: string; last_active: string }>`
      WITH active_brands AS (
        SELECT brand_id, MAX(updated_at) as last_active
        FROM (
          SELECT brand_id, _updated_at as updated_at
          FROM geo_publish_records
          WHERE _updated_at >= NOW() - INTERVAL '30 days'
          UNION ALL
          SELECT brand_id, _updated_at as updated_at
          FROM geo_account_auths
          WHERE _updated_at >= NOW() - INTERVAL '30 days'
          UNION ALL
          SELECT brand_id, _updated_at as updated_at
          FROM geo_publish_queue
          WHERE _updated_at >= NOW() - INTERVAL '30 days'
          UNION ALL
          SELECT brand_id, _updated_at as updated_at
          FROM geo_auto_publish_tasks
          WHERE _updated_at >= NOW() - INTERVAL '30 days'
        ) sub
        GROUP BY brand_id
      )
      SELECT b.id, b.name, b.industry, ab.last_active
      FROM geo_brands b
      LEFT JOIN active_brands ab ON ab.brand_id = b.id
      WHERE b.status = 'active'
        ${includeDemo ? sql`` : sql`AND b.is_demo = false`}
      ORDER BY
        CASE WHEN ab.last_active IS NOT NULL THEN 0 ELSE 1 END,
        ab.last_active DESC NULLS LAST,
        b.name ASC
    `);

    return activeBrandRows.map(
      (row: { id: string; name: string; industry: string | null; last_active: string | null }) => ({
        id: row.id,
        name: row.name,
        industry: row.industry,
      }),
    );
  }

  // ============================================================
  //  品牌就绪度
  // ============================================================

  async getReadiness(brandId: string): Promise<BrandReadinessResponse> {
    // 1. 定位档案：geo_brand_profiles 有记录就算完成
    const profileRows = await this.db
      .select({ id: geoBrandProfiles.id })
      .from(geoBrandProfiles)
      .where(eq(geoBrandProfiles.brandId, brandId))
      .limit(1);
    const profileDone = profileRows.length > 0;

    // 2. 关键词：geo_keywords 该品牌有 ≥1 条
    const kwCount = await this.db
      .select({ count: count() })
      .from(geoKeywords)
      .where(eq(geoKeywords.brandId, brandId));
    const keywordsDone = Number(kwCount[0]?.count ?? 0) >= 1;

    // 3. 检测样本：geo_ai_detect_results 有成功结果（http_status=200 且 error_message 为空）
    const detectCount = await this.db
      .select({ count: count() })
      .from(geoAiDetectResults)
      .where(
        and(
          eq(geoAiDetectResults.brandId, brandId),
          eq(geoAiDetectResults.httpStatus, 200),
          sql`${geoAiDetectResults.errorMessage} IS NULL`,
        ),
      );
    const detectDone = Number(detectCount[0]?.count ?? 0) >= 1;

    // 4. 本月发布：geo_publish_records 本月有成功发布记录
    const publishCount = await this.db
      .select({ count: count() })
      .from(geoPublishRecords)
      .where(
        and(
          eq(geoPublishRecords.brandId, brandId),
          eq(geoPublishRecords.status, 'published'),
          sql`DATE_TRUNC('month', ${geoPublishRecords.publishDate}) = DATE_TRUNC('month', CURRENT_DATE)`,
        ),
      );
    const publishDone = Number(publishCount[0]?.count ?? 0) >= 1;

    const totalDone = [profileDone, keywordsDone, detectDone, publishDone].filter(Boolean).length;

    return {
      profileDone,
      keywordsDone,
      detectDone,
      publishDone,
      totalDone,
      totalItems: 4,
    };
  }
}
