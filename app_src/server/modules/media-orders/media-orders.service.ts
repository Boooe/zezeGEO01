import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import {
  eq,
  desc,
  and,
  count,
  ilike,
  inArray,
  sql,
} from 'drizzle-orm';
import type { PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { DRIZZLE_DATABASE } from '@lark-apaas/fullstack-nestjs-core';
import { randomBytes } from 'crypto';

import {
  geoMediaOrders,
  geoSubmissionChannels,
  geoBrands,
  geoMediaSuppliers,
  geoArticles,
} from '@server/database/schema';
import { MediaWalletService } from '../media-wallet/media-wallet.service';
import { PlacementRecordsService } from '../placement-records/placement-records.service';
import {
  MediaOrderAdmin,
  MediaOrderClient,
  MediaOrderListResponse,
  MediaOrderStatus,
  MediaOrderTimelineItem,
  GeoUser,
  CreateMediaOrderRequest,
  BatchCreateOrdersResponse,
} from '@shared/api.interface';

type OrderRow = typeof geoMediaOrders.$inferSelect;

@Injectable()
export class MediaOrdersService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly walletService: MediaWalletService,
    private readonly placementRecordsService: PlacementRecordsService,
  ) {}

  // ========== 列表（admin/operator） ==========

  async listAdmin(query: {
    status?: string;
    brandId?: string;
    supplierId?: string;
    keyword?: string;
    page: number;
    pageSize: number;
  }): Promise<MediaOrderListResponse<MediaOrderAdmin>> {
    const conditions = [];
    if (query.status) conditions.push(eq(geoMediaOrders.status, query.status));
    if (query.brandId) conditions.push(eq(geoMediaOrders.brandId, query.brandId));
    if (query.supplierId) {
      conditions.push(eq(geoMediaOrders.supplierId, query.supplierId));
    }
    if (query.keyword) {
      conditions.push(
        sql`(${ilike(geoMediaOrders.title, `%${query.keyword}%`)} OR ${ilike(geoMediaOrders.orderNo, `%${query.keyword}%`)})`,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await this.db
      .select({ count: count() })
      .from(geoMediaOrders)
      .where(whereClause);
    const total = Number(countResult.count);

    const offset = (query.page - 1) * query.pageSize;

    const rows = await this.db
      .select({
        id: geoMediaOrders.id,
        orderNo: geoMediaOrders.orderNo,
        brandId: geoMediaOrders.brandId,
        channelId: geoMediaOrders.channelId,
        supplierId: geoMediaOrders.supplierId,
        title: geoMediaOrders.title,
        priceCents: geoMediaOrders.priceCents,
        costPriceCents: geoMediaOrders.costPriceCents,
        status: geoMediaOrders.status,
        supplierOrderNo: geoMediaOrders.supplierOrderNo,
        publishedUrl: geoMediaOrders.publishedUrl,
        rejectReason: geoMediaOrders.rejectReason,
        remark: geoMediaOrders.remark,
        timeline: geoMediaOrders.timeline,
        createdAt: geoMediaOrders.createdAt,
        updatedAt: geoMediaOrders.updatedAt,
        brandName: geoBrands.name,
        channelName: geoSubmissionChannels.name,
        supplierName: geoMediaSuppliers.name,
      })
      .from(geoMediaOrders)
      .leftJoin(geoBrands, eq(geoMediaOrders.brandId, geoBrands.id))
      .leftJoin(
        geoSubmissionChannels,
        eq(geoMediaOrders.channelId, geoSubmissionChannels.id),
      )
      .leftJoin(
        geoMediaSuppliers,
        eq(geoMediaOrders.supplierId, geoMediaSuppliers.id),
      )
      .where(whereClause)
      .orderBy(desc(geoMediaOrders.createdAt))
      .limit(query.pageSize)
      .offset(offset);

    const items: MediaOrderAdmin[] = rows.map((row) => ({
      id: row.id,
      orderNo: row.orderNo,
      brandId: row.brandId,
      brandName: row.brandName ?? undefined,
      channelId: row.channelId,
      channelName: row.channelName ?? undefined,
      supplierId: row.supplierId ?? undefined,
      supplierName: row.supplierName ?? undefined,
      title: row.title,
      priceCents: row.priceCents,
      costPriceCents: row.costPriceCents,
      grossProfitCents: row.priceCents - row.costPriceCents,
      status: row.status as MediaOrderStatus,
      supplierOrderNo: row.supplierOrderNo ?? undefined,
      publishedUrl: row.publishedUrl ?? undefined,
      rejectReason: row.rejectReason ?? undefined,
      remark: row.remark ?? undefined,
      timeline: (row.timeline as MediaOrderTimelineItem[]) || [],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  // ========== 列表（client） ==========

  async listClient(
    brandId: string,
    query: {
      status?: string;
      keyword?: string;
      page: number;
      pageSize: number;
    },
  ): Promise<MediaOrderListResponse<MediaOrderClient>> {
    const conditions = [eq(geoMediaOrders.brandId, brandId)];
    if (query.status) conditions.push(eq(geoMediaOrders.status, query.status));
    if (query.keyword) {
      conditions.push(
        sql`(${ilike(geoMediaOrders.title, `%${query.keyword}%`)} OR ${ilike(geoMediaOrders.orderNo, `%${query.keyword}%`)})`,
      );
    }

    const whereClause = and(...conditions);

    const [countResult] = await this.db
      .select({ count: count() })
      .from(geoMediaOrders)
      .where(whereClause);
    const total = Number(countResult.count);

    const offset = (query.page - 1) * query.pageSize;

    const rows = await this.db
      .select({
        id: geoMediaOrders.id,
        orderNo: geoMediaOrders.orderNo,
        channelId: geoMediaOrders.channelId,
        title: geoMediaOrders.title,
        priceCents: geoMediaOrders.priceCents,
        status: geoMediaOrders.status,
        publishedUrl: geoMediaOrders.publishedUrl,
        rejectReason: geoMediaOrders.rejectReason,
        remark: geoMediaOrders.remark,
        timeline: geoMediaOrders.timeline,
        createdAt: geoMediaOrders.createdAt,
        channelName: geoSubmissionChannels.name,
      })
      .from(geoMediaOrders)
      .leftJoin(
        geoSubmissionChannels,
        eq(geoMediaOrders.channelId, geoSubmissionChannels.id),
      )
      .where(whereClause)
      .orderBy(desc(geoMediaOrders.createdAt))
      .limit(query.pageSize)
      .offset(offset);

    const items: MediaOrderClient[] = rows.map((row) => ({
      id: row.id,
      orderNo: row.orderNo,
      channelId: row.channelId,
      channelName: row.channelName ?? undefined,
      title: row.title,
      priceCents: row.priceCents,
      status: row.status as MediaOrderStatus,
      publishedUrl: row.publishedUrl ?? undefined,
      rejectReason: row.rejectReason ?? undefined,
      remark: row.remark ?? undefined,
      timeline: (row.timeline as MediaOrderTimelineItem[]) || [],
      createdAt: row.createdAt.toISOString(),
    }));

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  // ========== 详情 ==========

  async getDetail(user: GeoUser, id: string): Promise<MediaOrderAdmin | MediaOrderClient> {
    const rows = await this.db
      .select({
        id: geoMediaOrders.id,
        orderNo: geoMediaOrders.orderNo,
        brandId: geoMediaOrders.brandId,
        channelId: geoMediaOrders.channelId,
        supplierId: geoMediaOrders.supplierId,
        title: geoMediaOrders.title,
        priceCents: geoMediaOrders.priceCents,
        costPriceCents: geoMediaOrders.costPriceCents,
        status: geoMediaOrders.status,
        supplierOrderNo: geoMediaOrders.supplierOrderNo,
        publishedUrl: geoMediaOrders.publishedUrl,
        rejectReason: geoMediaOrders.rejectReason,
        remark: geoMediaOrders.remark,
        timeline: geoMediaOrders.timeline,
        createdAt: geoMediaOrders.createdAt,
        updatedAt: geoMediaOrders.updatedAt,
        brandName: geoBrands.name,
        channelName: geoSubmissionChannels.name,
        supplierName: geoMediaSuppliers.name,
      })
      .from(geoMediaOrders)
      .leftJoin(geoBrands, eq(geoMediaOrders.brandId, geoBrands.id))
      .leftJoin(
        geoSubmissionChannels,
        eq(geoMediaOrders.channelId, geoSubmissionChannels.id),
      )
      .leftJoin(
        geoMediaSuppliers,
        eq(geoMediaOrders.supplierId, geoMediaSuppliers.id),
      )
      .where(eq(geoMediaOrders.id, id))
      .limit(1);

    if (!rows[0]) {
      throw new NotFoundException('订单不存在');
    }

    const row = rows[0];

    if (user.role === 'client' && row.brandId !== user.brandId) {
      throw new ForbiddenException('无权查看此订单');
    }

    if (user.role === 'client') {
      return {
        id: row.id,
        orderNo: row.orderNo,
        channelId: row.channelId,
        channelName: row.channelName ?? undefined,
        title: row.title,
        priceCents: row.priceCents,
        status: row.status as MediaOrderStatus,
        publishedUrl: row.publishedUrl ?? undefined,
        rejectReason: row.rejectReason ?? undefined,
        remark: row.remark ?? undefined,
        timeline: (row.timeline as MediaOrderTimelineItem[]) || [],
        createdAt: row.createdAt.toISOString(),
      };
    }

    return {
      id: row.id,
      orderNo: row.orderNo,
      brandId: row.brandId,
      brandName: row.brandName ?? undefined,
      channelId: row.channelId,
      channelName: row.channelName ?? undefined,
      supplierId: row.supplierId ?? undefined,
      supplierName: row.supplierName ?? undefined,
      title: row.title,
      priceCents: row.priceCents,
      costPriceCents: row.costPriceCents,
      grossProfitCents: row.priceCents - row.costPriceCents,
      status: row.status as MediaOrderStatus,
      supplierOrderNo: row.supplierOrderNo ?? undefined,
      publishedUrl: row.publishedUrl ?? undefined,
      rejectReason: row.rejectReason ?? undefined,
      remark: row.remark ?? undefined,
      timeline: (row.timeline as MediaOrderTimelineItem[]) || [],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  // ========== 创建订单（client） ==========

  async createOrder(
    brandId: string,
    dto: CreateMediaOrderRequest,
  ): Promise<MediaOrderClient> {
    const result = await this.db.transaction(async (tx) => {
      // 1. 查渠道
      const [channel] = await tx
        .select()
        .from(geoSubmissionChannels)
        .where(eq(geoSubmissionChannels.id, dto.channelId))
        .limit(1);

      if (!channel) {
        throw new BadRequestException('渠道不存在');
      }
      if (!channel.sellable) {
        throw new BadRequestException('该渠道暂不可下单');
      }
      if (!channel.salePriceCents || channel.salePriceCents <= 0) {
        throw new BadRequestException('渠道价格无效');
      }

      const salePriceCents = channel.salePriceCents;
      const costPriceCents = channel.costPriceCents ?? 0;
      const supplierId = channel.supplierId ?? undefined;

      // 2. 生成订单号
      const orderNo = this.generateOrderNo();

      // 3. 冻结余额（同一事务）
      await this.walletService.freezeBalance(brandId, salePriceCents, tx);

      // 4. 创建订单
      const now = new Date();
      const initialTimeline: MediaOrderTimelineItem[] = [
        { status: 'paid', time: now.toISOString(), note: '订单创建，已支付' },
      ];

      const [order] = await tx
        .insert(geoMediaOrders)
        .values({
          orderNo,
          brandId,
          channelId: dto.channelId,
          title: dto.title,
          content: dto.content,
          imageUrls: dto.imageUrls ?? [],
          remark: dto.remark,
          priceCents: salePriceCents,
          costPriceCents,
          supplierId,
          status: 'paid',
          articleId: dto.articleId ?? undefined,
          source: dto.source ?? 'manual',
          taskId: dto.taskId ?? undefined,
          frozenAmountCents: salePriceCents,
          timeline: initialTimeline as any,
        })
        .returning();

      return { order, channelName: channel.name };
    });

    // 生成投放记录（幂等）
    await this.placementRecordsService.createFromOrder(
      result.order,
      result.channelName,
    );

    return {
      id: result.order.id,
      orderNo: result.order.orderNo,
      channelId: result.order.channelId,
      channelName: result.channelName,
      title: result.order.title,
      priceCents: result.order.priceCents,
      status: result.order.status as MediaOrderStatus,
      publishedUrl: result.order.publishedUrl ?? undefined,
      rejectReason: result.order.rejectReason ?? undefined,
      remark: result.order.remark ?? undefined,
      timeline: (result.order.timeline as MediaOrderTimelineItem[]) || [],
      createdAt: result.order.createdAt.toISOString(),
    };
  }

  // ========== 批量创建订单（一键发稿） ==========

  async batchCreateOrders(
    brandId: string,
    dto: { articleIds: string[]; channelIds: string[]; remark?: string },
  ): Promise<BatchCreateOrdersResponse> {
    if (dto.articleIds.length === 0 || dto.channelIds.length === 0) {
      throw new BadRequestException('文章和渠道都不能为空');
    }

    const result = await this.db.transaction(async (tx) => {
      // 1. 查文章（属于该品牌）
      const articles = await tx
        .select({
          id: geoArticles.id,
          title: geoArticles.title,
          content: geoArticles.content,
          coverImage: geoArticles.coverImage,
        })
        .from(geoArticles)
        .where(
          and(
            eq(geoArticles.brandId, brandId),
            inArray(geoArticles.id, dto.articleIds),
          ),
        );

      if (articles.length !== dto.articleIds.length) {
        throw new BadRequestException('部分文章不存在或不属于该品牌');
      }

      // 2. 查渠道（在售）
      const channels = await tx
        .select()
        .from(geoSubmissionChannels)
        .where(inArray(geoSubmissionChannels.id, dto.channelIds));

      const validChannels = channels.filter((c) => c.sellable && c.salePriceCents && c.salePriceCents > 0);
      if (validChannels.length !== dto.channelIds.length) {
        throw new BadRequestException('部分渠道不存在或暂不可下单');
      }

      // 3. 计算总金额并一次性冻结
      const totalCents = validChannels.reduce((sum: number, c) => sum + (c.salePriceCents ?? 0), 0) * articles.length;
      await this.walletService.freezeBalance(brandId, totalCents, tx);

      // 4. 批量生成订单
      const orderIds: string[] = [];
      const errors: string[] = [];
      const now = new Date();

      for (const article of articles) {
        for (const channel of validChannels) {
          try {
            const orderNo = this.generateOrderNo();
            const salePriceCents = channel.salePriceCents ?? 0;
            const costPriceCents = channel.costPriceCents ?? 0;
            const initialTimeline: MediaOrderTimelineItem[] = [
              { status: 'paid', time: now.toISOString(), note: '订单创建，已支付' },
            ];

            const [order] = await tx
              .insert(geoMediaOrders)
              .values({
                orderNo,
                brandId,
                channelId: channel.id,
                supplierId: channel.supplierId ?? undefined,
                title: article.title,
                content: article.content,
                imageUrls: article.coverImage ? [article.coverImage] : [],
                remark: dto.remark,
                priceCents: salePriceCents,
                costPriceCents,
                status: 'paid',
                articleId: article.id,
                source: 'batch_publish',
                frozenAmountCents: salePriceCents,
                timeline: initialTimeline as any,
              })
              .returning({ id: geoMediaOrders.id });

            orderIds.push(order.id);
          } catch (err) {
            errors.push(`${article.title} × ${channel.name}: ${(err as Error).message}`);
          }
        }
      }

      return { orderIds, errors, totalCents };
    });

    // 为成功创建的订单生成投放记录（幂等，失败不影响主流程）
    if (result.orderIds.length > 0) {
      try {
        const successOrders = await this.db
          .select()
          .from(geoMediaOrders)
          .where(inArray(geoMediaOrders.id, result.orderIds));
        await Promise.all(
          successOrders.map((order) =>
            this.placementRecordsService.createFromOrder(order, ''),
          ),
        );
      } catch (err) {
        // 静默失败，不影响主流程
      }
    }

    return {
      successCount: result.orderIds.length,
      failedCount: result.errors.length,
      orderIds: result.orderIds,
      errors: result.errors,
    };
  }

  // ========== 接单 ==========

  async acceptOrder(
    id: string,
    operatorId: string,
  ): Promise<MediaOrderAdmin> {
    const order = await this.findOrderOrThrow(id);

    if (order.status !== 'paid') {
      throw new BadRequestException('当前订单状态不可接单');
    }

    const now = new Date();
    const currentTimeline = (order.timeline as MediaOrderTimelineItem[]) || [];
    const newTimeline = [
      ...currentTimeline,
      {
        status: 'placing',
        time: now.toISOString(),
        operatorId,
        note: '已接单，发布中',
      },
    ];

    const [updated] = await this.db
      .update(geoMediaOrders)
      .set({
        status: 'placing',
        timeline: newTimeline as any,
      })
      .where(eq(geoMediaOrders.id, id))
      .returning();

    return this.toAdminDto(updated);
  }

  // ========== 提交供应商 ==========

  async submitSupplier(
    id: string,
    supplierOrderNo: string,
    operatorId: string,
  ): Promise<MediaOrderAdmin> {
    const order = await this.findOrderOrThrow(id);

    if (order.status !== 'placing') {
      throw new BadRequestException('当前订单状态不可提交供应商');
    }

    const now = new Date();
    const currentTimeline = (order.timeline as MediaOrderTimelineItem[]) || [];
    const newTimeline = [
      ...currentTimeline,
      {
        status: 'placing',
        time: now.toISOString(),
        operatorId,
        note: `提交供应商，供应商单号：${supplierOrderNo}`,
      },
    ];

    const [updated] = await this.db
      .update(geoMediaOrders)
      .set({
        supplierOrderNo,
        timeline: newTimeline as any,
      })
      .where(eq(geoMediaOrders.id, id))
      .returning();

    return this.toAdminDto(updated);
  }

  // ========== 标记已发布 ==========

  async publishOrder(
    id: string,
    publishedUrl: string,
    operatorId: string,
  ): Promise<MediaOrderAdmin> {
    const order = await this.findOrderOrThrow(id);

    if (order.status !== 'paid' && order.status !== 'placing') {
      throw new BadRequestException('当前订单状态不可标记发布');
    }

    const result = await this.db.transaction(async (tx) => {
      const now = new Date();
      const currentTimeline = (order.timeline as MediaOrderTimelineItem[]) || [];
      const newTimeline = [
        ...currentTimeline,
        {
          status: 'published',
          time: now.toISOString(),
          operatorId,
          note: `已发布，链接：${publishedUrl}`,
        },
      ];

      const [updated] = await tx
        .update(geoMediaOrders)
        .set({
          status: 'published',
          publishedUrl,
          timeline: newTimeline as any,
        })
        .where(eq(geoMediaOrders.id, id))
        .returning();

      // 扣冻结（同一事务）
      await this.walletService.consumeFrozen(
        order.brandId,
        order.priceCents,
        order.id,
        '发稿完成扣款',
        tx,
      );

      return updated;
    });

    // 生成投放记录（幂等：paid 时已创建则跳过，published 时更新发布链接会被跳过但记录已在）
    await this.placementRecordsService.createFromOrder(result, '');

    return this.toAdminDto(result);
  }
  // ========== 驳回退款 ==========

  async rejectRefund(
    id: string,
    rejectReason: string,
    operatorId: string,
  ): Promise<MediaOrderAdmin> {
    const order = await this.findOrderOrThrow(id);

    if (order.status !== 'paid' && order.status !== 'placing') {
      throw new BadRequestException('当前订单状态不可驳回退款');
    }

    const result = await this.db.transaction(async (tx) => {
      const now = new Date();
      const currentTimeline = (order.timeline as MediaOrderTimelineItem[]) || [];
      const newTimeline = [
        ...currentTimeline,
        {
          status: 'refunded',
          time: now.toISOString(),
          operatorId,
          note: `驳回退款：${rejectReason}`,
        },
      ];

      const [updated] = await tx
        .update(geoMediaOrders)
        .set({
          status: 'refunded',
          rejectReason,
          timeline: newTimeline as any,
        })
        .where(eq(geoMediaOrders.id, id))
        .returning();

      // 退款（同一事务）
      await this.walletService.refund(
        order.brandId,
        order.priceCents,
        order.id,
        rejectReason,
        tx,
      );

      return updated;
    });

    return this.toAdminDto(result);
  }

  // ========== helpers ==========

  private async findOrderOrThrow(id: string): Promise<OrderRow> {
    const [order] = await this.db
      .select()
      .from(geoMediaOrders)
      .where(eq(geoMediaOrders.id, id))
      .limit(1);

    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    return order;
  }

  private async toAdminDto(order: OrderRow): Promise<MediaOrderAdmin> {
    const rows = await this.db
      .select({
        brandName: geoBrands.name,
        channelName: geoSubmissionChannels.name,
        supplierName: geoMediaSuppliers.name,
      })
      .from(geoMediaOrders)
      .leftJoin(geoBrands, eq(geoMediaOrders.brandId, geoBrands.id))
      .leftJoin(
        geoSubmissionChannels,
        eq(geoMediaOrders.channelId, geoSubmissionChannels.id),
      )
      .leftJoin(
        geoMediaSuppliers,
        eq(geoMediaOrders.supplierId, geoMediaSuppliers.id),
      )
      .where(eq(geoMediaOrders.id, order.id))
      .limit(1);

    const row = rows[0];

    return {
      id: order.id,
      orderNo: order.orderNo,
      brandId: order.brandId,
      brandName: row?.brandName ?? undefined,
      channelId: order.channelId,
      channelName: row?.channelName ?? undefined,
      supplierId: order.supplierId ?? undefined,
      supplierName: row?.supplierName ?? undefined,
      title: order.title,
      priceCents: order.priceCents,
      costPriceCents: order.costPriceCents,
      grossProfitCents: order.priceCents - order.costPriceCents,
      status: order.status as MediaOrderStatus,
      supplierOrderNo: order.supplierOrderNo ?? undefined,
      publishedUrl: order.publishedUrl ?? undefined,
      rejectReason: order.rejectReason ?? undefined,
      remark: order.remark ?? undefined,
      timeline: (order.timeline as MediaOrderTimelineItem[]) || [],
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }

  private generateOrderNo(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const datePart = `${year}${month}${day}`;

    // 7 位随机大写字母数字
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const bytes = randomBytes(7);
    let randomPart = '';
    for (let i = 0; i < 7; i++) {
      randomPart += chars[bytes[i] % chars.length];
    }

    return `MD${datePart}${randomPart}`;
  }
}
