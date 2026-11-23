import { Controller, Get, Param } from '@nestjs/common';

import { DiagnosisService } from './diagnosis.service';

// 匿名分享接口，不加 @NeedGeoLogin()
@Controller('api/diagnosis/share')
export class DiagnosisShareController {
  constructor(private readonly diagnosisService: DiagnosisService) {}

  @Get(':token')
  async getSharedReport(@Param('token') token: string) {
    return this.diagnosisService.getReportByShareToken(token);
  }
}
