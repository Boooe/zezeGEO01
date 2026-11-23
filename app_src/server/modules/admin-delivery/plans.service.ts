import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, desc, count, and, asc } from 'drizzle-orm';

import {
  geoCreditPlans,
  geoCreditAccounts,
} from '@server/database/schema';
import type {
  PlanItem,
  PlanListResponse,
  PlanUpsertRequest,
} from '@shared/api.interface';

interface PlanListQuery {
  page?: number;
  pageSize?: number;
}

@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async listPlans(query: PlanListQuery): Promise<PlanListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const [countResult, rows] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(geoCreditPlans),
      this.db
        .select()
        .from(geoCreditPlans)
        .orderBy(asc(geoCreditPlans.sortOrder), desc(geoCreditPlans.createdAt))
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const items: PlanItem[] = rows.map((row) => ({
      id: row.id,
      planName: row.planName,
      planCode: row.planCode,
      price: Number(row.price),
      creditAmount: Number(row.creditAmount),
      validityMonths: row.validityMonths,
      unitPrice: Number(row.unitPrice),
      dailyPublishLimit: row.dailyPublishLimit,
      description: row.description,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
    }));

    return { items, total };
  }

  async listActive(): Promise<{ items: PlanItem[] }> {
    const rows = await this.db
      .select()
      .from(geoCreditPlans)
      .where(eq(geoCreditPlans.isActive, true))
      .orderBy(asc(geoCreditPlans.sortOrder), desc(geoCreditPlans.createdAt));

    const items: PlanItem[] = rows.map((row) => ({
      id: row.id,
      planName: row.planName,
      planCode: row.planCode,
      price: Number(row.price),
      creditAmount: Number(row.creditAmount),
      validityMonths: row.validityMonths,
      unitPrice: Number(row.unitPrice),
      dailyPublishLimit: row.dailyPublishLimit,
      description: row.description,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
    }));

    return { items };
  }

  async createPlan(dto: PlanUpsertRequest): Promise<PlanItem> {
    // 校验 planCode 格式：英文小写 + 下划线
    if (!/^[a-z][a-z0-9_]*$/.test(dto.planCode)) {
      throw new BadRequestException('套餐编码只能包含小写字母、数字和下划线，且以字母开头');
    }

    // 校验 planCode 唯一
    const existing = await this.db
      .select({ id: geoCreditPlans.id })
      .from(geoCreditPlans)
      .where(eq(geoCreditPlans.planCode, dto.planCode))
      .limit(1);
    if (existing.length > 0) {
      throw new ConflictException('套餐编码已存在');
    }

    const [row] = await this.db
      .insert(geoCreditPlans)
      .values({
        planName: dto.planName,
        planCode: dto.planCode,
        price: String(dto.price),
        creditAmount: String(dto.creditAmount),
        validityMonths: dto.validityMonths,
        dailyPublishLimit: dto.dailyPublishLimit,
        unitPrice: dto.unitPrice !== undefined ? String(dto.unitPrice) : undefined,
        description: dto.description,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      })
      .returning();

    return {
      id: row.id,
      planName: row.planName,
      planCode: row.planCode,
      price: Number(row.price),
      creditAmount: Number(row.creditAmount),
      validityMonths: row.validityMonths,
      dailyPublishLimit: row.dailyPublishLimit,
      unitPrice: Number(row.unitPrice),
      description: row.description,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
    };
  }

  async updatePlan(id: string, dto: PlanUpsertRequest): Promise<PlanItem> {
    // 校验 planCode 格式
    if (!/^[a-z][a-z0-9_]*$/.test(dto.planCode)) {
      throw new BadRequestException('套餐编码只能包含小写字母、数字和下划线，且以字母开头');
    }

    // 校验 planCode 唯一（排除自身）
    const existing = await this.db
      .select({ id: geoCreditPlans.id })
      .from(geoCreditPlans)
      .where(eq(geoCreditPlans.planCode, dto.planCode))
      .limit(1);
    if (existing.length > 0 && existing[0].id !== id) {
      throw new ConflictException('套餐编码已存在');
    }

    const [row] = await this.db
      .update(geoCreditPlans)
      .set({
        planName: dto.planName,
        planCode: dto.planCode,
        price: String(dto.price),
        creditAmount: String(dto.creditAmount),
        validityMonths: dto.validityMonths,
        dailyPublishLimit: dto.dailyPublishLimit,
        unitPrice: dto.unitPrice !== undefined ? String(dto.unitPrice) : undefined,
        description: dto.description,
        isActive: dto.isActive,
        sortOrder: dto.sortOrder,
      })
      .where(eq(geoCreditPlans.id, id))
      .returning();

    if (!row) {
      throw new NotFoundException('套餐不存在');
    }

    return {
      id: row.id,
      planName: row.planName,
      planCode: row.planCode,
      price: Number(row.price),
      creditAmount: Number(row.creditAmount),
      validityMonths: row.validityMonths,
      dailyPublishLimit: row.dailyPublishLimit,
      unitPrice: Number(row.unitPrice),
      description: row.description,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
    };
  }

  async deletePlan(id: string): Promise<{ success: true }> {
    // 检查是否有品牌正在使用该套餐
    const usingCount = await this.db
      .select({ count: count() })
      .from(geoCreditAccounts)
      .where(eq(geoCreditAccounts.currentPlanId, id));

    if (Number(usingCount[0]?.count ?? 0) > 0) {
      throw new ConflictException('该套餐下有客户正在使用，无法删除');
    }

    const deleted = await this.db
      .delete(geoCreditPlans)
      .where(eq(geoCreditPlans.id, id))
      .returning({ id: geoCreditPlans.id });

    if (deleted.length === 0) {
      throw new NotFoundException('套餐不存在');
    }

    return { success: true };
  }
}
