import { useMemo, useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  Search,
  Plus,
  Download,
  Eye,
  Edit2,
  Trash2,
  RefreshCw,
  AlertCircle,
  FileText,
  RotateCcw,
  MoreHorizontal,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
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
  Card,
  CardContent,
} from '@client/src/components/ui/card';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@client/src/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@client/src/components/ui/dropdown-menu';
import { SectionCard } from '@client/src/components/layout/SectionCard';
import { Toolbar } from '@client/src/components/layout/Toolbar';
import { Pill } from '@client/src/components/layout/Pill';

import { useAuth } from '@client/src/contexts/AuthContext';
import {
  getContracts,
  deleteContract,
  exportContracts,
  type ContractsQueryParams,
} from '@client/src/api/contracts';
import {
  PACKAGE_TYPE_LABELS,
  PAYMENT_STATUS,
  PAYMENT_STATUS_LABELS,
  type Contract,
  type PaymentStatus,
} from '@shared/api.interface';
import ContractDetailSheet from './components/ContractDetailSheet';
import ContractFormDialog from './components/ContractFormDialog';
import RenewDialog from './components/RenewDialog';
import CommitmentManagementPage from '@client/src/pages/Commitment/ManagementPage';

const PRIMARY = '#2563EB';
const ACCENT = '#F59E0B';
const SUCCESS = '#16A34A';
const DANGER = '#DC2626';
const MUTED = '#94A3B8';

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  ...PAYMENT_STATUS.map((s) => ({ value: s, label: PAYMENT_STATUS_LABELS[s] })),
];

const getStatusVariant = (status: PaymentStatus): 'danger' | 'warning' | 'success' | 'muted' => {
  switch (status) {
    case 'unpaid':
      return 'danger';
    case 'partial':
      return 'warning';
    case 'paid':
      return 'success';
    default:
      return 'muted';
  }
};

const getRemainingDaysColor = (days: number | null): string => {
  if (days === null) return MUTED;
  if (days <= 0) return DANGER;
  if (days <= 30) return ACCENT;
  return MUTED;
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  return dateStr.slice(0, 10);
};

const formatAmount = (amount: number): string => {
  return `¥${amount.toLocaleString('zh-CN')}`;
};

