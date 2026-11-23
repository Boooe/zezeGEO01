import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, desc, count, sql } from 'drizzle-orm';

import {
  geoCitationProbeTasks,
  geoCitationProbeResults,
  geoKeywords,
  geoAiKeys,
} from '@server/database/schema';
import type {
  CitationProbeTask,
  CitationProbeResult,
  CitationProbeTaskListResponse,
  CitationProbeResultListResponse,
  CitationProbeKpiResponse,
  CitationProbePlatformDistributionItem,
  CitationProbeKeywordItem,
  CitationProbeKeywordListResponse,
  GenerateQuestionsResponse,
  UserRole,
  DiagnosisPlatform,
  AiVendor,
} from '@shared/api.interface';
import {
  DIAGNOSIS_PLATFORMS,
  AI_VENDOR_DEFAULT_BASE_URL,
  AI_VENDOR_MODELS,
} from '@shared/api.interface';
import {
  CreateCitationProbeTaskDto,
  CitationProbeTaskListQueryDto,
  CitationProbeResultListQueryDto,
  CreateManualSnapshotDto,
  CitationProbeKpiQueryDto,
  CitationProbePlatformDistributionQueryDto,
} from './dto/citation-probe.dto';

interface GeoUserCtx {
  id: string;
  role: UserRole;
  brandId: string | null;
}

// URL 提取正则：匹配 http/https 开头，直到遇到空白、尖括号、引号、反引号、中文右括号等
const URL_REGEX = /https?:\/\/[^\s<>"'`）)】}\]]+/gi;

function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX);
  if (!matches) return [];
  // 去重并清理结尾标点
  const seen = new Set<string>();
  const result: string[] = [];
  for (const rawUrl of matches) {
    // 去掉结尾的标点符号（逗号、句号、分号、感叹号等）
    let cleaned = rawUrl.replace(/[，。；！,.!?;:]+$/u, '');
    if (!seen.has(cleaned)) {
      seen.add(cleaned);
      result.push(cleaned);
    }
  }
  return result;
}

function checkBrandMention(rawAnswer: string, aliases: string[]): { mentioned: boolean; position: number | null } {
  if (!rawAnswer || aliases.length === 0) return { mentioned: false, position: null };
  const lowerText = rawAnswer.toLowerCase();
  let firstIndex = Infinity;
  for (const alias of aliases) {
    const trimmed = alias.trim();
    if (!trimmed) continue;
    const idx = lowerText.indexOf(trimmed.toLowerCase());
    if (idx !== -1 && idx < firstIndex) {
      firstIndex = idx;
    }
  }
  if (firstIndex === Infinity) return { mentioned: false, position: null };
  // 按段落（换行分隔）计算首次出现在第几条
  const beforeText = rawAnswer.slice(0, firstIndex);
  const paragraphIndex = beforeText.split(/\n+/).filter((s: string) => s.trim().length > 0).length;
  return { mentioned: true, position: paragraphIndex + 1 };
}

const DIAGNOSIS_TO_VENDOR: Record<DiagnosisPlatform, AiVendor> = {
  doubao: 'volcano',
  deepseek: 'deepseek',
  wenxin: 'wenxin',
  tongyi: 'qwen',
  yuanbao: 'hunyuan',
  kimi: 'kimi',
};

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, '');
}

// 问题生成模板
const QUESTION_TEMPLATES = [
  // "XX 哪家好？"
  (kw: string) => `${kw}哪家好？`,
  // "XX 推荐"
  (kw: string) => `${kw}推荐`,
  // "XX 哪个牌子好"
  (kw: string) => `${kw}哪个牌子好？`,
  // "XX 靠谱吗"
  (kw: string) => `${kw}靠谱吗？`,
  // "XX 排行榜"
  (kw: string) => `${kw}排行榜`,
  // "XX 怎么样"
  (kw: string) => `${kw}怎么样？`,
  // "XX 评价如何"
  (kw: string) => `${kw}评价如何？`,
  // "XX 必去的地方"
  (kw: string) => `${kw}必去的地方`,
];

