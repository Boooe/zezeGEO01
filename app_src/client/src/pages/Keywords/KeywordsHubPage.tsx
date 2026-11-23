import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@client/src/components/ui/tabs';
import { Button } from '@client/src/components/ui/button';
import KeywordPoolPage from '@client/src/pages/Keywords/KeywordPoolPage';
import KeywordsPage from '@client/src/pages/Keywords/Keywords';
import KeywordInspirationPage from '@client/src/pages/Keywords/KeywordInspirationPage';
import LongtailComboPage from '@client/src/pages/Keywords/LongtailComboPage';
import KeywordTasksPage from '@client/src/pages/Keywords/KeywordTasksPage';
import KeywordReports from '@client/src/pages/Keywords/components/KeywordReports';
import { PageHeader } from '@client/src/components/layout/PageHeader';

const TABS = [
  { value: 'pool', label: '词池' },
  { value: 'library', label: '词库' },
  { value: 'monitor', label: '检测任务' },
  { value: 'report', label: '报表' },
] as const;

const HIDDEN_TABS = ['inspiration', 'longtail'];

const KeywordsHubPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const rawTab = searchParams.get('tab') as string;

  React.useEffect(() => {
    if (rawTab && HIDDEN_TABS.includes(rawTab)) {
      setSearchParams({ tab: TABS[0].value }, { replace: true });
    }
  }, [rawTab, setSearchParams]);

  const activeTab = rawTab && !HIDDEN_TABS.includes(rawTab) ? rawTab : TABS[0].value;

  const handleTabChange = (value: string) => {
    navigate(`?tab=${value}`, { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      <div className="w-full max-w-full px-6 pt-5 pb-8">
        <PageHeader
          title="关键词管理"
          subtitle="词库管理、关键词监测、排名报表"
          actions={
            <Button
              className="h-9 bg-[#2E7DFF] text-white hover:bg-[#1E5FD6]"
              onClick={() => handleTabChange('pool')}
            >
              <Plus className="mr-2 h-4 w-4" />
              添加关键词
            </Button>
          }
        />

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <div className="overflow-x-auto border-b" style={{ borderColor: '#E5E9F2' }}>
            <TabsList className="h-10 w-full flex-nowrap justify-start gap-6 bg-transparent p-0">
              {TABS.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="relative h-10 flex-shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-1 text-sm font-medium text-slate-500 transition-colors data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="mt-6">
            <TabsContent value="pool">
              <div className="hub-content-inner">
                <KeywordPoolPage />
              </div>
            </TabsContent>
            <TabsContent value="library">
              <div className="hub-content-inner">
                <KeywordsPage />
              </div>
            </TabsContent>
            <TabsContent value="monitor">
              <div className="hub-content-inner">
                <KeywordTasksPage />
              </div>
            </TabsContent>
            <TabsContent value="report">
              <div className="hub-content-inner">
                <KeywordReports />
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <div className="mt-8 text-right text-[11px] text-[#94A3B8]">
          数据截至 {new Date().toLocaleString('zh-CN')} · 来源：geo_keywords / geo_keyword_results
        </div>
      </div>
    </div>
  );
};

export default KeywordsHubPage;
