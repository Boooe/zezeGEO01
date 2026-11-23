import { useMemo, useState } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  AlertCircle,
  RefreshCw,
  Package,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';

import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import { Textarea } from '@client/src/components/ui/textarea';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@client/src/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@client/src/components/ui/table';
import { ColumnResizeHandle } from '@client/src/components/ui/column-resize-handle';
import { useResizableColumns } from '@client/src/hooks/use-resizable-columns';
import { Badge } from '@client/src/components/ui/badge';
import { Pill } from '@client/src/components/layout/Pill';
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@client/src/components/ui/empty';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@client/src/components/ui/pagination';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@client/src/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@client/src/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { Switch } from '@client/src/components/ui/switch';
import { useAuth } from '@client/src/contexts/AuthContext';
import { PageHeader } from '@client/src/components/layout/PageHeader';
import {
  getPlans,
  createPlan,
  updatePlan,
  deletePlan,
} from '@client/src/api/admin';
import type { PlanItem, PlanUpsertRequest } from '@shared/api.interface';

const PRIMARY = '#2E7DFF';
const SUCCESS = '#10B981';
const MUTED = '#94A3B8';
const DANGER = '#EF4444';

const PLANS_COL_DEFAULTS: Record<string, number> = {
  sort: 40,
  planName: 120,
  planCode: 90,
  price: 80,
  credit: 80,
  validity: 70,
  dailyLimit: 100,
  unitPrice: 95,
  status: 65,
  actions: 80,
};

