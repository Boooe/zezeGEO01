import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, isNull, desc, count, sql, asc, ilike, inArray } from 'drizzle-orm';

import {
  geoAiDetectTasks,
  geoAiDetectResults,
  geoBrands,
  geoAiKeys,
  geoCreditAccounts,
  geoCreditTransactions,
  geoKeywordResults,
  geoKeywords,
} from '@server/database/schema';
import type {
  AiDetectTask,
  AiDetectResult,
  AiDetectTaskSummary,
  AiDetectPlatform,
  AiDetectTaskStatus,
  AiDetectKeywordVisibility,
  AiDetectVisibilityResponse,
  AiDetectResultListResponse,
  AiDetectResultsStats,
  AiDetectPlatformStatusItem,
  AiDetectPlatformsStatusResponse,
  PagedResponse,
  UserRole,
  KeywordResult,
} from '@shared/api.interface';
import {
  AI_DETECT_PLATFORMS,
  AI_DETECT_PLATFORM_LABELS,
  AI_DETECT_TASK_STATUSES,
} from '@shared/api.interface';

import type {
  CreateDetectTaskDto,
  DetectTaskListQueryDto,
  DetectResultQueryDto,
  DetectVisibilityQueryDto,
} from './dto/detect.dto';

interface GeoUserCtx {
  id: string;
  role: UserRole;
  brandId: string | null;
}

interface PlatformKey {
  baseUrl: string;
  apiKey: string;
  model: string;
  vendor: string;
}

interface CallPlatformResult {
  rawAnswer: string | null;
  httpStatus: number | null;
  latencyMs: number;
  errorMessage: string | null;
}

interface BrandMentionAnalysis {
  isMentioned: boolean;
  mentionRank: number | null;
  mentionPosition: string | null;
  competitorBrands: string[];
  sourceDomains: string[];
}

const DETECT_CREDIT_PER_CALL = 1;
const TX_TYPE_AI_DETECT = 'ai_detect';

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

