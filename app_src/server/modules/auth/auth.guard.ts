import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';

import { NEED_GEO_LOGIN_KEY, GEO_ROLES_KEY, REQUIRE_PERMISSION_KEY } from './auth.decorator';
import { GEO_COOKIE_NAME } from './auth.middleware';
import type { UserRole } from '@shared/api.interface';
import { isUserRole } from '@shared/api.interface';

function extractCookie(req: Request, name: string): string | undefined {
  if (req.cookies && req.cookies[name]) {
    return req.cookies[name];
  }
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.trim().split('=');
    if (key === name) {
      return decodeURIComponent(valueParts.join('='));
    }
  }
  return undefined;
}

function extractToken(req: Request): string | undefined {
  const cookieToken = extractCookie(req, GEO_COOKIE_NAME);
  if (cookieToken) return cookieToken;

  const authHeader = req.headers['authorization'];
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return undefined;
}

interface GeoUserCtx {
  id: string;
  username: string;
  role: string;
  brandId: string | null;
}

function getGeoUser(req: Request): GeoUserCtx | undefined {
  return (req as any).geoUser as GeoUserCtx | undefined;
}

function isSessionExpired(req: Request): boolean {
  return (req as any).geoSessionExpired === true;
}

@Injectable()
export class GeoAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const needLogin = this.reflector.getAllAndOverride<boolean>(NEED_GEO_LOGIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 没有标记 @NeedGeoLogin 的接口默认放行
    if (!needLogin) {
      return true;
    }

    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const geoUser = getGeoUser(req);
    if (geoUser) {
      return true;
    }

    // 判断是无会话还是会话过期
    const hasToken = Boolean(extractToken(req));
    const expired = isSessionExpired(req);

    const sessionExpired = hasToken || expired;
    res.setHeader('X-Session-Expired', sessionExpired ? 'true' : 'false');

    throw new UnauthorizedException('未登录或登录已过期');
  }
}

@Injectable()
export class GeoRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(GEO_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 没有标记角色要求的接口默认放行
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const geoUser = getGeoUser(req);

    if (!geoUser) {
      // 未登录时由 GeoAuthGuard 处理，这里先放行（让 GeoAuthGuard 抛 401）
      return true;
    }

    const userRole = geoUser.role;
    if (!isUserRole(userRole)) {
      throw new ForbiddenException('用户角色无效');
    }

    if (!requiredRoles.includes(userRole)) {
      throw new ForbiddenException('权限不足');
    }

    return true;
  }
}

@Injectable()
export class GeoPermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermission = this.reflector.getAllAndOverride<string>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 没有标记权限要求的接口默认放行
    if (!requiredPermission) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const geoUser = getGeoUser(req);

    if (!geoUser) {
      // 未登录时由 GeoAuthGuard 处理，这里先放行
      return true;
    }

    // admin 角色全通
    if (geoUser.role === 'admin') {
      return true;
    }

    const permissions = (geoUser as any).permissions as string[] | undefined;
    if (!permissions || !permissions.includes(requiredPermission)) {
      throw new ForbiddenException('权限不足');
    }

    return true;
  }
}
