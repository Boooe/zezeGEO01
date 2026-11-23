import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Printer,
  Send,
  MailCheck,
  MailX,
  Trash2,
  Edit3,
  FileText,
  AlertCircle,
  RefreshCw,
  MoreHorizontal,
  Search,
  Download,
} from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import { Textarea } from '@client/src/components/ui/textarea';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { DataPagination } from '@client/src/components/ui/data-pagination';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@client/src/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@client/src/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@client/src/components/ui/table';
import { SectionCard } from '@client/src/components/layout/SectionCard';
import { Toolbar } from '@client/src/components/layout/Toolbar';
import { Pill } from '@client/src/components/layout/Pill';

import {
  getReports,
  createReport,
  updateReport,
  deleteReport,
  toggleReportSent,
  exportReportPdf,
  type CreateReportPayload,
  type UpdateReportPayload,
} from '@client/src/api/reports';
import { getBrandList } from '@client/src/api/keywords';
import type { MonthlyReport } from '@shared/api.interface';

const PRIMARY = '#2563EB';
const ACCENT = '#F59E0B';
const SUCCESS = '#16A34A';
const DANGER = '#DC2626';

const PAGE_SIZE = 10;

const Reports = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [brandId, setBrandId] = useState('');
  const [month, setMonth] = useState('');
  const [isSent, setIsSent] = useState('');

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<MonthlyReport | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<MonthlyReport | null>(null);
  const [printReport, setPrintReport] = useState<MonthlyReport | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    data: reportsData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['reports', { page, brandId, month, isSent }],
    queryFn: () =>
      getReports({
        page,
        pageSize: PAGE_SIZE,
        brandId: brandId || undefined,
        month: month || undefined,
        isSent: isSent || undefined,
      }),
  });

  const { data: brandList } = useQuery({
    queryKey: ['brands', 'options'],
    queryFn: getBrandList,
    staleTime: 5 * 60 * 1000,
  });

  const totalCount = reportsData?.total ?? 0;

  /* ---------------- Mutations ---------------- */

  const createMutation = useMutation({
    mutationFn: (payload: CreateReportPayload) => createReport(payload),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setCreateDialogOpen(false);
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(
        err?.response?.data?.error?.message ?? '创建失败，请重试',
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: (args: { id: string; payload: UpdateReportPayload }) =>
      updateReport(args.id, args.payload),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setEditingReport(null);
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(
        err?.response?.data?.error?.message ?? '更新失败，请重试',
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteReport(id),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setDeleteTarget(null);
    },
  });

  const toggleSentMutation = useMutation({
    mutationFn: (args: { id: string; sent: boolean }) =>
      toggleReportSent(args.id, args.sent),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });

  const exportPdfMutation = useMutation({
    mutationFn: async (id: string) => {
      const blobUrl = await exportReportPdf(id);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `月报_${id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    },
    retry: false,
  });

  /* ---------------- Handlers ---------------- */

  const handleFilterChange = () => {
    setPage(1);
  };

  const handleResetFilters = () => {
    setBrandId('');
    setMonth('');
    setIsSent('');
    setPage(1);
  };

  const handleCreateSubmit = (payload: CreateReportPayload) => {
    createMutation.mutate(payload);
  };

  const handleUpdateSubmit = (payload: UpdateReportPayload) => {
    if (!editingReport) return;
    updateMutation.mutate({ id: editingReport.id, payload });
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id);
  };

  const handleToggleSent = (report: MonthlyReport) => {
    toggleSentMutation.mutate({
      id: report.id,
      sent: !report.isSent,
    });
  };

  const handlePrint = (report: MonthlyReport) => {
    setPrintReport(report);
    setTimeout(() => window.print(), 100);
  };

  const handleExportPdf = (report: MonthlyReport) => {
    exportPdfMutation.mutate(report.id);
  };

  const formatMonth = (monthStr: string) => {
    if (!monthStr) return '-';
    if (monthStr.includes('-')) {
      const [y, m] = monthStr.split('-');
      return `${y}年${parseInt(m, 10)}月`;
    }
    return monthStr;
  };

  const formatDateTime = (iso: string | null) => {
    if (!iso) return '-';
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}`;
  };

  const isEmpty = !isLoading && !isError && reportsData && reportsData.items.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {/* 月报列表 */}
      <SectionCard
        title="月报列表"
        count={totalCount}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleResetFilters}>
              <RefreshCw className="h-3.5 w-3.5" />
              重置筛选
            </Button>
            <Button
              onClick={() => {
                setFormError(null);
                setCreateDialogOpen(true);
              }}
              style={{ backgroundColor: PRIMARY }}
            >
              <Plus className="h-4 w-4" />
              新增月报
            </Button>
          </div>
        }
      >
        {/* 筛选工具栏 */}
        <div className="mb-4">
          <Toolbar>
            <div className="flex items-center gap-2">
              <Label className="text-[12px] whitespace-nowrap" style={{ color: '#94A3B8' }}>
                品牌
              </Label>
              <Select
                value={brandId}
                onValueChange={(v) => {
                  setBrandId(v);
                  handleFilterChange();
                }}
              >
                <SelectTrigger className="h-9 w-[160px]">
                  <SelectValue placeholder="全部品牌" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部品牌</SelectItem>
                  {brandList?.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-[12px] whitespace-nowrap" style={{ color: '#94A3B8' }}>
                月份
              </Label>
              <Input
                type="month"
                value={month}
                onChange={(e) => {
                  setMonth(e.target.value);
                  handleFilterChange();
                }}
                className="h-9 w-[160px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-[12px] whitespace-nowrap" style={{ color: '#94A3B8' }}>
                发送状态
              </Label>
              <Select
                value={isSent}
                onValueChange={(v) => {
                  setIsSent(v);
                  handleFilterChange();
                }}
              >
                <SelectTrigger className="h-9 w-[140px]">
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部状态</SelectItem>
                  <SelectItem value="true">已发送</SelectItem>
                  <SelectItem value="false">未发送</SelectItem>
                </SelectContent>
              </Select>
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

        {/* 加载态 - 骨架屏 */}
        {isLoading && <TableSkeleton rows={PAGE_SIZE} />}

        {/* 空态 */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-16">
            <FileText className="mb-3 h-8 w-8 opacity-50" style={{ color: '#94A3B8' }} />
            <div className="text-[14px] font-medium text-[#0F172A] mb-1">
              暂无月报数据
            </div>
            <div className="text-[13px] text-[#64748B] mb-4">
              点击顶部「新增月报」开始添加
            </div>
          </div>
        )}

        {/* 桌面端表格 */}
        {!isLoading && !isError && reportsData && reportsData.items.length > 0 && (
          <div className="hidden md:block overflow-x-auto">
            <Table className="table-fixed w-full">
              <TableHeader style={{ backgroundColor: '#F1F5F9' }}>
                <TableRow style={{ height: '44px' }}>
                  <TableHead style={{ width: '15%', fontSize: '12px', fontWeight: 500, color: '#334155' }}>品牌名称</TableHead>
                  <TableHead style={{ width: '10%', fontSize: '12px', fontWeight: 500, color: '#334155' }}>月份</TableHead>
                  <TableHead className="text-right" style={{ width: '11%', fontSize: '12px', fontWeight: 500, color: '#334155' }}>本月收录</TableHead>
                  <TableHead className="text-right" style={{ width: '11%', fontSize: '12px', fontWeight: 500, color: '#334155' }}>上月收录</TableHead>
                  <TableHead className="text-right" style={{ width: '10%', fontSize: '12px', fontWeight: 500, color: '#334155' }}>提升数</TableHead>
                  <TableHead className="text-right" style={{ width: '10%', fontSize: '12px', fontWeight: 500, color: '#334155' }}>内容产出</TableHead>
                  <TableHead style={{ width: '10%', fontSize: '12px', fontWeight: 500, color: '#334155' }}>是否发送</TableHead>
                  <TableHead style={{ width: '12%', fontSize: '12px', fontWeight: 500, color: '#334155' }}>发送时间</TableHead>
                  <TableHead className="text-right" style={{ width: '11%', fontSize: '12px', fontWeight: 500, color: '#334155' }}>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportsData.items.map((report: MonthlyReport) => (
                  <TableRow
                    key={report.id}
                    style={{ height: '44px', borderBottom: '1px solid #EEF2F7' }}
                  >
                    <TableCell className="font-medium text-[#0F172A] text-[13px]">
                      {report.brandName}
                    </TableCell>
                    <TableCell className="text-[13px] text-[#64748B]">
                      {formatMonth(report.reportMonth)}
                    </TableCell>
                    <TableCell className="text-right text-[13px] text-[#0F172A] tabular-nums">
                      {report.includedCount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-[13px] text-[#64748B] tabular-nums">
                      {report.prevIncludedCount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <ImprovementCell value={report.improvementCount} />
                    </TableCell>
                    <TableCell className="text-right text-[13px] text-[#0F172A] tabular-nums">
                      {report.contentOutput.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <SentBadge isSent={report.isSent} />
                    </TableCell>
                    <TableCell className="text-[12px] text-[#94A3B8]">
                      {formatDateTime(report.sentAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <RowActions
                        report={report}
                        onEdit={() => {
                          setFormError(null);
                          setEditingReport(report);
                        }}
                        onPrint={() => handlePrint(report)}
                        onExportPdf={() => handleExportPdf(report)}
                        onToggleSent={() => handleToggleSent(report)}
                        onDelete={() => setDeleteTarget(report)}
                        isExporting={exportPdfMutation.isPending && exportPdfMutation.variables === report.id}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* 移动端卡片视图 */}
        {!isLoading && !isError && reportsData && reportsData.items.length > 0 && (
          <div className="space-y-3 md:hidden">
            {reportsData.items.map((report: MonthlyReport) => (
              <MobileCard
                key={report.id}
                report={report}
                formatMonth={formatMonth}
                formatDateTime={formatDateTime}
                onEdit={() => {
                  setFormError(null);
                  setEditingReport(report);
                }}
                onPrint={() => handlePrint(report)}
                onExportPdf={() => handleExportPdf(report)}
                onToggleSent={() => handleToggleSent(report)}
                onDelete={() => setDeleteTarget(report)}
                isExporting={exportPdfMutation.isPending && exportPdfMutation.variables === report.id}
              />
            ))}
          </div>
        )}

        {/* 分页 */}
        {reportsData && reportsData.total > PAGE_SIZE && (
          <div className="mt-4 flex justify-end">
            <DataPagination
              total={reportsData.total}
              page={page}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                // keep PAGE_SIZE constant
              }}
            />
          </div>
        )}
      </SectionCard>

      {/* 新增月报弹窗 */}
      <ReportFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        mode="create"
        brandList={brandList ?? []}
        onSubmit={handleCreateSubmit}
        isSubmitting={createMutation.isPending}
        error={formError}
      />

      {/* 编辑月报弹窗 */}
      <ReportFormDialog
        open={!!editingReport}
        onOpenChange={(open) => !open && setEditingReport(null)}
        mode="edit"
        report={editingReport ?? undefined}
        brandList={brandList ?? []}
        onSubmit={handleUpdateSubmit}
        isSubmitting={updateMutation.isPending}
        error={formError}
      />

      {/* 删除确认弹窗 */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除「{deleteTarget?.brandName} -{' '}
              {deleteTarget && formatMonth(deleteTarget.reportMonth)}」
              的月报吗？此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteConfirm();
              }}
              style={{ backgroundColor: DANGER }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 打印视图 */}
      {printReport && (
        <PrintView
          report={printReport}
          onClose={() => setPrintReport(null)}
          formatMonth={formatMonth}
        />
      )}
    </div>
  );
};

/* ---------------- 子组件 ---------------- */

function ImprovementCell({ value }: { value: number }) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const color = isPositive ? SUCCESS : isNegative ? DANGER : '#64748B';
  const Arrow = isPositive ? TrendingUp : isNegative ? TrendingDown : null;
  const sign = isPositive ? '+' : '';

  return (
    <span
      className="inline-flex items-center gap-1 font-medium text-[13px]"
      style={{ color }}
    >
      {Arrow && <Arrow className="h-3.5 w-3.5" />}
      {sign}
      {value.toLocaleString()}
    </span>
  );
}

function SentBadge({ isSent }: { isSent: boolean }) {
  if (isSent) {
    return (
      <Pill variant="success">
        <MailCheck className="h-3 w-3" />
        已发送
      </Pill>
    );
  }
  return (
    <Pill variant="muted">
      <MailX className="h-3 w-3" />
      未发送
    </Pill>
  );
}

interface RowActionsProps {
  report: MonthlyReport;
  onEdit: () => void;
  onPrint: () => void;
  onExportPdf: () => void;
  onToggleSent: () => void;
  onDelete: () => void;
  isExporting?: boolean;
}

function RowActions({
  report,
  onEdit,
  onPrint,
  onExportPdf,
  onToggleSent,
  onDelete,
  isExporting,
}: RowActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="操作" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={onEdit}>
          <Edit3 className="h-4 w-4" />
          查看/编辑
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onPrint}>
          <Printer className="h-4 w-4" />
          打印
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExportPdf} disabled={isExporting}>
          <Download className="h-4 w-4" />
          {isExporting ? '导出中...' : '导出PDF'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onToggleSent}>
          {report.isSent ? (
            <>
              <MailX className="h-4 w-4" />
              取消发送
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              标记已发送
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} style={{ color: DANGER }}>
          <Trash2 className="h-4 w-4" />
          删除
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 h-11 px-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20 ml-auto" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-8 rounded-md ml-auto" />
        </div>
      ))}
    </div>
  );
}

