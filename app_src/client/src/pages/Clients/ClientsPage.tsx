import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@client/src/components/ui/tabs';
import { Button } from '@client/src/components/ui/button';
import LeadsPage from '@client/src/pages/Leads/Leads';
import CustomersPage from '@client/src/pages/Customers/Customers';
import ContractsPage from '@client/src/pages/Contracts/Contracts';
import ReportsPage from '@client/src/pages/Reports/Reports';
import { PageHeader } from '@client/src/components/layout/PageHeader';

const TABS = [
  { value: 'leads', label: '线索' },
  { value: 'customers', label: '客户' },
  { value: 'contracts', label: '合同' },
  { value: 'reports', label: '月报' },
] as const;

const LEGACY_COMMITMENT_TABS = ['commitments', 'promise'];

const ClientsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const rawTab = (searchParams.get('tab') as string) || TABS[0].value;
  const activeTab = LEGACY_COMMITMENT_TABS.includes(rawTab) ? 'contracts' : rawTab;

  useEffect(() => {
    if (LEGACY_COMMITMENT_TABS.includes(rawTab)) {
      const params = new URLSearchParams(searchParams);
      params.set('tab', 'contracts');
      params.set('sub', 'commitments');
      navigate(`?${params.toString()}`, { replace: true });
    }
  }, [rawTab, navigate, searchParams]);

  const handleTabChange = (value: string) => {
    navigate(`?tab=${value}`, { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      <div className="max-w-full px-6 pt-5 pb-8">
        <PageHeader
          title="客户"
          subtitle="线索、客户、合同、月报全生命周期管理"
          actions={
            <Button
              size="sm"
              className="bg-[#2E7DFF] text-white hover:bg-[#1E5FD6]"
              onClick={() => handleTabChange('leads')}
            >
              <Plus className="h-4 w-4" />
              新增线索
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
                  className="relative h-10 flex-shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-1 text-[13px] font-medium text-[#64748B] transition-colors data-[state=active]:border-b-2 data-[state=active]:border-[#2563EB] data-[state=active]:bg-transparent data-[state=active]:text-[#2563EB] data-[state=active]:shadow-none data-[state=active]:font-semibold"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="pt-6">
            <TabsContent value="leads">
              <div className="hub-content-inner">
                <LeadsPage />
              </div>
            </TabsContent>
            <TabsContent value="customers">
              <div className="hub-content-inner">
                <CustomersPage />
              </div>
            </TabsContent>
            <TabsContent value="contracts">
              <div className="hub-content-inner">
                <ContractsPage />
              </div>
            </TabsContent>
            <TabsContent value="reports">
              <div className="hub-content-inner">
                <ReportsPage />
              </div>
            </TabsContent>
          </div>
        </Tabs>

        {/* 数据来源脚注 */}
        <div className="text-[11px] text-[#94A3B8] text-right mt-4">
          数据截至 {new Date().toLocaleString('zh-CN')} · 来源：geo_leads / geo_contracts
        </div>
      </div>
    </div>
  );
};

export default ClientsPage;
