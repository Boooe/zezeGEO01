import * as React from 'react';
import { cn } from '@/lib/utils';

interface SegmentedControlOption {
  value: string;
  label: React.ReactNode;
  badge?: React.ReactNode;
}

interface SegmentedControlProps {
  options: SegmentedControlOption[];
  value: string;
  onChange: (value: string) => void;
  size?: 'sm' | 'md';
  className?: string;
}

const SegmentedControl: React.FC<SegmentedControlProps> = ({
  options,
  value,
  onChange,
  size = 'sm',
  className,
}) => {
  return (
    <div
      role="group"
      className={cn(
        'inline-flex items-center rounded-[6px] p-0.5',
        size === 'sm' ? 'h-7' : 'h-8',
        className,
      )}
      style={{ backgroundColor: '#F1F5F9' }}
    >
      {options.map((opt: SegmentedControlOption) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded px-3 text-[12px] font-medium transition-colors',
              size === 'sm' ? 'h-6' : 'h-7',
            )}
            style={{
              backgroundColor: active ? '#ffffff' : 'transparent',
              color: active ? '#2563EB' : '#64748b',
              boxShadow: active ? '0 0 0 1px #E5E7EB' : 'none',
            }}
          >
            {opt.label}
            {opt.badge}
          </button>
        );
      })}
    </div>
  );
};

export { SegmentedControl };
export type { SegmentedControlOption, SegmentedControlProps };
