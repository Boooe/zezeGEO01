import { useMemo, useState } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  Building2,
  Search,
  Plus,
  MoreHorizontal,
  Eye,
  Zap,
  Shield,
  ShieldOff,
  Users,
  RotateCcw,
  AlertCircle,
  RefreshCw,
  AlertTriangle,
  CreditCard,
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
import { Skeleton } from '@client/src/components/ui/skeleton';
import { DataPagination } from '@client/src/components/ui/data-pagination';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@client/src/components/ui/dropdown-menu';
import { SectionCard } from '@client/src/components/layout/SectionCard';
import { Toolbar } from '@client/src/components/layout/Toolbar';
import { Pill } from '@client/src/components/layout/Pill';
import { DataTable } from '@client/src/components/layout/DataTable';
import { EmptyState } from '@client/src/components/layout/EmptyState';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@client/src/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@client/src/components/ui/dialog';
import { Textarea } from '@client/src/components/ui/textarea';
import { useAuth } from '@client/src/contexts/AuthContext';
import {
  getCustomers,
  toggleUserStatus,
  resetUserPassword,
  type CustomersQueryParams,
} from '@client/src/api/customers';
import {
  listCreditRequests,
  approveCreditRequest,
  rejectCreditRequest,
} from '@client/src/api/ai-keys';
import {
  INDUSTRIES,
  INDUSTRY_LABELS,
  ACCOUNT_STATUSES,
  ACCOUNT_STATUS_LABELS,
  PACKAGE_TYPE_LABELS,
  PACKAGE_PRICES,
  CREDIT_REQUEST_STATUSES,
  CREDIT_REQUEST_STATUS_LABELS,
  type CustomerItem,
  type AccountStatus,
  type Industry,
  type CreditRequestItem,
  type CreditRequestStatus,
} from '@shared/api.interface';
import NewCustomerDialog from './components/NewCustomerDialog';
import CreateUserDialog from './components/CreateUserDialog';
import AdjustCreditDialog from './components/AdjustCreditDialog';
import CustomerDetailSheet from './components/CustomerDetailSheet';
import RenewCustomerDialog from './components/RenewCustomerDialog';
import { getExpiringSoonCount } from '@client/src/api/admin';
import type { CustomerExpiryStatus } from '@shared/api.interface';

const PRIMARY = '#2E7DFF';
const ACCENT = '#F59E0B';
const SUCCESS = '#10B981';
const WARNING = '#F59E0B';
const DANGER = '#EF4444';
const MUTED = '#94A3B8';

const PACKAGE_TYPE_SHORT_LABELS: Record<string, string> = {
  basic: '基础版',
  standard: '标准版',
  premium: '旗舰版',
};

const INDUSTRY_OPTIONS = [
  { value: '', label: '全部行业' },
  ...INDUSTRIES.map((ind) => ({
    value: ind,
    label: INDUSTRY_LABELS[ind],
  })),
];

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  ...ACCOUNT_STATUSES.map((s) => ({
    value: s,
    label: ACCOUNT_STATUS_LABELS[s],
  })),
];

const getAccountStatusColor = (status: AccountStatus): string => {
  switch (status) {
    case 'active':
      return SUCCESS;
    case 'disabled':
      return DANGER;
    case 'not_opened':
      return MUTED;
    default:
      return MUTED;
  }
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  return dateStr.slice(0, 10);
};

