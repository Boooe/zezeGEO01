import {
  Inject,
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { eq, desc, and, count, sql, gte, lt } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';

import {
  geoCustomerWallets,
  geoWalletTransactions,
  geoRechargeApplications,
  geoBrands,
  geoMediaOrders,
} from '@server/database/schema';
import type {
  CustomerWallet,
  WalletTransaction,
  WalletTransactionListResponse,
  RechargeApplication,
  RechargeApplicationListResponse,
  RechargeStatsResponse,
  WalletTxType,
  RechargeStatus,
  GeoUser,
} from '@shared/api.interface';
import dayjs from 'dayjs';

type CustomerWalletRow = typeof geoCustomerWallets.$inferSelect;

// Executor 可以是 db 或事务 tx，两者共享相同的查询接口
type WalletDbExecutor = PostgresJsDatabase | PgTransaction<any, any, any>;

@Injectable()
export class MediaWalletService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  // ========== 钱包 ==========

  async getOrCreateWallet(brandId: string): Promise<CustomerWalletRow> {
    const existing = await this.db
      .select()
      .from(geoCustomerWallets)
      .where(eq(geoCustomerWallets.brandId, brandId))
      .limit(1);

    if (existing[0]) return existing[0];

    const [created] = await this.db
      .insert(geoCustomerWallets)
      .values({ brandId })
      .onConflictDoNothing({ target: geoCustomerWallets.brandId })
      .returning();

    if (created) return created;

    // 并发插入兜底：再查一次
    const fallback = await this.db
      .select()
      .from(geoCustomerWallets)
      .where(eq(geoCustomerWallets.brandId, brandId))
      .limit(1);
    if (!fallback[0]) {
      throw new ConflictException('创建钱包失败');
    }
    return fallback[0];
  }

  async getWallet(user: GeoUser, brandId?: string): Promise<CustomerWallet> {
    let targetBrandId: string;

    if (user.role === 'client') {
      targetBrandId = user.brandId!;
    } else {
      if (!brandId) {
        throw new BadRequestException('brandId 不能为空');
      }
      targetBrandId = brandId;
    }

    const wallet = await this.getOrCreateWallet(targetBrandId);
    return this.toWalletDto(wallet);
  }

  async getWalletTransactions(
    user: GeoUser,
    query: {
      page: number;
      pageSize: number;
      brandId?: string;
      type?: WalletTxType;
    },
  ): Promise<WalletTransactionListResponse> {
    let targetBrandId: string | undefined;

    if (user.role === 'client') {
      targetBrandId = user.brandId!;
    } else if (query.brandId) {
      targetBrandId = query.brandId;
    }

    // 先取 wallet id
    let walletId: string | undefined;
    if (targetBrandId) {
      const wallet = await this.db
        .select({ id: geoCustomerWallets.id })
        .from(geoCustomerWallets)
        .where(eq(geoCustomerWallets.brandId, targetBrandId))
        .limit(1);
      if (!wallet[0]) {
        return { items: [], total: 0, page: query.page, pageSize: query.pageSize };
      }
      walletId = wallet[0].id;
    }

    const conditions = [];
    if (walletId) conditions.push(eq(geoWalletTransactions.walletId, walletId));
    if (query.type) conditions.push(eq(geoWalletTransactions.type, query.type));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await this.db
      .select({ count: count() })
      .from(geoWalletTransactions)
      .where(whereClause);
    const total = Number(countResult.count);

    const offset = (query.page - 1) * query.pageSize;

    const txRows = await this.db
      .select({
        id: geoWalletTransactions.id,
        walletId: geoWalletTransactions.walletId,
        type: geoWalletTransactions.type,
        amountCents: geoWalletTransactions.amountCents,
        balanceAfterCents: geoWalletTransactions.balanceAfterCents,
        orderId: geoWalletTransactions.orderId,
        rechargeId: geoWalletTransactions.rechargeId,
        note: geoWalletTransactions.note,
        createdAt: geoWalletTransactions.createdAt,
      })
      .from(geoWalletTransactions)
      .where(whereClause)
      .orderBy(desc(geoWalletTransactions.createdAt))
      .limit(query.pageSize)
      .offset(offset);

    // 关联 order_no
    const orderIds = txRows
      .filter((t) => t.orderId)
      .map((t) => t.orderId as string);

    let orderNoMap: Record<string, string> = {};
    if (orderIds.length > 0) {
      const orders = await this.db
        .select({ id: geoMediaOrders.id, orderNo: geoMediaOrders.orderNo })
        .from(geoMediaOrders)
        .where(sql`${geoMediaOrders.id} = ANY(${sql`ARRAY[${sql.join(orderIds.map(id => sql`${id}`), sql`, `)}]::uuid[]`})`);
      orderNoMap = Object.fromEntries(
        orders.map((o) => [o.id, o.orderNo]),
      );
    }

    const items: WalletTransaction[] = txRows.map((row) => ({
      id: row.id,
      type: row.type as WalletTxType,
      amountCents: Number(row.amountCents),
      balanceAfterCents: Number(row.balanceAfterCents),
      orderId: row.orderId ?? undefined,
      orderNo: row.orderId ? orderNoMap[row.orderId] ?? undefined : undefined,
      note: row.note ?? undefined,
      createdAt: row.createdAt.toISOString(),
    }));

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  // ========== 充值申请 ==========

  async applyRecharge(
    brandId: string,
    amountYuan: number,
  ): Promise<{ id: string; applyAmountCents: number; status: string }> {
    if (amountYuan % 100 !== 0) {
      throw new BadRequestException('充值金额必须是 100 元的整数倍');
    }
    const applyAmountCents = Math.round(amountYuan * 100);

    const [row] = await this.db
      .insert(geoRechargeApplications)
      .values({
        brandId,
        applyAmountCents,
        status: 'pending',
      })
      .returning({
        id: geoRechargeApplications.id,
        applyAmountCents: geoRechargeApplications.applyAmountCents,
        status: geoRechargeApplications.status,
      });

    return {
      id: row.id,
      applyAmountCents: Number(row.applyAmountCents),
      status: row.status,
    };
  }

  async listRechargeApplications(
    user: GeoUser,
    query: {
      page: number;
      pageSize: number;
      status?: RechargeStatus;
      brandId?: string;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<RechargeApplicationListResponse> {
    const conditions = [];

    if (user.role === 'client') {
      conditions.push(eq(geoRechargeApplications.brandId, user.brandId!));
    } else if (query.brandId) {
      conditions.push(eq(geoRechargeApplications.brandId, query.brandId));
    }

    if (query.status) {
      conditions.push(eq(geoRechargeApplications.status, query.status));
    }

    if (query.startDate) {
      conditions.push(
        gte(geoRechargeApplications.createdAt, new Date(query.startDate)),
      );
    }
    if (query.endDate) {
      const endDay = dayjs(query.endDate).add(1, 'day').toDate();
      conditions.push(lt(geoRechargeApplications.createdAt, endDay));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await this.db
      .select({ count: count() })
      .from(geoRechargeApplications)
      .where(whereClause);
    const total = Number(countResult.count);

    const offset = (query.page - 1) * query.pageSize;

    const rows = await this.db
      .select({
        id: geoRechargeApplications.id,
        brandId: geoRechargeApplications.brandId,
        applyAmountCents: geoRechargeApplications.applyAmountCents,
        actualAmountCents: geoRechargeApplications.actualAmountCents,
        status: geoRechargeApplications.status,
        rejectReason: geoRechargeApplications.rejectReason,
        remark: geoRechargeApplications.remark,
        createdAt: geoRechargeApplications.createdAt,
        auditedAt: geoRechargeApplications.auditedAt,
        brandName: geoBrands.name,
      })
      .from(geoRechargeApplications)
      .leftJoin(
        geoBrands,
        eq(geoRechargeApplications.brandId, geoBrands.id),
      )
      .where(whereClause)
      .orderBy(desc(geoRechargeApplications.createdAt))
      .limit(query.pageSize)
      .offset(offset);

    const items: RechargeApplication[] = rows.map((row) => ({
      id: row.id,
      brandId: row.brandId,
      brandName: row.brandName ?? undefined,
      applyAmountCents: Number(row.applyAmountCents),
      actualAmountCents:
        row.actualAmountCents != null ? Number(row.actualAmountCents) : undefined,
      status: row.status as RechargeStatus,
      rejectReason: row.rejectReason ?? undefined,
      remark: row.remark ?? undefined,
      createdAt: row.createdAt.toISOString(),
      auditedAt: row.auditedAt ? row.auditedAt.toISOString() : undefined,
    }));

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async getRechargeApplication(
    user: GeoUser,
    id: string,
  ): Promise<RechargeApplication> {
    const row = await this.db
      .select({
        id: geoRechargeApplications.id,
        brandId: geoRechargeApplications.brandId,
        applyAmountCents: geoRechargeApplications.applyAmountCents,
        actualAmountCents: geoRechargeApplications.actualAmountCents,
        status: geoRechargeApplications.status,
        rejectReason: geoRechargeApplications.rejectReason,
        remark: geoRechargeApplications.remark,
        createdAt: geoRechargeApplications.createdAt,
        auditedAt: geoRechargeApplications.auditedAt,
        brandName: geoBrands.name,
      })
      .from(geoRechargeApplications)
      .leftJoin(
        geoBrands,
        eq(geoRechargeApplications.brandId, geoBrands.id),
      )
      .where(eq(geoRechargeApplications.id, id))
      .limit(1);

    if (!row[0]) {
      throw new NotFoundException('充值申请不存在');
    }

    if (user.role === 'client' && row[0].brandId !== user.brandId) {
      throw new ForbiddenException('无权查看此申请');
    }

    return {
      id: row[0].id,
      brandId: row[0].brandId,
      brandName: row[0].brandName ?? undefined,
      applyAmountCents: Number(row[0].applyAmountCents),
      actualAmountCents:
        row[0].actualAmountCents != null ? Number(row[0].actualAmountCents) : undefined,
      status: row[0].status as RechargeStatus,
      rejectReason: row[0].rejectReason ?? undefined,
      remark: row[0].remark ?? undefined,
      createdAt: row[0].createdAt.toISOString(),
      auditedAt: row[0].auditedAt ? row[0].auditedAt.toISOString() : undefined,
    };
  }

  async getRechargeStats(user: GeoUser): Promise<RechargeStatsResponse> {
    const brandFilter =
      user.role === 'client' && user.brandId
        ? sql`AND brand_id = ${user.brandId}::uuid`
        : sql``;

    const row = await this.db.execute(sql<{
      pending_count: string;
      pending_amount_cents: string;
      month_approved_amount_cents: string;
    }>`
      SELECT
        COALESCE(count(*) FILTER (WHERE status = 'pending'), 0) AS pending_count,
        COALESCE(SUM(apply_amount_cents) FILTER (WHERE status = 'pending'), 0) AS pending_amount_cents,
        COALESCE(SUM(actual_amount_cents) FILTER (
          WHERE status = 'approved'
            AND date_trunc('month', audited_at) = date_trunc('month', CURRENT_TIMESTAMP)
        ), 0) AS month_approved_amount_cents
      FROM geo_recharge_applications
      WHERE 1=1 ${brandFilter}
    `);

    const r = row[0];
    return {
      pendingCount: Number(r?.pending_count ?? 0),
      pendingAmountCents: Number(r?.pending_amount_cents ?? 0),
      monthApprovedAmountCents: Number(r?.month_approved_amount_cents ?? 0),
    };
  }

  async approveRecharge(
    id: string,
    auditorId: string,
    actualAmountYuan?: number,
  ): Promise<RechargeApplication> {
    const app = await this.db
      .select()
      .from(geoRechargeApplications)
      .where(eq(geoRechargeApplications.id, id))
      .limit(1);

    if (!app[0]) {
      throw new NotFoundException('充值申请不存在');
    }
    if (app[0].status !== 'pending') {
      throw new BadRequestException('该申请已处理');
    }

    const applyAmount = Number(app[0].applyAmountCents);
    const actualAmountCents =
      actualAmountYuan != null
        ? Math.round(actualAmountYuan * 100)
        : applyAmount;

    const result = await this.db.transaction(async (tx) => {
      // 1. 原子更新钱包余额；钱包不存在时创建并初始化为充值金额
      const updated = await tx
        .update(geoCustomerWallets)
        .set({
          balanceCents: sql`${geoCustomerWallets.balanceCents} + ${actualAmountCents}::bigint`,
          totalRechargedCents: sql`${geoCustomerWallets.totalRechargedCents} + ${actualAmountCents}::bigint`,
        })
        .where(eq(geoCustomerWallets.brandId, app[0].brandId))
        .returning({
          id: geoCustomerWallets.id,
          balanceCents: geoCustomerWallets.balanceCents,
        });

      let walletId: string;
      let newBalance: number;

      if (updated[0]) {
        walletId = updated[0].id;
        newBalance = Number(updated[0].balanceCents);
      } else {
        const [created] = await tx
          .insert(geoCustomerWallets)
          .values({
            brandId: app[0].brandId,
            balanceCents: actualAmountCents,
            totalRechargedCents: actualAmountCents,
          })
          .returning({
            id: geoCustomerWallets.id,
            balanceCents: geoCustomerWallets.balanceCents,
          });
        walletId = created.id;
        newBalance = Number(created.balanceCents);
      }

      // 2. 写流水
      await tx.insert(geoWalletTransactions).values({
        walletId,
        type: 'recharge',
        amountCents: actualAmountCents,
        balanceAfterCents: newBalance,
        rechargeId: app[0].id,
        note: '充值入账',
        operatorId: auditorId,
      });

      // 3. 更新申请单
      const now = new Date();
      const [updatedApp] = await tx
        .update(geoRechargeApplications)
        .set({
          status: 'approved',
          actualAmountCents,
          auditorId,
          auditedAt: now,
        })
        .where(eq(geoRechargeApplications.id, id))
        .returning();

      return updatedApp;
    });

    const brandRow = await this.db
      .select({ name: geoBrands.name })
      .from(geoBrands)
      .where(eq(geoBrands.id, result.brandId))
      .limit(1);

    return {
      id: result.id,
      brandId: result.brandId,
      brandName: brandRow[0]?.name ?? undefined,
      applyAmountCents: Number(result.applyAmountCents),
      actualAmountCents:
        result.actualAmountCents != null ? Number(result.actualAmountCents) : undefined,
      status: result.status as RechargeStatus,
      rejectReason: result.rejectReason ?? undefined,
      remark: result.remark ?? undefined,
      createdAt: result.createdAt.toISOString(),
      auditedAt: result.auditedAt ? result.auditedAt.toISOString() : undefined,
    };
  }

  async rejectRecharge(
    id: string,
    auditorId: string,
    rejectReason: string,
  ): Promise<RechargeApplication> {
    const app = await this.db
      .select()
      .from(geoRechargeApplications)
      .where(eq(geoRechargeApplications.id, id))
      .limit(1);

    if (!app[0]) {
      throw new NotFoundException('充值申请不存在');
    }
    if (app[0].status !== 'pending') {
      throw new BadRequestException('该申请已处理');
    }

    const now = new Date();
    const [updated] = await this.db
      .update(geoRechargeApplications)
      .set({
        status: 'rejected',
        rejectReason,
        auditorId,
        auditedAt: now,
      })
      .where(eq(geoRechargeApplications.id, id))
      .returning();

    const brandRow = await this.db
      .select({ name: geoBrands.name })
      .from(geoBrands)
      .where(eq(geoBrands.id, updated.brandId))
      .limit(1);

    return {
      id: updated.id,
      brandId: updated.brandId,
      brandName: brandRow[0]?.name ?? undefined,
      applyAmountCents: Number(updated.applyAmountCents),
      actualAmountCents:
        updated.actualAmountCents != null ? Number(updated.actualAmountCents) : undefined,
      status: updated.status as RechargeStatus,
      rejectReason: updated.rejectReason ?? undefined,
      remark: updated.remark ?? undefined,
      createdAt: updated.createdAt.toISOString(),
      auditedAt: updated.auditedAt ? updated.auditedAt.toISOString() : undefined,
    };
  }

  // ========== 内部方法（供订单模块调用） ==========

  /**
   * 冻结余额：原子 UPDATE，并发安全。
   * @param tx 可选外部事务；不传则自己开事务
   */
  async freezeBalance(
    brandId: string,
    amountCents: number,
    tx?: WalletDbExecutor,
  ): Promise<void> {
    const run = async (executor: WalletDbExecutor): Promise<void> => {
      const updated = await executor
        .update(geoCustomerWallets)
        .set({
          balanceCents: sql`${geoCustomerWallets.balanceCents} - ${amountCents}::bigint`,
          frozenCents: sql`${geoCustomerWallets.frozenCents} + ${amountCents}::bigint`,
        })
        .where(
          and(
            eq(geoCustomerWallets.brandId, brandId),
            sql`${geoCustomerWallets.balanceCents} >= ${amountCents}::bigint`,
          ),
        )
        .returning({
          id: geoCustomerWallets.id,
          balanceCents: geoCustomerWallets.balanceCents,
        });

      if (updated.length > 0) return;

      // 0 行受影响：区分「钱包不存在」和「余额不足」
      const existing = await executor
        .select({ id: geoCustomerWallets.id })
        .from(geoCustomerWallets)
        .where(eq(geoCustomerWallets.brandId, brandId))
        .limit(1);

      if (!existing[0]) {
        throw new NotFoundException('钱包不存在');
      }
      throw new ConflictException('余额不足');
    };

    if (tx) {
      await run(tx);
    } else {
      await this.db.transaction(run);
    }
  }

  /**
   * 扣减冻结余额（真正消费）：原子 UPDATE，并发安全。
   * @param tx 可选外部事务；不传则自己开事务
   */
  async consumeFrozen(
    brandId: string,
    amountCents: number,
    orderId: string,
    note?: string,
    tx?: WalletDbExecutor,
  ): Promise<void> {
    const run = async (executor: WalletDbExecutor): Promise<void> => {
      const updated = await executor
        .update(geoCustomerWallets)
        .set({
          frozenCents: sql`${geoCustomerWallets.frozenCents} - ${amountCents}::bigint`,
          totalSpentCents: sql`${geoCustomerWallets.totalSpentCents} + ${amountCents}::bigint`,
        })
        .where(
          and(
            eq(geoCustomerWallets.brandId, brandId),
            sql`${geoCustomerWallets.frozenCents} >= ${amountCents}::bigint`,
          ),
        )
        .returning({
          id: geoCustomerWallets.id,
          balanceCents: geoCustomerWallets.balanceCents,
        });

      if (updated.length === 0) {
        // 区分「钱包不存在」和「冻结余额不足」
        const existing = await executor
          .select({ id: geoCustomerWallets.id })
          .from(geoCustomerWallets)
          .where(eq(geoCustomerWallets.brandId, brandId))
          .limit(1);

        if (!existing[0]) {
          throw new NotFoundException('钱包不存在');
        }
        throw new ConflictException('冻结余额不足');
      }

      // 写流水（消费）
      await executor.insert(geoWalletTransactions).values({
        walletId: updated[0].id,
        type: 'consume',
        amountCents,
        balanceAfterCents: Number(updated[0].balanceCents),
        orderId,
        note: note ?? '订单消费',
      });
    };

    if (tx) {
      await run(tx);
    } else {
      await this.db.transaction(run);
    }
  }

  /**
   * 退款（解冻，从 frozen 回 balance）：原子 UPDATE，并发安全。
   * @param tx 可选外部事务；不传则自己开事务
   */
  async refund(
    brandId: string,
    amountCents: number,
    orderId: string,
    reason?: string,
    tx?: WalletDbExecutor,
  ): Promise<void> {
    const run = async (executor: WalletDbExecutor): Promise<void> => {
      const updated = await executor
        .update(geoCustomerWallets)
        .set({
          balanceCents: sql`${geoCustomerWallets.balanceCents} + ${amountCents}::bigint`,
          frozenCents: sql`${geoCustomerWallets.frozenCents} - ${amountCents}::bigint`,
        })
        .where(
          and(
            eq(geoCustomerWallets.brandId, brandId),
            sql`${geoCustomerWallets.frozenCents} >= ${amountCents}::bigint`,
          ),
        )
        .returning({
          id: geoCustomerWallets.id,
          balanceCents: geoCustomerWallets.balanceCents,
        });

      if (updated.length === 0) {
        // 区分「钱包不存在」和「冻结余额不足」
        const existing = await executor
          .select({ id: geoCustomerWallets.id })
          .from(geoCustomerWallets)
          .where(eq(geoCustomerWallets.brandId, brandId))
          .limit(1);

        if (!existing[0]) {
          throw new NotFoundException('钱包不存在');
        }
        throw new ConflictException('冻结余额不足');
      }

      // 写流水（退款）
      await executor.insert(geoWalletTransactions).values({
        walletId: updated[0].id,
        type: 'refund',
        amountCents,
        balanceAfterCents: Number(updated[0].balanceCents),
        orderId,
        note: reason ?? '订单退款',
      });
    };

    if (tx) {
      await run(tx);
    } else {
      await this.db.transaction(run);
    }
  }

  // ========== helpers ==========

  private toWalletDto(row: CustomerWalletRow): CustomerWallet {
    return {
      id: row.id,
      brandId: row.brandId,
      balanceCents: Number(row.balanceCents),
      frozenCents: Number(row.frozenCents),
      totalRechargedCents: Number(row.totalRechargedCents),
      totalSpentCents: Number(row.totalSpentCents),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
