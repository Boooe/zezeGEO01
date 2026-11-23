import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import {
  eq,
  and,
  ilike,
  desc,
  count,
  or,
  isNull,
  gte,
  sql,
  inArray,
} from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import dayjs from 'dayjs';

import {
  geoBrands,
  geoUsers,
  geoCreditAccounts,
  geoCreditTransactions,
  geoContracts,
} from '@server/database/schema';
import {
  ACCOUNT_STATUS_LABELS,
  PACKAGE_TYPE_LABELS,
} from '@shared/api.interface';
import type {
  CustomerItem,
  CustomerDetail,
  UserRole,
  PackageType,
} from '@shared/api.interface';
import type {
  CustomerListQueryDto,
  CreateCustomerDto,
  CreateBrandUserDto,
  AdjustCreditDto,
} from './dto/customers.dto';

interface GeoUserCtx {
  id: string;
  role: UserRole;
  brandId: string | null;
}

const BCRYPT_ROUNDS = 10;

function generatePassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;
  const len = 8 + Math.floor(Math.random() * 3);
  let result = '';
  result += upper[Math.floor(Math.random() * upper.length)];
  result += lower[Math.floor(Math.random() * lower.length)];
  result += digits[Math.floor(Math.random() * digits.length)];
  for (let i = 3; i < len; i += 1) {
    result += all[Math.floor(Math.random() * all.length)];
  }
  return result
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async listCustomers(query: CustomerListQueryDto): Promise<{
    items: CustomerItem[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    conditions.push(eq(geoBrands.status, 'active'));

    if (query.industry) {
      conditions.push(eq(geoBrands.industry, query.industry));
    }

    if (query.keyword) {
      const kw = `%${query.keyword}%`;
      conditions.push(
        or(
          ilike(geoBrands.companyName, kw),
          ilike(geoBrands.name, kw),
          ilike(geoBrands.contactPerson, kw),
          ilike(geoBrands.contactPhone, kw),
        ),
      );
    }

    if (query.accountStatus === 'not_opened') {
      conditions.push(
        sql`NOT EXISTS (SELECT 1 FROM ${geoUsers} WHERE ${geoUsers.brandId} = ${geoBrands.id})`,
      );
    } else if (query.accountStatus === 'active') {
      conditions.push(
        sql`EXISTS (SELECT 1 FROM ${geoUsers} WHERE ${geoUsers.brandId} = ${geoBrands.id} AND ${geoUsers.status} = 'active')`,
      );
    } else if (query.accountStatus === 'disabled') {
      conditions.push(
        sql`EXISTS (SELECT 1 FROM ${geoUsers} WHERE ${geoUsers.brandId} = ${geoBrands.id} AND ${geoUsers.status} = 'disabled')`,
      );
    }

    const baseQuery = this.db
      .select({
        id: geoBrands.id,
        companyName: geoBrands.companyName,
        brandName: geoBrands.name,
        industry: geoBrands.industry,
        contactPerson: geoBrands.contactPerson,
        contactPhone: geoBrands.contactPhone,
        remark: geoBrands.remark,
        createdAt: geoBrands.createdAt,
      })
      .from(geoBrands)
      .where(and(...conditions));

    const countQuery = this.db
      .select({ count: count() })
      .from(geoBrands)
      .where(and(...conditions));

    const rowsQuery = baseQuery
      .orderBy(desc(geoBrands.createdAt))
      .limit(pageSize)
      .offset(offset);

    const [countResult, rows] = await Promise.all([countQuery, rowsQuery]);
    const total = Number(countResult[0]?.count ?? 0);

    if (rows.length === 0) {
      return { items: [], total, page, pageSize };
    }

    const brandIds = rows.map((row) => row.id);

    const [creditAccounts, usersByBrand, contractsByBrand] = await Promise.all([
      this.db
        .select({
          brandId: geoCreditAccounts.brandId,
          balance: geoCreditAccounts.balance,
          planExpiresAt: geoCreditAccounts.planExpiresAt,
        })
        .from(geoCreditAccounts)
        .where(inArray(geoCreditAccounts.brandId, brandIds)),
      this.db
        .select({
          id: geoUsers.id,
          username: geoUsers.username,
          role: geoUsers.role,
          status: geoUsers.status,
          brandId: geoUsers.brandId,
        })
        .from(geoUsers)
        .where(inArray(geoUsers.brandId, brandIds))
        .orderBy(desc(geoUsers.createdAt)),
      this.db
        .select({
          id: geoContracts.id,
          brandId: geoContracts.brandId,
          packageType: geoContracts.packageType,
          serviceEnd: geoContracts.serviceEnd,
        })
        .from(geoContracts)
        .where(inArray(geoContracts.brandId, brandIds))
        .orderBy(desc(geoContracts.serviceEnd)),
    ]);

    const creditMap = new Map<string, { balance: string; planExpiresAt: Date | null }>();
    for (const acc of creditAccounts) {
      creditMap.set(acc.brandId as string, {
        balance: String(acc.balance),
        planExpiresAt: (acc.planExpiresAt as Date | null) ?? null,
      });
    }

    const userMap = new Map<string, typeof usersByBrand[number]>();
    const seenBrands = new Set<string>();
    for (const u of usersByBrand) {
      const bid = u.brandId as string;
      if (!seenBrands.has(bid)) {
        seenBrands.add(bid);
        userMap.set(bid, u);
      }
    }

    const contractMap = new Map<string, typeof contractsByBrand[number]>();
    const seenContractBrands = new Set<string>();
    for (const c of contractsByBrand) {
      const bid = c.brandId as string;
      if (!seenContractBrands.has(bid)) {
        seenContractBrands.add(bid);
        contractMap.set(bid, c);
      }
    }

    const items: CustomerItem[] = rows.map((row) => {
      const user = userMap.get(row.id);
      const contract = contractMap.get(row.id);
      let accountStatus: 'not_opened' | 'active' | 'disabled' = 'not_opened';
      let userId: string | null = null;
      if (user) {
        userId = user.id;
        accountStatus = user.status === 'active' ? 'active' : 'disabled';
      }

      const creditInfo = creditMap.get(row.id) ?? { balance: '0', planExpiresAt: null };
      const balanceStr = creditInfo.balance;

      const computedServiceEnd = creditInfo.planExpiresAt
        ? creditInfo.planExpiresAt.toISOString()
        : contract?.serviceEnd
          ? new Date(contract.serviceEnd).toISOString()
          : null;

      return {
        id: row.id,
        companyName: row.companyName,
        brandName: row.brandName,
        industry: row.industry,
        contactPerson: row.contactPerson,
        contactPhone: row.contactPhone,
        packageType: (contract?.packageType as PackageType) ?? null,
        creditBalance: Number(balanceStr),
        username: user?.username ?? null,
        userId,
        accountStatus,
        serviceEnd: computedServiceEnd,
        createdAt: new Date(row.createdAt).toISOString(),
        remark: row.remark ?? null,
      } as CustomerItem;
    }).filter(Boolean) as CustomerItem[];

    return { items, total, page, pageSize };
  }

  async createCustomer(
    dto: CreateCustomerDto,
    operatorId: string,
  ): Promise<{ brandId: string; brandName: string; creditBalance: number }> {
    const initialCredit = dto.initialCredit ?? 0;

    const result = await this.db.transaction(async (tx) => {
      const [brand] = await tx
        .insert(geoBrands)
        .values({
          companyName: dto.companyName,
          name: dto.brandName,
          industry: dto.industry,
          contactPerson: dto.contactPerson,
          contactPhone: dto.contactPhone,
          address: dto.address,
          domain: dto.domain,
          status: 'active',
          remark: dto.remark,
        })
        .returning({ id: geoBrands.id, name: geoBrands.name });

      const brandId = brand.id;

      const [account] = await tx
        .insert(geoCreditAccounts)
        .values({
          brandId,
          balance: String(initialCredit),
          totalUsed: '0',
          totalRecharged: '0',
        })
        .returning({ balance: geoCreditAccounts.balance });

      if (initialCredit > 0) {
        await tx.insert(geoCreditTransactions).values({
          brandId,
          transactionType: 'plan_grant',
          changeAmount: String(initialCredit),
          balanceAfter: String(initialCredit),
          description: '开通赠送',
          relatedType: 'brand',
          relatedId: brandId,
          operatorId,
        });
      }

      const today = dayjs().format('YYYY-MM-DD');
      const oneYearLater = dayjs().add(1, 'year').format('YYYY-MM-DD');
      await tx.insert(geoContracts).values({
        brandId,
        customerName: dto.companyName,
        industry: dto.industry,
        contactPerson: dto.contactPerson,
        contactPhone: dto.contactPhone,
        packageType: dto.packageType,
        contractAmount: '0',
        signDate: today,
        serviceStart: today,
        serviceEnd: oneYearLater,
        paymentStatus: 'paid',
      });

      return { brandId, brandName: brand.name, creditBalance: initialCredit };
    });

    return result;
  }

  async createBrandUser(
    dto: CreateBrandUserDto,
  ): Promise<{ userId: string; username: string; role: UserRole; password: string }> {
    const brand = await this.db
      .select({ id: geoBrands.id })
      .from(geoBrands)
      .where(eq(geoBrands.id, dto.brandId))
      .limit(1);

    if (brand.length === 0) {
      throw new NotFoundException('品牌不存在');
    }

    const existing = await this.db
      .select({ id: geoUsers.id })
      .from(geoUsers)
      .where(eq(geoUsers.username, dto.username))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('登录名已存在');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const [user] = await this.db
      .insert(geoUsers)
      .values({
        username: dto.username,
        passwordHash,
        role: dto.role,
        displayName: dto.displayName ?? undefined,
        brandId: dto.brandId,
        status: 'active',
      })
      .returning({ id: geoUsers.id, username: geoUsers.username, role: geoUsers.role });

    return {
      userId: user.id,
      username: user.username,
      role: user.role as UserRole,
      password: dto.password,
    };
  }

  async resetPassword(
    userId: string,
  ): Promise<{ userId: string; username: string; newPassword: string }> {
    const userRows = await this.db
      .select({ id: geoUsers.id, username: geoUsers.username })
      .from(geoUsers)
      .where(eq(geoUsers.id, userId))
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
      username: userRows[0].username,
      newPassword,
    };
  }

  async toggleUserStatus(
    userId: string,
    status: 'active' | 'disabled',
  ): Promise<{ id: string; status: string }> {
    const [updated] = await this.db
      .update(geoUsers)
      .set({ status })
      .where(eq(geoUsers.id, userId))
      .returning({ id: geoUsers.id, status: geoUsers.status });

    if (!updated) {
      throw new NotFoundException('用户不存在');
    }

    return { id: updated.id, status: updated.status };
  }

  async updateUserRole(
    userId: string,
    role: UserRole,
  ): Promise<{ id: string; role: string }> {
    const [updated] = await this.db
      .update(geoUsers)
      .set({ role })
      .where(eq(geoUsers.id, userId))
      .returning({ id: geoUsers.id, role: geoUsers.role });

    if (!updated) {
      throw new NotFoundException('用户不存在');
    }

    return { id: updated.id, role: updated.role };
  }

  async adjustCredit(
    dto: AdjustCreditDto,
    operatorId: string,
  ): Promise<{ brandId: string; balance: number }> {
    const result = await this.db.transaction(async (tx) => {
      let accountId: string | undefined;
      let currentBalance = 0;
      const [account] = await tx
        .select({
          id: geoCreditAccounts.id,
          balance: geoCreditAccounts.balance,
        })
        .from(geoCreditAccounts)
        .where(eq(geoCreditAccounts.brandId, dto.brandId))
        .limit(1);

      if (!account) {
        const [created] = await tx
          .insert(geoCreditAccounts)
          .values({
            brandId: dto.brandId,
            balance: '0',
            totalUsed: '0',
            totalRecharged: '0',
          })
          .returning({
            id: geoCreditAccounts.id,
            balance: geoCreditAccounts.balance,
          });
        accountId = created.id;
        currentBalance = 0;
      } else {
        accountId = account.id;
        currentBalance = Number(account.balance);
      }
      const newBalance = currentBalance + dto.amount;

      if (newBalance < 0) {
        throw new BadRequestException('算力余额不足，扣减后不能为负');
      }

      const [updated] = await tx
        .update(geoCreditAccounts)
        .set({
          balance: String(newBalance),
        })
        .where(eq(geoCreditAccounts.id, accountId))
        .returning({ balance: geoCreditAccounts.balance });

      await tx.insert(geoCreditTransactions).values({
        brandId: dto.brandId,
        transactionType: 'adjustment',
        changeAmount: String(dto.amount),
        balanceAfter: String(newBalance),
        description: dto.reason,
        relatedType: 'manual_adjust',
        operatorId,
      });

      return { brandId: dto.brandId, balance: Number(updated.balance) };
    });

    return result;
  }

  async getCustomerDetail(brandId: string): Promise<CustomerDetail> {
    const [brand] = await this.db
      .select()
      .from(geoBrands)
      .where(eq(geoBrands.id, brandId))
      .limit(1);

    if (!brand) {
      throw new NotFoundException('客户不存在');
    }

    const [accountRows, users, contracts] = await Promise.all([
      this.db
        .select({
          balance: geoCreditAccounts.balance,
          totalUsed: geoCreditAccounts.totalUsed,
        })
        .from(geoCreditAccounts)
        .where(eq(geoCreditAccounts.brandId, brandId))
        .limit(1),
      this.db
        .select({
          id: geoUsers.id,
          username: geoUsers.username,
          role: geoUsers.role,
          status: geoUsers.status,
          lastLoginAt: geoUsers.lastLoginAt,
          createdAt: geoUsers.createdAt,
        })
        .from(geoUsers)
        .where(eq(geoUsers.brandId, brandId))
        .orderBy(desc(geoUsers.createdAt)),
      this.db
        .select({
          packageType: geoContracts.packageType,
          serviceEnd: geoContracts.serviceEnd,
        })
        .from(geoContracts)
        .where(eq(geoContracts.brandId, brandId))
        .orderBy(desc(geoContracts.serviceEnd))
        .limit(1),
    ]);

    const userList = users.map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role as UserRole,
      status: u.status,
      lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : null,
      createdAt: new Date(u.createdAt).toISOString(),
    }));

    return {
      id: brand.id,
      name: brand.name,
      companyName: brand.companyName,
      industry: brand.industry,
      city: brand.city,
      address: brand.address,
      contactPerson: brand.contactPerson,
      contactPhone: brand.contactPhone,
      domain: brand.domain,
      status: brand.status,
      remark: brand.remark,
      hitWords: (brand.hitWords as string[]) ?? [],
      creditBalance: accountRows[0] ? Number(accountRows[0].balance) : 0,
      packageType: (contracts[0]?.packageType as PackageType) ?? null,
      serviceEnd: contracts[0]?.serviceEnd
        ? new Date(contracts[0].serviceEnd).toISOString()
        : null,
      users: userList,
    };
  }

  async listBrandUsers(
    brandId: string,
  ): Promise<
    Array<{
      id: string;
      username: string;
      role: UserRole;
      status: string;
      lastLoginAt: string | null;
      createdAt: string;
    }>
  > {
    const rows = await this.db
      .select({
        id: geoUsers.id,
        username: geoUsers.username,
        role: geoUsers.role,
        status: geoUsers.status,
        lastLoginAt: geoUsers.lastLoginAt,
        createdAt: geoUsers.createdAt,
      })
      .from(geoUsers)
      .where(eq(geoUsers.brandId, brandId))
      .orderBy(desc(geoUsers.createdAt));

    return rows.map((row) => ({
      id: row.id,
      username: row.username,
      role: row.role as UserRole,
      status: row.status,
      lastLoginAt: row.lastLoginAt
        ? new Date(row.lastLoginAt).toISOString()
        : null,
      createdAt: new Date(row.createdAt).toISOString(),
    }));
  }
}
