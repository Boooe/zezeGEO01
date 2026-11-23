import React from 'react';
import { Skeleton } from '@client/src/components/ui/skeleton';

const LeadListSkeleton: React.FC<{ rows?: number }> = ({ rows = 10 }) => {
  // 桌面端表格骨架
  return (
    <div className="hidden md:block">
      <div className="space-y-1">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3"
            style={{ height: '48px' }}
          >
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <div className="ml-auto flex gap-2">
              <Skeleton className="h-7 w-12" />
              <Skeleton className="h-7 w-12" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const LeadCardSkeleton: React.FC = () => {
  // 移动端卡片骨架
  return (
    <div className="space-y-3 md:hidden">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="space-y-2 rounded-lg border p-4"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
          <div className="flex gap-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default LeadListSkeleton;