const formatCurrency = (value: number): string => {
  return `¥${value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const getIndustryLabel = (industry: string | null): string => {
  if (!industry) return '-';
  return INDUSTRY_LABELS[industry as Industry] || industry;
};

const CREDIT_STATUS_OPTIONS = [
  { value: 'all', label: '全部状态' },
  ...CREDIT_REQUEST_STATUSES.map((s) => ({
    value: s,
    label: CREDIT_REQUEST_STATUS_LABELS[s],
  })),
];

const getCreditStatusVariant = (
  status: CreditRequestStatus,
): 'success' | 'warning' | 'danger' | 'muted' => {
  switch (status) {
    case 'approved':
      return 'success';
    case 'pending':
      return 'warning';
    case 'rejected':
      return 'muted';
    default:
      return 'muted';
  }
};

const formatDateTime = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  return dateStr.replace('T', ' ').slice(0, 16);
};

const PAGE_SIZE_DEFAULT = 10;

const Customers = () => {
  const { hasRole, user } = useAuth();
  const isAdmin = hasRole('admin');
  const queryClient = useQueryClient();

  const [requestsSheetOpen, setRequestsSheetOpen] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
  const [keyword, setKeyword] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [industry, setIndustry] = useState<string>('');
  const [accountStatus, setAccountStatus] = useState<string>('');
  const [expiryStatus, setExpiryStatus] = useState<string>('');
  const [includeDemo, setIncludeDemo] = useState(false);

  // 充值申请列表状态
  const [reqPage, setReqPage] = useState(1);
  const [reqPageSize, setReqPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // 弹窗状态
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerItem | null>(null);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [adjustCreditOpen, setAdjustCreditOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);

  // 到期提醒数量
  const { data: expiringData } = useQuery({
    queryKey: ['admin-expiring-soon-count'],
    queryFn: () => getExpiringSoonCount(),
    enabled: isAdmin,
  });

  // 充值申请弹窗
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] =
    useState<CreditRequestItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const queryParams: CustomersQueryParams = useMemo(() => {
    const params: CustomersQueryParams = { page, pageSize };
    if (keyword) params.keyword = keyword;
    if (industry) params.industry = industry;
    if (accountStatus) params.accountStatus = accountStatus;
    if (includeDemo) params.includeDemo = true;
    return params;
  }, [page, pageSize, keyword, industry, accountStatus, includeDemo]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['customers', queryParams],
    queryFn: () => getCustomers(queryParams),
  });

  // 充值申请列表
  const creditQueryParams = useMemo(() => {
    const params: { status?: string; page: number; pageSize: number } = {
      page: reqPage,
      pageSize: reqPageSize,
    };
    if (statusFilter !== 'all') params.status = statusFilter;
    return params;
  }, [reqPage, reqPageSize, statusFilter]);

  const {
    data: creditData,
    isLoading: creditLoading,
    isError: creditError,
    refetch: creditRefetch,
  } = useQuery({
    queryKey: ['credit-requests', statusFilter, reqPage, reqPageSize],
    queryFn: () => listCreditRequests(creditQueryParams),
    enabled: requestsSheetOpen && isAdmin,
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => approveCreditRequest(id),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-requests'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('已确认到账');
      setApproveDialogOpen(false);
      setSelectedRequest(null);
    },
    onError: (err: unknown) => {
      logger.error('确认到账失败', err);
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          .response?.data?.error?.message || '操作失败，请重试';
      toast.error(msg);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({
      id,
      reason,
    }: {
      id: number;
      reason?: string;
    }) => rejectCreditRequest(id, reason),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-requests'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('已驳回申请');
      setRejectDialogOpen(false);
      setSelectedRequest(null);
      setRejectReason('');
    },
    onError: (err: unknown) => {
      logger.error('驳回申请失败', err);
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          .response?.data?.error?.message || '操作失败，请重试';
      toast.error(msg);
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({
      userId,
      status,
    }: {
      userId: string;
      status: string;
    }) => toggleUserStatus(userId, status),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customerDetail'] });
      toast.success('账号状态已更新');
    },
    onError: (err: unknown) => {
      logger.error('更新账号状态失败', err);
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          .response?.data?.error?.message || '操作失败，请重试';
      toast.error(msg);
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (userId: string) => resetUserPassword(userId),
    retry: false,
    onSuccess: (res) => {
      toast.success(`密码已重置，新密码：${res.newPassword}`);
    },
    onError: (err: unknown) => {
      logger.error('重置密码失败', err);
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          .response?.data?.error?.message || '重置失败，请重试';
      toast.error(msg);
    },
  });

  const totalCount = data?.total ?? 0;
  const demoCount = data?.demoCount ?? 0;

  const handleSearch = () => {
    setKeyword(keywordInput.trim());
    setPage(1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleIndustryChange = (value: string) => {
    setIndustry(value);
    setPage(1);
  };

  const handleStatusChange = (value: string) => {
    setAccountStatus(value);
    setPage(1);
  };

  const handleExpiryStatusChange = (value: string) => {
    setExpiryStatus(value);
    setPage(1);
  };

  const handleDataRangeChange = (value: string) => {
    setIncludeDemo(value === 'withDemo');
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleReqPageChange = (newPage: number) => {
    setReqPage(newPage);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setReqPage(1);
  };

  const openApproveDialog = (req: CreditRequestItem) => {
    setSelectedRequest(req);
    setApproveDialogOpen(true);
  };

  const openRejectDialog = (req: CreditRequestItem) => {
    setSelectedRequest(req);
    setRejectReason('');
    setRejectDialogOpen(true);
  };

  const handleApproveConfirm = () => {
    if (!selectedRequest) return;
    approveMutation.mutate(selectedRequest.id);
  };

  const handleRejectConfirm = () => {
    if (!selectedRequest) return;
    rejectMutation.mutate({
      id: selectedRequest.id,
      reason: rejectReason.trim() || undefined,
    });
  };

  const openDetail = (customer: CustomerItem) => {
    setSelectedCustomer(customer);
    setDetailOpen(true);
  };

  const openCreateUser = (customer: CustomerItem) => {
    setSelectedCustomer(customer);
    setCreateUserOpen(true);
  };

  const openAdjustCredit = (customer: CustomerItem) => {
    setSelectedCustomer(customer);
    setAdjustCreditOpen(true);
  };

  const openRenew = (customer: CustomerItem) => {
    setSelectedCustomer(customer);
    setRenewOpen(true);
  };

  // 计算到期状态
  const getExpiryStatus = (
    serviceEnd: string | null,
  ): CustomerExpiryStatus => {
    if (!serviceEnd) return 'unset';
    const end = new Date(serviceEnd);
    const now = new Date();
    const diffMs = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'expired';
    if (diffDays <= 7) return 'warning';
    return 'normal';
  };

  const EXPIRY_STATUS_LABELS: Record<CustomerExpiryStatus, string> = {
    normal: '正常',
    warning: '即将到期',
    expired: '已到期',
    unset: '未设置',
  };

  const getExpiryVariant = (
    status: CustomerExpiryStatus,
  ): 'success' | 'warning' | 'danger' | 'muted' => {
    switch (status) {
      case 'normal':
        return 'success';
      case 'warning':
        return 'warning';
      case 'expired':
        return 'danger';
      case 'unset':
        return 'muted';
      default:
        return 'muted';
    }
  };

  // 客户端按到期状态筛选（当前页）
  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    if (!expiryStatus) return data.items;
    return data.items.filter(
      (item: CustomerItem) =>
        getExpiryStatus(item.serviceEnd) === expiryStatus,
    );
  }, [data?.items, expiryStatus]);

  const handleToggleStatus = (customer: CustomerItem) => {
    if (!customer.userId) return;
    const targetStatus =
      customer.accountStatus === 'active' ? 'disabled' : 'active';
    toggleStatusMutation.mutate({
      userId: customer.userId,
      status: targetStatus,
    });
  };

  const handleResetPassword = (customer: CustomerItem) => {
    if (!customer.userId) {
      toast.error('该客户尚未开通账号');
      return;
    }
    resetPasswordMutation.mutate(customer.userId);
  };

  const isEmpty = !isLoading && !isError && data && filteredItems.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {/* 到期提醒条 */}
      {isAdmin && expiringData && expiringData.count > 0 && (
        <div
          className="flex items-center justify-between rounded-lg border px-4 py-3"
          style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle
              className="h-4 w-4 shrink-0"
              style={{ color: WARNING }}
            />
            <span className="text-sm" style={{ color: '#92400E' }}>
              有{' '}
              <span className="font-semibold">{expiringData.count}</span>{' '}
              个客户将在 7 天内到期
            </span>
          </div>
          <button
            onClick={() => {
              setExpiryStatus('warning');
              setPage(1);
            }}
            className="text-sm font-medium transition-colors hover:underline"
            style={{ color: WARNING }}
          >
            点击查看 →
          </button>
        </div>
      )}

      {/* 客户列表 */}
      <SectionCard
        title="客户列表"
        count={totalCount}
        subtitle={
          demoCount > 0 ? (
            <span className="tabular-nums">· 另有 {demoCount} 条演示数据</span>
          ) : null
        }
        actions={
          <>
            {isAdmin && (
              <>
                <Sheet
                  open={requestsSheetOpen}
                  onOpenChange={setRequestsSheetOpen}
                >
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="relative">
                      <Zap className="h-4 w-4" />
                      充值申请
                      {(creditData?.pendingCount ?? 0) > 0 && (
                        <span
                          className="absolute -right-2 -top-2 inline-flex min-w-[18px] items-center justify-center rounded-full px-1 text-white"
                          style={{
                            backgroundColor: DANGER,
                            fontSize: 11,
                            height: 18,
                            fontWeight: 600,
                          }}
                        >
                          {creditData?.pendingCount ?? 0}
                        </span>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-full sm:max-w-4xl p-0">
                    <SheetHeader className="border-b px-6 py-4" style={{ borderColor: '#E6EAF2' }}>
                      <SheetTitle className="text-lg font-semibold">
                        充值申请
                      </SheetTitle>
                    </SheetHeader>
                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                      {/* 筛选 */}
                      <div className="flex items-center gap-3">
                        <Select
                          value={statusFilter}
                          onValueChange={handleStatusFilterChange}
                        >
                          <SelectTrigger className="w-[160px] h-9">
                            <SelectValue placeholder="全部状态" />
                          </SelectTrigger>
                          <SelectContent>
                            {CREDIT_STATUS_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* 错误态 */}
                      {creditError && (
                        <div className="flex items-center justify-between rounded-lg border p-4" style={{ borderColor: 'rgba(220,38,38,0.3)', backgroundColor: 'rgba(220,38,38,0.05)' }}>
                          <div className="flex items-center gap-2 text-sm" style={{ color: DANGER }}>
                            <AlertCircle className="h-4 w-4" />
                            <span>数据加载失败，请重试</span>
                          </div>
                          <button
                            onClick={() => creditRefetch()}
                            className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-red-100"
                            style={{ color: DANGER }}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            重试
                          </button>
                        </div>
                      )}

                      {/* 列表 */}
                      <div className="rounded-[12px] border bg-white" style={{ borderColor: '#E6EAF2' }}>
                        <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: '#EEF2F7' }}>
                          <span className="font-medium text-[15px]" style={{ color: '#0F172A' }}>
                            申请列表
                            {creditData && (
                              <span className="ml-2 text-[12px] font-normal" style={{ color: '#94A3B8' }}>
                                共 {creditData.total} 条
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="p-5">
                          {creditLoading && <CreditTableSkeleton />}

                          {!creditLoading && creditData && creditData.items.length === 0 && (
                            <EmptyState
                              icon={<Zap />}
                              description="暂无充值申请，客户提交充值申请后将在此显示"
                            />
                          )}

                          {!creditLoading && creditData && creditData.items.length > 0 && (
                            <>
                              <DataTable
                                rowKey="id"
                                data={creditData.items}
                                columns={[
                                  {
                                    key: 'brandName',
                                    title: '客户/品牌',
                                    width: '22%',
                                    render: (row: CreditRequestItem) => (
                                      <span
                                        className="font-medium text-[#0F172A] text-[13px] truncate block"
                                        title={row.brandName || ''}
                                      >
                                        {row.brandName || '-'}
                                      </span>
                                    ),
                                  },
                                  {
                                    key: 'packageName',
                                    title: '申请套餐',
                                    width: '18%',
                                    render: (row: CreditRequestItem) => (
                                      <span
                                        className="text-[13px] text-[#5B6B85] truncate block"
                                        title={row.packageName || ''}
                                      >
                                        {row.packageName || '-'}
                                      </span>
                                    ),
                                  },
                                  {
                                    key: 'amount',
                                    title: '申请算力',
                                    width: '15%',
                                    align: 'right',
                                    render: (row: CreditRequestItem) => (
                                      <span
                                        className="font-medium tabular-nums text-[13px]"
                                        style={{ color: PRIMARY }}
                                      >
                                        {row.amount !== null && row.amount !== undefined
                                          ? row.amount.toLocaleString('zh-CN')
                                          : '-'}
                                      </span>
                                    ),
                                  },
                                  {
                                    key: 'createdAt',
                                    title: '提交时间',
                                    width: '18%',
                                    render: (row: CreditRequestItem) => (
                                      <span className="text-[13px] text-[#5B6B85]">
                                        {formatDateTime(row.createdAt)}
                                      </span>
                                    ),
                                  },
                                  {
                                    key: 'status',
                                    title: '当前状态',
                                    width: '12%',
                                    render: (row: CreditRequestItem) => (
                                      <Pill variant={getCreditStatusVariant(row.status)}>
                                        {CREDIT_REQUEST_STATUS_LABELS[row.status]}
                                      </Pill>
                                    ),
                                  },
                                  {
                                    key: 'actions',
                                    title: '操作',
                                    width: '15%',
                                    align: 'right',
                                    render: (row: CreditRequestItem) =>
                                      row.status === 'pending' ? (
                                        <div className="flex items-center justify-end gap-2">
                                          <Button
                                            size="sm"
                                            onClick={() => openApproveDialog(row)}
                                            className="h-7"
                                            style={{ backgroundColor: SUCCESS }}
                                          >
                                            确认到账
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => openRejectDialog(row)}
                                            className="h-7"
                                          >
                                            驳回
                                          </Button>
                                        </div>
                                      ) : (
                                        <span className="text-[12px] text-[#94A3B8]">
                                          已处理
                                        </span>
                                      ),
                                  },
                                ]}
                              />
                              {creditData.total > reqPageSize && (
                                <div className="mt-4 flex justify-end">
                                  <DataPagination
                                    total={creditData.total}
                                    page={reqPage}
                                    pageSize={reqPageSize}
                                    onPageChange={handleReqPageChange}
                                    onPageSizeChange={(size) => {
                                      setReqPageSize(size);
                                      setReqPage(1);
                                    }}
                                  />
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>

                <Button
                  size="sm"
                  onClick={() => setCreateOpen(true)}
                  style={{ backgroundColor: PRIMARY }}
                >
                  <Plus className="h-4 w-4" />
                  新建客户
                </Button>
              </>
            )}
          </>
        }
      >
        {/* 筛选工具栏 */}
        <div className="mb-4">
          <Toolbar>
            <div className="relative w-[260px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索企业名/品牌/联系人/手机"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-9 pl-9"
              />
            </div>
            <Select value={industry} onValueChange={handleIndustryChange}>
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue placeholder="全部行业" />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={accountStatus} onValueChange={handleStatusChange}>
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue placeholder="全部状态" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={expiryStatus} onValueChange={handleExpiryStatusChange}>
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue placeholder="到期状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部</SelectItem>
                <SelectItem value="normal">正常</SelectItem>
                <SelectItem value="warning">即将到期</SelectItem>
                <SelectItem value="expired">已到期</SelectItem>
                <SelectItem value="unset">未设置</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={includeDemo ? 'withDemo' : 'real'}
              onValueChange={handleDataRangeChange}
            >
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue placeholder="数据范围" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="real">真实数据</SelectItem>
                <SelectItem value="withDemo">含演示数据</SelectItem>
              </SelectContent>
            </Select>
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
        {isLoading && <TableSkeleton />}

        {/* 空态 */}
        {isEmpty && (
          <EmptyState
            icon={<Building2 />}
            description="暂无客户数据，点击右上角「新建客户」开始添加"
          />
        )}

        {/* 表格 */}
        {!isLoading && data && filteredItems.length > 0 && (
          <DataTable
            rowKey="id"
            data={filteredItems}
            columns={[
              {
                key: 'companyName',
                title: '企业名称',
                width: '24%',
                render: (row: CustomerItem) => (
                  <div className="flex items-center gap-2">
                    {(/^1380000/.test(row.contactPhone || '') || /测试|演示/.test(row.remark || '')) && (
                      <Pill variant="muted">演示</Pill>
                    )}
                    <span
                      className="text-[13px] font-medium text-[#0F172A] truncate"
                      title={row.companyName || row.brandName}
                    >
                      {row.companyName || row.brandName}
                    </span>
                  </div>
                ),
              },
              {
                key: 'contactPerson',
                title: '联系人',
                width: '12%',
                render: (row: CustomerItem) => (
                  <span
                    className="text-[13px] text-[#5B6B85] truncate block"
                    title={row.contactPerson || ''}
                  >
                    {row.contactPerson || '—'}
                  </span>
                ),
              },
              {
                key: 'contactPhone',
                title: '手机',
                width: '14%',
                render: (row: CustomerItem) => (
                  <span
                    className="text-[13px] text-[#5B6B85] tabular-nums truncate block"
                    title={row.contactPhone || ''}
                  >
                    {row.contactPhone || '—'}
                  </span>
                ),
              },
              {
                key: 'packageType',
                title: '套餐',
                width: '15%',
                render: (row: CustomerItem) =>
                  row.packageType ? (
                    <div>
                      <div className="text-[13px] font-medium text-[#0F172A] truncate" title={PACKAGE_TYPE_SHORT_LABELS[row.packageType]}>
                        {PACKAGE_TYPE_SHORT_LABELS[row.packageType]}
                      </div>
                      <div className="text-[12px] tabular-nums mt-0.5 text-[#94A3B8]">
                        {formatCurrency(PACKAGE_PRICES[row.packageType])}
                      </div>
                    </div>
                  ) : (
                    <span className="text-[#94A3B8]">—</span>
                  ),
              },
              {
                key: 'creditBalance',
                title: '算力余额',
                width: '12%',
                align: 'right',
                render: (row: CustomerItem) => (
                  <span
                    className="tabular-nums font-medium text-[13px]"
                    style={{ color: PRIMARY }}
                  >
                    {row.creditBalance.toLocaleString('zh-CN')}
                  </span>
                ),
              },
              {
                key: 'status',
                title: '状态',
                width: '10%',
                render: (row: CustomerItem) => (
                  <Pill variant={getExpiryVariant(getExpiryStatus(row.serviceEnd))}>
                    {EXPIRY_STATUS_LABELS[getExpiryStatus(row.serviceEnd)]}
                  </Pill>
                ),
              },
              {
                key: 'actions',
                title: '操作',
                width: '13%',
                align: 'right',
                render: (row: CustomerItem) => (
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      className="text-[13px] hover:underline px-1.5 py-1 rounded"
                      onClick={() => openDetail(row)}
                      style={{ color: PRIMARY }}
                    >
                      详情
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="更多操作" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuLabel>
                          {row.brandName}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openDetail(row)}>
                          <Eye className="h-4 w-4" />
                          查看详情
                        </DropdownMenuItem>
                        {isAdmin && (
                          <>
                            <DropdownMenuItem onClick={() => openAdjustCredit(row)}>
                              <Zap className="h-4 w-4" />
                              调整算力
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openRenew(row)}>
                              <CreditCard className="h-4 w-4" />
                              续费
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openCreateUser(row)}
                              disabled={row.accountStatus === 'active'}
                            >
                              <Users className="h-4 w-4" />
                              用户管理
                            </DropdownMenuItem>
                            {row.accountStatus !== 'not_opened' && (
                              <DropdownMenuItem
                                onClick={() => handleToggleStatus(row)}
                                style={{
                                  color:
                                    row.accountStatus === 'active'
                                      ? DANGER
                                      : ACCENT,
                                }}
                              >
                                {row.accountStatus === 'active' ? (
                                  <>
                                    <ShieldOff className="h-4 w-4" />
                                    停用账号
                                  </>
                                ) : (
                                  <>
                                    <Shield className="h-4 w-4" />
                                    启用账号
                                  </>
                                )}
                              </DropdownMenuItem>
                            )}
                            {row.accountStatus !== 'not_opened' && (
                              <DropdownMenuItem onClick={() => handleResetPassword(row)}>
                                <RotateCcw className="h-4 w-4" />
                                重置密码
                              </DropdownMenuItem>
                            )}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ),
              },
            ]}
          />
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

      {/* 确认到账弹窗 */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认到账</DialogTitle>
            <DialogDescription>
              确认为 {selectedRequest?.brandName}{' '}
              充值{' '}
              {selectedRequest?.amount !== null &&
              selectedRequest?.amount !== undefined
                ? selectedRequest.amount.toLocaleString('zh-CN')
                : 0}{' '}
              算力？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleApproveConfirm}
              disabled={approveMutation.isPending}
              style={{ backgroundColor: SUCCESS }}
            >
              {approveMutation.isPending ? '处理中...' : '确认到账'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 驳回弹窗 */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>驳回申请</DialogTitle>
            <DialogDescription>
              请填写驳回原因（可选）
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="请输入驳回原因..."
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleRejectConfirm}
              disabled={rejectMutation.isPending}
              style={{ backgroundColor: DANGER }}
            >
              {rejectMutation.isPending ? '处理中...' : '确认驳回'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新建客户弹窗 */}
      <NewCustomerDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['customers'] });
        }}
      />

      {/* 开通账号弹窗 */}
      <CreateUserDialog
        open={createUserOpen}
        onOpenChange={setCreateUserOpen}
        brandId={selectedCustomer?.id || null}
        brandName={selectedCustomer?.brandName || null}
        defaultPhone={selectedCustomer?.contactPhone || ''}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['customers'] });
          queryClient.invalidateQueries({ queryKey: ['customerDetail'] });
        }}
      />

      {/* 调整算力弹窗 */}
      <AdjustCreditDialog
        open={adjustCreditOpen}
        onOpenChange={setAdjustCreditOpen}
        brandId={selectedCustomer?.id || null}
        brandName={selectedCustomer?.brandName || null}
        currentBalance={selectedCustomer?.creditBalance || 0}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['customers'] });
          queryClient.invalidateQueries({ queryKey: ['customerDetail'] });
        }}
      />

      {/* 客户详情抽屉 */}
      <CustomerDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        customerId={selectedCustomer?.id || null}
      />

      {/* 续费弹窗 */}
      <RenewCustomerDialog
        open={renewOpen}
        onOpenChange={setRenewOpen}
        brandId={selectedCustomer?.id || null}
        brandName={selectedCustomer?.brandName || null}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['customers'] });
          queryClient.invalidateQueries({ queryKey: ['customerDetail'] });
          queryClient.invalidateQueries({
            queryKey: ['admin-expiring-soon-count'],
          });
        }}
      />
    </div>
  );
};

const TableSkeleton = () => (
  <div className="space-y-1">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 h-11 px-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-20 ml-auto" />
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
    ))}
  </div>
);

const CreditTableSkeleton = () => (
  <div className="space-y-1">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 h-10 px-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="ml-auto h-4 w-20" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-24" />
      </div>
    ))}
  </div>
);

export default Customers;
