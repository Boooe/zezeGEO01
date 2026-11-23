import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, Users, FileText } from 'lucide-react';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@client/src/components/ui/tabs';
import { Button } from '@client/src/components/ui/button';
import PublishRecordsPage from '@client/src/pages/Publication/PublishRecordsPage';
import PublishQueuePage from '@client/src/pages/Publication/PublishQueuePage';
import AutoPublishPage from '@client/src/pages/Publication/AutoPublishPage';
import PublishLedgerPage from '@client/src/pages/Publication/PublishLedgerPage';
import SubmissionChannelsPage from '@client/src/pages/Publication/SubmissionChannelsPage';
import { PageHeader } from '@client/src/components/layout/PageHeader';
import { useMarketStats } from '@client/src/api/media-market';
import { usePlacementStats } from '@client/src/api/placement-records';
import { useBrandSelector } from '@client/src/hooks/useBrandSelector';

const TABS = [
  { value: 'records', label: '发布记录' },
  { value: 'queue', label: '发布队列' },
] as const;

const HIDDEN_TABS = ['auto', 'ledger', 'channels'];

const PublishHubPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const rawTab = searchParams.get('tab') as string;

  React.useEffect(() => {
    if (rawTab === 'sources') {
      setSearchParams({ tab: 'records' }, { replace: true });
      return;
    }
    if (rawTab && HIDDEN_TABS.includes(rawTab)) {
      setSearchParams({ tab: TABS[0].value }, { replace: true });
    }
  }, [rawTab, setSearchParams]);

  const activeTab = rawTab && !HIDDEN_TABS.includes(rawTab) ? rawTab : TABS[0].value;
  const { selectedBrandId } = useBrandSelector();
  const { data: marketStats } = useMarketStats();
  const { data: placementStats } = usePlacementStats(selectedBrandId || undefined);

  const handleTabChange = (value: string) => {
    navigate(`?tab=${value}`, { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      <div className="w-full max-w-full px-6 pt-5 pb-8">
        <PageHeader
          title="发布"
          subtitle="发稿排期、队列管理、发布记录一览"
          actions={
            <Button
              className="h-9 bg-[#2E7DFF] text-white hover:bg-[#1E5FD6]"
              onClick={() => handleTabChange('records')}
            >
              <Plus className="mr-2 h-4 w-4" />
              新建发布
            </Button>
          }
        />

        {/* 统计卡片 */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div className="rounded-[12px] border border-[#E6EAF2] bg-white p-5 shadow-[0_1px_2px_rgba(15_23_42_.04),0_8px_24px_-12px_rgba(15_23_42_.10)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#EEF4FF] text-[#2E7DFF]">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[13px] text-[#5B6B85]">自有信源</div>
                  <div className="mt-1 text-[24px] font-semibold text-[#0F172A] tabular-nums">{marketStats?.selfChannelCount ?? 0}</div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-[#E5E9F2] text-[#2E7DFF] hover:bg-[#EEF4FF]"
                onClick={() => navigate('/media-market?tab=market', { replace: false })}
              >
                去媒体商城
              </Button>
            </div>
          </div>
          <div className="rounded-[12px] border border-[#E6EAF2] bg-white p-5 shadow-[0_1px_2px_rgba(15_23_42_.04),0_8px_24px_-12px_rgba(15_23_42_.10)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#E6FBF2] text-[#17C964]">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[13px] text-[#5B6B85]">本月投放</div>
                  <div className="mt-1 text-[24px] font-semibold text-[#0F172A] tabular-nums">{placementStats?.thisMonth ?? 0}</div>
                </div>
              </div>
              <Button
                size="sm"
                className="h-8 bg-[#2E7DFF] text-white hover:bg-[#1E5FD6]"
                onClick={() => handleTabChange('records')}
              >
                去发稿
              </Button>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <div className="overflow-x-auto border-b" style={{ borderColor: '#E6EAF2' }}>
            <TabsList className="h-10 w-full flex-nowrap justify-start gap-6 bg-transparent p-0">
              {TABS.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="relative h-10 flex-shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-1 text-[13px] font-medium text-[#64748b] transition-colors data-[state=active]:border-b-2 data-[state=active]:border-[#2563EB] data-[state=active]:bg-transparent data-[state=active]:text-[#2563EB] data-[state=active]:shadow-none data-[state=active]:font-semibold"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="mt-6 space-y-6">
            <TabsContent value="records">
              <div className="hub-content-inner">
                <PublishRecordsPage />
              </div>
            </TabsContent>
            <TabsContent value="queue">
              <div className="hub-content-inner">
                <PublishQueuePage />
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <div className="mt-8 text-right text-[11px] text-[#94A3B8]">
          数据截至 {new Date().toLocaleString('zh-CN')} · 来源：geo_publications / geo_submission_channels
        </div>
      </div>
    </div>
  );
};

export default PublishHubPage;
