import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, desc, sql } from 'drizzle-orm';

import { geoKeywordIndexLogs } from '@server/database/schema';
import type {
  KeywordIndexLog,
  KeywordIndexLatestBySource,
  KeywordIndexSource,
  KeywordIndexPeriod,
} from '@shared/api.interface';
import { KEYWORD_INDEX_SOURCES } from '@shared/api.interface';
import { CreateKeywordIndexLogDto } from './dto/index-log.dto';

interface IndexLogRow {
  id: string;
  keywordId: string;
  keywordText: string;
  source: string;
  value: number;
  period: string;
  collectedAt: string;
  screenshotUrl: string;
  ocrText: string | null;
  remark: string | null;
  createdBy: string | null;
  createdAt: Date;
}

function toKeywordIndexLog(row: IndexLogRow): KeywordIndexLog {
  return {
    id: row.id,
    keywordId: row.keywordId,
    keywordText: row.keywordText,
    source: row.source as KeywordIndexSource,
    value: row.value,
    period: row.period as KeywordIndexPeriod,
    collectedAt: row.collectedAt,
    screenshotUrl: row.screenshotUrl,
    ocrText: row.ocrText,
    remark: row.remark,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class IndexLogService {
  private readonly logger = new Logger(IndexLogService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async create(
    dto: CreateKeywordIndexLogDto,
    userId: string,
  ): Promise<KeywordIndexLog> {
    if (!userId) {
      throw new BadRequestException('用户身份无效');
    }

    const rows = await this.db
      .insert(geoKeywordIndexLogs)
      .values({
        keywordId: dto.keywordId,
        keywordText: dto.keywordText,
        source: dto.source,
        value: dto.value,
        period: dto.period,
        collectedAt: dto.collectedAt,
        screenshotUrl: dto.screenshotUrl,
        ocrText: dto.ocrText ?? null,
        remark: dto.remark ?? null,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning({
        id: geoKeywordIndexLogs.id,
        keywordId: geoKeywordIndexLogs.keywordId,
        keywordText: geoKeywordIndexLogs.keywordText,
        source: geoKeywordIndexLogs.source,
        value: geoKeywordIndexLogs.value,
        period: geoKeywordIndexLogs.period,
        collectedAt: geoKeywordIndexLogs.collectedAt,
        screenshotUrl: geoKeywordIndexLogs.screenshotUrl,
        ocrText: geoKeywordIndexLogs.ocrText,
        remark: geoKeywordIndexLogs.remark,
        createdBy: geoKeywordIndexLogs.createdBy,
        createdAt: geoKeywordIndexLogs.createdAt,
      });

    if (rows.length === 0) {
      throw new BadRequestException('创建失败');
    }

    return toKeywordIndexLog(rows[0] as unknown as IndexLogRow);
  }

  async listByKeyword(keywordId: string): Promise<KeywordIndexLog[]> {
    const rows = await this.db
      .select({
        id: geoKeywordIndexLogs.id,
        keywordId: geoKeywordIndexLogs.keywordId,
        keywordText: geoKeywordIndexLogs.keywordText,
        source: geoKeywordIndexLogs.source,
        value: geoKeywordIndexLogs.value,
        period: geoKeywordIndexLogs.period,
        collectedAt: geoKeywordIndexLogs.collectedAt,
        screenshotUrl: geoKeywordIndexLogs.screenshotUrl,
        ocrText: geoKeywordIndexLogs.ocrText,
        remark: geoKeywordIndexLogs.remark,
        createdBy: geoKeywordIndexLogs.createdBy,
        createdAt: geoKeywordIndexLogs.createdAt,
      })
      .from(geoKeywordIndexLogs)
      .where(eq(geoKeywordIndexLogs.keywordId, keywordId))
      .orderBy(
        desc(geoKeywordIndexLogs.collectedAt),
        desc(geoKeywordIndexLogs.createdAt),
      );

    return rows.map((row) => toKeywordIndexLog(row as unknown as IndexLogRow));
  }

  async getLatestByKeywordIds(
    keywordIds: string[],
  ): Promise<Record<string, KeywordIndexLatestBySource>> {
    if (keywordIds.length === 0) {
      return {};
    }

    const sources: readonly string[] = KEYWORD_INDEX_SOURCES;
    const result: Record<string, KeywordIndexLatestBySource> = {};

    for (const kid of keywordIds) {
      result[kid] = { baidu: null, weixin: null };
    }

    // For each keyword + source, get the latest (collected_at desc, created_at desc)
    // Use a single query with DISTINCT ON (keyword_id, source)
    const rows = await this.db.execute(sql`
      SELECT DISTINCT ON (keyword_id, source)
        id, keyword_id, keyword_text, source, value, period,
        collected_at, screenshot_url, ocr_text, remark,
        (_created_by).user_id AS created_by, _created_at
      FROM ${geoKeywordIndexLogs}
      WHERE ${geoKeywordIndexLogs.keywordId} = ANY(${sql`ARRAY[${sql.join(keywordIds.map((id: string) => sql`${id}`), sql`, `)}]::uuid[]`})
      ORDER BY keyword_id, source, collected_at DESC, _created_at DESC
    `);

    const rowList = rows as unknown as Array<{
      id: string;
      keyword_id: string;
      keyword_text: string;
      source: string;
      value: number;
      period: string;
      collected_at: string;
      screenshot_url: string;
      ocr_text: string | null;
      remark: string | null;
      created_by: string | null;
      _created_at: Date;
    }>;

    for (const row of rowList) {
      const log: KeywordIndexLog = {
        id: row.id,
        keywordId: row.keyword_id,
        keywordText: row.keyword_text,
        source: row.source as KeywordIndexSource,
        value: row.value,
        period: row.period as KeywordIndexPeriod,
        collectedAt: row.collected_at,
        screenshotUrl: row.screenshot_url,
        ocrText: row.ocr_text,
        remark: row.remark,
        createdBy: row.created_by,
        createdAt: new Date(row._created_at).toISOString(),
      };

      if (!result[row.keyword_id]) {
        result[row.keyword_id] = { baidu: null, weixin: null };
      }

      if (sources.includes(row.source)) {
        result[row.keyword_id][row.source as 'baidu' | 'weixin'] = log;
      }
    }

    return result;
  }
}
