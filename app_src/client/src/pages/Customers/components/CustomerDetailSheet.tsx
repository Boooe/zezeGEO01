import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  User,
  Phone,
  MapPin,
  Globe,
  FileText,
  Package,
  Zap,
  Clock,
  AlertCircle,
  RefreshCw,
  Edit3,
  Tag,
  X,
  Check,
  Loader2,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@client/src/components/ui/sheet';
import { Badge } from '@client/src/components/ui/badge';
import { Button } from '@client/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { Separator } from '@client/src/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@client/src/components/ui/table';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@client/src/components/ui/empty';
import { getCustomerDetail, updateBrandHitWords } from '@client/src/api/customers';
import {
  INDUSTRY_LABELS,
  PACKAGE_TYPE_LABELS,
  USER_ROLE_LABELS,
  ACCOUNT_STATUS_LABELS,
  type CustomerDetail,
  type AccountStatus,
} from '@shared/api.interface';
import { toast } from 'sonner';

const PRIMARY = '#1e40af';
const SUCCESS = '#10b981';
const DANGER = '#ef4444';
const MUTED = '#64748b';

const getAccountStatusColor = (status: string): string => {
  switch (status) {
    case 'active':
      return SUCCESS;
    case 'disabled':
      return DANGER;
    default:
      return MUTED;
  }
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  return dateStr.slice(0, 10);
};

interface CustomerDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string | null;
}

