import React, { useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CreditCard, Settings } from 'lucide-react';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@client/src/components/ui/tabs';
import { Button } from '@client/src/components/ui/button';
import MyPlanPage from '@client/src/pages/Creation/MyPlan';
import CreditTransactionsPage from '@client/src/pages/Account/CreditTransactionsPage';
import AdminPlansPage from '@client/src/pages/Admin/PlansPage';
import AdminCreditOverviewPage from '@client/src/pages/Admin/CreditOverviewPage';
import AiKeysPage from '@client/src/pages/Settings/AiKeysPage';
import MembersPage from '@client/src/pages/System/MembersPage';
import OperationLogsPage from '@client/src/pages/System/OperationLogsPage';
import { useAuth } from '@client/src/hooks/useAuth';
import AdminRoute from '@client/src/components/AdminRoute';
import { PageHeader } from '@client/src/components/layout/PageHeader';
import { SectionCard } from '@client/src/components/layout/SectionCard';

interface TabDef {
  value: string;
  label: string;
  roles?: string[];
  permission?: string;
}

const ALL_TABS: TabDef[] = [
  { value: 'billing', label: '计费' },
  { value: 'models', label: 'AI 模型', roles: ['admin'] },
  { value: 'members', label: '成员权限', permission: 'system.member' },
  { value: 'logs', label: '操作日志', roles: ['admin'] },
];

const BillingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, hasRole, hasPermission } = useAuth();

  const userRole = user?.role || '';
  const isAdmin = hasRole('admin');

  const visibleTabs = useMemo(() => {
    return ALL_TABS.filter((t: TabDef) => {
      if (t.permission) return hasPermission(t.permission);
      return !t.roles || (userRole && t.roles.includes(userRole));
    });
  }, [userRole, hasPermission]);

  const activeTab = (searchParams.get('tab') as string) || visibleTabs[0]?.value || 'billing';
  const isValidTab = visibleTabs.some((t: TabDef) => t.value === activeTab);

  useEffect(() => {
    if (!isValidTab && visibleTabs.length > 0) {
      navigate(`?tab=${visibleTabs[0].value}`, { replace: true });
    }
  }, [isValidTab, visibleTabs, navigate]);

  const handleTabChange = (value: string) => {
    navigate(`?tab=${value}`, { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      <div className="w-full max-w-full px-6 pt-5 pb-8">
        <PageHeader
          title="系统"
          subtitle="计费、AI 模型、成员权限与操作日志"
          actions={
            <Button
              size="sm"
              className="bg-[#2E7DFF] text-white hover:bg-[#1E5FD6]"
              onClick={() => handleTabChange('billing')}
            >
              <CreditCard className="h-4 w-4" />
              充值中心
            </Button>
          }
        />

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <div className="overflow-x-auto border-b" style={{ borderColor: '#E6EAF2' }}>
            <TabsList className="h-10 w-full flex-nowrap justify-start gap-6 bg-transparent p-0">
              {visibleTabs.map((tab: TabDef) => (
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
            <TabsContent value="billing">
              <BillingTabContent />
            </TabsContent>
            <TabsContent value="models">
              {isAdmin && (
                <div className="hub-content-inner">
                  <AiKeysPage />
                </div>
              )}
            </TabsContent>
            <TabsContent value="members">
              {isAdmin && (
                <div className="hub-content-inner">
                  <MembersPage />
                </div>
              )}
            </TabsContent>
            <TabsContent value="logs">
              {isAdmin && (
                <div className="hub-content-inner">
                  <OperationLogsPage />
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>

        {/* 数据来源脚注 */}
        <div className="text-[11px] text-[#94A3B8] text-right mt-4">
          数据截至 {new Date().toLocaleString('zh-CN')} · 来源：geo_wallets / geo_credit_transactions / geo_members / geo_operation_logs
        </div>
      </div>
    </div>
  );
};

const BillingTabContent: React.FC = () => {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  return (
    <div className="space-y-6">
      {/* 第一段：当前品牌套餐 */}
      <SectionCard title="当前品牌套餐">
        <MyPlanPage />
      </SectionCard>

      {/* 第二段：算力总览（仅 admin） */}
      {isAdmin && (
        <SectionCard title="算力总览">
          <AdminRoute>
            <AdminCreditOverviewPage />
          </AdminRoute>
        </SectionCard>
      )}

      {/* 第三段：算力流水 */}
      <SectionCard title="算力流水">
        <CreditTransactionsPage />
      </SectionCard>

      {/* 第四段：套餐管理（仅 admin） */}
      {isAdmin && (
        <SectionCard title="套餐管理">
          <AdminPlansPage />
        </SectionCard>
      )}
    </div>
  );
};

export default BillingPage;
