import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@client/src/components/layout/PageHeader';
import { SectionCard } from '@client/src/components/layout/SectionCard';
import KeywordLibrary from '@client/src/pages/Keywords/components/KeywordLibrary';
import KeywordTasks from '@client/src/pages/Keywords/components/KeywordTasks';
import KeywordReports from '@client/src/pages/Keywords/components/KeywordReports';

const tabList = [
  { key: 'library', label: '词库' },
  { key: 'tasks', label: '检测任务' },
  { key: 'reports', label: '报表' },
];

const KeywordsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>(
    searchParams.get('subtab') === 'reports' ? 'reports' : 'library',
  );

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    queryClient.clear();
    setSearchParams({ subtab: tab }, { replace: true });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="关键词管理"
        description="词库管理、AI 品牌提及检测、关键词效果报表"
      />

      <SectionCard
        title="词库"
        actions={
          <div className="flex items-center gap-1 rounded-lg bg-[#F1F5F9] p-1">
            {tabList.map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`rounded-md px-4 h-8 text-sm transition-all ${activeTab === tab.key
                    ? 'bg-white text-[#0F172A] font-semibold shadow-sm'
                    : 'text-[#5B6B85] hover:text-[#0F172A]'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        }
      >
        {activeTab === 'library' && <KeywordLibrary />}
        {activeTab === 'tasks' && <KeywordTasks />}
        {activeTab === 'reports' && <KeywordReports />}
      </SectionCard>
    </div>
  );
};

export default KeywordsPage;
