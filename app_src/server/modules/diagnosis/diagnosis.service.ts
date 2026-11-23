import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { CapabilityService } from '@lark-apaas/fullstack-nestjs-core';
import { throwAiError } from '@server/common/utils/ai-error';
import { AiKeysService } from '@server/modules/ai-keys/ai-keys.service';
import { eq, and, or, ilike, desc, gte, count, inArray, lt, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import {
  geoDiagnosisTasks,
  geoDiagnosisReports,
  geoDiagnosisResults,
  geoBrands,
  geoCreditAccounts,
  geoCreditTransactions,
  geoCreditPlans,
} from '@server/database/schema';
import type {
  DiagnosisTask,
  DiagnosisReport,
  DiagnosisReportData,
  DiagnosisRecommendation,
  DiagnosisResultItem,
  DiagnosisProduct,
  DiagnosisQuestionScenario,
  DiagnosisQuestionType,
  PagedResponse,
  UserRole,
  DiagnosisPlatform,
  MentionPosition,
  SentimentType,
  CompetitorCompareResponse,
  CompetitorBrandData,
  CompetitorDimensionScore,
  CompetitorQuestionCompare,
  CompetitorGapAlert,
} from '@shared/api.interface';
import {
  DIAGNOSIS_PLATFORM_LABELS,
  type AiVendor,
  AI_VENDORS,
  type DiagnosisStatus,
} from '@shared/api.interface';
import {
  CreateDiagnosisTaskDto,
  DiagnosisTaskListQueryDto,
  DiagnosisReportListQueryDto,
  CompetitorCompareRequestDto,
  type ShareReportResponse,
} from './dto/diagnosis.dto';

interface GeoUserCtx {
  id: string;
  role: UserRole;
  brandId: string | null;
}

type QuestionCategory = '口碑' | '推荐' | '对比' | '品牌词' | '排名' | '地址';
const QUESTION_CATEGORIES: QuestionCategory[] = ['口碑', '推荐', '对比', '品牌词', '排名', '地址'];

const DIAGNOSIS_CREDIT_PER_QUERY = 1;
const TX_TYPE_DIAGNOSIS = 'diagnosis_query';
const TX_TYPE_RECOMMEND = 'diagnosis_recommend';
const MAX_CONCURRENT_QUERIES = 6;

const PLATFORM_TO_VENDOR: Record<string, AiVendor> = {
  doubao: 'volcano',
  deepseek: 'deepseek',
  wenxin: 'wenxin',
  tongyi: 'qwen',
  yuanbao: 'hunyuan',
  kimi: 'kimi',
};

@Injectable()
export class DiagnosisService {
  private readonly logger = new Logger(DiagnosisService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    @Inject(CapabilityService) private readonly capabilityService: CapabilityService,
    private readonly aiKeysService: AiKeysService,
  ) {}

  // ---------- AI 调用封装 ----------

  private async callAi(params: {
    prompt: string;
    topic: string;
    type: string;
    wordCount?: string;
    user?: GeoUserCtx;
    brandId?: string;
  }): Promise<string> {
    const { prompt, topic, type, wordCount = '500', user, brandId } = params;

    if (user && brandId) {
      try {
        const activeKey = await this.aiKeysService.getActiveKey(user, brandId);
        if (activeKey && activeKey.apiKey) {
          const fullPrompt = [
            `主题：${topic}`,
            `类型：${type}`,
            `字数要求：约 ${wordCount} 字`,
            `补充要求：
${prompt}`,
          ].join('\n');
          const maxTokens = Math.min(4000, Math.round(Number(wordCount) * 2));
          const result = await this.aiKeysService.chat(
            [{ role: 'user', content: fullPrompt }],
            { maxTokens, temperature: 0.8, user, brandId },
          );
          return result.content.trim();
        }
      } catch (err: unknown) {
        this.logger.error(
          'aiClient 调用失败，回退到平台插件',
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    try {
      let fullContent = '';
      const stream = this.capabilityService
        .load('geo_text_generate_1')
        .callStream('textGenerate', {
          content_topic: topic,
          content_type: type,
          additional_requirements: prompt,
          word_count: wordCount,
          target_audience: '',
        });
      for await (const chunk of stream as AsyncIterable<{ content?: string }>) {
        if (chunk?.content) {
          fullContent += chunk.content;
        }
      }
      return fullContent.trim();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`AI 调用失败: ${message}`);
      throwAiError('AI 生成失败', message);
    }
  }

  // ---------- 诊断任务 ----------

  async createTask(
    dto: CreateDiagnosisTaskDto,
    user: GeoUserCtx,
  ): Promise<DiagnosisTask> {
    this.ensureCanWrite(user, dto.brandId ?? null);

    const brandIdForTask = this.resolveBrandId(dto.brandId, user);

    const competitors = (dto.competitors ?? [])
      .map((c: string) => c.trim())
      .filter(Boolean);

    const brandAliases = (dto.brandAliases ?? [])
      .map((a: string) => a.trim())
      .filter(Boolean)
      .slice(0, 10);

    const brandIntroRaw = dto.brandIntro?.trim() ?? null;
    const brandIntro = brandIntroRaw && brandIntroRaw.length > 300
      ? brandIntroRaw.slice(0, 300)
      : brandIntroRaw;

    const products: DiagnosisProduct[] = (dto.products ?? [])
      .slice(0, 5)
      .map((p: { name?: string }) => ({
        name: (p.name ?? '').trim().slice(0, 50),
      }))
      .filter((p: DiagnosisProduct) => p.name.length > 0);

    const inserted = await this.db
      .insert(geoDiagnosisTasks)
      .values({
        brandId: brandIdForTask,
        brandName: dto.brandName.trim(),
        website: dto.website?.trim() ?? null,
        city: dto.city.trim(),
        category: dto.category.trim(),
        platforms: dto.platforms,
        competitors,
        brandAliases,
        brandIntro,
        products: products as unknown as Record<string, unknown>,
        status: 'pending',
        creatorId: user.id,
      })
      .returning({ id: geoDiagnosisTasks.id });

    const taskId = inserted[0].id;
    const task = await this.getTaskById(taskId, user);
    if (!task) {
      throw new NotFoundException('任务创建失败');
    }
    return task;
  }

  async generateQuestions(
    brandName: string,
    city: string,
    category: string,
    user?: GeoUserCtx,
    brandId?: string,
  ): Promise<string[]> {
    const prompt =
      `你是本地消费决策专家，请根据以下信息，生成普通用户会向 AI 提问的真实口语化问题。\n` +
      `品牌名：${brandName}\n` +
      `所在城市：${city}\n` +
      `品类/主营：${category}\n\n` +
      `要求：\n` +
      `1. 生成 8-12 条问题，覆盖以下意图类型：\n` +
      `   - 口碑类（好不好、怎么样、评价如何）\n` +
      `   - 推荐类（推荐几家、哪家好、必吃/必去）\n` +
      `   - 对比类（A 和 B 哪个好、和竞品比怎么样）\n` +
      `   - 品牌词类（品牌名直接提问、品牌信息查询）\n` +
      `   - 排名类（排行榜、前十名、最好的）\n` +
      `   - 地址类（在哪里、地址、怎么去）\n` +
      `2. 问题要真实自然，像真人会问的口语，不要太书面\n` +
      `3. 每行一条，前面有序号也可以，我会自动提取\n` +
      `4. 问题里要包含城市和品类相关语境，让问题有地域针对性\n` +
      `5. 不要输出任何解释文字，直接输出问题列表`;

    const rawText = await this.callAi({
      prompt,
      topic: 'GEO诊断问题生成',
      type: '问题清单',
      wordCount: '500',
      user,
      brandId,
    });

    const questions = this.extractQuestionsFromText(rawText);
    if (questions.length < 3) {
      throw new InternalServerErrorException('AI 生成的问题数量不足，请重试');
    }
    return questions;
  }

  async generateQuestionScenarios(
    productName: string,
    brandName: string,
    city: string,
    category: string,
    user?: GeoUserCtx,
    brandId?: string,
  ): Promise<DiagnosisQuestionScenario[]> {
    // 先检查推荐配额
    if (brandId) {
      const quota = await this.getRecommendQuota(user ?? { id: '', role: 'client', brandId }, brandId);
      if (quota.remaining <= 0) {
        throw new BadRequestException('今日推荐次数已用完');
      }
    }

    const prompt =
      `你是本地消费决策专家，请根据以下信息，生成普通用户会向 AI 提问的真实场景化问题。\n` +
      `品牌名：${brandName}\n` +
      `产品/服务：${productName}\n` +
      `所在城市：${city}\n` +
      `品类/主营：${category}\n\n` +
      `要求：\n` +
      `1. 生成 6-8 组场景，覆盖以下意图类型：口碑、推荐、对比、品牌词、排名、地址\n` +
      `2. 每组场景包含以下字段，用 JSON 数组输出：\n` +
      `   - user_profile：用户画像（简短描述，20字以内）\n` +
      `   - search_scenario：搜索场景描述（描述用户在什么情境下会问这个问题，30字以内）\n` +
      `   - sample_question：示例问题（真实口语化，含城市和品类语境）\n` +
      `   - question_type：问题类型（只能是：口碑/推荐/对比/品牌词/排名/地址 其中之一）\n` +
      `3. 问题要真实自然，像真人会问的口语，不要太书面\n` +
      `4. 问题里要包含城市和品类相关语境，让问题有地域针对性\n` +
      `5. 只输出 JSON 数组，不要输出任何解释文字、不要 markdown 代码块\n` +
      `6. 输出格式示例：[{"user_profile":"...","search_scenario":"...","sample_question":"...","question_type":"口碑"}]`;

    const rawText = await this.callAi({
      prompt,
      topic: 'GEO诊断问题场景生成',
      type: '场景化问题清单',
      wordCount: '800',
      user,
      brandId,
    });

    const scenarios = this.parseQuestionScenarios(rawText, brandName);

    // 生成成功后扣一次推荐次数
    if (brandId && user) {
      try {
        await this.db.insert(geoCreditTransactions).values({
          brandId,
          changeAmount: '0',
          balanceAfter: '0',
          transactionType: TX_TYPE_RECOMMEND,
          relatedType: null,
          relatedId: null,
          description: '诊断问题推荐',
          operatorId: user.id,
        });
      } catch (err: unknown) {
        this.logger.warn(
          `记录推荐次数失败 brandId=${brandId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return scenarios;
  }

  private parseQuestionScenarios(
    rawText: string,
    brandName: string,
  ): DiagnosisQuestionScenario[] {
    // 尝试直接解析 JSON
    let jsonStr = rawText.trim();
    // 去掉可能的 markdown 代码块
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

    try {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) {
        const scenarios: DiagnosisQuestionScenario[] = parsed
          .map((item: unknown, idx: number) => {
            const obj = item as Record<string, unknown>;
            const qType = String(obj.question_type ?? obj.questionType ?? '');
            const validType = this.normalizeQuestionType(qType);
            return {
              id: `scenario_${idx + 1}_${Date.now()}`,
              userProfile: String(obj.user_profile ?? obj.userProfile ?? ''),
              searchScenario: String(obj.search_scenario ?? obj.searchScenario ?? ''),
              sampleQuestion: String(obj.sample_question ?? obj.sampleQuestion ?? ''),
              questionType: validType,
            };
          })
          .filter((s: DiagnosisQuestionScenario) => s.sampleQuestion.length >= 4);
        if (scenarios.length >= 3) return scenarios;
      }
    } catch {
      // JSON 解析失败，fallback 到原格式再手动转
    }

    // fallback：从纯文本问题列表手动构造场景
    const questions = this.extractQuestionsFromText(rawText);
    if (questions.length === 0) {
      throw new InternalServerErrorException('AI 生成的场景数量不足，请重试');
    }

    const scenarios: DiagnosisQuestionScenario[] = questions.map(
      (q: string, idx: number): DiagnosisQuestionScenario => {
        const cat = this.categorizeQuestion(q);
        const qType: DiagnosisQuestionType = cat ? cat as DiagnosisQuestionType : '口碑';
        return {
          id: `scenario_fallback_${idx + 1}`,
          userProfile: `${brandName}潜在顾客`,
          searchScenario: `用户在考虑${brandName}时进行搜索`,
          sampleQuestion: q,
          questionType: qType,
        };
      },
    );

    return scenarios;
  }

  private normalizeQuestionType(type: string): DiagnosisQuestionType {
    const validTypes: DiagnosisQuestionType[] = ['口碑', '推荐', '对比', '品牌词', '排名', '地址'];
    if (validTypes.includes(type as DiagnosisQuestionType)) {
      return type as DiagnosisQuestionType;
    }
    // 英文映射
    const typeMap: Record<string, DiagnosisQuestionType> = {
      'word_of_mouth': '口碑',
      'recommend': '推荐',
      'recommendation': '推荐',
      'compare': '对比',
      'comparison': '对比',
      'brand': '品牌词',
      'brand_word': '品牌词',
      'ranking': '排名',
      'rank': '排名',
      'address': '地址',
      'location': '地址',
    };
    return typeMap[type.toLowerCase()] ?? '口碑';
  }

  private extractQuestionsFromText(text: string): string[] {
    const lines = text.split('\n').map((line: string) => line.trim()).filter(Boolean);
    const questions: string[] = [];
    const seen = new Set<string>();

    for (const line of lines) {
      // 去掉序号前缀（数字+点、数字+顿号、数字+)、中文序号等
      let cleaned = line.replace(/^[\d]+[.、\)）]\s*/, '');
      cleaned = cleaned.replace(/^[一二三四五六七八九十]+[.、\)）]\s*/, '');
      cleaned = cleaned.replace(/^[-•·]\s*/, '');
      cleaned = cleaned.trim();
      // 去掉末尾标点后缀的空格
      cleaned = cleaned.replace(/\s+([？?！!。])$/, '$1');
      cleaned = cleaned.trim();

      // 过滤掉太短或不像问题的行
      if (cleaned.length < 4) continue;
      if (cleaned.length > 60) continue;

      const key = cleaned.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      questions.push(cleaned);

      if (questions.length >= 12) break;
    }

    return questions;
  }

  // ---------- 配额 & 余额 ----------

  async getRecommendQuota(
    user: GeoUserCtx,
    brandId: string,
  ): Promise<{ used: number; limit: number; remaining: number }> {
    // 从品牌关联的套餐里取 daily_diagnosis_recommend_limit
    const planRows = await this.db
      .select({ dailyDiagnosisRecommendLimit: geoCreditPlans.dailyDiagnosisRecommendLimit })
      .from(geoCreditAccounts)
      .innerJoin(geoCreditPlans, eq(geoCreditAccounts.currentPlanId, geoCreditPlans.id))
      .where(eq(geoCreditAccounts.brandId, brandId))
      .limit(1);

    const limit = planRows[0]?.dailyDiagnosisRecommendLimit ?? 20;

    // 统计当日已用次数（diagnosis_recommend 交易记录数）
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfDayIso = startOfDay.toISOString();

    const usedRows = await this.db
      .select({ count: count() })
      .from(geoCreditTransactions)
      .where(
        and(
          eq(geoCreditTransactions.brandId, brandId),
          eq(geoCreditTransactions.transactionType, TX_TYPE_RECOMMEND),
          gte(geoCreditTransactions.createdAt, startOfDay),
        ),
      );

    const used = Number(usedRows[0]?.count ?? 0);
    const remaining = Math.max(0, limit - used);

    return { used, limit, remaining };
  }

  async getCreditInfo(
    user: GeoUserCtx,
    brandId: string,
  ): Promise<{ balance: number; unitPricePerQuery: number; planName: string }> {
    const rows = await this.db
      .select({
        balance: geoCreditAccounts.balance,
        planName: geoCreditPlans.planName,
      })
      .from(geoCreditAccounts)
      .leftJoin(geoCreditPlans, eq(geoCreditAccounts.currentPlanId, geoCreditPlans.id))
      .where(eq(geoCreditAccounts.brandId, brandId))
      .limit(1);

    const balance = rows[0] ? Number(rows[0].balance) : 0;
    const planName = rows[0]?.planName ?? '未开通';

    return {
      balance,
      unitPricePerQuery: DIAGNOSIS_CREDIT_PER_QUERY,
      planName,
    };
  }

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
        throw new BadRequestException('算力不足，请先充值');
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
        transactionType: TX_TYPE_DIAGNOSIS,
        relatedType,
        relatedId,
        description: description ?? null,
        operatorId,
      });
    });
  }

  // ---------- 诊断任务 ----------

  async runDiagnosis(
    taskId: string,
    questions: string[],
    user: GeoUserCtx,
  ): Promise<{ taskId: string; status: string }> {
    const task = await this.getTaskById(taskId, user);
    if (!task) {
      throw new NotFoundException('任务不存在');
    }
    this.ensureCanWrite(user, task.brandId);

    if (task.status === 'running') {
      throw new ConflictException('任务正在诊断中，请稍候');
    }

    const cleanQuestions = questions
      .map((q: string) => q.trim())
      .filter(Boolean);

    if (cleanQuestions.length < 3) {
      throw new BadRequestException('问题数量不能少于 3 个');
    }

    const platforms = task.platforms.length > 0 ? task.platforms : ['doubao'];

    const brandIdForCredit = this.resolveBrandId(task.brandId ?? undefined, user);

    const keyList = await this.aiKeysService.listKeys(user, brandIdForCredit);
    const availableVendors = new Set(
      keyList.items
        .filter((k: { status: string }) => k.status === 'ok')
        .map((k: { vendor: string }) => k.vendor),
    );

    const activePlatforms = platforms.filter(
      (p) => availableVendors.has(PLATFORM_TO_VENDOR[p] ?? p),
    );
    const skippedPlatforms = platforms.filter(
      (p) => !availableVendors.has(PLATFORM_TO_VENDOR[p] ?? p),
    );

    if (activePlatforms.length === 0) {
      throw new BadRequestException('没有可用的 AI 平台，请先在「AI 模型接入」中配置 Key');
    }

    const totalCost = cleanQuestions.length * activePlatforms.length * DIAGNOSIS_CREDIT_PER_QUERY;

    // 余额预检查
    const creditInfo = await this.getCreditInfo(user, brandIdForCredit);
    if (creditInfo.balance < totalCost) {
      throw new BadRequestException('算力不足，请先充值');
    }

    const brandIdForReport = brandIdForCredit;

    // 创建 report（初始状态）
    const reportInserted = await this.db
      .insert(geoDiagnosisReports)
      .values({
        taskId,
        brandId: brandIdForReport,
        overallScore: 0,
        visibilityScore: 0,
        rankingScore: 0,
        coverageScore: 0,
        citationScore: 0,
        reportData: { summary: '' } as unknown as Record<string, unknown>,
        creatorId: user.id,
      })
      .returning({ id: geoDiagnosisReports.id });

    const reportId = reportInserted[0].id;

    // 更新 task：保存 questions + status=running + reportId
    await this.db
      .update(geoDiagnosisTasks)
      .set({
        questions: cleanQuestions,
        status: 'running',
        reportId,
        error: null,
      })
      .where(eq(geoDiagnosisTasks.id, taskId));

    // 为每个 platform × question 创建 result 记录
    const resultValues: Array<{
      taskId: string;
      reportId: string;
      question: string;
      platform: string;
      status: string;
      creatorId: string;
      error?: string;
    }> = [];
    for (const platform of activePlatforms) {
      for (const question of cleanQuestions) {
        resultValues.push({
          taskId,
          reportId,
          question,
          platform,
          status: 'pending',
          creatorId: user.id,
        });
      }
    }
    for (const platform of skippedPlatforms) {
      for (const question of cleanQuestions) {
        resultValues.push({
          taskId,
          reportId,
          question,
          platform,
          status: 'skipped',
          error: '平台未接入，未检测',
          creatorId: user.id,
        });
      }
    }

    if (resultValues.length > 0) {
      try {
        await this.db.insert(geoDiagnosisResults).values(resultValues);
      } catch (err: unknown) {
        this.logger.error(
          `批量插入诊断结果失败 task=${taskId} count=${resultValues.length}`,
        );
        let current: unknown = err;
        for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth += 1) {
          const { message, code, cause } = current as {
            message?: unknown;
            code?: unknown;
            cause?: unknown;
          };
          this.logger.error(
            `level=${depth} code=${String(code ?? '')} message=${String(message ?? '')}`,
          );
          current = cause;
        }
        throw err;
      }
    }

    // 触发后台异步执行
    void this.executeDiagnosis(taskId, task.brandName, user, task.brandId);

    return { taskId, status: 'running' };
  }

  private async executeDiagnosis(taskId: string, brandName: string, user: GeoUserCtx, brandId: string | null): Promise<void> {
    try {
      this.logger.log(`开始执行诊断任务: ${taskId}`);

      await this.db
        .update(geoDiagnosisTasks)
        .set({ startedAt: new Date(), status: 'running' })
        .where(eq(geoDiagnosisTasks.id, taskId));

      const results = await this.db
        .select()
        .from(geoDiagnosisResults)
        .where(eq(geoDiagnosisResults.taskId, taskId));

      const pendingResults = results.filter((r) => r.status === 'pending');
      const skippedCount = results.filter((r) => r.status === 'skipped').length;
      const totalCount = results.length;

      await this.db
        .update(geoDiagnosisTasks)
        .set({ totalCount, skippedCount })
        .where(eq(geoDiagnosisTasks.id, taskId));

      const concurrency = MAX_CONCURRENT_QUERIES;
      let index = 0;
      let completedCount = 0;
      let failedCount = 0;

      const workers: Array<Promise<void>> = [];
      for (let w = 0; w < concurrency; w += 1) {
        workers.push(
          (async (): Promise<void> => {
            while (index < pendingResults.length) {
              const currentIndex = index;
              index += 1;
              const result = pendingResults[currentIndex];
              if (!result) break;

              try {
                await this.db
                  .update(geoDiagnosisResults)
                  .set({ status: 'running' })
                  .where(eq(geoDiagnosisResults.id, result.id));

                const platformLabel = DIAGNOSIS_PLATFORM_LABELS[result.platform as DiagnosisPlatform] ?? result.platform;
                const answer = await this.simulateAiAnswer(result.question, brandName, platformLabel, user, brandId ?? undefined);

                const analysis = this.analyzeAnswer(answer, brandName);

                if (brandId) {
                  try {
                    await this.deductCredit(
                      brandId,
                      DIAGNOSIS_CREDIT_PER_QUERY,
                      'diagnosis_task',
                      taskId,
                      user.id,
                      'AI诊断查询扣费',
                    );
                  } catch (deductErr: unknown) {
                    this.logger.error(
                      `算力扣减失败 task=${taskId} result=${result.id}: ${deductErr instanceof Error ? deductErr.message : String(deductErr)}`,
                    );
                  }
                }

                await this.db
                  .update(geoDiagnosisResults)
                  .set({
                    status: 'completed',
                    isMentioned: analysis.isMentioned,
                    mentionPosition: analysis.mentionPosition,
                    sentiment: analysis.sentiment,
                    otherBrands: analysis.otherBrands,
                    rawAnswer: answer,
                    answerSummary: analysis.summary,
                  })
                  .where(eq(geoDiagnosisResults.id, result.id));

                completedCount += 1;
              } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                await this.db
                  .update(geoDiagnosisResults)
                  .set({
                    status: 'failed',
                    error: message.length > 500 ? message.slice(0, 500) : message,
                  })
                  .where(eq(geoDiagnosisResults.id, result.id));
                failedCount += 1;
              }

              if ((completedCount + failedCount) % 3 === 0) {
                await this.db
                  .update(geoDiagnosisTasks)
                  .set({ completedCount, failedCount })
                  .where(eq(geoDiagnosisTasks.id, taskId));
              }
            }
          })(),
        );
      }

      await Promise.all(workers);

      await this.db
        .update(geoDiagnosisTasks)
        .set({ completedCount, failedCount, finishedAt: new Date() })
        .where(eq(geoDiagnosisTasks.id, taskId));

      await this.finalizeReport(taskId, brandName, user, brandId);

      this.logger.log(`诊断任务完成: ${taskId}, completed=${completedCount}, failed=${failedCount}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`诊断任务失败 ${taskId}: ${message}`);
      await this.db
        .update(geoDiagnosisTasks)
        .set({
          status: 'failed',
          error: message.length > 500 ? message.slice(0, 500) : message,
          finishedAt: new Date(),
        })
        .where(eq(geoDiagnosisTasks.id, taskId));
    }
  }

  private async simulateAiAnswer(
    question: string,
    brandName: string,
    platformLabel: string,
    user?: GeoUserCtx,
    brandId?: string,
  ): Promise<string> {
    const prompt =
      `请模拟一个 AI 助手回答用户的问题，回答风格要像${platformLabel}等大模型的典型回答方式。\n\n` +
      `用户问题：${question}\n` +
      `相关品牌：${brandName}\n\n` +
      `要求：\n` +
      `1. 回答要自然、真实，仿佛你真的在回答用户的提问\n` +
      `2. 如果问题涉及推荐/排行，请列出 3-5 个具体的品牌或店名（可以包含${brandName}，也可以不包含，要符合真实概率）\n` +
      `3. 列出店名时用中文顿号或换行分隔，重要的店名可以加引号或书名号\n` +
      `4. 回答可以包含地址、特色产品、价格等具体信息，显得更真实\n` +
      `5. 字数控制在 200-400 字之间\n` +
      `6. 不要出现"作为AI"、"我无法"之类的免责声明，直接给出回答`;

    return this.callAi({
      prompt,
      topic: 'GEO模拟回答',
      type: '问答回答',
      wordCount: '400',
      user,
      brandId,
    });
  }

  private analyzeAnswer(
    answer: string,
    brandName: string,
  ): {
    isMentioned: boolean;
    mentionPosition: MentionPosition | null;
    sentiment: SentimentType;
    otherBrands: string[];
    summary: string;
  } {
    const normalizedAnswer = answer.replace(/\s+/g, '');
    const normalizedBrand = brandName.replace(/\s+/g, '');

    const isMentioned = normalizedAnswer.includes(normalizedBrand);

    // 提取所有被引号/书名号/顿号分隔的品牌/店名
    const brandPattern = /[""'《》「」]([^""'《》「」]{2,20})[""'《》「」]/g;
    const extractedBrands: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = brandPattern.exec(answer)) !== null) {
      const name = match[1].trim();
      if (name.length >= 2 && name.length <= 20) {
        extractedBrands.push(name);
      }
    }

    // 如果没提取到，尝试从顿号列表中提取
    if (extractedBrands.length === 0) {
      const listPattern = /(?:推荐|包括|有|比如|例如)[：:]([^。\n]+)/g;
      let listMatch: RegExpExecArray | null;
      while ((listMatch = listPattern.exec(answer)) !== null) {
        const items = listMatch[1].split(/[、，,]/).map((s: string) => s.trim()).filter((s: string) => s.length >= 2 && s.length <= 20);
        extractedBrands.push(...items);
      }
    }

    // 去重
    const uniqueBrands = Array.from(new Set(extractedBrands));

    // 找本品牌的位置
    let mentionPosition: MentionPosition = 'none';
    if (isMentioned) {
      const brandIndex = uniqueBrands.findIndex(
        (b: string) => b.replace(/\s+/g, '').includes(normalizedBrand) || normalizedBrand.includes(b.replace(/\s+/g, '')),
      );
      if (brandIndex === 0) {
        mentionPosition = 'first';
      } else if (brandIndex > 0 && brandIndex < 3) {
        mentionPosition = 'top3';
      } else if (brandIndex >= 3) {
        mentionPosition = 'later';
      } else {
        // 没在提取的列表中找到，但回答里确实提到了
        mentionPosition = 'later';
      }
    }

    // 情感分析
    let sentiment: SentimentType = 'neutral';
    const positiveWords = ['推荐', '好吃', '不错', '值得', '首选', '最好', '很棒', '优秀', '好评', '赞', '必去', '必吃', '强烈推荐'];
    const negativeWords = ['一般', '不推荐', '踩雷', '差', '不好', '失望', '难吃', '糟糕', '避免', '别去'];

    let positiveCount = 0;
    let negativeCount = 0;
    for (const word of positiveWords) {
      if (answer.includes(word)) positiveCount += 1;
    }
    for (const word of negativeWords) {
      if (answer.includes(word)) negativeCount += 1;
    }

    if (positiveCount > negativeCount && positiveCount >= 1) {
      sentiment = 'positive';
    } else if (negativeCount > positiveCount && negativeCount >= 1) {
      sentiment = 'negative';
    }

    // 其他品牌（排除本品牌）
    const otherBrands = uniqueBrands.filter(
      (b: string) => !b.replace(/\s+/g, '').includes(normalizedBrand) && !normalizedBrand.includes(b.replace(/\s+/g, '')),
    ).slice(0, 10);

    // 回答摘要（取前80字）
    const summary = answer.length > 80 ? answer.slice(0, 80) + '...' : answer;

    return {
      isMentioned,
      mentionPosition: isMentioned ? mentionPosition : null,
      sentiment,
      otherBrands,
      summary,
    };
  }

  private async finalizeReport(taskId: string, brandName: string, user: GeoUserCtx, brandId: string | null): Promise<void> {
    // 获取所有 completed 的 results
    const results = await this.db
      .select()
      .from(geoDiagnosisResults)
      .where(eq(geoDiagnosisResults.taskId, taskId));

    const completedResults = results.filter((r) => r.status === 'completed');
    const failedResults = results.filter((r) => r.status === 'failed');
    const skippedResults = results.filter((r) => r.status === 'skipped');
    const executedCount = completedResults.length + failedResults.length;
    const totalQuestions = executedCount;
    const mentionedCount = completedResults.filter((r) => r.isMentioned).length;

    const hasAnySuccess = completedResults.length > 0;

    if (!hasAnySuccess) {
      const firstError = failedResults[0]?.error ?? '全部诊断调用失败';
      await this.db
        .update(geoDiagnosisTasks)
        .set({
          status: 'failed',
          error: firstError.length > 500 ? firstError.slice(0, 500) : firstError,
          finishedAt: new Date(),
        })
        .where(eq(geoDiagnosisTasks.id, taskId));
      return;
    }

    // AI 可见度（按实际执行数计算，跳过的平台不纳入分母）
    const visibilityScore = totalQuestions > 0
      ? Math.round((mentionedCount / totalQuestions) * 100)
      : 0;

    // 推荐顺位
    const positionScores: Record<string, number> = {
      first: 100,
      top3: 75,
      later: 40,
      none: 0,
    };
    const positionScoreSum = completedResults.reduce(
      (sum: number, r) => sum + (positionScores[r.mentionPosition ?? 'none'] ?? 0),
      0,
    );
    const rankingScore = completedResults.length > 0
      ? Math.round(positionScoreSum / completedResults.length)
      : 0;

    // 问题覆盖度
    const coveredCategories = new Set<QuestionCategory>();
    for (const r of completedResults) {
      if (!r.isMentioned) continue;
      const cat = this.categorizeQuestion(r.question);
      if (cat) coveredCategories.add(cat);
    }
    const coverageScore = Math.round((coveredCategories.size / QUESTION_CATEGORIES.length) * 100);

    // 内容可引用度
    let citationSum = 0;
    for (const r of completedResults) {
      if (!r.rawAnswer) continue;
      let score = 0;
      const ans = r.rawAnswer;
      // 地址、电话等品牌自有信息
      if (/\d+号|地址|电话|联系方式|位于|坐落于/.test(ans)) score += 30;
      // 特色产品/招牌菜
      if (/特色|招牌|招牌菜|主打|推荐菜|经典|人气/.test(ans)) score += 25;
      // 价格信息
      if (/人均|价格|元|价位|多少钱/.test(ans)) score += 20;
      // 营业时间
      if (/营业|开门|时间|几点/.test(ans)) score += 15;
      // 品牌历史/规模
      if (/创立|成立|连锁|分店|门店/.test(ans)) score += 10;
      citationSum += Math.min(score, 100);
    }
    const citationScore = completedResults.length > 0
      ? Math.round(citationSum / completedResults.length)
      : 0;

    // 总分（加权平均）
    const overallScore = Math.round(
      visibilityScore * 0.30 +
      rankingScore * 0.25 +
      coverageScore * 0.25 +
      citationScore * 0.20,
    );

    // 获取 reportId
    const taskRows = await this.db
      .select({ reportId: geoDiagnosisTasks.reportId })
      .from(geoDiagnosisTasks)
      .where(eq(geoDiagnosisTasks.id, taskId))
      .limit(1);
    const reportId = taskRows[0]?.reportId;
    if (!reportId) {
      throw new InternalServerErrorException('报告 ID 丢失');
    }

    // 生成摘要
    let summary = '';
    try {
      summary = await this.generateSummary(brandName, {
        visibilityScore,
        rankingScore,
        coverageScore,
        citationScore,
        overallScore,
        mentionedCount,
        totalQuestions,
        skippedPlatforms: skippedResults.length > 0
          ? Array.from(new Set(skippedResults.map((r) => r.platform)))
          : [],
      }, user, brandId ?? undefined);
    } catch (err: unknown) {
      this.logger.warn(`AI 摘要生成失败，使用模板兜底: ${err instanceof Error ? err.message : String(err)}`);
      summary = this.generateFallbackSummary(brandName, {
        visibilityScore,
        rankingScore,
        coverageScore,
        citationScore,
        overallScore,
      });
    }

    // 生成建议
    const recommendations = this.generateRecommendations({
      visibilityScore,
      rankingScore,
      coverageScore,
      citationScore,
      brandName,
    });

    const reportData: DiagnosisReportData = {
      summary,
      visibility: {
        score: visibilityScore,
        hitQuestions: mentionedCount,
        totalQuestions,
      },
      ranking: {
        score: rankingScore,
        avgPosition: this.getAvgPositionLabel(rankingScore),
      },
      coverage: {
        score: coverageScore,
        coveredTypes: Array.from(coveredCategories),
        totalTypes: QUESTION_CATEGORIES.length,
      },
      citation: {
        score: citationScore,
        citedSources: this.extractSources(results),
      },
      recommendations,
    };

    // 更新 report
    await this.db
      .update(geoDiagnosisReports)
      .set({
        overallScore,
        visibilityScore,
        rankingScore,
        coverageScore,
        citationScore,
        reportData: reportData as unknown as Record<string, unknown>,
      })
      .where(eq(geoDiagnosisReports.id, reportId));

    // 更新 task 状态：有成功就 completed
    const taskStatus: DiagnosisStatus = 'completed';
    await this.db
      .update(geoDiagnosisTasks)
      .set({
        status: taskStatus,
        completedCount: completedResults.length,
        failedCount: failedResults.length,
        skippedCount: skippedResults.length,
        totalCount: totalQuestions,
        finishedAt: new Date(),
      })
      .where(eq(geoDiagnosisTasks.id, taskId));
  }

  private categorizeQuestion(question: string): QuestionCategory | null {
    const q = question.toLowerCase();

    // 地址类
    if (/在哪|哪里|地址|位置|怎么去|怎么走|路线|门店|店铺位置/.test(q)) {
      return '地址';
    }
    // 排名类
    if (/排行|排名|前十|top|最好|最佳|第一|no\.?1|哪些好/.test(q)) {
      return '排名';
    }
    // 对比类
    if (/对比|比较|哪个好|vs|和.*比|区别|差别|哪个更/.test(q)) {
      return '对比';
    }
    // 推荐类
    if (/推荐|求推荐|有什么好|必吃|必去|值得|选哪家|哪家好/.test(q)) {
      return '推荐';
    }
    // 品牌词类（直接问品牌信息）
    if (/什么是|怎么样|介绍|了解|品牌|公司|企业/.test(q)) {
      return '品牌词';
    }
    // 口碑类
    if (/口碑|评价|怎么样|好不好|靠谱|坑不坑|味道|体验|服务/.test(q)) {
      return '口碑';
    }
    return null;
  }

  private getAvgPositionLabel(score: number): string {
    if (score >= 90) return '首位推荐';
    if (score >= 70) return '前三位提及';
    if (score >= 50) return '中位提及';
    if (score >= 25) return '靠后提及';
    return '基本未提及';
  }

  private extractSources(
    results: Array<{ rawAnswer: string | null }>,
  ): string[] {
    const domainSet = new Set<string>();
    const urlRegex = /https?:\/\/[^\s"'<>）)】」]+/gi;

    for (const r of results) {
      if (!r.rawAnswer) continue;
      let match: RegExpExecArray | null;
      while ((match = urlRegex.exec(r.rawAnswer)) !== null) {
        try {
          const url = new URL(match[0]);
          domainSet.add(url.hostname.replace(/^www\./, ''));
        } catch {
          // 无效 URL 跳过
        }
      }
    }

    return Array.from(domainSet).slice(0, 10);
  }

  private async generateSummary(
    brandName: string,
    scores: {
      visibilityScore: number;
      rankingScore: number;
      coverageScore: number;
      citationScore: number;
      overallScore: number;
      mentionedCount: number;
      totalQuestions: number;
      skippedPlatforms?: string[];
    },
    user?: GeoUserCtx,
    brandId?: string,
  ): Promise<string> {
    const skippedLabels = (scores.skippedPlatforms ?? [])
      .map((p: string) => DIAGNOSIS_PLATFORM_LABELS[p as DiagnosisPlatform] ?? p)
      .join('、');
    const prompt =
      `你是 GEO（生成式引擎优化）专家，请根据以下诊断数据，为品牌「${brandName}」写一份专业的 GEO 诊断摘要。\n\n` +
      `诊断数据：\n` +
      `- AI 可见度：${scores.visibilityScore} 分（${scores.mentionedCount}/${scores.totalQuestions} 个问题中被提及）\n` +
      `- 推荐顺位：${scores.rankingScore} 分\n` +
      `- 问题覆盖度：${scores.coverageScore} 分\n` +
      `- 内容可引用度：${scores.citationScore} 分\n` +
      `- GEO 综合指数：${scores.overallScore} 分\n` +
      (skippedLabels ? `- 未接入未检测平台：${skippedLabels}\n` : '') +
      `\n要求：\n` +
      `1. 用 GEO（生成式引擎优化）的语言来描述，要体现 AI 回答场景下的品牌表现\n` +
      `2. 指出品牌当前在 AI 回答中的可见度现状\n` +
      `3. 分析主要短板和原因\n` +
      `4. 给出 2-3 条具体的改进方向建议\n` +
      `5. 语气专业、客观，不用过度夸张\n` +
      `6. 字数控制在 250-400 字\n` +
      `7. 绝对禁止出现以下 SEO 相关词汇：SEO、关键词排名、外链、TDK、页面权重、百度收录、搜索引擎优化、爬虫、索引\n` +
      `8. 直接输出摘要内容，不要加标题或前缀\n` +
      `9. 统计口径说明：所有比例和分数均基于实际已检测的平台和问题数计算，未接入平台不纳入统计`;

    return this.callAi({
      prompt,
      topic: 'GEO诊断摘要',
      type: '诊断报告摘要',
      wordCount: '400',
      user,
      brandId,
    });
  }

  private generateFallbackSummary(
    brandName: string,
    scores: {
      visibilityScore: number;
      rankingScore: number;
      coverageScore: number;
      citationScore: number;
      overallScore: number;
    },
  ): string {
    const level = scores.overallScore >= 80 ? '优秀' : scores.overallScore >= 60 ? '中等' : '待提升';

    let strengths = '';
    if (scores.visibilityScore >= 70) {
      strengths += `品牌在 AI 回答中的可见度表现良好，用户提问时被覆盖的比例较高。`;
    } else {
      strengths += `品牌在 AI 回答中的可见度还有较大提升空间，当前被提及的问题比例偏低。`;
    }

    let weaknesses = '';
    if (scores.rankingScore < 60) {
      weaknesses += `推荐顺位表现偏弱，即使被提到也往往排在靠后位置，需要提升品牌在 AI 知识库中的优先级。`;
    }
    if (scores.coverageScore < 60) {
      weaknesses += `问题覆盖度不足，品牌在某些用户意图类型（如口碑查询、地址查询等）的 AI 回答中存在感较弱。`;
    }
    if (scores.citationScore < 60) {
      weaknesses += `内容可引用度偏低，AI 回答中缺少关于品牌的具体地址、特色产品等结构化信息，难以被 AI 作为事实引用。`;
    }
    if (!weaknesses) {
      weaknesses = `整体表现均衡，建议持续优化以保持竞争力。`;
    }

    return (
      `品牌「${brandName}」的 GEO 综合指数为 ${scores.overallScore} 分，处于${level}水平。` +
      `${strengths}` +
      `${weaknesses}` +
      `建议从以下方向改进：一是强化品牌结构化信息（地址、特色、联系方式等）的全网布局，让 AI 更容易抓取到准确事实；` +
      `二是围绕核心用户意图补充内容，提升在不同类型问题中的被提及概率；` +
      `三是通过口碑运营提升品牌在 AI 回答中的推荐顺位和正面形象。`
    );
  }

  private generateRecommendations(scores: {
    visibilityScore: number;
    rankingScore: number;
    coverageScore: number;
    citationScore: number;
    brandName: string;
  }): DiagnosisRecommendation[] {
    const recs: Array<DiagnosisRecommendation & { priority: 'high' | 'medium' | 'low' }> = [];

    if (scores.visibilityScore < 70) {
      recs.push({
        title: '提升 AI 回答可见度',
        detail: `建议在主流 AI 平台的知识源渠道加强品牌信息铺设，包括百科类、问答社区、本地生活平台等，增加品牌在 AI 训练数据和检索源中的出现频率。`,
        priority: 'high',
      });
    }

    if (scores.rankingScore < 65) {
      recs.push({
        title: '优化 AI 推荐顺位',
        detail: `品牌在 AI 回答中的排名偏后。建议通过提升品牌权威度信号（如官方网站权重、媒体提及量、用户口碑数量）来改善 AI 对品牌的排序优先级。`,
        priority: 'high',
      });
    }

    if (scores.coverageScore < 60) {
      recs.push({
        title: '扩展意图覆盖范围',
        detail: `当前品牌在部分用户意图类型的 AI 回答中覆盖不足。建议针对口碑类、推荐类、对比类、地址类等不同意图，分别布局对应的品牌信息和内容素材。`,
        priority: 'medium',
      });
    }

    if (scores.citationScore < 60) {
      recs.push({
        title: '丰富品牌结构化信息',
        detail: `AI 回答中缺少品牌的具体可引用信息。建议完善品牌的地址、电话、营业时间、特色产品、价格区间等结构化事实信息，并在官网和权威平台同步更新。`,
        priority: 'medium',
      });
    }

    if (recs.length < 3) {
      recs.push({
        title: '持续监测与迭代',
        detail: 'GEO 环境持续变化，建议定期进行 AI 可见度检测，跟踪品牌在不同 AI 平台的表现变化，及时调整优化策略。',
        priority: 'low',
      });
    }

    return recs.map((r) => ({
      title: r.title,
      detail: r.detail,
      priority: r.priority,
    }));
  }

  // ---------- 检测结果 ----------

  async getResultsByReportId(
    reportId: string,
    user: GeoUserCtx,
  ): Promise<DiagnosisResultItem[]> {
    // 先查 report 确认权限
    const reportRows = await this.db
      .select({
        id: geoDiagnosisReports.id,
        brandId: geoDiagnosisReports.brandId,
        isDemo: geoDiagnosisReports.isDemo,
      })
      .from(geoDiagnosisReports)
      .where(eq(geoDiagnosisReports.id, reportId))
      .limit(1);

    if (reportRows.length === 0) {
      throw new NotFoundException('报告不存在');
    }

    this.ensureCanReadReport(user, reportRows[0].brandId, reportRows[0].isDemo ?? false);

    const rows = await this.db
      .select()
      .from(geoDiagnosisResults)
      .where(eq(geoDiagnosisResults.reportId, reportId))
      .orderBy(geoDiagnosisResults.platform, geoDiagnosisResults.question);

    return rows.map((row) => ({
      id: row.id,
      taskId: row.taskId,
      reportId: row.reportId,
      question: row.question,
      platform: row.platform as DiagnosisPlatform,
      isMentioned: row.isMentioned,
      mentionPosition: (row.mentionPosition as MentionPosition) ?? null,
      sentiment: (row.sentiment as SentimentType) ?? 'neutral',
      otherBrands: row.otherBrands ?? [],
      rawAnswer: row.rawAnswer,
      answerSummary: row.answerSummary,
      error: row.error,
      status: row.status as 'pending' | 'running' | 'completed' | 'failed',
      createdAt: new Date(row.createdAt).toISOString(),
    }));
  }

  // ---------- 任务列表/详情/删除 ----------

  async listTasks(
    query: DiagnosisTaskListQueryDto,
    user: GeoUserCtx,
  ): Promise<PagedResponse<DiagnosisTask>> {
    await this.markTimedOutTasks(user);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const isClient = user.role === 'client' && user.brandId;
    const otherConditions: ReturnType<typeof eq>[] = [];

    if (!isClient && query.brandId) {
      otherConditions.push(eq(geoDiagnosisTasks.brandId, query.brandId));
    }

    if (query.status) {
      otherConditions.push(eq(geoDiagnosisTasks.status, query.status));
    }

    if (query.keyword) {
      otherConditions.push(
        ilike(geoDiagnosisTasks.brandName, `%${query.keyword}%`) as ReturnType<typeof eq>,
      );
    }

    const baseQuery = this.db
      .select({
        id: geoDiagnosisTasks.id,
        brandId: geoDiagnosisTasks.brandId,
        brandName: geoDiagnosisTasks.brandName,
        website: geoDiagnosisTasks.website,
        industry: geoDiagnosisTasks.industry,
        city: geoDiagnosisTasks.city,
        category: geoDiagnosisTasks.category,
        platforms: geoDiagnosisTasks.platforms,
        competitors: geoDiagnosisTasks.competitors,
        questions: geoDiagnosisTasks.questions,
        status: geoDiagnosisTasks.status,
        reportId: geoDiagnosisTasks.reportId,
        error: geoDiagnosisTasks.error,
        totalCount: geoDiagnosisTasks.totalCount,
        completedCount: geoDiagnosisTasks.completedCount,
        failedCount: geoDiagnosisTasks.failedCount,
        skippedCount: geoDiagnosisTasks.skippedCount,
        startedAt: geoDiagnosisTasks.startedAt,
        finishedAt: geoDiagnosisTasks.finishedAt,
        creatorId: geoDiagnosisTasks.creatorId,
        createdAt: geoDiagnosisTasks.createdAt,
        isDemo: geoDiagnosisReports.isDemo,
        brandAliases: geoDiagnosisTasks.brandAliases,
        brandIntro: geoDiagnosisTasks.brandIntro,
        products: geoDiagnosisTasks.products,
      })
      .from(geoDiagnosisTasks)
      .leftJoin(geoDiagnosisReports, eq(geoDiagnosisTasks.reportId, geoDiagnosisReports.id));

    let whereClause: ReturnType<typeof and> | undefined;
    if (isClient) {
      const brandOrDemo = or(
        eq(geoDiagnosisTasks.brandId, user.brandId!),
        eq(geoDiagnosisReports.isDemo, true),
      );
      whereClause = otherConditions.length > 0
        ? and(...otherConditions, brandOrDemo)
        : and(brandOrDemo);
    } else if (otherConditions.length > 0) {
      whereClause = and(...otherConditions);
    }

    const dataQuery = whereClause ? baseQuery.where(whereClause) : baseQuery;

    const countBaseQuery = this.db
      .select({ count: count() })
      .from(geoDiagnosisTasks)
      .leftJoin(geoDiagnosisReports, eq(geoDiagnosisTasks.reportId, geoDiagnosisReports.id));
    const countQuery = whereClause ? countBaseQuery.where(whereClause) : countBaseQuery;

    const [itemsRaw, totalResult] = await Promise.all([
      dataQuery
        .orderBy(desc(geoDiagnosisTasks.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      countQuery,
    ]);

    const items: DiagnosisTask[] = itemsRaw.map((row) => ({
      id: row.id,
      brandId: row.brandId,
      brandName: row.brandName,
      website: row.website,
      industry: row.industry,
      coreKeywords: [],
      city: row.city,
      category: row.category,
      platforms: (row.platforms ?? []) as DiagnosisPlatform[],
      competitors: row.competitors ?? [],
      questions: row.questions ?? [],
      status: row.status as DiagnosisTask['status'],
      reportId: row.reportId,
      error: row.error,
      totalCount: row.totalCount ?? 0,
      completedCount: row.completedCount ?? 0,
      failedCount: row.failedCount ?? 0,
      skippedCount: row.skippedCount ?? 0,
      startedAt: row.startedAt ? new Date(row.startedAt).toISOString() : null,
      finishedAt: row.finishedAt ? new Date(row.finishedAt).toISOString() : null,
      creatorId: row.creatorId,
      createdAt: new Date(row.createdAt).toISOString(),
      isDemo: row.isDemo ?? false,
      brandAliases: (row as { brandAliases?: string[] }).brandAliases ?? [],
      brandIntro: (row as { brandIntro?: string | null }).brandIntro ?? null,
      products: ((row as { products?: DiagnosisProduct[] | Record<string, unknown> }).products ?? []) as DiagnosisProduct[],
    }));

    return {
      items,
      total: Number(totalResult[0]?.count ?? 0),
      page,
      pageSize,
    };
  }

  async retryTask(id: string, user: GeoUserCtx): Promise<DiagnosisTask> {
    const task = await this.getTaskById(id, user);
    if (!task) {
      throw new NotFoundException('任务不存在');
    }
    this.ensureCanWrite(user, task.brandId);

    if (task.status !== 'failed') {
      throw new ConflictException('只有失败的任务可以重试');
    }

    const now = new Date();

    await this.db.transaction(async (tx) => {
      if (task.reportId) {
        await tx
          .delete(geoDiagnosisResults)
          .where(eq(geoDiagnosisResults.reportId, task.reportId));
        await tx
          .delete(geoDiagnosisReports)
          .where(eq(geoDiagnosisReports.id, task.reportId));
      }

      await tx
        .update(geoDiagnosisTasks)
        .set({
          status: 'pending',
          reportId: null,
          error: null,
          updatedAt: now,
        })
        .where(eq(geoDiagnosisTasks.id, id));
    });

    const refreshed = await this.getTaskById(id, user);
    if (!refreshed) {
      throw new NotFoundException('任务不存在');
    }
    return refreshed;
  }

  async getTaskById(id: string, user: GeoUserCtx): Promise<DiagnosisTask | null> {
    await this.markTimedOutTasks(user);

    const rows = await this.db
      .select({
        id: geoDiagnosisTasks.id,
        brandId: geoDiagnosisTasks.brandId,
        brandName: geoDiagnosisTasks.brandName,
        website: geoDiagnosisTasks.website,
        industry: geoDiagnosisTasks.industry,
        city: geoDiagnosisTasks.city,
        category: geoDiagnosisTasks.category,
        platforms: geoDiagnosisTasks.platforms,
        competitors: geoDiagnosisTasks.competitors,
        questions: geoDiagnosisTasks.questions,
        status: geoDiagnosisTasks.status,
        reportId: geoDiagnosisTasks.reportId,
        error: geoDiagnosisTasks.error,
        totalCount: geoDiagnosisTasks.totalCount,
        completedCount: geoDiagnosisTasks.completedCount,
        failedCount: geoDiagnosisTasks.failedCount,
        skippedCount: geoDiagnosisTasks.skippedCount,
        startedAt: geoDiagnosisTasks.startedAt,
        finishedAt: geoDiagnosisTasks.finishedAt,
        creatorId: geoDiagnosisTasks.creatorId,
        createdAt: geoDiagnosisTasks.createdAt,
        isDemo: geoDiagnosisReports.isDemo,
        brandAliases: geoDiagnosisTasks.brandAliases,
        brandIntro: geoDiagnosisTasks.brandIntro,
        products: geoDiagnosisTasks.products,
      })
      .from(geoDiagnosisTasks)
      .leftJoin(geoDiagnosisReports, eq(geoDiagnosisTasks.reportId, geoDiagnosisReports.id))
      .where(eq(geoDiagnosisTasks.id, id))
      .limit(1);

    if (rows.length === 0) return null;

    const row = rows[0];
    const task: DiagnosisTask = {
      id: row.id,
      brandId: row.brandId,
      brandName: row.brandName,
      website: row.website,
      industry: row.industry,
      coreKeywords: [],
      city: row.city,
      category: row.category,
      platforms: (row.platforms ?? []) as DiagnosisPlatform[],
      competitors: row.competitors ?? [],
      questions: row.questions ?? [],
      status: row.status as DiagnosisTask['status'],
      reportId: row.reportId,
      error: row.error,
      totalCount: row.totalCount ?? 0,
      completedCount: row.completedCount ?? 0,
      failedCount: row.failedCount ?? 0,
      skippedCount: row.skippedCount ?? 0,
      startedAt: row.startedAt ? new Date(row.startedAt).toISOString() : null,
      finishedAt: row.finishedAt ? new Date(row.finishedAt).toISOString() : null,
      creatorId: row.creatorId,
      createdAt: new Date(row.createdAt).toISOString(),
      isDemo: row.isDemo ?? false,
      brandAliases: row.brandAliases ?? [],
      brandIntro: row.brandIntro ?? null,
      products: (row.products ?? []) as DiagnosisProduct[],
    };
    return task;
  }

  async deleteTask(id: string, user: GeoUserCtx): Promise<void> {
    const task = await this.getTaskById(id, user);
    if (!task) {
      throw new NotFoundException('任务不存在');
    }

    this.ensureCanWrite(user, task.brandId);

    const deleted = await this.db
      .delete(geoDiagnosisTasks)
      .where(eq(geoDiagnosisTasks.id, id))
      .returning({ id: geoDiagnosisTasks.id });

    if (deleted.length === 0) {
      throw new NotFoundException('任务不存在');
    }
  }

  // ---------- 诊断报告 ----------

  async listReports(
    query: DiagnosisReportListQueryDto,
    user: GeoUserCtx,
  ): Promise<PagedResponse<DiagnosisReport>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const { conditions, hasDemoOr } = this.buildReportWhere(query, user);
    const isClient = user.role === 'client' && user.brandId;

    const baseQuery = this.db
      .select({
        id: geoDiagnosisReports.id,
        taskId: geoDiagnosisReports.taskId,
        brandId: geoDiagnosisReports.brandId,
        brandName: geoDiagnosisTasks.brandName,
        overallScore: geoDiagnosisReports.overallScore,
        visibilityScore: geoDiagnosisReports.visibilityScore,
        rankingScore: geoDiagnosisReports.rankingScore,
        coverageScore: geoDiagnosisReports.coverageScore,
        citationScore: geoDiagnosisReports.citationScore,
        reportData: geoDiagnosisReports.reportData,
        shareToken: geoDiagnosisReports.shareToken,
        shareExpiresAt: geoDiagnosisReports.shareExpiresAt,
        creatorId: geoDiagnosisReports.creatorId,
        createdAt: geoDiagnosisReports.createdAt,
        isDemo: geoDiagnosisReports.isDemo,
      })
      .from(geoDiagnosisReports)
      .leftJoin(
        geoDiagnosisTasks,
        eq(geoDiagnosisReports.taskId, geoDiagnosisTasks.id),
      );

    let whereClause: ReturnType<typeof and> | undefined;
    if (hasDemoOr && isClient) {
      const brandOrDemo = or(
        eq(geoDiagnosisReports.brandId, user.brandId!),
        eq(geoDiagnosisReports.isDemo, true),
      );
      whereClause = conditions.length > 0
        ? and(...conditions, brandOrDemo)
        : and(brandOrDemo);
    } else if (conditions.length > 0) {
      whereClause = and(...conditions);
    }

    const dataQuery = whereClause ? baseQuery.where(whereClause) : baseQuery;

    const [itemsRaw, totalResult] = await Promise.all([
      dataQuery
        .orderBy(desc(geoDiagnosisReports.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db
        .select({ count: count() })
        .from(geoDiagnosisReports)
        .leftJoin(
          geoDiagnosisTasks,
          eq(geoDiagnosisReports.taskId, geoDiagnosisTasks.id),
        )
        .where(whereClause),
    ]);

    const items: DiagnosisReport[] = itemsRaw.map((row) => ({
      id: row.id,
      taskId: row.taskId,
      brandId: row.brandId,
      brandName: row.brandName ?? null,
      overallScore: row.overallScore ?? 0,
      visibilityScore: row.visibilityScore ?? 0,
      rankingScore: row.rankingScore ?? 0,
      coverageScore: row.coverageScore ?? 0,
      citationScore: row.citationScore ?? 0,
      reportData: row.reportData as unknown as DiagnosisReportData,
      shareToken: row.shareToken,
      shareExpiresAt: row.shareExpiresAt
        ? new Date(row.shareExpiresAt).toISOString()
        : null,
      creatorId: row.creatorId,
      createdAt: new Date(row.createdAt).toISOString(),
      isDemo: row.isDemo ?? false,
    }));

    return {
      items,
      total: Number(totalResult[0]?.count ?? 0),
      page,
      pageSize,
    };
  }

  async getReportById(id: string, user: GeoUserCtx): Promise<DiagnosisReport> {
    const rows = await this.db
      .select({
        id: geoDiagnosisReports.id,
        taskId: geoDiagnosisReports.taskId,
        brandId: geoDiagnosisReports.brandId,
        brandName: geoDiagnosisTasks.brandName,
        overallScore: geoDiagnosisReports.overallScore,
        visibilityScore: geoDiagnosisReports.visibilityScore,
        rankingScore: geoDiagnosisReports.rankingScore,
        coverageScore: geoDiagnosisReports.coverageScore,
        citationScore: geoDiagnosisReports.citationScore,
        reportData: geoDiagnosisReports.reportData,
        shareToken: geoDiagnosisReports.shareToken,
        shareExpiresAt: geoDiagnosisReports.shareExpiresAt,
        creatorId: geoDiagnosisReports.creatorId,
        createdAt: geoDiagnosisReports.createdAt,
        isDemo: geoDiagnosisReports.isDemo,
      })
      .from(geoDiagnosisReports)
      .leftJoin(
        geoDiagnosisTasks,
        eq(geoDiagnosisReports.taskId, geoDiagnosisTasks.id),
      )
      .where(eq(geoDiagnosisReports.id, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('报告不存在');
    }

    const row = rows[0];
    this.ensureCanReadReport(user, row.brandId, row.isDemo ?? false);

    return {
      id: row.id,
      taskId: row.taskId,
      brandId: row.brandId,
      brandName: row.brandName ?? null,
      overallScore: row.overallScore ?? 0,
      visibilityScore: row.visibilityScore ?? 0,
      rankingScore: row.rankingScore ?? 0,
      coverageScore: row.coverageScore ?? 0,
      citationScore: row.citationScore ?? 0,
      reportData: row.reportData as unknown as DiagnosisReportData,
      shareToken: row.shareToken,
      shareExpiresAt: row.shareExpiresAt
        ? new Date(row.shareExpiresAt).toISOString()
        : null,
      creatorId: row.creatorId,
      createdAt: new Date(row.createdAt).toISOString(),
      isDemo: row.isDemo ?? false,
    };
  }

  async shareReport(id: string, user: GeoUserCtx): Promise<ShareReportResponse> {
    const report = await this.getReportById(id, user);

    const shareToken = randomUUID();
    const shareExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.db
      .update(geoDiagnosisReports)
      .set({
        shareToken,
        shareExpiresAt,
      })
      .where(eq(geoDiagnosisReports.id, id));

    return {
      shareToken,
      shareUrl: `/diagnosis/share/${shareToken}`,
    };
  }

  // ---------- 匿名分享 ----------

  async getReportByShareToken(token: string): Promise<DiagnosisReport> {
    const rows = await this.db
      .select({
        id: geoDiagnosisReports.id,
        taskId: geoDiagnosisReports.taskId,
        brandId: geoDiagnosisReports.brandId,
        brandName: geoBrands.name,
        overallScore: geoDiagnosisReports.overallScore,
        visibilityScore: geoDiagnosisReports.visibilityScore,
        rankingScore: geoDiagnosisReports.rankingScore,
        coverageScore: geoDiagnosisReports.coverageScore,
        citationScore: geoDiagnosisReports.citationScore,
        reportData: geoDiagnosisReports.reportData,
        shareToken: geoDiagnosisReports.shareToken,
        shareExpiresAt: geoDiagnosisReports.shareExpiresAt,
        creatorId: geoDiagnosisReports.creatorId,
        createdAt: geoDiagnosisReports.createdAt,
        isDemo: geoDiagnosisReports.isDemo,
      })
      .from(geoDiagnosisReports)
      .leftJoin(geoBrands, eq(geoDiagnosisReports.brandId, geoBrands.id))
      .where(eq(geoDiagnosisReports.shareToken, token))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('分享链接不存在或已失效');
    }

    const row = rows[0];
    if (row.shareExpiresAt && new Date(row.shareExpiresAt).getTime() < Date.now()) {
      throw new NotFoundException('分享链接不存在或已失效');
    }

    return {
      id: row.id,
      taskId: row.taskId,
      brandId: row.brandId,
      brandName: row.brandName ?? null,
      overallScore: row.overallScore ?? 0,
      visibilityScore: row.visibilityScore ?? 0,
      rankingScore: row.rankingScore ?? 0,
      coverageScore: row.coverageScore ?? 0,
      citationScore: row.citationScore ?? 0,
      reportData: row.reportData as unknown as DiagnosisReportData,
      shareToken: row.shareToken,
      shareExpiresAt: row.shareExpiresAt
        ? new Date(row.shareExpiresAt).toISOString()
        : null,
      creatorId: '',
      createdAt: new Date(row.createdAt).toISOString(),
      isDemo: row.isDemo ?? false,
    };
  }

  // ---------- 竞品对比 ----------

  async competitorCompare(
    dto: CompetitorCompareRequestDto,
    user: GeoUserCtx,
  ): Promise<CompetitorCompareResponse> {
    // 竞品报告最多 3 个，超过截断
    const competitorIds = dto.competitorReportIds.slice(0, 3);

    // 1. 读取本品牌报告
    const brandReport = await this.getReportById(dto.brandReportId, user);
    // client 角色已在 getReportById 中校验品牌归属

    // 2. 读取所有竞品报告
    const competitorRows = await this.db
      .select({
        id: geoDiagnosisReports.id,
        taskId: geoDiagnosisReports.taskId,
        brandId: geoDiagnosisReports.brandId,
        brandName: geoBrands.name,
        overallScore: geoDiagnosisReports.overallScore,
        visibilityScore: geoDiagnosisReports.visibilityScore,
        rankingScore: geoDiagnosisReports.rankingScore,
        coverageScore: geoDiagnosisReports.coverageScore,
        citationScore: geoDiagnosisReports.citationScore,
        createdAt: geoDiagnosisReports.createdAt,
        isDemo: geoDiagnosisReports.isDemo,
      })
      .from(geoDiagnosisReports)
      .leftJoin(geoBrands, eq(geoDiagnosisReports.brandId, geoBrands.id))
      .where(inArray(geoDiagnosisReports.id, competitorIds));

    if (competitorRows.length === 0) {
      throw new NotFoundException('未找到有效的竞品报告');
    }

    for (const r of competitorRows) {
      this.ensureCanReadReport(user, r.brandId, r.isDemo ?? false);
    }

    // 维度映射
    const dimensionDefs: Array<{ key: 'visibilityScore' | 'rankingScore' | 'coverageScore' | 'citationScore'; name: string; label: string }> = [
      { key: 'visibilityScore', name: 'visibility', label: 'AI 可见度' },
      { key: 'rankingScore', name: 'ranking', label: '推荐顺位' },
      { key: 'coverageScore', name: 'coverage', label: '问题覆盖' },
      { key: 'citationScore', name: 'citation', label: '内容可引用度' },
    ];

    const buildDimensions = (report: { visibilityScore: number; rankingScore: number; coverageScore: number; citationScore: number }): CompetitorDimensionScore[] =>
      dimensionDefs.map((d) => ({
        name: d.name,
        label: d.label,
        score: report[d.key] ?? 0,
      }));

    // 3. 读取所有报告的逐题结果
    const allReportIds = [dto.brandReportId, ...competitorRows.map((r) => r.id)];
    const allResults = await this.db
      .select()
      .from(geoDiagnosisResults)
      .where(inArray(geoDiagnosisResults.reportId, allReportIds));

    // 按 reportId 分组
    const resultsByReport = new Map<string, typeof allResults>();
    for (const r of allResults) {
      if (!r.reportId) continue;
      const arr = resultsByReport.get(r.reportId) ?? [];
      arr.push(r);
      resultsByReport.set(r.reportId, arr);
    }

    // 4. 计算 SOV（声量份额）：本品牌被提及次数 / (本品牌+所有竞品被提及总次数)
    const brandResults = resultsByReport.get(dto.brandReportId) ?? [];
    const brandMentionCount = brandResults.filter((r) => r.isMentioned).length;
    let competitorMentionTotal = 0;
    for (const compRow of competitorRows) {
      const compResults = resultsByReport.get(compRow.id) ?? [];
      competitorMentionTotal += compResults.filter((r) => r.isMentioned).length;
    }
    const totalMention = brandMentionCount + competitorMentionTotal;
    const sov = totalMention > 0 ? Math.round((brandMentionCount / totalMention) * 100) : 0;

    // 5. 逐题对比表：取本品牌和所有竞品都有的问题（按 question + platform 匹配）
    const brandKeySet = new Set<string>();
    for (const r of brandResults) {
      brandKeySet.add(`${r.question}||${r.platform}`);
    }

    // 找出所有竞品都有、且本品牌也有的 key（交集）
    let commonKeys: Set<string> = brandKeySet;
    for (const compRow of competitorRows) {
      const compResults = resultsByReport.get(compRow.id) ?? [];
      const compKeySet = new Set<string>();
      for (const r of compResults) {
        compKeySet.add(`${r.question}||${r.platform}`);
      }
      commonKeys = new Set([...commonKeys].filter((k) => compKeySet.has(k)));
    }

    // 按问题排序，最多 50 条
    const sortedKeys = [...commonKeys].sort().slice(0, 50);

    const questionCompare: CompetitorQuestionCompare[] = sortedKeys.map((key) => {
      const [question, platform] = key.split('||');
      const brands: CompetitorQuestionCompare['brands'] = [];

      // 本品牌
      const brandResult = brandResults.find((r) => r.question === question && r.platform === platform);
      brands.push({
        brandName: brandReport.brandName ?? '本品牌',
        isMentioned: brandResult?.isMentioned ?? false,
        mentionPosition: brandResult?.mentionPosition ?? null,
        isOwn: true,
      });

      // 各竞品
      for (const compRow of competitorRows) {
        const compResults = resultsByReport.get(compRow.id) ?? [];
        const compResult = compResults.find((r) => r.question === question && r.platform === platform);
        brands.push({
          brandName: compRow.brandName ?? '竞品',
          isMentioned: compResult?.isMentioned ?? false,
          mentionPosition: compResult?.mentionPosition ?? null,
          isOwn: false,
        });
      }

      return { question, platform, brands };
    });

    // 6. 抢位预警：列出"竞品命中但本品牌未命中"的问题
    const gapAlerts: CompetitorGapAlert[] = [];
    for (const compRow of competitorRows) {
      const compResults = resultsByReport.get(compRow.id) ?? [];
      for (const cr of compResults) {
        if (!cr.isMentioned) continue;
        const brandResult = brandResults.find(
          (br) => br.question === cr.question && br.platform === cr.platform,
        );
        // 本品牌未命中（或不存在该题），且竞品命中
        if (!brandResult || !brandResult.isMentioned) {
          const compName = compRow.brandName ?? '竞品';
          gapAlerts.push({
            question: cr.question,
            platform: cr.platform,
            competitorName: compName,
            competitorPosition: cr.mentionPosition ?? null,
            suggestion: `该问题下 ${compName} 被推荐，建议补一篇《${cr.question}》类问答内容`,
          });
        }
      }
    }

    // 组装竞品品牌数据
    const competitors: CompetitorBrandData[] = competitorRows.map((row) => {
      const compResults = resultsByReport.get(row.id) ?? [];
      const compMentionCount = compResults.filter((r) => r.isMentioned).length;
      const compSov = totalMention > 0 ? Math.round((compMentionCount / totalMention) * 100) : 0;
      return {
        brandId: row.brandId,
        brandName: row.brandName ?? '竞品',
        reportId: row.id,
        dimensions: buildDimensions({
          visibilityScore: row.visibilityScore ?? 0,
          rankingScore: row.rankingScore ?? 0,
          coverageScore: row.coverageScore ?? 0,
          citationScore: row.citationScore ?? 0,
        }),
        sov: compSov,
      };
    });

    const ownBrand: CompetitorBrandData = {
      brandId: brandReport.brandId,
      brandName: brandReport.brandName ?? '本品牌',
      reportId: brandReport.id,
      dimensions: buildDimensions(brandReport),
      sov,
    };

    return {
      ownBrand,
      competitors,
      questionCompare,
      gapAlerts,
      totalQuestions: commonKeys.size,
    };
  }

  // ---------- helper: 超时兜底 ----------

  private async markTimedOutTasks(user: GeoUserCtx): Promise<void> {
    try {
      const now = new Date();
      const runningTimeout = new Date(now.getTime() - 30 * 60 * 1000);
      const pendingTimeout = new Date(now.getTime() - 60 * 60 * 1000);

      const isClient = user.role === 'client' && user.brandId;

      const baseConditions = [
        inArray(geoDiagnosisTasks.status, ['pending', 'running']),
      ];

      if (isClient) {
        baseConditions.push(eq(geoDiagnosisTasks.brandId, user.brandId!));
      }

      const runningStuck = await this.db
        .update(geoDiagnosisTasks)
        .set({
          status: 'failed',
          error: '诊断超时，请重试',
        })
        .where(and(
          eq(geoDiagnosisTasks.status, 'running'),
          lt(geoDiagnosisTasks.updatedAt, runningTimeout),
          ...(isClient ? [eq(geoDiagnosisTasks.brandId, user.brandId!)] : []),
        ))
        .returning({ id: geoDiagnosisTasks.id });

      const pendingStuck = await this.db
        .update(geoDiagnosisTasks)
        .set({
          status: 'failed',
          error: '任务排队超时，请重试',
        })
        .where(and(
          eq(geoDiagnosisTasks.status, 'pending'),
          lt(geoDiagnosisTasks.createdAt, pendingTimeout),
          ...(isClient ? [eq(geoDiagnosisTasks.brandId, user.brandId!)] : []),
        ))
        .returning({ id: geoDiagnosisTasks.id });

      if (runningStuck.length > 0 || pendingStuck.length > 0) {
        this.logger.log(
          `超时兜底标记失败任务 running=${runningStuck.length} pending=${pendingStuck.length}`,
        );
      }
    } catch (err: unknown) {
      this.logger.warn(
        `超时兜底检查失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ---------- helper: where 构造 ----------

  private buildTaskWhere(
    query: DiagnosisTaskListQueryDto,
    user: GeoUserCtx,
  ): ReturnType<typeof eq>[] {
    const conditions: ReturnType<typeof eq>[] = [];

    if (user.role === 'client' && user.brandId) {
      conditions.push(eq(geoDiagnosisTasks.brandId, user.brandId));
    } else if (query.brandId) {
      conditions.push(eq(geoDiagnosisTasks.brandId, query.brandId));
    }

    if (query.status) {
      conditions.push(eq(geoDiagnosisTasks.status, query.status));
    }

    if (query.keyword) {
      conditions.push(
        ilike(geoDiagnosisTasks.brandName, `%${query.keyword}%`) as ReturnType<typeof eq>,
      );
    }

    return conditions;
  }

  private buildReportWhere(
    query: DiagnosisReportListQueryDto,
    user: GeoUserCtx,
  ): { conditions: ReturnType<typeof eq>[]; hasDemoOr: boolean } {
    const conditions: ReturnType<typeof eq>[] = [];
    let hasDemoOr = false;

    if (user.role === 'client' && user.brandId) {
      hasDemoOr = true;
    } else if (query.brandId) {
      conditions.push(eq(geoDiagnosisReports.brandId, query.brandId));
    }

    if (query.minScore !== undefined) {
      conditions.push(
        gte(geoDiagnosisReports.overallScore, query.minScore) as ReturnType<typeof eq>,
      );
    }

    return { conditions, hasDemoOr };
  }

  // ---------- helper: 权限 ----------

  private ensureCanWrite(user: GeoUserCtx, brandId: string | null): void {
    if (user.role === 'client') {
      if (!user.brandId || (brandId && user.brandId !== brandId)) {
        throw new ForbiddenException('只能操作所属品牌的数据');
      }
    }
  }

  private resolveBrandId(
    brandId: string | undefined,
    user: GeoUserCtx,
  ): string {
    if (user.role === 'client' && user.brandId) {
      return user.brandId;
    }
    if (brandId) {
      return brandId;
    }
    throw new BadRequestException('品牌不能为空');
  }

  private ensureCanReadTask(user: GeoUserCtx, task: DiagnosisTask): void {
    if (user.role === 'client' && user.brandId) {
      if (task.isDemo) return;
      if (task.brandId && task.brandId !== user.brandId) {
        throw new ForbiddenException('无权查看该任务');
      }
    }
  }

  private ensureCanReadReport(user: GeoUserCtx, brandId: string, isDemo?: boolean): void {
    if (user.role === 'client' && user.brandId) {
      if (isDemo) return;
      if (user.brandId !== brandId) {
        throw new ForbiddenException('无权查看该报告');
      }
    }
  }
}
