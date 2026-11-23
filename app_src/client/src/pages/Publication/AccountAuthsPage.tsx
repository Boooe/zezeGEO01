import React, { useState, useMemo, useEffect } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  Link2Off,
  KeyRound,
  Send,
  Copy,
  Download,
  Search,
} from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@client/src/components/ui/dialog';
import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
import { Badge } from '@client/src/components/ui/badge';
import { PageHeader } from '@client/src/components/layout/PageHeader';
import {
  list,
  create,
  remove,
  generateAuthCode,
  unbind,
  getPlatformCards,
} from '@client/src/api/account-auths';
import { useAuth } from '@client/src/hooks/useAuth';
import { useBrandSelector } from '@client/src/hooks/useBrandSelector';
import {
  ACCOUNT_PLATFORMS,
  ACCOUNT_PLATFORM_LABELS,
  AUTH_METHODS,
  AUTH_METHOD_LABELS,
  AUTH_STATUSES,
  AUTH_STATUS_LABELS,
  ONLINE_STATUS_LABELS,
} from '@shared/api.interface';
import type {
  AccountAuth,
  AccountPlatform,
  AuthMethod,
  AuthStatus,
  AccountAuthCreateRequest,
  AccountPlatformCard,
} from '@shared/api.interface';

const PRIMARY = '#2E7DFF';
const DANGER = '#FF5C5C';
const SUCCESS = '#17C964';
const WARNING = '#FFA940';
const MUTED = '#64748b';
const BORDER = '#E5E9F2';

const PAGE_SIZE = 10;

const AUTH_STATUS_COLORS: Record<
  AuthStatus,
  { bg: string; color: string }
> = {
  authorized: { bg: 'rgba(23, 201, 100, 0.1)', color: SUCCESS },
  unauthorized: { bg: 'rgba(100, 116, 139, 0.1)', color: MUTED },
  expired: { bg: 'rgba(255, 169, 64, 0.1)', color: WARNING },
};

const AccountAuthsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isClient = user?.role === 'client';

  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { brands: brandOptions, selectedBrandId, setSelectedBrandId } =
    useBrandSelector();

  const brandId = isClient ? user?.brandId || '' : selectedBrandId;

  /* ---------- 平台卡片 ---------- */
  const { data: platformCards = [], isLoading: cardsLoading } = useQuery({
    queryKey: ['account-auth-platform-cards', brandId],
    queryFn: () => getPlatformCards(brandId || undefined),
    retry: 2,
    retryDelay: 2000,
    enabled: isClient ? !!user?.brandId : !!brandId,
  });

  /* ---------- 账号列表 ---------- */
  const {
    data: listData,
    isLoading: listLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [
      'account-auths',
      page,
      keyword,
      platformFilter,
      statusFilter,
      brandId,
    ],
    queryFn: () =>
      list({
        page,
        pageSize: PAGE_SIZE,
        brandId: brandId || undefined,
        keyword: keyword || undefined,
        platform: (platformFilter || undefined) as
          | AccountPlatform
          | undefined,
        authStatus: (statusFilter || undefined) as AuthStatus | undefined,
      }),
    retry: 2,
    retryDelay: 2000,
    enabled: isClient ? !!user?.brandId : !!brandId,
  });

  const totalPages = useMemo(() => {
    if (!listData) return 1;
    return Math.max(1, Math.ceil(listData.total / PAGE_SIZE));
  }, [listData]);

  const handleSearch = () => {
    setKeyword(keywordInput.trim());
    setPage(1);
  };

  /* ---------- 新增弹窗 ---------- */
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<AccountAuthCreateRequest>({
    platform: 'douyin',
    accountName: '',
    accountIdentifier: '',
    authMethod: 'client',
    brandId: isClient ? user?.brandId || '' : '',
    remark: '',
  });

  useEffect(() => {
    if (createOpen) {
      setCreateForm((prev) => ({
        ...prev,
        brandId: isClient ? user?.brandId || '' : brandId,
      }));
    }
  }, [createOpen, isClient, user?.brandId, brandId]);

  const createMutation = useMutation({
    mutationFn: create,
    retry: false,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['account-auths'] });
      queryClient.invalidateQueries({
        queryKey: ['account-auth-platform-cards'],
      });
      setCreateOpen(false);
      setCreateForm({
        platform: 'douyin',
        accountName: '',
        accountIdentifier: '',
        authMethod: 'client',
        brandId: isClient ? user?.brandId || '' : brandId,
        remark: '',
      });
      // 生成授权码并弹窗
      generateAuthCodeMutation.mutate(data.id);
    },
    onError: (err: Error) => {
      toast.error(err.message || '创建失败');
    },
  });

  /* ---------- 授权码弹窗 ---------- */
  const [authCodeOpen, setAuthCodeOpen] = useState(false);
  const [authCode, setAuthCode] = useState('');

  const generateAuthCodeMutation = useMutation({
    mutationFn: generateAuthCode,
    retry: false,
    onSuccess: (data) => {
      setAuthCode(data.authCode);
      setAuthCodeOpen(true);
      queryClient.invalidateQueries({ queryKey: ['account-auths'] });
      queryClient.invalidateQueries({
        queryKey: ['account-auth-platform-cards'],
      });
    },
    onError: (err: Error) => {
      toast.error(err.message || '生成授权码失败');
    },
  });

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(authCode);
      toast.success('授权码已复制到剪贴板');
    } catch {
      toast.error('复制失败，请手动复制');
    }
  };

  const handleGoToClient = () => {
    navigate('/publish/client');
  };

  /* ---------- 删除 ---------- */
  const [deleteConfirm, setDeleteConfirm] = useState<AccountAuth | null>(
    null,
  );
  const deleteMutation = useMutation({
    mutationFn: remove,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-auths'] });
      queryClient.invalidateQueries({
        queryKey: ['account-auth-platform-cards'],
      });
      setDeleteConfirm(null);
      toast.success('已删除授权账号');
    },
    onError: (err: Error) => {
      toast.error(err.message || '删除失败');
    },
  });

  /* ---------- 解绑 ---------- */
  const [unbindConfirm, setUnbindConfirm] = useState<AccountAuth | null>(
    null,
  );
  const unbindMutation = useMutation({
    mutationFn: unbind,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-auths'] });
      queryClient.invalidateQueries({
        queryKey: ['account-auth-platform-cards'],
      });
      setUnbindConfirm(null);
      toast.success('已解绑账号');
    },
    onError: (err: Error) => {
      toast.error(err.message || '解绑失败');
    },
  });

  /* ---------- 去授权 ---------- */
  const handleGoAuth = (account: AccountAuth) => {
    generateAuthCodeMutation.mutate(account.id);
  };

  /* ---------- 发布文章 ---------- */
  const handlePublish = (account: AccountAuth) => {
    navigate('/publish/queue', { state: { accountId: account.id } });
  };

  const formatDateTime = (dateStr: string | null): string => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  return (
    <div className="min-h-full py-6 px-6" style={{ backgroundColor: '#f8fafc' }}>
      <div className="mx-auto max-w-[1400px] space-y-5">
        <PageHeader
          title="授权账号"
          description="管理各平台的客户端授权账号，用于半自动发布"
        />

        {/* 品牌选择（非 client 角色） */}
        {!isClient && (
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: MUTED }}>
              品牌
            </span>
            <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue placeholder="选择品牌" />
              </SelectTrigger>
              <SelectContent>
                {brandOptions.map(
                  (b: { id: string; name: string }) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* 平台卡片区 */}
        <div>
          <div
            className="mb-2 text-sm font-medium"
            style={{ color: '#0f172a' }}
          >
            平台概览
          </div>
          {cardsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {Array.from({ length: 6 }).map((_, i: number) => (
                <Skeleton
                  key={i}
                  className="h-[120px] rounded-xl w-full"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {platformCards.map((card: AccountPlatformCard) => (
                <div
                  key={card.platform}
                  className="rounded-xl border bg-white p-4 transition-colors hover:border-[#94a3b8]"
                  style={{ borderColor: BORDER }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-medium text-[#0f172a]">
                        {ACCOUNT_PLATFORM_LABELS[card.platform]}
                      </div>
                      <div className="mt-1 text-xs" style={{ color: MUTED }}>
                        共 {card.total} 个账号
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => {
                        setCreateForm((prev) => ({
                          ...prev,
                          platform: card.platform,
                          brandId: isClient
                            ? user?.brandId || ''
                            : brandId,
                        }));
                        setCreateOpen(true);
                      }}
                    >
                      <Plus className="h-3 w-3" />
                      添加授权
                    </Button>
                  </div>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span
                      className="text-2xl font-bold"
                      style={{ color: SUCCESS }}
                    >
                      {card.authorized}
                    </span>
                    <span className="text-xs" style={{ color: MUTED }}>
                      已授权
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {card.accounts.slice(0, 12).map((acc: AccountAuth) => (
                      <div
                        key={acc.id}
                        className="size-2 rounded-full"
                        style={{
                          backgroundColor:
                            acc.onlineStatus === 'online'
                              ? SUCCESS
                              : '#cbd5e1',
                        }}
                        title={`${acc.accountName} - ${ONLINE_STATUS_LABELS[acc.onlineStatus]}`}
                      />
                    ))}
                    {card.total > 12 && (
                      <span
                        className="text-[10px]"
                        style={{ color: MUTED }}
                      >
                        +{card.total - 12}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {platformCards.length === 0 && (
                <div
                  className="flex w-full items-center justify-center rounded-xl border border-dashed py-8 text-sm"
                  style={{ borderColor: BORDER, color: MUTED }}
                >
                  暂无平台数据
                </div>
              )}
            </div>
          )}
        </div>

        {/* 列表 */}
        <TableShell
          title="授权账号列表"
          description="管理各平台的客户端授权账号，用于半自动发布"
          headerActions={
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              className="h-9"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              刷新
            </Button>
          }
          filterBar={
            <>
              <div className="relative w-[260px]">
                <Search
                  className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2"
                  style={{ color: MUTED }}
                />
                <Input
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearch();
                  }}
                  placeholder="搜索账号名称/标识"
                  className="h-9 w-full pl-8 text-xs"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: MUTED }}>
                  平台
                </span>
                <Select
                  value={platformFilter}
                  onValueChange={(v) => {
                    setPlatformFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-[130px] text-xs">
                    <SelectValue placeholder="全部平台" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">全部平台</SelectItem>
                    {ACCOUNT_PLATFORMS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {ACCOUNT_PLATFORM_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: MUTED }}>
                  状态
                </span>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-[120px] text-xs">
                    <SelectValue placeholder="全部状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">全部状态</SelectItem>
                    {AUTH_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {AUTH_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          }
          data={listData?.items ?? []}
          isLoading={listLoading}
          isEmpty={!listLoading && (!listData || listData.items.length === 0)}
          emptyTitle="暂无授权账号"
          emptyDescription="添加授权账号后可用于半自动发布内容"
          total={listData?.total ?? 0}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        >
          {isError ? (
            <div className="m-4 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-4">
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
          {listLoading ? (
            <TableSkeleton />
          ) : (
            <div className="overflow-x-auto">
              <Table style={{ minWidth: '900px' }}>
                <TableHeader>
                  <TableRow style={{ backgroundColor: '#F7F9FC' }}>
                    <TableHead className="min-w-[80px] text-xs font-medium">
                      序号
                    </TableHead>
                    <TableHead className="min-w-[240px] text-xs font-medium">
                      授权账号
                    </TableHead>
                    <TableHead className="min-w-[120px] text-xs font-medium">
                      授权平台
                    </TableHead>
                    <TableHead className="min-w-[120px] text-xs font-medium">
                      授权方式
                    </TableHead>
                    <TableHead className="min-w-[180px] text-xs font-medium">
                      状态
                    </TableHead>
                    <TableHead className="min-w-[140px] text-xs font-medium">
                      最近心跳
                    </TableHead>
                    <TableHead className="w-[132px] text-right text-xs font-medium">
                      操作
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listData?.items.map(
                    (item: AccountAuth, idx: number) => (
                      <TableRow
                        key={item.id}
                        style={{ height: 44 }}
                      >
                        <TableCell className="text-xs text-muted-foreground">
                          {(page - 1) * PAGE_SIZE + idx + 1}
                        </TableCell>
                        <TableCell className="min-w-[240px]">
                          <div className="font-medium text-sm text-[#0f172a] line-clamp-2" title={item.accountName}>
                            {item.accountName}
                          </div>
                          {item.accountIdentifier && (
                            <div
                              className="mt-0.5 text-xs"
                              style={{ color: MUTED }}
                            >
                              {item.accountIdentifier}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="min-w-[120px]">
                          <span className="text-xs text-[#334155]">
                            {ACCOUNT_PLATFORM_LABELS[item.platform]}
                          </span>
                        </TableCell>
                        <TableCell className="min-w-[120px]">
                          <span className="text-xs text-[#334155]">
                            {AUTH_METHOD_LABELS[item.authMethod]}
                          </span>
                        </TableCell>
                        <TableCell className="min-w-[180px]">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="secondary"
                              className="h-[22px] text-[12px] font-medium"
                              style={{
                                backgroundColor:
                                  AUTH_STATUS_COLORS[item.authStatus]
                                    .bg,
                                color: AUTH_STATUS_COLORS[
                                  item.authStatus
                                    ].color,
                                borderColor: 'transparent',
                              }}
                            >
                              {AUTH_STATUS_LABELS[item.authStatus]}
                            </Badge>
                            <div className="flex items-center gap-1">
                              <div
                                className="size-2 rounded-full"
                                style={{
                                  backgroundColor:
                                    item.onlineStatus === 'online'
                                      ? SUCCESS
                                      : '#cbd5e1',
                                }}
                              />
                              <span
                                className="text-xs"
                                style={{ color: MUTED }}
                              >
                                {ONLINE_STATUS_LABELS[item.onlineStatus]}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[140px] text-xs text-muted-foreground">
                          {formatDateTime(item.lastHeartbeatAt)}
                        </TableCell>
                        <TableCell className="w-[132px] text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              style={{ color: PRIMARY }}
                              onClick={() => handlePublish(item)}
                            >
                              <Send className="h-3 w-3" />
                              发布
                            </Button>
                            {item.authStatus !== 'authorized' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                style={{ color: SUCCESS }}
                                disabled={
                                  generateAuthCodeMutation.isPending
                                }
                                onClick={() => handleGoAuth(item)}
                              >
                                <KeyRound className="h-3 w-3" />
                                授权
                              </Button>
                            )}
                            {item.authStatus === 'authorized' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                style={{ color: WARNING }}
                                onClick={() => setUnbindConfirm(item)}
                              >
                                <Link2Off className="h-3 w-3" />
                                解绑
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ),
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </TableShell>
      </div>

      {/* 新增授权弹窗 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>添加授权账号</DialogTitle>
            <DialogDescription className="text-xs">
              添加后需生成授权码，在发布客户端中输入完成绑定
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
                    platform: v as AccountPlatform,
                  })
                }
              >
                <SelectTrigger className="w-full h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_PLATFORMS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {ACCOUNT_PLATFORM_LABELS[p]}
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
                placeholder="如：星河GEO官方号"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                账号标识{' '}
                <span className="text-xs font-normal" style={{ color: MUTED }}>
                  （手机号/昵称/ID，可选）
                </span>
              </label>
              <Input
                value={createForm.accountIdentifier || ''}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    accountIdentifier: e.target.value,
                  })
                }
                placeholder="便于识别的账号标识"
                className="h-9"
              />
            </div>
            {!isClient && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">归属品牌</label>
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
                    {brandOptions.map(
                      (b: { id: string; name: string }) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">授权方式</label>
              <Select
                value={createForm.authMethod}
                onValueChange={(v) =>
                  setCreateForm({
                    ...createForm,
                    authMethod: v as AuthMethod,
                  })
                }
              >
                <SelectTrigger className="w-full h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUTH_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {AUTH_METHOD_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                备注{' '}
                <span className="text-xs font-normal" style={{ color: MUTED }}>
                  （可选）
                </span>
              </label>
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
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
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

      {/* 授权码展示弹窗 */}
      <Dialog open={authCodeOpen} onOpenChange={setAuthCodeOpen}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader>
            <DialogTitle className="text-center">授权码</DialogTitle>
            <DialogDescription className="text-center text-xs">
              请在发布客户端输入该授权码完成绑定，有效期 10 分钟
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <div
              className="mx-auto inline-block rounded-xl border px-8 py-6"
              style={{ borderColor: BORDER }}
            >
              <div
                className="font-mono text-5xl font-bold tracking-[0.3em]"
                style={{ color: PRIMARY }}
              >
                {authCode}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              style={{ backgroundColor: PRIMARY }}
              onClick={handleCopyCode}
              className="w-full"
            >
              <Copy className="h-4 w-4" />
              复制授权码
            </Button>
            <Button
              variant="outline"
              onClick={handleGoToClient}
              className="w-full"
            >
              <Download className="h-4 w-4" />
              去下载客户端
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 解绑确认弹窗 */}
      <Dialog
        open={!!unbindConfirm}
        onOpenChange={(v) => !v && setUnbindConfirm(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>确认解绑</DialogTitle>
            <DialogDescription>
              解绑后账号状态将变为「未授权」，需要重新生成授权码才能再次绑定。
              确认解绑「{unbindConfirm?.accountName}」？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUnbindConfirm(null)}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={unbindMutation.isPending}
              onClick={() =>
                unbindConfirm && unbindMutation.mutate(unbindConfirm.id)
              }
            >
              {unbindMutation.isPending ? '解绑中...' : '确认解绑'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={(v) => !v && setDeleteConfirm(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              删除后该授权账号将被移除，相关发布记录不受影响。确认删除「
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

const TableSkeleton: React.FC = () => (
  <div className="space-y-2 p-4">
    {Array.from({ length: 6 }).map((_, i: number) => (
      <div key={i} className="flex items-center gap-4">
        <Skeleton className="h-4 w-6" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-48" />
      </div>
    ))}
  </div>
);

export default AccountAuthsPage;
