import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  Param,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { Request } from 'express';

import { NeedGeoLogin, GeoRoles } from '../auth/auth.decorator';
import { CustomersService } from './customers.service';
import {
  CustomerListQueryDto,
  CreateCustomerDto,
  CreateBrandUserDto,
  UpdateUserRoleDto,
  AdjustCreditDto,
  ToggleUserStatusDto,
  UpdateHitWordsDto,
} from './dto/customers.dto';
import { BrandsService } from '../brands/brands.service';

@Controller('api/customers')
@NeedGeoLogin()
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly brandsService: BrandsService,
  ) {}

  @Get()
  @GeoRoles(['admin', 'operator'])
  async list(@Query() query: CustomerListQueryDto) {
    return this.customersService.listCustomers(query);
  }

  @Post()
  @GeoRoles(['admin'])
  async create(@Body() dto: CreateCustomerDto, @Req() req: Request) {
    const ctx = (req as any).geoUser;
    return this.customersService.createCustomer(dto, ctx.id);
  }

  @Get(':id')
  @GeoRoles(['admin', 'operator'])
  async detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.getCustomerDetail(id);
  }

  @Post(':id/users')
  @GeoRoles(['admin'])
  async createUser(
    @Param('id', ParseUUIDPipe) brandId: string,
    @Body() dto: CreateBrandUserDto,
  ) {
    return this.customersService.createBrandUser({ ...dto, brandId });
  }

  @Post('users/:userId/reset-password')
  @GeoRoles(['admin'])
  async resetPassword(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.customersService.resetPassword(userId);
  }

  @Patch('users/:userId/status')
  @GeoRoles(['admin'])
  async toggleStatus(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: ToggleUserStatusDto,
  ) {
    return this.customersService.toggleUserStatus(userId, dto.status);
  }

  @Patch('users/:userId/role')
  @GeoRoles(['admin'])
  async updateRole(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.customersService.updateUserRole(userId, dto.role);
  }

  @Post(':id/credit/adjust')
  @GeoRoles(['admin'])
  async adjustCredit(
    @Param('id', ParseUUIDPipe) brandId: string,
    @Body() dto: AdjustCreditDto,
    @Req() req: Request,
  ) {
    const ctx = (req as any).geoUser;
    return this.customersService.adjustCredit({ ...dto, brandId }, ctx.id);
  }

  @Get(':id/users')
  @GeoRoles(['admin', 'operator'])
  async listUsers(@Param('id', ParseUUIDPipe) brandId: string) {
    return { items: await this.customersService.listBrandUsers(brandId) };
  }

  @Patch(':id/hit-words')
  @GeoRoles(['admin', 'operator'])
  async updateHitWords(
    @Param('id', ParseUUIDPipe) brandId: string,
    @Body() dto: UpdateHitWordsDto,
  ) {
    return this.brandsService.updateHitWords(brandId, dto.hitWords);
  }
}
