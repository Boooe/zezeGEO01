import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import {
  eq,
  and,
  ilike,
  sql,
  inArray,
  desc,
  asc,
  gte,
  lt,
  count,
  sum,
} from 'drizzle-orm';
import dayjs from 'dayjs';

import {
  geoCreditAccounts,
  geoCreditTransactions,
  geoBrands,
  geoCreditPlans,
} from '@server/database/schema';
import type {
  CreditOverviewStats,
  CreditBrandRow,
  CreditOverviewResponse,
  CreditHealthStatus,
  BatchRechargeResult,
  ConsumptionRankItem,
  MonthlyBillRow,
  MonthlyBillResponse,
} from '@shared/api.interface';

const CONSUMPTION_TYPES = [
  'article_generate',
  'image_generate',
  'video_script',
  'video_generate',
];

const RECHARGE_TYPES = [
  'manual_recharge',
  'recharge',
  'plan_grant',
  'adjustment',
];

function validateMonth(month: string): string {
  const re = /^\d{4}-\d{2}$/;
  if (!re.test(month)) {
    throw new BadRequestException('月份格式错误，应为 YYYY-MM');
  }
  const d = dayjs(month + '-01');
  if (!d.isValid() || d.format('YYYY-MM') !== month) {
    throw new BadRequestException('月份格式错误，应为 YYYY-MM');
  }
  return month;
}

function getHealthStatus(balance: number): CreditHealthStatus {
  if (balance > 50000) return 'sufficient';
  if (balance > 10000) return 'low';
  return 'critical';
}

