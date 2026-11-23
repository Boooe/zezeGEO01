import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UnauthorizedException,
  InternalServerErrorException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { NeedGeoLogin, GeoRoles } from './auth.decorator';
import { GEO_COOKIE_NAME, COOKIE_MAX_AGE_MS, GEO_SESSION_RENEWED_HEADER } from './auth.middleware';
import type { LoginResponse, CurrentUserResponse, GeoUser } from '@shared/api.interface';
import { AuditLogService } from '../audit-log/audit-log.service';

@Controller('api/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    try {
      const result = await this.authService.validateUser(dto.username, dto.password);
      if (result.status === 'disabled') {
        throw new UnauthorizedException('账号已停用，请联系服务商');
      }
      if (result.status === 'invalid_credentials') {
        throw new UnauthorizedException('用户名或密码错误，请检查后重试');
      }

      const sessionToken = await this.authService.createSession(result.user.id, req);
      await this.authService.updateLastLogin(result.user.id);

      res.cookie(GEO_COOKIE_NAME, sessionToken, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: COOKIE_MAX_AGE_MS,
      });

      const clientIp = this.getClientIp(req);
      this.auditLogService.log({
        action: 'login',
        actor: result.user.username,
        role: result.user.role,
        target: 'session',
        detail: `用户登录成功`,
        ip: clientIp,
      });

      const rememberMe = dto.rememberMe !== false;
      if (rememberMe) {
        return { user: result.user, sessionToken };
      }
      return { user: result.user };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('登录失败', error);
      throw new InternalServerErrorException('登录失败，请稍后重试');
    }
  }

  @Post('logout')
  @NeedGeoLogin()
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: true }> {
    const token = (req as any).geoSessionToken ?? this.extractCookie(req, GEO_COOKIE_NAME);
    if (token) {
      try {
        await this.authService.deleteSession(token);
      } catch (error) {
        this.logger.error('删除会话失败', error);
      }
    }

    res.clearCookie(GEO_COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });

    return { success: true };
  }

  @Post('logout-all')
  @NeedGeoLogin()
  @GeoRoles(['admin'])
  async logoutAll(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: true; revokedCount: number }> {
    const user = (req as any).geoUser as GeoUser | undefined;
    if (!user) {
      throw new UnauthorizedException('未登录');
    }
    if (user.role !== 'admin') {
      throw new ForbiddenException('权限不足');
    }

    const currentToken = (req as any).geoSessionToken;
    const count = await this.authService.deleteAllUserSessions(user.id, currentToken);

    return { success: true, revokedCount: count };
  }

  @Get('me')
  async me(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<CurrentUserResponse> {
    const user = (req as any).geoUser as GeoUser | undefined;
    const renewedToken = res.getHeader(GEO_SESSION_RENEWED_HEADER) as string | undefined;

    if (renewedToken) {
      return { user: user ?? null, renewedToken };
    }
    return { user: user ?? null };
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

  private getClientIp(req: Request): string | undefined {
    const forwarded = req.headers['x-forwarded-for'] as string | string[] | undefined;
    if (forwarded) {
      return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
    }
    return req.ip;
  }
}
