import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ToolbarProps {
  children: React.ReactNode;
  className?: string;
}

export const Toolbar: React.FC<ToolbarProps> = ({ children, className }) => {
  return (
    <div className={cn('flex gap-3 items-center flex-wrap h-9 mb-4', className)}>
      {children}
    </div>
  );
};
