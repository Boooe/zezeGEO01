import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, sql } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';

import { geoUsers } from '@server/database/schema';

interface SeedUser {
  username: string;
  password: string;
  role: 'admin' | 'operator' | 'client';
  displayName: string;
  brandName?: string;
}

const SEED_USERS: SeedUser[] = [
  { username: 'admin', password: 'Admin@123', role: 'admin', displayName: '超级管理员' },
  { username: 'geoadmin', password: 'Geo@2026', role: 'admin', displayName: 'GEO管理员' },
  { username: 'demo_client', password: 'Client@2026', role: 'client', displayName: '演示客户', brandName: '演示品牌' },
  { username: 'demo_client2', password: 'Client@2026', role: 'client', displayName: '演示客户2', brandName: '演示品牌2' },
];

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);
  private readonly forceReset = process.env.FORCE_RESET_PASSWORDS === 'true';

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureSeedUsers();
    } catch (error) {
      this.logger.error(
        '初始化种子用户失败',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async ensureSeedUsers(): Promise<void> {
    for (const user of SEED_USERS) {
      let brandId: string | null = null;
      if (user.brandName) {
        const brandRows = await this.db.execute(sql`
          SELECT id FROM geo_brands WHERE name = ${user.brandName} LIMIT 1
        `) as { id: string }[];
        if (brandRows.length > 0) {
          brandId = brandRows[0].id;
        }
      }

      const existing = await this.db
        .select({ id: geoUsers.id })
        .from(geoUsers)
        .where(eq(geoUsers.username, user.username))
        .limit(1);

      if (existing.length === 0) {
        const passwordHash = await bcrypt.hash(user.password, 10);
        await this.db.insert(geoUsers).values({
          username: user.username,
          passwordHash,
          role: user.role,
          displayName: user.displayName,
          brandId: brandId ?? null,
          status: 'active',
        });
        this.logger.log(`已创建初始用户: ${user.username} (${user.role})`);
        continue;
      }

      if (this.forceReset) {
        const passwordHash = await bcrypt.hash(user.password, 10);
        await this.db
          .update(geoUsers)
          .set({
            passwordHash,
            role: user.role,
            displayName: user.displayName,
            brandId: brandId ?? undefined,
            status: 'active',
          })
          .where(eq(geoUsers.username, user.username));
        this.logger.log(`已重置种子用户密码: ${user.username}`);
      }
    }
  }
}
