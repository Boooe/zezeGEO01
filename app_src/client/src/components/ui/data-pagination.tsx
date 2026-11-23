import React, { useState, useEffect } from 'react';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DataPaginationProps {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
}

const DataPagination: React.FC<DataPaginationProps> = ({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
}) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [jumpValue, setJumpValue] = useState<string>('');

  useEffect(() => {
    setJumpValue('');
  }, [page]);

  const handleJump = () => {
    const n = Number(jumpValue);
    if (!isNaN(n) && n >= 1 && n <= totalPages && n !== page) {
      onPageChange(n);
    }
    setJumpValue('');
  };

  const handleJumpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleJump();
    }
  };

  const getPageNumbers = (): (number | 'ellipsis')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const result: (number | 'ellipsis')[] = [];
    result.push(1);
    if (page > 4) result.push('ellipsis');
    const start = Math.max(2, page - 2);
    const end = Math.min(totalPages - 1, page + 2);
    for (let i = start; i <= end; i++) result.push(i);
    if (page < totalPages - 3) result.push('ellipsis');
    result.push(totalPages);
    return result;
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
      {/* 左侧：总数 */}
      <div className="text-xs text-muted-foreground tnum">
        共 {total.toLocaleString('en-US')} 条
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {/* 每页大小 */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>每页</span>
          <div className="flex items-center">
            {pageSizeOptions.map((size, idx) => (
              <React.Fragment key={size}>
                {idx > 0 && (
                  <span className="mx-1 text-slate-300">·</span>
                )}
                <button
                  onClick={() => {
                    if (size !== pageSize) {
                      onPageSizeChange(size);
                      onPageChange(1);
                    }
                  }}
                  className="tnum text-xs transition-colors"
                  style={{
                    color: size === pageSize ? '#2E7DFF' : '#64748b',
                    fontWeight: size === pageSize ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {size}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* 页码按钮 */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            aria-label="上一页"
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {getPageNumbers().map((item, idx) =>
            item === 'ellipsis' ? (
              <span
                key={`ellipsis-${idx}`}
                className="flex h-8 w-8 items-center justify-center text-xs text-muted-foreground"
              >
                ...
              </span>
            ) : (
              <Button
                key={item}
                variant={item === page ? 'default' : 'outline'}
                size="icon"
                onClick={() => onPageChange(item)}
                className="h-8 w-8 tnum"
              >
                {item}
              </Button>
            ),
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            aria-label="下一页"
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* 前往 */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>前往</span>
          <Input
            type="number"
            value={jumpValue}
            onChange={(e) => setJumpValue(e.target.value)}
            onKeyDown={handleJumpKeyDown}
            onBlur={handleJump}
            className="h-8 w-14 text-center text-xs tnum"
            min={1}
            max={totalPages}
          />
          <span>页</span>
        </div>
      </div>
    </div>
  );
};

export { DataPagination };
