"use client";

import * as React from 'react';
import { cn } from '@/lib/utils';

interface ColumnResizeHandleProps extends React.HTMLAttributes<HTMLDivElement> {
  onResizeStart: (e: React.PointerEvent) => void;
  onDoubleClick?: () => void;
  isResizing?: boolean;
}

const ColumnResizeHandle = React.forwardRef<
  HTMLDivElement,
  ColumnResizeHandleProps
>(({ onResizeStart, onDoubleClick, isResizing, className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        'col-resize-handle',
        'absolute top-0 right-[-3px] h-full w-[6px]',
        'cursor-col-resize select-none touch-none',
        'opacity-0 group-hover:opacity-100 transition-opacity',
        'z-10',
        isResizing && 'opacity-100',
        className,
      )}
      onPointerDown={onResizeStart}
      onDoubleClick={onDoubleClick}
      {...props}
    >
      <div
        className={cn(
          'absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px',
          'bg-[#3B5BFF]',
          'opacity-100',
          isResizing && 'opacity-100',
        )}
      />
    </div>
  );
});

ColumnResizeHandle.displayName = 'ColumnResizeHandle';

export { ColumnResizeHandle };