@Injectable()
export class CreditAdminService {
  private readonly logger = new Logger(CreditAdminService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async getOverview(query: {
    page?: number;
    pageSize?: number;
    keyword?: string;
    healthStatus?: CreditHealthStatus;
  }): Promise<CreditOverviewResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const accountAlias = geoCreditAccounts;
    const brandAlias = geoBrands;
    const planAlias = geoCreditPlans;

    // 基础条件
    const conditions = [];
    conditions.push(eq(brandAlias.status, 'active'));

    if (query.keyword) {
      const kw = `%${query.keyword}%`;
      conditions.push(
        sql`(${
          ilike(brandAlias.name, kw)
        } OR ${
          ilike(brandAlias.companyName, kw)
        })`,
      );
    }

    // 健康状态过滤
    if (query.healthStatus === 'sufficient') {
      conditions.push(sql`${accountAlias.balance}::numeric > 50000`);
    } else if (query.healthStatus === 'low') {
      conditions.push(
        sql`${accountAlias.balance}::numeric > 10000 AND ${accountAlias.balance}::numeric <= 50000`,
      );
    } else if (query.healthStatus === 'critical') {
      conditions.push(sql`${accountAlias.balance}::numeric <= 10000`);
    }

    // 主查询：账户 + 品牌 + 套餐
    const baseQuery = this.db
      .select({
        brandId: accountAlias.brandId,
        brandName: brandAlias.name,
        companyName: brandAlias.companyName,
        planName: planAlias.planName,
        balance: accountAlias.balance,
      })
      .from(accountAlias)
      .innerJoin(brandAlias, eq(accountAlias.brandId, brandAlias.id))
      .leftJoin(planAlias, eq(accountAlias.currentPlanId, planAlias.id))
      .where(and(...conditions));

    // count 查询
    const countResult = await this.db
      .select({ count: count() })
      .from(accountAlias)
      .innerJoin(brandAlias, eq(accountAlias.brandId, brandAlias.id))
      .where(and(...conditions));

    const total = Number(countResult[0]?.count ?? 0);

    // 分页行：按 balance 升序（告急的排前面）
    const rows = await baseQuery
      .orderBy(asc(sql`${accountAlias.balance}::numeric`))
      .limit(pageSize)
      .offset(offset);

    // 即使没有数据，也要返回 stats
    const stats = await this.getOverviewStats();

    if (rows.length === 0) {
      return { stats, items: [], total };
    }

    const brandIds = rows.map((row) => row.brandId as string);
    const monthStartDate = dayjs().startOf('month').toDate();
    const nextMonthStartDate = dayjs().add(1, 'month').startOf('month').toDate();

    // 本月消耗：按 brand 聚合
    const consumedRows = await this.db
      .select({
        brandId: geoCreditTransactions.brandId,
        amount: sum(geoCreditTransactions.changeAmount).as('amount'),
      })
      .from(geoCreditTransactions)
      .where(
        and(
          inArray(geoCreditTransactions.brandId, brandIds),
          inArray(geoCreditTransactions.transactionType, CONSUMPTION_TYPES),
          gte(geoCreditTransactions.createdAt, monthStartDate),
          lt(geoCreditTransactions.createdAt, nextMonthStartDate),
        ),
      )
      .groupBy(geoCreditTransactions.brandId);

    const consumedMap = new Map<string, number>();
    for (const row of consumedRows) {
      consumedMap.set(
        row.brandId as string,
        Math.abs(Number(row.amount ?? 0)),
      );
    }

    // 本月充值：按 brand 聚合
    const rechargedRows = await this.db
      .select({
        brandId: geoCreditTransactions.brandId,
        amount: sum(geoCreditTransactions.changeAmount).as('amount'),
      })
      .from(geoCreditTransactions)
      .where(
        and(
          inArray(geoCreditTransactions.brandId, brandIds),
          inArray(geoCreditTransactions.transactionType, RECHARGE_TYPES),
          gte(geoCreditTransactions.createdAt, monthStartDate),
          lt(geoCreditTransactions.createdAt, nextMonthStartDate),
          sql`${geoCreditTransactions.changeAmount}::numeric > 0`,
        ),
      )
      .groupBy(geoCreditTransactions.brandId);

    const rechargedMap = new Map<string, number>();
    for (const row of rechargedRows) {
      rechargedMap.set(row.brandId as string, Number(row.amount ?? 0));
    }

    // 最后消耗时间：用 raw SQL 批量查
    const brandIdsSql = sql.join(
      brandIds.map((id: string) => sql`${id}::uuid`),
      sql`, `,
    );
    const txTypesSql = sql.join(
      CONSUMPTION_TYPES.map((t: string) => sql`${t}`),
      sql`, `,
    );

    const lastConsumedResult = await this.db.execute(sql`
      SELECT t.brand_id, MAX(t._created_at) as last_at
      FROM ${geoCreditTransactions} t
      WHERE t.brand_id = ANY(ARRAY[${brandIdsSql}]::uuid[])
        AND t.transaction_type = ANY(ARRAY[${txTypesSql}]::varchar[])
      GROUP BY t.brand_id
    `);

    const lastConsumedMap = new Map<string, string | null>();
    const lastConsumedRows = lastConsumedResult as unknown as Array<{
      brand_id: string;
      last_at: string | Date | null;
    }>;
    for (const row of lastConsumedRows) {
      const val = row.last_at;
      lastConsumedMap.set(
        row.brand_id,
        val ? new Date(val).toISOString() : null,
      );
    }

    const items: CreditBrandRow[] = rows.map((row) => {
      const brandId = row.brandId as string;
      const balance = Number(row.balance ?? 0);
      return {
        brandId,
        brandName: row.brandName,
        companyName: row.companyName ?? null,
        planName: row.planName ?? null,
        balance,
        monthlyConsumed: consumedMap.get(brandId) ?? 0,
        monthlyRecharged: rechargedMap.get(brandId) ?? 0,
        lastConsumedAt: lastConsumedMap.get(brandId) ?? null,
        healthStatus: getHealthStatus(balance),
      };
    });

    return { stats, items, total };
  }

  private async getOverviewStats(): Promise<CreditOverviewStats> {
    const monthStartDate = dayjs().startOf('month').toDate();
    const nextMonthStartDate = dayjs().add(1, 'month').startOf('month').toDate();

    const [balanceResult, consumedResult, rechargedResult] = await Promise.all([
      this.db
        .select({ total: sum(geoCreditAccounts.balance).as('total') })
        .from(geoCreditAccounts),
      this.db
        .select({ total: sum(geoCreditTransactions.changeAmount).as('total') })
        .from(geoCreditTransactions)
        .where(
          and(
            inArray(geoCreditTransactions.transactionType, CONSUMPTION_TYPES),
            gte(geoCreditTransactions.createdAt, monthStartDate),
            lt(geoCreditTransactions.createdAt, nextMonthStartDate),
          ),
        ),
      this.db
        .select({ total: sum(geoCreditTransactions.changeAmount).as('total') })
        .from(geoCreditTransactions)
        .where(
          and(
            inArray(geoCreditTransactions.transactionType, RECHARGE_TYPES),
            gte(geoCreditTransactions.createdAt, monthStartDate),
            lt(geoCreditTransactions.createdAt, nextMonthStartDate),
            sql`${geoCreditTransactions.changeAmount}::numeric > 0`,
          ),
        ),
    ]);

    return {
      totalBalance: Number(balanceResult[0]?.total ?? 0),
      monthlyConsumed: Math.abs(Number(consumedResult[0]?.total ?? 0)),
      monthlyRecharged: Number(rechargedResult[0]?.total ?? 0),
    };
  }