const PlansPage = () => {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const queryClient = useQueryClient();

  const {
    getThStyle,
    getTdStyle,
    getTableStyle,
    handleResizeStart,
    resetColumn,
    resetAll,
    isResizing,
  } = useResizableColumns({
    tableKey: 'plans',
    defaultWidths: PLANS_COL_DEFAULTS,
    userId: user?.id || 'guest',
    defaultVersion: 4,
  });

  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanItem | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingPlan, setDeletingPlan] = useState<PlanItem | null>(null);

  const [formData, setFormData] = useState<PlanUpsertRequest>({
    planName: '',
    planCode: '',
    price: 0,
    creditAmount: 0,
    validityMonths: 12,
    dailyPublishLimit: 10,
    unitPrice: 0,
    description: '',
    isActive: true,
    sortOrder: 0,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-plans', page, pageSize],
    queryFn: () => getPlans({ page, pageSize }),
  });

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  const createMutation = useMutation({
    mutationFn: (body: PlanUpsertRequest) => createPlan(body),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
      toast.success('套餐创建成功');
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: unknown) => {
      logger.error('创建套餐失败', err);
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          .response?.data?.error?.message || '创建失败，请重试';
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: PlanUpsertRequest }) =>
      updatePlan(id, body),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
      toast.success('套餐更新成功');
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: unknown) => {
      logger.error('更新套餐失败', err);
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          .response?.data?.error?.message || '更新失败，请重试';
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePlan(id),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
      toast.success('套餐已删除');
      setDeleteOpen(false);
      setDeletingPlan(null);
    },
    onError: (err: unknown) => {
      logger.error('删除套餐失败', err);
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          .response?.data?.error?.message || '删除失败，请重试';
      toast.error(msg);
    },
  });

  const resetForm = () => {
    setFormData({
      planName: '',
      planCode: '',
      price: 0,
      creditAmount: 0,
      validityMonths: 12,
      dailyPublishLimit: 10,
      unitPrice: 0,
      description: '',
      isActive: true,
      sortOrder: 0,
    });
    setErrors({});
    setEditingPlan(null);
  };

  const handleCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleEdit = (plan: PlanItem) => {
    setEditingPlan(plan);
    setFormData({
      planName: plan.planName,
      planCode: plan.planCode,
      price: plan.price,
      creditAmount: plan.creditAmount,
      validityMonths: plan.validityMonths,
      dailyPublishLimit: plan.dailyPublishLimit,
      unitPrice: plan.unitPrice,
      description: plan.description ?? '',
      isActive: plan.isActive,
      sortOrder: plan.sortOrder,
    });
    setErrors({});
    setDialogOpen(true);
  };

  const handleDelete = (plan: PlanItem) => {
    setDeletingPlan(plan);
    setDeleteOpen(true);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.planName.trim()) newErrors.planName = '请输入套餐名称';
    if (!formData.planCode.trim()) newErrors.planCode = '请输入套餐编码';
    if (formData.price < 0) newErrors.price = '价格不能为负';
    if (formData.creditAmount < 0) newErrors.creditAmount = '算力不能为负';
    if (formData.validityMonths <= 0)
      newErrors.validityMonths = '有效期必须大于0';
    if (formData.dailyPublishLimit < 1 || formData.dailyPublishLimit > 100)
      newErrors.dailyPublishLimit = '每日发布上限范围 1-100';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const body: PlanUpsertRequest = {
      ...formData,
      description: formData.description || undefined,
    };

    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, body });
    } else {
      createMutation.mutate(body);
    }
  };

  const handleConfirmDelete = () => {
    if (!deletingPlan) return;
    deleteMutation.mutate(deletingPlan.id);
  };

  const renderPaginationItems = useMemo(() => {
    const items: React.ReactNode[] = [];
    const maxVisible = 5;
    let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
    const endPage = Math.min(totalPages, startPage + maxVisible - 1);
    startPage = Math.max(1, endPage - maxVisible + 1);

    for (let i = startPage; i <= endPage; i++) {
      items.push(
        <PaginationItem key={i}>
          <PaginationLink
            href="#"
            isActive={i === page}
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              setPage(i);
            }}
          >
            {i}
          </PaginationLink>
        </PaginationItem>,
      );
    }
    return items;
  }, [page, totalPages]);

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <PageHeader
        title="套餐管理"
        subtitle="管理可售套餐、价格和算力配置"
        actions={
          isAdmin && (
            <Button
              onClick={handleCreate}
              style={{ backgroundColor: PRIMARY }}
            >
              <Plus className="h-4 w-4" />
              新建套餐
            </Button>
          )
        }
      />

      {/* 错误态 */}
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

      {/* 表格卡片 */}
      <Card
        style={{
          borderRadius: '12px',
          border: '1px solid #E5E9F2',
          boxShadow: 'none',
        }}
      >
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="font-semibold">
            套餐列表
            {data && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                共 {data.total} 个
              </span>
            )}
          </CardTitle>
          <button
            type="button"
            onClick={resetAll}
            className="text-[12px] transition-colors hover:underline"
            style={{ color: '#64748b' }}
          >
            重置列宽
          </button>
        </CardHeader>
        <CardContent>
          {isLoading && <TableSkeleton />}

          {!isLoading && data && data.items.length === 0 && (
            <Empty className="min-h-[200px] py-8">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Package />
                </EmptyMedia>
                <EmptyTitle>暂无套餐</EmptyTitle>
                <EmptyDescription>点击右上角新建套餐开始添加</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {!isLoading && data && data.items.length > 0 && (
            <div className="overflow-x-auto">
              <Table className="table-fixed" style={getTableStyle()}>
                <TableHeader style={{ backgroundColor: '#F7F9FC' }}>
                  <TableRow>
                    <TableHead data-col="planName" style={{ ...getThStyle('planName'), whiteSpace: 'normal' }}>
                      套餐名称
                      <ColumnResizeHandle
                        onResizeStart={(e) => handleResizeStart('planName', e)}
                        onDoubleClick={() => resetColumn('planName')}
                        isResizing={isResizing}
                      />
                    </TableHead>
                    <TableHead data-col="planCode" style={{ ...getThStyle('planCode'), whiteSpace: 'normal' }}>
                      套餐编码
                      <ColumnResizeHandle
                        onResizeStart={(e) => handleResizeStart('planCode', e)}
                        onDoubleClick={() => resetColumn('planCode')}
                        isResizing={isResizing}
                      />
                    </TableHead>
                    <TableHead data-col="price" className="text-right" style={{ ...getThStyle('price'), whiteSpace: 'normal' }}>
                      价格（元）
                      <ColumnResizeHandle
                        onResizeStart={(e) => handleResizeStart('price', e)}
                        onDoubleClick={() => resetColumn('price')}
                        isResizing={isResizing}
                      />
                    </TableHead>
                    <TableHead data-col="credit" className="text-right" style={{ ...getThStyle('credit'), whiteSpace: 'normal' }}>
                      含算力
                      <ColumnResizeHandle
                        onResizeStart={(e) => handleResizeStart('credit', e)}
                        onDoubleClick={() => resetColumn('credit')}
                        isResizing={isResizing}
                      />
                    </TableHead>
                    <TableHead data-col="validity" className="text-right" style={{ ...getThStyle('validity'), whiteSpace: 'normal' }}>
                      有效期（月）
                      <ColumnResizeHandle
                        onResizeStart={(e) => handleResizeStart('validity', e)}
                        onDoubleClick={() => resetColumn('validity')}
                        isResizing={isResizing}
                      />
                    </TableHead>
                    <TableHead data-col="dailyLimit" className="text-right" style={{ ...getThStyle('dailyLimit'), whiteSpace: 'normal' }}>
                      每日发布上限
                      <ColumnResizeHandle
                        onResizeStart={(e) => handleResizeStart('dailyLimit', e)}
                        onDoubleClick={() => resetColumn('dailyLimit')}
                        isResizing={isResizing}
                      />
                    </TableHead>
                    <TableHead data-col="unitPrice" className="text-right" style={{ ...getThStyle('unitPrice'), whiteSpace: 'normal' }}>
                      单价（元/万算力）
                      <ColumnResizeHandle
                        onResizeStart={(e) => handleResizeStart('unitPrice', e)}
                        onDoubleClick={() => resetColumn('unitPrice')}
                        isResizing={isResizing}
                      />
                    </TableHead>
                    <TableHead data-col="status" style={{ ...getThStyle('status'), whiteSpace: 'normal' }}>
                      状态
                      <ColumnResizeHandle
                        onResizeStart={(e) => handleResizeStart('status', e)}
                        onDoubleClick={() => resetColumn('status')}
                        isResizing={isResizing}
                      />
                    </TableHead>
                    <TableHead data-col="sort" className="text-right" style={{ ...getThStyle('sort'), whiteSpace: 'normal' }}>
                      排序
                      <ColumnResizeHandle
                        onResizeStart={(e) => handleResizeStart('sort', e)}
                        onDoubleClick={() => resetColumn('sort')}
                        isResizing={isResizing}
                      />
                    </TableHead>
                    <TableHead data-col="actions" className="text-right sticky right-0 bg-[#F7F9FC] z-10 shadow-[-1px_0_0_0_#E5E9F2]" style={{ ...getThStyle('actions'), whiteSpace: 'normal' }}>
                      操作
                      <ColumnResizeHandle
                        onResizeStart={(e) => handleResizeStart('actions', e)}
                        onDoubleClick={() => resetColumn('actions')}
                        isResizing={isResizing}
                      />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((plan: PlanItem) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-medium text-slate-800" style={getTdStyle('planName')}>
                        {plan.planName}
                      </TableCell>
                      <TableCell className="text-slate-600" style={getTdStyle('planCode')}>
                        {plan.planCode}
                      </TableCell>
                      <TableCell className="text-right tnum" style={getTdStyle('price')}>
                        ¥{plan.price.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right tnum" style={{ ...getTdStyle('credit'), color: PRIMARY }}>
                        {plan.creditAmount.toLocaleString('zh-CN')}
                      </TableCell>
                      <TableCell className="text-right tnum" style={getTdStyle('validity')}>
                        {plan.validityMonths}
                      </TableCell>
                      <TableCell className="text-right tnum" style={getTdStyle('dailyLimit')}>
                        {plan.dailyPublishLimit} 篇/日
                      </TableCell>
                      <TableCell className="text-right tnum text-slate-600" style={getTdStyle('unitPrice')}>
                        {plan.unitPrice > 0
                          ? `¥${plan.unitPrice.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : '-'}
                      </TableCell>
                      <TableCell style={getTdStyle('status')}>
                        <Pill variant={plan.isActive ? 'success' : 'muted'}>
                          {plan.isActive ? '启用' : '停用'}
                        </Pill>
                      </TableCell>
                      <TableCell className="text-right tnum text-slate-600" style={getTdStyle('sort')}>
                        {plan.sortOrder}
                      </TableCell>
                      <TableCell className="text-right sticky right-0 bg-white z-10 shadow-[-1px_0_0_0_#E5E9F2]" style={getTdStyle('actions')}>
                        {isAdmin && (
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
                            <DropdownMenuContent align="end" className="w-32">
                              <DropdownMenuItem onClick={() => handleEdit(plan)}>
                                <Pencil className="h-4 w-4" />
                                编辑
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(plan)}
                                style={{ color: DANGER }}
                              >
                                <Trash2 className="h-4 w-4" />
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {!isLoading && data && data.items.length > 0 && totalPages > 1 && (
            <div className="mt-4">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e: React.MouseEvent) => {
                        e.preventDefault();
                        if (page > 1) setPage(page - 1);
                      }}
                      aria-disabled={page <= 1}
                      className={
                        page <= 1
                          ? 'pointer-events-none opacity-50'
                          : ''
                      }
                    />
                  </PaginationItem>
                  {renderPaginationItems}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e: React.MouseEvent) => {
                        e.preventDefault();
                        if (page < totalPages) setPage(page + 1);
                      }}
                      aria-disabled={page >= totalPages}
                      className={
                        page >= totalPages
                          ? 'pointer-events-none opacity-50'
                          : ''
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 新建/编辑弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPlan ? '编辑套餐' : '新建套餐'}
            </DialogTitle>
            <DialogDescription>
              填写套餐基本信息和价格配置
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  套餐名称 <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={formData.planName}
                  onChange={(e) =>
                    setFormData({ ...formData, planName: e.target.value })
                  }
                  placeholder="如：基础版"
                />
                {errors.planName && (
                  <p className="text-xs text-red-500">{errors.planName}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>
                  套餐编码 <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={formData.planCode}
                  onChange={(e) =>
                    setFormData({ ...formData, planCode: e.target.value })
                  }
                  placeholder="如：basic_v1"
                />
                {errors.planCode && (
                  <p className="text-xs text-red-500">{errors.planCode}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  价格（元） <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      price: Number(e.target.value) || 0,
                    })
                  }
                />
                {errors.price && (
                  <p className="text-xs text-red-500">{errors.price}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>
                  含算力 <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.creditAmount}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      creditAmount: Number(e.target.value) || 0,
                    })
                  }
                />
                {errors.creditAmount && (
                  <p className="text-xs text-red-500">
                    {errors.creditAmount}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  有效期（月） <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.validityMonths}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      validityMonths: Number(e.target.value) || 0,
                    })
                  }
                />
                {errors.validityMonths && (
                  <p className="text-xs text-red-500">
                    {errors.validityMonths}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>单价（元/万算力）</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.unitPrice}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      unitPrice: Number(e.target.value) || 0,
                    })
                  }
                  placeholder="可选，用于核算"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  每日发布上限（篇/日） <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.dailyPublishLimit}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      dailyPublishLimit: Number(e.target.value) || 1,
                    })
                  }
                />
                {errors.dailyPublishLimit && (
                  <p className="text-xs text-red-500">
                    {errors.dailyPublishLimit}
                  </p>
                )}
              </div>
              <div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="套餐说明（选填）"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between rounded-md border p-3" style={{ borderColor: '#E5E9F2' }}>
                <Label className="!mb-0">是否启用</Label>
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked: boolean) =>
                    setFormData({ ...formData, isActive: checked })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>排序</Label>
                <Input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      sortOrder: Number(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isSubmitting}
            >
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              style={{ backgroundColor: PRIMARY }}
            >
              {isSubmitting
                ? '保存中...'
                : editingPlan
                ? '保存修改'
                : '创建套餐'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除套餐「{deletingPlan?.planName}」吗？此操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteMutation.isPending}
            >
              取消
            </Button>
            <Button
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
              style={{ backgroundColor: DANGER }}
            >
              {deleteMutation.isPending ? '删除中...' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const TableSkeleton = () => (
  <div className="space-y-2 py-2">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 py-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="ml-auto h-4 w-20" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-6 w-10" />
      </div>
    ))}
  </div>
);

export default PlansPage;
