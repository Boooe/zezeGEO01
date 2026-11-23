import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, ilike, inArray, desc, count, gte, sql } from 'drizzle-orm';
import { firstValueFrom } from 'rxjs';

import {
  geoArticles,
  geoArticleBatches,
  geoMaterials,
  geoMaterialGroups,
  geoCreditAccounts,
  geoCreditTransactions,
  geoBrands,
  geoUsers,
  geoVideoTasks,
  geoVideoServiceConfig,
  geoImageServiceConfig,
  geoPublishQueue,
} from '@server/database/schema';
import type {
  Article,
  ArticleBatch,
  Material,
  MaterialGroup,
  CreditAccount,
  CreditTransaction,
  GenerateArticleResponse,
  GenerateImageResponse,
  GenerateVideoScriptResponse,
  VideoScriptScene,
  PagedResponse,
  UserRole,
  ArticleType,
  ArticleStatus,
  VideoTask,
  VideoTaskDetail,
  VideoServiceConfig,
  ImageServiceConfig,
  SubmitVideoTaskResult,
  VideoTaskStatus,
  ContentOverviewStats,
  ImagePurpose,
  ImageStyle,
  MaterialStatus,
  MaterialUsageStats,
  VideoPurpose,
  VideoStyle,
} from '@shared/api.interface';
import {
  ARTICLE_TYPE_LABELS,
  IMAGE_STYLE_LABELS,
  IMAGE_PURPOSE_LABELS,
  VIDEO_TASK_STATUS_LABELS,
} from '@shared/api.interface';
import { CapabilityService } from './capability.service';
import { AiKeysService } from '@server/modules/ai-keys/ai-keys.service';
import {
  GenerateArticleDto,
  ArticleListQueryDto,
  UpdateArticleDto,
  CreateBatchDto,
  BatchListQueryDto,
  CreditTransactionQueryDto,
  GenerateImageDto,
  MaterialListQueryDto,
  CreateMaterialGroupDto,
  UpdateMaterialDto,
  BatchDeleteMaterialsDto,
  RecordMaterialDto,
  MaterialGroupListQueryDto,
  GenerateVideoScriptDto,
  CreateVideoTaskDto,
  VideoTaskListQueryDto,
  VideoServiceConfigDto,
  ImageServiceConfigDto,
} from './dto/content.dto';

interface GeoUserCtx {
  id: string;
  role: UserRole;
  brandId: string | null;
}

