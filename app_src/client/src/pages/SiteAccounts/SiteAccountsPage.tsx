import React from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Plus } from 'lucide-react';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@client/src/components/ui/tabs';
import { Button } from '@client/src/components/ui/button';
import { PageHeader } from '@client/src/components/layout/PageHeader';
import UnifiedAccountsPage from '@client/src/pages/Publication/UnifiedAccountsPage';
import WebsiteSettingsPage from '@client/src/pages/Website/WebsiteSettingsPage';
import WebsiteTdkPage from '@client/src/pages/Website/WebsiteTdkPage';
import WebsiteSitesPage from '@client/src/pages/Website/WebsiteSitesPage';
import KnowledgePage from '@client/src/pages/Settings/KnowledgePage';

const TOP_TABS = [
  { value: 'accounts', label: '账号' },
  { value: 'sites', label: '站点' },
] as const;

const SiteAccountsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isSitesPath = location.pathname.startsWith('/sites');
  const rawTab = searchParams.get('tab') as string;

  const topTab = isSitesPath ? 'sites' : (rawTab || 'accounts');
  const siteType = searchParams.get('siteType') || '';

  const handleTopTabChange = (value: string): void => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', value);
    params.delete('subTab');
    navigate(`?${params.toString()}`, { replace: true });
  };

  const scrollToSitesList = (): void => {
    const el = document.getElementById('sites-list-section');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      <div className="w-full max-w-full px-6 pt-5 pb-8">
        <PageHeader
          title="站点与账号"
          subtitle="发稿账号、渠道账号、站点配置统一管理"
          actions={
            topTab === 'accounts' ? (
              <Button
                size="sm"
                className="bg-[#2E7DFF] text-white hover:bg-[#1E5FD6]"
                onClick={() => {
                  const btn = document.querySelector<HTMLButtonElement>('[data-add-account="true"]');
                  if (btn) btn.click();
                }}
              >
                <Plus className="h-4 w-4" />
                添加账号
              </Button>
            ) : (
              <Button
                size="sm"
                className="bg-[#2E7DFF] text-white hover:bg-[#1E5FD6]"
                onClick={scrollToSitesList}
              >
                <Plus className="h-4 w-4" />
                添加站点
              </Button>
            )
          }
        />

        <Tabs value={topTab} onValueChange={handleTopTabChange}>
          <div className="border-b" style={{ borderColor: '#E6EAF2' }}>
            <TabsList className="h-10 w-full flex-nowrap justify-start gap-6 bg-transparent p-0">
              {TOP_TABS.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="relative h-10 flex-shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-1 text-[14px] font-medium text-[#5B6B85] transition-colors data-[state=active]:border-b-2 data-[state=active]:border-[#2E7DFF] data-[state=active]:bg-transparent data-[state=active]:text-[#2E7DFF] data-[state=active]:shadow-none data-[state=active]:font-semibold"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="pt-5">
            <TabsContent value="accounts">
              <div className="hub-content-inner">
                <UnifiedAccountsPage />
              </div>
            </TabsContent>

            <TabsContent value="sites">
              <div className="space-y-6">
                {/* 第一块：站点基本设置（官网配置 + TDK 模板） */}
                <div className="space-y-6">
                  <WebsiteSettingsPage />
                  <WebsiteTdkPage />
                </div>
                {/* 第二块：站点列表 */}
                <div id="sites-list-section">
                  <WebsiteSitesPage defaultSiteType={siteType as any} />
                </div>
                {/* 第三块：知识条目 */}
                <KnowledgePage />
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <div className="text-[11px] text-[#94A3B8] text-right mt-4">
          数据截至 {new Date().toLocaleString('zh-CN')} · 来源：geo_accounts / geo_sites
        </div>
      </div>
    </div>
  );
};

export default SiteAccountsPage;
