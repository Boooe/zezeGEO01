import React from 'react';
import { Card, CardContent } from '@client/src/components/ui/card';
import { DataPagination } from '@client/src/components/ui/data-pagination';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@client/src/components/ui/empty';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/src/components/ui/table';
import { FileText } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';

interface TableShellProps {
  title?: string;
  description?: string;
  headerActions?: React.ReactNode;
  filterBar?: React.ReactNode;
  data: unknown[];
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: {
    label: string;
    onClick: () => void;
  };
  total?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  children: React.ReactNode;
  className?: string;
}

const TableShell: React.FC<TableShellProps> = ({
  title,
  description,
  headerActions,
  filterBar,
  data,
  isLoading = false,
  isEmpty = false,
  emptyTitle = '暂无数据',
  emptyDescription = '还没有任何记录，点击下方按钮创建第一条',
  emptyAction,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions,
  children,
  className = '',
}) => {
  const showPagination = total !== undefined && page !== undefined && pageSize !== undefined && onPageChange && onPageSizeChange;

  return (
    <Card className={className}>
      {(title || headerActions || filterBar) && (
        <div className="flex flex-col gap-4 p-5 pb-0">
          {(title || headerActions) && (
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                {title && (
                  <h2 className="text-[16px] font-semibold text-[#0F172A]">
                    {title}
                  </h2>
                )}
                {description && (
                  <p className="mt-1 text-[13px] text-[#64748B]">
                    {description}
                  </p>
                )}
              </div>
              {headerActions && (
                <div className="flex flex-shrink-0 items-center gap-2">
                  {headerActions}
                </div>
              )}
            </div>
          )}
          {filterBar && (
            <div className="flex flex-wrap items-center gap-3">{filterBar}</div>
          )}
        </div>
      )}

      <CardContent className={filterBar ? 'pt-4' : 'pt-5'}>
        {isEmpty && !isLoading ? (
          <Empty className="min-h-[240px] border-0">
            <EmptyContent>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileText className="size-6" />
                </EmptyMedia>
                <EmptyTitle className="text-[14px] font-medium text-[#0F172A]">
                  {emptyTitle}
                </EmptyTitle>
                <EmptyDescription className="text-[13px] text-[#64748B]">
                  {emptyDescription}
                </EmptyDescription>
              </EmptyHeader>
              {emptyAction && (
                <Button onClick={emptyAction.onClick} className="mt-3 h-9 px-5">
                  {emptyAction.label}
                </Button>
              )}
            </EmptyContent>
          </Empty>
        ) : (
          <>{children}</>
        )}

        {showPagination && !isEmpty && (
          <div className="mt-4">
            <DataPagination
              total={total!}
              page={page!}
              pageSize={pageSize!}
              onPageChange={onPageChange!}
              onPageSizeChange={onPageSizeChange!}
              pageSizeOptions={pageSizeOptions}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export { TableShell };
