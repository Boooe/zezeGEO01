import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

import { geoAutoTokens, geoUsers, geoRoles } from '@server/database/schema';
import type { AutoToken, GeoUser } from '@shared/api.interface';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  async getTokens(): Promise<AutoToken[]> {
    const tokens = await this.db
      .select({
        id: geoAutoTokens.id,
        name: geoAutoTokens.name,
        status: geoAutoTokens.status,
        lastUsedAt: geoAutoTokens.lastUsedAt,
        createdAt: geoAutoTokens.createdAt,
      })
      .from(geoAutoTokens)
      .orderBy(geoAutoTokens.createdAt);

    return tokens.map((t) => ({
      id: t.id,
      name: t.name,
      token: null,
      status: t.status,
      lastUsedAt: t.lastUsedAt ? t.lastUsedAt.toISOString() : null,
      createdAt: t.createdAt.toISOString(),
    }));
  }

  async createToken(name: string): Promise<{ id: string; name: string; token: string; status: string }> {
    const token = randomBytes(32).toString('hex');
    const result = await this.db
      .insert(geoAutoTokens)
      .values({ name, token })
      .returning({ id: geoAutoTokens.id, name: geoAutoTokens.name, token: geoAutoTokens.token, status: geoAutoTokens.status });

    return {
      id: result[0].id,
      name: result[0].name,
      token: result[0].token,
      status: result[0].status,
    };
  }

  async deleteToken(id: string): Promise<void> {
    const result = await this.db
      .delete(geoAutoTokens)
      .where(eq(geoAutoTokens.id, id))
      .returning({ id: geoAutoTokens.id });

    if (result.length === 0) {
      throw new NotFoundException('令牌不存在');
    }
  }

  async resetToken(id: string): Promise<{ token: string }> {
    const newToken = randomBytes(32).toString('hex');
    const result = await this.db
      .update(geoAutoTokens)
      .set({ token: newToken })
      .where(eq(geoAutoTokens.id, id))
      .returning({ token: geoAutoTokens.token });

    if (result.length === 0) {
      throw new NotFoundException('令牌不存在');
    }

    return { token: result[0].token };
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const users = await this.db
      .select({ id: geoUsers.id, passwordHash: geoUsers.passwordHash })
      .from(geoUsers)
      .where(eq(geoUsers.id, userId));

    if (users.length === 0) {
      throw new NotFoundException('用户不存在');
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException('原密码错误');
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.db
      .update(geoUsers)
      .set({ passwordHash: hashed })
      .where(eq(geoUsers.id, userId));
  }

  async getProfile(userId: string): Promise<GeoUser> {
    const users = await this.db
      .select({
        id: geoUsers.id,
        username: geoUsers.username,
        role: geoUsers.role,
        roleId: geoUsers.roleId,
        displayName: geoUsers.displayName,
        brandId: geoUsers.brandId,
        status: geoUsers.status,
        lastLoginAt: geoUsers.lastLoginAt,
        createdAt: geoUsers.createdAt,
        permissions: geoRoles.permissions,
      })
      .from(geoUsers)
      .leftJoin(geoRoles, eq(geoUsers.roleId, geoRoles.id))
      .where(eq(geoUsers.id, userId));

    if (users.length === 0) {
      throw new NotFoundException('用户不存在');
    }

    const u = users[0];
    const perms = Array.isArray(u.permissions) ? (u.permissions as string[]) : [];
    return {
      id: u.id,
      username: u.username,
      role: u.role ?? 'client',
      roleId: u.roleId ?? null,
      permissions: perms,
      displayName: u.displayName,
      brandId: u.brandId,
      status: u.status,
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
      createdAt: u.createdAt.toISOString(),
    };
  }
}
