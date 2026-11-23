import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Query,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';

import { NeedGeoLogin, GeoRoles } from '../auth/auth.decorator';
import { PlansService } from './plans.service';
import type {
  PlanUpsertRequest,
} from '@shared/api.interface';
import { PlanUpsertDto, PlanListQueryDto } from './dto/plans.dto';

@Controller('api/admin/plans')
@NeedGeoLogin()
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  @GeoRoles(['admin', 'operator'])
  async list(@Query() query: PlanListQueryDto) {
    return this.plansService.listPlans(query);
  }

  @Get('active')
  @GeoRoles(['admin', 'operator'])
  async active() {
    return this.plansService.listActive();
  }

  @Post()
  @GeoRoles(['admin'])
  async create(@Body() dto: PlanUpsertDto) {
    return this.plansService.createPlan(dto as PlanUpsertRequest);
  }

  @Put(':id')
  @GeoRoles(['admin'])
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PlanUpsertDto,
  ) {
    return this.plansService.updatePlan(id, dto as PlanUpsertRequest);
  }

  @Delete(':id')
  @GeoRoles(['admin'])
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.plansService.deletePlan(id);
  }
}