@Injectable()
export class DetectService {
  private readonly logger = new Logger(DetectService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  // ============================================================
  //  平台 Key 解析
  // ============================================================

  /**
   * 按平台从 geo_ai_keys 取平台级 key
   * 优先 is_default=true，没有则取该 vendor 下任意一条 ok 的
   */
  async getPlatformKey(platform: AiDetectPlatform): Promise<PlatformKey | null> {
    const rows = await this.db
      .select()
      .from(geoAiKeys)
      .where(
        and(
          eq(geoAiKeys.ownerType, 'platform'),
          isNull(geoAiKeys.ownerId),
          eq(geoAiKeys.vendor, platform),
          eq(geoAiKeys.status, 'ok'),
        ),
      );

    if (rows.length === 0) return null;

    // 优先 is_default
    const defaultRow = rows.find((r) => r.isDefault === true);
    const row = defaultRow ?? rows[0];

    if (!row.apiKey) return null;

    return {
      baseUrl: row.baseUrl ?? '',
      apiKey: row.apiKey,
      model: row.model ?? '',
      vendor: row.vendor,
    };
  }

  /**
   * 返回各检测平台的 Key 配置状态
   */
  async getPlatformsStatus(): Promise<AiDetectPlatformsStatusResponse> {
    const platforms: AiDetectPlatformStatusItem[] = [];
    for (const platform of AI_DETECT_PLATFORMS) {
      const key = await this.getPlatformKey(platform);
      platforms.push({
        platform,
        label: AI_DETECT_PLATFORM_LABELS[platform],
        isConfigured: !!key,
        configured: !!key,
        model: key ? key.model : null,
      });
    }
    return { platforms };
  }

  // ============================================================
  //  报表：AI 检测结果列表
  // ============================================================

  async getResults(
    query: { brandId: string; platform?: AiDetectPlatform; keyword?: string; isMentioned?: boolean; taskId?: string; page?: number; pageSize?: number },
    user: GeoUserCtx,
  ): Promise<PagedResponse<AiDetectResult>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions = this.buildAiResultWhere(query, user);
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [itemsRaw, totalResult] = await Promise.all([
      this.db
        .select()
        .from(geoAiDetectResults)
        .where(whereClause)
        .orderBy(desc(geoAiDetectResults.executedAt), desc(geoAiDetectResults.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(geoAiDetectResults)
        .where(whereClause),
    ]);

    const total = Number(totalResult[0]?.count ?? 0);
    let parentMap: Map<string, string> = new Map();
    if (itemsRaw.length > 0) {
      const keywordTexts = [...new Set(itemsRaw.map((r) => r.keyword))];
      const kwRows = await this.db
        .select({
          keyword: geoKeywords.keyword,
          parentId: geoKeywords.parentKeywordId,
        })
        .from(geoKeywords)
        .where(
          and(
            eq(geoKeywords.brandId, query.brandId),
            inArray(geoKeywords.keyword, keywordTexts),
          ),
        );
      const parentIds = kwRows
        .map((r) => r.parentId)
        .filter((id): id is string => id !== null);
      if (parentIds.length > 0) {
        const parentRows = await this.db
          .select({
            id: geoKeywords.id,
            keyword: geoKeywords.keyword,
          })
          .from(geoKeywords)
          .where(inArray(geoKeywords.id, parentIds));
        const parentById = new Map(parentRows.map((r) => [r.id, r.keyword]));
        for (const kw of kwRows) {
          if (kw.parentId && parentById.has(kw.parentId)) {
            parentMap.set(kw.keyword, parentById.get(kw.parentId)!);
          }
        }
      }
    }

    const items: AiDetectResult[] = itemsRaw.map((r) => {
      const base = this.resultRowToDto(r);
      return { ...base, parentKeyword: parentMap.get(r.keyword) ?? null };
    });

    return { items, total, page, pageSize };
  }

  // ============================================================
  //  报表：AI 检测结果统计
  // ============================================================

  async getResultsStats(
    query: { brandId: string; platform?: AiDetectPlatform; keyword?: string; isMentioned?: boolean },
    user: GeoUserCtx,
  ): Promise<AiDetectResultsStats> {
    const conditions = this.buildAiResultWhere(query, user);
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [overallRows, platformRows] = await Promise.all([
      this.db
        .select({
          totalCount: count(),
          mentionCount: sql<number>`count(*) filter (where ${geoAiDetectResults.isMentioned} = true)`,
          coveredPlatforms: sql<number>`count(distinct ${geoAiDetectResults.platform})`,
        })
        .from(geoAiDetectResults)
        .where(whereClause),
      this.db
        .select({
          platform: geoAiDetectResults.platform,
          totalCount: count(),
          mentionCount: sql<number>`count(*) filter (where ${geoAiDetectResults.isMentioned} = true)`,
        })
        .from(geoAiDetectResults)
        .where(whereClause)
        .groupBy(geoAiDetectResults.platform),
    ]);

    const totalCount = Number(overallRows[0]?.totalCount ?? 0);
    const mentionCount = Number(overallRows[0]?.mentionCount ?? 0);
    const mentionRate = totalCount > 0
      ? Number(((mentionCount / totalCount) * 100).toFixed(1))
      : 0;
    const coveredPlatforms = Number(overallRows[0]?.coveredPlatforms ?? 0);

    const platforms = AI_DETECT_PLATFORMS.map((p: AiDetectPlatform) => {
      const row = platformRows.find((r) => r.platform === p);
      const total = row ? Number(row.totalCount) : 0;
      const mention = row ? Number(row.mentionCount) : 0;
      const rate = total > 0
        ? Number(((mention / total) * 100).toFixed(1))
        : 0;
      return {
        platform: p,
        label: AI_DETECT_PLATFORM_LABELS[p],
        totalCount: total,
        mentionCount: mention,
        mentionRate: rate,
      };
    });

    return {
      totalCount,
      mentionCount,
      mentionRate,
      coveredPlatforms,
      platforms,
    };
  }

  // ============================================================
  //  报表：旧版搜索引擎记录数量
  // ============================================================

  async getLegacyResultsCount(
    brandId: string,
    user: GeoUserCtx,
  ): Promise<{ count: number }> {
    const effectiveBrandId = user.role === 'client' && user.brandId
      ? user.brandId
      : brandId;

    const result = await this.db
      .select({ count: count() })
      .from(geoKeywordResults)
      .where(eq(geoKeywordResults.brandId, effectiveBrandId));

    return { count: Number(result[0]?.count ?? 0) };
  }

  // ============================================================
  //  报表：旧版搜索引擎记录列表
  // ============================================================

  async getLegacyResults(
    query: { brandId: string; platform?: string; keyword?: string; page?: number; pageSize?: number },
    user: GeoUserCtx,
  ): Promise<PagedResponse<KeywordResult>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions = this.buildLegacyResultWhere(query, user);
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

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

    const dataQuery = whereClause ? baseQuery.where(whereClause) : baseQuery;

    const [itemsRaw, totalResult] = await Promise.all([
      dataQuery
        .orderBy(desc(geoKeywordResults.detectedAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(geoKeywordResults)
        .leftJoin(geoKeywords, eq(geoKeywordResults.keywordId, geoKeywords.id))
        .leftJoin(geoBrands, eq(geoKeywordResults.brandId, geoBrands.id))
        .where(whereClause),
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

    const total = Number(totalResult[0]?.count ?? 0);
    return { items, total, page, pageSize };
  }

  // ============================================================
  //  私有：where 条件构建
  // ============================================================

  private buildAiResultWhere(
    query: { brandId: string; platform?: AiDetectPlatform; keyword?: string; isMentioned?: boolean; taskId?: string },
    user: GeoUserCtx,
  ): ReturnType<typeof eq>[] {
    const conditions: ReturnType<typeof eq>[] = [];

    if (user.role === 'client' && user.brandId) {
      conditions.push(eq(geoAiDetectResults.brandId, user.brandId));
    } else if (query.brandId) {
      conditions.push(eq(geoAiDetectResults.brandId, query.brandId));
    }

    if (query.platform) {
      conditions.push(eq(geoAiDetectResults.platform, query.platform));
    }

    if (query.keyword) {
      conditions.push(ilike(geoAiDetectResults.keyword, `%${query.keyword}%`) as ReturnType<typeof eq>);
    }

    if (query.isMentioned !== undefined) {
      conditions.push(eq(geoAiDetectResults.isMentioned, query.isMentioned));
    }

    if (query.taskId) {
      conditions.push(eq(geoAiDetectResults.taskId, query.taskId));
    }

    return conditions;
  }

  private buildLegacyResultWhere(
    query: { brandId: string; platform?: string; keyword?: string },
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

    if (query.keyword) {
      conditions.push(ilike(geoKeywords.keyword, `%${query.keyword}%`) as ReturnType<typeof eq>);
    }

    return conditions;
  }

  // ============================================================
  //  品牌命中判定
  // ============================================================

  private analyzeBrandMention(
    rawAnswer: string,
    brandName: string,
    aliases: string[],
  ): BrandMentionAnalysis {
    const allNames = [brandName, ...aliases].filter(Boolean);
    const answer = rawAnswer ?? '';
    const answerLower = answer.toLowerCase();

    // 精确匹配：品牌名前后是边界字符（非中文字符、非字母数字）
    const isWordBoundary = (char: string): boolean => {
      if (!char) return true;
      // 中文字符范围
      if (/[\u4e00-\u9fa5]/.test(char)) return false;
      if (/[a-zA-Z0-9]/.test(char)) return false;
      return true;
    };

    const findExactMatch = (name: string): number => {
      if (!name) return -1;
      const nameLower = name.toLowerCase();
      let idx = answerLower.indexOf(nameLower);
      while (idx !== -1) {
        const before = idx > 0 ? answerLower[idx - 1] : '';
        const after = idx + nameLower.length < answerLower.length
          ? answerLower[idx + nameLower.length]
          : '';
        if (isWordBoundary(before) && isWordBoundary(after)) {
          return idx;
        }
        idx = answerLower.indexOf(nameLower, idx + 1);
      }
      return -1;
    };

    let firstMentionIndex = -1;
    let isMentioned = false;
    for (const name of allNames) {
      const idx = findExactMatch(name);
      if (idx !== -1) {
        isMentioned = true;
        if (firstMentionIndex === -1 || idx < firstMentionIndex) {
          firstMentionIndex = idx;
        }
      }
    }

    // 位次提取：第N家/第N名/第N个 / 数字序号 1. 2. 3.
    let mentionRank: number | null = null;
    let mentionPosition: string | null = null;

    if (isMentioned) {
      // 方法1："第N家/第N名/第N个/第N位" 模式
      const rankPattern = /第\s*(\d+)\s*(?:家|名|个|位|家店|家门店)/g;
      let match: RegExpExecArray | null;
      let minRankPos = Infinity;
      let matchedRank: number | null = null;
      while ((match = rankPattern.exec(answer)) !== null) {
        const rank = parseInt(match[1], 10);
        if (match.index < firstMentionIndex && match.index < minRankPos) {
          // 在品牌名之前出现的排位，不算（品牌自己的排位应该在附近）
        }
        // 找品牌名附近最近的排位
        if (Math.abs(match.index - firstMentionIndex) < 200) {
          if (match.index < minRankPos) {
            minRankPos = match.index;
            matchedRank = rank;
          }
        }
      }

      // 方法2：数字序号 "1. xxx"、"1、xxx"、"1）xxx"
      if (matchedRank === null) {
        const numPattern = /(\d+)\s*[.、．)）:：]\s*/g;
        while ((match = numPattern.exec(answer)) !== null) {
          // 检查这个序号后面到下一个序号之间是否包含品牌名
          const startIdx = match.index + match[0].length;
          const restAfter = answer.slice(startIdx);
          const nextNumMatch = restAfter.match(/\n\s*\d+\s*[.、．)）:：]/);
          const endIdx = nextNumMatch
            ? startIdx + nextNumMatch.index
            : answer.length;
          const segment = answerLower.slice(startIdx, endIdx);
          let hasBrand = false;
          for (const name of allNames) {
            if (name && segment.includes(name.toLowerCase())) {
              hasBrand = true;
              break;
            }
          }
          if (hasBrand) {
            matchedRank = parseInt(match[1], 10);
            break;
          }
        }
      }

      if (matchedRank !== null) {
        mentionRank = matchedRank;
        mentionPosition = `第${matchedRank}位`;
      } else {
        mentionRank = null;
        mentionPosition = '全文提及';
      }
    }

    // 竞品品牌：简单启发式
    const competitorBrands = this.extractCompetitorBrands(answer, allNames);

    // 来源域名
    const sourceDomains = this.extractSourceDomains(answer);

    return {
      isMentioned,
      mentionRank,
      mentionPosition,
      competitorBrands,
      sourceDomains,
    };
  }

  private extractCompetitorBrands(answer: string, ownNames: string[]): string[] {
    const brandsSet = new Set<string>();
    const ownLower = ownNames.map((n) => n.toLowerCase());

    // 模式1："推荐 xxx"、"推荐一下 xxx"
    const recommendPattern = /推荐(?:一下)?\s*[:：]?\s*([^\n，。！？、；,.!?;；]+)/g;
    let match: RegExpExecArray | null;
    while ((match = recommendPattern.exec(answer)) !== null) {
      let name = match[1].trim();
      // 截断到标点
      name = name.split(/[，。！？、；,.!?;；\n]/)[0].trim();
      if (name && name.length <= 20 && !ownLower.includes(name.toLowerCase())) {
        brandsSet.add(name);
      }
    }

    // 模式2：列举格式 "1. 店名" / "1、店名"
    const listPattern = /(?:^|\n)\s*\d+\s*[.、．)）]\s*([^\n，。！？、；,.!?;；]+)/g;
    while ((match = listPattern.exec(answer)) !== null) {
      let name = match[1].trim();
      name = name.split(/[，。！？、；,.!?;；\n]/)[0].trim();
      if (name && name.length <= 20 && !ownLower.includes(name.toLowerCase())) {
        brandsSet.add(name);
      }
    }

    return Array.from(brandsSet).slice(0, 5);
  }

  private extractSourceDomains(answer: string): string[] {
    const urlPattern = /https?:\/\/([^/\s'"<>）)】]+)/gi;
    const domains = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = urlPattern.exec(answer)) !== null) {
      let domain = match[1].toLowerCase();
      // 去掉 www. 前缀
      domain = domain.replace(/^www\./, '');
      if (domain.length <= 100) {
        domains.add(domain);
      }
    }
    return Array.from(domains).slice(0, 5);
  }

  // ============================================================
  //  真实 API 调用
  // ============================================================

  private async callPlatform(
    platform: AiDetectPlatform,
    key: PlatformKey,
    question: string,
  ): Promise<CallPlatformResult> {
    const startTime = Date.now();
    const url = `${normalizeBaseUrl(key.baseUrl)}/chat/completions`;

    let body: Record<string, unknown>;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key.apiKey}`,
    };

    if (platform === 'qwen') {
      // dashscope 兼容格式，顶层加 enable_search
      body = {
        model: key.model,
        input: {
          messages: [{ role: 'user', content: question }],
        },
        parameters: {
          enable_search: true,
        },
      };
    } else if (platform === 'hunyuan') {
      // 腾讯混元：OpenAI 兼容，顶层 enable_search
      body = {
        model: key.model,
        messages: [{ role: 'user', content: question }],
        enable_search: true,
      };
    } else {
      // volcano: 标准 OpenAI 格式
      body = {
        model: key.model,
        messages: [{ role: 'user', content: question }],
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const latencyMs = Date.now() - startTime;
      const responseText = await response.text();

      if (!response.ok) {
        let errorMsg = `HTTP ${response.status}`;
        try {
          const parsed = JSON.parse(responseText) as { error?: { message?: string } | string };
          if (typeof parsed.error === 'object' && parsed.error?.message) {
            errorMsg = parsed.error.message;
          } else if (typeof parsed.error === 'string') {
            errorMsg = parsed.error;
          }
        } catch {
          // 不是 JSON
        }
        if (errorMsg.length > 500) errorMsg = errorMsg.slice(0, 500);

        return {
          rawAnswer: responseText || null,
          httpStatus: response.status,
          latencyMs,
          errorMessage: errorMsg,
        };
      }

      // 解析回答
      let content = '';
      try {
        const data = JSON.parse(responseText) as {
          choices?: Array<{ message?: { content?: string } }>;
          output?: { text?: string; choices?: Array<{ message?: { content?: string } }> };
        };

        // 标准 OpenAI 格式
        if (data.choices?.[0]?.message?.content) {
          content = data.choices[0].message.content;
        }
        // dashscope 格式
        else if (data.output?.text) {
          content = data.output.text;
        } else if (data.output?.choices?.[0]?.message?.content) {
          content = data.output.choices[0].message.content;
        }
      } catch {
        content = responseText;
      }

      return {
        rawAnswer: content,
        httpStatus: response.status,
        latencyMs,
        errorMessage: null,
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      let errorMsg = '网络请求失败';
      if (err instanceof Error) {
        if (err.name === 'AbortError' || err.message.includes('timeout')) {
          errorMsg = '请求超时（90秒）';
        } else {
          errorMsg = err.message;
        }
      }
      if (errorMsg.length > 500) errorMsg = errorMsg.slice(0, 500);

      return {
        rawAnswer: null,
        httpStatus: null,
        latencyMs,
        errorMessage: errorMsg,
      };
    }
  }

  // ============================================================
  //  算力扣减
  // ============================================================

  private async deductCredit(
    brandId: string,
    amount: number,
    relatedType: string | null,
    relatedId: string | null,
    operatorId: string,
    description?: string,
  ): Promise<void> {
    if (amount <= 0) return;

    await this.db.transaction(async (tx) => {
      const accRows = await tx
        .select()
        .from(geoCreditAccounts)
        .where(eq(geoCreditAccounts.brandId, brandId))
        .limit(1)
        .for('update');

      let account = accRows[0];
      if (!account) {
        const created = await tx
          .insert(geoCreditAccounts)
          .values({
            brandId,
            balance: '0',
            totalUsed: '0',
            totalRecharged: '0',
          })
          .returning();
        account = created[0];
      }

      const balanceNum = Number(account.balance);
      if (balanceNum < amount) {
        throw new BadRequestException('算力不足，请联系服务商充值');
      }

      const newBalance = (balanceNum - amount).toString();
      const newTotalUsed = (Number(account.totalUsed) + amount).toString();

      await tx
        .update(geoCreditAccounts)
        .set({ balance: newBalance, totalUsed: newTotalUsed })
        .where(eq(geoCreditAccounts.id, account.id));

      await tx.insert(geoCreditTransactions).values({
        brandId,
        changeAmount: `-${amount}`,
        balanceAfter: newBalance,
        transactionType: TX_TYPE_AI_DETECT,
        relatedType,
        relatedId,
        description: description ?? null,
        operatorId,
      });
    });
  }

  private async getCreditBalance(brandId: string): Promise<number> {
    const rows = await this.db
      .select()
      .from(geoCreditAccounts)
      .where(eq(geoCreditAccounts.brandId, brandId))
      .limit(1);
    if (!rows[0]) return 0;
    return Number(rows[0].balance);
  }

  // ============================================================
  //  创建任务
  // ============================================================

  async createTask(dto: CreateDetectTaskDto, user: GeoUserCtx): Promise<AiDetectTask> {
    if (!dto.keywords?.length) {
      throw new BadRequestException('关键词不能为空');
    }
    if (!dto.platforms?.length) {
      throw new BadRequestException('检测平台不能为空');
    }
    for (const p of dto.platforms) {
      if (!AI_DETECT_PLATFORMS.includes(p)) {
        throw new BadRequestException(`不支持的平台: ${p}`);
      }
    }

    // 查品牌
    const brandRows = await this.db
      .select()
      .from(geoBrands)
      .where(eq(geoBrands.id, dto.brandId))
      .limit(1);
    if (!brandRows[0]) {
      throw new BadRequestException('品牌不存在');
    }
    const brand = brandRows[0];

    // 确定命中词：传入值优先 > 品牌 hit_words > 品牌名兜底
    let finalHitWords: string[] = [];
    if (dto.hitWords && dto.hitWords.length > 0) {
      finalHitWords = dto.hitWords;
    } else {
      const brandHitWords = (brand.hitWords as string[]) ?? [];
      if (brandHitWords.length > 0) {
        finalHitWords = brandHitWords;
      } else {
        finalHitWords = [brand.name];
      }
    }

    const totalCount = dto.keywords.length * dto.platforms.length;
    const concurrency = dto.concurrency ?? 3;

    const inserted = await this.db
      .insert(geoAiDetectTasks)
      .values({
        brandId: dto.brandId,
        brandName: brand.name,
        keywords: dto.keywords,
        platforms: dto.platforms as string[],
        concurrency,
        status: 'pending',
        totalCount,
        doneCount: 0,
        failedCount: 0,
        creatorId: user.id,
        hitWords: finalHitWords,
      })
      .returning();

    return this.taskRowToDto(inserted[0]);
  }

  // ============================================================
  //  运行任务（异步 fire-and-forget）
  // ============================================================

  async runTask(taskId: string, user: GeoUserCtx): Promise<void> {
    const taskRows = await this.db
      .select()
      .from(geoAiDetectTasks)
      .where(eq(geoAiDetectTasks.id, taskId))
      .limit(1);
    if (!taskRows[0]) {
      throw new NotFoundException('任务不存在');
    }
    const task = taskRows[0];

    // 幂等：已经在 running 直接返回
    if (task.status === 'running') {
      return;
    }
    if (task.status === 'completed') {
      throw new BadRequestException('任务已完成，不能重复运行');
    }

    // 查品牌 city
    const brandRows2 = await this.db
      .select()
      .from(geoBrands)
      .where(eq(geoBrands.id, task.brandId))
      .limit(1);
    const brandCity = brandRows2[0]?.city ?? null;
    const brandName = brandRows2[0]?.name ?? task.brandName;

    const hitWords = (task.hitWords as string[]) ?? [];

    // 逐个平台查 key
    const platformKeys = new Map<AiDetectPlatform, PlatformKey>();
    const missingPlatforms: string[] = [];
    for (const p of task.platforms) {
      const platform = p as AiDetectPlatform;
      const key = await this.getPlatformKey(platform);
      if (!key) {
        missingPlatforms.push(AI_DETECT_PLATFORM_LABELS[platform] ?? platform);
      } else {
        platformKeys.set(platform, key);
      }
    }
    if (missingPlatforms.length > 0) {
      throw new BadRequestException(
        `缺少平台 API Key：${missingPlatforms.join('、')}，请到「AI 模型接入」配置`,
      );
    }

    // 算力检查
    const totalCost = task.totalCount * DETECT_CREDIT_PER_CALL;
    const balance = await this.getCreditBalance(task.brandId);
    if (balance < totalCost) {
      throw new BadRequestException(
        `算力不足，需要 ${totalCost} 点，当前余额 ${balance} 点`,
      );
    }

    // 状态置 running
    await this.db
      .update(geoAiDetectTasks)
      .set({
        status: 'running',
        startedAt: new Date(),
        doneCount: 0,
        failedCount: 0,
        error: null,
      })
      .where(eq(geoAiDetectTasks.id, taskId));

    // 异步执行
    void this.executeTask(taskId, task.brandId, task.keywords, task.platforms as AiDetectPlatform[], platformKeys, brandName, brandCity, hitWords, task.concurrency, user.id);
  }

  private async executeTask(
    taskId: string,
    brandId: string,
    keywords: string[],
    platforms: AiDetectPlatform[],
    platformKeys: Map<AiDetectPlatform, PlatformKey>,
    brandName: string,
    brandCity: string | null,
    hitWords: string[],
    concurrency: number,
    operatorId: string,
  ): Promise<void> {
    const pairs: Array<{ keyword: string; platform: AiDetectPlatform }> = [];
    for (const keyword of keywords) {
      for (const platform of platforms) {
        pairs.push({ keyword, platform });
      }
    }

    let doneCount = 0;
    let failedCount = 0;
    let index = 0;
    const total = pairs.length;

    // 自实现并发控制
    const runNext = async (): Promise<void> => {
      while (index < total) {
        const currentIndex = index++;
        const { keyword, platform } = pairs[currentIndex];
        const key = platformKeys.get(platform)!;

        try {
          // 构造问题
          const city = brandCity ? brandCity : '';
          const question = city
            ? `${city}${keyword}？请给出具体店名和推荐理由。`
            : `${keyword}？请给出具体店名和推荐理由。`;

          // 调用平台
          const callResult = await this.callPlatform(platform, key, question);

          const isSuccess = callResult.httpStatus === 200 && !callResult.errorMessage;
          const rawAnswer = callResult.rawAnswer ?? '';

          let analysis: BrandMentionAnalysis = {
            isMentioned: false,
            mentionRank: null,
            mentionPosition: null,
            competitorBrands: [],
            sourceDomains: [],
          };

          if (isSuccess && rawAnswer) {
            const aliases = hitWords.filter((w) => w !== brandName);
            analysis = this.analyzeBrandMention(rawAnswer, brandName, aliases);
          }

          // 扣算力（成功才扣）
          if (isSuccess) {
            try {
              await this.deductCredit(
                brandId,
                DETECT_CREDIT_PER_CALL,
                'ai_detect',
                taskId,
                operatorId,
                `AI关键词检测 - ${platform} - ${keyword}`,
              );
            } catch (deductErr) {
              this.logger.warn(`扣减算力失败: ${deductErr}`);
            }
          }

          // 写结果
          await this.db.insert(geoAiDetectResults).values({
            taskId,
            brandId,
            keyword,
            platform,
            modelName: key.model,
            question,
            rawAnswer: callResult.rawAnswer,
            isMentioned: analysis.isMentioned,
            mentionRank: analysis.mentionRank,
            mentionPosition: analysis.mentionPosition,
            competitorBrands: analysis.competitorBrands,
            sourceDomains: analysis.sourceDomains,
            latencyMs: callResult.latencyMs,
            httpStatus: callResult.httpStatus,
            errorMessage: callResult.errorMessage,
            executedAt: new Date(),
          });

          doneCount++;
          if (!isSuccess) failedCount++;
        } catch (err) {
          this.logger.error(`检测异常 [${keyword}/${platform}]`, err);
          failedCount++;
          doneCount++;

          // 写一条失败记录
          try {
            await this.db.insert(geoAiDetectResults).values({
              taskId,
              brandId,
              keyword,
              platform,
              modelName: key.model,
              question: brandCity ? `${brandCity}${keyword}？请给出具体店名和推荐理由。` : `${keyword}？请给出具体店名和推荐理由。`,
              rawAnswer: null,
              isMentioned: false,
              mentionRank: null,
              mentionPosition: null,
              competitorBrands: [],
              sourceDomains: [],
              latencyMs: null,
              httpStatus: null,
              errorMessage: err instanceof Error ? err.message.slice(0, 500) : '未知错误',
              executedAt: new Date(),
            });
          } catch {
            // 忽略
          }
        }

        // 更新 task 计数
        try {
          await this.db
            .update(geoAiDetectTasks)
            .set({ doneCount, failedCount })
            .where(eq(geoAiDetectTasks.id, taskId));
        } catch {
          // 忽略计数更新失败
        }
      }
    };

    // 启动并发 worker
    const workers: Promise<void>[] = [];
    const workerCount = Math.min(concurrency, total);
    for (let i = 0; i < workerCount; i++) {
      workers.push(runNext());
    }
    await Promise.all(workers);

    // 全部跑完，更新状态
    const finalStatus: AiDetectTaskStatus = failedCount > 0 ? 'partial_failed' : 'completed';
    await this.db
      .update(geoAiDetectTasks)
      .set({
        status: finalStatus,
        completedAt: new Date(),
        doneCount,
        failedCount,
      })
      .where(eq(geoAiDetectTasks.id, taskId));

    this.logger.log(`AI检测任务完成: taskId=${taskId}, done=${doneCount}, failed=${failedCount}`);
  }

  private async getTaskBrandId(taskId: string): Promise<string | null> {
    const rows = await this.db
      .select({ brandId: geoAiDetectTasks.brandId })
      .from(geoAiDetectTasks)
      .where(eq(geoAiDetectTasks.id, taskId))
      .limit(1);
    return rows[0]?.brandId ?? null;
  }

  // ============================================================
  //  任务列表
  // ============================================================

  async getTaskList(
    query: DetectTaskListQueryDto,
    user: GeoUserCtx,
  ): Promise<PagedResponse<AiDetectTask>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (query.brandId) {
      conditions.push(eq(geoAiDetectTasks.brandId, query.brandId));
    } else if (user.role === 'client' && user.brandId) {
      conditions.push(eq(geoAiDetectTasks.brandId, user.brandId));
    }
    if (query.status) {
      conditions.push(eq(geoAiDetectTasks.status, query.status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [itemsRaw, totalResult] = await Promise.all([
      this.db
        .select()
        .from(geoAiDetectTasks)
        .where(whereClause)
        .orderBy(desc(geoAiDetectTasks.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(geoAiDetectTasks)
        .where(whereClause),
    ]);

    const total = Number(totalResult[0]?.count ?? 0);
    const items: AiDetectTask[] = itemsRaw.map((r) => this.taskRowToDto(r));

    return { items, total, page, pageSize };
  }

  // ============================================================
  //  任务详情 + 汇总统计
  // ============================================================

  async getTaskDetail(taskId: string): Promise<{ task: AiDetectTask; summary: AiDetectTaskSummary }> {
    const taskRows = await this.db
      .select()
      .from(geoAiDetectTasks)
      .where(eq(geoAiDetectTasks.id, taskId))
      .limit(1);
    if (!taskRows[0]) {
      throw new NotFoundException('任务不存在');
    }
    const task = this.taskRowToDto(taskRows[0]);

    const summary = await this.computeTaskSummary(taskId);
    return { task, summary };
  }

  private async computeTaskSummary(taskId: string): Promise<AiDetectTaskSummary> {
    const results = await this.db
      .select()
      .from(geoAiDetectResults)
      .where(eq(geoAiDetectResults.taskId, taskId));

    const validResults = results.filter((r) => r.httpStatus === 200 && !r.errorMessage);
    const failedCount = results.filter((r) => r.httpStatus !== 200 || r.errorMessage).length;

    const mentionedCount = validResults.filter((r) => r.isMentioned).length;
    const mentionRate = validResults.length > 0 ? mentionedCount / validResults.length : 0;

    // 各平台
    const mentionRateByPlatform = {} as Record<AiDetectPlatform, number>;
    const avgRankByPlatform = {} as Record<AiDetectPlatform, number | null>;
    for (const p of AI_DETECT_PLATFORMS) {
      const platformResults = validResults.filter((r) => r.platform === p);
      const mentioned = platformResults.filter((r) => r.isMentioned);
      mentionRateByPlatform[p] = platformResults.length > 0
        ? mentioned.length / platformResults.length
        : 0;

      const ranks = mentioned
        .filter((r) => r.mentionRank != null)
        .map((r) => r.mentionRank as number);
      avgRankByPlatform[p] = ranks.length > 0
        ? ranks.reduce((a, b) => a + b, 0) / ranks.length
        : null;
    }

    // 整体平均位次
    const allRanks = validResults
      .filter((r) => r.isMentioned && r.mentionRank != null)
      .map((r) => r.mentionRank as number);
    const avgRank = allRanks.length > 0
      ? allRanks.reduce((a, b) => a + b, 0) / allRanks.length
      : null;

    // 至少在一个平台被提及的关键词数
    const keywordPlatformMap = new Map<string, Set<string>>();
    for (const r of validResults) {
      if (r.isMentioned) {
        if (!keywordPlatformMap.has(r.keyword)) {
          keywordPlatformMap.set(r.keyword, new Set());
        }
        keywordPlatformMap.get(r.keyword)!.add(r.platform);
      }
    }
    const coveredKeywords = keywordPlatformMap.size;

    return {
      mentionRate,
      mentionRateByPlatform,
      avgRank,
      avgRankByPlatform,
      coveredKeywords,
      failedCount,
    };
  }

  // ============================================================
  //  结果列表
  // ============================================================

  async getTaskResults(
    taskId: string,
    query: DetectResultQueryDto,
  ): Promise<AiDetectResultListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions = [eq(geoAiDetectResults.taskId, taskId)];
    if (query.keyword) {
      conditions.push(eq(geoAiDetectResults.keyword, query.keyword));
    }
    if (query.platform) {
      conditions.push(eq(geoAiDetectResults.platform, query.platform));
    }
    const whereClause = and(...conditions);

    const [itemsRaw, totalResult] = await Promise.all([
      this.db
        .select()
        .from(geoAiDetectResults)
        .where(whereClause)
        .orderBy(asc(geoAiDetectResults.keyword), asc(geoAiDetectResults.platform))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(geoAiDetectResults)
        .where(whereClause),
    ]);

    const items: AiDetectResult[] = itemsRaw.map((r) => this.resultRowToDto(r));
    const summary = await this.computeTaskSummary(taskId);

    return { items, summary };
  }

  // ============================================================
  //  重试失败项
  // ============================================================

  async retryFailed(taskId: string, user: GeoUserCtx): Promise<void> {
    const taskRows = await this.db
      .select()
      .from(geoAiDetectTasks)
      .where(eq(geoAiDetectTasks.id, taskId))
      .limit(1);
    if (!taskRows[0]) {
      throw new NotFoundException('任务不存在');
    }
    const task = taskRows[0];

    // 找失败结果
    const failedResults = await this.db
      .select()
      .from(geoAiDetectResults)
      .where(
        and(
          eq(geoAiDetectResults.taskId, taskId),
          sql`(${geoAiDetectResults.httpStatus} != 200 OR ${geoAiDetectResults.errorMessage} IS NOT NULL)`,
        ),
      );

    if (failedResults.length === 0) {
      throw new BadRequestException('没有需要重试的失败项');
    }

    // 查品牌 city
    const brandRowsRetry = await this.db
      .select()
      .from(geoBrands)
      .where(eq(geoBrands.id, task.brandId))
      .limit(1);
    const brandCity = brandRowsRetry[0]?.city ?? null;
    const brandName = brandRowsRetry[0]?.name ?? task.brandName;

    const hitWords = (task.hitWords as string[]) ?? [];

    // 查各平台 key
    const platformKeys = new Map<AiDetectPlatform, PlatformKey>();
    const platformsNeeded = new Set(failedResults.map((r) => r.platform));
    const missingPlatforms: string[] = [];
    for (const p of platformsNeeded) {
      const platform = p as AiDetectPlatform;
      const key = await this.getPlatformKey(platform);
      if (!key) {
        missingPlatforms.push(AI_DETECT_PLATFORM_LABELS[platform] ?? platform);
      } else {
        platformKeys.set(platform, key);
      }
    }
    if (missingPlatforms.length > 0) {
      throw new BadRequestException(
        `缺少平台 API Key：${missingPlatforms.join('、')}`,
      );
    }

    // 算力检查
    const retryCost = failedResults.length * DETECT_CREDIT_PER_CALL;
    const balance = await this.getCreditBalance(task.brandId);
    if (balance < retryCost) {
      throw new BadRequestException(
        `算力不足，重试需要 ${retryCost} 点，当前余额 ${balance} 点`,
      );
    }

    // 先从 done/failed 计数里减去失败数（它们原本已计入 doneCount 和 failedCount）
    const failedCount = failedResults.length;
    const newDone = Math.max(0, task.doneCount - failedCount);
    const newFailed = Math.max(0, task.failedCount - failedCount);

    // 状态置 running
    await this.db
      .update(geoAiDetectTasks)
      .set({
        status: 'running',
        doneCount: newDone,
        failedCount: newFailed,
      })
      .where(eq(geoAiDetectTasks.id, taskId));

    // 异步重试
    void this.retryFailedResults(taskId, task.brandId, failedResults.map((r) => ({
      id: r.id,
      keyword: r.keyword,
      platform: r.platform as AiDetectPlatform,
    })), platformKeys, brandName, brandCity, hitWords, task.concurrency, user.id);
  }

  private async retryFailedResults(
    taskId: string,
    brandId: string,
    items: Array<{ id: string; keyword: string; platform: AiDetectPlatform }>,
    platformKeys: Map<AiDetectPlatform, PlatformKey>,
    brandName: string,
    brandCity: string | null,
    hitWords: string[],
    concurrency: number,
    operatorId: string,
  ): Promise<void> {
    let doneCount = 0;
    let failedCount = 0;
    let index = 0;
    const total = items.length;

    const runNext = async (): Promise<void> => {
      while (index < total) {
        const currentIndex = index++;
        const { id, keyword, platform } = items[currentIndex];
        const key = platformKeys.get(platform)!;

        let isSuccess = false;
        try {
          const question = brandCity
            ? `${brandCity}${keyword}？请给出具体店名和推荐理由。`
            : `${keyword}？请给出具体店名和推荐理由。`;

          const callResult = await this.callPlatform(platform, key, question);
          isSuccess = callResult.httpStatus === 200 && !callResult.errorMessage;
          const rawAnswer = callResult.rawAnswer ?? '';

          let analysis: BrandMentionAnalysis = {
            isMentioned: false,
            mentionRank: null,
            mentionPosition: null,
            competitorBrands: [],
            sourceDomains: [],
          };
          if (isSuccess && rawAnswer) {
            const aliases = hitWords.filter((w) => w !== brandName);
            analysis = this.analyzeBrandMention(rawAnswer, brandName, aliases);
          }

          if (isSuccess) {
            try {
              await this.deductCredit(
                brandId,
                DETECT_CREDIT_PER_CALL,
                'ai_detect',
                taskId,
                operatorId,
                `AI关键词检测重试 - ${platform} - ${keyword}`,
              );
            } catch {
              // 扣减失败不阻断
            }
          }

          // 更新 result
          await this.db
            .update(geoAiDetectResults)
            .set({
              modelName: key.model,
              question,
              rawAnswer: callResult.rawAnswer,
              isMentioned: analysis.isMentioned,
              mentionRank: analysis.mentionRank,
              mentionPosition: analysis.mentionPosition,
              competitorBrands: analysis.competitorBrands,
              sourceDomains: analysis.sourceDomains,
              latencyMs: callResult.latencyMs,
              httpStatus: callResult.httpStatus,
              errorMessage: callResult.errorMessage,
              executedAt: new Date(),
            })
            .where(eq(geoAiDetectResults.id, id));

          doneCount++;
          if (!isSuccess) failedCount++;
        } catch (err) {
          this.logger.error(`重试异常 [${keyword}/${platform}]`, err);
          failedCount++;
          doneCount++;
        }
      }
    };

    const workers: Promise<void>[] = [];
    const workerCount = Math.min(concurrency, total);
    for (let i = 0; i < workerCount; i++) {
      workers.push(runNext());
    }
    await Promise.all(workers);

    // 重新计数并更新最终状态
    const allResults = await this.db
      .select()
      .from(geoAiDetectResults)
      .where(eq(geoAiDetectResults.taskId, taskId));
    const totalFinal = allResults.length;
    const failedFinal = allResults.filter(
      (r) => r.httpStatus !== 200 || r.errorMessage,
    ).length;
    const finalStatus: AiDetectTaskStatus = failedFinal > 0 ? 'partial_failed' : 'completed';

    await this.db
      .update(geoAiDetectTasks)
      .set({
        status: finalStatus,
        completedAt: new Date(),
        doneCount: totalFinal,
        failedCount: failedFinal,
      })
      .where(eq(geoAiDetectTasks.id, taskId));

    this.logger.log(`AI检测重试完成: taskId=${taskId}, done=${totalFinal}, failed=${failedFinal}`);
  }

  // ============================================================
  //  词灵感可见度查询
  // ============================================================

  async getKeywordVisibility(
    dto: DetectVisibilityQueryDto,
  ): Promise<AiDetectVisibilityResponse> {
    const { brandId, keywords } = dto;
    if (!keywords?.length) {
      return {
        items: [],
        stats: {
          testedKeywords: 0,
          avgMentionRate: 0,
          mentionRateByPlatform: { volcano: 0, qwen: 0, hunyuan: 0, deepseek: 0, kimi: 0, wenxin: 0 },
        },
      };
    }

    // 对每个关键词，找各平台最新一条结果
    const items: AiDetectKeywordVisibility[] = [];

    for (const keyword of keywords) {
      const platformData = {} as AiDetectKeywordVisibility['platforms'];

      for (const p of AI_DETECT_PLATFORMS) {
        const results = await this.db
          .select()
          .from(geoAiDetectResults)
          .where(
            and(
              eq(geoAiDetectResults.brandId, brandId),
              eq(geoAiDetectResults.keyword, keyword),
              eq(geoAiDetectResults.platform, p),
            ),
          )
          .orderBy(desc(geoAiDetectResults.executedAt))
          .limit(1);

        if (results[0] && results[0].httpStatus === 200 && !results[0].errorMessage) {
          const r = results[0];
          platformData[p] = {
            status: r.isMentioned ? 'mentioned' : 'not_mentioned',
            rank: r.mentionRank,
            mentionPosition: r.mentionPosition,
            testedAt: r.executedAt ? new Date(r.executedAt).toISOString() : null,
            resultId: r.id,
          };
        } else {
          platformData[p] = {
            status: 'untested',
            rank: null,
            mentionPosition: null,
            testedAt: null,
            resultId: null,
          };
        }
      }

      items.push({ keyword, platforms: platformData });
    }

    // 统计
    const testedKeywords = items.filter((item) =>
      AI_DETECT_PLATFORMS.some((p) => item.platforms[p].status !== 'untested'),
    ).length;

    const mentionRateByPlatform = {} as Record<AiDetectPlatform, number>;
    for (const p of AI_DETECT_PLATFORMS) {
      const tested = items.filter((it) => it.platforms[p].status !== 'untested');
      const mentioned = tested.filter((it) => it.platforms[p].status === 'mentioned');
      mentionRateByPlatform[p] = tested.length > 0 ? mentioned.length / tested.length : 0;
    }

    // 平均提及率：各词的（被提及平台数 / 已检测平台数）的平均
    let totalRate = 0;
    let testedCount = 0;
    for (const item of items) {
      const testedList = AI_DETECT_PLATFORMS.filter(
        (p) => item.platforms[p].status !== 'untested',
      );
      if (testedList.length > 0) {
        const mentionedCount = testedList.filter(
          (p) => item.platforms[p].status === 'mentioned',
        ).length;
        totalRate += mentionedCount / testedList.length;
        testedCount++;
      }
    }
    const avgMentionRate = testedCount > 0 ? totalRate / testedCount : 0;

    return {
      items,
      stats: {
        testedKeywords,
        avgMentionRate,
        mentionRateByPlatform,
      },
    };
  }

  // ============================================================
  //  词灵感单测
  // ============================================================

  async runSingleDetect(
    brandId: string,
    keyword: string,
    platforms: AiDetectPlatform[],
    user: GeoUserCtx,
  ): Promise<{ taskId: string }> {
    const task = await this.createTask(
      { brandId, keywords: [keyword], platforms, concurrency: platforms.length },
      user,
    );
    await this.runTask(task.id, user);
    return { taskId: task.id };
  }

  // ============================================================
  //  样本数据播种（给指定品牌跑一批真实检测）
  // ============================================================

  async seedSamples(operatorId: string): Promise<{
    brands: Array<{
      brandId: string;
      brandName: string;
      totalCount: number;
      successCount: number;
      failedCount: number;
      taskId: string | null;
      failedReasons: string[];
    }>;
    probedPlatforms: Array<{ platform: string; available: boolean; reason?: string }>;
  }> {
    // 1. 定义 3 个品牌（第 3 个从库里按名称找）
    const brandDefs = [
      {
        id: 'f9a14492-a7d2-4b62-8d45-561dbb1bd330',
        name: '大鹏科技',
        keywords: [
          '石家庄网站建设公司推荐',
          '石家庄AI获客系统',
          '石家庄企业官网制作',
          '石家庄数字营销服务商',
          '石家庄GEO优化',
        ],
      },
      {
        id: 'c271a694-fcf3-41a8-9560-74f814b2705c',
        name: '悦齿口腔',
        keywords: [
          '石家庄口腔医院推荐',
          '石家庄种植牙哪家好',
          '石家庄牙齿矫正',
          '石家庄儿童牙科',
          '石家庄洗牙价格',
        ],
      },
    ];

    // 找爱婴岛母婴品牌
    const aiyingdaoRows = await this.db
      .select({ id: geoBrands.id, name: geoBrands.name })
      .from(geoBrands)
      .where(ilike(geoBrands.name, '%爱婴岛%'))
      .limit(1);
    if (aiyingdaoRows[0]) {
      brandDefs.push({
        id: aiyingdaoRows[0].id,
        name: aiyingdaoRows[0].name,
        keywords: [
          '石家庄母婴店推荐',
          '石家庄婴儿用品店',
          '石家庄奶粉哪里买',
          '石家庄宝宝辅食',
          '石家庄母婴用品批发',
        ],
      });
    }

    // 2. 查所有已配置的平台 key
    const platformKeys = new Map<AiDetectPlatform, PlatformKey>();
    for (const p of AI_DETECT_PLATFORMS) {
      const key = await this.getPlatformKey(p);
      if (key) platformKeys.set(p, key);
    }

    // 3. 可用性探测
    const probeResults: Array<{ platform: string; available: boolean; reason?: string }> = [];
    const availablePlatforms: AiDetectPlatform[] = [];
    for (const [platform, key] of platformKeys) {
      try {
        const result = await this.callPlatform(platform, key, '你好，请回复OK');
        if (result.httpStatus === 200 && !result.errorMessage && result.rawAnswer) {
          probeResults.push({ platform, available: true });
          availablePlatforms.push(platform);
        } else {
          probeResults.push({
            platform,
            available: false,
            reason: result.errorMessage ?? `HTTP ${result.httpStatus}`,
          });
        }
      } catch (err) {
        probeResults.push({
          platform,
          available: false,
          reason: err instanceof Error ? err.message : '探测异常',
        });
      }
    }

    // 标记未配置 key 的平台
    for (const p of AI_DETECT_PLATFORMS) {
      if (!platformKeys.has(p)) {
        probeResults.push({ platform: p, available: false, reason: '未配置 API Key' });
      }
    }

    if (availablePlatforms.length === 0) {
      return {
        brands: brandDefs.map((b) => ({
          brandId: b.id,
          brandName: b.name,
          totalCount: 0,
          successCount: 0,
          failedCount: 0,
          taskId: null,
          failedReasons: ['没有可用的检测平台'],
        })),
        probedPlatforms: probeResults,
      };
    }

    // 4. 对每个品牌创建 task 并执行检测
    const brandStats: Array<{
      brandId: string;
      brandName: string;
      totalCount: number;
      successCount: number;
      failedCount: number;
      taskId: string | null;
      failedReasons: string[];
    }> = [];

    for (const brandDef of brandDefs) {
      const totalCount = brandDef.keywords.length * availablePlatforms.length;
      let successCount = 0;
      let failedCount = 0;
      const failedReasonsSet = new Set<string>();

      // 创建 task（直接 completed，因为同步执行）
      const taskRows = await this.db
        .insert(geoAiDetectTasks)
        .values({
          brandId: brandDef.id,
          brandName: brandDef.name,
          keywords: brandDef.keywords,
          platforms: availablePlatforms as string[],
          concurrency: 2,
          status: 'running',
          totalCount,
          doneCount: 0,
          failedCount: 0,
          creatorId: operatorId,
          hitWords: [brandDef.name],
          startedAt: new Date(),
        })
        .returning({ id: geoAiDetectTasks.id });
      const taskId = taskRows[0].id;

      // 逐个关键词 + 平台执行
      for (const keyword of brandDef.keywords) {
        for (const platform of availablePlatforms) {
          const key = platformKeys.get(platform)!;
          const question = `石家庄${keyword}？请给出具体店名和推荐理由。`;

          try {
            const callResult = await this.callPlatform(platform, key, question);
            const isSuccess = callResult.httpStatus === 200 && !callResult.errorMessage;
            const rawAnswer = callResult.rawAnswer ?? '';

            let analysis: BrandMentionAnalysis = {
              isMentioned: false,
              mentionRank: null,
              mentionPosition: null,
              competitorBrands: [],
              sourceDomains: [],
            };
            if (isSuccess && rawAnswer) {
              analysis = this.analyzeBrandMention(rawAnswer, brandDef.name, []);
            }

            // 写结果
            await this.db.insert(geoAiDetectResults).values({
              taskId,
              brandId: brandDef.id,
              keyword,
              platform,
              modelName: key.model,
              question,
              rawAnswer: callResult.rawAnswer,
              isMentioned: analysis.isMentioned,
              mentionRank: analysis.mentionRank,
              mentionPosition: analysis.mentionPosition,
              competitorBrands: analysis.competitorBrands,
              sourceDomains: analysis.sourceDomains,
              latencyMs: callResult.latencyMs,
              httpStatus: callResult.httpStatus,
              errorMessage: callResult.errorMessage,
              executedAt: new Date(),
            });

            if (isSuccess) {
              successCount++;
            } else {
              failedCount++;
              if (callResult.errorMessage) {
                failedReasonsSet.add(callResult.errorMessage.slice(0, 100));
              }
            }
          } catch (err) {
            failedCount++;
            const msg = err instanceof Error ? err.message.slice(0, 100) : '未知错误';
            failedReasonsSet.add(msg);

            // 写失败记录
            try {
              await this.db.insert(geoAiDetectResults).values({
                taskId,
                brandId: brandDef.id,
                keyword,
                platform,
                modelName: key.model,
                question,
                rawAnswer: null,
                isMentioned: false,
                mentionRank: null,
                mentionPosition: null,
                competitorBrands: [],
                sourceDomains: [],
                latencyMs: null,
                httpStatus: null,
                errorMessage: msg,
                executedAt: new Date(),
              });
            } catch {
              // ignore
            }
          }
        }
      }

      // 更新 task 最终状态
      const finalStatus = failedCount > 0 ? 'partial_failed' : 'completed';
      await this.db
        .update(geoAiDetectTasks)
        .set({
          status: finalStatus,
          completedAt: new Date(),
          doneCount: successCount + failedCount,
          failedCount,
        })
        .where(eq(geoAiDetectTasks.id, taskId));

      brandStats.push({
        brandId: brandDef.id,
        brandName: brandDef.name,
        totalCount,
        successCount,
        failedCount,
        taskId,
        failedReasons: Array.from(failedReasonsSet).slice(0, 5),
      });
    }

    return {
      brands: brandStats,
      probedPlatforms: probeResults,
    };
  }

  // ============================================================
  //  行转 DTO 辅助
  // ============================================================

  private taskRowToDto(row: typeof geoAiDetectTasks.$inferSelect): AiDetectTask {
    const status = (AI_DETECT_TASK_STATUSES as readonly string[]).includes(row.status)
      ? row.status as AiDetectTaskStatus
      : 'pending';
    const platforms = (row.platforms as string[]).filter(
      (p): p is AiDetectPlatform =>
        (AI_DETECT_PLATFORMS as readonly string[]).includes(p),
    );

    return {
      id: row.id,
      brandId: row.brandId,
      brandName: row.brandName,
      keywords: row.keywords as string[],
      platforms,
      hitWords: (row.hitWords as string[]) ?? [],
      concurrency: row.concurrency,
      status,
      totalCount: row.totalCount,
      doneCount: row.doneCount,
      failedCount: row.failedCount,
      error: row.error,
      creatorId: row.creatorId,
      startedAt: row.startedAt ? new Date(row.startedAt).toISOString() : null,
      completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
      createdAt: new Date(row.createdAt).toISOString(),
    };
  }

  private resultRowToDto(row: typeof geoAiDetectResults.$inferSelect): AiDetectResult {
    const platform = (AI_DETECT_PLATFORMS as readonly string[]).includes(row.platform)
      ? row.platform as AiDetectPlatform
      : 'volcano';

    return {
      id: row.id,
      taskId: row.taskId,
      brandId: row.brandId,
      keyword: row.keyword,
      platform,
      modelName: row.modelName,
      question: row.question,
      rawAnswer: row.rawAnswer,
      isMentioned: row.isMentioned,
      mentionRank: row.mentionRank,
      mentionPosition: row.mentionPosition,
      competitorBrands: row.competitorBrands as string[],
      sourceDomains: row.sourceDomains as string[],
      latencyMs: row.latencyMs,
      httpStatus: row.httpStatus,
      errorMessage: row.errorMessage,
      executedAt: row.executedAt ? new Date(row.executedAt).toISOString() : null,
      parentKeyword: null,
    };
  }
}
