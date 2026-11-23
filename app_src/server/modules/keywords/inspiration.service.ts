import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
  CapabilityService as PlatformCapabilityService,
} from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, inArray } from 'drizzle-orm';

import { geoKeywordPool } from '@server/database/schema';
import { throwAiError } from '@server/common/utils/ai-error';
import type {
  InspirationKeyword,
  KeywordType,
  UserRole,
  InspirationIntentType,
} from '@shared/api.interface';
import {
  INSPIRATION_INTENT_TYPES,
  INSPIRATION_INDUSTRY_LABELS,
} from '@shared/api.interface';
import {
  GenerateInspirationDto,
  AddInspirationToPoolDto,
} from './dto/keywords.dto';

interface GeoUserCtx {
  id: string;
  role: UserRole;
  brandId: string | null;
}

const TEXT_GENERATE_ID = 'geo_text_generate_1';

const STRONG_TRANSACTION_WORDS = [
  '预定', '定制', '购买', '下单', '价格', '多少钱', '预约', '报名', '预订',
];

const WEAK_TRANSACTION_WORDS = [
  '推荐', '哪家好', '排名', '排行榜',
];

interface AiKeywordItem {
  keyword: string;
  intentType: string;
  sceneTag: string;
  hasBrand: boolean;
  hasLocation: boolean;
  reason: string;
}

@Injectable()
export class InspirationService {
  private readonly logger = new Logger(InspirationService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    @Inject(PlatformCapabilityService)
    private readonly platformCapabilityService: PlatformCapabilityService,
  ) {}

  // ---------- 生成灵感词 ----------

  async generate(
    dto: GenerateInspirationDto,
    user: GeoUserCtx,
  ): Promise<{ items: InspirationKeyword[] }> {
    // client 只能操作自己品牌
    if (user.role === 'client') {
      if (user.brandId !== dto.brandId) {
        throw new ForbiddenException('只能操作所属品牌的数据');
      }
    }

    const seedKeyword = dto.seedKeyword.trim();
    if (!seedKeyword) {
      throw new BadRequestException('种子词不能为空');
    }

    const count = dto.count ?? 10;
    const brandName = dto.brandName?.trim() || '';
    const city = dto.city?.trim() || '';
    const districts = dto.districts?.filter((d: string) => d.trim()) ?? [];
    const industryKey = dto.industry || '';
    const industryLabel = industryKey
      ? (INSPIRATION_INDUSTRY_LABELS[
          industryKey as keyof typeof INSPIRATION_INDUSTRY_LABELS
        ] ?? '通用')
      : '通用';
    const includeBrand = dto.includeBrand ?? false;
    const includeQuestion = dto.includeQuestion ?? false;
    const includeLocal = dto.includeLocal ?? true;

    // 构建 prompt
    const additionalRequirements = this.buildPrompt({
      count,
      seedKeyword,
      brandName,
      city,
      districts,
      industryLabel,
      includeBrand,
      includeQuestion,
      includeLocal,
    });

    // 调用 AI 插件
    let rawText: string;
    try {
      const result = await this.platformCapabilityService
        .load(TEXT_GENERATE_ID)
        .call('textGenerate', {
          content_topic: `关键词蒸馏：${seedKeyword}`,
          content_type: 'SEO关键词分析',
          additional_requirements: additionalRequirements,
        });

      const resultObj = result as { content?: string; response?: string };
      rawText = (resultObj.content ?? resultObj.response ?? '').trim();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error('关键词灵感 AI 调用失败', msg);
      throwAiError('AI 关键词生成失败', msg);
    }

    if (!rawText) {
      throw new BadRequestException('AI 返回格式异常，请稍后重试');
    }

    // 解析 JSON（去除可能的 markdown 代码块包裹）
    const jsonStr = this.extractJson(rawText);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      throw new BadRequestException('AI 返回格式异常，请稍后重试');
    }

    // 校验结构
    const items = this.validateAndNormalize(parsed);
    if (items.length === 0) {
      throw new BadRequestException('AI 返回格式异常，请稍后重试');
    }