@Injectable()
export class CitationProbeService {
  private readonly logger = new Logger(CitationProbeService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  // ---------- 关键词列表 ----------

  async getKeywordList(
    brandId: string,
  ): Promise<CitationProbeKeywordListResponse> {
    const rows: Array<{ id: string; keyword: string }> = await this.db
      .select({
        id: geoKeywords.id,
        keyword: geoKeywords.keyword,
      })
      .from(geoKeywords)
      .where(eq(geoKeywords.brandId, brandId))
      .orderBy(desc(geoKeywords.createdAt))
      .limit(100);

    const items: CitationProbeKeywordItem[] = rows.map(
      (row: { id: string; keyword: string }) => ({
        id: row.id,
        keyword: row.keyword,
      }),
    );

    return { items };
  }

  // ---------- 生成提问模板 ----------

  generateQuestions(
    keywords: string[],
    count = 2,
  ): GenerateQuestionsResponse {
    const safeCount = Math.max(1, Math.min(count, QUESTION_TEMPLATES.length));
    const result: string[] = [];

    for (const keyword of keywords) {
      const kw = keyword.trim();
      if (!kw) continue;
      // 取前 safeCount 个模板
      for (let i = 0; i < safeCount; i += 1) {
        result.push(QUESTION_TEMPLATES[i](kw));
      }
    }

    return { questions: result };
  }

  // ---------- 创建任务 ----------

  async createTask(
    dto: CreateCitationProbeTaskDto,
    user: GeoUserCtx,
  ): Promise<CitationProbeTask> {
    const brandAliases = (dto.brandAliases ?? [])
      .map((a: string) => a.trim())
      .filter(Boolean)
      .slice(0, 20);

    const keywordIds = dto.keywordIds ?? [];
    const keywords = (dto.keywords ?? [])
      .map((k: string) => k.trim())
      .filter(Boolean)
      .slice(0, 100);

    const questions = dto.questions
      .map((q: string) => q.trim())
      .filter(Boolean);

    if (questions.length === 0) {
      throw new BadRequestException('提问列表不能为空');
    }

    const totalCount = questions.length * dto.platforms.length;

    const taskResult = await this.db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(geoCitationProbeTasks)
        .values({
          brandId: dto.brandId,
          brandName: dto.brandName.trim(),
          brandAliases,
          keywordIds,
          keywords,
          platforms: dto.platforms as unknown as string[],
          questions,
          status: 'pending',
          totalCount,
          completedCount: 0,
          creatorId: user.id,
        })
        .returning();

      if (!inserted) {
        throw new BadRequestException('任务创建失败');
      }

      const resultRows = [];
      for (const question of questions) {
        for (const platform of dto.platforms) {
          resultRows.push({
            taskId: inserted.id,
            brandId: dto.brandId,
            brandName: dto.brandName.trim(),
            brandAliases,
            question,
            platform,
            status: 'pending' as const,
            isMentioned: false,
            mentionPosition: null,
            citedUrls: [] as string[],
            rawAnswer: '',
            creatorId: user.id,
          });
        }
      }

      if (resultRows.length > 0) {
        await tx.insert(geoCitationProbeResults).values(resultRows);
      }

      return inserted;
    });

