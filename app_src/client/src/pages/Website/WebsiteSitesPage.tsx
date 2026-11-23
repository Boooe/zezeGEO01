import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  RefreshCw,
  AlertCircle,
  Inbox,
} from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@client/src/components/ui/dialog';
import { Textarea } from '@client/src/components/ui/textarea';

import { DataPagination } from '@client/src/components/ui/data-pagination';
import { SectionCard } from '@client/src/components/layout/SectionCard';
import { Toolbar } from '@client/src/components/layout/Toolbar';
import { Pill } from '@client/src/components/layout/Pill';
import { DataTable } from '@client/src/components/layout/DataTable';
import { EmptyState } from '@client/src/components/layout/EmptyState';

import {
  getSites,
  createSite,
  updateSite,
  deleteSite,
  type CreateSiteRequest,
  type UpdateSiteRequest,
} from '@client/src/api/website';
import { getBrands } from '@client/src/api/brands';
import {
  SITE_STATUS,
  SITE_STATUS_LABELS,
  SITE_TYPE_LABELS,
} from '@shared/api.interface';
import type { SiteNetworkItem, SiteStatus, SiteType } from '@shared/api.interface';
import { showConfirm } from '@lark-apaas/client-toolkit';
import { useAuth } from '@client/src/contexts/AuthContext';

const PRIMARY = '#2E7DFF';
const DANGER = '#EF4444';

const PAGE_SIZE = 10;

const CMS_TYPES = [
  'WordPress',
  'Drupal',
  '织梦CMS',
  '帝国CMS',
  'PHPCMS',
  'ThinkCMF',
  '自研',
  '其他',
];

const STATUS_PILL_VARIANT: Record<SiteStatus, 'success' | 'muted' | 'warning'> = {
  active: 'success',
  inactive: 'muted',
  building: 'warning',
};

interface WebsiteSitesPageProps {
  defaultSiteType?: SiteType | '';
}

