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
import UnifiedCreationPage from '@client/src/pages/Creation/UnifiedCreationPage';
import CreationTaskPage from '@client/src/pages/Creation/TaskPage';
import LibraryPage from '@client/src/pages/Content/LibraryPage';
import AllArticlesPage from '@client/src/pages/Content/AllArticlesPage';
import { PageHeader } from '@client/src/components/layout/PageHeader';

const TABS = [
  { value: 'write', label: '图文视频' },
  { value: 'batch', label: '批量创作' },
  { value: 'assets', label: '素材库' },
  { value: 'articles', label: '文章库' },
] as const;

const CreationHubPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeTab = (searchParams.get('tab') as string) || TABS[0].value;

  const handleTabChange = (value: string) => {
    navigate(`?tab=${value}`, { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      <div className="w-full max-w-full px-6 pt-5 pb-8">
        <PageHeader
          title="内容创作"
          subtitle="AI 辅助文章、图片、视频内容创作"
          actions={
            <Button
              size="sm"
              className="bg-[#2E7DFF] text-white hover:bg-[#1E5FD6]"
              onClick={() => handleTabChange('write')}
            >
              <Plus className="h-4 w-4" />
              新建创作
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
            <TabsContent value="write">
              <div className="hub-content-inner">
                <UnifiedCreationPage />
              </div>
            </TabsContent>
            <TabsContent value="batch">
              <div className="hub-content-inner">
                <CreationTaskPage />
              </div>
            </TabsContent>
            <TabsContent value="assets">
              <div className="hub-content-inner">
                <LibraryPage />
              </div>
            </TabsContent>
            <TabsContent value="articles">
              <div className="hub-content-inner">
                <AllArticlesPage />
              </div>
            </TabsContent>
          </div>
        </Tabs>

        {/* 数据来源脚注 */}
        <div className="text-[11px] text-[#94A3B8] text-right mt-4">
          数据截至 {new Date().toLocaleString('zh-CN')} · 来源：geo_creations
        </div>
      </div>
    </div>
  );
};

export default CreationHubPage;
