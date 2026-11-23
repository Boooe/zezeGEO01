import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';

import { NeedGeoLogin, GeoRoles } from '../auth/auth.decorator';
import { SettingsService } from './settings.service';
import { CreateTokenDto, ChangePasswordDto } from './settings.dto';
import type { AutoToken, CurrentUserResponse } from '@shared/api.interface';

@Controller('api/settings')
@NeedGeoLogin()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('tokens')
  @GeoRoles(['admin'])
  async getTokens(): Promise<AutoToken[]> {
    return this.settingsService.getTokens();
  }

  @Post('tokens')
  @GeoRoles(['admin'])
  async createToken(
    @Body() dto: CreateTokenDto,
  ): Promise<{ id: string; name: string; token: string; status: string }> {
    return this.settingsService.createToken(dto.name);
  }

  @Delete('tokens/:id')
  @GeoRoles(['admin'])
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteToken(@Param('id') id: string): Promise<void> {
    await this.settingsService.deleteToken(id);
  }

  @Post('tokens/:id/reset')
  @GeoRoles(['admin'])
  async resetToken(@Param('id') id: string): Promise<{ token: string }> {
    return this.settingsService.resetToken(id);
  }

  @Post('password')
  async changePassword(
    @Req() req: Request,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ success: true }> {
    const userId = (req as any).geoUser?.id;
    await this.settingsService.changePassword(userId, dto.oldPassword, dto.newPassword);
    return { success: true };
  }

  @Get('profile')
  async getProfile(@Req() req: Request): Promise<CurrentUserResponse> {
    const userId = (req as any).geoUser?.id;
    const user = await this.settingsService.getProfile(userId);
    return { user };
  }
}
