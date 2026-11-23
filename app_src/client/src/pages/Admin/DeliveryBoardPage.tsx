import { useState } from 'react';
import {
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  Users,
  Activity,
  Clock,
  AlertTriangle,
  Search,
  RefreshCw,
  AlertCircle,
  FileText,
  Send,
  Zap,
  Edit3,
  BarChart3,
  Stethoscope,
  Target,
  ChevronRight,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';

import { Button } from '@client/src/components/ui/button';
import { PageHeader } from '@client/src/components/layout/PageHeader';
import { Input } from '@client/src/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@client/src/components/ui/card';
import { Badge } from '@client/src/components/ui/badge';
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@client/src/components/ui/sheet';
import {
  getDeliveryOverview,
  getBrandActivity,
} from '@client/src/api/admin';
import type {
  DeliveryBrandItem,
  DeliveryStatus,
  CustomerExpiryStatus,
  ActivityTimelineItem,
} from '@shared/api.interface';

const PRIMARY = '#3B5BFF';
const SUCCESS = '#17C964';
const WARNING = '#FFA940';
const DANGER = '#FF5C5C';
const MUTED = '#64748b';
const GREY = '#94A3B8';

const DELIVERY_STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'normal', label: '正常' },
  { value: 'lagging', label: '滞后' },
  { value: 'stagnant', label: '停滞' },
];

const SORT_OPTIONS = [
  { value: 'lastActivity', label: '最近活动' },
  { value: 'expiry', label: '到期日' },
  { value: 'monthlyArticles', label: '本月文章数' },
];

const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  normal: '正常',
  lagging: '滞后',
  stagnant: '停滞',
};

const getDeliveryColor = (status: DeliveryStatus): string => {
  switch (status) {
    case 'normal':
      return SUCCESS;
    case 'lagging':
      return WARNING;
    case 'stagnant':
      return DANGER;
    default:
      return MUTED;
  }
};

const EXPIRY_STATUS_LABELS: Record<CustomerExpiryStatus, string> = {
  normal: '正常',
  warning: '即将到期',
  expired: '已到期',
  unset: '未设置',
};

const getExpiryColor = (status: CustomerExpiryStatus): string => {
  switch (status) {
    case 'normal':
      return SUCCESS;
    case 'warning':
      return WARNING;
    case 'expired':
      return DANGER;
    case 'unset':
      return GREY;
    default:
      return GREY;
  }
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  return dateStr.replace('T', ' ').slice(0, 16);
};

const getActivityIcon = (type: ActivityTimelineItem['type']) => {
  switch (type) {
    case 'diagnosis':
      return <Stethoscope className="h-3.5 w-3.5" />;
    case 'article':
      return <Edit3 className="h-3.5 w-3.5" />;
    case 'publish':
      return <Send className="h-3.5 w-3.5" />;
    case 'recharge':
    case 'adjustment':
      return <Zap className="h-3.5 w-3.5" />;
    case 'keyword':
      return <BarChart3 className="h-3.5 w-3.5" />;
    default:
      return <Activity className="h-3.5 w-3.5" />;
  }
};

const getActivityColor = (type: ActivityTimelineItem['type']): string => {
  switch (type) {
    case 'diagnosis':
      return '#8B5CF6';
    case 'article':
      return PRIMARY;
    case 'publish':
      return SUCCESS;
    case 'recharge':
    case 'adjustment':
      return WARNING;
    case 'keyword':
      return '#06B6D4';
    default:
      return MUTED;
  }
};

