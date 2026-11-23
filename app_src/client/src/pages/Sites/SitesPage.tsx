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
import WebsiteSettingsPage from '@client/src/pages/Website/WebsiteSettingsPage';
import WebsiteTdkPage from '@client/src/pages/Website/WebsiteTdkPage';
import WebsiteSitesPage from '@client/src/pages/Website/WebsiteSitesPage';
import KnowledgePage from '@client/src/pages/Settings/KnowledgePage';
import { PageHeader } from '@client/src/components/layout/PageHeader';

const TABS = [
  { value: 'settings', label: '官网设置' },
  { value: 'tdk', label: 'TDK 模板' },
  { value: 'list', label: '站点' },
  { value: 'knowledge', label: '知识条目' },
] as const;

const SitesPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeTab = (searchParams.get('tab') as string) || TABS[0].value;

  const handleTabChange = (value: string) => {
    navigate(`?tab=${value}`, { replace: true });
  };

  const siteType = searchParams.get('siteType') || '';

  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      <div className="w-full max-w-full px-6 pt-5 pb-8">
        <PageHeader
          title="站群管理"
          subtitle="网站管理、站点配置、知识接入"
          actions={
            <Button
              size="sm"
              className="bg-[#2E7DFF] text-white hover:bg-[#1E5FD6]"
              onClick={() => handleTabChange('list')}
            >
              <Plus className="h-4 w-4" />
              添加站点
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
            <TabsContent value="settings">
              <div className="hub-content-inner">
                <WebsiteSettingsPage />
              </div>
            </TabsContent>
            <TabsContent value="tdk">
              <div className="hub-content-inner">
                <WebsiteTdkPage />
              </div>
            </TabsContent>
            <TabsContent value="list">
              <div className="hub-content-inner">
                <WebsiteSitesPage defaultSiteType={siteType as any} />
              </div>
            </TabsContent>
            <TabsContent value="knowledge">
              <div className="hub-content-inner">
                <KnowledgePage />
              </div>
            </TabsContent>
          </div>
        </Tabs>

        {/* 数据来源脚注 */}
        <div className="text-[11px] text-[#94A3B8] text-right mt-4">
          数据截至 {new Date().toLocaleString('zh-CN')} · 来源：geo_sites
        </div>
      </div>
    </div>
  );
};

export default SitesPage;
