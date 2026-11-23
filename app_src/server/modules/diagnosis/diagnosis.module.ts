import { Module } from '@nestjs/common';

import { DiagnosisController } from './diagnosis.controller';
import { DiagnosisShareController } from './diagnosis-share.controller';
import { DiagnosisService } from './diagnosis.service';
import { AiKeysModule } from '../ai-keys/ai-keys.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [AiKeysModule, AuditLogModule],
  controllers: [DiagnosisController, DiagnosisShareController],
  providers: [DiagnosisService],
  exports: [],
})
export class DiagnosisModule {}