const WebsiteSitesPage: React.FC<WebsiteSitesPageProps> = ({
  defaultSiteType = '',
}) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isClient = user?.role === 'client';

  const [siteType, setSiteType] = useState<SiteType | ''>(defaultSiteType);
  const [page, setPage] = useState(1);
  const [brandId, setBrandId] = useState<string>(user?.brandId ?? '');
  const [status, setStatus] = useState<string>('');
  const [keyword, setKeyword] = useState<string>('');
  const [searchText, setSearchText] = useState<string>('');

  const {
    data: sitesData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['website', 'sites', siteType, page, brandId, status, searchText],
    queryFn: () =>
      getSites({
        page,
        limit: PAGE_SIZE,
        brandId: brandId || undefined,
        status: (status || undefined) as SiteStatus | undefined,
        keyword: searchText || undefined,
        siteType: siteType || undefined,
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
    if (!sitesData) return 1;
    return Math.max(1, Math.ceil(sitesData.total / PAGE_SIZE));
  }, [sitesData]);

  /* ---------- 新增弹窗 ---------- */
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateSiteRequest>({
    brandId: user?.brandId ?? '',
    siteType: 'enterprise',
    siteName: '',
    domain: '',
    status: 'active',
    cmsType: '',
    notes: '',
  });

  const openCreate = () => {
    setCreateForm({
      brandId: user?.brandId ?? brandOptions[0]?.id ?? '',
      siteType: siteType || 'enterprise',
      siteName: '',
      domain: '',
      status: 'active',
      cmsType: '',
      notes: '',
    });
    setCreateOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: createSite,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['website', 'sites'] });
      setCreateOpen(false);
      toast.success('创建成功');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message ?? '创建失败');
    },
  });

  /* ---------- 编辑弹窗 ---------- */
  const [editing, setEditing] = useState<SiteNetworkItem | null>(null);
  const [editForm, setEditForm] = useState<UpdateSiteRequest>({});
  const openEdit = (site: SiteNetworkItem) => {
    setEditing(site);
    setEditForm({
      siteName: site.siteName,
      domain: site.domain,
      status: site.status,
      cmsType: site.cmsType,
      notes: site.notes,
    });
  };
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: UpdateSiteRequest;
    }) => updateSite(id, body),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['website', 'sites'] });
      setEditing(null);
      toast.success('更新成功');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message ?? '更新失败');
    },
  });

  /* ---------- 删除 ---------- */
  const deleteMutation = useMutation({
    mutationFn: deleteSite,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['website', 'sites'] });
      toast.success('删除成功');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message ?? '删除失败');
    },
  });

  const handleSearch = () => {
    setSearchText(keyword.trim());
    setPage(1);
  };

  return (
    <>
      <SectionCard
        title="站点列表"
        count={sitesData?.total ?? 0}
        actions={
          <Button size="sm" className="h-8 bg-[#2E7DFF] text-white hover:bg-[#1E5FD6]" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            新增站点
          </Button>
        }
      >
        <Toolbar>
          <Select
            value={siteType}
            onValueChange={(v) => {
              setSiteType(v as SiteType | '');
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-[140px] text-[13px]">
              <SelectValue placeholder="全部类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部类型</SelectItem>
              <SelectItem value="enterprise">企业官网</SelectItem>
              <SelectItem value="b2b">B2B 联盟</SelectItem>
            </SelectContent>
          </Select>
          {!isClient && (
            <Select
              value={brandId}
              onValueChange={(v) => {
                setBrandId(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[140px] text-[13px]">
                <SelectValue placeholder="全部品牌" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部品牌</SelectItem>
                {brandOptions.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-[120px] text-[13px]">
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部状态</SelectItem>
              {SITE_STATUS.map((s) => (
                <SelectItem key={s} value={s}>
                  {SITE_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative w-[240px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <Input
              placeholder="搜索站点名或域名"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="h-8 w-full pl-9 text-[13px]"
            />
          </div>
          <Button size="sm" variant="outline" onClick={handleSearch} className="h-8">
            <RefreshCw className="h-3.5 w-3.5" />
            查询
          </Button>
        </Toolbar>

        <div className="pt-4">
          {isError && (
            <div className="mb-4 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 text-sm text-amber-700">
                <AlertCircle className="h-4 w-4" />
                <span>数据加载中，请稍后刷新</span>
              </div>
              <button
                onClick={() => refetch()}
                className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                重新加载
              </button>
            </div>
          )}

          {isLoading ? (
            <TableSkeleton />
          ) : sitesData && sitesData.items.length > 0 ? (
            <>
              <DataTable
                rowKey="id"
                columns={[
                  {
                    key: 'index',
                    title: '序号',
                    width: '8%',
                    render: (_row: SiteNetworkItem & { _index: number }) => (
                      <span className="text-muted-foreground text-[12.5px]">
                        {_row._index + 1}
                      </span>
                    ),
                  },
                  {
                    key: 'siteName',
                    title: '站点名',
                    width: '18%',
                    render: (row: SiteNetworkItem & { _index: number }) => (
                      <span
                        className="font-medium text-[12.5px] text-[#0f172a] truncate block"
                        title={row.siteName}
                      >
                        {row.siteName}
                      </span>
                    ),
                  },
                  {
                    key: 'domain',
                    title: '域名',
                    width: '20%',
                    render: (row: SiteNetworkItem & { _index: number }) => (
                      <span
                        className="text-[12.5px] text-[#2E7DFF] truncate block font-mono"
                        title={row.domain}
                      >
                        {row.domain}
                      </span>
                    ),
                  },
                  {
                    key: 'status',
                    title: '状态',
                    width: '12%',
                    render: (row: SiteNetworkItem & { _index: number }) => (
                      <Pill variant={STATUS_PILL_VARIANT[row.status]}>
                        {SITE_STATUS_LABELS[row.status]}
                      </Pill>
                    ),
                  },
                  {
                    key: 'cmsType',
                    title: 'CMS类型',
                    width: '12%',
                    render: (row: SiteNetworkItem & { _index: number }) => (
                      <span className="text-[12.5px] text-[#5B6B85]">
                        {row.cmsType || '-'}
                      </span>
                    ),
                  },
                  {
                    key: 'notes',
                    title: '备注',
                    width: '18%',
                    render: (row: SiteNetworkItem & { _index: number }) => (
                      <span
                        className="text-[12.5px] text-[#5B6B85] truncate block"
                        title={row.notes || ''}
                      >
                        {row.notes || '-'}
                      </span>
                    ),
                  },
                  {
                    key: 'actions',
                    title: '操作',
                    width: '12%',
                    align: 'right',
                    render: (row: SiteNetworkItem & { _index: number }) => (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => openEdit(row)}
                          style={{ color: PRIMARY }}
                        >
                          <Pencil className="h-3 w-3" />
                          编辑
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          style={{ color: DANGER }}
                          onClick={async () => {
                            if (await showConfirm('确认删除该站点？')) {
                              deleteMutation.mutate(row.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                          删除
                        </Button>
                      </div>
                    ),
                  },
                ]}
                data={sitesData.items.map((s: SiteNetworkItem, i: number) => ({
                  ...s,
                  _index: (page - 1) * PAGE_SIZE + i,
                }))}
              />

              {sitesData.total > 0 && (
                <div className="pt-4">
                  <DataPagination
                    total={sitesData.total}
                    page={page}
                    pageSize={PAGE_SIZE}
                    onPageChange={setPage}
                    onPageSizeChange={() => setPage(1)}
                  />
                </div>
              )}
            </>
          ) : (
            <EmptyState
              icon={<Inbox />}
              description={`暂无${siteType ? SITE_TYPE_LABELS[siteType] : ''}站点数据`}
              action={
                <Button
                  size="sm"
                  className="bg-[#2E7DFF] text-white hover:bg-[#1E5FD6]"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  新增站点
                </Button>
              }
            />
          )}
        </div>
      </SectionCard>

      {/* 新增弹窗 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>新增站点</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">所属品牌</label>
              {isClient ? (
                <div className="h-9 flex items-center px-3 rounded-[8px] border border-border-strong text-sm">
                  {brandOptions.find((b) => b.id === createForm.brandId)
                    ?.name ?? '-'}
                </div>
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
              <label className="text-sm font-medium">站群类型</label>
              <div className="h-9 flex items-center px-3 rounded-[8px] border border-border-strong text-sm">
                {SITE_TYPE_LABELS[createForm.siteType]}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">站点名</label>
              <Input
                value={createForm.siteName}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    siteName: e.target.value,
                  })
                }
                placeholder="请输入站点名称"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">域名</label>
              <Input
                value={createForm.domain}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    domain: e.target.value,
                  })
                }
                placeholder="https://www.example.com"
                className="h-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">状态</label>
                <Select
                  value={createForm.status}
                  onValueChange={(v) =>
                    setCreateForm({
                      ...createForm,
                      status: v as SiteStatus,
                    })
                  }
                >
                  <SelectTrigger className="w-full h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SITE_STATUS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {SITE_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">CMS类型</label>
                <Select
                  value={createForm.cmsType || ''}
                  onValueChange={(v) =>
                    setCreateForm({ ...createForm, cmsType: v })
                  }
                >
                  <SelectTrigger className="w-full h-9">
                    <SelectValue placeholder="请选择" />
                  </SelectTrigger>
                  <SelectContent>
                    {CMS_TYPES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">备注</label>
              <Textarea
                value={createForm.notes || ''}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    notes: e.target.value,
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
                !createForm.siteName.trim() ||
                !createForm.domain.trim() ||
                !createForm.brandId
              }
              onClick={() => createMutation.mutate(createForm)}
            >
              {createMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑弹窗 */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑站点</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">站点名</label>
              <Input
                value={editForm.siteName || ''}
                onChange={(e) =>
                  setEditForm({ ...editForm, siteName: e.target.value })
                }
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">域名</label>
              <Input
                value={editForm.domain || ''}
                onChange={(e) =>
                  setEditForm({ ...editForm, domain: e.target.value })
                }
                className="h-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">状态</label>
                <Select
                  value={editForm.status || ''}
                  onValueChange={(v) =>
                    setEditForm({
                      ...editForm,
                      status: v as SiteStatus,
                    })
                  }
                >
                  <SelectTrigger className="w-full h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SITE_STATUS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {SITE_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">CMS类型</label>
                <Select
                  value={editForm.cmsType || ''}
                  onValueChange={(v) =>
                    setEditForm({ ...editForm, cmsType: v })
                  }
                >
                  <SelectTrigger className="w-full h-9">
                    <SelectValue placeholder="请选择" />
                  </SelectTrigger>
                  <SelectContent>
                    {CMS_TYPES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">备注</label>
              <Textarea
                value={editForm.notes || ''}
                onChange={(e) =>
                  setEditForm({ ...editForm, notes: e.target.value })
                }
                className="min-h-[80px] resize-y"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              取消
            </Button>
            <Button
              style={{ backgroundColor: PRIMARY }}
              disabled={
                updateMutation.isPending ||
                !editForm.siteName?.trim() ||
                !editForm.domain?.trim() ||
                !editing
              }
              onClick={() =>
                editing &&
                updateMutation.mutate({ id: editing.id, body: editForm })
              }
            >
              {updateMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

const TableSkeleton = () => (
  <div
    className="space-y-1 rounded-md border p-4"
    style={{ borderColor: '#E5E9F2' }}
  >
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 h-11">
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-20" />
      </div>
    ))}
  </div>
);

export default WebsiteSitesPage;
