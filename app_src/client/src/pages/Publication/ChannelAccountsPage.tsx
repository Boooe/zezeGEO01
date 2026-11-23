import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  Play,
  Pause,
  Link2Off,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
} from 'lucide-react';
import {
  Card,
  CardContent,
} from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { TableShell } from '@client/src/components/ui/table-shell';
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
import { PageHeader } from '@client/src/components/layout/PageHeader';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogDescription,
} from '@client/src/components/ui/dialog';
import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
import {
  list,
  create,
  update,
  remove,
  test,
} from '@client/src/api/channels';
import { getBrands } from '@client/src/api/brands';
import { useAuth } from '@client/src/hooks/useAuth';
import {
  CHANNEL_PLATFORMS,
  CHANNEL_PLATFORM_LABELS,
  CHANNEL_STATUSES,
  CHANNEL_STATUS_LABELS,
  CHANNEL_BIND_STATUSES,
  CHANNEL_BIND_STATUS_LABELS,
  CHANNEL_PUBLISH_MODES,
  CHANNEL_PUBLISH_MODE_LABELS,
} from '@shared/api.interface';
import type {
  Channel,
  ChannelPlatform,
  ChannelStatus,
  ChannelBindStatus,
  ChannelPublishMode,
  CreateChannelRequest,
} from '@shared/api.interface';
import { formatDate } from 'date-fns';

const PRIMARY = '#1e40af';
const DANGER = '#ef4444';
const SUCCESS = '#10b981';
const WARNING = '#f97316';
const MUTED = '#64748b';

const PAGE_SIZE = 10;

const BIND_STATUS_COLORS: Record<
  ChannelBindStatus,
  { bg: string; color: string }
> = {
  bound: { bg: 'rgba(16, 185, 129, 0.1)', color: SUCCESS },
  unbound: { bg: 'rgba(100, 116, 139, 0.1)', color: MUTED },
  expired: { bg: 'rgba(249, 115, 22, 0.1)', color: WARNING },
};

const STATUS_COLORS: Record<ChannelStatus, { bg: string; color: string }> = {
  active: { bg: 'rgba(16, 185, 129, 0.1)', color: SUCCESS },
  paused: { bg: 'rgba(100, 116, 139, 0.1)', color: MUTED },
};

const PLATFORM_COLORS: Record<ChannelPlatform, string> = {
  baijiahao: '#3b82f6',
  toutiao: '#ef4444',
  zhihu: '#0ea5e9',
  xiaohongshu: '#ec4899',
  wechat: '#22c55e',
  website: '#64748b',
};

const ChannelAccountsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isClient = user?.role === 'client';

  const [page, setPage] = useState(1);
  const [platformFilter, setPlatformFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const {
    data: channelsData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['channels', page, platformFilter, statusFilter],
    queryFn: () =>
      list({
        page,
        pageSize: PAGE_SIZE,
        platform: (platformFilter || undefined) as
          | ChannelPlatform
          | undefined,
        status: (statusFilter || undefined) as ChannelStatus | undefined,
        brandId: isClient && user?.brandId
          ? user.brandId
          : undefined,
      }),
    retry: 2,
    retryDelay: 2000,
  });

  const { data: brandOptions = [] } = useQuery({
    queryKey: ['brands', 'options'],
    queryFn: () => getBrands(),
    retry: 2,
    retryDelay: 2000,
    enabled: !isClient,
  });

  const totalPages = useMemo(() => {
    if (!channelsData) return 1;
    return Math.max(1, Math.ceil(channelsData.total / PAGE_SIZE));
  }, [channelsData]);

  /* ---------- 新增弹窗 ---------- */
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateChannelRequest>({
    platform: 'baijiahao',
    accountName: '',
    brandId: isClient ? user?.brandId || '' : '',
    publishMode: 'local_auto',
    dailyLimit: 3,
    remark: '',
  });

  const createMutation = useMutation({
    mutationFn: create,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      setCreateOpen(false);
      toast.success('渠道创建成功');
      setCreateForm({
        platform: 'baijiahao',
        accountName: '',
        brandId: isClient ? user?.brandId || '' : '',
        publishMode: 'local_auto',
        dailyLimit: 3,
        remark: '',
      });
    },
    onError: (err: Error) => {
      toast.error(err.message || '创建失败');
    },
  });

  /* ---------- 状态切换 ---------- */
  const toggleStatusMutation = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: ChannelStatus;
    }) => update(id, { status }),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      toast.success('状态已更新');
    },
    onError: (err: Error) => {
      toast.error(err.message || '操作失败');
    },
  });

  /* ---------- 删除 ---------- */
  const [deleteConfirm, setDeleteConfirm] = useState<Channel | null>(null);
  const deleteMutation = useMutation({
    mutationFn: remove,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      setDeleteConfirm(null);
      toast.success('已删除渠道账号');
    },
    onError: (err: Error) => {
      toast.error(err.message || '删除失败');
    },
  });

  /* ---------- 测试连接 ---------- */
  const testMutation = useMutation({
    mutationFn: test,
    retry: false,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      if (result.ok) {
        toast.success(result.message || '连接测试成功，账号状态正常');
      } else {
        toast.warning(result.message || '连接测试未通过');
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || '测试失败');
    },
  });

  /* ---------- 重新绑定 ---------- */
  const handleRebind = (channel: Channel) => {
    toast.info(
      `请在发布助手中重新绑定「${channel.accountName}」账号`,
    );
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const currentBrandName = useMemo(() => {
    if (!isClient || !user?.brandId) return '';
    return brandOptions.find((b) => b.id === user.brandId)?.name || '';
  }, [isClient, user?.brandId, brandOptions]);

  return (
    <div className="space-y-6" style={{ backgroundColor: '#f8fafc' }}>
      <PageHeader
        title="渠道账号"
        description="管理各平台发布账号，支持本地自动发布与手动发布"
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button style={{ backgroundColor: PRIMARY }}>
                <Plus className="h-4 w-4" />
                新增渠道
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>新增渠道账号</DialogTitle>
              <DialogDescription className="text-xs">
                添加后需要在发布助手中完成账号绑定才能自动发布
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2 max-h-[70vh] overflow-y-auto">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">平台</label>
                <Select
                  value={createForm.platform}
                  onValueChange={(v) =>
                    setCreateForm({
                      ...createForm,
                      platform: v as ChannelPlatform,
                    })
                  }
                >
                  <SelectTrigger className="w-full h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNEL_PLATFORMS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {CHANNEL_PLATFORM_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">账号名称</label>
                <Input
                  value={createForm.accountName}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      accountName: e.target.value,
                    })
                  }
                  placeholder="如：焙搭狸狸官方号"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">归属品牌</label>
                {isClient ? (
                  <Input
                    value={currentBrandName || user?.brandId || ''}
                    disabled
                    className="h-9 bg-muted/50"
                  />
                ) : (
                  <Select
                    value={createForm.brandId}
                    onValueChange={(v) =>
                      setCreateForm({ ...createForm, brandId: v })
                    }
                  >
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder="请选择品牌" />
                    </SelectTrigger>
                    <SelectContent>
                      {brandOptions.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">发布方式</label>
                <Select
                  value={createForm.publishMode}
                  onValueChange={(v) =>
                    setCreateForm({
                      ...createForm,
                      publishMode: v as ChannelPublishMode,
                    })
                  }
                >
                  <SelectTrigger className="w-full h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNEL_PUBLISH_MODES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {CHANNEL_PUBLISH_MODE_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">日限额（篇）</label>
                <Input
                  type="number"
                  min={1}
                  value={createForm.dailyLimit}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      dailyLimit: Math.max(1, Number(e.target.value) || 1),
                    })
                  }
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">备注</label>
                <Textarea
                  value={createForm.remark || ''}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      remark: e.target.value,
                    })
                  }
                  placeholder="选填"
                  className="min-h-[80px] resize-y"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                取消
              </Button>
              <Button
                style={{ backgroundColor: PRIMARY }}
                disabled={
                  createMutation.isPending ||
                  !createForm.accountName ||
                  !createForm.brandId
                }
                onClick={() => createMutation.mutate(createForm)}
              >
                {createMutation.isPending ? '保存中...' : '保存'}
              </Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        }
      />

      {/* 说明卡片 */}
      <Card
        className="w-full"
        style={{
          borderRadius: '8px',
          backgroundColor: '#f1f5f9',
          boxShadow: 'none',
          border: '1px solid #e2e8f0',
        }}
      >
        <CardContent className="py-3 px-4">
          <p className="text-xs text-muted-foreground">
            <Zap className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" style={{ color: WARNING }} />
            本地自动发布需在电脑上启动发布助手，账号密码不存服务器，只存本机登录态。
          </p>
        </CardContent>
      </Card>

      {/* 列表 */}
      <TableShell
        title="渠道账号列表"
        description="管理各平台发布账号，支持本地自动发布与手动发布"
        headerActions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button style={{ backgroundColor: PRIMARY }}>
                <Plus className="h-4 w-4" />
                新增渠道
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>新增渠道账号</DialogTitle>
              <DialogDescription className="text-xs">
                添加后需要在发布助手中完成账号绑定才能自动发布
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2 max-h-[70vh] overflow-y-auto">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">平台</label>
                <Select
                  value={createForm.platform}
                  onValueChange={(v) =>
                    setCreateForm({
                      ...createForm,
                      platform: v as ChannelPlatform,
                    })
                  }
                >
                  <SelectTrigger className="w-full h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNEL_PLATFORMS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {CHANNEL_PLATFORM_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">账号名称</label>
                <Input
                  value={createForm.accountName}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      accountName: e.target.value,
                    })
                  }
                  placeholder="如：焙搭狸狸官方号"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">归属品牌</label>
                {isClient ? (
                  <Input
                    value={currentBrandName || user?.brandId || ''}
                    disabled
                    className="h-9 bg-muted/50"
                  />
                ) : (
                  <Select
                    value={createForm.brandId}
                    onValueChange={(v) =>
                      setCreateForm({ ...createForm, brandId: v })
                    }
                  >
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder="请选择品牌" />
                    </SelectTrigger>
                    <SelectContent>
                      {brandOptions.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">发布方式</label>
                <Select
                  value={createForm.publishMode}
                  onValueChange={(v) =>
                    setCreateForm({
                      ...createForm,
                      publishMode: v as ChannelPublishMode,
                    })
                  }
                >
                  <SelectTrigger className="w-full h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNEL_PUBLISH_MODES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {CHANNEL_PUBLISH_MODE_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">日限额（篇）</label>
                <Input
                  type="number"
                  min={1}
                  value={createForm.dailyLimit}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      dailyLimit: Math.max(1, Number(e.target.value) || 1),
                    })
                  }
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">备注</label>
                <Textarea
                  value={createForm.remark || ''}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      remark: e.target.value,
                    })
                  }
                  placeholder="选填"
                  className="min-h-[80px] resize-y"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                取消
              </Button>
              <Button
                style={{ backgroundColor: PRIMARY }}
                disabled={
                  createMutation.isPending ||
                  !createForm.accountName ||
                  !createForm.brandId
                }
                onClick={() => createMutation.mutate(createForm)}
              >
                {createMutation.isPending ? '保存中...' : '保存'}
              </Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        }
        filterBar={
          <>
            <div className="w-40">
              <Select
                value={platformFilter}
                onValueChange={setPlatformFilter}
              >
                <SelectTrigger className="w-full h-9">
                  <SelectValue placeholder="全部平台" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部平台</SelectItem>
                  {CHANNEL_PLATFORMS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {CHANNEL_PLATFORM_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-28">
              <Select
                value={statusFilter}
                onValueChange={setStatusFilter}
              >
                <SelectTrigger className="w-full h-9">
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部状态</SelectItem>
                  {CHANNEL_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {CHANNEL_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              className="h-9"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              刷新
            </Button>
          </>
        }
        data={channelsData?.items ?? []}
        isLoading={isLoading}
        isEmpty={!isLoading && (!channelsData || channelsData.items.length === 0)}
        emptyTitle="暂无渠道账号"
        emptyDescription="添加渠道账号后可用于自动发布内容"
        emptyAction={{ label: '新增渠道', onClick: () => setCreateOpen(true) }}
        total={channelsData?.total ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      >
        {isError ? (
          <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-4 mb-3">
            <div
              className="flex items-center gap-2 text-sm"
              style={{ color: '#b45309' }}
            >
              <AlertCircle className="h-4 w-4" />
              <span>数据加载失败，请稍后刷新</span>
            </div>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-amber-100"
              style={{ color: '#b45309' }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              重新加载
            </button>
          </div>
        ) : null}
        {isLoading ? (
          <TableSkeleton />
        ) : (
          <Table style={{ minWidth: '1050px' }}>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[100px]">平台</TableHead>
                <TableHead className="min-w-[240px]">账号名称</TableHead>
                <TableHead className="min-w-[100px]">绑定状态</TableHead>
                <TableHead className="min-w-[120px] text-right tnum">今日已发/限额</TableHead>
                <TableHead className="min-w-[140px]">上次发布时间</TableHead>
                <TableHead className="min-w-[100px]">状态</TableHead>
                <TableHead className="w-[132px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {channelsData?.items.map((channel: Channel) => (
                <TableRow key={channel.id}>
                  <TableCell className="min-w-[100px]">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap"
                      style={{
                        backgroundColor: `${PLATFORM_COLORS[channel.platform]}15`,
                        color: PLATFORM_COLORS[channel.platform],
                      }}
                    >
                      {CHANNEL_PLATFORM_LABELS[channel.platform]}
                    </span>
                  </TableCell>
                  <TableCell className="min-w-[240px] font-medium">
                    <span className="block truncate" title={channel.accountName}>{channel.accountName}</span>
                  </TableCell>
                  <TableCell className="min-w-[100px]">
                    <span
                      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor:
                          BIND_STATUS_COLORS[channel.bindStatus].bg,
                        color:
                          BIND_STATUS_COLORS[channel.bindStatus].color,
                      }}
                    >
                      {channel.bindStatus === 'bound' && (
                        <CheckCircle2 className="h-3 w-3" />
                      )}
                      {channel.bindStatus === 'unbound' && (
                        <XCircle className="h-3 w-3" />
                      )}
                      {channel.bindStatus === 'expired' && (
                        <Clock className="h-3 w-3" />
                      )}
                      {CHANNEL_BIND_STATUS_LABELS[channel.bindStatus]}
                    </span>
                  </TableCell>
                  <TableCell className="min-w-[120px] text-sm text-right tnum">
                    <span style={{ color: PRIMARY, fontWeight: 500 }}>
                      {channel.todayPublished}
                    </span>
                    <span className="text-muted-foreground">
                      {' '}
                      / {channel.dailyLimit}
                    </span>
                  </TableCell>
                  <TableCell className="min-w-[140px] text-muted-foreground text-sm">
                    {formatDate(channel.lastPublishedAt)}
                  </TableCell>
                  <TableCell className="min-w-[100px]">
                    <span
                      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor:
                          STATUS_COLORS[channel.status].bg,
                        color: STATUS_COLORS[channel.status].color,
                      }}
                    >
                      {CHANNEL_STATUS_LABELS[channel.status]}
                    </span>
                  </TableCell>
                  <TableCell className="w-[132px] text-right">
                    <div className="flex items-center justify-end gap-1 flex-nowrap whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        style={{ color: PRIMARY }}
                        disabled={testMutation.isPending}
                        onClick={() => testMutation.mutate(channel.id)}
                      >
                        <Zap className="h-3 w-3" />
                        测试
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        style={{ color: WARNING }}
                        onClick={() => handleRebind(channel)}
                      >
                        <Link2Off className="h-3 w-3" />
                        重绑
                      </Button>
                      {channel.status === 'active' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          style={{ color: MUTED }}
                          disabled={toggleStatusMutation.isPending}
                          onClick={() =>
                            toggleStatusMutation.mutate({
                              id: channel.id,
                              status: 'paused',
                            })
                          }
                        >
                          <Pause className="h-3 w-3" />
                          暂停
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          style={{ color: SUCCESS }}
                          disabled={toggleStatusMutation.isPending}
                          onClick={() =>
                            toggleStatusMutation.mutate({
                              id: channel.id,
                              status: 'active',
                            })
                          }
                        >
                          <Play className="h-3 w-3" />
                          启用
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableShell>

      {/* 删除确认弹窗 */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={(v) => !v && setDeleteConfirm(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              删除后该渠道账号将被移除，相关发布记录不受影响。确认删除「
              {deleteConfirm?.accountName}」？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() =>
                deleteConfirm && deleteMutation.mutate(deleteConfirm.id)
              }
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
  <div className="space-y-2 rounded-md border p-4">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="flex items-center gap-4">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-40" />
      </div>
    ))}
  </div>
);

export default ChannelAccountsPage;