interface MobileCardProps {
  report: MonthlyReport;
  formatMonth: (m: string) => string;
  formatDateTime: (d: string | null) => string;
  onEdit: () => void;
  onPrint: () => void;
  onExportPdf: () => void;
  onToggleSent: () => void;
  onDelete: () => void;
  isExporting?: boolean;
}

function MobileCard({
  report,
  formatMonth,
  formatDateTime,
  onEdit,
  onPrint,
  onExportPdf,
  onToggleSent,
  onDelete,
  isExporting,
}: MobileCardProps) {
  return (
    <div
      className="rounded-[12px] border p-5 bg-white"
      style={{ borderColor: '#E6EAF2', boxShadow: '0 1px 2px rgba(15,23,42,.04), 0 8px 24px rgba(15,23,42,.04)' }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-[#0F172A]">{report.brandName}</p>
          <p className="text-[12px] mt-0.5" style={{ color: '#94A3B8' }}>
            {formatMonth(report.reportMonth)}
          </p>
        </div>
        <SentBadge isSent={report.isSent} />
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div>
          <p className="text-[12px]" style={{ color: '#94A3B8' }}>本月收录</p>
          <p className="text-sm font-medium mt-1 tabular-nums text-[#0F172A]">
            {report.includedCount.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-[12px]" style={{ color: '#94A3B8' }}>上月收录</p>
          <p className="text-sm font-medium mt-1 tabular-nums text-[#64748B]">
            {report.prevIncludedCount.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-[12px]" style={{ color: '#94A3B8' }}>提升数</p>
          <p className="text-sm font-medium mt-1">
            <ImprovementCell value={report.improvementCount} />
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between text-[12px] mb-3" style={{ color: '#94A3B8' }}>
        <span>内容产出: {report.contentOutput} 篇</span>
        <span>{formatDateTime(report.sentAt)}</span>
      </div>

      <div className="flex items-center gap-2 pt-3 border-t" style={{ borderColor: '#EEF2F7' }}>
        <Button variant="outline" size="sm" className="flex-1 h-8" onClick={onEdit}>
          <Edit3 className="h-3.5 w-3.5" />
          编辑
        </Button>
        <Button variant="outline" size="sm" className="flex-1 h-8" onClick={onPrint}>
          <Printer className="h-3.5 w-3.5" />
          打印
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-8"
          onClick={onExportPdf}
          disabled={isExporting}
        >
          <Download className="h-3.5 w-3.5" />
          {isExporting ? '导出中' : '导出'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-8"
          onClick={onToggleSent}
          style={
            !report.isSent
              ? { color: SUCCESS, borderColor: 'rgba(22,163,74,0.3)' }
              : undefined
          }
        >
          {report.isSent ? (
            <>
              <MailX className="h-3.5 w-3.5" />
              取消
            </>
          ) : (
            <>
              <Send className="h-3.5 w-3.5" />
              发送
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={onDelete}
          style={{ color: DANGER, borderColor: 'rgba(220,38,38,0.3)' }}
          aria-label="删除"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/* ---------------- 表单弹窗 ---------------- */

interface ReportFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  report?: MonthlyReport;
  brandList: Array<{ id: string; name: string }>;
  onSubmit: (payload: any) => void;
  isSubmitting: boolean;
  error: string | null;
}

function ReportFormDialog({
  open,
  onOpenChange,
  mode,
  report,
  brandList,
  onSubmit,
  isSubmitting,
  error,
}: ReportFormDialogProps) {
  const [brandId, setBrandId] = useState(report?.brandId ?? '');
  const [reportMonth, setReportMonth] = useState(report?.reportMonth ?? '');
  const [includedCount, setIncludedCount] = useState<string>(
    report ? String(report.includedCount) : '',
  );
  const [prevIncludedCount, setPrevIncludedCount] = useState<string>(
    report ? String(report.prevIncludedCount) : '',
  );
  const [contentOutput, setContentOutput] = useState<string>(
    report ? String(report.contentOutput) : '',
  );
  const [notes, setNotes] = useState(report?.notes ?? '');

  useEffect(() => {
    if (open) {
      setBrandId(report?.brandId ?? '');
      setReportMonth(report?.reportMonth ?? '');
      setIncludedCount(report ? String(report.includedCount) : '');
      setPrevIncludedCount(
        report ? String(report.prevIncludedCount) : '',
      );
      setContentOutput(report ? String(report.contentOutput) : '');
      setNotes(report?.notes ?? '');
    }
  }, [open, report]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      brandId,
      reportMonth,
      includedCount: Number(includedCount) || 0,
      prevIncludedCount: Number(prevIncludedCount) || 0,
      contentOutput: Number(contentOutput) || 0,
      notes: notes || null,
    };
    onSubmit(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? '新增月报' : '编辑月报'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? '填写品牌和月度数据生成新的月报'
              : '修改月报信息'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="brand">品牌</Label>
              <Select
                value={brandId}
                onValueChange={setBrandId}
                disabled={mode === 'edit'}
              >
                <SelectTrigger id="brand" className="w-full h-9">
                  <SelectValue placeholder="请选择品牌" />
                </SelectTrigger>
                <SelectContent>
                  {brandList.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="month">月份</Label>
              <Input
                id="month"
                type="month"
                value={reportMonth}
                onChange={(e) => setReportMonth(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="included">本月收录数</Label>
              <Input
                id="included"
                type="number"
                min="0"
                value={includedCount}
                onChange={(e) => setIncludedCount(e.target.value)}
                placeholder="0"
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prevIncluded">上月收录数</Label>
              <Input
                id="prevIncluded"
                type="number"
                min="0"
                value={prevIncludedCount}
                onChange={(e) => setPrevIncludedCount(e.target.value)}
                placeholder="0"
                className="h-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contentOutput">内容产出数（篇）</Label>
            <Input
              id="contentOutput"
              type="number"
              min="0"
              value={contentOutput}
              onChange={(e) => setContentOutput(e.target.value)}
              placeholder="0"
              className="h-9"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">备注</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="可选，填写本月补充说明"
              rows={3}
            />
          </div>

          {error && (
            <div
              className="flex items-center gap-2 rounded-md p-3 text-sm"
              style={{
                backgroundColor: 'rgba(220, 38, 38, 0.08)',
                color: DANGER,
              }}
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="h-9"
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              style={{ backgroundColor: PRIMARY }}
              className="h-9"
            >
              {isSubmitting
                ? mode === 'create'
                  ? '创建中...'
                  : '保存中...'
                : mode === 'create'
                  ? '创建'
                  : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- 打印视图 ---------------- */

interface PrintViewProps {
  report: MonthlyReport;
  onClose: () => void;
  formatMonth: (m: string) => string;
}

function PrintView({
  report,
  onClose,
  formatMonth,
}: PrintViewProps) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/50 print:bg-transparent print:inset-0 print:fixed">
      <div className="absolute inset-4 md:inset-10 bg-white rounded-lg shadow-xl overflow-auto print:inset-0 print:rounded-none print:shadow-none print:overflow-visible">
        <div className="sticky top-0 flex items-center justify-between p-4 border-b bg-white print:hidden z-10">
          <h3 className="font-semibold">打印预览</h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4" />
              打印
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              关闭
            </Button>
          </div>
        </div>

        <div className="p-8 print:p-6 max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h1
              className="text-2xl font-bold"
              style={{ color: PRIMARY }}
            >
              {report.brandName}
            </h1>
            <p className="mt-2" style={{ color: '#64748B' }}>
              {formatMonth(report.reportMonth)} 月度 SEO 效果报告
            </p>
          </div>

          <div
            className="rounded-lg p-6 mb-8"
            style={{ backgroundColor: '#F1F5F9' }}
          >
            <h2 className="text-base font-semibold mb-4" style={{ color: '#334155' }}>
              一、收录数据概览
            </h2>
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <p className="text-sm" style={{ color: '#64748B' }}>本月收录</p>
                <p
                  className="text-3xl font-bold mt-2"
                  style={{ color: PRIMARY }}
                >
                  {report.includedCount.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm" style={{ color: '#64748B' }}>上月收录</p>
                <p className="text-3xl font-bold mt-2" style={{ color: '#334155' }}>
                  {report.prevIncludedCount.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm" style={{ color: '#64748B' }}>提升数</p>
                <p
                  className="text-3xl font-bold mt-2"
                  style={{
                    color:
                      report.improvementCount >= 0
                        ? SUCCESS
                        : DANGER,
                  }}
                >
                  {report.improvementCount >= 0 ? '+' : ''}
                  {report.improvementCount.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div
            className="rounded-lg p-6 mb-8"
            style={{ backgroundColor: '#F1F5F9' }}
          >
            <h2 className="text-base font-semibold mb-4" style={{ color: '#334155' }}>
              二、内容产出
            </h2>
            <div className="text-center">
              <p className="text-sm" style={{ color: '#64748B' }}>本月内容产出</p>
              <p
                className="text-3xl font-bold mt-2"
                style={{ color: ACCENT }}
              >
                {report.contentOutput}
                <span className="text-base font-normal ml-1">篇</span>
              </p>
            </div>
          </div>

          {report.notes && (
            <div
              className="rounded-lg p-6 mb-8"
              style={{ backgroundColor: '#F1F5F9' }}
            >
              <h2 className="text-base font-semibold mb-3" style={{ color: '#334155' }}>
                三、备注说明
              </h2>
              <p className="text-sm whitespace-pre-wrap" style={{ color: '#475569' }}>
                {report.notes}
              </p>
            </div>
          )}

          <div className="text-center text-xs mt-12 pt-6 border-t" style={{ color: '#94A3B8', borderColor: '#E6EAF2' }}>
            <p>报告生成时间: {new Date().toLocaleString('zh-CN')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Reports;
