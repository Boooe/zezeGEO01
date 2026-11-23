import React, { useState, useMemo, useEffect } from 'react';
import {
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, RefreshCw, Search, AlertCircle, Download, Copy, Trash2, Inbox } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
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
import { Badge } from '@client/src/components/ui/badge';
import { DataPagination } from '@client/src/components/ui/data-pagination';
import { SectionCard } from '@client/src/components/layout/SectionCard';
import { Toolbar } from '@client/src/components/layout/Toolbar';
import { Pill } from '@client/src/components/layout/Pill';
import { DataTable } from '@client/src/components/layout/DataTable';
import { EmptyState } from '@client/src/components/layout/EmptyState';
import {
  listUnifiedAccounts,
  getPlatformCapabilities,
  generateAuthorizeCode,
} from '@client/src/api/account-auths';
import { useAuth } from '@client/src/hooks/useAuth';
import { useBrandSelector } from '@client/src/hooks/useBrandSelector';
import {
  ACCOUNT_PLATFORMS,
  ACCOUNT_PLATFORM_LABELS,
  AUTH_MODE_LABELS,
  SESSION_STATE_LABELS,
} from '@shared/api.interface';
import type {
  UnifiedAccountV2,
  AuthMode,
  PlatformCapability,
  AuthorizeCodeResponse,
} from '@shared/api.interface';
import { showConfirm } from '@lark-apaas/client-toolkit';

const PRIMARY = '#2E7DFF';
const MUTED = '#94A3B8';
const BORDER = '#E6EAF2';
const WARNING = '#F59E0B';
const SUCCESS = '#10B981';

const PAGE_SIZE = 50;

const STATUS_SEGMENTS = [
  { value: '', label: '全部' },
  { value: 'valid', label: '已授权' },
  { value: 'paused', label: '已暂停' },
  { value: 'expired', label: '已失效' },
] as const;

function getPlatformLabel(platform: string): string {
  const allLabels: Record<string, string> = {
    ...ACCOUNT_PLATFORM_LABELS,
    website: '客户自有网站',
    video_channel: '视频号',
    wechat_mp: '微信公众号',
    kuaishou: '快手',
    bilibili: '哔哩哔哩',
    weibo: '微博',
    other: '其他',
  };
  return allLabels[platform] || platform;
}

const UnifiedAccountsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isClient = user?.role === 'client';

  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { brands: brandOptions, selectedBrandId, setSelectedBrandId } =
    useBrandSelector();

  const brandId = isClient ? user?.brandId || '' : selectedBrandId;

  useEffect(() => {
    if (!isClient && !selectedBrandId && brandOptions.length > 0) {
      setSelectedBrandId(brandOptions[0].id);
    }
  }, [isClient, selectedBrandId, brandOptions, setSelectedBrandId]);

  /* ---------- 平台能力 ---------- */
  const { data: platformCapabilitiesData } = useQuery({
    queryKey: ['platform-capabilities'],
    queryFn: () => getPlatformCapabilities(),
    staleTime: 1000 * 60 * 60,
  });
  const platformCapabilities: PlatformCapability[] =
    platformCapabilitiesData?.platforms ?? [];

  /* ---------- 账号列表 ---------- */
  const {
    data: listData,
    isLoading: listLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [
      'unified-accounts',
      page,
      keyword,
      statusFilter,
      brandId,
    ],
    queryFn: () =>
      listUnifiedAccounts({
        page,
        pageSize: PAGE_SIZE,
        brandId: brandId || undefined,
        keyword: keyword || undefined,
        status: statusFilter || undefined,
      }),
    retry: 2,
    retryDelay: 2000,
    enabled: isClient ? !!user?.brandId : !!brandId,
  });

  const handleSearch = () => {
    setKeyword(keywordInput.trim());
    setPage(1);
  };

  const total = listData?.total ?? 0;
  const totalPages = useMemo(() => {
    if (!listData) return 1;
    return Math.max(1, Math.ceil(listData.total / PAGE_SIZE));
  }, [listData]);

  const availableCount = useMemo(() => {
    if (!listData?.items) return 0;
    return listData.items.filter(
      (item: UnifiedAccountV2) => item.sessionState === 'valid',
    ).length;
  }, [listData?.items]);

  const expiredCount = useMemo(() => {
    if (!listData?.items) return 0;
    return listData.items.filter(
      (item: UnifiedAccountV2) => item.sessionState === 'expired',
    ).length;
  }, [listData?.items]);

  /* ---------- 新增弹窗 ---------- */
  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);
  const [createForm, setCreateForm] = useState<{
    platform: string;
    authMode: AuthMode;
    brandId: string;
  }>({
    platform: 'douyin',
    authMode: 'qr',
    brandId: isClient ? user?.brandId || '' : '',
  });
  const [authorizeCodeData, setAuthorizeCodeData] =
    useState<AuthorizeCodeResponse | null>(null);
  const [authCodeLoading, setAuthCodeLoading] = useState(false);

  useEffect(() => {
    if (createOpen) {
      setCreateStep(1);
      setAuthorizeCodeData(null);
      setCreateForm((prev) => ({
        ...prev,
        authMode: 'qr',
        brandId: isClient ? user?.brandId || '' : brandId,
      }));
    }
  }, [createOpen, isClient, user?.brandId, brandId]);

  const formatDateTime = (dateStr: string | null): string => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const formatDateShort = (dateStr: string | null): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const allPlatformOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of ACCOUNT_PLATFORMS) set.add(p);
    // 补充渠道常见平台
    ['wechat_mp', 'video_channel', 'kuaishou', 'website'].forEach((p) =>
      set.add(p),
    );
    return Array.from(set);
  }, []);

  const currentPlatformCap = useMemo(() => {
    return (
      platformCapabilities.find(
        (p: PlatformCapability) => p.key === createForm.platform,
      ) ?? null
    );
  }, [platformCapabilities, createForm.platform]);

  const handleGoToStep2 = () => {
    if (!createForm.platform) {
      toast.error('请选择平台');
      return;
    }
    setCreateStep(2);
    // Step2 默认选中的是扫码授权，进入时生成授权码
    if (!authorizeCodeData) {
      generateAuthCodeForPlatform();
    }
  };

  const generateAuthCodeForPlatform = async () => {
    if (!brandId) {
      toast.error('请先选择品牌');
      return;
    }
    setAuthCodeLoading(true);
    try {
      const res = await generateAuthorizeCode({
        platform: createForm.platform,
        brandId,
        authMode: createForm.authMode,
      });
      setAuthorizeCodeData(res);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '生成失败';
      toast.error(message || '生成授权码失败');
    } finally {
      setAuthCodeLoading(false);
    }
  };

  const handleSelectAuthMode = (mode: AuthMode) => {
    setCreateForm({ ...createForm, authMode: mode });
    setAuthorizeCodeData(null);
    // 切换接入方式后重新生成授权码
    setTimeout(() => generateAuthCodeForPlatform(), 0);
  };

  const handlePlatformChange = (platform: string) => {
    setCreateForm({ ...createForm, platform });
    // 切换平台后清空授权码，重新生成
    setAuthorizeCodeData(null);
  };

  const handleCopyAuthCode = async () => {
    if (!authorizeCodeData?.code) return;
    try {
      await navigator.clipboard.writeText(authorizeCodeData.code);
      toast.success('授权码已复制');
    } catch {
      toast.error('复制失败，请手动复制');
    }
  };

  const handleFinishCreate = () => {
    setCreateOpen(false);
    toast.success('授权方式已确认，请在客户端完成登录');
  };

  const formatCodeDisplay = (code: string): string => {
    if (code.length >= 8) {
      return `${code.slice(0, 4)}-${code.slice(4, 8)}`;
    }
    return code;
  };

  return (
    <>
      <SectionCard
      title="账号列表"
      count={total}
      actions={
        <>
          <Button size="sm" variant="outline" onClick={() => refetch()} className="h-8">
            <RefreshCw className="h-3.5 w-3.5" />
            刷新
          </Button>
          <Button size="sm" className="h-8 bg-[#2E7DFF] text-white hover:bg-[#1E5FD6]" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            添加账号
          </Button>
        </>
      }
    >
      <Toolbar>
        {!isClient && (
          <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
            <SelectTrigger className="h-8 w-[160px] text-[13px]">
              <SelectValue placeholder="选择品牌" />
            </SelectTrigger>
            <SelectContent>
              {brandOptions.map((b: { id: string; name: string }) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="flex items-center gap-1 rounded-md bg-[#F1F5F9] p-0.5">
          {STATUS_SEGMENTS.map((seg) => (
            <button
              key={seg.value}
              onClick={() => {
                setStatusFilter(seg.value);
                setPage(1);
              }}
              className="h-7 rounded px-3 text-[12px] font-medium transition-colors"
              style={{
                backgroundColor: statusFilter === seg.value ? '#ffffff' : 'transparent',
                color: statusFilter === seg.value ? '#0F172A' : '#64748B',
                boxShadow: statusFilter === seg.value ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              {seg.label}
            </button>
          ))}
        </div>
        <div className="relative w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <Input
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch();
            }}
            placeholder="搜索账号名 / 平台"
            className="h-8 w-full pl-9 text-[13px]"
          />
        </div>
      </Toolbar>

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
            <>
              <DataTable
                rowKey="_key"
                columns={[
                  {
                    key: 'accountName',
                    title: '账号名',
                    width: '28%',
                    render: (row: UnifiedAccountV2 & { _key: string }) => (
                      <div className="flex flex-col">
                        <span
                          className="font-medium text-[12.5px] text-[#0f172a]"
                          title={row.accountName}
                        >
                          {row.accountName}
                        </span>
                        {row.brandName && (
                          <span
                            className="text-[11px]"
                            style={{ color: '#94A3B8' }}
                          >
                            {row.brandName}
                          </span>
                        )}
                      </div>
                    ),
                  },
                  {
                    key: 'platform',
                    title: '平台',
                    width: '14%',
                    render: (row: UnifiedAccountV2 & { _key: string }) => (
                      <span className="text-[12.5px] text-[#334155]">
                        {getPlatformLabel(row.platform)}
                      </span>
                    ),
                  },
                  {
                    key: 'authMode',
                    title: '接入方式',
                    width: '14%',
                    render: (row: UnifiedAccountV2 & { _key: string }) => (
                      <span className="text-[12.5px] text-[#334155]">
                        {AUTH_MODE_LABELS[row.authMode]}
                      </span>
                    ),
                  },
                  {
                    key: 'status',
                    title: '状态',
                    width: '22%',
                    render: (row: UnifiedAccountV2 & { _key: string }) => (
                      <div className="flex flex-col gap-1">
                        {row.sessionState === 'valid' && (
                          <>
                            {row.expiresAt && new Date(row.expiresAt) < new Date() ? (
                              <Pill variant="warning">登录态可能已失效</Pill>
                            ) : (
                              <Pill variant="success">{SESSION_STATE_LABELS[row.sessionState]}</Pill>
                            )}
                            {row.expiresAt && (
                              <span className="text-[12px] text-[#94A3B8]">
                                有效期至 {formatDateShort(row.expiresAt)}
                              </span>
                            )}
                          </>
                        )}
                        {row.sessionState === 'expired' && (
                          <Pill variant="danger">登录态已失效，请重新扫码</Pill>
                        )}
                        {row.sessionState === 'paused' && (
                          <Pill variant="muted">{SESSION_STATE_LABELS[row.sessionState]}</Pill>
                        )}
                      </div>
                    ),
                  },
                  {
                    key: 'actions',
                    title: '操作',
                    width: '22%',
                    align: 'right',
                    render: (row: UnifiedAccountV2 & { _key: string }) => (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          style={{
                            color:
                              row.sessionState === 'expired'
                                ? PRIMARY
                                : '#64748b',
                            fontWeight:
                              row.sessionState === 'expired'
                                ? 600
                                : 400,
                          }}
                          onClick={() => {
                            setCreateOpen(true);
                            setCreateStep(2);
                            setCreateForm((prev) => ({
                              ...prev,
                              platform: row.platform,
                              authMode: 'qr',
                            }));
                          }}
                        >
                          {row.sessionState === 'valid'
                            ? '重新扫码'
                            : '重新授权'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          style={{ color: '#EF4444' }}
                          onClick={async () => {
                            if (!await showConfirm('确定删除该账号？')) return;
                            import('@client/src/api/account-auths')
                              .then((m) => m.remove(row.sourceId))
                              .then(() => {
                                queryClient.invalidateQueries({
                                  queryKey: ['unified-accounts'],
                                });
                                toast.success('删除成功');
                              })
                              .catch((err: Error) =>
                                toast.error(err.message || '删除失败'),
                              );
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ),
                  },
                ]}
                data={(listData?.items ?? []).map((item: UnifiedAccountV2) => ({
                  ...item,
                  _key: `${item.sourceTable}-${item.sourceId}`,
                }))}
              />
              {total > 0 && (
                <div className="pt-4">
                  <DataPagination
                    total={total}
                    page={page}
                    pageSize={PAGE_SIZE}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => {
                      setPage(1);
                    }}
                  />
                </div>
              )}
            </>
          )}

          {!listLoading && (!listData || listData.items.length === 0) && (
            <EmptyState
              icon={<Inbox />}
              description="暂无账号，点击右上角添加账号开始授权"
              action={
                <Button
                  size="sm"
                  className="bg-[#2E7DFF] text-white hover:bg-[#1E5FD6]"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  添加账号
                </Button>
              }
            />
          )}
    </SectionCard>

      {/* 添加账号弹窗 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>添加账号</DialogTitle>
            <DialogDescription className="text-xs">
              {createStep === 1
                ? '选择平台'
                : createStep === 2
                  ? '选择接入方式'
                  : '确认授权方式'}
            </DialogDescription>
          </DialogHeader>

          {createStep === 1 ? (
            <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">平台</label>
                <Select
                  value={createForm.platform}
                  onValueChange={handlePlatformChange}
                >
                  <SelectTrigger className="w-full h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {platformCapabilities.length > 0
                      ? platformCapabilities.map((p: PlatformCapability) => (
                          <SelectItem key={p.key} value={p.key}>
                            {p.name}
                          </SelectItem>
                        ))
                      : allPlatformOptions.map((p) => (
                          <SelectItem key={p} value={p}>
                            {getPlatformLabel(p)}
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 平台能力徽标 */}
              <div className="flex flex-wrap items-center gap-2">
                {currentPlatformCap ? (
                  <>
                    <Badge
                      variant="secondary"
                      className="h-[22px] text-[11px] font-medium"
                      style={{
                        backgroundColor: currentPlatformCap.oauth
                          ? 'rgba(23, 201, 100, 0.1)'
                          : 'rgba(100, 116, 139, 0.1)',
                        color: currentPlatformCap.oauth
                          ? SUCCESS
                          : MUTED,
                        borderColor: 'transparent',
                      }}
                    >
                      官方授权{' '}
                      {currentPlatformCap.oauth
                        ? currentPlatformCap.oauthNote || '✓可用'
                        : '不支持'}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="h-[22px] text-[11px] font-medium"
                      style={{
                        backgroundColor: 'rgba(46, 125, 255, 0.1)',
                        color: PRIMARY,
                        borderColor: 'transparent',
                      }}
                    >
                      扫码授权 推荐
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="h-[22px] text-[11px] font-medium"
                      style={{
                        backgroundColor: 'rgba(255, 169, 64, 0.1)',
                        color: WARNING,
                        borderColor: 'transparent',
                      }}
                    >
                      密码登录 不推荐
                    </Badge>
                  </>
                ) : (
                  <>
                    <Skeleton className="h-[22px] w-[90px] rounded-full" />
                    <Skeleton className="h-[22px] w-[90px] rounded-full" />
                    <Skeleton className="h-[22px] w-[90px] rounded-full" />
                  </>
                )}
              </div>
            </div>
          ) : createStep === 2 ? (
            <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {/* 官方授权卡片 */}
                <button
                  onClick={() => {
                    if (currentPlatformCap?.oauth) {
                      handleSelectAuthMode('oauth');
                    }
                  }}
                  disabled={!currentPlatformCap?.oauth}
                  className="relative rounded-lg border p-3 text-left transition-all disabled:cursor-not-allowed"
                  style={{
                    borderColor:
                      createForm.authMode === 'oauth'
                        ? PRIMARY
                        : BORDER,
                    borderLeftWidth:
                      createForm.authMode === 'oauth' ? '2px' : '1px',
                    backgroundColor:
                      createForm.authMode === 'oauth'
                        ? 'rgba(46, 125, 255, 0.05)'
                        : currentPlatformCap?.oauth
                          ? '#ffffff'
                          : '#f8fafc',
                    opacity: currentPlatformCap?.oauth ? 1 : 0.6,
                  }}
                >
                  <div
                    className="text-sm font-medium"
                    style={{
                      color:
                        createForm.authMode === 'oauth'
                          ? PRIMARY
                          : '#0f172a',
                    }}
                  >
                    官方授权（OAuth）
                  </div>
                  <div
                    className="mt-1 text-[11px] leading-relaxed"
                    style={{ color: MUTED }}
                  >
                    平台官方开放平台授权，最稳定
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span
                      className="text-[11px]"
                      style={{ color: MUTED }}
                    >
                      {currentPlatformCap?.oauth
                        ? currentPlatformCap.oauthNote || '✓可用'
                        : '该平台无开放 API'}
                    </span>
                    {currentPlatformCap?.oauth &&
                      currentPlatformCap.oauthNote &&
                      currentPlatformCap.oauthNote !== '✓可用' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[10px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            toast.info('平台授权配置功能即将上线');
                          }}
                        >
                          去配置
                        </Button>
                      )}
                  </div>
                </button>

                {/* 扫码授权卡片 */}
                <button
                  onClick={() => handleSelectAuthMode('qr')}
                  className="relative rounded-lg border p-3 text-left transition-all"
                  style={{
                    borderColor:
                      createForm.authMode === 'qr' ? PRIMARY : BORDER,
                    borderLeftWidth:
                      createForm.authMode === 'qr' ? '2px' : '1px',
                    backgroundColor:
                      createForm.authMode === 'qr'
                        ? 'rgba(46, 125, 255, 0.05)'
                        : '#ffffff',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className="text-sm font-medium"
                      style={{
                        color:
                          createForm.authMode === 'qr'
                            ? PRIMARY
                            : '#0f172a',
                      }}
                    >
                      扫码授权
                    </div>
                    <Badge
                      variant="secondary"
                      className="h-[18px] px-1.5 text-[10px] font-medium"
                      style={{
                        backgroundColor: 'rgba(46, 125, 255, 0.1)',
                        color: PRIMARY,
                        borderColor: 'transparent',
                      }}
                    >
                      推荐
                    </Badge>
                  </div>
                  <div
                    className="mt-1 text-[11px] leading-relaxed"
                    style={{ color: MUTED }}
                  >
                    客户端在你手机上扫码登录，只回传登录态
                  </div>
                </button>

                {/* 密码登录卡片 */}
                <button
                  onClick={() => handleSelectAuthMode('password')}
                  className="relative rounded-lg border p-3 text-left transition-all"
                  style={{
                    borderColor:
                      createForm.authMode === 'password'
                        ? PRIMARY
                        : BORDER,
                    borderLeftWidth:
                      createForm.authMode === 'password' ? '2px' : '1px',
                    backgroundColor:
                      createForm.authMode === 'password'
                        ? 'rgba(46, 125, 255, 0.05)'
                        : '#ffffff',
                  }}
                >
                  <div
                    className="text-sm font-medium"
                    style={{
                      color:
                        createForm.authMode === 'password'
                          ? PRIMARY
                          : '#0f172a',
                    }}
                  >
                    账号密码登录
                  </div>
                  <div
                    className="mt-1 text-[11px] leading-relaxed"
                    style={{ color: MUTED }}
                  >
                    直接输入账号密码
                  </div>
                  <div
                    className="mt-3 text-[11px]"
                    style={{ color: '#FF5C5C' }}
                  >
                    不推荐：平台会风控封号，且需要把密码交给系统
                  </div>
                </button>
              </div>

              {/* 扫码授权详情 */}
              {createForm.authMode === 'qr' && (
                <div
                  className="rounded-lg border p-4 space-y-3"
                  style={{ borderColor: BORDER }}
                >
                  <div className="text-center space-y-2">
                    <div className="text-xs" style={{ color: MUTED }}>
                      一次性授权码
                    </div>
                    <div
                      className="text-2xl font-mono font-bold tracking-wider"
                      style={{ color: PRIMARY }}
                    >
                      {authCodeLoading ? (
                        <Skeleton className="inline-block h-7 w-32" />
                      ) : (
                        formatCodeDisplay(authorizeCodeData?.code ?? '--------')
                      )}
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <div
                      className="flex items-center justify-center w-[140px] h-[140px] rounded-lg border-2 border-dashed"
                      style={{ borderColor: BORDER }}
                    >
                      <span className="text-xs" style={{ color: MUTED }}>
                        扫码区
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-2">
                    <code
                      className="rounded bg-slate-100 px-2 py-1 font-mono text-[11px]"
                      style={{ color: '#334155' }}
                    >
                      geo-publish-client auth --code{' '}
                      {authorizeCodeData?.code ?? 'XXXXXXXX'}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px]"
                      onClick={handleCopyAuthCode}
                      disabled={!authorizeCodeData?.code}
                    >
                      <Copy className="h-3 w-3" />
                      复制
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 py-2 max-h-[70vh] overflow-y-auto">
              <div
                className="rounded-lg border p-4 space-y-3"
                style={{ borderColor: BORDER }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: MUTED }}>
                    平台：
                  </span>
                  <span className="text-sm font-medium">
                    {currentPlatformCap?.name ||
                      getPlatformLabel(createForm.platform)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: MUTED }}>
                    接入方式：
                  </span>
                  <span className="text-sm font-medium">
                    {AUTH_MODE_LABELS[createForm.authMode]}
                  </span>
                </div>
                <div
                  className="pt-2 text-xs leading-relaxed"
                  style={{
                    color: MUTED,
                    borderTop: `1px dashed ${BORDER}`,
                  }}
                >
                  客户端会打开该平台登录页，你在自己的手机上扫码/登录一次，客户端只回传登录态，不保存密码
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {createStep === 1 ? (
              <>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  取消
                </Button>
                <Button
                  style={{ backgroundColor: PRIMARY }}
                  onClick={handleGoToStep2}
                >
                  下一步
                </Button>
              </>
            ) : createStep === 2 ? (
              <>
                <Button variant="outline" onClick={() => setCreateStep(1)}>
                  上一步
                </Button>
                <Button
                  style={{ backgroundColor: PRIMARY }}
                  onClick={() => setCreateStep(3)}
                >
                  下一步
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setCreateStep(2)}>
                  上一步
                </Button>
                <Button
                  style={{ backgroundColor: PRIMARY }}
                  onClick={handleFinishCreate}
                >
                  完成
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

const TableSkeleton: React.FC = () => (
  <div className="space-y-2 p-4">
    {Array.from({ length: 8 }).map((_, i: number) => (
      <div key={i} className="flex items-center gap-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
    ))}
  </div>
);

export default UnifiedAccountsPage;
