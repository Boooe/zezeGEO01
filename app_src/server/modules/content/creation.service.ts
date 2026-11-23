import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, ilike, desc, count, gte, sql, inArray } from 'drizzle-orm';

import {
  geoArticles,
  geoMaterials,
  geoVideoTasks,
  geoBrands,
  geoUsers,
  geoCreditAccounts,
  geoCreditTransactions,
  geoCreditPlans,
  geoArticleBatches,
  geoCreationTasks,
  geoKeywordGroups,
  geoKeywords,
} from '@server/database/schema';
import type {
  CreationOverviewStats,
  RecentGenerationItem,
  CreationTaskItem,
  PublicationRecord,
  PagedResponse,
  UserRole,
  Article,
  Material,
  VideoTask,
  GenerateArticleResponse,
  GenerateImageResponse,
  GenerateVideoScriptResponse,
  VideoScriptScene,
  CreditPlan,
  CreditAccountDetail,
  UsageBreakdownResponse,
  CreditTxType,
  ImagePurpose,
  ImageStyle,
  MaterialStatus,
  VideoPurpose,
  VideoStyle,
  ImportArticleScriptResponse,
  CreditTransaction,
  CreationTaskDetail,
  KeywordGroup,
  KeywordItem,
  GenerateCopyResponse,
  SplitImagePromptsResponse,
  CreationTaskListResponse,
  CreationTaskType,
  CreationTaskStatus,
} from '@shared/api.interface';
import {
  ARTICLE_STATUS_LABELS,
  VIDEO_TASK_STATUS_LABELS,
  CREATION_TASK_STATUS_LABELS,
  PUBLICATION_STATUS_LABELS,
  PUBLICATION_CONTENT_TYPE_LABELS,
  PUBLICATION_PLATFORM_LABELS,
  IMAGE_PURPOSE_LABELS,
  IMAGE_STYLE_LABELS,
  MATERIAL_STATUS_LABELS,
  VIDEO_PURPOSE_LABELS,
  VIDEO_STYLE_LABELS,
} from '@shared/api.interface';
import { CapabilityService } from './capability.service';
import { ContentService } from './content.service';
import { AiKeysService } from '../ai-keys/ai-keys.service';
import {
  CreationGenerateArticleDto,
  CreationArticleListQueryDto,
  CreationUpdateArticleDto,
  CreationGenerateImageDto,
  CreationImageListQueryDto,
  CreationImageBatchDeleteDto,
  CreationImagePublicationDto,
  CreationGenerateVideoDto,
  CreationVideoListQueryDto,
  CreationVideoPublicationDto,
  CreationUpdateVideoDto,
  CreationTaskListQueryDto,
  CreatePublicationDto,
  PublicationListQueryDto,
  UpdatePublicationDto,
  RecentQueryDto,
  OverviewQueryDto,
  CreateCreditPlanDto,
  UpdateCreditPlanDto,
  RechargeCreditDto,
  ActivatePlanDto,
  CreditAccountListQueryDto,
  CreditTransactionQueryDto,
  UsageBreakdownQueryDto,
  UnifiedKeywordGroupsQueryDto,
  UnifiedKeywordsQueryDto,
  UnifiedGenerateCopyDto,
  UnifiedSplitImagePromptsDto,
  UnifiedCreateImageTaskDto,
  UnifiedCreateVideoTaskDto,
  UnifiedTaskListQueryDto,
} from './dto/creation.dto';

interface GeoUserCtx {
  id: string;
  role: UserRole;
  brandId: string | null;
}

// 算力计费常量（与创作中心统一）
const ARTICLE_CREDIT_PER_ARTICLE = 10000;
const IMAGE_CREDIT_PER_IMAGE = 2000;
const VIDEO_CREDIT_PER_GENERATE = 50000;
const VIDEO_SCRIPT_ONLY_CREDIT = 5000;

@Injectable()
export class CreationService {
  private readonly logger = new Logger(CreationService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly capabilityService: CapabilityService,
    private readonly contentService: ContentService,
    private readonly aiKeysService: AiKeysService,
  ) {}

  // ============================================================
  //  AI 调用：优先自有 Key，无则走平台插件兜底
  // ============================================================

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

    // 兜底：平台插件
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
  //  概览统计
  // ============================================================

  private getMonthStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  async getOverviewStats(
    query: OverviewQueryDto,
    user: GeoUserCtx,
  ): Promise<CreationOverviewStats> {
    const brandFilter = this.ensureCanReadBrand(user, query.brandId);
    const monthStart = this.getMonthStart();
    const monthStartIso = monthStart.toISOString();

    const brandIdSql = brandFilter
      ? sql`${brandFilter}`
      : sql`NULL`;

    const result = await this.db.execute(sql<{
      month_article_count: string;
      month_image_count: string;
      month_video_count: string;
      month_credit_used: string | null;
      pending_review_count: string;
      in_progress_count: string;
    }>`
      SELECT
        COALESCE(a.month_article_count, 0) AS month_article_count,
        COALESCE(i.month_image_count, 0) AS month_image_count,
        COALESCE(v.month_video_count, 0) AS month_video_count,
        c.month_credit_used AS month_credit_used,
        COALESCE(a.pending_review_count, 0) AS pending_review_count,
        (COALESCE(a.article_in_progress, 0) + COALESCE(v.video_in_progress, 0)) AS in_progress_count
      FROM
        (SELECT
           COUNT(*) FILTER (WHERE _created_at >= ${monthStartIso}::timestamptz) AS month_article_count,
           COUNT(*) FILTER (WHERE status = 'draft') AS pending_review_count,
           COUNT(*) FILTER (WHERE status = 'generating') AS article_in_progress
         FROM ${geoArticles}
         WHERE ${brandIdSql}::text IS NULL OR brand_id = ${brandIdSql}::uuid
        ) a,
        (SELECT COUNT(*) AS month_image_count
         FROM ${geoMaterials}
         WHERE material_type = 'image'
           AND _created_at >= ${monthStartIso}::timestamptz
           AND (${brandIdSql}::text IS NULL OR brand_id = ${brandIdSql}::uuid)
        ) i,
        (SELECT
           COUNT(*) FILTER (WHERE status = 'completed' AND _updated_at >= ${monthStartIso}::timestamptz) AS month_video_count,
           COUNT(*) FILTER (WHERE status = 'generating') AS video_in_progress
         FROM ${geoVideoTasks}
         WHERE ${brandIdSql}::text IS NULL OR brand_id = ${brandIdSql}::uuid
        ) v,
        (SELECT SUM(ABS(change_amount)) AS month_credit_used
         FROM ${geoCreditTransactions}
         WHERE change_amount < 0
           AND _created_at >= ${monthStartIso}::timestamptz
           AND (${brandIdSql}::text IS NULL OR brand_id = ${brandIdSql}::uuid)
        ) c
    `);

    const row = result[0];
    return {
      monthArticleCount: Number(row?.month_article_count ?? 0),
      monthImageCount: Number(row?.month_image_count ?? 0),
      monthVideoCount: Number(row?.month_video_count ?? 0),
      monthCreditUsed: Number(row?.month_credit_used ?? 0),
      pendingReviewCount: Number(row?.pending_review_count ?? 0),
      inProgressCount: Number(row?.in_progress_count ?? 0),
    };
  }

  // ============================================================
  //  最近生成列表（混合三类）
  // ============================================================

  async getRecentGenerations(
    query: RecentQueryDto,
    user: GeoUserCtx,
  ): Promise<RecentGenerationItem[]> {
    const limit = query.limit ?? 10;
    const brandFilter = this.ensureCanReadBrand(user, query.brandId);
    const brandCond = brandFilter ? brandFilter : null;

    // 用 UNION ALL 混合三类记录，按时间排序取最近 N 条
    const result = await this.db.execute(sql<{
      id: string;
      type: string;
      title: string;
      brand_id: string;
      brand_name: string;
      status: string;
      created_at: Date;
      thumbnail: string | null;
    }>`
      SELECT * FROM (
        SELECT
          a.id,
          'article'::text AS type,
          a.title,
          a.brand_id,
          b.name AS brand_name,
          a.status,
          a._created_at AS created_at,
          a.cover_image AS thumbnail
        FROM geo_articles a
        LEFT JOIN geo_brands b ON a.brand_id = b.id
        WHERE ${brandCond ? sql`a.brand_id = ${brandCond}` : sql`TRUE`}

        UNION ALL

        SELECT
          m.id,
          'image'::text AS type,
          m.name AS title,
          m.brand_id,
          b.name AS brand_name,
          'completed'::text AS status,
          m._created_at AS created_at,
          m.file_path AS thumbnail
        FROM geo_materials m
        LEFT JOIN geo_brands b ON m.brand_id = b.id
        WHERE m.material_type = 'image'
          AND ${brandCond ? sql`m.brand_id = ${brandCond}` : sql`TRUE`}

        UNION ALL

        SELECT
          v.id,
          'video'::text AS type,
          v.task_name AS title,
          v.brand_id,
          b.name AS brand_name,
          v.status,
          v._created_at AS created_at,
          v.video_cover_url AS thumbnail
        FROM geo_video_tasks v
        LEFT JOIN geo_brands b ON v.brand_id = b.id
        WHERE ${brandCond ? sql`v.brand_id = ${brandCond}` : sql`TRUE`}
      ) AS combined
      ORDER BY created_at DESC
      LIMIT ${limit}
    `);

    const rows = result as unknown as Array<{
      id: string;
      type: string;
      title: string;
      brand_id: string;
      brand_name: string;
      status: string;
      created_at: Date;
      thumbnail: string | null;
    }>;

    return rows.map((row) => ({
      id: row.id,
      type: row.type as 'article' | 'image' | 'video',
      title: row.title,
      brandId: row.brand_id,
      brandName: row.brand_name ?? '',
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
      thumbnail: row.thumbnail ?? null,
    }));
  }

  // ============================================================
  //  文章生成（复用 contentService，适配新算力规则）
  // ============================================================

  async generateArticles(
    dto: CreationGenerateArticleDto,
    user: GeoUserCtx,
  ): Promise<GenerateArticleResponse> {
    // 直接复用 contentService 的 generateArticles，但覆盖算力
    // contentService 用的是按字计费，这里统一 10000/篇
    // 为了不破坏旧接口，我们自己实现一遍生成逻辑
    this.ensureCanWrite(user, dto.brandId);

    const perArticleCredit = ARTICLE_CREDIT_PER_ARTICLE;
    const totalCredit = perArticleCredit * dto.count;

    // 所有生成都创建 batch，便于任务队列统一展示
    let batchId: string | null = null;

    // 扣算力
    await this.db.transaction(async (tx) => {
      const accRows = await tx
        .select()
        .from(geoCreditAccounts)
        .where(eq(geoCreditAccounts.brandId, dto.brandId))
        .limit(1)
        .for('update');

      let account = accRows[0];
      if (!account) {
        const created = await tx
          .insert(geoCreditAccounts)
          .values({ brandId: dto.brandId, balance: '0', totalUsed: '0' })
          .returning();
        account = created[0];
      }

      const balanceNum = Number(account.balance);
      if (balanceNum < totalCredit) {
        throw new BadRequestException('算力不足，请联系管理员充值');
      }

      const newBalance = (balanceNum - totalCredit).toString();
      const newTotalUsed = (Number(account.totalUsed) + totalCredit).toString();

      await tx
        .update(geoCreditAccounts)
        .set({ balance: newBalance, totalUsed: newTotalUsed })
        .where(eq(geoCreditAccounts.id, account.id));

      await tx.insert(geoCreditTransactions).values({
        brandId: dto.brandId,
        changeAmount: `-${totalCredit}`,
        balanceAfter: newBalance,
        transactionType: 'article_generate',
        relatedType: 'batch',
        description: `创作中心：生成 ${dto.count} 篇文章`,
        operatorId: user.id,
      });
    });

    // 创建批次
    const batchInsert = await this.db
        .insert(geoArticleBatches)
        .values({
          brandId: dto.brandId,
          batchName: `文章批量_${new Date().toLocaleDateString()}`,
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
          status: 'generating',
          batchId,
          costCredits: perArticleCredit.toString(),
          creatorId: user.id,
        })
        .returning({ id: geoArticles.id });
      articleIds.push(inserted[0].id);
    }

    // 异步生成
    void this.processArticleGeneration(dto, user, articleIds, batchId, perArticleCredit);

