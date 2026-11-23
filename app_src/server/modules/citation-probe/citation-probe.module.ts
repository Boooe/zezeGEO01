import { Module } from '@nestjs/common';

import { CitationProbeController } from './citation-probe.controller';
import { CitationProbeService } from './citation-probe.service';

@Module({
  controllers: [CitationProbeController],
  providers: [CitationProbeService],
  exports: [],
})
export class CitationProbeModule {}
