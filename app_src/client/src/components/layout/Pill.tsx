import * as React from 'react';
import { cn } from '@/lib/utils';

export type PillVariant = 'success' | 'warning' | 'danger' | 'info' | 'muted';

export interface PillProps {
  variant?: PillVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<PillVariant, string> = {
  success: 'text-[#10B981] bg-[#ECFDF5] border-[#A7F3D0]',
  warning: 'text-[#F59E0B] bg-[#FFFBEB] border-[#FDE68A]',
  danger: 'text-[#EF4444] bg-[#FEF2F2] border-[#FECACA]',
  info: 'text-[#2E7DFF] bg-[#EAF2FF] border-[#BFDBFE]',
  muted: 'text-[#94A3B8] bg-[#F8FAFC] border-[#E2E8F0]',
};

export const Pill: React.FC<PillProps> = ({ variant = 'muted', children, className }) => {
  return (
    <span
      className={cn(
        'inline-flex items-center h-[22px] px-2 rounded-[6px] text-[12px] font-medium border',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
};