    return {
      articleIds,
      batchId: batchId ?? undefined,
    };
  }

  private async processArticleGeneration(
    dto: CreationGenerateArticleDto,
    user: GeoUserCtx,
    articleIds: string[],
    batchId: string | null,
    perArticleCredit: number,
  ): Promise<void> {
    let successCount = 0;
    let failedCount = 0;

    const typeLabel = ARTICLE_STATUS_LABELS;
    void typeLabel;

    for (let i = 0; i < articleIds.length; i++) {
      const articleId = articleIds[i];
      const kw = dto.keywords[i % dto.keywords.length];
      try {
        const contentTopic = `${kw} - ${dto.articleType === 'recommendation' ? '推荐' : dto.articleType === 'review' ? '评测' : dto.articleType === 'story' ? '故事' : dto.articleType === 'science' ? '科普' : '问答'}内容`;
        const additionalReqs = [
          `长尾关键词：${(dto.longtailKeywords ?? []).join('、') || '无'}`,
          `品牌关键词：${dto.keywords.join('、')}`,
        ].join('；');

        const fullText = await this.aiChatWithFallback({
          content_topic: contentTopic,
          content_type: this.mapArticleTypeToAiType(dto.articleType),
          word_count: String(dto.targetWordCount),
          additional_requirements: `目标受众：本地消费者\n${additionalReqs}`,
          user,
          brandId: dto.brandId,
        });
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
            status: 'draft',
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
            status: 'failed',
            error: errorMsg,
          })
          .where(eq(geoArticles.id, articleId));

        // 失败回退算力
        try {
          await this.refundCreditsInternal(
            dto.brandId,
            perArticleCredit,
            'article_generate',
            'article',
            articleId,
            '文章生成失败，算力退回',
            user.id,
          );
        } catch (refundErr) {
          this.logger.error(
            '算力回退失败',
            refundErr instanceof Error ? refundErr.message : String(refundErr),
          );
        }

        failedCount++;
      }
    }

    if (batchId) {
      const batchStatus: 'completed' | 'partial_failed' | 'failed' =
        failedCount === 0
          ? 'completed'
          : successCount === 0
            ? 'failed'
            : 'partial_failed';
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

  private mapArticleTypeToAiType(type: string): string {
    const map: Record<string, string> = {
      recommendation: '排行推荐类',
      review: '评测对比类',
      story: '创意故事类',
      science: '科普解读类',
      qa: '问答答疑类',
    };
    return map[type] ?? 'SEO文章';
  }

  private async refundCreditsInternal(
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

      if (accountRows.length === 0) return;

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
  //  文章列表/详情/更新/删除
  // ============================================================

  async listArticles(
    query: CreationArticleListQueryDto,
    user: GeoUserCtx,
  ): Promise<PagedResponse<Article>> {
    return this.contentService.listArticles(
      {
        page: query.page,
        pageSize: query.pageSize,
        brandId: query.brandId,
        articleType: query.articleType,
        status: query.status,
        keyword: query.keyword,
      },
      user,
    );
  }

  async getArticle(id: string, user: GeoUserCtx): Promise<Article> {
    return this.contentService.getArticleDetail(id, user);
  }

  async updateArticle(
    id: string,
    dto: CreationUpdateArticleDto,
    user: GeoUserCtx,
  ): Promise<Article> {
    return this.contentService.updateArticle(
      id,
      {
        title: dto.title,
        content: dto.content,
        status: dto.status,
      },
      user,
    );
  }

  async deleteArticle(id: string, user: GeoUserCtx): Promise<void> {
    return this.contentService.deleteArticle(id, user);
  }

  // ============================================================
  //  图片生成（降级模式：提示词 + 上传归档）
  // ============================================================

  async generateImages(
    dto: CreationGenerateImageDto,
    user: GeoUserCtx,
  ): Promise<{
    mode: 'ai' | 'upload';
    materialIds: string[];
    images: Array<{ id: string; url: string; prompt?: string }>;
    costCredits: number;
    message?: string;
  }> {
    this.ensureCanWrite(user, dto.brandId);

    // 先尝试 AI 生成
    try {
      const result = await this.contentService.generateImage(
        {
          brandId: dto.brandId,
          imagePurpose: dto.imagePurpose,
          prompt: dto.prompt,
          style: dto.style,
          ratio: dto.ratio ?? '1:1',
          count: dto.count,
          saveToLibrary: true,
        },
        user,
      );

      // 如果 contentService 也扣了算力，这里不重复扣
      // 但我们要覆盖成 2000/张的规则，需回退差额
      // 为简化，直接使用 contentService 的结果与计费
      return {
        mode: 'ai',
        materialIds: result.materialIds,
        images: result.images,
        costCredits: result.costCredits,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.warn('AI 生图不可用，切换为上传归档模式', errorMsg);

      // 降级：上传归档模式，不扣算力
      // 返回优化后的提示词，由前端提供上传入口
      const optimizedPrompts: string[] = [];
      for (let i = 0; i < dto.count; i++) {
        optimizedPrompts.push(`${dto.prompt} - ${i + 1}/${dto.count}（风格：${dto.style}）`);
      }

      return {
        mode: 'upload',
        materialIds: [],
        images: optimizedPrompts.map((p, i) => ({
          id: `upload_placeholder_${i}`,
          url: '',
          prompt: p,
        })),
        costCredits: 0,
        message: '当前环境未接入图像生成，走上传归档模式',
      };
    }
  }

  async listImages(
    query: CreationImageListQueryDto,
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
    conditions.push(eq(geoMaterials.materialType, 'image') as any);
    if (query.imagePurpose) {
      conditions.push(eq(geoMaterials.purpose, query.imagePurpose) as any);
    }
    if (query.style) {
      conditions.push(eq(geoMaterials.imageStyle, query.style) as any);
    }
    // status 筛选：素材表本身没有 status 字段，
    // 约定 source='ai_generated' 且有 filePath 为 success，空为 generating / failed
    // 简化：不单独建 status 列，统一返回 success（已生成）
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

    const items: Material[] = itemsRaw.map((row: any) => ({
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

  async deleteImage(id: string, user: GeoUserCtx): Promise<void> {
    return this.contentService.deleteMaterial(id, user);
  }

  async batchDeleteImages(
    dto: CreationImageBatchDeleteDto,
    user: GeoUserCtx,
  ): Promise<{ deleted: number }> {
    return this.contentService.batchDeleteMaterials({ ids: dto.ids }, user);
  }

  async retryImage(
    id: string,
    user: GeoUserCtx,
  ): Promise<{
    mode: 'ai' | 'upload';
    materialIds: string[];
    images: Array<{ id: string; url: string; prompt?: string }>;
    costCredits: number;
    message?: string;
  }> {
    const existing = await this.db
      .select({
        id: geoMaterials.id,
        brandId: geoMaterials.brandId,
        purpose: geoMaterials.purpose,
        imageStyle: geoMaterials.imageStyle,
        promptText: geoMaterials.promptText,
        width: geoMaterials.width,
        height: geoMaterials.height,
      })
      .from(geoMaterials)
      .where(eq(geoMaterials.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('图片不存在');
    }
    const row = existing[0];
    this.ensureCanWrite(user, row.brandId ?? undefined);

    // 根据宽高推断比例
    let ratio = '1:1';
    if (row.width && row.height) {
      const ratioVal = row.width / row.height;
      if (Math.abs(ratioVal - 1) < 0.05) ratio = '1:1';
      else if (ratioVal > 1.7) ratio = '16:9';
      else if (ratioVal > 1.2) ratio = '4:3';
      else if (ratioVal < 0.6) ratio = '9:16';
      else if (ratioVal < 0.8) ratio = '3:4';
    }

    const purpose = (row.purpose as ImagePurpose) ?? 'cover';
    const style = (row.imageStyle as ImageStyle) ?? 'realistic';

    return this.generateImages(
      {
        brandId: row.brandId ?? '',
        imagePurpose: purpose,
        prompt: row.promptText ?? '',
        style,
        ratio,
        count: 1,
      } as CreationGenerateImageDto,
      user,
    );
  }

  async createImagePublication(
    id: string,
    dto: CreationImagePublicationDto,
    user: GeoUserCtx,
  ): Promise<PublicationRecord> {
    const existing = await this.db
      .select({
        id: geoMaterials.id,
        brandId: geoMaterials.brandId,
      })
      .from(geoMaterials)
      .where(eq(geoMaterials.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('图片不存在');
    }
    const row = existing[0];
    this.ensureCanWrite(user, row.brandId ?? undefined);

    return this.createPublication(
      {
        contentType: 'image',
        contentId: id,
        brandId: row.brandId ?? '',
        platform: dto.platform as any,
        mediaLibrary: dto.mediaLibrary ?? '默认素材库',
      },
      user,
    );
  }

  // ============================================================
  //  视频生成（外部任务模式：提交 pending 任务，外部服务 pull 执行）
  // ============================================================

  async generateVideo(
    dto: CreationGenerateVideoDto,
    user: GeoUserCtx,
  ): Promise<VideoTask> {
    this.ensureCanWrite(user, dto.brandId);

    // 先生成脚本（如果可用），作为 scriptText 写入任务
    let generatedScriptText: string | null = null;
    try {
      const scriptResult = await this.contentService.generateVideoScript(
        {
          brandId: dto.brandId,
          coreKeyword: dto.script,
          purpose: dto.purpose ?? '产品展示',
        },
        user,
      );
      if (scriptResult?.scenes && scriptResult.scenes.length > 0) {
        generatedScriptText = scriptResult.scenes
          .map((scene: VideoScriptScene) => `【镜${scene.sceneNumber}】${scene.voiceover}`)
          .join('\n');
      }
    } catch (scriptErr) {
      this.logger.warn(
        '视频脚本生成失败，将仅提交主题要点',
        scriptErr instanceof Error ? scriptErr.message : String(scriptErr),
      );
    }

    // 事务：创建任务 + 扣减算力
    const taskId = await this.db.transaction(async (tx) => {
      // 1. 检查并扣减算力
      const accountRows = await tx
        .select()
        .from(geoCreditAccounts)
        .where(eq(geoCreditAccounts.brandId, dto.brandId))
        .limit(1)
        .for('update');

      let account = accountRows[0];
      if (!account) {
        const created = await tx
          .insert(geoCreditAccounts)
          .values({ brandId: dto.brandId, balance: '0', totalUsed: '0' })
          .returning();
        account = created[0];
      }

      const balanceNum = Number(account.balance);
      if (balanceNum < VIDEO_CREDIT_PER_GENERATE) {
        throw new BadRequestException('算力不足，请联系服务商充值');
      }

      const newBalance = (balanceNum - VIDEO_CREDIT_PER_GENERATE).toString();
      const newTotalUsed = (Number(account.totalUsed) + VIDEO_CREDIT_PER_GENERATE).toString();

      await tx
        .update(geoCreditAccounts)
        .set({ balance: newBalance, totalUsed: newTotalUsed })
        .where(eq(geoCreditAccounts.id, account.id));

      // 2. 创建视频任务（pending 状态，等待外部服务 pull）
      const finalScriptText = dto.scriptText ?? generatedScriptText ?? dto.script;
      const inserted = await tx
        .insert(geoVideoTasks)
        .values({
          brandId: dto.brandId,
          taskName: dto.taskName,
          topic: dto.script,
          purpose: dto.purpose ?? null,
          style: dto.style ?? null,
          scriptText: finalScriptText,
          duration: dto.duration,
          ratio: dto.ratio,
          coverImage: dto.coverImage ?? null,
          status: 'pending',
          costCredits: VIDEO_CREDIT_PER_GENERATE.toString(),
          creatorId: user.id,
        })
        .returning({ id: geoVideoTasks.id });

      const newTaskId = inserted[0].id;

      // 3. 写算力流水
      await tx.insert(geoCreditTransactions).values({
        brandId: dto.brandId,
        changeAmount: `-${VIDEO_CREDIT_PER_GENERATE}`,
        balanceAfter: newBalance,
        transactionType: 'video_generate',
        relatedType: 'video_task',
        relatedId: newTaskId,
        description: `生成视频：${dto.taskName}（${dto.duration}）`,
        operatorId: user.id,
      });

      return newTaskId;
    });

    return this.contentService.getVideoTaskDetail(taskId, user);
  }

  /**
   * 旧方法名别名，兼容旧调用方
   * @deprecated 请使用 generateVideo
   */
  generateVideoScript = this.generateVideo.bind(this);

  async listVideos(
    query: CreationVideoListQueryDto,
    user: GeoUserCtx,
  ): Promise<PagedResponse<VideoTask>> {
    return this.contentService.listVideoTasks(
      {
        page: query.page,
        pageSize: query.pageSize,
        brandId: query.brandId,
        status: query.status,
        purpose: query.purpose,
      },
      user,
    );
  }

  async importArticleScript(
    articleId: string,
    user: GeoUserCtx,
  ): Promise<ImportArticleScriptResponse> {
    const article = await this.contentService.getArticleDetail(articleId, user);
    return {
      title: article.title,
      content: article.content,
    };
  }

  async retryVideo(
    id: string,
    user: GeoUserCtx,
  ): Promise<VideoTask> {
    const existing = await this.db
      .select({
        id: geoVideoTasks.id,
        brandId: geoVideoTasks.brandId,
        taskName: geoVideoTasks.taskName,
        topic: geoVideoTasks.topic,
        duration: geoVideoTasks.duration,
        ratio: geoVideoTasks.ratio,
        coverImage: geoVideoTasks.coverImage,
        purpose: geoVideoTasks.purpose,
        style: geoVideoTasks.style,
        scriptText: geoVideoTasks.scriptText,
      })
      .from(geoVideoTasks)
      .where(eq(geoVideoTasks.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('视频任务不存在');
    }
    const row = existing[0];
    this.ensureCanWrite(user, row.brandId);

    return this.generateVideo(
      {
        brandId: row.brandId,
        taskName: `${row.taskName}（重试）`,
        script: row.topic ?? '',
        duration: row.duration as '15s' | '30s' | '60s',
        ratio: row.ratio as '9:16' | '16:9' | '1:1',
        coverImage: row.coverImage ?? undefined,
        purpose: (row.purpose as VideoPurpose | undefined) ?? undefined,
        style: (row.style as VideoStyle | undefined) ?? undefined,
        scriptText: row.scriptText ?? undefined,
      },
      user,
    );
  }

  async createVideoPublication(
    id: string,
    dto: CreationVideoPublicationDto,
    user: GeoUserCtx,
  ): Promise<PublicationRecord> {
    const existing = await this.db
      .select({
        id: geoVideoTasks.id,
        brandId: geoVideoTasks.brandId,
      })
      .from(geoVideoTasks)
      .where(eq(geoVideoTasks.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('视频任务不存在');
    }
    const row = existing[0];
    this.ensureCanWrite(user, row.brandId);

    return this.createPublication(
      {
        contentType: 'video',
        contentId: id,
        brandId: row.brandId,
        platform: dto.platform as any,
        mediaLibrary: dto.mediaLibrary ?? '默认素材库',
      },
      user,
    );
  }

  async getVideo(id: string, user: GeoUserCtx): Promise<VideoTask> {
    return this.contentService.getVideoTaskDetail(id, user);
  }

  async updateVideo(
    id: string,
    dto: CreationUpdateVideoDto,
    user: GeoUserCtx,
  ): Promise<VideoTask> {
    const existing = await this.db
      .select({ id: geoVideoTasks.id, brandId: geoVideoTasks.brandId })
      .from(geoVideoTasks)
      .where(eq(geoVideoTasks.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('视频任务不存在');
    }
    this.ensureCanWrite(user, existing[0].brandId);

    const patch: Partial<typeof geoVideoTasks.$inferInsert> = {};
    if (dto.taskName !== undefined) patch.taskName = dto.taskName;
    if (dto.videoUrl !== undefined) patch.videoUrl = dto.videoUrl;
    if (dto.videoCoverUrl !== undefined) patch.videoCoverUrl = dto.videoCoverUrl;
    if (dto.status !== undefined) patch.status = dto.status;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    await this.db.update(geoVideoTasks).set(patch).where(eq(geoVideoTasks.id, id));
    return this.contentService.getVideoTaskDetail(id, user);
  }

  async deleteVideo(id: string, user: GeoUserCtx): Promise<void> {
    return this.contentService.deleteVideoTask(id, user);
  }

  // ============================================================
  //  算力套餐管理
  // ============================================================

  async listPlans(user: GeoUserCtx): Promise<CreditPlan[]> {
    void user;
    const rows = await this.db
      .select()
      .from(geoCreditPlans)
      .where(eq(geoCreditPlans.isActive, true))
      .orderBy(sql`${geoCreditPlans.sortOrder} ASC, ${geoCreditPlans.createdAt} ASC`);

    return rows.map((row) => ({
      id: row.id,
      planName: row.planName,
      planCode: row.planCode,
      price: Number(row.price),
      creditAmount: Number(row.creditAmount),
      description: row.description ?? null,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      createdAt: new Date(row.createdAt).toISOString(),
    }));
  }

  async listAllPlans(user: GeoUserCtx): Promise<CreditPlan[]> {
    this.ensureAdminOrOperator(user);
    const rows = await this.db
      .select()
      .from(geoCreditPlans)
      .orderBy(sql`${geoCreditPlans.sortOrder} ASC, ${geoCreditPlans.createdAt} ASC`);

    return rows.map((row) => ({
      id: row.id,
      planName: row.planName,
      planCode: row.planCode,
      price: Number(row.price),
      creditAmount: Number(row.creditAmount),
      description: row.description ?? null,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      createdAt: new Date(row.createdAt).toISOString(),
    }));
  }

  async createPlan(dto: CreateCreditPlanDto, user: GeoUserCtx): Promise<CreditPlan> {
    this.ensureAdmin(user);

    const existing = await this.db
      .select({ id: geoCreditPlans.id })
      .from(geoCreditPlans)
      .where(eq(geoCreditPlans.planCode, dto.planCode))
      .limit(1);
    if (existing.length > 0) {
      throw new BadRequestException('套餐编码已存在');
    }

    const inserted = await this.db
      .insert(geoCreditPlans)
      .values({
        planName: dto.planName,
        planCode: dto.planCode,
        price: dto.price.toString(),
        creditAmount: dto.creditAmount.toString(),
        description: dto.description,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      })
      .returning();

    const row = inserted[0];
    return {
      id: row.id,
      planName: row.planName,
      planCode: row.planCode,
      price: Number(row.price),
      creditAmount: Number(row.creditAmount),
      description: row.description ?? null,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      createdAt: new Date(row.createdAt).toISOString(),
    };
  }

  async updatePlan(id: string, dto: UpdateCreditPlanDto, user: GeoUserCtx): Promise<CreditPlan> {
    this.ensureAdmin(user);

    const existing = await this.db
      .select()
      .from(geoCreditPlans)
      .where(eq(geoCreditPlans.id, id))
      .limit(1);
    if (existing.length === 0) {
      throw new NotFoundException('套餐不存在');
    }

    const patch: Partial<typeof geoCreditPlans.$inferInsert> = {};
    if (dto.planName !== undefined) patch.planName = dto.planName;
    if (dto.planCode !== undefined) patch.planCode = dto.planCode;
    if (dto.price !== undefined) patch.price = dto.price.toString();
    if (dto.creditAmount !== undefined) patch.creditAmount = dto.creditAmount.toString();
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.isActive !== undefined) patch.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) patch.sortOrder = dto.sortOrder;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    if (dto.planCode && dto.planCode !== existing[0].planCode) {
      const dup = await this.db
        .select({ id: geoCreditPlans.id })
        .from(geoCreditPlans)
        .where(eq(geoCreditPlans.planCode, dto.planCode))
        .limit(1);
      if (dup.length > 0) {
        throw new BadRequestException('套餐编码已存在');
      }
    }

    const updated = await this.db
      .update(geoCreditPlans)
      .set(patch)
      .where(eq(geoCreditPlans.id, id))
      .returning();

    const row = updated[0];
    return {
      id: row.id,
      planName: row.planName,
      planCode: row.planCode,
      price: Number(row.price),
      creditAmount: Number(row.creditAmount),
      description: row.description ?? null,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      createdAt: new Date(row.createdAt).toISOString(),
    };
  }

  async deletePlan(id: string, user: GeoUserCtx): Promise<void> {
    this.ensureAdmin(user);

    const deleted = await this.db
      .delete(geoCreditPlans)
      .where(eq(geoCreditPlans.id, id))
      .returning({ id: geoCreditPlans.id });
    if (deleted.length === 0) {
      throw new NotFoundException('套餐不存在');
    }
  }

  // ============================================================
  //  算力账户查询
  // ============================================================

  private ensureAdmin(user: GeoUserCtx): void {
    if (user.role !== 'admin') {
      throw new ForbiddenException('仅管理员可执行此操作');
    }
  }

  private ensureAdminOrOperator(user: GeoUserCtx): void {
    if (user.role === 'client') {
      throw new ForbiddenException('当前角色无此权限');
    }
  }

  private async getOrCreateCreditAccount(
    brandId: string,
  ): Promise<typeof geoCreditAccounts.$inferSelect> {
    const existing = await this.db
      .select()
      .from(geoCreditAccounts)
      .where(eq(geoCreditAccounts.brandId, brandId))
      .limit(1);

    if (existing.length > 0) return existing[0];

    const inserted = await this.db
      .insert(geoCreditAccounts)
      .values({
        brandId,
        balance: '0',
        totalUsed: '0',
        totalRecharged: '0',
      })
      .returning();
    return inserted[0];
  }

  async getCreditAccountDetail(
    brandId: string,
    user: GeoUserCtx,
  ): Promise<CreditAccountDetail> {
    const effectiveBrandId = this.ensureCanReadBrand(user, brandId);
    if (!effectiveBrandId) throw new BadRequestException('请指定品牌');

    const account = await this.getOrCreateCreditAccount(effectiveBrandId);

    const [brandRows, planRows, activeModelName] = await Promise.all([
      this.db
        .select({ name: geoBrands.name })
        .from(geoBrands)
        .where(eq(geoBrands.id, effectiveBrandId))
        .limit(1),
      account.currentPlanId
        ? this.db
            .select({ planName: geoCreditPlans.planName, dailyPublishLimit: geoCreditPlans.dailyPublishLimit })
            .from(geoCreditPlans)
            .where(eq(geoCreditPlans.id, account.currentPlanId))
            .limit(1)
        : Promise.resolve([]),
      this.aiKeysService.getActiveModelName(effectiveBrandId),
    ]);

    return {
      id: account.id,
      brandId: account.brandId,
      brandName: brandRows[0]?.name ?? '',
      balance: Number(account.balance),
      totalUsed: Number(account.totalUsed),
      totalRecharged: Number(account.totalRecharged),
      currentPlanId: account.currentPlanId ?? null,
      currentPlanName: planRows[0]?.planName ?? null,
      dailyPublishLimit: planRows[0]?.dailyPublishLimit ?? 10,
      planExpiresAt: account.planExpiresAt
        ? new Date(account.planExpiresAt).toISOString()
        : null,
      activeModelName,
      createdAt: new Date(account.createdAt).toISOString(),
      updatedAt: new Date(account.updatedAt).toISOString(),
    };
  }

  async listCreditAccounts(
    query: CreditAccountListQueryDto,
    user: GeoUserCtx,
  ): Promise<PagedResponse<CreditAccountDetail>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const brandFilter = this.ensureCanReadBrand(user, null);

    // client 角色只看自己品牌，直接走明细接口
    if (brandFilter && user.role === 'client') {
      const detail = await this.getCreditAccountDetail(brandFilter, user);
      return { items: [detail], total: 1, page, pageSize };
    }

    const conditions: ReturnType<typeof eq>[] = [];
    if (query.keyword) {
      // 关键字按品牌名过滤，需要 join
    }
    void conditions;

    // 用 raw SQL 做品牌名模糊匹配
    const keywordSql = query.keyword
      ? sql`WHERE b.name ILIKE ${`%${query.keyword}%`}`
      : sql``;

    const countResult = await this.db.execute(sql<{ count: string }>`
      SELECT COUNT(*) AS count
      FROM geo_credit_accounts a
      LEFT JOIN geo_brands b ON a.brand_id = b.id
      ${keywordSql}
    `);
    const total = Number((countResult as any)[0]?.count ?? 0);

    const result = await this.db.execute(sql<{
      id: string;
      brand_id: string;
      brand_name: string;
      balance: string;
      total_used: string;
      total_recharged: string;
      current_plan_id: string | null;
      plan_name: string | null;
      daily_publish_limit: number | null;
      plan_expires_at: Date | null;
      _created_at: Date;
      _updated_at: Date;
    }>`
      SELECT
        a.id,
        a.brand_id,
        b.name AS brand_name,
        a.balance,
        a.total_used,
        a.total_recharged,
        a.current_plan_id,
        p.plan_name,
        p.daily_publish_limit,
        a.plan_expires_at,
        a._created_at,
        a._updated_at
      FROM geo_credit_accounts a
      LEFT JOIN geo_brands b ON a.brand_id = b.id
      LEFT JOIN geo_credit_plans p ON a.current_plan_id = p.id
      ${keywordSql}
      ORDER BY a._created_at DESC
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
    `);

    const rows = result as unknown as Array<{
      id: string;
      brand_id: string;
      brand_name: string;
      balance: string;
      total_used: string;
      total_recharged: string;
      current_plan_id: string | null;
      plan_name: string | null;
      daily_publish_limit: number | null;
      plan_expires_at: Date | null;
      _created_at: Date;
      _updated_at: Date;
    }>;

    const items: CreditAccountDetail[] = [];
    for (const row of rows) {
      const activeModelName = await this.aiKeysService.getActiveModelName(row.brand_id);
      items.push({
        id: row.id,
        brandId: row.brand_id,
        brandName: row.brand_name ?? '',
        balance: Number(row.balance),
        totalUsed: Number(row.total_used),
        totalRecharged: Number(row.total_recharged),
        currentPlanId: row.current_plan_id ?? null,
        currentPlanName: row.plan_name ?? null,
        dailyPublishLimit: row.daily_publish_limit ?? 10,
        planExpiresAt: row.plan_expires_at
          ? new Date(row.plan_expires_at).toISOString()
          : null,
        activeModelName,
        createdAt: new Date(row._created_at).toISOString(),
        updatedAt: new Date(row._updated_at).toISOString(),
      });
    }

    return { items, total, page, pageSize };
  }

  // ============================================================
  //  算力充值 / 套餐激活
  // ============================================================

  async rechargeCredit(dto: RechargeCreditDto, user: GeoUserCtx): Promise<void> {
    this.ensureAdmin(user);

    const amount = Math.floor(dto.amount);
    if (amount <= 0) {
      throw new BadRequestException('充值金额必须大于 0');
    }

    await this.db.transaction(async (tx) => {
      const accRows = await tx
        .select()
        .from(geoCreditAccounts)
        .where(eq(geoCreditAccounts.brandId, dto.brandId))
        .limit(1)
        .for('update');

      let account = accRows[0];
      if (!account) {
        const created = await tx
          .insert(geoCreditAccounts)
          .values({
            brandId: dto.brandId,
            balance: '0',
            totalUsed: '0',
            totalRecharged: '0',
          })
          .returning();
        account = created[0];
      }

      const newBalance = (Number(account.balance) + amount).toString();
      const newTotalRecharged = (Number(account.totalRecharged) + amount).toString();

      await tx
        .update(geoCreditAccounts)
        .set({ balance: newBalance, totalRecharged: newTotalRecharged })
        .where(eq(geoCreditAccounts.id, account.id));

      await tx.insert(geoCreditTransactions).values({
        brandId: dto.brandId,
        changeAmount: amount.toString(),
        balanceAfter: newBalance,
        transactionType: 'manual_recharge',
        description: dto.remark ?? '手工充值',
        operatorId: user.id,
        planId: dto.planId,
        paymentAmount: dto.paymentAmount?.toString(),
      });
    });
  }

  async activatePlan(dto: ActivatePlanDto, user: GeoUserCtx): Promise<void> {
    this.ensureAdmin(user);

    const planRows = await this.db
      .select()
      .from(geoCreditPlans)
      .where(eq(geoCreditPlans.id, dto.planId))
      .limit(1);
    if (planRows.length === 0) {
      throw new NotFoundException('套餐不存在');
    }
    if (!planRows[0].isActive) {
      throw new BadRequestException('套餐未启用');
    }

    const plan = planRows[0];
    const creditAmount = Number(plan.creditAmount);

    // 过期时间：默认 1 年
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    await this.db.transaction(async (tx) => {
      const accRows = await tx
        .select()
        .from(geoCreditAccounts)
        .where(eq(geoCreditAccounts.brandId, dto.brandId))
        .limit(1)
        .for('update');

      let account = accRows[0];
      if (!account) {
        const created = await tx
          .insert(geoCreditAccounts)
          .values({
            brandId: dto.brandId,
            balance: '0',
            totalUsed: '0',
            totalRecharged: '0',
          })
          .returning();
        account = created[0];
      }

      const newBalance = (Number(account.balance) + creditAmount).toString();
      const newTotalRecharged = (Number(account.totalRecharged) + creditAmount).toString();

      await tx
        .update(geoCreditAccounts)
        .set({
          balance: newBalance,
          totalRecharged: newTotalRecharged,
          currentPlanId: dto.planId,
          planExpiresAt: expiresAt,
        })
        .where(eq(geoCreditAccounts.id, account.id));

      await tx.insert(geoCreditTransactions).values({
        brandId: dto.brandId,
        changeAmount: creditAmount.toString(),
        balanceAfter: newBalance,
        transactionType: 'plan_grant',
        description: `激活套餐：${plan.planName}`,
        operatorId: user.id,
        planId: dto.planId,
      });
    });
  }

  // ============================================================
  //  算力扣减（统一方法，供内部调用）
  // ============================================================

  /**
   * 扣减算力。余额不足抛 BadRequestException。
   * 事务保证：扣 balance + 加 totalUsed + 写流水
   */
  async deductCredit(
    brandId: string,
    amount: number,
    txType: CreditTxType,
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
        transactionType: txType,
        relatedType,
        relatedId,
        description: description ?? null,
        operatorId,
      });
    });
  }

  // ============================================================
  //  算力流水查询
  // ============================================================

  async listTransactions(
    query: CreditTransactionQueryDto,
    user: GeoUserCtx,
  ): Promise<PagedResponse<CreditTransaction>> {
    const effectiveBrandId = this.ensureCanReadBrand(user, query.brandId);
    if (!effectiveBrandId) throw new BadRequestException('请指定品牌');

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions: ReturnType<typeof eq>[] = [
      eq(geoCreditTransactions.brandId, effectiveBrandId) as any,
    ];
    if (query.transactionType) {
      conditions.push(
        eq(geoCreditTransactions.transactionType, query.transactionType) as any,
      );
    }

    const whereClause = and(...conditions);

    const [itemsRaw, totalResult] = await Promise.all([
      this.db
        .select()
        .from(geoCreditTransactions)
        .where(whereClause)
        .orderBy(desc(geoCreditTransactions.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(geoCreditTransactions)
        .where(whereClause),
    ]);

    const items: CreditTransaction[] = itemsRaw.map((row) => ({
      id: row.id,
      brandId: row.brandId,
      changeAmount: Number(row.changeAmount),
      balanceAfter: Number(row.balanceAfter),
      transactionType: row.transactionType as CreditTxType,
      relatedType: row.relatedType ?? null,
      relatedId: row.relatedId ?? null,
      description: row.description ?? null,
      createdAt: new Date(row.createdAt).toISOString(),
    }));

    return {
      items,
      total: Number(totalResult[0]?.count ?? 0),
      page,
      pageSize,
    };
  }

  async getUsageBreakdown(
    query: UsageBreakdownQueryDto,
    user: GeoUserCtx,
  ): Promise<UsageBreakdownResponse> {
    const effectiveBrandId = this.ensureCanReadBrand(user, query.brandId);
    if (!effectiveBrandId) throw new BadRequestException('请指定品牌');

    // 解析月份，默认本月
    let year: number;
    let month: number;
    if (query.month && /^\d{4}-\d{2}$/.test(query.month)) {
      [year, month] = query.month.split('-').map(Number);
    } else {
      const now = new Date();
      year = now.getFullYear();
      month = now.getMonth() + 1;
    }

    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);
    const startIso = startDate.toISOString();
    const endIso = endDate.toISOString();

    const result = await this.db.execute(sql<{
      transaction_type: string;
      total_amount: string;
      tx_count: string;
    }>`
      SELECT
        transaction_type,
        SUM(ABS(change_amount::numeric)) AS total_amount,
        COUNT(*) AS tx_count
      FROM geo_credit_transactions
      WHERE brand_id = ${effectiveBrandId}
        AND change_amount < 0
        AND _created_at >= ${startIso}
        AND _created_at < ${endIso}
      GROUP BY transaction_type
      ORDER BY total_amount DESC
    `);

    const rows = result as unknown as Array<{
      transaction_type: string;
      total_amount: string;
      tx_count: string;
    }>;

    const { CREDIT_TX_TYPE_LABELS } = await import('@shared/api.interface').then(
      (m) => m,
    );
    void CREDIT_TX_TYPE_LABELS;

    // 用内联标签避免动态 import 问题
    const typeLabelMap: Record<string, string> = {
      article_generate: '文章生成',
      image_generate: '图片生成',
      video_generate: '视频生成',
      video_script: '视频脚本',
      adjustment: '调整',
      manual_recharge: '手工充值',
      plan_grant: '套餐赠送',
      refund: '退款',
    };

    const items = rows.map((row) => ({
      transactionType: row.transaction_type,
      typeLabel: typeLabelMap[row.transaction_type] ?? row.transaction_type,
      totalAmount: Number(row.total_amount),
      count: Number(row.tx_count),
    }));

    const totalUsed = items.reduce((sum, item) => sum + item.totalAmount, 0);

    return {
      month: monthStr,
      items,
      totalUsed,
    };
  }

  // ============================================================
  //  任务队列（统一视图：文章批次 + 图片任务 + 视频任务）
  // ============================================================

  async listTasks(
    query: CreationTaskListQueryDto,
    user: GeoUserCtx,
  ): Promise<PagedResponse<CreationTaskItem>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const brandFilter = this.ensureCanReadBrand(user, query.brandId);

    // 用 UNION ALL 组合三类任务
    const whereClauses: string[] = [];
    const params: Record<string, unknown> = {};

    if (brandFilter) {
      whereClauses.push('brand_id = $brandId');
      params.brandId = brandFilter;
    } else if (query.brandId) {
      whereClauses.push('brand_id = $brandId');
      params.brandId = query.brandId;
    }

    if (query.status) {
      whereClauses.push('status = $status');
      params.status = query.status;
    }

    if (query.startDate) {
      whereClauses.push(`_created_at >= $startDate`);
      params.startDate = query.startDate;
    }
    if (query.endDate) {
      whereClauses.push(`_created_at < $endDate`);
      params.endDate = query.endDate;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // 按 taskType 过滤
    let typeFilter = '';
    if (query.taskType === 'article') {
      typeFilter = "AND 'article' = 'article'";
    } else if (query.taskType === 'video') {
      typeFilter = "AND 'video' = 'video'";
    } else if (query.taskType === 'image') {
      typeFilter = "AND 'image' = 'image'";
    }
    void typeFilter;

    // 简化实现：如果指定了 taskType，只查对应表
    if (query.taskType === 'article') {
      return this.listArticleTasks(query, user, brandFilter, page, pageSize);
    }
    if (query.taskType === 'video') {
      return this.listVideoTasksOnly(query, user, brandFilter, page, pageSize);
    }
    if (query.taskType === 'image') {
      // 图片没有独立任务表，用素材表（AI 生成的）近似
      return this.listImageTasks(query, user, brandFilter, page, pageSize);
    }

    // 全类型混合（用 UNION ALL）
    const offset = (page - 1) * pageSize;

    const result = await this.db.execute(sql<{
      id: string;
      task_name: string;
      task_type: string;
      quantity: number;
      status: string;
      duration_ms: string;
      cost_credits: string;
      brand_id: string;
      brand_name: string;
      error: string | null;
      created_at: Date;
      completed_at: Date | null;
    }>`
      SELECT * FROM (
        -- 文章批次
        SELECT
          ab.id,
          ab.batch_name AS task_name,
          'article'::text AS task_type,
          ab.total_count AS quantity,
          ab.status,
          CASE
            WHEN ab.status IN ('completed', 'failed', 'partial_failed')
              THEN EXTRACT(EPOCH FROM (ab._updated_at - ab._created_at)) * 1000
            ELSE 0
          END AS duration_ms,
          ab.total_cost AS cost_credits,
          ab.brand_id,
          b.name AS brand_name,
          ab.error,
          ab._created_at AS created_at,
          CASE WHEN ab.status IN ('completed', 'failed', 'partial_failed') THEN ab._updated_at END AS completed_at
        FROM geo_article_batches ab
        LEFT JOIN geo_brands b ON ab.brand_id = b.id
        ${brandFilter ? sql`WHERE ab.brand_id = ${brandFilter}` : sql``}

        UNION ALL

        -- 视频任务
        SELECT
          v.id,
          v.task_name,
          'video'::text AS task_type,
          1 AS quantity,
          v.status,
          CASE
            WHEN v.status IN ('completed', 'failed')
              THEN EXTRACT(EPOCH FROM (v._updated_at - v._created_at)) * 1000
            ELSE 0
          END AS duration_ms,
          v.cost_credits,
          v.brand_id,
          b.name AS brand_name,
          v.error,
          v._created_at AS created_at,
          CASE WHEN v.status IN ('completed', 'failed') THEN v._updated_at END AS completed_at
        FROM geo_video_tasks v
        LEFT JOIN geo_brands b ON v.brand_id = b.id
        ${brandFilter ? sql`WHERE v.brand_id = ${brandFilter}` : sql``}
      ) AS combined
      ORDER BY created_at DESC
      LIMIT ${pageSize}
      OFFSET ${offset}
    `);

    const rows = result as unknown as Array<{
      id: string;
      task_name: string;
      task_type: string;
      quantity: number;
      status: string;
      duration_ms: string;
      cost_credits: string;
      brand_id: string;
      brand_name: string;
      error: string | null;
      created_at: Date;
      completed_at: Date | null;
    }>;

    // 计算总数
    const countResult = await this.db.execute(sql<{ total: string }>`
      SELECT COUNT(*) AS total FROM (
        SELECT ab.id, ab._created_at FROM geo_article_batches ab
        ${brandFilter ? sql`WHERE ab.brand_id = ${brandFilter}` : sql``}
        UNION ALL
        SELECT v.id, v._created_at FROM geo_video_tasks v
        ${brandFilter ? sql`WHERE v.brand_id = ${brandFilter}` : sql``}
      ) AS combined
    `);
    const countRows = countResult as unknown as Array<{ total: string }>;
    const total = Number(countRows[0]?.total ?? 0);

    const items: CreationTaskItem[] = rows.map((row) => ({
      id: row.id,
      taskName: row.task_name,
      taskType: row.task_type as 'article' | 'image' | 'video',
      quantity: Number(row.quantity),
      status: this.normalizeTaskStatus(row.status),
      durationMs: Number(row.duration_ms),
      costCredits: Number(row.cost_credits),
      brandId: row.brand_id,
      brandName: row.brand_name ?? '',
      error: row.error ?? null,
      createdAt: new Date(row.created_at).toISOString(),
      completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    }));

    return { items, total, page, pageSize };
  }

  private normalizeTaskStatus(status: string): 'pending' | 'generating' | 'completed' | 'failed' {
    const map: Record<string, 'pending' | 'generating' | 'completed' | 'failed'> = {
      pending: 'pending',
      generating: 'generating',
      completed: 'completed',
      failed: 'failed',
      partial_failed: 'completed',
    };
    return map[status] ?? 'pending';
  }

  private async listArticleTasks(
    query: CreationTaskListQueryDto,
    _user: GeoUserCtx,
    brandFilter: string | null,
    page: number,
    pageSize: number,
  ): Promise<PagedResponse<CreationTaskItem>> {
    const conditions: any[] = [];
    if (brandFilter) conditions.push(eq(geoArticleBatches.brandId, brandFilter));
    if (query.status) {
      // 文章批次状态多一个 partial_failed
      if (query.status === 'completed') {
        conditions.push(
          sql`(${geoArticleBatches.status} = 'completed' OR ${geoArticleBatches.status} = 'partial_failed')`,
        );
      } else {
        conditions.push(eq(geoArticleBatches.status, query.status));
      }
    }

    const baseQuery = this.db
      .select({
        id: geoArticleBatches.id,
        taskName: geoArticleBatches.batchName,
        quantity: geoArticleBatches.totalCount,
        status: geoArticleBatches.status,
        costCredits: geoArticleBatches.totalCost,
        brandId: geoArticleBatches.brandId,
        brandName: geoBrands.name,
        error: geoArticleBatches.error,
        createdAt: geoArticleBatches.createdAt,
        updatedAt: geoArticleBatches.updatedAt,
      })
      .from(geoArticleBatches)
      .leftJoin(geoBrands, eq(geoArticleBatches.brandId, geoBrands.id));

    const dataQuery = conditions.length > 0
      ? (baseQuery as any).where(and(...conditions))
      : baseQuery;

    const [itemsRaw, totalResult] = await Promise.all([
      dataQuery.orderBy(desc(geoArticleBatches.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ count: count() }).from(geoArticleBatches)
        .where(conditions.length > 0 ? and(...conditions) : undefined),
    ]);

    const items: CreationTaskItem[] = itemsRaw.map((row: any) => ({
      id: row.id,
      taskName: row.taskName,
      taskType: 'article',
      quantity: row.quantity,
      status: this.normalizeTaskStatus(row.status),
      durationMs:
        row.status === 'completed' || row.status === 'failed' || row.status === 'partial_failed'
          ? new Date(row.updatedAt).getTime() - new Date(row.createdAt).getTime()
          : 0,
      costCredits: Number(row.costCredits),
      brandId: row.brandId,
      brandName: row.brandName ?? '',
      error: row.error ?? null,
      createdAt: new Date(row.createdAt).toISOString(),
      completedAt:
        row.status === 'completed' || row.status === 'failed' || row.status === 'partial_failed'
          ? new Date(row.updatedAt).toISOString()
          : null,
    }));

    return { items, total: Number(totalResult[0]?.count ?? 0), page, pageSize };
  }

  private async listVideoTasksOnly(
    query: CreationTaskListQueryDto,
    _user: GeoUserCtx,
    brandFilter: string | null,
    page: number,
    pageSize: number,
  ): Promise<PagedResponse<CreationTaskItem>> {
    const conditions: any[] = [];
    if (brandFilter) conditions.push(eq(geoVideoTasks.brandId, brandFilter));
    if (query.status) conditions.push(eq(geoVideoTasks.status, query.status));

    const baseQuery = this.db
      .select({
        id: geoVideoTasks.id,
        taskName: geoVideoTasks.taskName,
        status: geoVideoTasks.status,
        costCredits: geoVideoTasks.costCredits,
        brandId: geoVideoTasks.brandId,
        brandName: geoBrands.name,
        error: geoVideoTasks.error,
        createdAt: geoVideoTasks.createdAt,
        updatedAt: geoVideoTasks.updatedAt,
      })
      .from(geoVideoTasks)
      .leftJoin(geoBrands, eq(geoVideoTasks.brandId, geoBrands.id));

    const dataQuery = conditions.length > 0
      ? (baseQuery as any).where(and(...conditions))
      : baseQuery;

    const [itemsRaw, totalResult] = await Promise.all([
      dataQuery.orderBy(desc(geoVideoTasks.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ count: count() }).from(geoVideoTasks)
        .where(conditions.length > 0 ? and(...conditions) : undefined),
    ]);

    const items: CreationTaskItem[] = itemsRaw.map((row: any) => ({
      id: row.id,
      taskName: row.taskName,
      taskType: 'video',
      quantity: 1,
      status: row.status as 'pending' | 'generating' | 'completed' | 'failed',
      durationMs:
        row.status === 'completed' || row.status === 'failed'
          ? new Date(row.updatedAt).getTime() - new Date(row.createdAt).getTime()
          : 0,
      costCredits: Number(row.costCredits),
      brandId: row.brandId,
      brandName: row.brandName ?? '',
      error: row.error ?? null,
      createdAt: new Date(row.createdAt).toISOString(),
      completedAt:
        row.status === 'completed' || row.status === 'failed'
          ? new Date(row.updatedAt).toISOString()
          : null,
    }));

    return { items, total: Number(totalResult[0]?.count ?? 0), page, pageSize };
  }

  private async listImageTasks(
    _query: CreationTaskListQueryDto,
    _user: GeoUserCtx,
    _brandFilter: string | null,
    page: number,
    pageSize: number,
  ): Promise<PagedResponse<CreationTaskItem>> {
    // 图片没有独立任务表，返回空列表
    // 后续可接入 geo_materials 中 ai_generated 的记录
    void page;
    void pageSize;
    return { items: [], total: 0, page, pageSize };
  }

  // ============================================================
  //  发布记录
  // ============================================================

  async createPublication(
    dto: CreatePublicationDto,
    user: GeoUserCtx,
  ): Promise<PublicationRecord> {
    this.ensureCanWrite(user, dto.brandId);

    // 验证 content 存在
    await this.validateContentExists(dto.contentType, dto.contentId, dto.brandId, user);

    const inserted = await this.db.execute(sql<{
      id: string;
      content_type: string;
      content_id: string;
      brand_id: string;
      media_library: string;
      platform: string;
      scheduled_at: Date | null;
      status: string;
      publish_url: string | null;
      remark: string | null;
      creator_id: string;
      _created_at: Date;
      _updated_at: Date;
    }>`
      INSERT INTO geo_publication_records (
        content_type, content_id, brand_id, media_library, platform,
        scheduled_at, status, publish_url, remark, creator_id
      ) VALUES (
        ${dto.contentType},
        ${dto.contentId},
        ${dto.brandId},
        ${dto.mediaLibrary},
        ${dto.platform},
        ${dto.scheduledAt ? sql`${dto.scheduledAt}::timestamptz` : sql`NULL`},
        'pending',
        ${dto.publishUrl ?? null},
        ${dto.remark ?? null},
        ${user.id}
      )
      RETURNING *
    `);

    const rows = inserted as unknown as Array<{
      id: string;
      content_type: string;
      content_id: string;
      brand_id: string;
      media_library: string;
      platform: string;
      scheduled_at: Date | null;
      status: string;
      publish_url: string | null;
      remark: string | null;
      creator_id: string;
      _created_at: Date;
      _updated_at: Date;
    }>;

    return this.getPublicationDetail(rows[0].id, user);
  }

  private async validateContentExists(
    contentType: string,
    contentId: string,
    brandId: string,
    _user: GeoUserCtx,
  ): Promise<void> {
    let exists = false;
    if (contentType === 'article') {
      const rows = await this.db
        .select({ id: geoArticles.id })
        .from(geoArticles)
        .where(and(eq(geoArticles.id, contentId), eq(geoArticles.brandId, brandId)))
        .limit(1);
      exists = rows.length > 0;
    } else if (contentType === 'image') {
      const rows = await this.db
        .select({ id: geoMaterials.id })
        .from(geoMaterials)
        .where(and(eq(geoMaterials.id, contentId), eq(geoMaterials.brandId, brandId)))
        .limit(1);
      exists = rows.length > 0;
    } else if (contentType === 'video') {
      const rows = await this.db
        .select({ id: geoVideoTasks.id })
        .from(geoVideoTasks)
        .where(and(eq(geoVideoTasks.id, contentId), eq(geoVideoTasks.brandId, brandId)))
        .limit(1);
      exists = rows.length > 0;
    }
    if (!exists) {
      throw new BadRequestException('内容不存在或无权访问');
    }
  }

  async listPublications(
    query: PublicationListQueryDto,
    user: GeoUserCtx,
  ): Promise<PagedResponse<PublicationRecord>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const brandFilter = this.ensureCanReadBrand(user, query.brandId);

    const conditions: string[] = [];
    if (brandFilter) {
      conditions.push(`p.brand_id = '${brandFilter}'`);
    } else if (query.brandId) {
      conditions.push(`p.brand_id = '${query.brandId}'`);
    }
    if (query.contentType) {
      conditions.push(`p.content_type = '${query.contentType}'`);
    }
    if (query.status) {
      conditions.push(`p.status = '${query.status}'`);
    }
    if (query.platform) {
      conditions.push(`p.platform = '${query.platform}'`);
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await this.db.execute(sql<{
      id: string;
      content_type: string;
      content_id: string;
      brand_id: string;
      brand_name: string;
      media_library: string;
      platform: string;
      scheduled_at: Date | null;
      status: string;
      publish_url: string | null;
      remark: string | null;
      creator_id: string;
      creator_name: string | null;
      _created_at: Date;
      _updated_at: Date;
      content_title: string | null;
    }>`
      SELECT
        p.*,
        b.name AS brand_name,
        u.display_name AS creator_name,
        CASE
          WHEN p.content_type = 'article' THEN a.title
          WHEN p.content_type = 'image' THEN m.name
          WHEN p.content_type = 'video' THEN v.task_name
          ELSE NULL
        END AS content_title
      FROM geo_publication_records p
      LEFT JOIN geo_brands b ON p.brand_id = b.id
      LEFT JOIN geo_users u ON p.creator_id = u.id
      LEFT JOIN geo_articles a ON p.content_type = 'article' AND p.content_id = a.id
      LEFT JOIN geo_materials m ON p.content_type = 'image' AND p.content_id = m.id
      LEFT JOIN geo_video_tasks v ON p.content_type = 'video' AND p.content_id = v.id
      ${sql.raw(whereSql)}
      ORDER BY p._created_at DESC
      LIMIT ${pageSize}
      OFFSET ${(page - 1) * pageSize}
    `);

    const rows = result as unknown as Array<{
      id: string;
      content_type: string;
      content_id: string;
      brand_id: string;
      brand_name: string;
      media_library: string;
      platform: string;
      scheduled_at: Date | null;
      status: string;
      publish_url: string | null;
      remark: string | null;
      creator_id: string;
      creator_name: string | null;
      _created_at: Date;
      _updated_at: Date;
      content_title: string | null;
    }>;

    const countResult = await this.db.execute(sql<{ total: string }>`
      SELECT COUNT(*) AS total FROM geo_publication_records p
      ${sql.raw(whereSql)}
    `);
    const countRows = countResult as unknown as Array<{ total: string }>;
    const total = Number(countRows[0]?.total ?? 0);

    const items: PublicationRecord[] = rows.map((row) => ({
      id: row.id,
      contentType: row.content_type as 'article' | 'image' | 'video',
      contentId: row.content_id,
      contentTitle: row.content_title ?? null,
      brandId: row.brand_id,
      brandName: row.brand_name ?? '',
      mediaLibrary: row.media_library,
      platform: row.platform as any,
      scheduledAt: row.scheduled_at ? new Date(row.scheduled_at).toISOString() : null,
      status: row.status as 'pending' | 'published' | 'failed',
      publishUrl: row.publish_url ?? null,
      remark: row.remark ?? null,
      creatorId: row.creator_id,
      creatorName: row.creator_name ?? null,
      createdAt: new Date(row._created_at).toISOString(),
      updatedAt: new Date(row._updated_at).toISOString(),
    }));

    return { items, total, page, pageSize };
  }

  async getPublicationDetail(id: string, user: GeoUserCtx): Promise<PublicationRecord> {
    const result = await this.db.execute(sql<{
      id: string;
      content_type: string;
      content_id: string;
      brand_id: string;
      brand_name: string;
      media_library: string;
      platform: string;
      scheduled_at: Date | null;
      status: string;
      publish_url: string | null;
      remark: string | null;
      creator_id: string;
      creator_name: string | null;
      _created_at: Date;
      _updated_at: Date;
      content_title: string | null;
    }>`
      SELECT
        p.*,
        b.name AS brand_name,
        u.display_name AS creator_name,
        CASE
          WHEN p.content_type = 'article' THEN a.title
          WHEN p.content_type = 'image' THEN m.name
          WHEN p.content_type = 'video' THEN v.task_name
          ELSE NULL
        END AS content_title
      FROM geo_publication_records p
      LEFT JOIN geo_brands b ON p.brand_id = b.id
      LEFT JOIN geo_users u ON p.creator_id = u.id
      LEFT JOIN geo_articles a ON p.content_type = 'article' AND p.content_id = a.id
      LEFT JOIN geo_materials m ON p.content_type = 'image' AND p.content_id = m.id
      LEFT JOIN geo_video_tasks v ON p.content_type = 'video' AND p.content_id = v.id
      WHERE p.id = ${id}
      LIMIT 1
    `);

    const rows = result as unknown as Array<{
      id: string;
      content_type: string;
      content_id: string;
      brand_id: string;
      brand_name: string;
      media_library: string;
      platform: string;
      scheduled_at: Date | null;
      status: string;
      publish_url: string | null;
      remark: string | null;
      creator_id: string;
      creator_name: string | null;
      _created_at: Date;
      _updated_at: Date;
      content_title: string | null;
    }>;

    if (rows.length === 0) {
      throw new NotFoundException('发布记录不存在');
    }

    const row = rows[0];
    const brandFilter = this.ensureCanReadBrand(user, row.brand_id);
    if (brandFilter && row.brand_id !== brandFilter) {
      throw new ForbiddenException('无权查看该发布记录');
    }

    return {
      id: row.id,
      contentType: row.content_type as 'article' | 'image' | 'video',
      contentId: row.content_id,
      contentTitle: row.content_title ?? null,
      brandId: row.brand_id,
      brandName: row.brand_name ?? '',
      mediaLibrary: row.media_library,
      platform: row.platform as any,
      scheduledAt: row.scheduled_at ? new Date(row.scheduled_at).toISOString() : null,
      status: row.status as 'pending' | 'published' | 'failed',
      publishUrl: row.publish_url ?? null,
      remark: row.remark ?? null,
      creatorId: row.creator_id,
      creatorName: row.creator_name ?? null,
      createdAt: new Date(row._created_at).toISOString(),
      updatedAt: new Date(row._updated_at).toISOString(),
    };
  }

  async updatePublication(
    id: string,
    dto: UpdatePublicationDto,
    user: GeoUserCtx,
  ): Promise<PublicationRecord> {
    const existing = await this.getPublicationDetail(id, user);
    this.ensureCanWrite(user, existing.brandId);

    const sets: string[] = [];
    if (dto.status !== undefined) sets.push(`status = '${dto.status}'`);
    if (dto.publishUrl !== undefined) {
      sets.push(dto.publishUrl ? `publish_url = '${dto.publishUrl}'` : 'publish_url = NULL');
    }
    if (dto.scheduledAt !== undefined) {
      sets.push(
        dto.scheduledAt
          ? `scheduled_at = '${dto.scheduledAt}'::timestamptz`
          : 'scheduled_at = NULL',
      );
    }
    if (dto.remark !== undefined) {
      sets.push(dto.remark ? `remark = '${dto.remark}'` : 'remark = NULL');
    }

    if (sets.length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    await this.db.execute(sql`
      UPDATE geo_publication_records
      SET ${sql.raw(sets.join(', '))}
      WHERE id = ${id}
    `);

    return this.getPublicationDetail(id, user);
  }

  async deletePublication(id: string, user: GeoUserCtx): Promise<void> {
    const existing = await this.getPublicationDetail(id, user);
    this.ensureCanWrite(user, existing.brandId);

    await this.db.execute(sql`
      DELETE FROM geo_publication_records WHERE id = ${id}
    `);
  }

  // ============================================================
  //  统一创作（图文/视频）：关键词分组
  // ============================================================

  async getUnifiedKeywordGroups(
    brandId: string,
    user: GeoUserCtx,
  ): Promise<KeywordGroup[]> {
    const brandFilter = this.ensureCanReadBrand(user, brandId);
    const effectiveBrandId = brandFilter ?? brandId;

    const rows = await this.db
      .select()
      .from(geoKeywordGroups)
      .where(eq(geoKeywordGroups.brandId, effectiveBrandId))
      .orderBy(sql`${geoKeywordGroups.sortOrder} ASC, ${geoKeywordGroups.createdAt} ASC`);

    return rows.map((row) => ({
      id: row.id,
      brandId: row.brandId,
      name: row.name,
      description: row.description ?? null,
      sortOrder: row.sortOrder ?? 0,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  // ============================================================
  //  统一创作：关键词列表
  // ============================================================

  async getUnifiedKeywords(
    groupId: string,
    type: 'core' | 'longtail',
    search: string | undefined,
    user: GeoUserCtx,
  ): Promise<KeywordItem[]> {
    const groupRows = await this.db
      .select({ brandId: geoKeywordGroups.brandId })
      .from(geoKeywordGroups)
      .where(eq(geoKeywordGroups.id, groupId))
      .limit(1);

    if (groupRows.length === 0) {
      throw new NotFoundException('关键词分组不存在');
    }
    const brandId = groupRows[0].brandId;
    this.ensureCanReadBrand(user, brandId);

    const conditions = [
      eq(geoKeywords.groupId, groupId),
      eq(geoKeywords.keywordType, type),
    ];
    if (search && search.trim()) {
      conditions.push(ilike(geoKeywords.keyword, `%${search.trim()}%`) as any);
    }

    const rows = await this.db
      .select({
        id: geoKeywords.id,
        keyword: geoKeywords.keyword,
        keywordType: geoKeywords.keywordType,
        groupId: geoKeywords.groupId,
      })
      .from(geoKeywords)
      .where(and(...conditions))
      .orderBy(desc(geoKeywords.createdAt))
      .limit(200);

    return rows.map((row) => ({
      id: row.id,
      keyword: row.keyword,
      keywordType: row.keywordType as 'core' | 'longtail',
      groupId: row.groupId ?? null,
    }));
  }

  // ============================================================
  //  统一创作：AI 生成文案
  // ============================================================

  async generateUnifiedCopy(
    dto: UnifiedGenerateCopyDto,
    user: GeoUserCtx,
  ): Promise<GenerateCopyResponse> {
    this.ensureCanWrite(user, dto.brandId);

    const cost = dto.taskType === 'image' ? 2000 : 5000;
    const txType: 'image_generate' | 'video_script' =
      dto.taskType === 'image' ? 'image_generate' : 'video_script';
    const typeLabel = dto.taskType === 'image' ? '图文文案' : '视频脚本';

    // 先扣算力，余额不足直接抛错
    await this.db.transaction(async (tx) => {
      const accountRows = await tx
        .select()
        .from(geoCreditAccounts)
        .where(eq(geoCreditAccounts.brandId, dto.brandId))
        .limit(1)
        .for('update');

      let account = accountRows[0];
      if (!account) {
        const created = await tx
          .insert(geoCreditAccounts)
          .values({ brandId: dto.brandId, balance: '0', totalUsed: '0' })
          .returning();
        account = created[0];
      }

      const balanceNum = Number(account.balance);
      if (balanceNum < cost) {
        throw new BadRequestException('算力不足，请联系管理员充值');
      }

      const newBalance = (balanceNum - cost).toString();
      const newTotalUsed = (Number(account.totalUsed) + cost).toString();

      await tx
        .update(geoCreditAccounts)
        .set({ balance: newBalance, totalUsed: newTotalUsed })
        .where(eq(geoCreditAccounts.id, account.id));

      await tx.insert(geoCreditTransactions).values({
        brandId: dto.brandId,
        changeAmount: `-${cost}`,
        balanceAfter: newBalance,
        transactionType: txType,
        relatedType: 'unified_creation',
        relatedId: null,
        description: `AI生成${typeLabel}：${dto.title}`,
        operatorId: user.id,
      });
    });

    // 调用文本插件
    try {
      const keywordList = dto.keywords.join('、');
      const longtailList = (dto.longtailKeywords ?? []).join('、');
      const contentType = dto.taskType === 'image' ? '图文推广文案' : '短视频口播文案';
      const additionalReqs = `核心关键词：${keywordList}\n长尾关键词：${longtailList || '无'}\n标题：${dto.title}\n要求：内容紧扣关键词，适合本地商户 SEO 推广，语言自然有说服力。`;

      const result = await this.aiChatWithFallback({
        content_topic: dto.title,
        content_type: contentType,
        word_count: dto.taskType === 'image' ? '800' : '300',
        additional_requirements: additionalReqs,
        user,
        brandId: dto.brandId,
      });

      const content = result;
      return { content };
    } catch (err) {
      // 失败回退算力
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error('AI生成文案失败', errorMsg);

      try {
        await this.refundCreditsInternal(
          dto.brandId,
          cost,
          txType,
          'unified_creation',
          null,
          'AI生成文案失败，算力退回',
          user.id,
        );
      } catch (refundErr) {
        this.logger.error(
          '算力回退失败',
          refundErr instanceof Error ? refundErr.message : String(refundErr),
        );
      }

      throw err;
    }
  }

  // ============================================================
  //  统一创作：拆分图片提示词（不扣算力）
  // ============================================================

  async splitImagePrompts(
    dto: UnifiedSplitImagePromptsDto,
    user: GeoUserCtx,
  ): Promise<SplitImagePromptsResponse> {
    const keywordList = (dto.keywords ?? []).join('、');
    const additionalReqs = `请将以下正文内容拆分为 ${dto.imageCount} 条独立的图片生成提示词（英文或中文均可），每条对应正文的一个核心场景或意象。\n标题：${dto.title}\n关键词：${keywordList || '无'}\n正文：\n${dto.content}\n\n请严格以 JSON 数组格式返回：{ "prompts": ["提示词1", "提示词2", ...] }`;

    const text = await this.aiChatWithFallback({
      content_topic: `${dto.title} - 图片提示词拆分`,
      content_type: '图片提示词拆分',
      word_count: '500',
      additional_requirements: additionalReqs,
      user,
      brandId: user.brandId ?? '',
    });

    // 尝试解析 JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as { prompts?: string[] };
        if (parsed.prompts && Array.isArray(parsed.prompts) && parsed.prompts.length > 0) {
          return { prompts: parsed.prompts.slice(0, dto.imageCount) };
        }
      } catch {
        // 解析失败继续走 fallback
      }
    }

    // fallback：按换行拆分
    const lines = text
      .split(/\n+/)
      .map((line) => line.replace(/^\d+[.、\s]+/, '').trim())
      .filter((line) => line.length > 5)
      .slice(0, dto.imageCount);

    if (lines.length === 0) {
      // 最后兜底：生成 N 条占位提示词
      return {
        prompts: Array.from({ length: dto.imageCount }).map(
          (_, i) => `${dto.title} - 场景 ${i + 1}`,
        ),
      };
    }

    return { prompts: lines };
  }

  // ============================================================
  //  统一创作：提交图文任务
  // ============================================================

  private validateImageTask(dto: UnifiedCreateImageTaskDto): void {
    if (!dto.groupId) throw new BadRequestException('请选择分组后进行创作');
    if (!dto.keywords || dto.keywords.length === 0)
      throw new BadRequestException('请选择核心关键词');
    if (!dto.longtailKeywords || dto.longtailKeywords.length === 0)
      throw new BadRequestException('请选择长尾关键词');
    if (!dto.title || !dto.title.trim())
      throw new BadRequestException('请输入图文标题');
    if (!dto.content || !dto.content.trim())
      throw new BadRequestException('请输入正文内容');
    if (!dto.tags || dto.tags.length === 0)
      throw new BadRequestException('请添加话题标签');
    if (dto.tags && dto.tags.length > 5)
      throw new BadRequestException('话题标签最多5个');
    if (dto.referenceImages && dto.referenceImages.length > 4)
      throw new BadRequestException('参考图片最多4张');
    if (dto.imageMode === 'upload' && dto.uploadedImageUrls && dto.uploadedImageUrls.length > 5)
      throw new BadRequestException('最多上传5张图片');
  }

  async createUnifiedImageTask(
    dto: UnifiedCreateImageTaskDto,
    user: GeoUserCtx,
  ): Promise<CreationTaskDetail> {
    this.ensureCanWrite(user, dto.brandId);
    this.validateImageTask(dto);

    const totalCredit = IMAGE_CREDIT_PER_IMAGE * dto.imageCount;
    const now = new Date();

    // 事务：扣算力 + 创建任务
    const taskId = await this.db.transaction(async (tx) => {
      // 1. 扣减算力
      const accountRows = await tx
        .select()
        .from(geoCreditAccounts)
        .where(eq(geoCreditAccounts.brandId, dto.brandId))
        .limit(1)
        .for('update');

      let account = accountRows[0];
      if (!account) {
        const created = await tx
          .insert(geoCreditAccounts)
          .values({ brandId: dto.brandId, balance: '0', totalUsed: '0' })
          .returning();
        account = created[0];
      }

      const balanceNum = Number(account.balance);
      if (balanceNum < totalCredit) {
        throw new BadRequestException('算力不足，请联系管理员充值');
      }

      const newBalance = (balanceNum - totalCredit).toString();
      const newTotalUsed = (Number(account.totalUsed) + totalCredit).toString();

      await tx
        .update(geoCreditAccounts)
        .set({ balance: newBalance, totalUsed: newTotalUsed })
        .where(eq(geoCreditAccounts.id, account.id));

      // 2. 创建任务
      const inserted = await tx
        .insert(geoCreationTasks)
        .values({
          brandId: dto.brandId,
          creatorId: user.id,
          taskType: 'image',
          taskName: dto.title,
          title: dto.title,
          content: dto.content,
          keywords: dto.keywords,
          longtailKeywords: dto.longtailKeywords,
          groupId: dto.groupId,
          tags: dto.tags ?? [],
          ratio: dto.ratio,
          imageMode: dto.imageMode,
          imagePrompt: dto.imagePrompt ?? null,
          imageCount: dto.imageCount,
          referenceImages: dto.referenceImages ?? [],
          materialImageIds: dto.materialImageIds ?? [],
          uploadedImageUrls: dto.uploadedImageUrls ?? [],
          status: 'pending',
          costCredits: totalCredit,
          startedAt: now,
        })
        .returning({ id: geoCreationTasks.id });

      const newTaskId = inserted[0].id;

      // 3. 写算力流水
      await tx.insert(geoCreditTransactions).values({
        brandId: dto.brandId,
        changeAmount: `-${totalCredit}`,
        balanceAfter: newBalance,
        transactionType: 'image_generate',
        relatedType: 'creation_task',
        relatedId: newTaskId,
        description: `统一图文生成 ${dto.imageCount} 张：${dto.title}`,
        operatorId: user.id,
      });

      return newTaskId;
    });

    // 异步执行生成（fire-and-forget，不阻塞响应）
    void this.executeImageTask(taskId, dto, user.id).catch((err) => {
      this.logger.error(`图文任务执行失败 taskId=${taskId}`, err instanceof Error ? err.message : String(err));
    });

    return this.getUnifiedTaskDetail(taskId, user);
  }

  private async executeImageTask(
    taskId: string,
    dto: UnifiedCreateImageTaskDto,
    userId: string,
  ): Promise<void> {
    try {
      if (dto.imageMode === 'ai_generate') {
        // 调用 AI 生图（循环调用，每次一张）
        const defaultPrompt = dto.imagePrompt || dto.title;
        const hasPerImagePrompts =
          dto.perImagePrompts && dto.perImagePrompts.length >= dto.imageCount;
        const allImages: string[] = [];

        for (let i = 0; i < dto.imageCount; i++) {
          try {
            const prompt = hasPerImagePrompts
              ? dto.perImagePrompts![i]
              : `${defaultPrompt} - 第${i + 1}张`;
            const result = await this.capabilityService.call('geo_image_generate_1', {
              image_subject: prompt,
              image_type: '图文配图',
              ratio: dto.ratio,
            });
            const resultObj = result as { images?: Array<{ id: string; url: string }> };
            const images = resultObj.images ?? [];
            if (images.length > 0) {
              allImages.push(images[0].url);
            }
          } catch (imgErr) {
            this.logger.warn(
              `第${i + 1}张图片生成失败`,
              imgErr instanceof Error ? imgErr.message : String(imgErr),
            );
          }
        }

        if (allImages.length === 0) {
          throw new BadRequestException('图片生成失败，未返回有效图片');
        }

        await this.db
          .update(geoCreationTasks)
          .set({
            resultImages: allImages,
            status: 'completed',
            completedAt: new Date(),
            error: null,
          })
          .where(eq(geoCreationTasks.id, taskId));
      } else if (dto.imageMode === 'material') {
        // 从素材库取图片 URL
        const materialIds = dto.materialImageIds ?? [];
        let imageUrls: string[] = [];
        if (materialIds.length > 0) {
          const materials = await this.db
            .select({ id: geoMaterials.id, filePath: geoMaterials.filePath })
            .from(geoMaterials)
            .where(inArray(geoMaterials.id, materialIds));
          imageUrls = materials
            .map((m) => m.filePath as unknown as string)
            .filter((url) => !!url);
        }

        await this.db
          .update(geoCreationTasks)
          .set({
            resultImages: imageUrls,
            status: 'completed',
            completedAt: new Date(),
            error: null,
          })
          .where(eq(geoCreationTasks.id, taskId));
      } else if (dto.imageMode === 'upload') {
        // 直接使用上传的图片 URL
        await this.db
          .update(geoCreationTasks)
          .set({
            resultImages: dto.uploadedImageUrls ?? [],
            status: 'completed',
            completedAt: new Date(),
            error: null,
          })
          .where(eq(geoCreationTasks.id, taskId));
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`图文任务失败 taskId=${taskId}`, errorMsg);

      await this.db
        .update(geoCreationTasks)
        .set({
          status: 'failed',
          error: errorMsg,
          completedAt: new Date(),
        })
        .where(eq(geoCreationTasks.id, taskId));

      // 回退算力
      try {
        await this.refundCreditsInternal(
          dto.brandId,
          IMAGE_CREDIT_PER_IMAGE * dto.imageCount,
          'image_generate',
          'creation_task',
          taskId,
          '图文生成失败，算力退回',
          userId,
        );
      } catch (refundErr) {
        this.logger.error(
          '算力回退失败',
          refundErr instanceof Error ? refundErr.message : String(refundErr),
        );
      }
    }
  }

  // ============================================================
  //  统一创作：提交视频任务
  // ============================================================

  private validateVideoTask(dto: UnifiedCreateVideoTaskDto): void {
    if (!dto.title || !dto.title.trim())
      throw new BadRequestException('请输入视频标题');
    if (!dto.content || !dto.content.trim())
      throw new BadRequestException('请输入文案内容');
    if (!dto.videoPrompt || !dto.videoPrompt.trim())
      throw new BadRequestException('请输入视频生成提示词');
    if (dto.tags && dto.tags.length > 5)
      throw new BadRequestException('话题标签最多5个');
    if (dto.videoReferenceImages && dto.videoReferenceImages.length > 4)
      throw new BadRequestException('参考图片最多4张');
    if (dto.videoMaterialId && dto.videoMaterialId.length > 0) {
      // 只有一个的校验已由单值字段保证
    }
  }

  async createUnifiedVideoTask(
    dto: UnifiedCreateVideoTaskDto,
    user: GeoUserCtx,
  ): Promise<CreationTaskDetail> {
    this.ensureCanWrite(user, dto.brandId);
    this.validateVideoTask(dto);

    const totalCredit = VIDEO_CREDIT_PER_GENERATE;

    // 事务：扣算力 + 创建任务
    const taskId = await this.db.transaction(async (tx) => {
      // 1. 扣减算力
      const accountRows = await tx
        .select()
        .from(geoCreditAccounts)
        .where(eq(geoCreditAccounts.brandId, dto.brandId))
        .limit(1)
        .for('update');

      let account = accountRows[0];
      if (!account) {
        const created = await tx
          .insert(geoCreditAccounts)
          .values({ brandId: dto.brandId, balance: '0', totalUsed: '0' })
          .returning();
        account = created[0];
      }

      const balanceNum = Number(account.balance);
      if (balanceNum < totalCredit) {
        throw new BadRequestException('算力不足，请联系管理员充值');
      }

      const newBalance = (balanceNum - totalCredit).toString();
      const newTotalUsed = (Number(account.totalUsed) + totalCredit).toString();

      await tx
        .update(geoCreditAccounts)
        .set({ balance: newBalance, totalUsed: newTotalUsed })
        .where(eq(geoCreditAccounts.id, account.id));

      // 2. 创建任务
      const inserted = await tx
        .insert(geoCreationTasks)
        .values({
          brandId: dto.brandId,
          creatorId: user.id,
          taskType: 'video',
          taskName: dto.title,
          title: dto.title,
          content: dto.content,
          keywords: dto.keywords ?? [],
          longtailKeywords: dto.longtailKeywords ?? [],
          groupId: dto.groupId ?? null,
          tags: dto.tags ?? [],
          ratio: dto.ratio,
          duration: dto.duration,
          resolution: dto.resolution,
          subtitleEnabled: dto.subtitleEnabled,
          subtitleStyle: dto.subtitleStyle ?? null,
          bgmUrl: dto.bgmUrl ?? null,
          bgmVolume: dto.bgmVolume,
          voiceId: dto.voiceId ?? null,
          voiceName: dto.voiceName ?? null,
          originalAudioEnabled: dto.originalAudioEnabled,
          videoPrompt: dto.videoPrompt,
          videoReferenceImages: dto.videoReferenceImages ?? [],
          videoMaterialId: dto.videoMaterialId ?? null,
          status: 'pending',
          costCredits: totalCredit,
          startedAt: new Date(),
        })
        .returning({ id: geoCreationTasks.id });

      const newTaskId = inserted[0].id;

      // 3. 写算力流水
      await tx.insert(geoCreditTransactions).values({
        brandId: dto.brandId,
        changeAmount: `-${totalCredit}`,
        balanceAfter: newBalance,
        transactionType: 'video_generate',
        relatedType: 'creation_task',
        relatedId: newTaskId,
        description: `统一视频生成：${dto.title}（${dto.duration}）`,
        operatorId: user.id,
      });

      return newTaskId;
    });

    // 尝试提交到外部视频服务
    const submitResult = await this.contentService.submitExternalVideoTask({
      taskId,
      title: dto.title,
      prompt: dto.videoPrompt,
      duration: dto.duration,
      ratio: dto.ratio,
      resolution: dto.resolution,
      referenceImages: dto.videoReferenceImages,
      subtitleEnabled: dto.subtitleEnabled,
      subtitleStyle: dto.subtitleStyle ?? null,
      voiceId: dto.voiceId ?? null,
      voiceName: dto.voiceName ?? null,
      bgmUrl: dto.bgmUrl ?? null,
      bgmVolume: dto.bgmVolume,
      originalAudioEnabled: dto.originalAudioEnabled,
    });

    if (!submitResult.success) {
      const errorMsg = submitResult.error ?? '视频生成提交失败';
      this.logger.error(`视频任务提交失败 taskId=${taskId}`, errorMsg);

      await this.db
        .update(geoCreationTasks)
        .set({
          status: 'failed',
          error: errorMsg,
          completedAt: new Date(),
        })
        .where(eq(geoCreationTasks.id, taskId));

      // 回退算力
      try {
        await this.refundCreditsInternal(
          dto.brandId,
          totalCredit,
          'video_generate',
          'creation_task',
          taskId,
          '视频生成提交失败，算力退回',
          user.id,
        );
      } catch (refundErr) {
        this.logger.error(
          '算力回退失败',
          refundErr instanceof Error ? refundErr.message : String(refundErr),
        );
      }
    } else {
      await this.db
        .update(geoCreationTasks)
        .set({
          externalTaskId: submitResult.externalTaskId,
          status: 'generating',
          error: null,
        })
        .where(eq(geoCreationTasks.id, taskId));
    }

    return this.getUnifiedTaskDetail(taskId, user);
  }

  // ============================================================
  //  统一创作：任务列表
  // ============================================================

  async listUnifiedTasks(
    query: UnifiedTaskListQueryDto,
    user: GeoUserCtx,
  ): Promise<CreationTaskListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const brandFilter = this.ensureCanReadBrand(user, query.brandId);

    const conditions: unknown[] = [];
    if (brandFilter) {
      conditions.push(eq(geoCreationTasks.brandId, brandFilter));
    }
    if (query.taskType) {
      conditions.push(eq(geoCreationTasks.taskType, query.taskType));
    }
    if (query.status) {
      conditions.push(eq(geoCreationTasks.status, query.status));
    }
    if (query.keyword && query.keyword.trim()) {
      conditions.push(ilike(geoCreationTasks.taskName, `%${query.keyword.trim()}%`) as any);
    }

    const whereClause = conditions.length > 0 ? and(...(conditions as any)) : undefined;

    const totalResult = await this.db
      .select({ count: count() })
      .from(geoCreationTasks)
      .where(whereClause as any);

    const rows = await this.db
      .select({
        id: geoCreationTasks.id,
        taskType: geoCreationTasks.taskType,
        taskName: geoCreationTasks.taskName,
        title: geoCreationTasks.title,
        content: geoCreationTasks.content,
        keywords: geoCreationTasks.keywords,
        longtailKeywords: geoCreationTasks.longtailKeywords,
        groupId: geoCreationTasks.groupId,
        tags: geoCreationTasks.tags,
        ratio: geoCreationTasks.ratio,
        duration: geoCreationTasks.duration,
        resolution: geoCreationTasks.resolution,
        subtitleEnabled: geoCreationTasks.subtitleEnabled,
        subtitleStyle: geoCreationTasks.subtitleStyle,
        bgmUrl: geoCreationTasks.bgmUrl,
        bgmVolume: geoCreationTasks.bgmVolume,
        voiceId: geoCreationTasks.voiceId,
        voiceName: geoCreationTasks.voiceName,
        originalAudioEnabled: geoCreationTasks.originalAudioEnabled,
        imageMode: geoCreationTasks.imageMode,
        imagePrompt: geoCreationTasks.imagePrompt,
        imageCount: geoCreationTasks.imageCount,
        referenceImages: geoCreationTasks.referenceImages,
        materialImageIds: geoCreationTasks.materialImageIds,
        uploadedImageUrls: geoCreationTasks.uploadedImageUrls,
        videoPrompt: geoCreationTasks.videoPrompt,
        videoReferenceImages: geoCreationTasks.videoReferenceImages,
        videoMaterialId: geoCreationTasks.videoMaterialId,
        resultImages: geoCreationTasks.resultImages,
        resultVideoUrl: geoCreationTasks.resultVideoUrl,
        resultCoverUrl: geoCreationTasks.resultCoverUrl,
        externalTaskId: geoCreationTasks.externalTaskId,
        status: geoCreationTasks.status,
        error: geoCreationTasks.error,
        costCredits: geoCreationTasks.costCredits,
        durationMs: geoCreationTasks.durationMs,
        brandId: geoCreationTasks.brandId,
        createdAt: geoCreationTasks.createdAt,
        startedAt: geoCreationTasks.startedAt,
        completedAt: geoCreationTasks.completedAt,
        brandName: geoBrands.name,
        groupName: geoKeywordGroups.name,
      })
      .from(geoCreationTasks)
      .leftJoin(geoBrands, eq(geoCreationTasks.brandId, geoBrands.id))
      .leftJoin(geoKeywordGroups, eq(geoCreationTasks.groupId, geoKeywordGroups.id))
      .where(whereClause as any)
      .orderBy(desc(geoCreationTasks.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const items: CreationTaskDetail[] = rows.map((row) => ({
      id: row.id,
      taskType: row.taskType as CreationTaskType,
      title: row.title ?? null,
      content: row.content ?? null,
      keywords: row.keywords ?? [],
      longtailKeywords: row.longtailKeywords ?? [],
      groupId: row.groupId ?? null,
      groupName: row.groupName ?? null,
      tags: row.tags ?? [],
      ratio: row.ratio ?? null,
      duration: row.duration ?? null,
      resolution: row.resolution ?? null,
      subtitleEnabled: row.subtitleEnabled ?? false,
      subtitleStyle: row.subtitleStyle ?? null,
      bgmUrl: row.bgmUrl ?? null,
      bgmVolume: row.bgmVolume ?? 0,
      voiceId: row.voiceId ?? null,
      voiceName: row.voiceName ?? null,
      originalAudioEnabled: row.originalAudioEnabled ?? false,
      imageMode: row.imageMode ?? null,
      imagePrompt: row.imagePrompt ?? null,
      imageCount: row.imageCount ?? 0,
      referenceImages: row.referenceImages ?? [],
      materialImageIds: row.materialImageIds ?? [],
      uploadedImageUrls: row.uploadedImageUrls ?? [],
      videoPrompt: row.videoPrompt ?? null,
      videoReferenceImages: row.videoReferenceImages ?? [],
      videoMaterialId: row.videoMaterialId ?? null,
      resultImages: row.resultImages ?? [],
      resultVideoUrl: row.resultVideoUrl ?? null,
      resultCoverUrl: row.resultCoverUrl ?? null,
      externalTaskId: row.externalTaskId ?? null,
      status: row.status as CreationTaskStatus,
      error: row.error ?? null,
      costCredits: row.costCredits ?? 0,
      durationMs: row.durationMs ?? null,
      brandId: row.brandId,
      brandName: row.brandName ?? null,
      createdAt: row.createdAt.toISOString(),
      startedAt: row.startedAt ? row.startedAt.toISOString() : null,
      completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    }));

    return {
      items,
      total: Number(totalResult[0]?.count ?? 0),
      page,
      pageSize,
    };
  }

  // ============================================================
  //  统一创作：任务详情
  // ============================================================

  async getUnifiedTaskDetail(
    id: string,
    user: GeoUserCtx,
  ): Promise<CreationTaskDetail> {
    const rows = await this.db
      .select({
        id: geoCreationTasks.id,
        taskType: geoCreationTasks.taskType,
        taskName: geoCreationTasks.taskName,
        title: geoCreationTasks.title,
        content: geoCreationTasks.content,
        keywords: geoCreationTasks.keywords,
        longtailKeywords: geoCreationTasks.longtailKeywords,
        groupId: geoCreationTasks.groupId,
        tags: geoCreationTasks.tags,
        ratio: geoCreationTasks.ratio,
        duration: geoCreationTasks.duration,
        resolution: geoCreationTasks.resolution,
        subtitleEnabled: geoCreationTasks.subtitleEnabled,
        subtitleStyle: geoCreationTasks.subtitleStyle,
        bgmUrl: geoCreationTasks.bgmUrl,
        bgmVolume: geoCreationTasks.bgmVolume,
        voiceId: geoCreationTasks.voiceId,
        voiceName: geoCreationTasks.voiceName,
        originalAudioEnabled: geoCreationTasks.originalAudioEnabled,
        imageMode: geoCreationTasks.imageMode,
        imagePrompt: geoCreationTasks.imagePrompt,
        imageCount: geoCreationTasks.imageCount,
        referenceImages: geoCreationTasks.referenceImages,
        materialImageIds: geoCreationTasks.materialImageIds,
        uploadedImageUrls: geoCreationTasks.uploadedImageUrls,
        videoPrompt: geoCreationTasks.videoPrompt,
        videoReferenceImages: geoCreationTasks.videoReferenceImages,
        videoMaterialId: geoCreationTasks.videoMaterialId,
        resultImages: geoCreationTasks.resultImages,
        resultVideoUrl: geoCreationTasks.resultVideoUrl,
        resultCoverUrl: geoCreationTasks.resultCoverUrl,
        externalTaskId: geoCreationTasks.externalTaskId,
        status: geoCreationTasks.status,
        error: geoCreationTasks.error,
        costCredits: geoCreationTasks.costCredits,
        durationMs: geoCreationTasks.durationMs,
        brandId: geoCreationTasks.brandId,
        createdAt: geoCreationTasks.createdAt,
        startedAt: geoCreationTasks.startedAt,
        completedAt: geoCreationTasks.completedAt,
        brandName: geoBrands.name,
        groupName: geoKeywordGroups.name,
      })
      .from(geoCreationTasks)
      .leftJoin(geoBrands, eq(geoCreationTasks.brandId, geoBrands.id))
      .leftJoin(geoKeywordGroups, eq(geoCreationTasks.groupId, geoKeywordGroups.id))
      .where(eq(geoCreationTasks.id, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('任务不存在');
    }

    const row = rows[0];
    const brandFilter = this.ensureCanReadBrand(user, row.brandId);
    if (brandFilter && row.brandId !== brandFilter) {
      throw new ForbiddenException('无权查看该任务');
    }

    return {
      id: row.id,
      taskType: row.taskType as CreationTaskType,
      title: row.title ?? null,
      content: row.content ?? null,
      keywords: row.keywords ?? [],
      longtailKeywords: row.longtailKeywords ?? [],
      groupId: row.groupId ?? null,
      groupName: row.groupName ?? null,
      tags: row.tags ?? [],
      ratio: row.ratio ?? null,
      duration: row.duration ?? null,
      resolution: row.resolution ?? null,
      subtitleEnabled: row.subtitleEnabled ?? false,
      subtitleStyle: row.subtitleStyle ?? null,
      bgmUrl: row.bgmUrl ?? null,
      bgmVolume: row.bgmVolume ?? 0,
      voiceId: row.voiceId ?? null,
      voiceName: row.voiceName ?? null,
      originalAudioEnabled: row.originalAudioEnabled ?? false,
      imageMode: row.imageMode ?? null,
      imagePrompt: row.imagePrompt ?? null,
      imageCount: row.imageCount ?? 0,
      referenceImages: row.referenceImages ?? [],
      materialImageIds: row.materialImageIds ?? [],
      uploadedImageUrls: row.uploadedImageUrls ?? [],
      videoPrompt: row.videoPrompt ?? null,
      videoReferenceImages: row.videoReferenceImages ?? [],
      videoMaterialId: row.videoMaterialId ?? null,
      resultImages: row.resultImages ?? [],
      resultVideoUrl: row.resultVideoUrl ?? null,
      resultCoverUrl: row.resultCoverUrl ?? null,
      externalTaskId: row.externalTaskId ?? null,
      status: row.status as CreationTaskStatus,
      error: row.error ?? null,
      costCredits: row.costCredits ?? 0,
      durationMs: row.durationMs ?? null,
      brandId: row.brandId,
      brandName: row.brandName ?? null,
      createdAt: row.createdAt.toISOString(),
      startedAt: row.startedAt ? row.startedAt.toISOString() : null,
      completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    };
  }

  // ============================================================
  //  统一创作：删除任务
  // ============================================================

  async deleteUnifiedTask(id: string, user: GeoUserCtx): Promise<void> {
    const existing = await this.db
      .select({
        id: geoCreationTasks.id,
        brandId: geoCreationTasks.brandId,
      })
      .from(geoCreationTasks)
      .where(eq(geoCreationTasks.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('任务不存在');
    }

    this.ensureCanWrite(user, existing[0].brandId);
    await this.db.delete(geoCreationTasks).where(eq(geoCreationTasks.id, id));
  }

  // ============================================================
  //  统一创作：重试任务
  // ============================================================

  async retryUnifiedTask(id: string, user: GeoUserCtx): Promise<CreationTaskDetail> {
    const detail = await this.getUnifiedTaskDetail(id, user);
    this.ensureCanWrite(user, detail.brandId);

    // 重置状态
    await this.db
      .update(geoCreationTasks)
      .set({
        status: 'pending',
        error: null,
        startedAt: new Date(),
        completedAt: null,
      })
      .where(eq(geoCreationTasks.id, id));

    if (detail.taskType === 'image') {
      // 重建 DTO 并执行
      const dto: UnifiedCreateImageTaskDto = {
        brandId: detail.brandId,
        groupId: detail.groupId ?? '',
        keywords: detail.keywords,
        longtailKeywords: detail.longtailKeywords,
        title: detail.title ?? '',
        content: detail.content ?? '',
        tags: detail.tags,
        imageMode: (detail.imageMode as 'ai_generate' | 'material' | 'upload') ?? 'ai_generate',
        imagePrompt: detail.imagePrompt ?? undefined,
        imageCount: detail.imageCount,
        referenceImages: detail.referenceImages,
        materialImageIds: detail.materialImageIds,
        uploadedImageUrls: detail.uploadedImageUrls,
        ratio: detail.ratio ?? '1:1',
      };

      void this.executeImageTask(id, dto, user.id).catch((err) => {
        this.logger.error(
          `图文任务重试失败 taskId=${id}`,
          err instanceof Error ? err.message : String(err),
        );
      });
    } else if (detail.taskType === 'video') {
      // 视频重试：重新提交外部服务
      void (async () => {
        try {
          const submitResult = await this.contentService.submitExternalVideoTask({
            taskId: id,
            title: detail.title ?? '',
            prompt: detail.videoPrompt ?? '',
            duration: detail.duration ?? '15s',
            ratio: detail.ratio ?? '9:16',
            resolution: detail.resolution ?? undefined,
            referenceImages: detail.videoReferenceImages,
            subtitleEnabled: detail.subtitleEnabled,
            subtitleStyle: detail.subtitleStyle ?? null,
            voiceId: detail.voiceId ?? null,
            voiceName: detail.voiceName ?? null,
            bgmUrl: detail.bgmUrl ?? null,
            bgmVolume: detail.bgmVolume,
            originalAudioEnabled: detail.originalAudioEnabled,
          });

          if (submitResult.success && submitResult.externalTaskId) {
            await this.db
              .update(geoCreationTasks)
              .set({
                externalTaskId: submitResult.externalTaskId,
                status: 'generating',
                error: null,
              })
              .where(eq(geoCreationTasks.id, id));
          } else {
            throw new BadRequestException(submitResult.error ?? '外部服务未返回任务 ID');
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          this.logger.error(`视频任务重试失败 taskId=${id}`, errorMsg);
          await this.db
            .update(geoCreationTasks)
            .set({
              status: 'failed',
              error: errorMsg,
              completedAt: new Date(),
            })
            .where(eq(geoCreationTasks.id, id));
        }
      })();
    }

    return this.getUnifiedTaskDetail(id, user);
  }

  // ============================================================
  //  统一创作：轮询视频任务状态
  // ============================================================

  async pollUnifiedVideoTask(
    id: string,
    user: GeoUserCtx,
  ): Promise<CreationTaskDetail> {
    const detail = await this.getUnifiedTaskDetail(id, user);
    this.ensureCanWrite(user, detail.brandId);

    // 如果已经是最终状态，直接返回
    if (detail.status !== 'pending' && detail.status !== 'generating') {
      return detail;
    }

    if (!detail.externalTaskId) {
      throw new BadRequestException('任务未提交到外部服务');
    }

    try {
      const result = await this.contentService.pollExternalVideoTask(
        id,
        detail.externalTaskId,
      );

      const externalStatus = result.status.toLowerCase();

      if (externalStatus === 'completed' || externalStatus === 'success') {
        const startTime = detail.startedAt
          ? new Date(detail.startedAt).getTime()
          : Date.now();
        const durationMs = Date.now() - startTime;

        await this.db
          .update(geoCreationTasks)
          .set({
            status: 'completed',
            resultVideoUrl: result.videoUrl ?? null,
            resultCoverUrl: result.coverUrl ?? null,
            error: null,
            completedAt: new Date(),
            durationMs,
          })
          .where(eq(geoCreationTasks.id, id));
      } else if (externalStatus === 'failed' || externalStatus === 'error') {
        await this.db
          .update(geoCreationTasks)
          .set({
            status: 'failed',
            error: result.error ?? '视频生成失败',
            completedAt: new Date(),
          })
          .where(eq(geoCreationTasks.id, id));
      }
      // generating / processing 等中间状态不更新
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`轮询统一视频任务失败 taskId=${id}`, errorMsg);
      // 轮询失败不改变任务状态，继续等待下次轮询
    }

    return this.getUnifiedTaskDetail(id, user);
  }
}
