/* eslint-disable import/no-extraneous-dependencies */
import { Injectable, NestMiddleware, Inject, Logger } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { SqlExecutionContextMiddleware } from '@lark-apaas/nestjs-datapaas';

import { AuthService } from './auth.service';
import type { GeoUser } from '@shared/api.interface';

export const GEO_COOKIE_NAME = 'geo_session_id';
export const GEO_AUTH_HEADER = 'Authorization';
export const GEO_SESSION_RENEWED_HEADER = 'X-Session-Renewed';

export const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface GeoUserContext extends GeoUser {}

declare module '@nestjs/core' {
  interface Request {
    geoUser?: GeoUserContext;
    geoSessionExpired?: boolean;
    geoSessionToken?: string;
  }
}

@Injectable()
export class GeoAuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(GeoAuthMiddleware.name);

  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(SqlExecutionContextMiddleware)
    private readonly sqlCtxMiddleware: SqlExecutionContextMiddleware,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = this.extractToken(req);
      if (!token) {
        next();
        return;
      }

      const result = await this.authService.validateSession(token);

      if (result.status === 'valid' && result.user) {
        (req as any).geoUser = result.user;
        (req as any).geoSessionToken = token;
        (req as any).userContext = {
          ...((req as any).userContext || {}),
          userId: result.user.id,
          userType: 'geo_user',
        };

        if (this.authService.needsRenewal(result.createdAt)) {
          try {
            const newToken = await this.authService.renewSession(
              result.sessionId,
              result.user.id,
              req,
            );
            res.setHeader(GEO_SESSION_RENEWED_HEADER, newToken);
            res.cookie(GEO_COOKIE_NAME, newToken, {
              httpOnly: true,
              sameSite: 'lax',
              path: '/',
              maxAge: COOKIE_MAX_AGE_MS,
            });
            (req as any).geoSessionToken = newToken;
          } catch (renewError) {
            this.logger.error('会话续期失败', renewError);
          }
        }

        this.sqlCtxMiddleware.use(req, res, next);
        return;
      } else if (result.status === 'expired') {
        (req as any).geoSessionExpired = true;
      }

      next();
    } catch (error) {
      this.logger.error('会话中间件执行异常', error);
      next();
    }
  }

  private extractToken(req: Request): string | undefined {
    const cookieToken = this.extractCookie(req, GEO_COOKIE_NAME);
    if (cookieToken) return cookieToken;

    const authHeader = req.headers[GEO_AUTH_HEADER.toLowerCase()];
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    return undefined;
  }

  private extractCookie(req: Request, name: string): string | undefined {
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
}
