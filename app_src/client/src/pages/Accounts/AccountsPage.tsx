import React from 'react';
import { Plus } from 'lucide-react';
import UnifiedAccountsPage from '@client/src/pages/Publication/UnifiedAccountsPage';
import { PageHeader } from '@client/src/components/layout/PageHeader';
import { Button } from '@client/src/components/ui/button';

const AccountsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      <div className="w-full max-w-full px-6 pt-5 pb-8">
        <PageHeader
          title="账号授权"
          subtitle="发稿账号、渠道账号统一管理"
          actions={
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
          }
        />
        <div className="hub-content-inner">
          <UnifiedAccountsPage />
        </div>

        {/* 数据来源脚注 */}
        <div className="text-[11px] text-[#94A3B8] text-right mt-4">
          数据截至 {new Date().toLocaleString('zh-CN')} · 来源：geo_accounts
        </div>
      </div>
    </div>
  );
};

export default AccountsPage;
