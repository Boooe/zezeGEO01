import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, count, sql, and, gte, lt } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import dayjs from 'dayjs';

import {
  geoBrands,
  geoUsers,
  geoCreditPlans,
  geoCreditAccounts,
  geoCreditTransactions,
  geoContracts,
} from '@server/database/schema';
import type {
  CreateCustomerFullRequest,
  CustomerCreateResponse,
  CustomerResetPasswordResponse,
  UpdatePlanRequest,
  RenewRequest,
  RenewResponse,
  CustomerLoginCard,
} from '@shared/api.interface';

const BCRYPT_ROUNDS = 10;

function generatePassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;
  let result = '';
  result += upper[Math.floor(Math.random() * upper.length)];
  result += lower[Math.floor(Math.random() * lower.length)];
  result += digits[Math.floor(Math.random() * digits.length)];
  for (let i = 3; i < 8; i += 1) {
    result += all[Math.floor(Math.random() * all.length)];
  }
  return result
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

@Injectable()
export class CustomerAdminService {
  private readonly logger = new Logger(CustomerAdminService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async createCustomerFull(
    dto: CreateCustomerFullRequest,
    operatorId: string,
    loginUrl: string,
  ): Promise<CustomerCreateResponse> {
    // 校验套餐存在
    const [plan] = await this.db
      .select()
      .from(geoCreditPlans)
      .where(eq(geoCreditPlans.id, dto.planId))
      .limit(1);

    if (!plan) {
      throw new BadRequestException('套餐不存在');
    }

    // 校验用户名唯一
    const existingUser = await this.db
      .select({ id: geoUsers.id })
      .from(geoUsers)
      .where(eq(geoUsers.username, dto.username))
      .limit(1);
    if (existingUser.length > 0) {
      throw new ConflictException('登录名已存在');
    }

    // 解析 serviceEnd，拼 23:59:59+08:00
    const planExpiresAt = new Date(`${dto.serviceEnd}T23:59:59+08:00`);
    const serviceEndDateStr = dto.serviceEnd;

    const result = await this.db.transaction(async (tx) => {
      // a. 创建 brand
      const [brand] = await tx
        .insert(geoBrands)
        .values({
          companyName: dto.companyName,
          name: dto.brandName,
          industry: dto.industry,
          contactPerson: dto.contactPerson,
          contactPhone: dto.contactPhone,
          status: 'active',
        })
        .returning({ id: geoBrands.id, name: geoBrands.name });

      const brandId = brand.id;
      const initialCredit = dto.initialCredit;

      // b. 创建 credit_account
      const [account] = await tx
        .insert(geoCreditAccounts)
        .values({
          brandId,
          balance: String(initialCredit),
          totalUsed: '0',
          totalRecharged: String(initialCredit),
          currentPlanId: dto.planId,
          planExpiresAt,
        })
        .returning({ id: geoCreditAccounts.id });

      // c. 写一条 adjustment 流水
      await tx.insert(geoCreditTransactions).values({
        brandId,
        changeAmount: String(initialCredit),
        balanceAfter: String(initialCredit),
        transactionType: 'adjustment',
        description: '开通赠送',
        operatorId,
        planId: dto.planId,
      });

      // d. 创建 geo_user
      const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
      const [user] = await tx
        .insert(geoUsers)
        .values({
          username: dto.username,
          passwordHash,
          role: 'client',
          displayName: dto.brandName,
          brandId,
          status: 'active',
        })
        .returning({ id: geoUsers.id, username: geoUsers.username });

      // e. 创建合同记录（写 packageType 让客户列表套餐列有值）
      const todayStr = dayjs().format('YYYY-MM-DD');
      await tx.insert(geoContracts).values({
        brandId,
        customerName: dto.companyName,
        industry: dto.industry,
        contactPerson: dto.contactPerson,
        contactPhone: dto.contactPhone,
        packageType: plan.planCode,
        contractAmount: plan.price,
        signDate: todayStr,
        serviceStart: todayStr,
        serviceEnd: serviceEndDateStr,
        paymentStatus: 'paid',
      });

      return {
        brandId,
        userId: user.id,
        username: user.username,
        password: dto.password,
        planName: plan.planName,
        creditAmount: initialCredit,
      };
    });

    const loginCard: CustomerLoginCard = {
      companyName: dto.companyName,
      loginUrl,
      username: result.username,
      password: result.password,
      planName: result.planName,
      creditAmount: result.creditAmount,
      serviceEnd: planExpiresAt.toISOString(),
    };

    return {
      brandId: result.brandId,
      userId: result.userId,
      loginCard,
    };
  }

  async disableUser(
    brandId: string,
    userId: string,
  ): Promise<{ success: true }> {
    const [updated] = await this.db
      .update(geoUsers)
      .set({ status: 'disabled' })
      .where(and(eq(geoUsers.id, userId), eq(geoUsers.brandId, brandId)))
      .returning({ id: geoUsers.id });

    if (!updated) {
      throw new NotFoundException('用户不存在');
    }

    return { success: true };
  }

  async enableUser(
    brandId: string,
    userId: string,
  ): Promise<{ success: true }> {
    const [updated] = await this.db
      .update(geoUsers)
      .set({ status: 'active' })
      .where(and(eq(geoUsers.id, userId), eq(geoUsers.brandId, brandId)))
      .returning({ id: geoUsers.id });

    if (!updated) {
      throw new NotFoundException('用户不存在');
    }

    return { success: true };
  }

  async resetPassword(
    brandId: string,
    userId: string,
  ): Promise<CustomerResetPasswordResponse> {
    const userRows = await this.db
      .select({ id: geoUsers.id })
      .from(geoUsers)
      .where(and(eq(geoUsers.id, userId), eq(geoUsers.brandId, brandId)))
      .limit(1);

    if (userRows.length === 0) {
      throw new NotFoundException('用户不存在');
    }

    const newPassword = generatePassword();
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.db
      .update(geoUsers)
      .set({ passwordHash, status: 'active' })
      .where(eq(geoUsers.id, userId));

    return {
      userId: userRows[0].id,
      newPassword,
    };
  }

  async updatePlan(
    brandId: string,
    dto: UpdatePlanRequest,
  ): Promise<{ success: true }> {
    // 校验套餐存在
    const [plan] = await this.db
      .select({ id: geoCreditPlans.id })
      .from(geoCreditPlans)
      .where(eq(geoCreditPlans.id, dto.planId))
      .limit(1);

    if (!plan) {
      throw new BadRequestException('套餐不存在');
    }

    const planExpiresAt = new Date(`${dto.serviceEnd}T23:59:59+08:00`);

    // upsert credit account
    const [account] = await this.db
      .select({ id: geoCreditAccounts.id })
      .from(geoCreditAccounts)
      .where(eq(geoCreditAccounts.brandId, brandId))
      .limit(1);

    if (account) {
      await this.db
        .update(geoCreditAccounts)
        .set({
          currentPlanId: dto.planId,
          planExpiresAt,
        })
        .where(eq(geoCreditAccounts.id, account.id));
    } else {
      await this.db.insert(geoCreditAccounts).values({
        brandId,
        balance: '0',
        totalUsed: '0',
        totalRecharged: '0',
        currentPlanId: dto.planId,
        planExpiresAt,
      });
    }

    return { success: true };
  }

  async renew(
    brandId: string,
    dto: RenewRequest,
    operatorId: string,
  ): Promise<RenewResponse> {
    let addedCredit = 0;
    let addedMonths = 0;
    let paymentAmount = 0;
    let planId: string | null = null;
    let planName = '';

    if (dto.planId) {
      // 选套餐模式
      const [plan] = await this.db
        .select()
        .from(geoCreditPlans)
        .where(eq(geoCreditPlans.id, dto.planId))
        .limit(1);

      if (!plan) {
        throw new BadRequestException('套餐不存在');
      }

      planId = plan.id;
      planName = plan.planName;
      addedCredit = Number(plan.creditAmount);
      addedMonths = plan.validityMonths;
      paymentAmount = Number(plan.price);
    } else {
      // 自定义模式
      if (
        dto.customAmount === undefined ||
        dto.customCredit === undefined ||
        dto.customMonths === undefined
      ) {
        throw new BadRequestException('自定义续费需提供 customAmount、customCredit、customMonths');
      }
      if (dto.customCredit < 0 || dto.customAmount < 0 || dto.customMonths < 1) {
        throw new BadRequestException('自定义参数不合法');
      }
      addedCredit = dto.customCredit;
      addedMonths = dto.customMonths;
      paymentAmount = dto.customAmount;
    }

    const result = await this.db.transaction(async (tx) => {
      // 找到或创建 credit_account
      let account = await tx
        .select()
        .from(geoCreditAccounts)
        .where(eq(geoCreditAccounts.brandId, brandId))
        .limit(1)
        .then((rows) => rows[0]);

      if (!account) {
        const [created] = await tx
          .insert(geoCreditAccounts)
          .values({
            brandId,
            balance: '0',
            totalUsed: '0',
            totalRecharged: '0',
          })
          .returning();
        account = created;
      }

      const currentBalance = Number(account.balance);
      const currentTotalRecharged = Number(account.totalRecharged);
      const newBalance = currentBalance + addedCredit;
      const newTotalRecharged = currentTotalRecharged + addedCredit;

      // 计算新到期日
      const now = dayjs();
      const currentExpiresAt = account.planExpiresAt
        ? dayjs(account.planExpiresAt)
        : null;
      let newExpiresAt: dayjs.Dayjs;
      if (!currentExpiresAt || currentExpiresAt.isBefore(now)) {
        // 原到期日为空或早于今天，从今天起加
        newExpiresAt = now.add(addedMonths, 'month');
      } else {
        // 在原到期日基础上加
        newExpiresAt = currentExpiresAt.add(addedMonths, 'month');
      }

      const newExpiresAtDate = newExpiresAt.toDate();

      // 更新 credit_account
      const [updatedAccount] = await tx
        .update(geoCreditAccounts)
        .set({
          balance: String(newBalance),
          totalRecharged: String(newTotalRecharged),
          planExpiresAt: newExpiresAtDate,
          currentPlanId: planId ?? account.currentPlanId,
        })
        .where(eq(geoCreditAccounts.id, account.id))
        .returning();

      // 同步更新 geo_contracts 的 package_type（有套餐时）
      if (planId && planName) {
        const planCode = planId; // plan_id 作为套餐标识
        const newExpiresAtStr = newExpiresAt.format('YYYY-MM-DD');
        const existingContract = await tx
          .select({ id: geoContracts.id })
          .from(geoContracts)
          .where(eq(geoContracts.brandId, brandId))
          .limit(1);
        if (existingContract.length > 0) {
          await tx
            .update(geoContracts)
            .set({
              packageType: planCode,
              serviceEnd: newExpiresAtStr,
            })
            .where(eq(geoContracts.id, existingContract[0].id));
        } else {
          await tx.insert(geoContracts).values({
            brandId,
            customerName: brandId,
            packageType: planCode,
            serviceEnd: newExpiresAtStr,
            paymentStatus: 'paid',
          });
        }
      }

      // 写流水
      const description =
        dto.remark ?? (planId ? `续费-${planName}` : '续费-自定义');
      const [txRow] = await tx
        .insert(geoCreditTransactions)
        .values({
          brandId,
          changeAmount: String(addedCredit),
          balanceAfter: String(newBalance),
          transactionType: 'recharge',
          description,
          operatorId,
          planId: planId ?? undefined,
          paymentAmount: String(paymentAmount),
        })
        .returning({ id: geoCreditTransactions.id });

      return {
        newServiceEnd: updatedAccount.planExpiresAt
          ? new Date(updatedAccount.planExpiresAt).toISOString()
          : '',
        newBalance,
        transactionId: txRow.id,
      };
    });

    return {
      brandId,
      newServiceEnd: result.newServiceEnd,
      addedCredit,
      newBalance: result.newBalance,
      paymentAmount,
      transactionId: result.transactionId,
    };
  }

  async getExpiringSoonCount(): Promise<{ count: number }> {
    const now = new Date();
    const in7Days = dayjs().add(7, 'day').toDate();

    const result = await this.db
      .select({ count: count() })
      .from(geoCreditAccounts)
      .where(
        and(
          gte(geoCreditAccounts.planExpiresAt, now),
          lt(geoCreditAccounts.planExpiresAt, in7Days),
        ),
      );

    return { count: Number(result[0]?.count ?? 0) };
  }
}
