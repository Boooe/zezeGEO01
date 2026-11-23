import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import { PublishClientService } from './publish-client.service';
import { CLIENT_SCRIPT_CONTENT } from './client-script.content';
import {
  ClientBindDto,
  ClientHeartbeatDto,
  ClientTaskResultDto,
} from './dto/publish-client.dto';

@Controller('api/publish-client')
export class PublishClientController {
  constructor(private readonly publishClientService: PublishClientService) {}

  @Get('download')
  downloadScript(@Res() res: Response): void {
    res.setHeader('Content-Type', 'text/x-python; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="geo-publish-client.py"');
    res.send(CLIENT_SCRIPT_CONTENT);
  }

  @Get('clients')
  async listClients(@Query('brandId') brandId?: string) {
    return this.publishClientService.listClients(brandId);
  }

  @Post('bind')
  async bind(@Body() dto: ClientBindDto) {
    return this.publishClientService.bind(dto.authCode, dto.clientVersion);
  }

  @Post('heartbeat')
  async heartbeat(@Body() dto: ClientHeartbeatDto) {
    return this.publishClientService.heartbeat(dto.token, dto.clientVersion);
  }

  @Post('tasks')
  async pullTasks(@Body() dto: ClientHeartbeatDto) {
    return this.publishClientService.pullTasks(dto.token);
  }

  @Post('task/:id/result')
  async reportTaskResult(
    @Param('id') id: string,
    @Body() dto: ClientTaskResultDto,
  ) {
    return this.publishClientService.reportTaskResult(
      dto.token,
      id,
      dto.success,
      dto.publishUrl,
      dto.error,
      dto.publishedAt,
    );
  }
}
