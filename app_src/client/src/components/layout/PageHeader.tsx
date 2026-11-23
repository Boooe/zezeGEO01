import * as React from 'react';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  hideInHub?: boolean;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, description, actions, className }) => {
  const subText = subtitle ?? description;
  return (
    <div className={cn('flex justify-between items-start py-4', className)}>
      <div>
        <h1 className="text-[20px] font-semibold text-[#0F172A]">{title}</h1>
        {subText && <p className="mt-1 text-[12px] text-[#5B6B85]">{subText}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
};
