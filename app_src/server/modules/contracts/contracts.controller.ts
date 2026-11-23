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
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { NeedGeoLogin, GeoRoles } from '../auth/auth.decorator';
import { GeoAuthGuard, GeoRolesGuard } from '../auth/auth.guard';
import { ContractsService } from './contracts.service';
import { QueryContractDto } from './dto/query-contract.dto';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { RenewContractDto } from './dto/renew-contract.dto';

interface GeoUserCtx {
  id: string;
  username: string;
  role: string;
  brandId: string | null;
}

function getGeoUser(req: Request): GeoUserCtx {
  return (req as any).geoUser as GeoUserCtx;
}

@Controller('api/contracts')
@NeedGeoLogin()
@UseGuards(GeoAuthGuard, GeoRolesGuard)
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get('stats')
  async getStats(@Req() req: Request) {
    const user = getGeoUser(req);
    return this.contractsService.getStats(user);
  }

  @Get('export')
  async exportCSV(@Req() req: Request, @Res() res: Response, @Query() query: QueryContractDto) {
    const user = getGeoUser(req);
    const csv = await this.contractsService.exportCSV(query, user);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="contracts.csv"');
    res.send(csv);
  }

  @Get()
  async findAll(@Req() req: Request, @Query() query: QueryContractDto) {
    const user = getGeoUser(req);
    return this.contractsService.findAll(query, user);
  }

  @Get(':id')
  async findOne(@Req() req: Request, @Param('id') id: string) {
    const user = getGeoUser(req);
    return this.contractsService.findOne(id, user);
  }

  @Post()
  @GeoRoles(['admin', 'operator'])
  async create(@Body() dto: CreateContractDto) {
    return this.contractsService.create(dto);
  }

  @Patch(':id')
  @GeoRoles(['admin', 'operator'])
  async update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateContractDto) {
    const user = getGeoUser(req);
    return this.contractsService.update(id, dto, user);
  }

  @Delete(':id')
  @GeoRoles(['admin'])
  async delete(@Param('id') id: string) {
    await this.contractsService.delete(id);
    return { success: true };
  }

  @Post(':id/payments')
  @GeoRoles(['admin', 'operator'])
  async addPayment(@Param('id') id: string, @Body() dto: CreatePaymentDto) {
    return this.contractsService.addPayment(id, dto);
  }

  @Post(':id/renew')
  @GeoRoles(['admin', 'operator'])
  async renew(@Req() req: Request, @Param('id') id: string, @Body() dto: RenewContractDto) {
    const user = getGeoUser(req);
    return this.contractsService.renew(id, dto, user);
  }
}
