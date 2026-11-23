import { Injectable, NotFoundException, ForbiddenException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, desc, count, gte, lt, sql } from 'drizzle-orm';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

import {
  geoMonthlyReports,
  geoBrands,
  geoCreditTransactions,
  geoKeywords,
  geoDiagnosisReports,
  geoDiagnosisTasks,
  geoIndexChecks,
  geoPublishRecords,
} from '@server/database/schema';
import type { QueryReportDto } from './dto/query-report.dto';
import type { CreateReportDto } from './dto/create-report.dto';
import type { UpdateReportDto } from './dto/update-report.dto';
import type { MonthlyReport } from '@shared/api.interface';

interface GeoUserCtx {
  id: string;
  username: string;
  role: string;
  brandId: string | null;
}

function extractPostgresErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth += 1) {
    const { code, cause } = current as { code?: unknown; cause?: unknown };
    if (typeof code === 'string') return code;
    current = cause;
  }
  return undefined;
}

@Injectable()
export class ReportsService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  private applyBrandFilter(
    conditions: ReturnType<typeof eq>[],
    user: GeoUserCtx,
    brandIdParam?: string,
  ): void {
    if (user.role === 'client' && user.brandId) {
      conditions.push(eq(geoMonthlyReports.brandId, user.brandId));
    } else if (brandIdParam) {
      conditions.push(eq(geoMonthlyReports.brandId, brandIdParam));
    }
  }

  private mapRow(row: { report: typeof geoMonthlyReports.$inferSelect; brandName: string | null }): MonthlyReport {
    const r = row.report;
    return {
      id: r.id,
      brandId: r.brandId,
      brandName: row.brandName ?? '',
      reportMonth: r.reportMonth,
      includedCount: r.includedCount ?? 0,
      prevIncludedCount: r.prevIncludedCount ?? 0,
      improvementCount: r.improvementCount ?? 0,
      contentOutput: r.contentOutput ?? 0,
      monthlyCreditUsed: Number(r.monthlyCreditUsed ?? 0),
      notes: r.notes,
      isSent: r.isSent,
      sentAt: r.sentAt ? r.sentAt.toISOString() : null,
    };
  }

  private getMonthRange(reportMonth: string): { start: string; end: string } {
    const year = Number(reportMonth.slice(0, 4));
    const month = Number(reportMonth.slice(5, 7));
    const start = new Date(year, month - 1, 1).toISOString().slice(0, 10);
    const end = new Date(year, month, 1).toISOString().slice(0, 10);
    return { start, end };
  }

  private async getIndexedCountsByBrandMonth(
    brandMonths: Array<{ brandId: string; month: string }>,
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    const conditions = brandMonths
      .map((bm) => {
        const { start, end } = this.getMonthRange(bm.month);
        return sql`(${geoIndexChecks.brandId} = ${bm.brandId}::uuid
          AND ${geoIndexChecks.indexed} = 'yes'
          AND ${geoIndexChecks.checkedAt} >= ${start}::date
          AND ${geoIndexChecks.checkedAt} < ${end}::date)`;
      })
      .reduce((acc, cond, idx) => (idx === 0 ? cond : sql`${acc} OR ${cond}`), sql``);

    const rows = await this.db.execute(sql<{
      brand_id: string;
      check_month: string;
      cnt: string;
    }>`
      SELECT brand_id, to_char(checked_at, 'YYYY-MM') AS check_month, count(*) AS cnt
      FROM ${geoIndexChecks}
      WHERE indexed = 'yes' AND checked_at IS NOT NULL AND (${conditions})
      GROUP BY brand_id, to_char(checked_at, 'YYYY-MM')
    `);

    for (const row of rows) {
      const key = `${String(row.brand_id)}-${String(row.check_month)}`;
      result.set(key, Number(row.cnt));
    }
    return result;
  }

  private async getPublishCountsByBrandMonth(
    brandMonths: Array<{ brandId: string; month: string }>,
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    const conditions = brandMonths
      .map((bm) => {
        const { start, end } = this.getMonthRange(bm.month);
        return sql`(${geoPublishRecords.brandId} = ${bm.brandId}::uuid
          AND ${geoPublishRecords.status} = 'published'
          AND ${geoPublishRecords.createdAt} >= ${start}::timestamptz
          AND ${geoPublishRecords.createdAt} < ${end}::timestamptz)`;
      })
      .reduce((acc, cond, idx) => (idx === 0 ? cond : sql`${acc} OR ${cond}`), sql``);

    const rows = await this.db.execute(sql<{
      brand_id: string;
      pub_month: string;
      cnt: string;
    }>`
      SELECT brand_id, to_char(_created_at, 'YYYY-MM') AS pub_month, count(*) AS cnt
      FROM ${geoPublishRecords}
      WHERE status = 'published' AND (${conditions})
      GROUP BY brand_id, to_char(_created_at, 'YYYY-MM')
    `);

    for (const row of rows) {
      const key = `${String(row.brand_id)}-${String(row.pub_month)}`;
      result.set(key, Number(row.cnt));
    }
    return result;
  }

  async findAll(query: QueryReportDto, user: GeoUserCtx): Promise<{ items: MonthlyReport[]; total: number; page: number; pageSize: number }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const conditions: ReturnType<typeof eq>[] = [];
    this.applyBrandFilter(conditions, user, query.brandId);

    if (query.reportMonth) {
      conditions.push(eq(geoMonthlyReports.reportMonth, query.reportMonth));
    }
    if (query.isSent !== undefined) {
      conditions.push(eq(geoMonthlyReports.isSent, query.isSent));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult, rows] = await Promise.all([
      this.db.select({ count: count() }).from(geoMonthlyReports).where(whereClause),
      this.db
        .select({
          report: geoMonthlyReports,
          brandName: geoBrands.name,
        })
        .from(geoMonthlyReports)
        .leftJoin(geoBrands, eq(geoMonthlyReports.brandId, geoBrands.id))
        .where(whereClause)
        .orderBy(desc(geoMonthlyReports.reportMonth))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    const reportItems = rows.map((row) => this.mapRow(row as any));

    if (reportItems.length > 0) {
      const brandMonths = reportItems.map((item: MonthlyReport) => ({
        brandId: item.brandId,
        month: item.reportMonth,
      }));

      const [indexedCounts, publishCounts] = await Promise.all([
        this.getIndexedCountsByBrandMonth(brandMonths),
        this.getPublishCountsByBrandMonth(brandMonths),
      ]);

      reportItems.forEach((item: MonthlyReport) => {
        const key = `${item.brandId}-${item.reportMonth}`;
        const indexedCount = indexedCounts.get(key);
        const publishCount = publishCounts.get(key);
        item.includedCount = indexedCount ?? 0;
        item.contentOutput = publishCount ?? 0;
        item.improvementCount = indexedCount ? Math.max(0, indexedCount - (item.prevIncludedCount ?? 0)) : 0;
      });
    }

    return {
      items: reportItems,
      total: Number(totalResult[0]?.count ?? 0),
      page,
      pageSize,
    };
  }

  async findOne(id: string, user: GeoUserCtx): Promise<MonthlyReport> {
    const rows = await this.db
      .select({
        report: geoMonthlyReports,
        brandName: geoBrands.name,
      })
      .from(geoMonthlyReports)
      .leftJoin(geoBrands, eq(geoMonthlyReports.brandId, geoBrands.id))
      .where(eq(geoMonthlyReports.id, id));

    if (rows.length === 0) {
      throw new NotFoundException('月报不存在');
    }

    const row = rows[0] as any;
    const report = row.report;

    if (user.role === 'client' && user.brandId && report.brandId !== user.brandId) {
      throw new ForbiddenException('无权访问该月报');
    }

    const result = this.mapRow(row);
    const bm = [{ brandId: report.brandId, month: report.reportMonth }];
    const [indexedCounts, publishCounts] = await Promise.all([
      this.getIndexedCountsByBrandMonth(bm),
      this.getPublishCountsByBrandMonth(bm),
    ]);
    const key = `${report.brandId}-${report.reportMonth}`;
    result.includedCount = indexedCounts.get(key) ?? 0;
    result.contentOutput = publishCounts.get(key) ?? 0;
    result.improvementCount = result.includedCount - (result.prevIncludedCount ?? 0);

    return result;
  }

  async upsert(dto: CreateReportDto): Promise<MonthlyReport> {
    const monthlyCreditUsed = await this.calcMonthlyCreditUsed(dto.brandId, dto.reportMonth);
    const creditUsedStr = String(monthlyCreditUsed);
    try {
      const [inserted] = await this.db
        .insert(geoMonthlyReports)
        .values({
          brandId: dto.brandId,
          reportMonth: dto.reportMonth,
          includedCount: dto.includedCount ?? 0,
          prevIncludedCount: dto.prevIncludedCount ?? 0,
          improvementCount: dto.improvementCount ?? 0,
          contentOutput: dto.contentOutput ?? 0,
          monthlyCreditUsed: creditUsedStr,
          notes: dto.notes,
        })
        .onConflictDoUpdate({
          target: [geoMonthlyReports.brandId, geoMonthlyReports.reportMonth],
          set: {
            includedCount: dto.includedCount ?? 0,
            prevIncludedCount: dto.prevIncludedCount ?? 0,
            improvementCount: dto.improvementCount ?? 0,
            contentOutput: dto.contentOutput ?? 0,
            monthlyCreditUsed: creditUsedStr,
            notes: dto.notes,
          },
        })
        .returning({ id: geoMonthlyReports.id });

      return this.findById(inserted.id);
    } catch (error) {
      const code = extractPostgresErrorCode(error);
      if (code === '23505') {
        throw new ConflictException('该品牌本月月报已存在');
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateReportDto, user: GeoUserCtx): Promise<MonthlyReport> {
    const patch: Partial<typeof geoMonthlyReports.$inferInsert> = {};
    if (dto.includedCount !== undefined) patch.includedCount = dto.includedCount;
    if (dto.prevIncludedCount !== undefined) patch.prevIncludedCount = dto.prevIncludedCount;
    if (dto.improvementCount !== undefined) patch.improvementCount = dto.improvementCount;
    if (dto.contentOutput !== undefined) patch.contentOutput = dto.contentOutput;
    if (dto.notes !== undefined) patch.notes = dto.notes;
    if (dto.isSent !== undefined) patch.isSent = dto.isSent;
    if (dto.sentAt !== undefined) patch.sentAt = dto.sentAt;

    if (Object.keys(patch).length === 0) {
      return this.findById(id);
    }

    const conditions: ReturnType<typeof eq>[] = [eq(geoMonthlyReports.id, id)];
    if (user.role === 'client' && user.brandId) {
      conditions.push(eq(geoMonthlyReports.brandId, user.brandId));
    }

    const updated = await this.db
      .update(geoMonthlyReports)
      .set(patch)
      .where(and(...conditions))
      .returning({ id: geoMonthlyReports.id });

    if (updated.length === 0) {
      throw new NotFoundException('月报不存在');
    }

    return this.findById(id);
  }

  async markSent(id: string, user: GeoUserCtx): Promise<MonthlyReport> {
    return this.update(id, { isSent: true, sentAt: new Date() } as UpdateReportDto, user);
  }

  async calcMonthlyCreditUsed(brandId: string, reportMonth: string): Promise<number> {
    const [yearStr, monthStr] = reportMonth.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    const result = await this.db
      .select({
        total: sql<number>`COALESCE(SUM(ABS(amount)), 0)`,
      })
      .from(geoCreditTransactions)
      .where(and(
        eq(geoCreditTransactions.brandId, brandId),
        eq(geoCreditTransactions.transactionType, 'article_generate'),
        gte(geoCreditTransactions.createdAt, startDate),
        lt(geoCreditTransactions.createdAt, endDate),
      ));

    const articleTotal = Number(result[0]?.total ?? 0);

    const imageResult = await this.db
      .select({
        total: sql<number>`COALESCE(SUM(ABS(amount)), 0)`,
      })
      .from(geoCreditTransactions)
      .where(and(
        eq(geoCreditTransactions.brandId, brandId),
        eq(geoCreditTransactions.transactionType, 'image_generate'),
        gte(geoCreditTransactions.createdAt, startDate),
        lt(geoCreditTransactions.createdAt, endDate),
      ));

    const imageTotal = Number(imageResult[0]?.total ?? 0);

    const videoResult = await this.db
      .select({
        total: sql<number>`COALESCE(SUM(ABS(amount)), 0)`,
      })
      .from(geoCreditTransactions)
      .where(and(
        eq(geoCreditTransactions.brandId, brandId),
        eq(geoCreditTransactions.transactionType, 'video_generate'),
        gte(geoCreditTransactions.createdAt, startDate),
        lt(geoCreditTransactions.createdAt, endDate),
      ));

    const videoTotal = Number(videoResult[0]?.total ?? 0);

    return articleTotal + imageTotal + videoTotal;
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.db
      .delete(geoMonthlyReports)
      .where(eq(geoMonthlyReports.id, id))
      .returning({ id: geoMonthlyReports.id });

    if (deleted.length === 0) {
      throw new NotFoundException('月报不存在');
    }
  }

  async exportPdf(
    id: string,
    user: GeoUserCtx,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    // 1. 获取月报基础数据
    const report = await this.findOne(id, user);

    // 2. 查询关键词覆盖数
    const keywordCountResult = await this.db
      .select({ count: count() })
      .from(geoKeywords)
      .where(eq(geoKeywords.brandId, report.brandId));
    const keywordCount = Number(keywordCountResult[0]?.count ?? 0);

    // 3. 查询AI诊断数据（按平台分组）
    const aiStats = await this.getAiMentionStats(
      report.brandId,
      report.reportMonth,
    );

    // 4. 解析优化建议
    const suggestions: string[] = [];
    if (report.notes && report.notes.trim()) {
      const lines = report.notes
        .split('\n')
        .map((l: string) => l.trim())
        .filter((l: string) => l.length > 0);
      suggestions.push(...lines.slice(0, 4));
    }
    if (suggestions.length === 0) {
      suggestions.push(
        '持续优化核心关键词布局，提升页面相关性与权重',
        '加强长尾关键词内容建设，扩大搜索覆盖面',
        '定期监测收录与排名变化，及时调整优化策略',
        '关注AI搜索展示形态，提升品牌在AI结果中的露出率',
      );
    }

    // 5. 生成PDF
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await this.generatePdfBuffer({
        brandName: report.brandName,
        reportMonth: report.reportMonth,
        contentOutput: report.contentOutput,
        includedCount: report.includedCount,
        keywordCount,
        monthlyCreditUsed: report.monthlyCreditUsed,
        aiStats,
        suggestions,
      });
    } catch (err) {
      throw new InternalServerErrorException(
        `PDF生成失败：${(err as Error).message}`,
      );
    }

    const fileName = `${report.brandName}_${report.reportMonth}_月度报告.pdf`;
    return { buffer: pdfBuffer, fileName };
  }

  private async getAiMentionStats(
    brandId: string,
    reportMonth: string,
  ): Promise<Array<{ platform: string; mentionCount: number; hitRate: number }>> {
    const [yearStr, monthStr] = reportMonth.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    const rows = await this.db
      .select({
        reportData: geoDiagnosisReports.reportData,
        platforms: geoDiagnosisTasks.platforms,
      })
      .from(geoDiagnosisReports)
      .innerJoin(
        geoDiagnosisTasks,
        eq(geoDiagnosisReports.taskId, geoDiagnosisTasks.id),
      )
      .where(
        and(
          eq(geoDiagnosisReports.brandId, brandId),
          gte(geoDiagnosisReports.createdAt, startDate),
          lt(geoDiagnosisReports.createdAt, endDate),
        ),
      );

    if (rows.length === 0) {
      return [];
    }

    // 按平台聚合
    const platformMap = new Map<
      string,
      { totalHit: number; totalQuestions: number; count: number }
    >();

    for (const row of rows) {
      const platforms = (row.platforms as string[] | null) ?? [];
      const reportData = row.reportData as Record<string, unknown>;
      const visibility = reportData.visibility as
        | Record<string, unknown>
        | undefined;
      const hitQuestions = Number(visibility?.hitQuestions ?? 0);
      const totalQuestions = Number(visibility?.totalQuestions ?? 0);

      for (const platform of platforms) {
        const existing = platformMap.get(platform) ?? {
          totalHit: 0,
          totalQuestions: 0,
          count: 0,
        };
        existing.totalHit += hitQuestions;
        existing.totalQuestions += totalQuestions;
        existing.count += 1;
        platformMap.set(platform, existing);
      }
    }

    const platformLabels: Record<string, string> = {
      baidu: '百度',
      '360': '360搜索',
      sogou: '搜狗',
      toutiao: '头条',
      douyin: '抖音',
    };

    const result: Array<{ platform: string; mentionCount: number; hitRate: number }> = [];
    for (const [platform, stats] of platformMap.entries()) {
      const hitRate =
        stats.totalQuestions > 0
          ? Math.round((stats.totalHit / stats.totalQuestions) * 1000) / 10
          : 0;
      result.push({
        platform: platformLabels[platform] ?? platform,
        mentionCount: stats.totalHit,
        hitRate,
      });
    }

    return result.sort((a, b) => b.mentionCount - a.mentionCount);
  }

  private async generatePdfBuffer(data: {
    brandName: string;
    reportMonth: string;
    contentOutput: number;
    includedCount: number;
    keywordCount: number;
    monthlyCreditUsed: number;
    aiStats: Array<{ platform: string; mentionCount: number; hitRate: number }>;
    suggestions: string[];
  }): Promise<Buffer> {
    const html = this.buildReportHtml(data);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'geo-report-'));
    const htmlPath = path.join(tmpDir, 'report.html');
    const pdfPath = path.join(tmpDir, 'report.pdf');

    try {
      fs.writeFileSync(htmlPath, html, 'utf-8');

      const chromiumPath = process.env.CHROMIUM_PATH
        ?? (fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : '/usr/bin/chromium-browser');

      await execFileAsync(chromiumPath, [
        '--headless',
        '--disable-gpu',
        '--no-sandbox',
        '--no-pdf-header-footer',
        `--print-to-pdf=${pdfPath}`,
        `file://${htmlPath}`,
      ], { timeout: 30000 });

      if (!fs.existsSync(pdfPath)) {
        throw new Error('PDF文件未生成');
      }

      const pdfBuffer = fs.readFileSync(pdfPath);
      return pdfBuffer;
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  private buildReportHtml(data: {
    brandName: string;
    reportMonth: string;
    contentOutput: number;
    includedCount: number;
    keywordCount: number;
    monthlyCreditUsed: number;
    aiStats: Array<{ platform: string; mentionCount: number; hitRate: number }>;
    suggestions: string[];
  }): string {
    const [year, month] = data.reportMonth.split('-');
    const monthLabel = `${year}年${Number(month)}月`;
    const hitRatePercent = data.contentOutput > 0
      ? Math.round((data.includedCount / data.contentOutput) * 1000) / 10
      : 0;

    const aiRows = data.aiStats.length > 0
      ? data.aiStats.map((s) => `
        <tr>
          <td>${s.platform}</td>
          <td style="text-align:right">${s.mentionCount}</td>
          <td style="text-align:right">${s.hitRate}%</td>
        </tr>`).join('')
      : `<tr><td colspan="3" style="text-align:center;color:#94a3b8;padding:24px">本月暂无数据</td></tr>`;

    const suggestionItems = data.suggestions.length > 0
      ? data.suggestions.map((s, i) => `<li><span class="sug-num">${i + 1}</span>${s}</li>`).join('')
      : '<li style="list-style:none;color:#94a3b8">本月暂无数据</li>';

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${data.brandName} · ${data.reportMonth} 月度运营报告</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
    color: #0f172a;
    font-size: 14px;
    line-height: 1.6;
    padding: 40px 50px;
  }
  .header {
    text-align: center;
    padding-bottom: 24px;
    border-bottom: 2px solid #2E7DFF;
    margin-bottom: 28px;
  }
  .header h1 {
    font-size: 22px;
    font-weight: 700;
    color: #1e40af;
    margin-bottom: 6px;
  }
  .header .subtitle {
    font-size: 12px;
    color: #64748b;
    letter-spacing: 2px;
  }
  .brand-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    padding: 12px 16px;
    background: #f1f5f9;
    border-radius: 8px;
  }
  .brand-bar .brand {
    font-size: 15px;
    font-weight: 600;
    color: #1e293b;
  }
  .brand-bar .date {
    font-size: 13px;
    color: #64748b;
  }
  .section {
    margin-bottom: 26px;
  }
  .section-title {
    font-size: 15px;
    font-weight: 600;
    color: #0f172a;
    margin-bottom: 14px;
    padding-left: 10px;
    border-left: 3px solid #2E7DFF;
  }
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
  }
  .kpi-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 16px;
    text-align: center;
  }
  .kpi-card .value {
    font-size: 26px;
    font-weight: 700;
    color: #2E7DFF;
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
    margin-bottom: 6px;
  }
  .kpi-card .label {
    font-size: 12px;
    color: #64748b;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  th {
    background: #F7F9FC;
    padding: 10px 12px;
    text-align: left;
    font-weight: 600;
    color: #475569;
    border-bottom: 1px solid #e2e8f0;
  }
  td {
    padding: 10px 12px;
    border-bottom: 1px solid #e2e8f0;
    color: #334155;
  }
  .summary-row {
    display: flex;
    gap: 24px;
    padding: 14px 16px;
    background: #f8fafc;
    border-radius: 8px;
  }
  .summary-item {
    flex: 1;
    text-align: center;
  }
  .summary-item .num {
    font-size: 18px;
    font-weight: 700;
    color: #0f172a;
  }
  .summary-item .lbl {
    font-size: 12px;
    color: #64748b;
    margin-top: 2px;
  }
  .suggestions {
    list-style: none;
    counter-reset: sug;
  }
  .suggestions li {
    position: relative;
    padding: 10px 10px 10px 36px;
    border-bottom: 1px solid #f1f5f9;
    color: #334155;
  }
  .suggestions li:last-child {
    border-bottom: none;
  }
  .sug-num {
    position: absolute;
    left: 10px;
    top: 10px;
    width: 20px;
    height: 20px;
    line-height: 20px;
    text-align: center;
    background: #2E7DFF;
    color: white;
    border-radius: 50%;
    font-size: 11px;
    font-weight: 600;
  }
  .footer {
    margin-top: 32px;
    padding-top: 16px;
    border-top: 1px solid #e2e8f0;
    text-align: center;
    font-size: 11px;
    color: #94a3b8;
  }
