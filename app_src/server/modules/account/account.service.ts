import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';

import { geoAccountProfiles, geoBrands, geoUsers } from '@server/database/schema';
import type { AccountProfile } from '@shared/api.interface';
import type { UpdateAccountProfileDto } from './dto/account.dto';

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async getProfile(userId: string): Promise<AccountProfile | null> {
    const rows = await this.db
      .select()
      .from(geoAccountProfiles)
      .where(eq(geoAccountProfiles.userId, userId))
      .limit(1);

    let profile: AccountProfile | null = null;
    if (rows.length > 0) {
      profile = this.mapToProfile(rows[0]);
    }

    const fallback = await this.getBrandFallback(userId);
    if (!fallback) return profile;

    if (!profile) {
      return {
        id: '',
        userId,
        companyName: fallback.companyName,
        industry: fallback.industry,
        region: fallback.region,
        contactName: fallback.contactName,
        contactPhone: fallback.contactPhone,
        createdAt: '',
        updatedAt: '',
      };
    }

    return {
      ...profile,
      companyName: profile.companyName ?? fallback.companyName,
      industry: profile.industry ?? fallback.industry,
      region: profile.region ?? fallback.region,
      contactName: profile.contactName ?? fallback.contactName,
      contactPhone: profile.contactPhone ?? fallback.contactPhone,
    };
  }

  private async getBrandFallback(userId: string): Promise<{
    companyName: string | null;
    industry: string | null;
    region: string | null;
    contactName: string | null;
    contactPhone: string | null;
  } | null> {
    const userRows = await this.db
      .select({ brandId: geoUsers.brandId, displayName: geoUsers.displayName })
      .from(geoUsers)
      .where(eq(geoUsers.id, userId))
      .limit(1);
    if (userRows.length === 0) return null;
    const user = userRows[0];

    if (!user.brandId) {
      return {
        companyName: user.displayName ?? null,
        industry: null,
        region: null,
        contactName: user.displayName ?? null,
        contactPhone: null,
      };
    }

    const brandRows = await this.db
      .select({
        name: geoBrands.name,
        industry: geoBrands.industry,
        city: geoBrands.city,
        contactPerson: geoBrands.contactPerson,
        contactPhone: geoBrands.contactPhone,
        companyName: geoBrands.companyName,
      })
      .from(geoBrands)
      .where(eq(geoBrands.id, user.brandId))
      .limit(1);
    if (brandRows.length === 0) return null;
    const brand = brandRows[0];

    return {
      companyName: brand.companyName ?? brand.name ?? null,
      industry: brand.industry ?? null,
      region: brand.city ?? null,
      contactName: brand.contactPerson ?? user.displayName ?? null,
      contactPhone: brand.contactPhone ?? null,
    };
  }

  async upsertProfile(
    userId: string,
    dto: UpdateAccountProfileDto,
  ): Promise<AccountProfile> {
    return this.db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(geoAccountProfiles)
        .where(eq(geoAccountProfiles.userId, userId))
        .limit(1);

      let profile: typeof geoAccountProfiles.$inferSelect;

      if (existing.length === 0) {
        const inserted = await tx
          .insert(geoAccountProfiles)
          .values({
            userId,
            companyName: dto.companyName ?? null,
            industry: dto.industry ?? null,
            region: dto.region ?? null,
            contactName: dto.contactName ?? null,
            contactPhone: dto.contactPhone ?? null,
          })
          .returning();
        profile = inserted[0];
      } else {
        const updated = await tx
          .update(geoAccountProfiles)
          .set({
            companyName: dto.companyName ?? null,
            industry: dto.industry ?? null,
            region: dto.region ?? null,
            contactName: dto.contactName ?? null,
            contactPhone: dto.contactPhone ?? null,
          })
          .where(eq(geoAccountProfiles.userId, userId))
          .returning();
        profile = updated[0];
      }

      // 同步更新 geo_users.displayName
      if (dto.contactName !== undefined) {
        await tx
          .update(geoUsers)
          .set({ displayName: dto.contactName ?? null })
          .where(eq(geoUsers.id, userId));
      }

      return this.mapToProfile(profile);
    });
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    const rows = await this.db
      .select({ passwordHash: geoUsers.passwordHash })
      .from(geoUsers)
      .where(eq(geoUsers.id, userId))
      .limit(1);

    if (rows.length === 0) {
      throw new BadRequestException('用户不存在');
    }

    const isOldValid = await bcrypt.compare(oldPassword, rows[0].passwordHash);
    if (!isOldValid) {
      throw new BadRequestException('原密码错误');
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await this.db
      .update(geoUsers)
      .set({ passwordHash: newHash })
      .where(eq(geoUsers.id, userId));
  }

  private mapToProfile(row: typeof geoAccountProfiles.$inferSelect): AccountProfile {
    return {
      id: row.id,
      userId: row.userId,
      companyName: row.companyName ?? null,
      industry: row.industry ?? null,
      region: row.region ?? null,
      contactName: row.contactName ?? null,
      contactPhone: row.contactPhone ?? null,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
  }
}
