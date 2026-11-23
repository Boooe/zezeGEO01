/* eslint-disable import/no-extraneous-dependencies */
import { Injectable, NestMiddleware, Inject, Logger } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { SqlExecutionContextMiddleware } from '@lark-apaas/nestjs-datapaas';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

@Injectable()
export class PublishClientAuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(PublishClientAuthMiddleware.name);

  constructor(
    @Inject(SqlExecutionContextMiddleware)
    private readonly sqlCtxMiddleware: SqlExecutionContextMiddleware,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
      (req as any).userContext = {
        ...((req as any).userContext || {}),
        userId: SYSTEM_USER_ID,
        userType: 'publish_client',
      };
      this.sqlCtxMiddleware.use(req, _res, next);
    } catch (error) {
      this.logger.error('客户端接口中间件异常', error);
      next();
    }
  }
}
