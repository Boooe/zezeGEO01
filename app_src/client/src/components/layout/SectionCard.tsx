import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SectionCardProps {
  title: React.ReactNode;
  count?: number;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const SectionCard: React.FC<SectionCardProps> = ({ title, count, subtitle, actions, children, className }) => {
  return (
    <div
      className={cn(
        'rounded-[12px] border border-[#E6EAF2] bg-white p-5',
        'shadow-[0_1px_2px_rgba(15_23_42_.04),0_8px_24px_-12px_rgba(15_23_42_.10)]',
        className
      )}
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold text-[#0F172A]">{title}</span>
          {count !== undefined && (
            <span className="text-[12px] text-[#94A3B8] tabular-nums">({count})</span>
          )}
          {subtitle !== undefined && subtitle !== null && (
            <span className="text-[12px] text-[#94A3B8]">{subtitle}</span>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
};