// 算力计费常量
const ARTICLE_CREDIT_TIERS: Array<{ words: number; credits: number }> = [
  { words: 800, credits: 5000 },
  { words: 1200, credits: 8000 },
  { words: 1500, credits: 10000 },
];
const ARTICLE_CREDIT_PER_100_WORDS = 600;
const IMAGE_CREDIT_PER_IMAGE = 2000;
const VIDEO_SCRIPT_CREDIT = 5000;
const VIDEO_GENERATE_CREDIT = 20000;

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly capabilityService: CapabilityService,
    private readonly httpService: HttpService,
    private readonly aiKeysService: AiKeysService,
  ) {}

  // ---------- AI 调用封装 ----------

  private async aiChatWithFallback(params: {
    content_topic: string;
    content_type: string;
    word_count?: string;
    additional_requirements?: string;
    user: GeoUserCtx;
    brandId: string;
  }): Promise<string> {
    const activeKey = await this.aiKeysService.getActiveKey(params.user, params.brandId);
    if (activeKey && activeKey.apiKey) {
      const prompt = [
        `主题：${params.content_topic}`,
        `类型：${params.content_type}`,
        params.word_count ? `字数要求：约 ${params.word_count} 字` : '',
        params.additional_requirements ? `补充要求：\n${params.additional_requirements}` : '',
      ].filter(Boolean).join('\n');

      const maxTokens = params.word_count
        ? Math.min(4000, Math.round(Number(params.word_count) * 2))
        : undefined;

      const result = await this.aiKeysService.chat(
        [{ role: 'user', content: prompt }],
        { maxTokens, temperature: 0.8, user: params.user, brandId: params.brandId },
      );
      return result.content;
    }

    const result = await this.capabilityService.call('geo_text_generate_1', {
      content_topic: params.content_topic,
      content_type: params.content_type,
      word_count: params.word_count,
      additional_requirements: params.additional_requirements,
    });
    return typeof result === 'string' ? result : String(result);
  }

  // ============================================================
  //  权限辅助
  // ============================================================

  private ensureCanWrite(user: GeoUserCtx, targetBrandId: string | undefined | null): void {
    if (user.role === 'client') {
      if (!user.brandId) {
        throw new ForbiddenException('当前角色无写操作权限');
      }
      if (targetBrandId && targetBrandId !== user.brandId) {
        throw new ForbiddenException('只能操作所属品牌的数据');
      }
      return;
    }
    if (user.role === 'operator' && user.brandId && targetBrandId && user.brandId !== targetBrandId) {
      throw new ForbiddenException('只能操作所属品牌的数据');
    }
  }

  private ensureCanReadBrand(user: GeoUserCtx, brandIdParam?: string | null): string | null {
    if (user.role === 'client') {
      return user.brandId;
    }
    return brandIdParam ?? null;
  }

  // ============================================================
  //  算力账户辅助
  // ============================================================

  private async getOrCreateCreditAccount(brandId: string): Promise<typeof geoCreditAccounts.$inferSelect> {
    const existing = await this.db
      .select()
      .from(geoCreditAccounts)
      .where(eq(geoCreditAccounts.brandId, brandId))
      .limit(1);

    if (existing.length > 0) return existing[0];

    const inserted = await this.db
      .insert(geoCreditAccounts)
      .values({ brandId, balance: '0', totalUsed: '0' })
      .returning();

    return inserted[0];
  }

  /**
   * 扣减算力（事务：扣余额 + 写流水 + 更新 totalUsed）
   * 返回流水记录
   */
  private async deductCredits(
    brandId: string,
    amount: number,
    txType: 'article_generate' | 'image_generate' | 'video_script' | 'video_generate',
    relatedType: string | null,
    relatedId: string | null,
    description: string | null,
    operatorId: string,
  ): Promise<void> {
    if (amount <= 0) return;

    await this.db.transaction(async (tx) => {
      // 1. 读取当前账户（行锁）
      const accountRows = await tx
        .select()
        .from(geoCreditAccounts)
        .where(eq(geoCreditAccounts.brandId, brandId))
        .limit(1)
        .for('update');

      let account = accountRows[0];
      if (!account) {
        const created = await tx
          .insert(geoCreditAccounts)
          .values({ brandId, balance: '0', totalUsed: '0' })
          .returning();
        account = created[0];
      }

      const balanceNum = Number(account.balance);
      if (balanceNum < amount) {
        throw new BadRequestException('算力不足，请联系管理员充值');
      }

      const newBalance = (balanceNum - amount).toString();
      const newTotalUsed = (Number(account.totalUsed) + amount).toString();

      // 2. 更新余额
      await tx
        .update(geoCreditAccounts)
        .set({ balance: newBalance, totalUsed: newTotalUsed })
        .where(eq(geoCreditAccounts.id, account.id));

      // 3. 写流水
      await tx.insert(geoCreditTransactions).values({
        brandId,
        changeAmount: `-${amount}`,
        balanceAfter: newBalance,
        transactionType: txType,
        relatedType,
        relatedId,
        description,
        operatorId,
      });
    });
  }

  /**
   * 回退算力（加回余额 + 写流水）
   */
  private async refundCredits(
    brandId: string,
    amount: number,
    txType: 'article_generate' | 'image_generate' | 'video_script' | 'video_generate',
    relatedType: string | null,
    relatedId: string | null,
    description: string | null,
    operatorId: string,
  ): Promise<void> {
    if (amount <= 0) return;

    await this.db.transaction(async (tx) => {
      const accountRows = await tx
        .select()
        .from(geoCreditAccounts)
        .where(eq(geoCreditAccounts.brandId, brandId))
        .limit(1)
        .for('update');

      if (accountRows.length === 0) {
        throw new BadRequestException('算力账户不存在');
      }

      const account = accountRows[0];
      const newBalance = (Number(account.balance) + amount).toString();

      await tx
        .update(geoCreditAccounts)
        .set({ balance: newBalance })
        .where(eq(geoCreditAccounts.id, account.id));

      await tx.insert(geoCreditTransactions).values({
        brandId,
        changeAmount: `${amount}`,
        balanceAfter: newBalance,
        transactionType: txType,
        relatedType,
        relatedId,
        description,
        operatorId,
      });
    });
  }

  // ============================================================
  //  文章生成
  // ============================================================

  private calculateArticleCredit(wordCount: number): number {
    for (const tier of ARTICLE_CREDIT_TIERS) {
      if (wordCount <= tier.words) return tier.credits;
    }
    // 超过最高档位按每 100 字计费
    const baseTier = ARTICLE_CREDIT_TIERS[ARTICLE_CREDIT_TIERS.length - 1];
    const extraWords = wordCount - baseTier.words;
    const extraCredits = Math.ceil(extraWords / 100) * ARTICLE_CREDIT_PER_100_WORDS;
    return baseTier.credits + extraCredits;
  }

  private mapArticleTypeToAiType(type: ArticleType): string {
    return ARTICLE_TYPE_LABELS[type] ?? 'SEO文章';
  }

  async generateArticles(
    dto: GenerateArticleDto,
    user: GeoUserCtx,
  ): Promise<GenerateArticleResponse> {
    this.ensureCanWrite(user, dto.brandId);

    const perArticleCredit = this.calculateArticleCredit(dto.targetWordCount);
    const totalCredit = perArticleCredit * dto.count;

    // 先扣算力
    await this.deductCredits(
      dto.brandId,
      totalCredit,
      'article_generate',
      'batch',
      null,
      `批量生成 ${dto.count} 篇 ${ARTICLE_TYPE_LABELS[dto.articleType]}文章（${dto.targetWordCount}字/篇）`,
      user.id,
    );

    const needBatch = dto.count > 1;
    let batchId: string | null = null;

    // 创建批次（如果 count > 1）
    if (needBatch) {
      const batchInsert = await this.db
        .insert(geoArticleBatches)
        .values({
          brandId: dto.brandId,
          batchName: `${ARTICLE_TYPE_LABELS[dto.articleType]}批量_${new Date().toLocaleDateString()}`,
          articleType: dto.articleType,
          targetWordCount: dto.targetWordCount,
          totalCount: dto.count,
          successCount: 0,
          failedCount: 0,
          status: 'generating',
          totalCost: totalCredit.toString(),
          keywords: dto.keywords,
          creatorId: user.id,
        })
        .returning({ id: geoArticleBatches.id });
      batchId = batchInsert[0].id;
    }

    // 创建文章记录
    const articleIds: string[] = [];
    for (let i = 0; i < dto.count; i++) {
      const kw = dto.keywords[i % dto.keywords.length];
      const inserted = await this.db
        .insert(geoArticles)
        .values({
          brandId: dto.brandId,
          title: `${kw} - 生成中...`,
          content: '',
          articleType: dto.articleType,
          wordCount: 0,
          keywords: dto.keywords,
          longtailKeywords: dto.longtailKeywords ?? [],
          status: 'generating' as const,
          batchId,
          costCredits: perArticleCredit.toString(),
          creatorId: user.id,
        })
        .returning({ id: geoArticles.id });
      articleIds.push(inserted[0].id);
    }

    // 异步 fire-and-forget 生成每篇文章
    // 注意：生产环境应改为队列，此处同步串行生成保证可观测
    void this.processArticleGeneration(
      dto,
      user,
      articleIds,
      batchId,
      perArticleCredit,
    );

    return {
      articleIds,
      batchId: batchId ?? undefined,
    };
  }

  private async processArticleGeneration(
    dto: GenerateArticleDto,
    user: GeoUserCtx,
    articleIds: string[],
    batchId: string | null,
    perArticleCredit: number,
  ): Promise<void> {
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < articleIds.length; i++) {
      const articleId = articleIds[i];
      const kw = dto.keywords[i % dto.keywords.length];
      try {
        // 组装 AI 入参
        const contentTopic = `${kw} - ${dto.articleType === 'recommendation' ? '推荐' : dto.articleType === 'review' ? '评测' : '科普'}内容`;
        const additionalReqs = [
          `长尾关键词：${(dto.longtailKeywords ?? []).join('、') || '无'}`,
          `品牌关键词：${dto.keywords.join('、')}`,
        ].join('；');

        const result = await this.aiChatWithFallback({
          content_topic: contentTopic,
          content_type: this.mapArticleTypeToAiType(dto.articleType),
          word_count: String(dto.targetWordCount),
          additional_requirements: additionalReqs,
          user,
          brandId: dto.brandId,
        });

        const fullText = typeof result === 'string' ? result : String(result);
        const lines = fullText.split('\n');
        const titleLine = lines.find((l: string) => l.trim().length > 0 && !l.startsWith('#'));
        const title = titleLine?.trim() ?? `${kw}精选文章`;
        const content = fullText;
        const wordCount = content.replace(/\s/g, '').length;

        await this.db
          .update(geoArticles)
          .set({
            title,
            content,
            wordCount,
            status: 'published' as ArticleStatus,
            error: null,
          })
          .where(eq(geoArticles.id, articleId));

        successCount++;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        this.logger.error(`文章生成失败 articleId=${articleId}`, errorMsg);

        await this.db
          .update(geoArticles)
          .set({
            status: 'failed' as ArticleStatus,
            error: errorMsg,
          })
          .where(eq(geoArticles.id, articleId));

        // 生成失败，回退算力
        try {
          await this.refundCredits(
            dto.brandId,
            perArticleCredit,
            'article_generate',
            'article',
            articleId,
            `文章生成失败，算力退回`,
            user.id,
          );
        } catch (refundErr) {
          this.logger.error('算力回退失败', refundErr instanceof Error ? refundErr.message : String(refundErr));
        }

        failedCount++;
      }
    }

    // 更新批次状态
    if (batchId) {
      const batchStatus: 'completed' | 'partial_failed' | 'failed' =
        failedCount === 0 ? 'completed' : successCount === 0 ? 'failed' : 'partial_failed';
      await this.db
        .update(geoArticleBatches)
        .set({
          successCount,
          failedCount,
          status: batchStatus,
        })
        .where(eq(geoArticleBatches.id, batchId));
    }
  }

  // ============================================================
  //  文章列表/详情/编辑/删除/发布
  // ============================================================

  async listArticles(
    query: ArticleListQueryDto,
    user: GeoUserCtx,
  ): Promise<PagedResponse<Article>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const brandFilter = this.ensureCanReadBrand(user, query.brandId);

    const conditions = this.buildArticleWhere(query, brandFilter);

    const baseQuery = this.db
      .select({
        id: geoArticles.id,
        brandId: geoArticles.brandId,
        brandName: geoBrands.name,
        title: geoArticles.title,
        articleType: geoArticles.articleType,
        wordCount: geoArticles.wordCount,
        keywords: geoArticles.keywords,
        longtailKeywords: geoArticles.longtailKeywords,
        status: geoArticles.status,
        batchId: geoArticles.batchId,
        coverImage: geoArticles.coverImage,
        costCredits: geoArticles.costCredits,
        creatorId: geoArticles.creatorId,
        creatorName: geoUsers.displayName,
        error: geoArticles.error,
        createdAt: geoArticles.createdAt,
        updatedAt: geoArticles.updatedAt,
      })
      .from(geoArticles)
      .leftJoin(geoBrands, eq(geoArticles.brandId, geoBrands.id))
      .leftJoin(geoUsers, eq(geoArticles.creatorId, geoUsers.id));

    const dataQuery = conditions.length > 0
      ? baseQuery.where(and(...conditions))
      : baseQuery;

    const [itemsRaw, totalResult] = await Promise.all([
      dataQuery
        .orderBy(desc(geoArticles.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db
        .select({ count: count() })
        .from(geoArticles)
        .leftJoin(geoBrands, eq(geoArticles.brandId, geoBrands.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined),
    ]);

    const items: Article[] = itemsRaw.map((row) => ({
      id: row.id,
      brandId: row.brandId,
      brandName: row.brandName ?? '',
      title: row.title,
      content: '', // 列表不返回全文
      articleType: row.articleType as Article['articleType'],
      wordCount: row.wordCount,
      keywords: row.keywords ?? [],
      longtailKeywords: row.longtailKeywords ?? [],
      status: row.status as Article['status'],
      batchId: row.batchId ?? null,
      coverImage: row.coverImage ?? null,
      costCredits: Number(row.costCredits),
      creatorId: row.creatorId,
      creatorName: row.creatorName ?? null,
      error: row.error ?? null,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    }));

    return { items, total: Number(totalResult[0]?.count ?? 0), page, pageSize };
  }

  private buildArticleWhere(
    query: ArticleListQueryDto,
    brandFilter: string | null,
  ): ReturnType<typeof eq>[] {
    const conditions: ReturnType<typeof eq>[] = [];

    if (brandFilter) {
      conditions.push(eq(geoArticles.brandId, brandFilter) as any);
    } else if (query.brandId) {
      conditions.push(eq(geoArticles.brandId, query.brandId) as any);
    }

    if (query.articleType) {
      conditions.push(eq(geoArticles.articleType, query.articleType) as any);
    }
    if (query.status) {
      conditions.push(eq(geoArticles.status, query.status) as any);
    }
    if (query.batchId) {
      conditions.push(eq(geoArticles.batchId, query.batchId) as any);
    }
    if (query.keyword) {
      conditions.push(ilike(geoArticles.title, `%${query.keyword}%`) as any);
    }
    if (query.startDate) {
      conditions.push(gte(geoArticles.createdAt, query.startDate) as any);
    }
    if (query.endDate) {
      const endOfDay = new Date(query.endDate);
      endOfDay.setHours(23, 59, 59, 999);
      conditions.push(sql`${geoArticles.createdAt} <= ${endOfDay.toISOString()}::timestamptz` as any);
    }

    return conditions;
  }

  async getArticleDetail(id: string, user: GeoUserCtx): Promise<Article> {
    const rows = await this.db
      .select({
        id: geoArticles.id,
        brandId: geoArticles.brandId,
        brandName: geoBrands.name,
        title: geoArticles.title,
        content: geoArticles.content,
        articleType: geoArticles.articleType,
        wordCount: geoArticles.wordCount,
        keywords: geoArticles.keywords,
        longtailKeywords: geoArticles.longtailKeywords,
        status: geoArticles.status,
        batchId: geoArticles.batchId,
        coverImage: geoArticles.coverImage,
        costCredits: geoArticles.costCredits,
        creatorId: geoArticles.creatorId,
        creatorName: geoUsers.displayName,
        error: geoArticles.error,
        createdAt: geoArticles.createdAt,
        updatedAt: geoArticles.updatedAt,
      })
      .from(geoArticles)
      .leftJoin(geoBrands, eq(geoArticles.brandId, geoBrands.id))
      .leftJoin(geoUsers, eq(geoArticles.creatorId, geoUsers.id))
      .where(eq(geoArticles.id, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('文章不存在');
    }

    const row = rows[0];
    const brandFilter = this.ensureCanReadBrand(user, row.brandId);
    if (brandFilter && row.brandId !== brandFilter) {
      throw new ForbiddenException('无权查看该文章');
    }

    return {
      id: row.id,
      brandId: row.brandId,
      brandName: row.brandName ?? '',
      title: row.title,
      content: row.content,
      articleType: row.articleType as Article['articleType'],
      wordCount: row.wordCount,
      keywords: row.keywords ?? [],
      longtailKeywords: row.longtailKeywords ?? [],
      status: row.status as Article['status'],
      batchId: row.batchId ?? null,
      coverImage: row.coverImage ?? null,
      costCredits: Number(row.costCredits),
      creatorId: row.creatorId,
      creatorName: row.creatorName ?? null,
      error: row.error ?? null,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
  }

  async updateArticle(id: string, dto: UpdateArticleDto, user: GeoUserCtx): Promise<Article> {
    const existing = await this.db
      .select({ id: geoArticles.id, brandId: geoArticles.brandId })
      .from(geoArticles)
      .where(eq(geoArticles.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('文章不存在');
    }

    this.ensureCanWrite(user, existing[0].brandId);

    const patch: Partial<typeof geoArticles.$inferInsert> = {};
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.content !== undefined) {
      patch.content = dto.content;
      patch.wordCount = dto.content.replace(/\s/g, '').length;
    }
    if (dto.status !== undefined) patch.status = dto.status;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    await this.db.update(geoArticles).set(patch).where(eq(geoArticles.id, id));
    return this.getArticleDetail(id, user);
  }

  async deleteArticle(id: string, user: GeoUserCtx): Promise<void> {
    const existing = await this.db
      .select({ id: geoArticles.id, brandId: geoArticles.brandId })
      .from(geoArticles)
      .where(eq(geoArticles.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('文章不存在');
    }

    this.ensureCanWrite(user, existing[0].brandId);

    const deleted = await this.db
      .delete(geoArticles)
      .where(eq(geoArticles.id, id))
      .returning({ id: geoArticles.id });

    if (deleted.length === 0) {
      throw new NotFoundException('文章不存在');
    }
  }

  async publishArticle(id: string, user: GeoUserCtx): Promise<{ queueId: string }> {
    const articleRows = await this.db
      .select({
        id: geoArticles.id,
        brandId: geoArticles.brandId,
        title: geoArticles.title,
        content: geoArticles.content,
        coverImage: geoArticles.coverImage,
        keywords: geoArticles.keywords,
        wordCount: geoArticles.wordCount,
      })
      .from(geoArticles)
      .where(eq(geoArticles.id, id))
      .limit(1);

    if (articleRows.length === 0) {
      throw new NotFoundException('文章不存在');
    }

    const article = articleRows[0];
    this.ensureCanWrite(user, article.brandId);

    const inserted = await this.db
      .insert(geoPublishQueue)
      .values({
        brandId: article.brandId,
        articleId: article.id,
        title: article.title,
        content: article.content,
        coverUrl: article.coverImage,
        tags: article.keywords ?? [],
        wordCount: article.wordCount,
        mode: 'manual',
        status: 'pending',
        source: 'manual_publish',
      })
      .returning({ id: geoPublishQueue.id });

    return { queueId: inserted[0].id };
  }

  // ============================================================
  //  批次
  // ============================================================

  async createBatch(dto: CreateBatchDto, user: GeoUserCtx): Promise<ArticleBatch> {
    this.ensureCanWrite(user, dto.brandId);

    const inserted = await this.db
      .insert(geoArticleBatches)
      .values({
        brandId: dto.brandId,
        batchName: dto.batchName,
        articleType: dto.articleType,
        targetWordCount: dto.targetWordCount,
        totalCount: dto.totalCount,
        successCount: 0,
        failedCount: 0,
        status: 'pending',
        totalCost: '0',
        keywords: dto.keywords,
        creatorId: user.id,
      })
      .returning({ id: geoArticleBatches.id });

    return this.getBatchDetail(inserted[0].id, user);
  }

  async listBatches(
    query: BatchListQueryDto,
    user: GeoUserCtx,
  ): Promise<PagedResponse<ArticleBatch>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const brandFilter = this.ensureCanReadBrand(user, query.brandId);

    const conditions: ReturnType<typeof eq>[] = [];
    if (brandFilter) {
      conditions.push(eq(geoArticleBatches.brandId, brandFilter) as any);
    } else if (query.brandId) {
      conditions.push(eq(geoArticleBatches.brandId, query.brandId) as any);
    }
    if (query.status) {
      conditions.push(eq(geoArticleBatches.status, query.status) as any);
    }

    const baseQuery = this.db
      .select({
        id: geoArticleBatches.id,
        brandId: geoArticleBatches.brandId,
        brandName: geoBrands.name,
        batchName: geoArticleBatches.batchName,
        articleType: geoArticleBatches.articleType,
        targetWordCount: geoArticleBatches.targetWordCount,
        totalCount: geoArticleBatches.totalCount,
        successCount: geoArticleBatches.successCount,
        failedCount: geoArticleBatches.failedCount,
        status: geoArticleBatches.status,
        totalCost: geoArticleBatches.totalCost,
        keywords: geoArticleBatches.keywords,
        creatorId: geoArticleBatches.creatorId,
        creatorName: geoUsers.displayName,
        error: geoArticleBatches.error,
        createdAt: geoArticleBatches.createdAt,
        updatedAt: geoArticleBatches.updatedAt,
      })
      .from(geoArticleBatches)
      .leftJoin(geoBrands, eq(geoArticleBatches.brandId, geoBrands.id))
      .leftJoin(geoUsers, eq(geoArticleBatches.creatorId, geoUsers.id));

    const dataQuery = conditions.length > 0
      ? baseQuery.where(and(...conditions))
      : baseQuery;

    const [itemsRaw, totalResult] = await Promise.all([
      dataQuery
        .orderBy(desc(geoArticleBatches.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db
        .select({ count: count() })
        .from(geoArticleBatches)
        .leftJoin(geoBrands, eq(geoArticleBatches.brandId, geoBrands.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined),
    ]);

    const items: ArticleBatch[] = itemsRaw.map((row) => ({
      id: row.id,
      brandId: row.brandId,
      brandName: row.brandName ?? '',
      batchName: row.batchName,
      articleType: row.articleType as ArticleBatch['articleType'],
      targetWordCount: row.targetWordCount,
      totalCount: row.totalCount,
      successCount: row.successCount,
      failedCount: row.failedCount,
      status: row.status as ArticleBatch['status'],
      totalCost: Number(row.totalCost),
      keywords: row.keywords ?? [],
      creatorId: row.creatorId,
      creatorName: row.creatorName ?? null,
      error: row.error ?? null,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    }));

    return { items, total: Number(totalResult[0]?.count ?? 0), page, pageSize };
  }

  async getBatchDetail(id: string, user: GeoUserCtx): Promise<ArticleBatch & { articles: Article[] }> {
    const rows = await this.db
      .select({
        id: geoArticleBatches.id,
        brandId: geoArticleBatches.brandId,
        brandName: geoBrands.name,
        batchName: geoArticleBatches.batchName,
        articleType: geoArticleBatches.articleType,
        targetWordCount: geoArticleBatches.targetWordCount,
        totalCount: geoArticleBatches.totalCount,
        successCount: geoArticleBatches.successCount,
        failedCount: geoArticleBatches.failedCount,
        status: geoArticleBatches.status,
        totalCost: geoArticleBatches.totalCost,
        keywords: geoArticleBatches.keywords,
        creatorId: geoArticleBatches.creatorId,
        creatorName: geoUsers.displayName,
        error: geoArticleBatches.error,
        createdAt: geoArticleBatches.createdAt,
        updatedAt: geoArticleBatches.updatedAt,
      })
      .from(geoArticleBatches)
      .leftJoin(geoBrands, eq(geoArticleBatches.brandId, geoBrands.id))
      .leftJoin(geoUsers, eq(geoArticleBatches.creatorId, geoUsers.id))
      .where(eq(geoArticleBatches.id, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('批次不存在');
    }

    const row = rows[0];
    const brandFilter = this.ensureCanReadBrand(user, row.brandId);
    if (brandFilter && row.brandId !== brandFilter) {
      throw new ForbiddenException('无权查看该批次');
    }

    // 查批次下的文章（取最近 50 篇）
    const articleRows = await this.db
      .select({
        id: geoArticles.id,
        brandId: geoArticles.brandId,
        brandName: geoBrands.name,
        title: geoArticles.title,
        articleType: geoArticles.articleType,
        wordCount: geoArticles.wordCount,
        keywords: geoArticles.keywords,
        longtailKeywords: geoArticles.longtailKeywords,
        status: geoArticles.status,
        batchId: geoArticles.batchId,
        coverImage: geoArticles.coverImage,
        costCredits: geoArticles.costCredits,
        creatorId: geoArticles.creatorId,
        creatorName: geoUsers.displayName,
        error: geoArticles.error,
        createdAt: geoArticles.createdAt,
        updatedAt: geoArticles.updatedAt,
      })
      .from(geoArticles)
      .leftJoin(geoBrands, eq(geoArticles.brandId, geoBrands.id))
      .leftJoin(geoUsers, eq(geoArticles.creatorId, geoUsers.id))
      .where(eq(geoArticles.batchId, id))
      .orderBy(desc(geoArticles.createdAt))
      .limit(50);

    const articles: Article[] = articleRows.map((ar) => ({
      id: ar.id,
      brandId: ar.brandId,
      brandName: ar.brandName ?? '',
      title: ar.title,
      content: '',
      articleType: ar.articleType as Article['articleType'],
      wordCount: ar.wordCount,
      keywords: ar.keywords ?? [],
      longtailKeywords: ar.longtailKeywords ?? [],
      status: ar.status as Article['status'],
      batchId: ar.batchId ?? null,
      coverImage: ar.coverImage ?? null,
      costCredits: Number(ar.costCredits),
      creatorId: ar.creatorId,
      creatorName: ar.creatorName ?? null,
      error: ar.error ?? null,
      createdAt: new Date(ar.createdAt).toISOString(),
      updatedAt: new Date(ar.updatedAt).toISOString(),
    }));

    return {
      id: row.id,
      brandId: row.brandId,
      brandName: row.brandName ?? '',
      batchName: row.batchName,
      articleType: row.articleType as ArticleBatch['articleType'],
      targetWordCount: row.targetWordCount,
      totalCount: row.totalCount,
      successCount: row.successCount,
      failedCount: row.failedCount,
      status: row.status as ArticleBatch['status'],
      totalCost: Number(row.totalCost),
      keywords: row.keywords ?? [],
      creatorId: row.creatorId,
      creatorName: row.creatorName ?? null,
      error: row.error ?? null,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
      articles,
    };
  }

  // ============================================================
  //  算力账户
  // ============================================================

  async getCreditAccount(brandId: string, user: GeoUserCtx): Promise<CreditAccount> {
    const brandFilter = this.ensureCanReadBrand(user, brandId);
    const targetBrandId = brandFilter ?? brandId;

    if (!targetBrandId) {
      throw new BadRequestException('brandId 不能为空');
    }

    const account = await this.getOrCreateCreditAccount(targetBrandId);

    return {
      brandId: account.brandId,
      balance: Number(account.balance),
      totalUsed: Number(account.totalUsed),
    };
  }

  async listCreditTransactions(
    query: CreditTransactionQueryDto,
    user: GeoUserCtx,
  ): Promise<PagedResponse<CreditTransaction>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const brandFilter = this.ensureCanReadBrand(user, query.brandId);

    const conditions: ReturnType<typeof eq>[] = [];
    if (brandFilter) {
      conditions.push(eq(geoCreditTransactions.brandId, brandFilter) as any);
    } else if (query.brandId) {
      conditions.push(eq(geoCreditTransactions.brandId, query.brandId) as any);
    }
    if (query.transactionType) {
      conditions.push(eq(geoCreditTransactions.transactionType, query.transactionType) as any);
    }

    const baseQuery = this.db
      .select()
      .from(geoCreditTransactions);

    const dataQuery = conditions.length > 0
      ? baseQuery.where(and(...conditions))
      : baseQuery;

    const [itemsRaw, totalResult] = await Promise.all([
      dataQuery
        .orderBy(desc(geoCreditTransactions.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db
        .select({ count: count() })
        .from(geoCreditTransactions)
        .where(conditions.length > 0 ? and(...conditions) : undefined),
    ]);

    const items: CreditTransaction[] = itemsRaw.map((row) => ({
      id: row.id,
      brandId: row.brandId,
      changeAmount: Number(row.changeAmount),
      balanceAfter: Number(row.balanceAfter),
      transactionType: row.transactionType as CreditTransaction['transactionType'],
      relatedType: row.relatedType ?? null,
      relatedId: row.relatedId ?? null,
      description: row.description ?? null,
      createdAt: new Date(row.createdAt).toISOString(),
    }));

    return { items, total: Number(totalResult[0]?.count ?? 0), page, pageSize };
  }

  // ============================================================
  //  图片生成
  // ============================================================

  async generateImage(
    dto: GenerateImageDto,
    user: GeoUserCtx,
  ): Promise<GenerateImageResponse> {
    this.ensureCanWrite(user, dto.brandId);

    const totalCredit = IMAGE_CREDIT_PER_IMAGE * dto.count;

    // 先扣算力
    await this.deductCredits(
      dto.brandId,
      totalCredit,
      'image_generate',
      'material',
      null,
      `生成 ${dto.count} 张${IMAGE_PURPOSE_LABELS[dto.imagePurpose]}（${IMAGE_STYLE_LABELS[dto.style]}）`,
      user.id,
    );

    let materialIds: string[] = [];
    let images: Array<{ id: string; url: string }> = [];

    try {
      // 优先尝试平台插件
      try {
        const result = await this.capabilityService.call('geo_image_generate_1', {
          image_subject: dto.prompt,
          image_type: IMAGE_PURPOSE_LABELS[dto.imagePurpose],
          style_requirements: IMAGE_STYLE_LABELS[dto.style],
          ratio: dto.ratio ?? '1:1',
        });

        const resultObj = result as { images?: Array<{ id: string; url: string }> };
        images = resultObj.images ?? [];
      } catch (pluginErr) {
        this.logger.warn(
          '平台生图插件不可用，尝试外部服务',
          pluginErr instanceof Error ? pluginErr.message : String(pluginErr),
        );
        // 插件不可用时降级到外部 API
        images = await this.generateImageViaExternalApi(dto);
      }

      if (images.length === 0) {
        throw new BadRequestException('图片生成失败，未返回图片');
      }

      // 保存到素材库
      if (dto.saveToLibrary) {
        const insertPromises = images.map((img: { id: string; url: string }, idx: number) =>
          this.db
            .insert(geoMaterials)
            .values({
              brandId: dto.brandId,
              materialType: 'image',
              name: `${IMAGE_PURPOSE_LABELS[dto.imagePurpose]}_${Date.now()}_${idx + 1}`,
              filePath: img.url, // 用 URL 暂存，后续可替换为文件存储
              bucketId: 'ai_generated',
              fileSize: 0,
              mimeType: 'image/jpeg',
              source: 'ai_generated',
              creatorId: user.id,
              purpose: dto.imagePurpose,
              imageStyle: dto.style,
              promptText: dto.prompt,
            })
            .returning({ id: geoMaterials.id })
        );

        const results = await Promise.all(insertPromises);
        materialIds = results.map((r: Array<{ id: string }>) => r[0].id);
      }
    } catch (err) {
      // 失败回退算力
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error('图片生成失败', errorMsg);

      try {
        await this.refundCredits(
          dto.brandId,
          totalCredit,
          'image_generate',
          null,
          null,
          `图片生成失败，算力退回`,
          user.id,
        );
      } catch (refundErr) {
        this.logger.error('算力回退失败', refundErr instanceof Error ? refundErr.message : String(refundErr));
      }

      throw err;
    }

    return {
      materialIds,
      images,
      costCredits: totalCredit,
    };
  }

  // ============================================================
  //  素材库
  // ============================================================

  async listMaterials(
    query: MaterialListQueryDto,
    user: GeoUserCtx,
  ): Promise<PagedResponse<Material>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const brandFilter = this.ensureCanReadBrand(user, query.brandId);

    const conditions: ReturnType<typeof eq>[] = [];
    if (brandFilter) {
      conditions.push(eq(geoMaterials.brandId, brandFilter) as any);
    } else if (query.brandId) {
      conditions.push(eq(geoMaterials.brandId, query.brandId) as any);
    }
    if (query.materialType) {
      conditions.push(eq(geoMaterials.materialType, query.materialType) as any);
    }
    if (query.groupId) {
      conditions.push(eq(geoMaterials.groupId, query.groupId) as any);
    }
    if (query.keyword) {
      conditions.push(ilike(geoMaterials.name, `%${query.keyword}%`) as any);
    }

    const baseQuery = this.db
      .select({
        id: geoMaterials.id,
        brandId: geoMaterials.brandId,
        groupId: geoMaterials.groupId,
        materialType: geoMaterials.materialType,
        name: geoMaterials.name,
        filePath: geoMaterials.filePath,
        bucketId: geoMaterials.bucketId,
        fileSize: geoMaterials.fileSize,
        mimeType: geoMaterials.mimeType,
        width: geoMaterials.width,
        height: geoMaterials.height,
        source: geoMaterials.source,
        sourceId: geoMaterials.sourceId,
        creatorId: geoMaterials.creatorId,
        creatorName: geoUsers.displayName,
        createdAt: geoMaterials.createdAt,
        purpose: geoMaterials.purpose,
        imageStyle: geoMaterials.imageStyle,
        promptText: geoMaterials.promptText,
      })
      .from(geoMaterials)
      .leftJoin(geoUsers, eq(geoMaterials.creatorId, geoUsers.id));

    const dataQuery = conditions.length > 0
      ? baseQuery.where(and(...conditions))
      : baseQuery;

    const [itemsRaw, totalResult] = await Promise.all([
      dataQuery
        .orderBy(desc(geoMaterials.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db
        .select({ count: count() })
        .from(geoMaterials)
        .where(conditions.length > 0 ? and(...conditions) : undefined),
    ]);

    const items: Material[] = itemsRaw.map((row) => ({
      id: row.id,
      brandId: row.brandId ?? null,
      groupId: row.groupId ?? null,
      materialType: row.materialType as Material['materialType'],
      name: row.name,
      fileUrl: row.filePath ?? null,
      fileSize: row.fileSize,
      mimeType: row.mimeType ?? null,
      width: row.width ?? null,
      height: row.height ?? null,
      source: row.source,
      sourceId: row.sourceId ?? null,
      creatorId: row.creatorId,
      creatorName: row.creatorName ?? null,
      createdAt: new Date(row.createdAt).toISOString(),
      purpose: (row.purpose as ImagePurpose | null) ?? null,
      imageStyle: (row.imageStyle as ImageStyle | null) ?? null,
      promptText: row.promptText ?? null,
      status: 'success' as MaterialStatus,
    }));

    return { items, total: Number(totalResult[0]?.count ?? 0), page, pageSize };
  }

  async listMaterialGroups(brandId: string, user: GeoUserCtx): Promise<MaterialGroup[]> {
    const brandFilter = this.ensureCanReadBrand(user, brandId);
    const targetBrandId = brandFilter ?? brandId;

    if (!targetBrandId) {
      return [];
    }

    const rows = await this.db
      .select()
      .from(geoMaterialGroups)
      .where(eq(geoMaterialGroups.brandId, targetBrandId))
      .orderBy(desc(geoMaterialGroups.createdAt));

    return rows.map((row) => ({
      id: row.id,
      brandId: row.brandId,
      name: row.name,
      groupType: row.groupType as MaterialGroup['groupType'],
    }));
  }

  async listMaterialGroupsByQuery(
    query: MaterialGroupListQueryDto,
    user: GeoUserCtx,
  ): Promise<MaterialGroup[]> {
    const brandFilter = this.ensureCanReadBrand(user, query.brandId);
    const targetBrandId = brandFilter ?? query.brandId;

    if (!targetBrandId) {
      return [];
    }

    const conditions: ReturnType<typeof eq>[] = [
      eq(geoMaterialGroups.brandId, targetBrandId) as any,
    ];
    if (query.materialType) {
      conditions.push(eq(geoMaterialGroups.groupType, query.materialType) as any);
    }

    const rows = await this.db
      .select()
      .from(geoMaterialGroups)
      .where(and(...conditions))
      .orderBy(desc(geoMaterialGroups.createdAt));

    return rows.map((row) => ({
      id: row.id,
      brandId: row.brandId,
      name: row.name,
      groupType: row.groupType as MaterialGroup['groupType'],
    }));
  }

  async createMaterialGroup(
    dto: CreateMaterialGroupDto,
    user: GeoUserCtx,
  ): Promise<MaterialGroup> {
    this.ensureCanWrite(user, dto.brandId);

    const inserted = await this.db
      .insert(geoMaterialGroups)
      .values({
        brandId: dto.brandId,
        name: dto.name,
        groupType: dto.groupType ?? 'image',
        creatorId: user.id,
      })
      .returning();

    const row = inserted[0];
    return {
      id: row.id,
      brandId: row.brandId,
      name: row.name,
      groupType: row.groupType as MaterialGroup['groupType'],
    };
  }

  async deleteMaterial(id: string, user: GeoUserCtx): Promise<void> {
    const existing = await this.db
      .select({ id: geoMaterials.id, brandId: geoMaterials.brandId })
      .from(geoMaterials)
      .where(eq(geoMaterials.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('素材不存在');
    }

    this.ensureCanWrite(user, existing[0].brandId);

    await this.db.delete(geoMaterials).where(eq(geoMaterials.id, id));
  }

  async updateMaterial(id: string, dto: UpdateMaterialDto, user: GeoUserCtx): Promise<Material> {
    const existingRows = await this.db
      .select({ id: geoMaterials.id, brandId: geoMaterials.brandId })
      .from(geoMaterials)
      .where(eq(geoMaterials.id, id))
      .limit(1);

    if (existingRows.length === 0) {
      throw new NotFoundException('素材不存在');
    }

    this.ensureCanWrite(user, existingRows[0].brandId);

    const patch: Partial<typeof geoMaterials.$inferInsert> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.groupId !== undefined) patch.groupId = dto.groupId;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    await this.db.update(geoMaterials).set(patch).where(eq(geoMaterials.id, id));

    // 返回更新后的素材
    const rows = await this.db
      .select({
        id: geoMaterials.id,
        brandId: geoMaterials.brandId,
        groupId: geoMaterials.groupId,
        materialType: geoMaterials.materialType,
        name: geoMaterials.name,
        filePath: geoMaterials.filePath,
        bucketId: geoMaterials.bucketId,
        fileSize: geoMaterials.fileSize,
        mimeType: geoMaterials.mimeType,
        width: geoMaterials.width,
        height: geoMaterials.height,
        source: geoMaterials.source,
        sourceId: geoMaterials.sourceId,
      creatorId: geoMaterials.creatorId,
      creatorName: geoUsers.displayName,
      createdAt: geoMaterials.createdAt,
      purpose: geoMaterials.purpose,
      imageStyle: geoMaterials.imageStyle,
      promptText: geoMaterials.promptText,
    })
    .from(geoMaterials)
    .leftJoin(geoUsers, eq(geoMaterials.creatorId, geoUsers.id))
    .where(eq(geoMaterials.id, id))
    .limit(1);

    const row = rows[0];
    return {
      id: row.id,
      brandId: row.brandId ?? null,
      groupId: row.groupId ?? null,
      materialType: row.materialType as Material['materialType'],
      name: row.name,
      fileUrl: row.filePath ?? null,
      fileSize: row.fileSize,
      mimeType: row.mimeType ?? null,
      width: row.width ?? null,
      height: row.height ?? null,
      source: row.source,
      sourceId: row.sourceId ?? null,
      creatorId: row.creatorId,
      creatorName: row.creatorName ?? null,
      createdAt: new Date(row.createdAt).toISOString(),
      purpose: (row.purpose as ImagePurpose | null) ?? null,
      imageStyle: (row.imageStyle as ImageStyle | null) ?? null,
      promptText: row.promptText ?? null,
      status: 'success' as MaterialStatus,
    };
  }

  async batchDeleteMaterials(dto: BatchDeleteMaterialsDto, user: GeoUserCtx): Promise<{ deleted: number }> {
    // 查出所有素材校验权限
    const materials = await this.db
      .select({ id: geoMaterials.id, brandId: geoMaterials.brandId })
      .from(geoMaterials)
      .where(inArray(geoMaterials.id, dto.ids));

    if (materials.length === 0) {
      return { deleted: 0 };
    }

    // client 角色不允许删除
    if (user.role === 'client') {
      throw new ForbiddenException('当前角色无删除权限');
    }

    // operator 只能删自己品牌的
    if (user.role === 'operator' && user.brandId) {
      const allOwnBrand = materials.every((m) => m.brandId === user.brandId);
      if (!allOwnBrand) {
        throw new ForbiddenException('只能操作所属品牌的素材');
      }
    }

    const toDelete = materials.map((m) => m.id);
    await this.db.delete(geoMaterials).where(inArray(geoMaterials.id, toDelete));
    return { deleted: toDelete.length };
  }

  async getMaterialDetail(id: string, user: GeoUserCtx): Promise<Material> {
    const brandFilter = this.ensureCanReadBrand(user, null);

    const conditions: ReturnType<typeof eq>[] = [eq(geoMaterials.id, id) as any];
    if (brandFilter) {
      conditions.push(eq(geoMaterials.brandId, brandFilter) as any);
    }

    const rows = await this.db
      .select({
        id: geoMaterials.id,
        brandId: geoMaterials.brandId,
        groupId: geoMaterials.groupId,
        materialType: geoMaterials.materialType,
        name: geoMaterials.name,
        filePath: geoMaterials.filePath,
        bucketId: geoMaterials.bucketId,
        fileSize: geoMaterials.fileSize,
        mimeType: geoMaterials.mimeType,
        width: geoMaterials.width,
        height: geoMaterials.height,
        source: geoMaterials.source,
        sourceId: geoMaterials.sourceId,
        creatorId: geoMaterials.creatorId,
        creatorName: geoUsers.displayName,
        createdAt: geoMaterials.createdAt,
        purpose: geoMaterials.purpose,
        imageStyle: geoMaterials.imageStyle,
        promptText: geoMaterials.promptText,
      })
      .from(geoMaterials)
      .leftJoin(geoUsers, eq(geoMaterials.creatorId, geoUsers.id))
      .where(and(...conditions))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('素材不存在');
    }

    const row = rows[0];
    return {
      id: row.id,
      brandId: row.brandId ?? null,
      groupId: row.groupId ?? null,
      materialType: row.materialType as Material['materialType'],
      name: row.name,
      fileUrl: row.filePath ?? null,
      fileSize: row.fileSize,
      mimeType: row.mimeType ?? null,
      width: row.width ?? null,
      height: row.height ?? null,
      source: row.source,
      sourceId: row.sourceId ?? null,
      creatorId: row.creatorId,
      creatorName: row.creatorName ?? null,
      createdAt: new Date(row.createdAt).toISOString(),
      purpose: (row.purpose as ImagePurpose | null) ?? null,
      imageStyle: (row.imageStyle as ImageStyle | null) ?? null,
      promptText: row.promptText ?? null,
      status: 'success' as MaterialStatus,
    };
  }

  async recordMaterial(dto: RecordMaterialDto, user: GeoUserCtx): Promise<Material> {
    this.ensureCanWrite(user, dto.brandId);

    const inserted = await this.db
      .insert(geoMaterials)
      .values({
        brandId: dto.brandId,
        groupId: dto.groupId ?? null,
        materialType: dto.materialType,
        name: dto.name,
        filePath: dto.filePath,
        bucketId: dto.bucketId,
        fileSize: dto.fileSize,
        mimeType: dto.mimeType ?? null,
        width: dto.width ?? null,
        height: dto.height ?? null,
        source: dto.source ?? 'upload',
        creatorId: user.id,
      })
      .returning();

    const row = inserted[0];
    return {
      id: row.id,
      brandId: row.brandId ?? null,
      groupId: row.groupId ?? null,
      materialType: row.materialType as Material['materialType'],
      name: row.name,
      fileUrl: row.filePath ?? null,
      fileSize: row.fileSize,
      mimeType: row.mimeType ?? null,
      width: row.width ?? null,
      height: row.height ?? null,
      source: row.source,
      sourceId: row.sourceId ?? null,
      creatorId: row.creatorId,
      creatorName: null,
      createdAt: new Date(row.createdAt).toISOString(),
      purpose: null,
      imageStyle: null,
      promptText: null,
      status: 'success' as MaterialStatus,
    };
  }

  async getMaterialUsage(
    brandIdParam: string | undefined,
    user: GeoUserCtx,
  ): Promise<MaterialUsageStats> {
    const brandFilter = this.ensureCanReadBrand(user, brandIdParam);
    const targetBrandId = brandFilter ?? brandIdParam;

    if (!targetBrandId) {
      return {
        totalCount: 0,
        totalSize: 0,
        imageCount: 0,
        videoCount: 0,
        documentCount: 0,
      };
    }

    const rows = await this.db
      .select({
        materialType: geoMaterials.materialType,
        count: count(),
        totalSize: sql<number>`COALESCE(SUM(${geoMaterials.fileSize}), 0)`,
      })
      .from(geoMaterials)
      .where(eq(geoMaterials.brandId, targetBrandId))
      .groupBy(geoMaterials.materialType);

    let totalCount = 0;
    let totalSize = 0;
    let imageCount = 0;
    let videoCount = 0;
    let documentCount = 0;

    for (const row of rows) {
      const cnt = Number(row.count);
      const size = Number(row.totalSize);
      totalCount += cnt;
      totalSize += size;
      if (row.materialType === 'image') imageCount = cnt;
      else if (row.materialType === 'video') videoCount = cnt;
      else if (row.materialType === 'document') documentCount = cnt;
    }

    return { totalCount, totalSize, imageCount, videoCount, documentCount };
  }

  // ============================================================
  //  视频脚本生成
  // ============================================================

  async generateVideoScript(
    dto: GenerateVideoScriptDto,
    user: GeoUserCtx,
  ): Promise<GenerateVideoScriptResponse> {
    this.ensureCanWrite(user, dto.brandId);

    // 先扣算力
    await this.deductCredits(
      dto.brandId,
      VIDEO_SCRIPT_CREDIT,
      'video_script',
      null,
      null,
      `生成短视频脚本（${dto.coreKeyword}）`,
      user.id,
    );

    try {
      const purpose = dto.purpose ?? '产品推广';
      const additionalReqs = `
请以 JSON 格式返回短视频脚本，结构如下：
{
  "hook": "开头钩子文案（15字以内）",
  "scenes": [
    {
      "sceneNumber": 1,
      "visualDescription": "画面描述",
      "voiceover": "旁白文案",
      "subtitle": "字幕文本",
      "duration": "3s",
      "imagePrompt": "对应画面的AI绘图提示词"
    }
  ],
  "totalDuration": "30s"
}
要求：共5-6个场景，总时长30-45秒，节奏紧凑，适合抖音/快手等短视频平台。
核心关键词：${dto.coreKeyword}
用途：${purpose}
`;

      const result = await this.aiChatWithFallback({
        content_topic: `${dto.coreKeyword} - 短视频脚本`,
        content_type: '短视频脚本',
        word_count: '500',
        additional_requirements: additionalReqs,
        user,
        brandId: dto.brandId,
      });

      const text = typeof result === 'string' ? result : String(result);

      // 尝试解析 JSON
      let parsed: { hook: string; scenes: VideoScriptScene[]; totalDuration: string } | null = null;

      // 提取 JSON 块
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          parsed = null;
        }
      }

      // 解析失败时用 mock 结构
      if (!parsed || !parsed.scenes || parsed.scenes.length === 0) {
        parsed = {
          hook: `${dto.coreKeyword}，你绝对想不到！`,
          totalDuration: '35s',
          scenes: [
            {
              sceneNumber: 1,
              visualDescription: `震撼开场，展示${dto.coreKeyword}的核心卖点`,
              voiceover: `${dto.coreKeyword}，你绝对想不到还有这种操作！`,
              subtitle: `${dto.coreKeyword}秘籍`,
              duration: '3s',
              imagePrompt: `${dto.coreKeyword}震撼开场画面`,
            },
            {
              sceneNumber: 2,
              visualDescription: `产品细节展示，突出${dto.coreKeyword}的特色`,
              voiceover: `今天给大家分享一个关于${dto.coreKeyword}的干货，记得点赞收藏！`,
              subtitle: `干货分享`,
              duration: '5s',
              imagePrompt: `${dto.coreKeyword}产品细节特写`,
            },
            {
              sceneNumber: 3,
              visualDescription: `使用场景演示`,
              voiceover: `${dto.coreKeyword}在日常生活中到底怎么用？看完你就明白了。`,
              subtitle: `使用场景`,
              duration: '8s',
              imagePrompt: `${dto.coreKeyword}使用场景`,
            },
            {
              sceneNumber: 4,
              visualDescription: `效果对比展示`,
              voiceover: `使用前后的对比，效果一目了然！`,
              subtitle: `效果对比`,
              duration: '6s',
              imagePrompt: `${dto.coreKeyword}效果对比图`,
            },
            {
              sceneNumber: 5,
              visualDescription: `用户评价/口碑展示`,
              voiceover: `已经有上万人亲测有效，好评率高达98%！`,
              subtitle: `用户好评`,
              duration: '5s',
              imagePrompt: `${dto.coreKeyword}用户好评展示`,
            },
            {
              sceneNumber: 6,
              visualDescription: `行动号召，引导关注`,
              voiceover: `想了解更多${dto.coreKeyword}的知识，记得关注我！`,
              subtitle: `关注不迷路`,
              duration: '4s',
              imagePrompt: `${dto.coreKeyword}行动号召画面`,
            },
          ],
        };
      }

      return {
        hook: parsed.hook,
        scenes: parsed.scenes,
        totalDuration: parsed.totalDuration,
        costCredits: VIDEO_SCRIPT_CREDIT,
      };
    } catch (err) {
      // 失败回退算力
      try {
        await this.refundCredits(
          dto.brandId,
          VIDEO_SCRIPT_CREDIT,
          'video_script',
          null,
          null,
          `视频脚本生成失败，算力退回`,
          user.id,
        );
      } catch (refundErr) {
        this.logger.error('算力回退失败', refundErr instanceof Error ? refundErr.message : String(refundErr));
      }
      throw err;
    }
  }

  // ============================================================
  //  视频生成任务
  // ============================================================

  async createVideoTask(
    dto: CreateVideoTaskDto,
    user: GeoUserCtx,
  ): Promise<VideoTaskDetail> {
    this.ensureCanWrite(user, dto.brandId);

    const inserted = await this.db
      .insert(geoVideoTasks)
      .values({
        brandId: dto.brandId,
        taskName: dto.taskName,
        topic: dto.topic,
        duration: dto.duration,
        ratio: dto.ratio,
        coverImage: dto.coverImage ?? null,
        status: 'pending',
        costCredits: '0',
        creatorId: user.id,
        purpose: dto.purpose ?? null,
        style: dto.style ?? null,
        scriptText: dto.scriptText ?? null,
      })
      .returning({ id: geoVideoTasks.id });

    return this.getVideoTaskDetail(inserted[0].id, user);
  }

  async listVideoTasks(
    query: VideoTaskListQueryDto,
    user: GeoUserCtx,
  ): Promise<PagedResponse<VideoTask>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const brandFilter = this.ensureCanReadBrand(user, query.brandId);

    const conditions: ReturnType<typeof eq>[] = [];
    if (brandFilter) {
      conditions.push(eq(geoVideoTasks.brandId, brandFilter) as any);
    } else if (query.brandId) {
      conditions.push(eq(geoVideoTasks.brandId, query.brandId) as any);
    }
    if (query.status) {
      conditions.push(eq(geoVideoTasks.status, query.status) as any);
    }
    if (query.purpose) {
      conditions.push(eq(geoVideoTasks.purpose, query.purpose) as any);
    }

    const baseQuery = this.db
      .select({
        id: geoVideoTasks.id,
        brandId: geoVideoTasks.brandId,
        brandName: geoBrands.name,
        taskName: geoVideoTasks.taskName,
        topic: geoVideoTasks.topic,
        duration: geoVideoTasks.duration,
        ratio: geoVideoTasks.ratio,
        coverImage: geoVideoTasks.coverImage,
        status: geoVideoTasks.status,
        externalTaskId: geoVideoTasks.externalTaskId,
        videoUrl: geoVideoTasks.videoUrl,
        videoCoverUrl: geoVideoTasks.videoCoverUrl,
        costCredits: geoVideoTasks.costCredits,
        error: geoVideoTasks.error,
        creatorId: geoVideoTasks.creatorId,
        creatorName: geoUsers.displayName,
        createdAt: geoVideoTasks.createdAt,
        updatedAt: geoVideoTasks.updatedAt,
        purpose: geoVideoTasks.purpose,
        style: geoVideoTasks.style,
        scriptText: geoVideoTasks.scriptText,
      })
      .from(geoVideoTasks)
      .leftJoin(geoBrands, eq(geoVideoTasks.brandId, geoBrands.id))
      .leftJoin(geoUsers, eq(geoVideoTasks.creatorId, geoUsers.id));

    const dataQuery = conditions.length > 0
      ? baseQuery.where(and(...conditions))
      : baseQuery;

    const [itemsRaw, totalResult] = await Promise.all([
      dataQuery
        .orderBy(desc(geoVideoTasks.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db
        .select({ count: count() })
        .from(geoVideoTasks)
        .leftJoin(geoBrands, eq(geoVideoTasks.brandId, geoBrands.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined),
    ]);

    const items: VideoTask[] = itemsRaw.map((row) => ({
      id: row.id,
      brandId: row.brandId,
      brandName: row.brandName ?? '',
      taskName: row.taskName,
      topic: row.topic,
      prompt: row.topic ?? '',
      duration: row.duration as VideoTask['duration'],
      ratio: row.ratio as VideoTask['ratio'],
      coverImage: row.coverImage ?? null,
      status: row.status as VideoTask['status'],
      externalTaskId: row.externalTaskId ?? null,
      videoUrl: row.videoUrl ?? null,
      videoCoverUrl: row.videoCoverUrl ?? null,
      costCredits: Number(row.costCredits),
      error: row.error ?? null,
      creatorId: row.creatorId,
      creatorName: row.creatorName ?? null,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
      purpose: (row.purpose as VideoTask['purpose']) ?? null,
      style: (row.style as VideoTask['style']) ?? null,
      scriptText: row.scriptText ?? null,
    }));

    return { items, total: Number(totalResult[0]?.count ?? 0), page, pageSize };
  }

  async getVideoTaskDetail(id: string, user: GeoUserCtx): Promise<VideoTaskDetail> {
    const rows = await this.db
      .select({
        id: geoVideoTasks.id,
        brandId: geoVideoTasks.brandId,
        brandName: geoBrands.name,
        taskName: geoVideoTasks.taskName,
        topic: geoVideoTasks.topic,
        duration: geoVideoTasks.duration,
        ratio: geoVideoTasks.ratio,
        coverImage: geoVideoTasks.coverImage,
        status: geoVideoTasks.status,
        externalTaskId: geoVideoTasks.externalTaskId,
        videoUrl: geoVideoTasks.videoUrl,
        videoCoverUrl: geoVideoTasks.videoCoverUrl,
        costCredits: geoVideoTasks.costCredits,
        error: geoVideoTasks.error,
        creatorId: geoVideoTasks.creatorId,
        creatorName: geoUsers.displayName,
        createdAt: geoVideoTasks.createdAt,
        updatedAt: geoVideoTasks.updatedAt,
        purpose: geoVideoTasks.purpose,
        style: geoVideoTasks.style,
        scriptText: geoVideoTasks.scriptText,
      })
      .from(geoVideoTasks)
      .leftJoin(geoBrands, eq(geoVideoTasks.brandId, geoBrands.id))
      .leftJoin(geoUsers, eq(geoVideoTasks.creatorId, geoUsers.id))
      .where(eq(geoVideoTasks.id, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('视频任务不存在');
    }

    const row = rows[0];
    const brandFilter = this.ensureCanReadBrand(user, row.brandId);
    if (brandFilter && row.brandId !== brandFilter) {
      throw new ForbiddenException('无权查看该视频任务');
    }

    return {
      id: row.id,
      brandId: row.brandId,
      brandName: row.brandName ?? '',
      taskName: row.taskName,
      topic: row.topic,
      prompt: row.topic ?? '',
      duration: row.duration as VideoTask['duration'],
      ratio: row.ratio as VideoTask['ratio'],
      coverImage: row.coverImage ?? null,
      status: row.status as VideoTask['status'],
      externalTaskId: row.externalTaskId ?? null,
      videoUrl: row.videoUrl ?? null,
      videoCoverUrl: row.videoCoverUrl ?? null,
      costCredits: Number(row.costCredits),
      error: row.error ?? null,
      creatorId: row.creatorId,
      creatorName: row.creatorName ?? null,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
      purpose: (row.purpose as VideoTaskDetail['purpose']) ?? null,
      style: (row.style as VideoTaskDetail['style']) ?? null,
      scriptText: row.scriptText ?? null,
    };
  }

  private async getActiveVideoServiceConfig():
    Promise<typeof geoVideoServiceConfig.$inferSelect | null> {
    const rows = await this.db
      .select()
      .from(geoVideoServiceConfig)
      .where(eq(geoVideoServiceConfig.status, 'active'))
      .limit(1);
    return rows[0] ?? null;
  }

  async submitVideoTask(
    id: string,
    user: GeoUserCtx,
  ): Promise<SubmitVideoTaskResult> {
    const task = await this.getVideoTaskDetail(id, user);
    this.ensureCanWrite(user, task.brandId);

    if (task.status !== 'pending' && task.status !== 'failed') {
      throw new BadRequestException(
        `当前状态 ${VIDEO_TASK_STATUS_LABELS[task.status]} 不可提交`,
      );
    }

    const config = await this.getActiveVideoServiceConfig();
    if (!config) {
      throw new BadRequestException('未配置视频生成服务，请联系管理员');
    }

    // 先扣算力
    await this.deductCredits(
      task.brandId,
      VIDEO_GENERATE_CREDIT,
      'video_generate',
      'video_task',
      id,
      `生成视频：${task.taskName}（${task.duration}）`,
      user.id,
    );

    try {
      const requestBody: Record<string, unknown> = {
        task_id: id,
        topic: task.topic,
        duration: task.duration,
        ratio: task.ratio,
      };
      if (task.coverImage) {
        requestBody.cover_url = task.coverImage;
      }

      const response = await firstValueFrom(
        this.httpService.post(
          config.apiUrl,
          requestBody,
          {
            headers: {
              Authorization: `Bearer ${config.apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 30000,
          },
        ),
      );

      const data = response.data as { task_id?: string; external_task_id?: string; status?: string };
      const externalTaskId = data.external_task_id ?? data.task_id ?? '';

      if (!externalTaskId) {
        throw new BadRequestException('外部服务未返回任务 ID');
      }

      await this.db
        .update(geoVideoTasks)
        .set({
          externalTaskId,
          status: 'generating',
          costCredits: VIDEO_GENERATE_CREDIT.toString(),
          error: null,
        })
        .where(eq(geoVideoTasks.id, id));

      return {
        taskId: id,
        externalTaskId,
        status: 'generating',
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`视频任务提交失败 taskId=${id}`, errorMsg);

      // 更新失败状态
      await this.db
        .update(geoVideoTasks)
        .set({
          status: 'failed',
          error: errorMsg,
        })
        .where(eq(geoVideoTasks.id, id));

      // 回退算力
      try {
        await this.refundCredits(
          task.brandId,
          VIDEO_GENERATE_CREDIT,
          'video_generate',
          'video_task',
          id,
          `视频生成提交失败，算力退回`,
          user.id,
        );
      } catch (refundErr) {
        this.logger.error('算力回退失败', refundErr instanceof Error ? refundErr.message : String(refundErr));
      }

      // 返回失败结果，不抛 500
      return {
        taskId: id,
        externalTaskId: '',
        status: 'failed',
      };
    }
  }

  /**
   * 检查视频生成服务是否已配置（供统一创作模块使用）
   */
  async isVideoServiceConfigured(): Promise<boolean> {
    const config = await this.getActiveVideoServiceConfig();
    return !!config;
  }

  /**
   * 直接提交外部视频生成任务（供统一创作模块使用）
   * 不在此处扣算力，调用方自行处理算力扣减与回退
   */
  async submitExternalVideoTask(params: {
    taskId: string;
    title: string;
    prompt: string;
    duration: string;
    ratio: string;
    resolution?: string;
    referenceImages?: string[];
    subtitleEnabled?: boolean;
    subtitleStyle?: string | null;
    voiceId?: string | null;
    voiceName?: string | null;
    bgmUrl?: string | null;
    bgmVolume?: number;
    originalAudioEnabled?: boolean;
  }): Promise<{ externalTaskId: string; success: boolean; error?: string }> {
    const config = await this.getActiveVideoServiceConfig();
    if (!config) {
      return { externalTaskId: '', success: false, error: '未配置视频生成服务' };
    }

    try {
      const requestBody: Record<string, unknown> = {
        task_id: params.taskId,
        topic: params.title,
        prompt: params.prompt,
        duration: params.duration,
        ratio: params.ratio,
      };
      if (params.resolution) {
        requestBody.resolution = params.resolution;
      }
      if (params.referenceImages && params.referenceImages.length > 0) {
        requestBody.reference_images = params.referenceImages;
      }
      if (params.subtitleEnabled !== undefined) {
        requestBody.subtitle_enabled = params.subtitleEnabled;
      }
      if (params.subtitleStyle !== undefined && params.subtitleStyle !== null) {
        requestBody.subtitle_style = params.subtitleStyle;
      }
      if (params.voiceId !== undefined && params.voiceId !== null) {
        requestBody.voice_id = params.voiceId;
      }
      if (params.voiceName !== undefined && params.voiceName !== null) {
        requestBody.voice_name = params.voiceName;
      }
      if (params.bgmUrl !== undefined && params.bgmUrl !== null) {
        requestBody.bgm_url = params.bgmUrl;
      }
      if (params.bgmVolume !== undefined) {
        requestBody.bgm_volume = params.bgmVolume;
      }
      if (params.originalAudioEnabled !== undefined) {
        requestBody.original_audio_enabled = params.originalAudioEnabled;
      }

      const response = await firstValueFrom(
        this.httpService.post(config.apiUrl, requestBody, {
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }),
      );

      const data = response.data as { task_id?: string; external_task_id?: string };
      const externalTaskId = data.external_task_id ?? data.task_id ?? '';

      if (!externalTaskId) {
        return { externalTaskId: '', success: false, error: '外部服务未返回任务 ID' };
      }

      return { externalTaskId, success: true };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error('外部视频任务提交失败', errorMsg);
      return { externalTaskId: '', success: false, error: errorMsg };
    }
  }

  /**
   * 轮询外部视频任务状态（仅调用外部服务，不更新数据库）
   */
  async pollExternalVideoTask(
    taskId: string,
    externalTaskId: string,
  ): Promise<{
    status: string;
    videoUrl?: string | null;
    coverUrl?: string | null;
    error?: string;
  }> {
    const config = await this.getActiveVideoServiceConfig();
    if (!config) {
      throw new BadRequestException('未配置视频生成服务');
    }

    const pollUrl = `${config.apiUrl.replace(/\/$/, '')}/${externalTaskId}`;
    const response = await firstValueFrom(
      this.httpService.get(pollUrl, {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
        },
        timeout: 30000,
      }),
    );

    const data = response.data as {
      status?: string;
      video_url?: string;
      cover_url?: string;
      error?: string;
    };

    return {
      status: data.status ?? 'unknown',
      videoUrl: data.video_url ?? null,
      coverUrl: data.cover_url ?? null,
      error: data.error,
    };
  }

  async pollVideoTask(
    id: string,
    user: GeoUserCtx,
  ): Promise<VideoTaskDetail> {
    const task = await this.getVideoTaskDetail(id, user);

    if (task.status === 'pending' || task.status === 'completed' || task.status === 'failed') {
      // 非生成中状态直接返回
      return task;
    }

    if (!task.externalTaskId) {
      throw new BadRequestException('任务未提交到外部服务');
    }

    const config = await this.getActiveVideoServiceConfig();
    if (!config) {
      throw new BadRequestException('未配置视频生成服务');
    }

    try {
      const pollUrl = `${config.apiUrl.replace(/\/$/, '')}/${task.externalTaskId}`;
      const response = await firstValueFrom(
        this.httpService.get(pollUrl, {
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
          },
          timeout: 30000,
        }),
      );

      const data = response.data as {
        status?: string;
        video_url?: string;
        cover_url?: string;
        error?: string;
      };
      const externalStatus = (data.status ?? '').toLowerCase();

      if (externalStatus === 'completed' || externalStatus === 'success') {
        await this.db
          .update(geoVideoTasks)
          .set({
            status: 'completed',
            videoUrl: data.video_url ?? null,
            videoCoverUrl: data.cover_url ?? null,
            error: null,
          })
          .where(eq(geoVideoTasks.id, id));
      } else if (externalStatus === 'failed' || externalStatus === 'error') {
        await this.db
          .update(geoVideoTasks)
          .set({
            status: 'failed',
            error: data.error ?? '视频生成失败',
          })
          .where(eq(geoVideoTasks.id, id));
      }
      // generating / processing 等中间状态不更新
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`轮询视频任务失败 taskId=${id}`, errorMsg);
      // 轮询失败不改变任务状态，继续等待下次轮询
    }

    return this.getVideoTaskDetail(id, user);
  }

  async deleteVideoTask(id: string, user: GeoUserCtx): Promise<void> {
    const existing = await this.db
      .select({ id: geoVideoTasks.id, brandId: geoVideoTasks.brandId })
      .from(geoVideoTasks)
      .where(eq(geoVideoTasks.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('视频任务不存在');
    }

    this.ensureCanWrite(user, existing[0].brandId);

    await this.db.delete(geoVideoTasks).where(eq(geoVideoTasks.id, id));
  }

  // ============================================================
  //  视频服务配置（admin only）
  // ============================================================

  private ensureAdmin(user: GeoUserCtx): void {
    if (user.role !== 'admin') {
      throw new ForbiddenException('仅管理员可访问');
    }
  }

  async getVideoServiceConfig(user: GeoUserCtx): Promise<VideoServiceConfig | null> {
    this.ensureAdmin(user);

    const rows = await this.db
      .select()
      .from(geoVideoServiceConfig)
      .limit(1);

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      id: row.id,
      apiUrl: row.apiUrl,
      apiKey: row.apiKey,
      model: row.model,
      callbackUrl: row.callbackUrl ?? null,
      status: row.status,
    };
  }

  async updateVideoServiceConfig(
    dto: VideoServiceConfigDto,
    user: GeoUserCtx,
  ): Promise<VideoServiceConfig> {
    this.ensureAdmin(user);

    const existing = await this.db
      .select()
      .from(geoVideoServiceConfig)
      .limit(1);

    if (existing.length > 0) {
      await this.db
        .update(geoVideoServiceConfig)
        .set({
          apiUrl: dto.apiUrl,
          apiKey: dto.apiKey,
          model: dto.model,
          callbackUrl: dto.callbackUrl ?? null,
        })
        .where(eq(geoVideoServiceConfig.id, existing[0].id));

      return this.getVideoServiceConfig(user) as Promise<VideoServiceConfig>;
    }

    const inserted = await this.db
      .insert(geoVideoServiceConfig)
      .values({
        apiUrl: dto.apiUrl,
        apiKey: dto.apiKey,
        model: dto.model,
        callbackUrl: dto.callbackUrl ?? null,
        status: 'active',
      })
      .returning();

    const row = inserted[0];
    return {
      id: row.id,
      apiUrl: row.apiUrl,
      apiKey: row.apiKey,
      model: row.model,
      callbackUrl: row.callbackUrl ?? null,
      status: row.status,
    };
  }

  async testVideoServiceConnection(user: GeoUserCtx): Promise<{ success: boolean; message: string }> {
    this.ensureAdmin(user);

    const config = await this.getActiveVideoServiceConfig();
    if (!config) {
      return { success: false, message: '未配置视频生成服务' };
    }

    try {
      await firstValueFrom(
        this.httpService.get(config.apiUrl, {
          headers: { Authorization: `Bearer ${config.apiKey}` },
          timeout: 10000,
        }),
      );
      return { success: true, message: '连接成功' };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `连接失败：${errorMsg}` };
    }
  }

  // ============================================================
  //  图片服务配置（admin only）
  // ============================================================

  async getImageServiceConfig(user: GeoUserCtx): Promise<ImageServiceConfig | null> {
    this.ensureAdmin(user);

    const rows = await this.db
      .select()
      .from(geoImageServiceConfig)
      .limit(1);

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      id: row.id,
      apiUrl: row.apiUrl,
      apiKey: row.apiKey,
      model: row.model,
      status: row.status,
    };
  }

  async updateImageServiceConfig(
    dto: ImageServiceConfigDto,
    user: GeoUserCtx,
  ): Promise<ImageServiceConfig> {
    this.ensureAdmin(user);

    const existing = await this.db
      .select()
      .from(geoImageServiceConfig)
      .limit(1);

    if (existing.length > 0) {
      await this.db
        .update(geoImageServiceConfig)
        .set({
          apiUrl: dto.apiUrl,
          apiKey: dto.apiKey,
          model: dto.model,
        })
        .where(eq(geoImageServiceConfig.id, existing[0].id));

      return this.getImageServiceConfig(user) as Promise<ImageServiceConfig>;
    }

    const inserted = await this.db
      .insert(geoImageServiceConfig)
      .values({
        apiUrl: dto.apiUrl,
        apiKey: dto.apiKey,
        model: dto.model,
        status: 'active',
      })
      .returning();

    const row = inserted[0];
    return {
      id: row.id,
      apiUrl: row.apiUrl,
      apiKey: row.apiKey,
      model: row.model,
      status: row.status,
    };
  }

  async testImageServiceConnection(user: GeoUserCtx): Promise<{ success: boolean; message: string }> {
    this.ensureAdmin(user);

    const rows = await this.db
      .select()
      .from(geoImageServiceConfig)
      .where(eq(geoImageServiceConfig.status, 'active'))
      .limit(1);

    if (rows.length === 0) {
      return { success: false, message: '未配置图片生成服务' };
    }

    const config = rows[0];
    try {
      await firstValueFrom(
        this.httpService.get(config.apiUrl, {
          headers: { Authorization: `Bearer ${config.apiKey}` },
          timeout: 10000,
        }),
      );
      return { success: true, message: '连接成功' };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `连接失败：${errorMsg}` };
    }
  }

  /**
   * 通过外部 API 生成图片（插件不可用时的降级方案）
   */
  private async generateImageViaExternalApi(
    dto: GenerateImageDto,
  ): Promise<Array<{ id: string; url: string }>> {
    const rows = await this.db
      .select()
      .from(geoImageServiceConfig)
      .where(eq(geoImageServiceConfig.status, 'active'))
      .limit(1);

    if (rows.length === 0) {
      throw new BadRequestException('未配置生图服务');
    }

    const config = rows[0];
    const response = await firstValueFrom(
      this.httpService.post(
        config.apiUrl,
        {
          prompt: dto.prompt,
          style: IMAGE_STYLE_LABELS[dto.style],
          ratio: dto.ratio ?? '1:1',
          count: dto.count,
          model: config.model,
        },
        {
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        },
      ),
    );

    const data = response.data as { images?: Array<{ id?: string; url?: string }> };
    const images = (data.images ?? []).map((img: { id?: string; url?: string }, idx: number) => ({
      id: img.id ?? `ext_${Date.now()}_${idx}`,
      url: img.url ?? '',
    })).filter((img: { id: string; url: string }) => img.url);

    if (images.length === 0) {
      throw new BadRequestException('外部图片服务未返回有效图片');
    }

    return images;
  }

  // ============================================================
  //  内容产出统计
  // ============================================================

  /**
   * 获取本周一 00:00 的 Date 对象
   */
  private getWeekStart(): Date {
    const now = new Date();
    const day = now.getDay(); // 0=周日, 1=周一
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  async getContentOverview(
    brandIdParam: string | undefined,
    user: GeoUserCtx,
  ): Promise<ContentOverviewStats> {
    const brandFilter = this.ensureCanReadBrand(user, brandIdParam);
    const targetBrandId = brandFilter ?? brandIdParam;

    if (!targetBrandId) {
      throw new BadRequestException('brandId 不能为空');
    }

    const weekStart = this.getWeekStart();
    const weekStartIso = weekStart.toISOString();

    const result = await this.db.execute(sql<{
      article_count: string;
      image_count: string;
      video_count: string;
      credit_used: string | null;
    }>`
      SELECT
        COALESCE(a.article_count, 0) AS article_count,
        COALESCE(i.image_count, 0) AS image_count,
        COALESCE(v.video_count, 0) AS video_count,
        c.credit_used AS credit_used
      FROM
        (SELECT COUNT(*) AS article_count
         FROM ${geoArticles}
         WHERE brand_id = ${targetBrandId}::uuid
           AND _created_at >= ${weekStartIso}::timestamptz) a,
        (SELECT COUNT(*) AS image_count
         FROM ${geoMaterials}
         WHERE brand_id = ${targetBrandId}::uuid
           AND source = 'ai_generated'
           AND _created_at >= ${weekStartIso}::timestamptz) i,
        (SELECT COUNT(*) AS video_count
         FROM ${geoVideoTasks}
         WHERE brand_id = ${targetBrandId}::uuid
           AND status = 'completed'
           AND _updated_at >= ${weekStartIso}::timestamptz) v,
        (SELECT SUM(ABS(change_amount)) AS credit_used
         FROM ${geoCreditTransactions}
         WHERE brand_id = ${targetBrandId}::uuid
           AND change_amount < 0
           AND _created_at >= ${weekStartIso}::timestamptz) c
    `);

    const row = result[0];
    return {
      articleCount: Number(row?.article_count ?? 0),
      imageCount: Number(row?.image_count ?? 0),
      videoCount: Number(row?.video_count ?? 0),
      creditUsed: Number(row?.credit_used ?? 0),
    };
  }
}
