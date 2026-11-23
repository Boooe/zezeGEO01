import { APP_FILTER } from '@nestjs/core';
import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { PlatformModule } from '@lark-apaas/fullstack-nestjs-core';

import { GlobalExceptionFilter } from './common/filters/exception.filter';
import { AuthModule } from './modules/auth/auth.module';
import { BrandsModule } from './modules/brands/brands.module';
import { CustomersModule } from './modules/customers/customers.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { LeadsModule } from './modules/leads/leads.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { ReportsModule } from './modules/reports/reports.module';
import { KeywordsModule } from './modules/keywords/keywords.module';
import { AutomationModule } from './modules/automation/automation.module';
import { SettingsModule } from './modules/settings/settings.module';
import { ContentModule } from './modules/content/content.module';
import { CommitmentModule } from './modules/commitment/commitment.module';
import { DiagnosisModule } from './modules/diagnosis/diagnosis.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { PublicationModule } from './modules/publication/publication.module';
import { ChannelsModule } from './modules/channels/channels.module';
import { PublishQueueModule } from './modules/publish-queue/publish-queue.module';
import { SubmissionChannelsModule } from './modules/submission-channels/submission-channels.module';
import { SubmissionQueueModule } from './modules/submission-queue/submission-queue.module';
import { WebsiteModule } from './modules/website/website.module';
import { AccountModule } from './modules/account/account.module';
import { AiModule } from './modules/ai/ai.module';
import { AiKeysModule } from './modules/ai-keys/ai-keys.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { CitationProbeModule } from './modules/citation-probe/citation-probe.module';
import { AdminDeliveryModule } from './modules/admin-delivery/admin-delivery.module';
import { AccountAuthsModule } from './modules/account-auths/account-auths.module';
import { PublishClientModule } from './modules/publish-client/publish-client.module';
import { MediaMarketModule } from './modules/media-market/media-market.module';
import { MediaWalletModule } from './modules/media-wallet/media-wallet.module';
import { MediaOrdersModule } from './modules/media-orders/media-orders.module';
import { GeoLoopModule } from './modules/geo-loop/geo-loop.module';
import { PlacementRecordsModule } from './modules/placement-records/placement-records.module';
import { MembersModule } from './modules/members/members.module';
import { RolesModule } from './modules/roles/roles.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { HealthModule } from './modules/health/health.module';
import { ViewModule } from './modules/view/view.module';

@Module({
  imports: [
    AiModule,
    PlatformModule.forRoot({
      enableCsrf: process.env.NODE_ENV !== 'development',
      csrfRoutes: [
        '/api/auth/*',
        '/api/brands/*',
        '/api/customers/*',
        '/api/dashboard/*',
        '/api/leads/*',
        '/api/contracts/*',
        '/api/reports/*',
        '/api/keywords/*',
        '/api/settings/*',
        '/api/content/*',
        '/api/commitment/*',
        '/api/diagnosis/*',
        '/api/knowledge/*',
        '/api/publication/*',
        '/api/channels/*',
        '/api/publish-queue/*',
        '/api/submission-channels/*',
        '/api/submission-queue/*',
        '/api/website/*',
        '/api/account/*',
        '/api/compliance/*',
        '/api/ai-keys/*',
        '/api/credit-requests/*',
        '/api/admin/*',
        '/api/account-auths/*',
        '/api/citation-probe/*',
        '/api/media-market/*',
        '/api/media-wallet/*',
        '/api/media-orders/*',
        '/api/geo-loop/*',
        '/api/placement-records/*',
        '/api/members/*',
        '/api/roles/*',
        '/api/audit-logs/*',
      ],
    }),
    // ====== @route-section: business-modules START ======
    AuthModule,
    BrandsModule,
    CustomersModule,
    DashboardModule,
    LeadsModule,
    ContractsModule,
    ReportsModule,
    KeywordsModule,
    AutomationModule,
    SettingsModule,
    ContentModule,
    CommitmentModule,
    DiagnosisModule,
    KnowledgeModule,
    PublicationModule,
    ChannelsModule,
    PublishQueueModule,
    SubmissionChannelsModule,
    SubmissionQueueModule,
    WebsiteModule,
    AccountModule,
    AiKeysModule,
    ComplianceModule,
    CitationProbeModule,
    AdminDeliveryModule,
    AccountAuthsModule,
    PublishClientModule,
    MediaMarketModule,
    MediaWalletModule,
    MediaOrdersModule,
    GeoLoopModule,
    PlacementRecordsModule,
    MembersModule,
    RolesModule,
    AuditLogModule,
    HealthModule,
    ViewModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule implements OnModuleInit {
  private readonly logger = new Logger(AppModule.name);

  onModuleInit(): void {
    process.on('unhandledRejection', (reason: unknown) => {
      this.logger.error(
        'Unhandled promise rejection (caught, process continues):',
        reason instanceof Error ? reason.stack : String(reason),
      );
    });
    process.on('uncaughtException', (error: Error) => {
      this.logger.error(
        'Uncaught exception (caught, process continues):',
        error.stack,
      );
    });
    this.logger.log('Global crash guard installed');
  }
}