  async batchRecharge(
    brandIds: string[],
    amount: number,
    remark: string | undefined,
    operatorId: string,
  ): Promise<BatchRechargeResult> {
    if (!brandIds || brandIds.length === 0) {
      throw new BadRequestException('brandIds 不能为空');
    }
    if (!amount || amount <= 0) {
      throw new BadRequestException('充值金额必须大于 0');
    }

    let successCount = 0;
    let failedCount = 0;

    for (const brandId of brandIds) {
      try {
        await this.db.transaction(async (tx) => {
          // 锁定账户行
          const [account] = await tx
            .select({
              id: geoCreditAccounts.id,
              balance: geoCreditAccounts.balance,
              totalRecharged: geoCreditAccounts.totalRecharged,
            })
            .from(geoCreditAccounts)
            .where(eq(geoCreditAccounts.brandId, brandId))
            .for('update');

          if (!account) {
            throw new Error(`品牌 ${brandId} 算力账户不存在`);
          }

          const currentBalance = Number(account.balance ?? 0);
          const currentTotalRecharged = Number(account.totalRecharged ?? 0);
          const newBalance = currentBalance + amount;
          const newTotalRecharged = currentTotalRecharged + amount;

          await tx
            .update(geoCreditAccounts)
            .set({
              balance: String(newBalance),
              totalRecharged: String(newTotalRecharged),
            })
            .where(eq(geoCreditAccounts.id, account.id));

          await tx.insert(geoCreditTransactions).values({
            brandId,
            changeAmount: String(amount),
            balanceAfter: String(newBalance),
            transactionType: 'adjustment',
            description: remark || '批量充值',
            operatorId,
          });
        });
        successCount += 1;
      } catch (err) {
        this.logger.error(`批量充值失败 brandId=${brandId}`, err);
        failedCount += 1;
      }
    }

    return { successCount, failedCount };
  }

  async getConsumptionRank(month?: string): Promise<{
    items: ConsumptionRankItem[];
  }> {
    const monthStr = month ? validateMonth(month) : dayjs().format('YYYY-MM');
    const monthStartDate = dayjs(monthStr + '-01').startOf('month').toDate();
    const nextMonthStartDate = dayjs(monthStr + '-01')
      .add(1, 'month')
      .startOf('month')
      .toDate();

    const txTypesSql = sql.join(
      CONSUMPTION_TYPES.map((t: string) => sql`${t}`),
      sql`, `,
    );

    const result = await this.db.execute(sql`
      SELECT
        t.brand_id,
        b.name AS brand_name,
        SUM(ABS(t.change_amount::numeric)) AS amount
      FROM ${geoCreditTransactions} t
      INNER JOIN ${geoBrands} b ON t.brand_id = b.id
      WHERE t.transaction_type = ANY(ARRAY[${txTypesSql}]::varchar[])
        AND t._created_at >= ${monthStartDate.toISOString()}
        AND t._created_at < ${nextMonthStartDate.toISOString()}
        AND b.status = 'active'
      GROUP BY t.brand_id, b.name
      ORDER BY amount DESC
      LIMIT 10
    `);

    const rankRows = result as unknown as Array<{
      brand_id: string;
      brand_name: string;
      amount: string;
    }>;
    const items: ConsumptionRankItem[] = rankRows.map((row) => ({
      brandId: row.brand_id,
      brandName: row.brand_name,
      amount: Number(row.amount ?? 0),
    }));

    return { items };
  }

