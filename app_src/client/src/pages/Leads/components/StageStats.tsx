import React from 'react';
import {
  Card,
  CardContent,
} from '@client/src/components/ui/card';
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  Clock,
  MessageSquare,
  FileText,
  CheckCircle,
  Archive,
} from 'lucide-react';
import {
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  type LeadStage,
} from '@shared/api.interface';

const PRIMARY = '#1e40af';
const ACCENT = '#f97316';
const SUCCESS = '#10b981';
const MUTED = '#64748b';
const MUTED_BG = 'rgba(100, 116, 139, 0.1)';

const STAGE_META: Record<LeadStage, { icon: React.ReactNode; color: string; bg: string }> = {
  pending: { icon: <Clock className="h-5 w-5" />, color: MUTED, bg: MUTED_BG },
  contacted: { icon: <MessageSquare className="h-5 w-5" />, color: PRIMARY, bg: 'rgba(30, 64, 175, 0.1)' },
  quoted: { icon: <FileText className="h-5 w-5" />, color: ACCENT, bg: 'rgba(249, 115, 22, 0.1)' },
  signed: { icon: <CheckCircle className="h-5 w-5" />, color: SUCCESS, bg: 'rgba(16, 185, 129, 0.1)' },
  shelved: { icon: <Archive className="h-5 w-5" />, color: MUTED, bg: MUTED_BG },
};

interface StageStatsProps {
  stats: Array<{ stage: string; count: number; demoCount?: number }> | undefined;
  isLoading: boolean;
  activeStage: LeadStage | '';
  onStageClick: (stage: LeadStage | '') => void;
}

const StageStats: React.FC<StageStatsProps> = ({
  stats,
  isLoading,
  activeStage,
  onStageClick,
}) => {
  const getCount = (stage: string): number => {
    if (!stats) return 0;
    const item = stats.find((s) => s.stage === stage);
    return item?.count ?? 0;
  };

  const getDemoCount = (stage: string): number => {
    if (!stats) return 0;
    const item = stats.find((s) => s.stage === stage);
    return item?.demoCount ?? 0;
  };

  const totalCount = stats ? stats.reduce((sum, s) => sum + s.count, 0) : 0;
  const totalDemoCount = stats
    ? stats.reduce((sum, s) => sum + (s.demoCount ?? 0), 0)
    : 0;

  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6"
      data-ai-section-type="card-stat"
    >
      {/* 全部 */}
      <Card
        className="w-full cursor-pointer transition-all hover:shadow-md"
        style={{
          borderRadius: '8px',
          boxShadow: activeStage === '' ? `0 0 0 2px ${PRIMARY}` : '0 1px 3px rgba(0,0,0,0.1)',
        }}
        onClick={() => onStageClick('')}
        role="button"
        aria-label={`全部线索，共 ${totalCount} 条`}
      >
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">全部</p>
              {isLoading ? (
                <Skeleton className="mt-1 h-6 w-12" />
              ) : (
                <>
                  <p className="mt-1 text-xl font-bold leading-none tabular-nums" style={{ color: '#0f172a' }}>
                    {totalCount}
                  </p>
                  {totalDemoCount > 0 && (
                    <p className="mt-0.5 text-[10px] text-[#94A3B8] tabular-nums">
                      另有 {totalDemoCount} 条演示
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {LEAD_STAGES.map((stage) => {
        const meta = STAGE_META[stage];
        const isActive = activeStage === stage;
        return (
          <Card
            key={stage}
            className="w-full cursor-pointer transition-all hover:shadow-md"
            style={{
              borderRadius: '8px',
              boxShadow: isActive ? `0 0 0 2px ${meta.color}` : '0 1px 3px rgba(0,0,0,0.1)',
            }}
            onClick={() => onStageClick(stage)}
            role="button"
            aria-label={`${LEAD_STAGE_LABELS[stage]}，${getCount(stage)} 条`}
          >
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs text-muted-foreground">
                      {LEAD_STAGE_LABELS[stage]}
                    </p>
                    {isLoading ? (
                      <Skeleton className="mt-1 h-6 w-10" />
                    ) : (
                      <>
                        <p
                          className="mt-1 text-xl font-bold leading-none tabular-nums"
                          style={{ color: meta.color }}
                        >
                          {getCount(stage)}
                        </p>
                        {getDemoCount(stage) > 0 && (
                          <p className="mt-0.5 text-[10px] text-[#94A3B8] tabular-nums">
                            演示 {getDemoCount(stage)}
                          </p>
                        )}
                      </>
                    )}
                </div>
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ backgroundColor: meta.bg, color: meta.color }}
                >
                  {meta.icon}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default StageStats;
