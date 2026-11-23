import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@client/src/components/ui/tabs';
import { Button } from '@client/src/components/ui/button';
import { PageHeader } from '@client/src/components/layout/PageHeader';
import { useAuth } from '@client/src/hooks/useAuth';
import MarketPage from '@client/src/pages/MediaMarket/MarketPage';
import OrdersPage from '@client/src/pages/MediaMarket/OrdersPage';
import WalletPage from '@client/src/pages/MediaMarket/WalletPage';
import MyOrdersPage from '@client/src/pages/MediaMarket/MyOrdersPage';
import SettlementPage from '@client/src/pages/MediaMarket/SettlementPage';
import RechargeAuditPage from '@client/src/pages/MediaMarket/RechargeAuditPage';
const ADMIN_TABS = [
  { value: 'market', label: '媒体商城' },
  { value: 'orders', label: '发稿订单' },
  { value: 'settlement', label: '供应商结算' },
  { value: 'recharge-audit', label: '充值审核' },
  { value: 'wallet', label: '我的钱包' },
] as const;

const CLIENT_TABS = [
  { value: 'market', label: '媒体商城' },
  { value: 'wallet', label: '我的钱包' },
  { value: 'my-orders', label: '我的发稿订单' },
] as const;

const MediaMarketHub: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();

  const isAdminOrOperator = hasRole('admin') || hasRole('operator');
  const tabs = isAdminOrOperator ? ADMIN_TABS : CLIENT_TABS;
  const activeTab = (searchParams.get('tab') as string) || tabs[0].value;

  const handleTabChange = (value: string) => {
    navigate(`?tab=${value}`, { replace: true });
  };

  // 如果用户访问了不在其权限范围内的 tab，切回第一个
  const validTab = tabs.some((t) => t.value === activeTab)
    ? activeTab
    : tabs[0].value;

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      <div className="w-full max-w-full px-6 pt-5 pb-8">
        <PageHeader
          title="媒体商城"
          subtitle="海量媒体资源，一键发稿下单"
          actions={
            <Button className="h-9 rounded-lg bg-[#2E7DFF] text-[13px] font-medium hover:bg-[#1E5FD6]">
              <ShoppingCart className="mr-1.5 h-4 w-4" />
              批量下单
            </Button>
          }
        />

        <Tabs value={validTab} onValueChange={handleTabChange}>
          <div
            className="overflow-x-auto border-b"
            style={{ borderColor: '#E6EAF2' }}
          >
            <TabsList className="h-10 w-full flex-nowrap justify-start gap-6 bg-transparent p-0">
              {tabs.map((tab) => (
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

          <div className="mt-6 space-y-6">
            <TabsContent value="market">
              <div className="hub-content-inner">
                <MarketPage />
              </div>
            </TabsContent>

            {isAdminOrOperator && (
              <TabsContent value="orders">
                <div className="hub-content-inner">
                  <OrdersPage />
                </div>
              </TabsContent>
            )}

            {isAdminOrOperator && (
              <TabsContent value="settlement">
                <div className="hub-content-inner">
                  <SettlementPage />
                </div>
              </TabsContent>
            )}

            {isAdminOrOperator && (
              <TabsContent value="recharge-audit">
                <div className="hub-content-inner">
                  <RechargeAuditPage />
                </div>
              </TabsContent>
            )}

            <TabsContent value="wallet">
              <div className="hub-content-inner">
                <WalletPage />
              </div>
            </TabsContent>

            {!isAdminOrOperator && (
              <TabsContent value="my-orders">
                <div className="hub-content-inner">
                  <MyOrdersPage />
                </div>
              </TabsContent>
            )}
          </div>
        </Tabs>

        {/* 底部脚注 */}
        <div className="mt-10 text-center text-[12px] text-[#94A3B8]">
          数据截至 {new Date().toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} · 来源：media_channels / media_orders
        </div>
      </div>
    </div>
  );
};

export default MediaMarketHub;
