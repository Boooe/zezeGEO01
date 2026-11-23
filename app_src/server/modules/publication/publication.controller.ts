import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';

import { PublishService } from './publish.service';
import {
  AutoPublishTaskListQueryDto,
  CreateAutoPublishTaskDto,
  UpdateAutoPublishTaskDto,
} from './dto/publish.dto';
import { GeoRoles } from '../auth/auth.decorator';
import { AUTO_PUBLISH_STATUS } from '@shared/api.interface';

@Controller('api/publication')
export class PublicationController {
  constructor(private readonly publishService: PublishService) {}

  private getGeoUser(req: Request) {
    return (req as any).geoUser;
  }

  /* ---------- 自动发布任务 ---------- */

  @Get('auto-publish')
  @GeoRoles(['admin', 'operator', 'client'])
  async listAutoPublishTasks(
    @Query() query: AutoPublishTaskListQueryDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.publishService.listAutoPublishTasks(query, user);
  }

  @Post('auto-publish')
  @GeoRoles(['admin', 'operator', 'client'])
  async createAutoPublishTask(
    @Body() dto: CreateAutoPublishTaskDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.publishService.createAutoPublishTask(dto, user);
  }

  // 静态子路由放在 :id 前面避免匹配冲突
  @Patch('auto-publish/:id/status')
  @GeoRoles(['admin', 'operator', 'client'])
  async toggleAutoPublishStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
    @Req() req: Request,
  ) {
    if (!AUTO_PUBLISH_STATUS.includes(body.status as any)) {
      throw new BadRequestException('无效的任务状态');
    }
    const user = this.getGeoUser(req);
    return this.publishService.toggleTaskStatus(
      id,
      body.status as any,
      user,
    );
  }

  @Get('auto-publish/:id')
  @GeoRoles(['admin', 'operator', 'client'])
  async getAutoPublishTask(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.publishService.getAutoPublishTask(id, user);
  }

  @Patch('auto-publish/:id')
  @GeoRoles(['admin', 'operator', 'client'])
  async updateAutoPublishTask(
    @Param('id') id: string,
    @Body() dto: UpdateAutoPublishTaskDto,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.publishService.updateAutoPublishTask(id, dto, user);
  }

  @Delete('auto-publish/:id')
  @GeoRoles(['admin', 'operator', 'client'])
  async deleteAutoPublishTask(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = this.getGeoUser(req);
    return this.publishService.deleteAutoPublishTask(id, user);
  }
}
