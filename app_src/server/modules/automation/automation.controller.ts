import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { AutomationService } from './automation.service';
import {
  PullTasksQueryDto,
  TaskResultDto,
  VideoTaskResultDto,
} from './dto/automation.dto';

@Controller('api/automation/keywords')
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @Get('pull')
  async pullTasks(
    @Query() query: PullTasksQueryDto,
    @Req() req: Request,
  ) {
    await this.automationService.validateAutoToken(req);
    const limit = query.limit ?? 10;
    const tasks = await this.automationService.pullTasks(limit);
    return { items: tasks };
  }

  @Post('result')
  @HttpCode(HttpStatus.OK)
  async submitResult(
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    await this.automationService.validateAutoToken(req);

    if (!Array.isArray(body) || body.length === 0) {
      throw new BadRequestException('请求体必须是非空数组');
    }

    const dtos = plainToInstance(TaskResultDto, body, {
      enableImplicitConversion: true,
      excludeExtraneousValues: false,
    });

    // 逐个校验
    const allErrors: string[] = [];
    for (let i = 0; i < dtos.length; i += 1) {
      const dto = dtos[i] as TaskResultDto;
      const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: false });
      if (errors.length > 0) {
        allErrors.push(`第${i + 1}条数据校验失败`);
      }
    }

    if (allErrors.length > 0) {
      throw new BadRequestException(allErrors.join('; '));
    }

    return this.automationService.submitResults(dtos as TaskResultDto[]);
  }
}

@Controller('api/automation/videos')
export class VideoAutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @Get('pull')
  async pullVideoTasks(
    @Query() query: PullTasksQueryDto,
    @Req() req: Request,
  ) {
    await this.automationService.validateAutoToken(req);
    const limit = query.limit ?? 10;
    const tasks = await this.automationService.pullVideoTasks(limit);
    return { tasks };
  }

  @Post('result')
  @HttpCode(HttpStatus.OK)
  async submitVideoResult(
    @Body() body: { results: unknown[] } | unknown,
    @Req() req: Request,
  ) {
    await this.automationService.validateAutoToken(req);

    const payload = body as { results?: unknown[] };
    if (!payload || !Array.isArray(payload.results) || payload.results.length === 0) {
      throw new BadRequestException('请求体必须包含非空 results 数组');
    }

    const dtos = plainToInstance(VideoTaskResultDto, payload.results, {
      enableImplicitConversion: true,
      excludeExtraneousValues: false,
    });

    const allErrors: string[] = [];
    for (let i = 0; i < dtos.length; i += 1) {
      const dto = dtos[i] as VideoTaskResultDto;
      const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: false });
      if (errors.length > 0) {
        allErrors.push(`第${i + 1}条数据校验失败`);
      }
    }

    if (allErrors.length > 0) {
      throw new BadRequestException(allErrors.join('; '));
    }

    return this.automationService.submitVideoResults(dtos as VideoTaskResultDto[]);
  }
}
