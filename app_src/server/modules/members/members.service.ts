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
} from 'drizzle-orm';

import { geoMembers, geoRoles } from '@server/database/schema';
import type { GeoMember, MemberListResponse } from '@shared/api.interface';
import { RolesService } from '../roles/roles.service';
import type {
  MemberListQueryDto,
  CreateMemberDto,
  UpdateMemberStatusDto,
  UpdateMemberRoleDto,
} from './dto/members.dto';

function extractPostgresErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth += 1) {
    const { code, cause } = current as { code?: unknown; cause?: unknown };
    if (typeof code === 'string') return code;
    current = cause;
  }
  return undefined;
}

type MemberWithRole = typeof geoMembers.$inferSelect & {
  roleName: string | null;
  roleCode: string | null;
};

function toMember(row: MemberWithRole): GeoMember {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.roleCode ?? row.role,
    roleName: row.roleName ?? row.role,
    roleId: row.roleId ?? null,
    status: row.status as GeoMember['status'],
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class MembersService {
  private readonly logger = new Logger(MembersService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly rolesService: RolesService,
  ) {}

  async listMembers(query: MemberListQueryDto): Promise<MemberListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (query.role) {
      conditions.push(eq(geoRoles.code, query.role));
    }

    if (query.status) {
      conditions.push(eq(geoMembers.status, query.status));
    }

    if (query.keyword) {
      const keyword = `%${query.keyword}%`;
      conditions.push(or(
        ilike(geoMembers.name, keyword),
        ilike(geoMembers.username, keyword),
      ));
    }

    const where = conditions.length > 0
      ? and(...conditions)
      : undefined;

    const baseQuery = this.db
      .select({
        id: geoMembers.id,
        name: geoMembers.name,
        username: geoMembers.username,
        role: geoMembers.role,
        roleId: geoMembers.roleId,
        status: geoMembers.status,
        lastLoginAt: geoMembers.lastLoginAt,
        createdAt: geoMembers.createdAt,
        updatedAt: geoMembers.updatedAt,
        roleName: geoRoles.name,
        roleCode: geoRoles.code,
      })
      .from(geoMembers)
      .leftJoin(geoRoles, eq(geoMembers.roleId, geoRoles.id));

    const base = where ? baseQuery.where(where) : baseQuery;

    const [rows, countResult] = await Promise.all([
      base
        .orderBy(desc(geoMembers.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(geoMembers)
        .where(where),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return {
      items: rows.map((row) => toMember(row)),
      total,
      page,
      pageSize,
    };
  }

  async createMember(dto: CreateMemberDto): Promise<GeoMember> {
    try {
      const roleResult = await this.db
        .select({ id: geoRoles.id, code: geoRoles.code, name: geoRoles.name })
        .from(geoRoles)
        .where(eq(geoRoles.code, dto.role))
        .limit(1);

      if (roleResult.length === 0) {
        throw new BadRequestException('角色不存在');
      }

      const roleRow = roleResult[0];
      const rows = await this.db
        .insert(geoMembers)
        .values({
          name: dto.name,
          username: dto.username,
          role: dto.role,
          roleId: roleRow.id,
          status: 'active',
        })
        .returning();

      return toMember({
        ...rows[0],
        roleName: roleRow.name,
        roleCode: roleRow.code,
      });
    } catch (error) {
      const code = extractPostgresErrorCode(error);
      if (code === '23505') {
        throw new ConflictException('用户名已存在');
      }
      throw error;
    }
  }

  async updateMemberStatus(
    id: string,
    dto: UpdateMemberStatusDto,
    currentUsername: string,
  ): Promise<GeoMember> {
    const existing = await this.db
      .select()
      .from(geoMembers)
      .where(eq(geoMembers.id, id));

    if (existing.length === 0) {
      throw new NotFoundException('成员不存在');
    }

    const member = existing[0];
    if (member.username === currentUsername) {
      throw new BadRequestException('不能禁用自己');
    }

    const updated = await this.db
      .update(geoMembers)
      .set({ status: dto.status })
      .where(eq(geoMembers.id, id))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('成员不存在');
    }

    const roleRow = await this.db
      .select({ code: geoRoles.code, name: geoRoles.name })
      .from(geoRoles)
      .where(eq(geoRoles.id, updated[0].roleId))
      .limit(1);

    return toMember({
      ...updated[0],
      roleName: roleRow[0]?.name ?? null,
      roleCode: roleRow[0]?.code ?? null,
    });
  }

  async updateMemberRole(
    id: string,
    dto: UpdateMemberRoleDto,
  ): Promise<GeoMember> {
    const existing = await this.db
      .select()
      .from(geoMembers)
      .where(eq(geoMembers.id, id));

    if (existing.length === 0) {
      throw new NotFoundException('成员不存在');
    }

    const roleRows = await this.db
      .select({ id: geoRoles.id, code: geoRoles.code, name: geoRoles.name })
      .from(geoRoles)
      .where(eq(geoRoles.id, dto.roleId))
      .limit(1);

    if (roleRows.length === 0) {
      throw new BadRequestException('角色不存在');
    }

    const roleRow = roleRows[0];
    const updated = await this.db
      .update(geoMembers)
      .set({ roleId: dto.roleId, role: roleRow.code })
      .where(eq(geoMembers.id, id))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('成员不存在');
    }

    return toMember({
      ...updated[0],
      roleName: roleRow.name,
      roleCode: roleRow.code,
    });
  }
}