const DeliveryBoardPage = () => {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const pageSize = 9;
  const [keyword, setKeyword] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [deliveryStatus, setDeliveryStatus] = useState('');
  const [sortBy, setSortBy] = useState('lastActivity');

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] =
    useState<DeliveryBrandItem | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [
      'admin-delivery-overview',
      page,
      pageSize,
      keyword,
      deliveryStatus,
      sortBy,
    ],
    queryFn: () =>
      getDeliveryOverview({
        page,
        pageSize,
        keyword: keyword || undefined,
        deliveryStatus: deliveryStatus || undefined,
        sortBy,
        sortOrder: 'desc',
      }),
  });

  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ['admin-brand-activity', selectedBrand?.brandId],
    queryFn: () =>
      getBrandActivity(selectedBrand!.brandId, { limit: 10 }),
    enabled: !!selectedBrand && detailOpen,
  });

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  const handleSearch = () => {
    setKeyword(keywordInput.trim());
    setPage(1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleStatusChange = (value: string) => {
    setDeliveryStatus(value);
    setPage(1);
  };

  const handleSortChange = (value: string) => {
    setSortBy(value);
    setPage(1);
  };

  const openDetail = (brand: DeliveryBrandItem) => {
    setSelectedBrand(brand);
    setDetailOpen(true);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const renderPaginationItems = () => {
    const items: React.ReactNode[] = [];
    const maxVisible = 5;
    let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
    const endPage = Math.min(totalPages, startPage + maxVisible - 1);
    startPage = Math.max(1, endPage - maxVisible + 1);

    for (let i = startPage; i <= endPage; i++) {
      items.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={`flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors ${
            i === page
              ? 'font-medium text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          style={
            i === page ? { backgroundColor: PRIMARY } : undefined
          }
        >
          {i}
        </button>,
      );
    }
    return items;
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <PageHeader
        title="交付看板"
        description="查看所有客户交付状态与活动情况"
      />

      {/* 顶部指标卡 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card
                key={i}
                style={{
                  borderRadius: '12px',
                  border: '1px solid #E5E9F2',
                  boxShadow: 'none',
                }}
              >
                <CardContent className="pt-6">
                  <Skeleton className="mb-3 h-4 w-20" />
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))
          : (
              <>
                <StatCard
                  icon={<Users className="h-5 w-5" />}
                  label="在服务客户数"
                  value={data?.activeCustomers ?? 0}
                  color={PRIMARY}
                />
                <StatCard
                  icon={<Activity className="h-5 w-5" />}
                  label="本月有产出客户数"
                  value={data?.producingCustomers ?? 0}
                  color={SUCCESS}
                />
                <StatCard
                  icon={<Clock className="h-5 w-5" />}
                  label="滞后客户数"
                  value={data?.laggingCustomers ?? 0}
                  color={WARNING}
                />
                <StatCard
                  icon={<AlertTriangle className="h-5 w-5" />}
                  label="停滞客户数"
                  value={data?.stagnantCustomers ?? 0}
                  color={DANGER}
                />
              </>
            )}
      </div>

      {isError && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4">
          <div
            className="flex items-center gap-2 text-sm"
            style={{ color: DANGER }}
          >
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

      {/* 筛选栏 */}
      <Card
        style={{
          borderRadius: '12px',
          border: '1px solid #E5E9F2',
          boxShadow: 'none',
        }}
      >
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="搜索品牌/企业名"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="pl-9"
                />
              </div>
              <Select
                value={deliveryStatus}
                onValueChange={handleStatusChange}
              >
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="交付状态" />
                </SelectTrigger>
                <SelectContent>
                  {DELIVERY_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={handleSortChange}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="排序方式" />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 客户卡片网格 */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card
              key={i}
              style={{
                borderRadius: '12px',
                border: '1px solid #E5E9F2',
                boxShadow: 'none',
              }}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-5 w-12" />
                </div>
                <Skeleton className="mt-4 h-3 w-20" />
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-5 w-12" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : data && data.items.length === 0 ? (
        <Card
          style={{
            borderRadius: '12px',
            border: '1px solid #E5E9F2',
            boxShadow: 'none',
          }}
        >
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">暂无客户数据</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data?.items.map((brand: DeliveryBrandItem) => (
              <Card
                key={brand.brandId}
                className="cursor-pointer transition-all hover:border-blue-300 hover:shadow-sm"
                style={{
                  borderRadius: '12px',
                  border: '1px solid #E5E9F2',
                  boxShadow: 'none',
                }}
                onClick={() => openDetail(brand)}
              >
                <CardContent className="p-5">
                  {/* 顶部：品牌名 + 到期状态 */}
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h3
                        className="truncate text-base font-semibold"
                        style={{ color: '#0f172a' }}
                      >
                        {brand.brandName}
                      </h3>
                      <p className="mt-0.5 truncate text-xs text-slate-400">
                        {brand.companyName || '-'}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="ml-2 shrink-0 font-medium"
                      style={{
                        borderColor: 'transparent',
                        backgroundColor: `${getExpiryColor(brand.expiryStatus)}15`,
                        color: getExpiryColor(brand.expiryStatus),
                      }}
                    >
                      {EXPIRY_STATUS_LABELS[brand.expiryStatus]}
                    </Badge>
                  </div>

                  {/* 中部指标 */}
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <MetricItem
                      icon={<Stethoscope className="h-3.5 w-3.5" />}
                      label="诊断次数"
                      value={brand.diagnosisCount}
                    />
                    <MetricItem
                      icon={<FileText className="h-3.5 w-3.5" />}
                      label="关键词数"
                      value={brand.keywordCount}
                    />
                    <MetricItem
                      icon={<Edit3 className="h-3.5 w-3.5" />}
                      label="本月文章"
                      value={brand.monthlyArticles}
                      color={PRIMARY}
                    />
                    <MetricItem
                      icon={<Target className="h-3.5 w-3.5" />}
                      label="命中率"
                      value={brand.keywordHitRate}
                      suffix="%"
                      color={SUCCESS}
                    />
                    <MetricItem
                      icon={<Send className="h-3.5 w-3.5" />}
                      label="本月发布"
                      value={brand.monthlyPublications}
                      color={SUCCESS}
                    />
                  </div>

                  {/* 底部：最近活动 + 交付状态 */}
                  <div className="mt-4 flex items-center justify-between border-t pt-3" style={{ borderColor: '#F1F5F9' }}>
                    <div className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
                      <Clock className="h-3 w-3" />
                      <span>
                        {brand.lastActivityAt
                          ? formatDate(brand.lastActivityAt)
                          : '暂无活动'}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className="font-medium"
                      style={{
                        borderColor: 'transparent',
                        backgroundColor: `${getDeliveryColor(brand.deliveryStatus)}15`,
                        color: getDeliveryColor(brand.deliveryStatus),
                      }}
                    >
                      {DELIVERY_STATUS_LABELS[brand.deliveryStatus]}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 分页 */}
          {data && data.items.length > 0 && totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 pt-2">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4 rotate-180" />
              </button>
              {renderPaginationItems()}
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* 客户详情抽屉 */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0">
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b px-6 pb-4 pt-6" style={{ borderColor: '#E5E9F2' }}>
              <SheetTitle className="text-lg">
                {selectedBrand?.brandName || '客户详情'}
              </SheetTitle>
              <SheetDescription>
                {selectedBrand?.companyName || '-'}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto">
              {/* 基本信息 */}
              <div className="border-b px-6 py-4" style={{ borderColor: '#F1F5F9' }}>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-xs" style={{ color: MUTED }}>
                      当前套餐
                    </div>
                    <div className="mt-1 font-medium text-slate-800">
                      {selectedBrand?.planName || '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs" style={{ color: MUTED }}>
                      到期状态
                    </div>
                    <div className="mt-1">
                      {selectedBrand && (
                        <Badge
                          variant="outline"
                          className="font-medium"
                          style={{
                            borderColor: 'transparent',
                            backgroundColor: `${getExpiryColor(selectedBrand.expiryStatus)}15`,
                            color: getExpiryColor(selectedBrand.expiryStatus),
                          }}
                        >
                          {EXPIRY_STATUS_LABELS[selectedBrand.expiryStatus]}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 活动时间线 */}
              <div className="px-6 py-4">
                <h4 className="mb-4 text-sm font-semibold" style={{ color: '#0f172a' }}>
                  最近活动
                </h4>

                {activityLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex gap-3">
                        <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
                        <div className="flex-1 space-y-1">
                          <Skeleton className="h-3 w-24" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : activityData?.items?.length ? (
                  <div className="relative">
                    {activityData.items.map(
                      (item: ActivityTimelineItem, idx: number) => {
                        const isLast =
                          idx === activityData.items.length - 1;
                        const iconColor = getActivityColor(item.type);
                        return (
                          <div key={item.id} className="flex gap-3">
                            {/* 时间线圆点 + 竖线 */}
                            <div className="relative flex flex-col items-center">
                              <div
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
                                style={{ backgroundColor: iconColor }}
                              >
                                {getActivityIcon(item.type)}
                              </div>
                              {!isLast && (
                                <div
                                  className="w-px flex-1"
                                  style={{
                                    backgroundColor: '#E5E9F2',
                                    marginTop: '4px',
                                  }}
                                />
                              )}
                            </div>
                            {/* 内容 */}
                            <div
                              className={`flex-1 pb-5 ${isLast ? '' : ''}`}
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <div
                                    className="text-xs font-medium"
                                    style={{ color: iconColor }}
                                  >
                                    {item.typeLabel}
                                  </div>
                                  <div className="mt-1 text-sm font-medium text-slate-800">
                                    {item.title}
                                  </div>
                                </div>
                                {item.amount !== undefined && (
                                  <div
                                    className="text-sm font-medium tnum"
                                    style={{ color: PRIMARY }}
                                  >
                                    {item.amount.toLocaleString('zh-CN')}
                                  </div>
                                )}
                              </div>
                              <div
                                className="mt-1 text-xs"
                                style={{ color: MUTED }}
                              >
                                {formatDate(item.createdAt)}
                              </div>
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                ) : (
                  <div className="py-8 text-center text-sm text-slate-400">
                    暂无活动记录
                  </div>
                )}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color }) => (
  <Card
    style={{
      borderRadius: '12px',
      border: '1px solid #E5E9F2',
      boxShadow: 'none',
    }}
  >
    <CardContent className="pt-6">
      <div className="flex items-center gap-2 text-sm" style={{ color: MUTED }}>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}10`, color }}
        >
          {icon}
        </div>
        <span>{label}</span>
      </div>
      <div
        className="mt-3 text-2xl font-bold tnum"
        style={{ color: '#0f172a' }}
      >
        {value.toLocaleString('zh-CN')}
      </div>
    </CardContent>
  </Card>
);

interface MetricItemProps {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  suffix?: string;
  color?: string;
}

const MetricItem: React.FC<MetricItemProps> = ({ icon, label, value, suffix, color = '#64748b' }) => (
  <div
    className="rounded-lg p-2.5"
    style={{ backgroundColor: '#F7F9FC' }}
  >
    <div className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
      <span style={{ color }}>{icon}</span>
      <span>{label}</span>
    </div>
    <div
      className="mt-1 text-base font-semibold tnum"
      style={{ color: '#0f172a' }}
    >
      {value != null ? `${value.toLocaleString('zh-CN')}${suffix ?? ''}` : '—'}
    </div>
  </div>
);

export default DeliveryBoardPage;
