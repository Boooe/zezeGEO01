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
import { PageHeader } from '@client/src/components/layout/PageHeader';
import DiagnosisNewPage from '@client/src/pages/Diagnosis/DiagnosisNewPage';
import DiagnosisListPage from '@client/src/pages/Diagnosis/DiagnosisListPage';
import CompetitorComparePage from '@client/src/pages/Diagnosis/CompetitorComparePage';
import CitationMonitorPage from '@client/src/pages/Diagnosis/CitationMonitorPage';

const TABS = [
  { value: 'reports', label: '诊断报告' },
  { value: 'new', label: '发起诊断' },
  { value: 'competitor', label: '竞对对比' },
  { value: 'citation', label: '引用监测' },
] as const;

const DiagnosisPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeTab = (searchParams.get('tab') as string) || 'reports';

  // 默认重定向到 reports tab
  React.useEffect(() => {
    if (!searchParams.get('tab')) {
      navigate('/diagnosis?tab=reports', { replace: true });
    }
  }, [searchParams, navigate]);

  const handleTabChange = (value: string) => {
    navigate(`?tab=${value}`, { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      <div className="max-w-full px-6 pt-5 pb-8">
        <PageHeader
          title="品牌诊断"
          subtitle="品牌 SEO 健康度检测与竞对对比分析"
          actions={
            <Button
              size="sm"
              className="bg-[#2E7DFF] text-white hover:bg-[#1E5FD6]"
              onClick={() => handleTabChange('new')}
            >
              <Plus className="h-4 w-4" />
              发起诊断
            </Button>
          }
        />

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <div className="border-b" style={{ borderColor: '#E6EAF2' }}>
            <TabsList className="h-10 w-full flex-nowrap justify-start gap-6 bg-transparent p-0">
              {TABS.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="relative h-10 flex-shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-1 text-[13px] font-medium text-[#5B6B85] transition-colors data-[state=active]:border-b-2 data-[state=active]:border-[#2E7DFF] data-[state=active]:bg-transparent data-[state=active]:text-[#2E7DFF] data-[state=active]:shadow-none data-[state=active]:font-semibold"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="pt-5">
            <TabsContent value="reports">
              <div className="hub-content-inner">
                <DiagnosisListPage />
              </div>
            </TabsContent>
            <TabsContent value="new">
              <div className="hub-content-inner">
                <DiagnosisNewPage />
              </div>
            </TabsContent>
            <TabsContent value="competitor">
              <div className="hub-content-inner">
                <CompetitorComparePage />
              </div>
            </TabsContent>
            <TabsContent value="citation">
              <div className="hub-content-inner">
                <CitationMonitorPage />
              </div>
            </TabsContent>
          </div>
        </Tabs>

        {/* 数据来源脚注 */}
        <div className="text-[11px] text-[#94A3B8] text-right mt-4">
          数据截至 {new Date().toLocaleString('zh-CN')} · 来源：geo_diagnosis_reports
        </div>
      </div>
    </div>
  );
};

export default DiagnosisPage;