  async getMonthlyBill(query: {
    month?: string;
    page?: number;
    pageSize?: number;
    keyword?: string;
  }): Promise<MonthlyBillResponse> {
    const month = query.month
      ? validateMonth(query.month)
      : dayjs().format('YYYY-MM');
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const monthStartDate = dayjs(month + '-01').startOf('month').toDate();
    const nextMonthStartDate = dayjs(month + '-01')
      .add(1, 'month')
      .startOf('month')
      .toDate();

    // 基础条件
    const conditions = [];
    conditions.push(eq(geoBrands.status, 'active'));

    if (query.keyword) {
      const kw = `%${query.keyword}%`;
      conditions.push(
        sql`(${
          ilike(geoBrands.name, kw)
        } OR ${
          ilike(geoBrands.companyName, kw)
        })`,
      );
    }

    // 查询有算力账户的品牌总数
    const countResult = await this.db
      .select({ count: count() })
      .from(geoCreditAccounts)
      .innerJoin(geoBrands, eq(geoCreditAccounts.brandId, geoBrands.id))
      .where(and(...conditions));

    const total = Number(countResult[0]?.count ?? 0);

    // 分页账户列表
    const accounts = await this.db
      .select({
        brandId: geoCreditAccounts.brandId,
        brandName: geoBrands.name,
        companyName: geoBrands.companyName,
        balance: geoCreditAccounts.balance,
      })
      .from(geoCreditAccounts)
      .innerJoin(geoBrands, eq(geoCreditAccounts.brandId, geoBrands.id))
      .where(and(...conditions))
      .orderBy(desc(sql`${geoCreditAccounts.balance}::numeric`))
      .limit(pageSize)
      .offset(offset);

    if (accounts.length === 0) {
      return {
        month,
        items: [],
        total,
        totalOpening: 0,
        totalConsumed: 0,
        totalRecharged: 0,
        totalClosing: 0,
        hasUnitPrice: false,
      };
    }

    const brandIds = accounts.map((a) => a.brandId as string);

    // 本月消耗
    const consumedRows = await this.db
      .select({
        brandId: geoCreditTransactions.brandId,
        amount: sum(geoCreditTransactions.changeAmount).as('amount'),
      })
      .from(geoCreditTransactions)
      .where(
        and(
          inArray(geoCreditTransactions.brandId, brandIds),
          inArray(geoCreditTransactions.transactionType, CONSUMPTION_TYPES),
          gte(geoCreditTransactions.createdAt, monthStartDate),
          lt(geoCreditTransactions.createdAt, nextMonthStartDate),
        ),
      )
      .groupBy(geoCreditTransactions.brandId);

    const consumedMap = new Map<string, number>();
    for (const row of consumedRows) {
      consumedMap.set(
        row.brandId as string,
        Math.abs(Number(row.amount ?? 0)),
      );
    }

    // 本月充值
    const rechargedRows = await this.db
      .select({
        brandId: geoCreditTransactions.brandId,
        amount: sum(geoCreditTransactions.changeAmount).as('amount'),
      })
      .from(geoCreditTransactions)
      .where(
        and(
          inArray(geoCreditTransactions.brandId, brandIds),
          inArray(geoCreditTransactions.transactionType, RECHARGE_TYPES),
          gte(geoCreditTransactions.createdAt, monthStartDate),
          lt(geoCreditTransactions.createdAt, nextMonthStartDate),
          sql`${geoCreditTransactions.changeAmount}::numeric > 0`,
        ),
      )
      .groupBy(geoCreditTransactions.brandId);

    const rechargedMap = new Map<string, number>();
    for (const row of rechargedRows) {
      rechargedMap.set(row.brandId as string, Number(row.amount ?? 0));
    }

    // 检查是否有 unitPrice > 0 的套餐
    const unitPriceResult = await this.db
      .select({ unitPrice: geoCreditPlans.unitPrice })
      .from(geoCreditPlans)
      .where(sql`${geoCreditPlans.unitPrice}::numeric > 0`)
      .limit(1);

    const hasUnitPrice = unitPriceResult.length > 0;

    // 取每品牌的套餐单价
    const unitPriceMap = new Map<string, number>();
    let fallbackUnitPrice = 0;

    if (hasUnitPrice) {
      // 每品牌当前套餐单价
      const planPriceRows = await this.db
        .select({
          brandId: geoCreditAccounts.brandId,
          unitPrice: geoCreditPlans.unitPrice,
        })
        .from(geoCreditAccounts)
        .innerJoin(
          geoCreditPlans,
          eq(geoCreditAccounts.currentPlanId, geoCreditPlans.id),
        )
        .where(inArray(geoCreditAccounts.brandId, brandIds));

      for (const row of planPriceRows) {
        unitPriceMap.set(row.brandId as string, Number(row.unitPrice ?? 0));
      }

      // 没套餐的品牌取所有套餐里最低的 unitPrice
      const minPriceResult = await this.db
        .select({
          minPrice:
            sql<number>`MIN(${geoCreditPlans.unitPrice}::numeric)`.as(
              'min_price',
            ),
        })
        .from(geoCreditPlans)
        .where(sql`${geoCreditPlans.unitPrice}::numeric > 0`);

      fallbackUnitPrice = Number(minPriceResult[0]?.minPrice ?? 0);
    }

    // 组装行数据
    const items: MonthlyBillRow[] = accounts.map((row) => {
      const brandId = row.brandId as string;
      const closingBalance = Number(row.balance ?? 0);
      const monthlyConsumed = consumedMap.get(brandId) ?? 0;
      const monthlyRecharged = rechargedMap.get(brandId) ?? 0;
      // 期初 = 期末 - 净变化 = 期末 - (月充值 - 月消耗)
      const openingBalance = closingBalance - (monthlyRecharged - monthlyConsumed);

      const result: MonthlyBillRow = {
        brandId,
        brandName: row.brandName,
        companyName: row.companyName ?? null,
        openingBalance,
        monthlyConsumed,
        monthlyRecharged,
        closingBalance,
      };

      if (hasUnitPrice) {
        const unitPrice = unitPriceMap.get(brandId) ?? fallbackUnitPrice;
        result.amountYuan = Number(
          ((monthlyConsumed / 10000) * unitPrice).toFixed(2),
        );
      }

      return result;
    });

    // 合计
    const totalOpening = items.reduce(
      (s: number, it: MonthlyBillRow) => s + it.openingBalance,
      0,
    );
    const totalConsumed = items.reduce(
      (s: number, it: MonthlyBillRow) => s + it.monthlyConsumed,
      0,
    );
    const totalRecharged = items.reduce(
      (s: number, it: MonthlyBillRow) => s + it.monthlyRecharged,
      0,
    );
    const totalClosing = items.reduce(
      (s: number, it: MonthlyBillRow) => s + it.closingBalance,
      0,
    );

    const response: MonthlyBillResponse = {
      month,
      items,
      total,
      totalOpening,
      totalConsumed,
      totalRecharged,
      totalClosing,
      hasUnitPrice,
    };

    if (hasUnitPrice) {
      response.totalAmountYuan = Number(
        items
          .reduce((s: number, it: MonthlyBillRow) => s + (it.amountYuan ?? 0), 0)
          .toFixed(2),
      );
    }

    return response;
  }

