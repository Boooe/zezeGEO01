import * as React from 'react';
import { cn } from '@/lib/utils';

export interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: string;
  trendUp?: boolean;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, unit, trend, trendUp, className }) => {
  return (
    <div
      className={cn(
        'h-24 rounded-[12px] border border-[#E6EAF2] bg-white p-5',
        'shadow-[0_1px_2px_rgba(15_23_42_.04),0_8px_24px_-12px_rgba(15_23_42_.10)]',
        className
      )}
    >
      <div className="text-[12px] text-[#94A3B8]">{label}</div>
      <div className="flex items-baseline mt-1">
        <span
          className="font-semibold text-[#0F172A] break-words"
          style={{
            fontSize: 'clamp(16px, 24px, 24px)',
            fontVariantNumeric: 'tabular-nums',
            fontWeight: 600,
          }}
        >
          {value}
        </span>
        {unit && <span className="text-[12px] text-[#5B6B85] ml-1">{unit}</span>}
      </div>
      {trend !== undefined && (
        <div
          className={cn('text-[12px] mt-1', trendUp ? 'text-[#10B981]' : 'text-[#94A3B8]')}
        >
          {trend}
        </div>
      )}
    </div>
  );
};
