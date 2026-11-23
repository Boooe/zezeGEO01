import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Check, Circle, Sparkles } from 'lucide-react';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { Button } from '@client/src/components/ui/button';
import { getBrandReadiness } from '@client/src/api/brands';
import type { BrandReadinessResponse } from '@shared/api.interface';

interface BrandReadinessCardProps {
  brandId: string;
  brandName?: string;
  className?: string;
}

interface CheckItem {
  key: keyof Pick<
    BrandReadinessResponse,
    'profileDone' | 'keywordsDone' | 'detectDone' | 'publishDone'
  >;
  label: string;
  actionLabel: string;
  actionPath: string;
}

const CHECK_ITEMS: CheckItem[] = [
  { key: 'profileDone', label: '定位档案已填写', actionLabel: '去填写', actionPath: '/geo-loop?tab=profile' },
  { key: 'keywordsDone', label: '关键词已添加', actionLabel: '去添加', actionPath: '/keywords' },
  { key: 'detectDone', label: '检测样本已生成', actionLabel: '去检测', actionPath: '/keywords' },
  { key: 'publishDone', label: '本月已发布内容', actionLabel: '去发布', actionPath: '/creation' },
];

export const BrandReadinessCard: React.FC<BrandReadinessCardProps> = ({
  brandId,
  brandName,
  className = '',
}) => {
  const navigate = useNavigate();

  const { data: readiness, isLoading } = useQuery({
    queryKey: ['brand-readiness', brandId],
    queryFn: () => getBrandReadiness(brandId),
    enabled: !!brandId,
    staleTime: 60_000,
  });

  const allEmpty = readiness && readiness.totalDone === 0;

  if (isLoading) {
    return (
      <div
        className={`bg-white border rounded-xl p-5 ${className}`}
        style={{ borderColor: '#E5E9F2' }}
      >
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-12 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!readiness) return null;

  if (allEmpty) {
    return (
      <div
        className={`bg-white border rounded-xl p-6 ${className}`}
        style={{ borderColor: '#E5E9F2' }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'rgba(46, 125, 255, 0.1)' }}
          >
            <Sparkles className="w-5 h-5" style={{ color: '#2E7DFF' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-semibold text-[#0F172A] mb-1">
              该品牌尚未建立监测
            </h3>
            <p className="text-[12px] text-[#64748B] mb-4">
              完成以下 4 步即可开启 GEO 效果追踪
            </p>
            <Button
              size="sm"
              className="bg-[#2E7DFF] text-white hover:bg-[#1E5FD6] mb-4"
              onClick={() => navigate('/keywords')}
            >
              创建检测任务
            </Button>

            <div className="space-y-2 pt-3 border-t" style={{ borderColor: '#F1F5F9' }}>
              {CHECK_ITEMS.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center gap-2"
                >
                  <Circle
                    className="w-4 h-4 shrink-0"
                    style={{ color: '#CBD5E1' }}
                  />
                  <span className="text-[13px] text-[#94A3B8] flex-1">
                    {item.label}
                  </span>
                  <button
                    className="text-[12px] text-[#2E7DFF] hover:underline"
                    onClick={() => navigate(item.actionPath)}
                  >
                    {item.actionLabel}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white border rounded-xl p-5 ${className}`}
      style={{ borderColor: '#E5E9F2' }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-semibold text-[#0F172A]">
            品牌就绪度
          </h3>
          <span
            className="text-[12px] px-2 py-0.5 rounded-full"
            style={{ backgroundColor: 'rgba(46, 125, 255, 0.1)', color: '#2E7DFF' }}
          >
            {readiness.totalDone}/{readiness.totalItems}
          </span>
        </div>
        {brandName && (
          <span className="text-[13px] text-[#64748B] truncate max-w-[160px]">
            {brandName}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {CHECK_ITEMS.map((item) => {
          const done = readiness[item.key];
          return (
            <div
              key={item.key}
              className="flex items-center gap-3"
            >
              {done ? (
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: '#10B981' }}
                >
                  <Check className="w-3 h-3 text-white" />
                </div>
              ) : (
                <Circle
                  className="w-5 h-5 shrink-0"
                  style={{ color: '#CBD5E1' }}
                />
              )}
              <span
                className={`text-[13px] flex-1 ${
                  done ? 'text-[#0F172A]' : 'text-[#64748B]'
                }`}
              >
                {item.label}
              </span>
              {done ? (
                <span
                  className="text-[12px]"
                  style={{ color: '#10B981' }}
                >
                  已完成
                </span>
              ) : (
                <button
                  className="text-[12px] text-[#2E7DFF] hover:underline"
                  onClick={() => navigate(item.actionPath)}
                >
                  {item.actionLabel}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BrandReadinessCard;