    // 品牌词保底 + 清洗
    if (includeBrand && brandName) {
      this.ensureBrandKeywords(items, brandName);
    }

    // 按用户请求数量截取
    const sliced = items.slice(0, count);

    // 计算机会分并构建返回结构
    const resultItems: InspirationKeyword[] = sliced.map(
      (item: AiKeywordItem): InspirationKeyword => {
        const score = this.calcOpportunityScore({
          keyword: item.keyword,
          intentType: item.intentType as InspirationIntentType,
          hasBrand: item.hasBrand,
          hasLocation: item.hasLocation,
          city,
          districts,
          includeBrand,
        });
        return {
          keyword: item.keyword,
          keywordType: dto.keywordType as KeywordType,
          intentType: item.intentType as InspirationIntentType,
          sceneTag: item.sceneTag,
          hasLocation: item.hasLocation,
          hasBrand: item.hasBrand,
          opportunityScore: score,
          reason: item.reason,
          searchVolume: null,
          competition: null,
        };
      },
    );

    return { items: resultItems };
  }

  // ---------- 一键加入词池 ----------

  async addToPool(
    dto: AddInspirationToPoolDto,
    user: GeoUserCtx,
  ): Promise<{ added: number; skipped: number }> {
    this.ensureCanWrite(user, dto.brandId);

    // 去重：按 keyword + keywordType
    const unique = new Map<
      string,
      { keyword: string; keywordType: KeywordType; reason?: string }
    >();
    for (const item of dto.keywords) {
      const kw = item.keyword.trim();
      if (!kw) continue;
      const key = `${kw}:${item.keywordType}`;
      if (!unique.has(key)) {
        unique.set(key, {
          keyword: kw,
          keywordType: item.keywordType as KeywordType,
          reason: item.reason,
        });
      }
    }

    if (unique.size === 0) {
      throw new BadRequestException('关键词列表不能为空');
    }

    // 查询词池已存在的
    const existingRows = await this.db
      .select({
        keyword: geoKeywordPool.keyword,
        keywordType: geoKeywordPool.keywordType,
      })
      .from(geoKeywordPool)
      .where(
        and(
          eq(geoKeywordPool.brandId, dto.brandId),
          inArray(
            geoKeywordPool.keyword,
            Array.from(unique.values()).map(
              (v: { keyword: string; keywordType: KeywordType; reason?: string }) => v.keyword,
            ),
          ),
        ),
      );

    const existingSet = new Set(
      existingRows.map(
        (r: { keyword: string; keywordType: string }) => `${r.keyword}:${r.keywordType}`,
      ),
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

    for (const [key, item] of unique.entries()) {
      if (existingSet.has(key)) continue;
      toInsert.push({
        brandId: dto.brandId,
        keyword: item.keyword,
        keywordType: item.keywordType,
        groupId: dto.groupId ?? null,
        source: 'inspiration',
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

  // ---------- 私有辅助方法 ----------

  private buildPrompt(params: {
    count: number;
    seedKeyword: string;
    brandName: string;
    city: string;
    districts: string[];
    industryLabel: string;
    includeBrand: boolean;
    includeQuestion: boolean;
    includeLocal: boolean;
  }): string {
    const {
      count,
      seedKeyword,
      brandName,
      city,
      districts,
      industryLabel,
      includeBrand,
      includeQuestion,
      includeLocal,
    } = params;
    return `你是 SEO 关键词专家。请根据以下信息，生成 ${count} 个高质量、自然语言化的长尾关键词：

种子关键词：${seedKeyword}
品牌：${brandName || '无'}
城市/地域：${city || '无'}
区县：${districts.length > 0 ? districts.join('、') : '无'}
行业：${industryLabel}

要求：
1. 覆盖 5 类搜索意图，每类至少 1-2 个，分布均匀：
   - cognitive（认知型）：如「石家庄哪家蛋糕店好吃」「蛋糕店推荐」
   - comparison（比较型）：如「石家庄蛋糕店排名」「A品牌和B品牌哪个好」
   - transaction（交易型）：如「生日蛋糕预定」「结婚蛋糕定制多少钱」
   - local（本地到店型）：如「石家庄桥西区蛋糕店」「裕华区哪里有蛋糕店」
   - scenario（场景/需求型）：如「公司团建蛋糕」「宝宝生日蛋糕」「无糖蛋糕」

2. 每个关键词必须包含以下信息，严格输出 JSON 数组：
   - keyword: 完整关键词（自然语言，不要机械拼接）
   - intentType: 意图类型（cognitive/comparison/transaction/local/scenario）
   - sceneTag: 场景标签（如：生日/价格/排名/到店/无糖/团建/宝宝/品牌对比）
   - hasBrand: 是否包含品牌词（布尔值）
   - hasLocation: 是否包含地域/区县词（布尔值）
   - reason: 一句话推荐理由（15字以内，说清为什么值得做）

3. 输出规则：
   - 不要「XX怎么样/XX好用吗/XX效果如何/XX官网」这类老模板词
   - 品牌名只在比较型、品牌认知型中自然出现，不要每个词都塞
   - 同义/近义词自动合并，只留一个
   - 10 个词必须明显区分，不能有 5 个只是换尾巴
   - 关键词长度控制在 4-15 字之间，自然口语化
   - ${includeQuestion ? '允许使用疑问句（如「哪家好」「多少钱」）' : '尽量用陈述句，少用疑问句形式'}
   - ${includeLocal ? '优先产出带本地地域、区县的到店类关键词' : '尽量不要出现地域词和到店类词'}
   - ${includeBrand ? `适当加入品牌词，明确包含「${brandName}」的词至少 2-3 个，品牌词要以自然问法出现，例如「${brandName}怎么样」「${brandName}和附近同类店比哪家好」「${brandName}价格多少钱」等；比较类里对比方用「附近同类店/其他店/同行业品牌」等泛指，绝对不要编造或出现任何真实第三方品牌名称` : '不要出现具体品牌名'}

只返回 JSON 数组，不要任何解释文字、markdown 代码块或前缀后缀。`;
  }

  private extractJson(text: string): string {
    // 去除 markdown 代码块包裹
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced && fenced[1]) {
      return fenced[1].trim();
    }
    // 找第一个 [ 和最后一个 ]
    const firstBracket = text.indexOf('[');
    const lastBracket = text.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      return text.slice(firstBracket, lastBracket + 1).trim();
    }
    return text.trim();
  }

  private validateAndNormalize(parsed: unknown): AiKeywordItem[] {
    if (!Array.isArray(parsed)) {
      throw new BadRequestException('AI 返回格式异常，请稍后重试');
    }

    const requiredFields: Array<keyof AiKeywordItem> = [
      'keyword',
      'intentType',
      'sceneTag',
      'hasBrand',
      'hasLocation',
      'reason',
    ];

    const seen = new Set<string>();
    const result: AiKeywordItem[] = [];

    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;

      const obj = item as Record<string, unknown>;

      // 字段存在性校验
      const hasAllFields = requiredFields.every(
        (f: keyof AiKeywordItem): boolean => f in obj,
      );
      if (!hasAllFields) continue;

      // keyword 必须是非空字符串
      const keyword = String(obj.keyword).trim();
      if (!keyword) continue;

      // intentType 校验
      const intentType = String(obj.intentType).trim();
      if (!(INSPIRATION_INTENT_TYPES as readonly string[]).includes(intentType)) {
        continue;
      }

      // 布尔字段
      const hasBrand = Boolean(obj.hasBrand);
      const hasLocation = Boolean(obj.hasLocation);

      // sceneTag / reason
      const sceneTag = String(obj.sceneTag || '').trim() || '通用';
      const reason = String(obj.reason || '').trim() || '长尾流量价值高';

      // 去重（keyword 小写）
      const key = keyword.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      result.push({
        keyword,
        intentType,
        sceneTag,
        hasBrand,
        hasLocation,
        reason,
      });
    }

    return result;
  }

  private ensureBrandKeywords(items: AiKeywordItem[], brandName: string): void {
    const normalizedBrand = brandName.trim();
    if (!normalizedBrand) return;

    for (const item of items) {
      const actuallyHasBrand = item.keyword.includes(normalizedBrand);
      if (item.hasBrand !== actuallyHasBrand) {
        item.hasBrand = actuallyHasBrand;
      }
    }

    const brandCount = items.filter((it) => it.hasBrand).length;
    if (brandCount >= 2) return;

    const needed = 2 - brandCount;
    let added = 0;
    for (const item of items) {
      if (added >= needed) break;
      if (item.hasBrand) continue;

      let newKeyword = '';
      if (item.intentType === 'cognitive') {
        newKeyword = `${normalizedBrand}${item.keyword.replace(brandName, '')}`;
        if (newKeyword === item.keyword) {
          newKeyword = `${normalizedBrand}怎么样`;
        }
      } else if (item.intentType === 'comparison') {
        newKeyword = `${normalizedBrand}和附近同类店比哪个好`;
        item.sceneTag = '品牌对比';
      } else if (item.intentType === 'transaction') {
        newKeyword = `${normalizedBrand}${item.keyword.replace(brandName, '')}`;
        if (newKeyword === item.keyword) {
          newKeyword = `${normalizedBrand}价格多少钱`;
          item.sceneTag = '价格';
        }
      } else {
        newKeyword = `${normalizedBrand}${item.keyword.replace(brandName, '')}`;
        if (newKeyword === item.keyword) {
          newKeyword = `${normalizedBrand}推荐`;
          item.sceneTag = '品牌推荐';
        }
      }

      newKeyword = newKeyword.replace(normalizedBrand + normalizedBrand, normalizedBrand);
      if (newKeyword && !items.some((it) => it.keyword === newKeyword)) {
        item.keyword = newKeyword;
        item.hasBrand = true;
        added += 1;
      }
    }
  }

  private calcOpportunityScore(params: {
    keyword: string;
    intentType: InspirationIntentType;
    hasBrand: boolean;
    hasLocation: boolean;
    city: string;
    districts: string[];
    includeBrand: boolean;
  }): number {
    const { keyword, intentType, hasBrand, city, districts, includeBrand } = params;
    let score = 0;

    // 1. 意图类型（30分）
    const intentScores: Record<InspirationIntentType, number> = {
      transaction: 30,
      local: 25,
      comparison: 20,
      scenario: 18,
      cognitive: 12,
    };
    score += intentScores[intentType] ?? 0;

    // 2. 地域匹配（20分）—— 重新用关键词文本判断，不只信 AI 的 hasLocation
    const containsCity = city ? keyword.includes(city) : false;
    const containsDistrict = districts.some((d: string): boolean => keyword.includes(d));
    if (containsCity && containsDistrict) {
      score += 20;
    } else if (containsCity) {
      score += 12;
    } else {
      score += 5;
    }

    // 3. 词长（15分）—— 按字符数算
    const len = keyword.length;
    if (len >= 6 && len <= 10) {
      score += 15;
    } else if (len >= 4 && len <= 5) {
      score += 10;
    } else if (len >= 11 && len <= 15) {
      score += 8;
    } else {
      score += 5;
    }

    // 4. 含品牌词（15分）
    if (hasBrand && includeBrand) {
      score += 15;
    } else if (hasBrand && !includeBrand) {
      score += 10;
    } else {
      score += 8;
    }

    // 5. 交易意图词（20分）
    let transactionScore = 0;
    for (const word of STRONG_TRANSACTION_WORDS) {
      if (keyword.includes(word)) {
        transactionScore = 20;
        break;
      }
    }
    if (transactionScore === 0) {
      for (const word of WEAK_TRANSACTION_WORDS) {
        if (keyword.includes(word)) {
          transactionScore = 10;
          break;
        }
      }
    }
    score += transactionScore;

    // 上限 100，取整
    return Math.min(100, Math.round(score));
  }

  private ensureCanWrite(user: GeoUserCtx, brandId: string): void {
    if (user.role === 'client') {
      if (!user.brandId || user.brandId !== brandId) {
        throw new ForbiddenException('只能操作所属品牌的数据');
      }
    }
  }
}