const CustomerDetailSheet: React.FC<CustomerDetailSheetProps> = ({
  open,
  onOpenChange,
  customerId,
}) => {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['customerDetail', customerId],
    queryFn: () => {
      if (!customerId) throw new Error('缺少客户ID');
      return getCustomerDetail(customerId);
    },
    enabled: open && !!customerId,
  });

  const detail: CustomerDetail | undefined = data;

  const [showHitWordsEdit, setShowHitWordsEdit] = useState(false);
  const [hitWordsDraft, setHitWordsDraft] = useState('');

  const openHitWordsEdit = () => {
    if (!detail) return;
    setHitWordsText(detail.hitWords);
    setShowHitWordsEdit(true);
  };

  const setHitWordsText = (words: string[]) => {
    setHitWordsDraft(words.join('，'));
  };

  const hitWordsMutation = useMutation({
    mutationFn: (words: string[]) =>
      updateBrandHitWords(customerId!, words),
    onSuccess: () => {
      toast.success('命中词已更新');
      setShowHitWordsEdit(false);
      queryClient.invalidateQueries({ queryKey: ['customerDetail', customerId] });
      queryClient.invalidateQueries({ queryKey: ['brand-options'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || '保存失败');
    },
  });

  const handleSaveHitWords = () => {
    const words = hitWordsDraft
      .split(/[,，、\s\n]+/)
      .map((w) => w.trim())
      .filter(Boolean);
    hitWordsMutation.mutate(words);
  };

  const industryLabel = detail?.industry
    ? INDUSTRY_LABELS[detail.industry as keyof typeof INDUSTRY_LABELS] ||
      detail.industry
    : '-';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-lg font-semibold">
            客户详情
          </SheetTitle>
        </SheetHeader>

        {/* 错误态 */}
        {isError && (
          <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2 text-sm" style={{ color: DANGER }}>
              <AlertCircle className="h-4 w-4" />
              <span>加载失败</span>
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
        {isLoading && <DetailSkeleton />}

        {/* 详情内容 */}
        {!isLoading && !isError && detail && (
          <div className="space-y-6">
            {/* 企业基本信息 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" style={{ color: PRIMARY }} />
                <h3 className="text-sm font-semibold text-slate-800">
                  企业基本信息
                </h3>
              </div>
              <div className="space-y-2 rounded-lg border bg-slate-50/50 p-3 text-sm">
                <InfoRow
                  label="企业名称"
                  value={detail.companyName || '-'}
                />
                <InfoRow label="品牌名称" value={detail.name} />
                <InfoRow label="行业" value={industryLabel} />
                <InfoRow
                  label="联系人"
                  value={detail.contactPerson || '-'}
                  icon={<User className="h-3.5 w-3.5 text-muted-foreground" />}
                />
                <InfoRow
                  label="手机号"
                  value={detail.contactPhone || '-'}
                  icon={<Phone className="h-3.5 w-3.5 text-muted-foreground" />}
                />
                <InfoRow
                  label="地址"
                  value={detail.address || '-'}
                  icon={<MapPin className="h-3.5 w-3.5 text-muted-foreground" />}
                />
                <InfoRow
                  label="网站域名"
                  value={detail.domain || '-'}
                  icon={<Globe className="h-3.5 w-3.5 text-muted-foreground" />}
                />
                <InfoRow
                  label="备注"
                  value={detail.remark || '-'}
                  icon={<FileText className="h-3.5 w-3.5 text-muted-foreground" />}
                />
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">
                    <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                  <span className="w-20 shrink-0 text-xs text-muted-foreground">
                    命中词
                  </span>
                  <div className="flex-1">
                    {detail.hitWords?.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {detail.hitWords.map((w: string) => (
                          <Badge
                            key={w}
                            variant="outline"
                            className="text-xs font-normal"
                          >
                            {w}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">未设置</span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 shrink-0 px-2 text-xs"
                    onClick={openHitWordsEdit}
                  >
                    <Edit3 className="mr-1 h-3 w-3" />
                    编辑
                  </Button>
                </div>
              </div>
            </div>

            <Separator />

            {/* 套餐信息 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4" style={{ color: PRIMARY }} />
                <h3 className="text-sm font-semibold text-slate-800">
                  套餐信息
                </h3>
              </div>
              <div className="space-y-2 rounded-lg border bg-slate-50/50 p-3 text-sm">
                <InfoRow
                  label="套餐档位"
                  value={
                    detail.packageType
                      ? PACKAGE_TYPE_LABELS[detail.packageType]
                      : '-'
                  }
                />
                <InfoRow
                  label="到期日"
                  value={formatDate(detail.serviceEnd)}
                  icon={<Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                />
              </div>
            </div>

            <Separator />

            {/* 算力信息 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4" style={{ color: PRIMARY }} />
                <h3 className="text-sm font-semibold text-slate-800">
                  算力信息
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border bg-slate-50/50 p-3">
                  <p className="text-xs text-muted-foreground">当前余额</p>
                  <p className="mt-1 text-lg font-semibold" style={{ color: PRIMARY }}>
                    {detail.creditBalance.toLocaleString('zh-CN')}
                  </p>
                </div>
                <div className="rounded-lg border bg-slate-50/50 p-3">
                  <p className="text-xs text-muted-foreground">累计消耗</p>
                  <p className="mt-1 text-lg font-semibold text-slate-700">
                    —
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* 用户列表 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" style={{ color: PRIMARY }} />
                  <h3 className="text-sm font-semibold text-slate-800">
                    用户列表
                  </h3>
                </div>
                <span className="text-xs text-muted-foreground">
                  共 {detail.users.length} 个账号
                </span>
              </div>

              {detail.users.length === 0 ? (
                <Empty className="py-8">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <User className="h-5 w-5" />
                    </EmptyMedia>
                    <EmptyTitle>暂无账号</EmptyTitle>
                  </EmptyHeader>
                  <EmptyContent>
                    <EmptyDescription>
                      尚未开通任何客户账号
                    </EmptyDescription>
                  </EmptyContent>
                </Empty>
              ) : (
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">用户名</TableHead>
                        <TableHead className="text-xs">角色</TableHead>
                        <TableHead className="text-xs">状态</TableHead>
                        <TableHead className="text-xs">最近登录</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.users.map(
                        (u: CustomerDetail['users'][number]) => (
                          <TableRow key={u.id}>
                            <TableCell className="py-2 text-sm">
                              {u.username}
                            </TableCell>
                            <TableCell className="py-2 text-sm">
                              {USER_ROLE_LABELS[u.role] || u.role}
                            </TableCell>
                            <TableCell className="py-2">
                              <Badge
                                variant="outline"
                                className="text-xs font-medium"
                                style={{
                                  borderColor: 'transparent',
                                  backgroundColor: `${getAccountStatusColor(
                                    u.status,
                                  )}15`,
                                  color: getAccountStatusColor(u.status),
                                }}
                              >
                                {ACCOUNT_STATUS_LABELS[
                                  u.status as AccountStatus
                                ] || u.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2 text-xs text-muted-foreground">
                              {formatDate(u.lastLoginAt)}
                            </TableCell>
                          </TableRow>
                        ),
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 命中词编辑弹窗 */}
        <Dialog open={showHitWordsEdit} onOpenChange={setShowHitWordsEdit}>
          <DialogContent className="max-w-[480px]">
            <DialogHeader>
              <DialogTitle className="text-base">
                编辑命中词
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <textarea
                className="h-32 w-full rounded-md border border-gray-200 p-3 text-sm outline-none focus:border-blue-500"
                placeholder="多个词用逗号分隔，每行一个也可&#10;例如：&#10;星美蛋糕&#10;星美烘焙&#10;星美西点"
                value={hitWordsDraft}
                onChange={(e) => setHitWordsDraft(e.target.value)}
              />
              <p className="text-xs text-gray-400">
                AI 回答中出现任一词即判定为品牌提及，建议把简称、常见别名都写进来
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowHitWordsEdit(false)}
              >
                取消
              </Button>
              <Button
                onClick={handleSaveHitWords}
                disabled={hitWordsMutation.isPending}
              >
                {hitWordsMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    保存中
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    保存
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
};

const InfoRow: React.FC<{
  label: string;
  value: string;
  icon?: React.ReactNode;
}> = ({ label, value, icon }) => (
  <div className="flex items-start gap-2">
    {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
    <span className="w-20 shrink-0 text-xs text-muted-foreground">
      {label}
    </span>
    <span className="flex-1 break-words text-slate-700">{value}</span>
  </div>
);

const DetailSkeleton = () => (
  <div className="space-y-6">
    <div className="space-y-3">
      <Skeleton className="h-5 w-28" />
      <div className="space-y-2 rounded-lg border p-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
    </div>
    <div className="space-y-3">
      <Skeleton className="h-5 w-20" />
      <div className="space-y-2 rounded-lg border p-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    </div>
    <div className="space-y-3">
      <Skeleton className="h-5 w-20" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
      </div>
    </div>
    <div className="space-y-3">
      <Skeleton className="h-5 w-20" />
      <Skeleton className="h-32 rounded-lg" />
    </div>
  </div>
);

export default CustomerDetailSheet;
