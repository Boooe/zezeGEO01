import { Skeleton } from '@client/src/components/ui/skeleton';
import type { AiPlatformStatItem } from '@shared/api.interface';

interface AiPlatformBarsProps {
  items: AiPlatformStatItem[] | undefined;
  isLoading?: boolean;
}

const BAR_COLORS = [
  '#3B5BFF',
  '#5B7AFF',
  '#7B95FF',
  '#9CB0FF',
  '#BACAFF',
  '#D6DEFF',
];

const AiPlatformBars: React.FC<AiPlatformBarsProps> = ({ items, isLoading }) => {
  const maxValue = items?.length
    ? Math.max(...items.map((i: AiPlatformStatItem) => Number(i.dauMillion)))
    : 1;

  const formatNum = (val: number): string => {
    const fixed = Number(val.toFixed(1));
    return fixed.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });
  };

  if (isLoading) {
    return (
      <div className="dashboard-card relative h-full p-5">
        <div className="mb-3 flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i: number) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-card relative h-full p-5">
      <div className="mb-3">
        <h3 className="text-base font-semibold mb-1" style={{ color: '#0F172A' }}>
          AI 平台活跃用户
        </h3>
        <p className="text-xs" style={{ color: '#94A3B8' }}>
          公开行业数据，2026Q3，仅供参考
        </p>
      </div>

        <div className="space-y-0">
          {items?.map((item: AiPlatformStatItem, idx: number) => {
            const widthPct = maxValue > 0 ? (Number(item.dauMillion) / maxValue) * 100 : 0;
            return (
              <div key={item.id} className="flex items-center gap-3" style={{ height: 40 }}>
                <span
                  className="shrink-0 text-sm font-medium"
                  style={{ color: '#334155', width: 72, minWidth: 72 }}
                >
                  {item.platformName}
                </span>
                <div className="relative h-4 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: '#F1F5F9' }}>
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: BAR_COLORS[idx % BAR_COLORS.length],
                    }}
                  />
                </div>
                <span
                  className="shrink-0 text-sm tabular-nums font-medium"
                  style={{ color: '#334155', width: 96, minWidth: 96, textAlign: 'right', whiteSpace: 'nowrap' }}
                >
                  {formatNum(Number(item.dauMillion))} 万
                </span>
              </div>
            );
          })}
        </div>
    </div>
  );
};

export default AiPlatformBars;