</style>
</head>
<body>
  <div class="header">
    <h1>${data.brandName} · ${monthLabel} 月度运营报告</h1>
    <div class="subtitle">XINGHE GEO MONTHLY REPORT</div>
  </div>

  <div class="brand-bar">
    <div class="brand">品牌：${data.brandName}</div>
    <div class="date">报告周期：${monthLabel}</div>
  </div>

  <div class="section">
    <div class="section-title">一、核心指标概览</div>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="value">${data.contentOutput}</div>
        <div class="label">本月发布篇数</div>
      </div>
      <div class="kpi-card">
        <div class="value">${data.includedCount}</div>
        <div class="label">已收录数</div>
      </div>
      <div class="kpi-card">
        <div class="value">${data.keywordCount}</div>
        <div class="label">关键词覆盖</div>
      </div>
      <div class="kpi-card">
        <div class="value">¥${data.monthlyCreditUsed.toLocaleString()}</div>
        <div class="label">本月花费</div>
      </div>
    </div>
    <div class="summary-row" style="margin-top:14px">
      <div class="summary-item">
        <div class="num">${hitRatePercent}%</div>
        <div class="lbl">收录率</div>
      </div>
      <div class="summary-item">
        <div class="num">${data.aiStats.length}</div>
        <div class="lbl">覆盖平台数</div>
      </div>
      <div class="summary-item">
        <div class="num">${data.suggestions.length}</div>
        <div class="lbl">优化建议</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">二、AI 提及与命中率（按平台）</div>
    <table>
      <thead>
        <tr>
          <th>平台</th>
          <th style="text-align:right">AI 提及次数</th>
          <th style="text-align:right">命中率</th>
        </tr>
      </thead>
      <tbody>
        ${aiRows}
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">三、优化建议</div>
    <ul class="suggestions">
      ${suggestionItems}
    </ul>
  </div>

  <div class="footer">
    本报告由星河 GEO 系统自动生成 · ${data.reportMonth}
  </div>
</body>
</html>`;
  }

  private async findById(id: string): Promise<MonthlyReport> {
    const rows = await this.db
      .select({
        report: geoMonthlyReports,
        brandName: geoBrands.name,
      })
      .from(geoMonthlyReports)
      .leftJoin(geoBrands, eq(geoMonthlyReports.brandId, geoBrands.id))
      .where(eq(geoMonthlyReports.id, id));

    if (rows.length === 0) {
      throw new NotFoundException('月报不存在');
    }

    return this.mapRow(rows[0] as any);
  }
}
