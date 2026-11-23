import { Controller, Get, Put, Post, Body, Req } from '@nestjs/common';
import type { Request } from 'express';

import { NeedGeoLogin } from '../auth/auth.decorator';
import { AccountService } from './account.service';
import {
  UpdateAccountProfileDto,
  ChangePasswordDto,
} from './dto/account.dto';
import type { AccountProfile } from '@shared/api.interface';

@Controller('api/account')
@NeedGeoLogin()
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  private getGeoUserId(req: Request): string {
    return (req as any).geoUser.id;
  }

  @Get('profile')
  async getProfile(@Req() req: Request): Promise<{ profile: AccountProfile | null }> {
    const userId = this.getGeoUserId(req);
    const profile = await this.accountService.getProfile(userId);
    return { profile };
  }

  @Put('profile')
  async updateProfile(
    @Body() dto: UpdateAccountProfileDto,
    @Req() req: Request,
  ): Promise<{ profile: AccountProfile }> {
    const userId = this.getGeoUserId(req);
    const profile = await this.accountService.upsertProfile(userId, dto);
    return { profile };
  }

  @Post('password')
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ): Promise<{ success: boolean }> {
    const userId = this.getGeoUserId(req);
    await this.accountService.changePassword(userId, dto.oldPassword, dto.newPassword);
    return { success: true };
  }
}