    return this.mapTask(taskResult);
  }

  // ---------- 任务列表 ----------

  async listTasks(
    query: CitationProbeTaskListQueryDto,
    user: GeoUserCtx,
  ): Promise<CitationProbeTaskListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions = [];

    const brandIdFilter = user.role === 'client' && user.brandId
      ? user.brandId
      : query.brandId;
    if (brandIdFilter) {
      conditions.push(eq(geoCitationProbeTasks.brandId, brandIdFilter));
    }

    if (query.status) {
      conditions.push(eq(geoCitationProbeTasks.status, query.status));
    }

    const where = conditions.length > 0
      ? and(...conditions)
      : undefined;

    const [countResult, rows] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(geoCitationProbeTasks)
        .where(where),
      this.db
        .select()
        .from(geoCitationProbeTasks)
        .where(where)
        .orderBy(desc(geoCitationProbeTasks.createdAt))
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const items: CitationProbeTask[] = rows.map(
      (row) => this.mapTask(row),
    );

    return { items, total, page, pageSize };
  }

  // ---------- 结果列表 ----------

  async listResults(
    query: CitationProbeResultListQueryDto,
    user: GeoUserCtx,
  ): Promise<CitationProbeResultListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions = [];

    const brandIdFilter = user.role === 'client' && user.brandId
      ? user.brandId
      : query.brandId;
    if (brandIdFilter) {
      conditions.push(eq(geoCitationProbeResults.brandId, brandIdFilter));
    }

    if (query.platform) {
      conditions.push(eq(geoCitationProbeResults.platform, query.platform));
    }

    if (query.isMentioned !== undefined) {
      conditions.push(eq(geoCitationProbeResults.isMentioned, query.isMentioned));
    }

    if (query.taskId) {
      conditions.push(eq(geoCitationProbeResults.taskId, query.taskId));
    }

    const where = conditions.length > 0
      ? and(...conditions)
      : undefined;

    const [countResult, rows] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(geoCitationProbeResults)
        .where(where),
      this.db
        .select()
        .from(geoCitationProbeResults)
        .where(where)
        .orderBy(
          desc(geoCitationProbeResults.executedAt),
          desc(geoCitationProbeResults.createdAt),
        )
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const items: CitationProbeResult[] = rows.map(
      (row) => this.mapResult(row),
    );

    return { items, total, page, pageSize };
  }

  // ---------- 平台接入状态 ----------

  async getPlatformsStatus(): Promise<{
    platforms: Record<DiagnosisPlatform, { connected: boolean; model: string | null }>;
  }> {
    const result: Record<DiagnosisPlatform, { connected: boolean; model: string | null }> = {
      doubao: { connected: false, model: null },
      deepseek: { connected: false, model: null },
      wenxin: { connected: false, model: null },
      tongyi: { connected: false, model: null },
      yuanbao: { connected: false, model: null },
      kimi: { connected: false, model: null },
    };

    const rows = await this.db
      .select()
      .from(geoAiKeys)
      .where(
        and(
          eq(geoAiKeys.ownerType, 'platform'),
          eq(geoAiKeys.status, 'ok'),
        ),
      );

    for (const row of rows) {
      const vendor = row.vendor as AiVendor;
      for (const platform of DIAGNOSIS_PLATFORMS) {
        if (DIAGNOSIS_TO_VENDOR[platform] === vendor && row.apiKey) {
          result[platform] = { connected: true, model: row.model ?? null };
          break;
        }
      }
    }

    return { platforms: result };
  }

  // ---------- 立即执行（单条结果）----------

  async executeResult(
    id: string,
    user: GeoUserCtx,
  ): Promise<CitationProbeResult> {
    const result = await this.db
      .select({
        id: geoCitationProbeResults.id,
        brandId: geoCitationProbeResults.brandId,
        question: geoCitationProbeResults.question,
        platform: geoCitationProbeResults.platform,
      })
      .from(geoCitationProbeResults)
      .where(eq(geoCitationProbeResults.id, id))
      .limit(1);

    if (result.length === 0) {
      throw new NotFoundException('结果不存在');
    }

    this.ensureCanRead(user, result[0].brandId);

    const platform = result[0].platform as DiagnosisPlatform;
    const vendor = DIAGNOSIS_TO_VENDOR[platform];
    if (!vendor) {
      throw new BadRequestException('不支持的平台');
    }

    const keyRows = await this.db
      .select()
      .from(geoAiKeys)
      .where(
        and(
          eq(geoAiKeys.ownerType, 'platform'),
          eq(geoAiKeys.vendor, vendor),
          eq(geoAiKeys.status, 'ok'),
        ),
      )
      .limit(1);

    if (keyRows.length === 0 || !keyRows[0].apiKey) {
      throw new BadRequestException('该平台尚未接入，请先在 AI 模型接入中配置');
    }

    const keyRow = keyRows[0];
    const baseUrl = keyRow.baseUrl ?? AI_VENDOR_DEFAULT_BASE_URL[vendor];
    const model = keyRow.model ?? AI_VENDOR_MODELS[vendor][0];
    const chatUrl = `${normalizeBaseUrl(baseUrl)}/chat/completions`;

    await this.db
      .update(geoCitationProbeResults)
      .set({ status: 'running', error: null, updatedAt: new Date() })
      .where(eq(geoCitationProbeResults.id, id));

    const questionText = result[0].question;
    const brandId = result[0].brandId;

    void this.runProbeAsync({
      id,
      brandId,
      question: questionText,
      platform,
      vendor,
      apiKey: keyRow.apiKey,
      baseUrl,
      model,
      chatUrl,
    }).catch((err: unknown) => {
      this.logger.error(`探针执行异步任务失败 ${id}: ${err instanceof Error ? err.message : String(err)}`);
    });

    const updated = await this.db
      .select()
      .from(geoCitationProbeResults)
      .where(eq(geoCitationProbeResults.id, id))
      .limit(1);

    return this.mapResult(updated[0]);
  }

  private async runProbeAsync(params: {
    id: string;
    brandId: string;
    question: string;
    platform: DiagnosisPlatform;
    vendor: AiVendor;
    apiKey: string;
    baseUrl: string;
    model: string;
    chatUrl: string;
  }): Promise<void> {
    const { id, brandId, question, platform, vendor, apiKey, model, chatUrl } = params;

    let rawAnswer: string | null = null;
    let errorMsg: string | null = null;
    let finalStatus: 'completed' | 'failed' = 'completed';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000);

      const response = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: `${question}。请分两部分回答：
一、用 3-6 条简要列出你推荐的对象或结论；
二、另起一段，标题写「来源」，逐条列出你依据的来源链接，必须是 http:// 或 https:// 开头的完整可访问地址（一条一行）；如果你没有可用来源，就在「来源」下写「无来源」。` }],
          max_tokens: 1000,
          stream: true,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        finalStatus = 'failed';
        const responseText = await response.text();
        let errMsg = `HTTP ${response.status}`;
        try {
          const parsed = JSON.parse(responseText) as { error?: { message?: string; code?: string } | string };
          if (typeof parsed.error === 'object' && parsed.error?.message) {
            errMsg = parsed.error.message;
          } else if (typeof parsed.error === 'string') {
            errMsg = parsed.error;
          }
        } catch {
          // ignore
        }
        errorMsg = errMsg.length > 500 ? errMsg.slice(0, 500) : errMsg;
      } else {
        const chunks: string[] = [];
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunkText = decoder.decode(value, { stream: true });
            const lines = chunkText.split('\n');
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data:')) continue;
              const dataStr = trimmed.slice(5).trim();
              if (dataStr === '[DONE]') continue;
              try {
                const data = JSON.parse(dataStr) as {
                  choices?: Array<{ delta?: { content?: string } }>;
                };
                const content = data.choices?.[0]?.delta?.content;
                if (content) chunks.push(content);
              } catch {
                // ignore malformed chunk
              }
            }
          }
        }
        rawAnswer = chunks.join('') || null;
      }
    } catch (err: unknown) {
      finalStatus = 'failed';
      if (err instanceof Error && err.name === 'AbortError') {
        errorMsg = '请求超时';
      } else {
        errorMsg = err instanceof Error ? err.message : '网络请求失败';
      }
    }

    const brandRow = await this.db
      .select({
        brandName: geoCitationProbeTasks.brandName,
        brandAliases: geoCitationProbeTasks.brandAliases,
      })
      .from(geoCitationProbeTasks)
      .rightJoin(
        geoCitationProbeResults,
        eq(geoCitationProbeResults.taskId, geoCitationProbeTasks.id),
      )
      .where(eq(geoCitationProbeResults.id, id))
      .limit(1);

    const brandAliases: string[] = brandRow[0]?.brandAliases ?? [];
    const brandName = brandRow[0]?.brandName ?? '';
    if (brandName && !brandAliases.includes(brandName)) {
      brandAliases.push(brandName);
    }

    const sourceUrls = rawAnswer ? extractUrls(rawAnswer) : [];
    const mentionResult = rawAnswer ? checkBrandMention(rawAnswer, brandAliases) : { mentioned: false, position: null };

    const updated = await this.db
      .update(geoCitationProbeResults)
      .set({
        status: finalStatus,
        rawAnswer,
        sourceUrls,
        isMentioned: mentionResult.mentioned,
        mentionPosition: mentionResult.position,
        error: errorMsg,
        executedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(geoCitationProbeResults.id, id))
      .returning();

    if (updated.length > 0 && updated[0].taskId) {
      try {
        await this.db
          .update(geoCitationProbeTasks)
          .set({
            completedCount: sql<number>`${geoCitationProbeTasks.completedCount} + 1`,
          })
          .where(eq(geoCitationProbeTasks.id, updated[0].taskId));
      } catch (err: unknown) {
        this.logger.warn(
          `更新任务 completedCount 失败: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  // ---------- 手工快照录入 ----------

  async createManualSnapshot(
    dto: CreateManualSnapshotDto,
    user: GeoUserCtx,
  ): Promise<CitationProbeResult> {
    this.ensureCanWrite(user, dto.brandId);

    const brandAliases = (dto.brandAliases ?? [])
      .map((a: string) => a.trim())
      .filter(Boolean);

    if (brandAliases.length === 0) {
      throw new BadRequestException('品牌别名不能为空，至少需要品牌名本身');
    }

    // 提取 URL
    const sourceUrls = extractUrls(dto.rawAnswer);

    // 判断品牌是否被提及及位置
    const mentionResult = checkBrandMention(dto.rawAnswer, brandAliases);

    const inserted = await this.db
      .insert(geoCitationProbeResults)
      .values({
        taskId: dto.taskId ?? null,
        brandId: dto.brandId,
        question: dto.question.trim(),
        platform: dto.platform,
        isMentioned: mentionResult.mentioned,
        mentionPosition: mentionResult.position,
        sourceUrls,
        rawAnswer: dto.rawAnswer,
        status: 'completed',
        error: null,
        executedAt: new Date(),
        creatorId: user.id,
      })
      .returning();

    if (inserted.length === 0) {
      throw new BadRequestException('结果创建失败');
    }

    // 如果有 taskId，更新任务 completedCount
    if (dto.taskId) {
      try {
        await this.db
          .update(geoCitationProbeTasks)
          .set({
            completedCount: sql<number>`${geoCitationProbeTasks.completedCount} + 1`,
          })
          .where(eq(geoCitationProbeTasks.id, dto.taskId));
      } catch (err: unknown) {
        this.logger.warn(
          `更新任务 completedCount 失败: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return this.mapResult(inserted[0]);
  }

  // ---------- KPI 统计 ----------

  async getKpi(
    query: CitationProbeKpiQueryDto,
    user: GeoUserCtx,
  ): Promise<CitationProbeKpiResponse> {
    const conditions = [];

    const brandIdFilter = user.role === 'client' && user.brandId
      ? user.brandId
      : query.brandId;
    if (brandIdFilter) {
      conditions.push(eq(geoCitationProbeResults.brandId, brandIdFilter));
    }

    if (query.platform) {
      conditions.push(eq(geoCitationProbeResults.platform, query.platform));
    }

    // 已执行总数
    const completedConditions = [
      eq(geoCitationProbeResults.status, 'completed'),
      ...conditions,
    ];

    const completedWhere = and(...completedConditions);

    // 总已执行探针数
    const totalProbesResult = await this.db
      .select({ count: count() })
      .from(geoCitationProbeResults)
      .where(completedWhere);
    const totalProbes = Number(totalProbesResult[0]?.count ?? 0);

    // 提及数 & 平均位置 & 去重信源数
    let mentionCount = 0;
    let avgPosition: number | null = null;
    let citedSourceCount = 0;

    if (totalProbes > 0) {
      // 用原生 SQL 计算：提及数、平均提及位置、去重信源数
      const brandIdParam = brandIdFilter ?? null;
      const platformParam = query.platform ?? null;

      const statsRows = await this.db.execute(sql<{
        mention_count: string;
        avg_position: string | null;
        cited_source_count: string;
      }>`
        SELECT
          (SELECT COUNT(*)::bigint FROM geo_citation_probe_results
           WHERE status = 'completed' AND is_mentioned = true
             ${brandIdParam ? sql`AND brand_id = ${brandIdParam}` : sql``}
             ${platformParam ? sql`AND platform = ${platformParam}` : sql``}
          ) AS mention_count,
          (SELECT AVG(mention_position) FROM geo_citation_probe_results
           WHERE status = 'completed' AND mention_position IS NOT NULL
             ${brandIdParam ? sql`AND brand_id = ${brandIdParam}` : sql``}
             ${platformParam ? sql`AND platform = ${platformParam}` : sql``}
          ) AS avg_position,
          (SELECT COUNT(DISTINCT url)::bigint FROM geo_citation_probe_results,
             unnest(source_urls) AS url
           WHERE status = 'completed'
             ${brandIdParam ? sql`AND brand_id = ${brandIdParam}` : sql``}
             ${platformParam ? sql`AND platform = ${platformParam}` : sql``}
          ) AS cited_source_count
      `);

      const row = statsRows[0];
      if (row) {
        mentionCount = Number(row.mention_count ?? 0);
        avgPosition = row.avg_position !== null && row.avg_position !== undefined
          ? Number(row.avg_position)
          : null;
        citedSourceCount = Number(row.cited_source_count ?? 0);
      }
    }

    // 提及率：百分比，保留 1 位小数
    const mentionRate = totalProbes > 0
      ? Math.round((mentionCount / totalProbes) * 1000) / 10
      : 0;

    return {
      totalProbes,
      mentionRate,
      avgPosition,
      citedSourceCount,
    };
  }

  // ---------- 平台提及分布 ----------

  async getPlatformDistribution(
    query: CitationProbePlatformDistributionQueryDto,
    user: GeoUserCtx,
  ): Promise<CitationProbePlatformDistributionItem[]> {
    const conditions = [
      eq(geoCitationProbeResults.status, 'completed'),
    ];

    const brandIdFilter = user.role === 'client' && user.brandId
      ? user.brandId
      : query.brandId;
    if (brandIdFilter) {
      conditions.push(eq(geoCitationProbeResults.brandId, brandIdFilter));
    }

    const where = and(...conditions);

    const rows = await this.db
      .select({
        platform: geoCitationProbeResults.platform,
        total: count(),
        mentioned: sql<number>`COUNT(*) FILTER (WHERE ${geoCitationProbeResults.isMentioned} = true)`,
      })
      .from(geoCitationProbeResults)
      .where(where)
      .groupBy(geoCitationProbeResults.platform);

    const map = new Map<string, { mentioned: number; total: number }>();
    for (const row of rows) {
      map.set(row.platform, {
        mentioned: Number(row.mentioned),
        total: Number(row.total),
      });
    }

    // 6 个平台都要有，0 的也要返回
    return DIAGNOSIS_PLATFORMS.map(
      (platform: DiagnosisPlatform): CitationProbePlatformDistributionItem => {
        const data = map.get(platform);
        return {
          platform,
          mentioned: data?.mentioned ?? 0,
          total: data?.total ?? 0,
        };
      },
    );
  }

  // ---------- 删除结果 ----------

  async deleteResult(id: string, user: GeoUserCtx): Promise<{ deleted: true }> {
    const result = await this.db
      .select({
        id: geoCitationProbeResults.id,
        brandId: geoCitationProbeResults.brandId,
        taskId: geoCitationProbeResults.taskId,
      })
      .from(geoCitationProbeResults)
      .where(eq(geoCitationProbeResults.id, id))
      .limit(1);

    if (result.length === 0) {
      throw new NotFoundException('结果不存在');
    }

    this.ensureCanWrite(user, result[0].brandId);

    const deleted = await this.db
      .delete(geoCitationProbeResults)
      .where(eq(geoCitationProbeResults.id, id))
      .returning({ id: geoCitationProbeResults.id });

    if (deleted.length === 0) {
      throw new NotFoundException('结果不存在');
    }

    return { deleted: true };
  }

  // ---------- 权限校验 ----------

  private ensureCanRead(user: GeoUserCtx, brandId: string): void {
    if (user.role === 'client' && user.brandId && user.brandId !== brandId) {
      throw new NotFoundException('结果不存在');
    }
  }

  private ensureCanWrite(user: GeoUserCtx, brandId: string): void {
    if (user.role === 'client') {
      if (!user.brandId) {
        throw new BadRequestException('客户账号未绑定品牌');
      }
      if (user.brandId !== brandId) {
        throw new BadRequestException('无权限操作其他品牌数据');
      }
    }
  }

  // ---------- 映射辅助 ----------

  private mapTask(row: typeof geoCitationProbeTasks.$inferSelect): CitationProbeTask {
    return {
      id: row.id,
      brandId: row.brandId,
      brandName: row.brandName,
      brandAliases: row.brandAliases ?? [],
      keywordIds: row.keywordIds ?? [],
      keywords: row.keywords ?? [],
      platforms: (row.platforms ?? []) as unknown as DiagnosisPlatform[],
      questions: row.questions ?? [],
      status: row.status as CitationProbeTask['status'],
      totalCount: row.totalCount,
      completedCount: row.completedCount,
      error: row.error,
      creatorId: row.creatorId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapResult(row: typeof geoCitationProbeResults.$inferSelect): CitationProbeResult {
    return {
      id: row.id,
      taskId: row.taskId ?? null,
      brandId: row.brandId,
      question: row.question,
      platform: row.platform as DiagnosisPlatform,
      isMentioned: row.isMentioned,
      mentionPosition: row.mentionPosition,
      sourceUrls: row.sourceUrls ?? [],
      rawAnswer: row.rawAnswer ?? null,
      status: row.status as CitationProbeResult['status'],
      error: row.error ?? null,
      executedAt: row.executedAt ? row.executedAt.toISOString() : null,
      creatorId: row.creatorId,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
