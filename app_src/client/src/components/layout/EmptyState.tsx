import * as React from 'react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, description, action, className }) => {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12', className)}>
      {icon && (
        <div className="text-[#94A3B8] mb-4 [&_svg]:size-12">
          {icon}
        </div>
      )}
      <div className="text-[13px] text-[#5B6B85] mb-4 text-center">{description}</div>
      {action && <div>{action}</div>}
    </div>
  );
};
