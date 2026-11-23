import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Download, FileText, Bell, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@client/src/components/ui/table';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { DataPagination } from '@client/src/components/ui/data-pagination';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import { SectionCard } from '@client/src/components/layout/SectionCard';
import { Toolbar } from '@client/src/components/layout/Toolbar';
import { Pill } from '@client/src/components/layout/Pill';

import {
  listSignatures,
  listVersions,
  getSignatureDetail,
  remindSign,
  requireResign,
  exportSignaturesCsv,
} from '@client/src/api/commitment';
import {
  COMMITMENT_SIGN_STATUSES,
  COMMITMENT_SIGN_STATUS_LABELS,
  type CommitmentSignatureWithStatus,
  type CommitmentSignature,
} from '@shared/api.interface';

const PRIMARY = '#2563EB';
const SUCCESS = '#16A34A';
const DANGER = '#DC2626';
const WARNING = '#F59E0B';

const PAGE_SIZE = 10;

const getStatusVariant = (
  status: string,
): 'success' | 'warning' | 'danger' | 'muted' => {
  if (status === 'signed') return 'success';
  if (status === 'resign_required') return 'warning';
  return 'muted';
};

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const ManagementPage = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>('');
  const [versionId, setVersionId] = useState<string>('');
  const [keyword, setKeyword] = useState<string>('');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  const [viewOpen, setViewOpen] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [remindOpen, setRemindOpen] = useState(false);
  const [remindItem, setRemindItem] = useState<CommitmentSignatureWithStatus | null>(null);
  const [resignOpen, setResignOpen] = useState(false);
  const [resignItem, setResignItem] = useState<CommitmentSignatureWithStatus | null>(null);

  const { data: versions = [] } = useQuery({
    queryKey: ['commitment', 'versions'],
    queryFn: listVersions,
    staleTime: 30 * 1000,
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['commitment', 'signatures', page, status, versionId, searchKeyword],
    queryFn: () =>
      listSignatures({
        page,
        pageSize: PAGE_SIZE,
        status: status || undefined,
        versionId: versionId || undefined,
        keyword: searchKeyword || undefined,
      }),
    staleTime: 30 * 1000,
  });

  const { data: detail, isFetching: detailLoading } = useQuery({
    queryKey: ['commitment', 'signature', viewId],
    queryFn: () => getSignatureDetail(viewId!),
    enabled: !!viewId && viewOpen,
  });

  const totalCount = data?.total ?? 0;

  const handleSearch = () => {
    setPage(1);
    setSearchKeyword(keyword.trim());
  };

  const handleExport = () => {
    const url = exportSignaturesCsv({
      status: status || undefined,
      versionId: versionId || undefined,
      keyword: searchKeyword || undefined,
    });
    window.open(url, '_blank');
  };

  const remindMutation = useMutation({
    mutationFn: (userId: string) => remindSign(userId),
    retry: false,
    onSuccess: () => {
      toast.success('已发送签署提醒');
      queryClient.invalidateQueries({ queryKey: ['commitment', 'signatures'] });
      setRemindOpen(false);
      setRemindItem(null);
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e.response?.data?.error?.message || '发送提醒失败');
    },
  });

  const resignMutation = useMutation({
    mutationFn: (userId: string) => requireResign(userId),
    retry: false,
    onSuccess: () => {
      toast.success('已要求重签');
      queryClient.invalidateQueries({ queryKey: ['commitment', 'signatures'] });
      setResignOpen(false);
      setResignItem(null);
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e.response?.data?.error?.message || '要求重签失败');
    },
  });

  const openView = (item: CommitmentSignatureWithStatus) => {
    setViewId(item.id);
    setViewOpen(true);
  };

  const openRemind = (item: CommitmentSignatureWithStatus) => {
    setRemindItem(item);
    setRemindOpen(true);
  };

  const openResign = (item: CommitmentSignatureWithStatus) => {
    setResignItem(item);
    setResignOpen(true);
  };

  const isEmpty = !isLoading && !isError && data && (!data.items || data.items.length === 0);

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        title="KPI 承诺"
        count={totalCount}
        actions={
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            导出 CSV
          </Button>
        }
      >
        {/* 筛选工具栏 */}
        <div className="mb-4">
          <Toolbar>
            <div className="space-y-1.5">
              <label className="text-[12px]" style={{ color: '#94A3B8' }}>状态</label>
              <Select value={status} onValueChange={(v: string) => { setStatus(v); setPage(1); }}>
                <SelectTrigger className="h-9 w-[140px]">
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部</SelectItem>
                  {COMMITMENT_SIGN_STATUSES.map((s: string) => (
                    <SelectItem key={s} value={s}>
                      {COMMITMENT_SIGN_STATUS_LABELS[s as keyof typeof COMMITMENT_SIGN_STATUS_LABELS]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px]" style={{ color: '#94A3B8' }}>版本</label>
              <Select value={versionId} onValueChange={(v: string) => { setVersionId(v); setPage(1); }}>
                <SelectTrigger className="h-9 w-[180px]">
                  <SelectValue placeholder="全部版本" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部版本</SelectItem>
                  {versions.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.versionCode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[260px] flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={keyword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setKeyword(e.target.value)}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter') handleSearch();
                  }}
                  placeholder="客户名称 / 账号"
                  className="h-9 pl-9"
                />
              </div>
              <Button onClick={handleSearch} size="sm" className="self-end" style={{ backgroundColor: PRIMARY }}>
                <Search className="h-4 w-4" />
                搜索
              </Button>
            </div>
          </Toolbar>
        </div>

        {/* 错误态 */}
        {isError && (
          <div className="flex items-center justify-between rounded-lg border p-4 mb-4" style={{ borderColor: 'rgba(220,38,38,0.3)', backgroundColor: 'rgba(220,38,38,0.05)' }}>
            <div className="flex items-center gap-2 text-sm" style={{ color: DANGER }}>
              <AlertCircle className="h-4 w-4" />
              <span>数据加载失败，请重试</span>
            </div>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-red-100"
              style={{ color: DANGER }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              重试
            </button>
          </div>
        )}

        {/* 加载态 */}
        {isLoading && (
          <div className="space-y-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 h-11 px-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-8 w-24 rounded-md ml-auto" />
              </div>
            ))}
          </div>
        )}

        {/* 空态 */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-16">
            <FileText className="mb-3 h-8 w-8 opacity-50" style={{ color: '#94A3B8' }} />
            <div className="text-[14px] font-medium text-[#0F172A] mb-1">
              暂无签署记录
            </div>
            <div className="text-[13px] text-[#64748B]">
              调整筛选条件后再试试
            </div>
          </div>
        )}

        {/* 表格 */}
        {!isLoading && !isError && data && data.items && data.items.length > 0 && (
          <div className="overflow-x-auto">
            <Table className="table-fixed w-full">
              <TableHeader style={{ backgroundColor: '#F1F5F9' }}>
                <TableRow style={{ height: '44px' }}>
                  <TableHead style={{ width: '20%', fontSize: '12px', fontWeight: 500, color: '#334155' }}>客户名称</TableHead>
                  <TableHead style={{ width: '15%', fontSize: '12px', fontWeight: 500, color: '#334155' }}>账号</TableHead>
                  <TableHead style={{ width: '18%', fontSize: '12px', fontWeight: 500, color: '#334155' }}>签署时间</TableHead>
                  <TableHead style={{ width: '12%', fontSize: '12px', fontWeight: 500, color: '#334155' }}>IP 地址</TableHead>
                  <TableHead style={{ width: '10%', fontSize: '12px', fontWeight: 500, color: '#334155' }}>版本号</TableHead>
                  <TableHead style={{ width: '10%', fontSize: '12px', fontWeight: 500, color: '#334155' }}>状态</TableHead>
                  <TableHead className="text-right" style={{ width: '15%', fontSize: '12px', fontWeight: 500, color: '#334155' }}>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item: CommitmentSignatureWithStatus) => (
                  <TableRow key={item.id} style={{ height: '44px', borderBottom: '1px solid #EEF2F7' }}>
                    <TableCell className="font-medium text-[#0F172A] text-[13px]">
                      {item.brandName || '-'}
                    </TableCell>
                    <TableCell className="text-[13px] text-[#64748B]">
                      {item.username}
                    </TableCell>
                    <TableCell className="text-[13px] text-[#64748B]">
                      {formatDateTime(item.signedAt)}
                    </TableCell>
                    <TableCell className="text-[13px] text-[#64748B]">
                      {item.clientIp || '-'}
                    </TableCell>
                    <TableCell className="text-[13px] text-[#64748B]">
                      {item.versionCode || '-'}
                    </TableCell>
                    <TableCell>
                      <Pill variant={getStatusVariant(item.status)}>
                        {COMMITMENT_SIGN_STATUS_LABELS[item.status]}
                      </Pill>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openView(item)}>
                          <FileText className="h-3.5 w-3.5" />
                          查看
                        </Button>
                        {item.status !== 'signed' && (
                          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openRemind(item)} style={{ color: PRIMARY }}>
                            <Bell className="h-3.5 w-3.5" />
                            提醒
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openResign(item)} style={{ color: WARNING }}>
                          <RefreshCw className="h-3.5 w-3.5" />
                          重签
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* 分页 */}
        {data && data.total > PAGE_SIZE && (
          <div className="mt-4 flex justify-end">
            <DataPagination
              total={data.total}
              page={page}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              onPageSizeChange={() => {}}
            />
          </div>
        )}
      </SectionCard>

      {/* 查看全文 Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>承诺书全文</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {detailLoading || !detail ? (
              <div className="space-y-2 py-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : (
              <div className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: '#475569' }}>
                {detail.content}
              </div>
            )}
          </div>
          {detail && (
            <div className="pt-4 border-t space-y-1 text-sm" style={{ color: '#64748B', borderColor: '#E6EAF2' }}>
              <div>
                <span className="font-medium text-[#0F172A]">客户：</span>
                {detail.brandName || detail.username}
              </div>
              <div>
                <span className="font-medium text-[#0F172A]">签署时间：</span>
                {formatDateTime(detail.signedAt)}
              </div>
              <div>
                <span className="font-medium text-[#0F172A]">IP 地址：</span>
                {detail.clientIp || '-'}
              </div>
              <div>
                <span className="font-medium text-[#0F172A]">版本：</span>
                {detail.versionCode || '-'}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 提醒签署 Dialog */}
      <Dialog open={remindOpen} onOpenChange={setRemindOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>提醒签署</DialogTitle>
          </DialogHeader>
          <p className="text-sm" style={{ color: '#64748B' }}>
            确定向 <span className="font-medium text-[#0F172A]">{remindItem?.brandName || remindItem?.username}</span> 发送签署提醒吗？
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemindOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => remindItem && remindMutation.mutate(remindItem.userId)}
              disabled={remindMutation.isPending}
              style={{ backgroundColor: PRIMARY }}
            >
              {remindMutation.isPending ? '发送中...' : '确认发送'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 要求重签 Dialog */}
      <Dialog open={resignOpen} onOpenChange={setResignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>要求重签</DialogTitle>
          </DialogHeader>
          <p className="text-sm" style={{ color: '#64748B' }}>
            确定要求 <span className="font-medium text-[#0F172A]">{resignItem?.brandName || resignItem?.username}</span> 重新签署承诺书吗？该客户当前的签署状态会变为「需重签」。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResignOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => resignItem && resignMutation.mutate(resignItem.userId)}
              disabled={resignMutation.isPending}
              style={{ backgroundColor: DANGER }}
            >
              {resignMutation.isPending ? '处理中...' : '确认要求重签'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManagementPage;
