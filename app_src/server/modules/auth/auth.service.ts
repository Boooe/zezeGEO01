import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, ne } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import type { Request } from 'express';

import { geoUsers, geoSessions, geoRoles } from '@server/database/schema';
import type { GeoUser } from '@shared/api.interface';

const MAX_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const RENEWAL_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

export type SessionValidationResult =
  | { status: 'valid'; user: GeoUser; sessionId: string; createdAt: Date }
  | { status: 'expired'; user: null; sessionId?: string }
  | { status: 'not_found'; user: null };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async validateUser(
    username: string,
    password: string,
  ): Promise<
    | { status: 'valid'; user: GeoUser }
    | { status: 'invalid_credentials'; user: null }
    | { status: 'disabled'; user: null }
  > {
    try {
      const users = await this.db
        .select({
          user: geoUsers,
          role: geoRoles,
        })
        .from(geoUsers)
        .leftJoin(geoRoles, eq(geoUsers.roleId, geoRoles.id))
        .where(eq(geoUsers.username, username))
        .limit(1);

      if (users.length === 0) {
        return { status: 'invalid_credentials', user: null };
      }

      const { user, role } = users[0];
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        return { status: 'invalid_credentials', user: null };
      }

      if (user.status !== 'active') {
        return { status: 'disabled', user: null };
      }

      return { status: 'valid', user: this.mapToGeoUser(user, role) };
    } catch (error) {
      this.logger.error('验证用户失败', error);
      throw error;
    }
  }

  async createSession(userId: string, req: Request): Promise<string> {
    const sessionToken = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + MAX_LIFETIME_MS);

    const ipAddress = this.getIpAddress(req);
    const userAgent = req.headers['user-agent'] ?? undefined;

    await this.db.insert(geoSessions).values({
      sessionToken,
      userId,
      ipAddress,
      userAgent,
      expiresAt,
      lastActivityAt: now,
    });

    return sessionToken;
  }

  async validateSession(token: string): Promise<SessionValidationResult> {
    try {
      const sessions = await this.db
        .select()
        .from(geoSessions)
        .where(eq(geoSessions.sessionToken, token))
        .limit(1);

      if (sessions.length === 0) {
        return { status: 'not_found', user: null };
      }

      const session = sessions[0];
      const now = Date.now();
      const createdAt = new Date(session.createdAt).getTime();

      const isExpired = now - createdAt > MAX_LIFETIME_MS;
      if (isExpired) {
        await this.db.delete(geoSessions).where(eq(geoSessions.id, session.id));
        return { status: 'expired', user: null, sessionId: session.id };
      }

      await this.db
        .update(geoSessions)
        .set({ lastActivityAt: new Date() })
        .where(eq(geoSessions.id, session.id));

      const userRows = await this.db
        .select({
          user: geoUsers,
          role: geoRoles,
        })
        .from(geoUsers)
        .leftJoin(geoRoles, eq(geoUsers.roleId, geoRoles.id))
        .where(eq(geoUsers.id, session.userId))
        .limit(1);

      if (userRows.length === 0 || userRows[0].user.status !== 'active') {
        return { status: 'expired', user: null, sessionId: session.id };
      }

      const { user, role } = userRows[0];

      return {
        status: 'valid',
        user: this.mapToGeoUser(user, role),
        sessionId: session.id,
        createdAt: new Date(session.createdAt),
      };
    } catch (error) {
      this.logger.error('验证会话失败', error);
      return { status: 'not_found', user: null };
    }
  }

  async renewSession(oldSessionId: string, userId: string, req: Request): Promise<string> {
    const newToken = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + MAX_LIFETIME_MS);

    const ipAddress = this.getIpAddress(req);
    const userAgent = req.headers['user-agent'] ?? undefined;

    await this.db.transaction(async (tx) => {
      await tx.delete(geoSessions).where(eq(geoSessions.id, oldSessionId));
      await tx.insert(geoSessions).values({
        sessionToken: newToken,
        userId,
        ipAddress,
        userAgent,
        expiresAt,
        lastActivityAt: now,
      });
    });

    return newToken;
  }

  async deleteSession(token: string): Promise<void> {
    await this.db.delete(geoSessions).where(eq(geoSessions.sessionToken, token));
  }

  async deleteAllUserSessions(userId: string, exceptToken?: string): Promise<number> {
    const conditions = [eq(geoSessions.userId, userId)];
    if (exceptToken) {
      conditions.push(ne(geoSessions.sessionToken, exceptToken));
    }

    const result = await this.db
      .delete(geoSessions)
      .where(and(...conditions))
      .returning({ id: geoSessions.id });

    return result.length;
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.db
      .update(geoUsers)
      .set({ lastLoginAt: new Date() })
      .where(eq(geoUsers.id, userId));
  }

  needsRenewal(createdAt: Date): boolean {
    return Date.now() - new Date(createdAt).getTime() > RENEWAL_THRESHOLD_MS;
  }

  private mapToGeoUser(
    user: typeof geoUsers.$inferSelect,
    role: typeof geoRoles.$inferSelect | null,
  ): GeoUser {
    const permissions = role && Array.isArray(role.permissions)
      ? (role.permissions as string[])
      : [];

    return {
      id: user.id,
      username: user.username,
      role: user.role as GeoUser['role'],
      roleId: user.roleId ?? null,
      permissions,
      displayName: user.displayName ?? null,
      brandId: user.brandId ?? null,
      status: user.status,
      lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt).toISOString() : null,
      createdAt: new Date(user.createdAt).toISOString(),
    };
  }

  private getIpAddress(req: Request): string | undefined {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }
    return req.ip;
  }
}
