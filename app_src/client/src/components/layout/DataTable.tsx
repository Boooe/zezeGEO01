import * as React from 'react';
import { cn } from '@/lib/utils';
import { EmptyState } from './EmptyState';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface DataTableColumn {
  key: string;
  title: React.ReactNode;
  width?: string | number;
  align?: 'left' | 'right' | 'center';
  render?: (row: any, index: number) => React.ReactNode;
  headerRender?: () => React.ReactNode;
  rowSpan?: number;
}

export interface DataTablePagination {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
}

export interface DataTableProps {
  columns: DataTableColumn[];
  data: any[];
  rowKey: string;
  emptyText?: string;
  emptyIcon?: React.ReactNode;
  emptyAction?: React.ReactNode;
  className?: string;
  pagination?: DataTablePagination;
  headerRender?: () => React.ReactNode;
  rowClassName?: (row: any, index: number) => string;
}

export const DataTable: React.FC<DataTableProps> = ({
  columns,
  data,
  rowKey,
  emptyText = '暂无数据',
  emptyIcon,
  emptyAction,
  className,
  pagination,
  headerRender,
  rowClassName,
}) => {
  const totalPages = pagination
    ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
    : 1;

  const pageSizeOptions = pagination?.pageSizeOptions ?? [10, 20, 50];

  // 页码按钮：始终显示当前页附近 + 首尾页
  const getPageNumbers = (): Array<number | 'ellipsis'> => {
    if (!pagination) return [];
    const total = totalPages;
    const current = pagination.page;
    const pages: Array<number | 'ellipsis'> = [];

    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
      return pages;
    }

    pages.push(1);
    if (current > 3) pages.push('ellipsis');

    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);

    if (current < total - 2) pages.push('ellipsis');
    pages.push(total);

    return pages;
  };

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      {headerRender && headerRender()}
      <table className="w-full table-fixed min-w-[720px]" style={{ tableLayout: 'fixed' }}>
        <colgroup>
          {columns.map((col: DataTableColumn) => (
            <col key={col.key} style={{ width: col.width }} />
          ))}
        </colgroup>
        <thead className="bg-[#F8FAFC]">
          <tr className="h-11 border-b border-[#EEF2F7]" style={{ height: '44px' }}>
            {columns.map((col: DataTableColumn) => (
              <th
                key={col.key}
                className={cn(
                  'px-4 text-[12.5px] font-medium text-[#334155] align-middle',
                  col.align === 'right' && 'text-right',
                  col.align === 'center' && 'text-center',
                  (!col.align || col.align === 'left') && 'text-left'
                )}
                style={{ lineHeight: '44px' }}
              >
                {col.headerRender ? col.headerRender() : col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                <EmptyState
                  icon={emptyIcon}
                  description={emptyText}
                  action={emptyAction}
                  className="py-10"
                />
              </td>
            </tr>
          ) : (
            data.map((row: any, dataIndex: number) => (
              <tr
                key={row[rowKey]}
                className={cn(
                  'border-b border-[#EEF2F7] hover:bg-[#F7FAFF] transition-colors',
                  rowClassName?.(row, dataIndex)
                )}
                style={{ height: '44px' }}
              >
                {columns.map((col: DataTableColumn) => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-4 text-[12.5px] text-[#0F172A] align-middle',
                      'text-ellipsis overflow-hidden whitespace-nowrap',
                      col.align === 'right' && 'text-right tabular-nums',
                      col.align === 'center' && 'text-center',
                      (!col.align || col.align === 'left') && 'text-left'
                    )}
                    title={col.render ? undefined : String(row[col.key] ?? '')}
                  >
                    {col.render ? col.render(row, dataIndex) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {pagination && pagination.total > 0 && (
        <div className="flex items-center justify-between border-t border-[#EEF2F7] px-4" style={{ height: '48px' }}>
          <div className="text-[12px] text-[#64748b]">
            共 <span className="font-medium tabular-nums text-[#334155]">{pagination.total}</span> 条
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => pagination.onPageChange(Math.max(1, pagination.page - 1))}
              disabled={pagination.page <= 1}
              className="flex h-7 w-7 items-center justify-center rounded-md border text-[12px] transition disabled:cursor-not-allowed disabled:opacity-40 hover:bg-[#F1F5F9]"
              style={{ borderColor: '#E5E9F2', color: pagination.page <= 1 ? '#94A3B8' : '#475569' }}
              aria-label="上一页"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <div className="flex items-center gap-0.5">
              {getPageNumbers().map((p, i) =>
                p === 'ellipsis' ? (
                  <span
                    key={`ellipsis-${i}`}
                    className="flex h-7 w-7 items-center justify-center text-[12px] text-[#94A3B8]"
                  >
                    ...
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => pagination.onPageChange(p)}
                    className={cn(
                      'flex h-7 min-w-[28px] items-center justify-center rounded-md text-[12px] transition px-1.5',
                      p === pagination.page
                        ? 'bg-[#2E7DFF] text-white font-medium'
                        : 'text-[#475569] hover:bg-[#F1F5F9]'
                    )}
                  >
                    {p}
                  </button>
                )
              )}
            </div>
            <button
              onClick={() => pagination.onPageChange(Math.min(totalPages, pagination.page + 1))}
              disabled={pagination.page >= totalPages}
              className="flex h-7 w-7 items-center justify-center rounded-md border text-[12px] transition disabled:cursor-not-allowed disabled:opacity-40 hover:bg-[#F1F5F9]"
              style={{ borderColor: '#E5E9F2', color: pagination.page >= totalPages ? '#94A3B8' : '#475569' }}
              aria-label="下一页"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <select
              value={pagination.pageSize}
              onChange={(e) => {
                pagination.onPageSizeChange(Number(e.target.value));
                pagination.onPageChange(1);
              }}
              className="h-7 rounded-md border px-2 text-[12px] outline-none ml-2 bg-white"
              style={{ borderColor: '#E5E9F2', color: '#475569' }}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size} 条/页
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