const Contracts = () => {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [status, setStatus] = useState<string>('');

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(
    null,
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [renewOpen, setRenewOpen] = useState(false);
  const [renewContract, setRenewContract] = useState<Contract | null>(null);

  const [searchParams] = useSearchParams();
  const commitmentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchParams.get('sub') === 'commitments' && commitmentRef.current) {
      commitmentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [searchParams]);

  const queryParams: ContractsQueryParams = useMemo(() => {
    const params: ContractsQueryParams = { page, pageSize };
    if (keyword) params.keyword = keyword;
    if (status) params.status = status;
    return params;
  }, [page, pageSize, keyword, status]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['contracts', queryParams],
    queryFn: () => getContracts(queryParams),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteContract(id),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast.success('删除成功');
    },
    onError: (err) => {
      logger.error('删除合同失败', err);
      toast.error('删除失败，请重试');
    },
  });

  const exportMutation = useMutation({
    mutationFn: () => exportContracts({ keyword, status }),
    retry: false,
    onSuccess: () => {
      toast.success('导出成功');
    },
    onError: (err) => {
      logger.error('导出失败', err);
      toast.error('导出失败，请重试');
    },
  });

  const totalCount = data?.total ?? 0;

  const handleSearch = () => {
    setKeyword(keywordInput.trim());
    setPage(1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleStatusChange = (value: string) => {
    setStatus(value);
    setPage(1);
  };

  const openDetail = (id: string) => {
    setSelectedContractId(id);
    setDetailOpen(true);
  };

  const openCreate = () => {
    setEditingContract(null);
    setFormOpen(true);
  };

  const openEdit = (contract: Contract) => {
    setEditingContract(contract);
    setFormOpen(true);
  };

  const openRenew = (contract: Contract) => {
    setRenewContract(contract);
    setRenewOpen(true);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const isEmpty = !isLoading && !isError && data && data.items.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {/* 合同列表 */}
      <SectionCard
        title="合同列表"
        count={totalCount}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending}
            >
              <Download className="h-4 w-4" />
              导出 CSV
            </Button>
            {isAdmin && (
              <Button size="sm" onClick={openCreate} style={{ backgroundColor: PRIMARY }}>
                <Plus className="h-4 w-4" />
                新增合同
              </Button>
            )}
          </div>
        }
      >
        {/* 筛选工具栏 */}
        <div className="mb-4">
          <Toolbar>
            <div className="relative w-[260px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索客户名称/联系人/电话"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-9 pl-9"
              />
            </div>
            <Select value={status} onValueChange={handleStatusChange}>
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue placeholder="收款状态" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Toolbar>
        </div>

        {/* 错误态 */}
        {isError && (
          <div className="flex items-center justify-between rounded-lg border border-red-200 p-4 mb-4" style={{ backgroundColor: 'rgba(220, 38, 38, 0.05)' }}>
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
        {isLoading && <TableSkeleton />}

        {/* 空态 */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-16">
            <FileText className="mb-3 h-8 w-8 text-[#94A3B8] opacity-50" />
            <div className="text-[14px] font-medium text-[#0F172A] mb-1">
              暂无合同数据
            </div>
            <div className="text-[13px] text-[#64748B] mb-4">
              点击右上角「新增合同」开始添加
            </div>
            {isAdmin && (
              <Button onClick={openCreate} style={{ backgroundColor: PRIMARY }}>
                <Plus className="h-4 w-4" />
                新增合同
              </Button>
            )}
          </div>
        )}

        {/* 桌面端表格 */}
        {!isLoading && !isError && data && data.items.length > 0 && (
          <div className="hidden md:block overflow-x-auto">
            <Table className="table-fixed w-full">
              <TableHeader style={{ backgroundColor: '#F1F5F9' }}>
                <TableRow style={{ height: '44px' }}>
                  <TableHead style={{ width: '15%', fontSize: '12px', fontWeight: 500, color: '#334155' }}>客户名称</TableHead>
                  <TableHead style={{ width: '9%', fontSize: '12px', fontWeight: 500, color: '#334155' }}>行业</TableHead>
                  <TableHead style={{ width: '9%', fontSize: '12px', fontWeight: 500, color: '#334155' }}>联系人</TableHead>
                  <TableHead style={{ width: '10%', fontSize: '12px', fontWeight: 500, color: '#334155' }}>电话</TableHead>
                  <TableHead style={{ width: '9%', fontSize: '12px', fontWeight: 500, color: '#334155' }}>套餐</TableHead>
                  <TableHead style={{ width: '10%', fontSize: '12px', fontWeight: 500, color: '#334155' }}>合同金额</TableHead>
                  <TableHead style={{ width: '9%', fontSize: '12px', fontWeight: 500, color: '#334155' }}>签约日期</TableHead>
                  <TableHead style={{ width: '10%', fontSize: '12px', fontWeight: 500, color: '#334155' }}>服务期</TableHead>
                  <TableHead style={{ width: '8%', fontSize: '12px', fontWeight: 500, color: '#334155' }}>剩余天数</TableHead>
                  <TableHead style={{ width: '8%', fontSize: '12px', fontWeight: 500, color: '#334155' }}>收款状态</TableHead>
                  <TableHead className="text-right" style={{ width: '10%', fontSize: '12px', fontWeight: 500, color: '#334155' }}>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((contract: Contract) => (
                  <TableRow key={contract.id} style={{ height: '44px', borderBottom: '1px solid #EEF2F7' }}>
                    <TableCell className="font-medium text-[#0F172A] text-[13px]">
                      {contract.customerName}
                    </TableCell>
                    <TableCell className="text-[#64748B] text-[13px]">
                      {contract.industry || '-'}
                    </TableCell>
                    <TableCell className="text-[#64748B] text-[13px]">
                      {contract.contactPerson || '-'}
                    </TableCell>
                    <TableCell className="text-[#64748B] text-[13px]">
                      {contract.contactPhone || '-'}
                    </TableCell>
                    <TableCell className="text-[13px] text-[#64748B]">
                      {PACKAGE_TYPE_LABELS[contract.packageType] || '-'}
                    </TableCell>
                    <TableCell className="font-medium text-[#0F172A] text-[13px]">
                      {formatAmount(contract.contractAmount)}
                    </TableCell>
                    <TableCell className="text-[#64748B] text-[13px]">
                      {formatDate(contract.signDate)}
                    </TableCell>
                    <TableCell className="text-[#64748B] text-[13px]">
                      {formatDate(contract.serviceStart)} ~{' '}
                      {formatDate(contract.serviceEnd)}
                    </TableCell>
                    <TableCell className="text-[13px]">
                      <span
                        className="font-medium"
                        style={{
                          color: getRemainingDaysColor(contract.remainingDays),
                        }}
                      >
                        {contract.remainingDays === null
                          ? '-'
                          : contract.remainingDays <= 0
                            ? `已逾期 ${Math.abs(contract.remainingDays)} 天`
                            : `${contract.remainingDays} 天`}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Pill variant={getStatusVariant(contract.paymentStatus)}>
                        {PAYMENT_STATUS_LABELS[contract.paymentStatus]}
                      </Pill>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDetail(contract.id)}
                          aria-label="查看详情"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(contract)}
                            aria-label="编辑"
                            style={{ color: PRIMARY }}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="更多操作"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openRenew(contract)}>
                              <RotateCcw className="mr-2 h-4 w-4" />
                              续费
                            </DropdownMenuItem>
                            {isAdmin && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem
                                    style={{ color: DANGER }}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    删除
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>确认删除</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      确定要删除「{contract.customerName}」的合同吗？此操作不可撤销。
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>取消</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteMutation.mutate(contract.id)}
                                      style={{ backgroundColor: DANGER }}
                                    >
                                      确认删除
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* 移动端卡片视图 */}
        {!isLoading && !isError && data && data.items.length > 0 && (
          <div className="space-y-3 md:hidden">
            {data.items.map((contract: Contract) => (
              <Card
                key={contract.id}
                style={{ borderRadius: '8px', borderColor: '#E6EAF2', boxShadow: 'none' }}
              >
                <CardContent className="pt-4">
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-[#0F172A]">
                        {contract.customerName}
                      </h3>
                      <p className="text-xs text-[#64748B]">
                        {contract.industry || '未设置行业'}
                      </p>
                    </div>
                    <Pill variant={getStatusVariant(contract.paymentStatus)}>
                      {PAYMENT_STATUS_LABELS[contract.paymentStatus]}
                    </Pill>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[#94A3B8]">联系人：</span>
                      <span className="text-[#64748B]">
                        {contract.contactPerson || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#94A3B8]">电话：</span>
                      <span className="text-[#64748B]">
                        {contract.contactPhone || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#94A3B8]">套餐：</span>
                      <span className="text-[#64748B]">
                        {PACKAGE_TYPE_LABELS[contract.packageType]}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#94A3B8]">金额：</span>
                      <span className="font-medium text-[#0F172A]">
                        {formatAmount(contract.contractAmount)}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[#94A3B8]">服务期：</span>
                      <span className="text-[#64748B]">
                        {formatDate(contract.serviceStart)} ~ {formatDate(contract.serviceEnd)}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[#94A3B8]">剩余天数：</span>
                      <span
                        className="font-medium"
                        style={{ color: getRemainingDaysColor(contract.remainingDays) }}
                      >
                        {contract.remainingDays === null
                          ? '-'
                          : contract.remainingDays <= 0
                            ? `已逾期 ${Math.abs(contract.remainingDays)} 天`
                            : `${contract.remainingDays} 天`}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-1 border-t pt-3" style={{ borderColor: '#EEF2F7' }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDetail(contract.id)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      详情
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(contract)}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      编辑
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openRenew(contract)}
                      style={{ color: ACCENT }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      续费
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 分页 */}
        {data && data.total > pageSize && (
          <div className="mt-4 flex justify-end">
            <DataPagination
              total={data.total}
              page={page}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </div>
        )}
      </SectionCard>

      {/* 详情抽屉 */}
      <ContractDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        contractId={selectedContractId}
      />

      {/* 新增/编辑弹窗 */}
      <ContractFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editingContract={editingContract}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['contracts'] });
          setFormOpen(false);
        }}
      />

      {/* 续费弹窗 */}
      <RenewDialog
        open={renewOpen}
        onOpenChange={setRenewOpen}
        contract={renewContract}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['contracts'] });
          setRenewOpen(false);
        }}
      />

      {/* KPI 承诺分区 */}
      <div ref={commitmentRef} id="commitments-section">
        <CommitmentManagementPage />
      </div>
    </div>
  );
};

const TableSkeleton = () => (
  <div className="space-y-1">
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 h-11 px-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-6 w-16" />
        <Skeleton className="ml-auto h-6 w-20" />
      </div>
    ))}
  </div>
);

export default Contracts;
