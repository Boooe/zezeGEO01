import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, count, desc } from 'drizzle-orm';
import { randomBytes } from 'crypto';

import { geoRoles, geoMembers } from '@server/database/schema';
import type { GeoRole, RoleListResponse } from '@shared/api.interface';
import type { CreateRoleDto, UpdateRoleDto } from './dto/roles.dto';

function extractPostgresErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth += 1) {
    const { code, cause } = current as { code?: unknown; cause?: unknown };
    if (typeof code === 'string') return code;
    current = cause;
  }
  return undefined;
}

function toRole(
  row: typeof geoRoles.$inferSelect,
  memberCount: number = 0,
): GeoRole {
  const perms = Array.isArray(row.permissions) ? (row.permissions as string[]) : [];
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    permissions: perms,
    isSystem: row.isSystem,
    sort: row.sort,
    memberCount,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

function generateRoleCode(): string {
  const suffix = randomBytes(4).toString('hex').slice(0, 6);
  return `role_${suffix}`;
}

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async listRoles(): Promise<RoleListResponse> {
    const roles = await this.db
      .select()
      .from(geoRoles)
      .orderBy(desc(geoRoles.sort), desc(geoRoles.createdAt));

    // 统计各角色下的成员数（按 role_id 关联）
    const memberCountRows = await this.db
      .select({ roleId: geoMembers.roleId, count: count() })
      .from(geoMembers)
      .where(eq(geoMembers.status, 'active'))
      .groupBy(geoMembers.roleId);

    const countMap = new Map<string, number>();
    for (const row of memberCountRows) {
      if (row.roleId) countMap.set(row.roleId, Number(row.count));
    }

    const items: GeoRole[] = roles.map((role) =>
      toRole(role, countMap.get(role.id) ?? 0),
    );

    return {
      items,
      total: roles.length,
    };
  }

  async createRole(dto: CreateRoleDto): Promise<GeoRole> {
    const code = dto.code?.trim().toLowerCase() ?? generateRoleCode();

    if (!/^[a-z0-9_]+$/.test(code)) {
      throw new BadRequestException('角色编码只能包含小写字母、数字和下划线');
    }

    try {
      const rows = await this.db
        .insert(geoRoles)
        .values({
          name: dto.name,
          code,
          permissions: dto.permissions as unknown as typeof geoRoles.$inferInsert.permissions,
          sort: dto.sort ?? 0,
          isSystem: false,
        })
        .returning();

      return toRole(rows[0], 0);
    } catch (error) {
      const pgCode = extractPostgresErrorCode(error);
      if (pgCode === '23505') {
        throw new ConflictException('角色编码已存在');
      }
      throw error;
    }
  }

  async updateRole(id: string, dto: UpdateRoleDto): Promise<GeoRole> {
    const existing = await this.db
      .select()
      .from(geoRoles)
      .where(eq(geoRoles.id, id));

    if (existing.length === 0) {
      throw new NotFoundException('角色不存在');
    }

    const patch: Partial<typeof geoRoles.$inferInsert> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.permissions !== undefined) {
      patch.permissions = dto.permissions as unknown as typeof geoRoles.$inferInsert.permissions;
    }
    if (dto.sort !== undefined) patch.sort = dto.sort;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    const updated = await this.db
      .update(geoRoles)
      .set(patch)
      .where(eq(geoRoles.id, id))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('角色不存在');
    }

    const memberCountRows = await this.db
      .select({ count: count() })
      .from(geoMembers)
      .where(eq(geoMembers.roleId, updated[0].id));

    const memberCount = Number(memberCountRows[0]?.count ?? 0);

    return toRole(updated[0], memberCount);
  }

  async deleteRole(id: string): Promise<void> {
    const existing = await this.db
      .select()
      .from(geoRoles)
      .where(eq(geoRoles.id, id));

    if (existing.length === 0) {
      throw new NotFoundException('角色不存在');
    }

    const role = existing[0];

    if (role.isSystem) {
      throw new BadRequestException('系统角色不可删除');
    }

    // 检查是否有成员在使用该角色
    const memberCountRows = await this.db
      .select({ count: count() })
      .from(geoMembers)
      .where(eq(geoMembers.roleId, role.id));

    const memberCount = Number(memberCountRows[0]?.count ?? 0);
    if (memberCount > 0) {
      throw new ConflictException('请先把该角色下的成员改派其他角色');
    }

    const deleted = await this.db
      .delete(geoRoles)
      .where(eq(geoRoles.id, id))
      .returning({ id: geoRoles.id });

    if (deleted.length === 0) {
      throw new NotFoundException('角色不存在');
    }
  }

  /** 根据 roleId 查询 role code，供 members 模块使用 */
  async getRoleCodeById(roleId: string): Promise<string> {
    const rows = await this.db
      .select({ code: geoRoles.code })
      .from(geoRoles)
      .where(eq(geoRoles.id, roleId))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('角色不存在');
    }

    return rows[0].code;
  }
}