  async exportMonthlyBillCsv(month: string): Promise<{
    filename: string;
    content: string;
  }> {
    const monthStr = validateMonth(month);

    // 不分页，取全部（设置一个很大的 pageSize）
    const bill = await this.getMonthlyBill({
      month: monthStr,
      page: 1,
      pageSize: 10000,
    });

    const hasUnitPrice = bill.hasUnitPrice;

    // CSV 表头
    const headers = ['品牌', '企业名称', '期初余额', '本月消耗', '本月充值', '期末余额'];
    if (hasUnitPrice) {
      headers.push('消耗金额(元)');
    }

    const escapeCsv = (val: string | number | null): string => {
      const str = val === null || val === undefined ? '' : String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const lines: string[] = [headers.join(',')];

    for (const row of bill.items) {
      const line = [
        escapeCsv(row.brandName),
        escapeCsv(row.companyName ?? ''),
        escapeCsv(row.openingBalance),
        escapeCsv(row.monthlyConsumed),
        escapeCsv(row.monthlyRecharged),
        escapeCsv(row.closingBalance),
      ];
      if (hasUnitPrice) {
        line.push(escapeCsv(row.amountYuan ?? ''));
      }
      lines.push(line.join(','));
    }

    // 合计行
    const totalLine = [
      escapeCsv('合计'),
      escapeCsv(''),
      escapeCsv(bill.totalOpening),
      escapeCsv(bill.totalConsumed),
      escapeCsv(bill.totalRecharged),
      escapeCsv(bill.totalClosing),
    ];
    if (hasUnitPrice) {
      totalLine.push(escapeCsv(bill.totalAmountYuan ?? ''));
    }
    lines.push(totalLine.join(','));

    const content = '\ufeff' + lines.join('\n');
    const filename = `星河GEO-账单-${monthStr}.csv`;

    return { filename, content };
  }
}
