import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Recycle,
  Send,
} from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { SectionCard } from '@client/src/components/layout/SectionCard';
import { Toolbar } from '@client/src/components/layout/Toolbar';
import { Pill } from '@client/src/components/layout/Pill';
import { DataTable } from '@client/src/components/layout/DataTable';
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
import {
  getPublishRecords,
  createPublishRecord,
  updatePublishRecord,
  deletePublishRecord,
  recyclePublishRecord,
  type CreatePublishRecordRequest,
  type UpdatePublishRecordRequest,
} from '@client/src/api/publication';
import { getBrands } from '@client/src/api/brands';
import {
  PUBLISH_STATUS,
  GEO_PUBLISH_STATUS_LABELS as PUBLISH_STATUS_LABELS,
  PUBLICATION_PLATFORMS,
  PUBLICATION_PLATFORM_LABELS,
} from '@shared/api.interface';
import type { PublishRecord, PublishStatus } from '@shared/api.interface';
import { showConfirm } from '@lark-apaas/client-toolkit';
import { UniversalLink } from '@lark-apaas/client-toolkit/components/UniversalLink';

const PRIMARY = '#2563EB';
const DANGER = '#DC2626';
const SUCCESS = '#16A34A';
const MUTED = '#94A3B8';
const WARNING = '#F59E0B';

const DEFAULT_PAGE_SIZE = 10;

const CONTENT_TYPES = [
  { value: 'article', label: '文章' },
  { value: 'image', label: '图文' },
  { value: 'video', label: '视频' },
];

const EXTRA_PLATFORMS: { value: string; label: string }[] = [
  { value: 'baidu', label: '百度' },
  { value: '360', label: '360搜索' },
  { value: 'sogou', label: '搜狗' },
  { value: 'toutiao', label: '头条' },
  { value: 'submission', label: '信源库' },
];

const PLATFORMS = [
  ...PUBLICATION_PLATFORMS.map((p) => ({
    value: p,
    label: PUBLICATION_PLATFORM_LABELS[p],
  })),
  ...EXTRA_PLATFORMS,
];

const STATUS_PILL_VARIANT: Record<PublishStatus, 'success' | 'warning' | 'danger' | 'muted'> = {
  pending: 'warning',
  published: 'success',
  failed: 'danger',
  archived: 'muted',
};

const PublishRecordsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [brandId, setBrandId] = useState<string>('');
  const [contentType, setContentType] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [platform, setPlatform] = useState<string>('');
  const [keyword, setKeyword] = useState<string>('');

  const {
    data: recordsData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [
      'publish',
      'records',
      page,
      brandId,
      contentType,
      status,
      platform,
      keyword,
    ],
    queryFn: () =>
      getPublishRecords({
        page,
        pageSize,
        brandId: brandId || undefined,
        contentType: contentType || undefined,
        status: (status || undefined) as PublishStatus | undefined,
        platform: platform || undefined,
        keyword: keyword || undefined,
      }),
    retry: 2,
    retryDelay: 2000,
  });

  const { data: brandOptions = [] } = useQuery({
    queryKey: ['brands', 'options'],
    queryFn: () => getBrands(),
    retry: 2,
    retryDelay: 2000,
  });

  const totalPages = useMemo(() => {
    if (!recordsData) return 1;
    return Math.max(1, Math.ceil(recordsData.total / pageSize));
  }, [recordsData]);

  /* ---------- 新增弹窗 ---------- */
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreatePublishRecordRequest>({
    brandId: '',
    contentType: 'article',
    title: '',
    externalUrl: '',
    platform: '',
    status: 'pending',
    publishDate: '',
    notes: '',
  });
  const createMutation = useMutation({
    mutationFn: createPublishRecord,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publish', 'records'] });
      setCreateOpen(false);
      setCreateForm({
        brandId: '',
        contentType: 'article',
        title: '',
        externalUrl: '',
        platform: '',
        status: 'pending',
        publishDate: '',
        notes: '',
      });
    },
  });

  /* ---------- 编辑弹窗 ---------- */
  const [editing, setEditing] = useState<PublishRecord | null>(null);
  const [editForm, setEditForm] = useState<UpdatePublishRecordRequest>({});
  const openEdit = (record: PublishRecord) => {
    setEditing(record);
    setEditForm({
      brandId: record.brandId,
      taskId: record.taskId,
      contentType: record.contentType,
      title: record.title,
      externalUrl: record.externalUrl,
      platform: record.platform,
      status: record.status,
      publishDate: record.publishDate,
      notes: record.notes,
    });
  };
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: UpdatePublishRecordRequest;
    }) => updatePublishRecord(id, body),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publish', 'records'] });
      setEditing(null);
    },
  });

  /* ---------- 删除 ---------- */
  const deleteMutation = useMutation({
    mutationFn: deletePublishRecord,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publish', 'records'] });
    },
  });

  /* ---------- 回收外链 ---------- */
  const recycleMutation = useMutation({
    mutationFn: recyclePublishRecord,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publish', 'records'] });
    },
  });

  const handleSearch = () => {
    setPage(1);
  };

  const getContentTypeLabel = (type: string) => {
    return CONTENT_TYPES.find((t) => t.value === type)?.label ?? type;
  };

  const getPlatformLabel = (p: string | null) => {
    if (!p) return '-';
    return PLATFORMS.find((pl) => pl.value === p)?.label ?? p;
  };

  const statusDotColor = (s: PublishStatus): string => {
    switch (s) {
      case 'published':
        return '#12B76A';
      case 'pending':
        return '#F79009';
      case 'failed':
        return '#F04438';
      case 'archived':
        return '#8A93A6';
      default:
        return '#8A93A6';
    }
  };

  return (
    <>
      <SectionCard
        title="发布记录"
        count={recordsData?.total ?? 0}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              刷新
            </Button>
            <Button
              size="sm"
              style={{ backgroundColor: PRIMARY }}
              onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            登记发布
          </Button>
        </>
      }
    >
      <Toolbar>
        <Select value={brandId} onValueChange={setBrandId}>
          <SelectTrigger className="w-40 h-9">
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
        <Select value={contentType} onValueChange={setContentType}>
          <SelectTrigger className="w-28 h-9">
            <SelectValue placeholder="全部类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">全部类型</SelectItem>
            {CONTENT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-28 h-9">
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">全部状态</SelectItem>
            {PUBLISH_STATUS.map((s) => (
              <SelectItem key={s} value={s}>
                {PUBLISH_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={platform} onValueChange={setPlatform}>
          <SelectTrigger className="w-32 h-9">
            <SelectValue placeholder="全部平台" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">全部平台</SelectItem>
            {PLATFORMS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative w-[260px]">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
            style={{ color: MUTED }}
          />
          <Input
            placeholder="搜索标题或外链"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-9 h-9"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleSearch}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          查询
        </Button>
      </Toolbar>

      {isError ? (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-4 mb-4">
          <div className="flex items-center gap-2 text-sm" style={{ color: '#b45309' }}>
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
        <DataTable
          rowClassName={(row: PublishRecord) =>
            row.isDuplicate ? 'text-slate-400 opacity-60' : ''
          }
          columns={[
            { key: 'index', title: '序号', width: '80px', render: (row: any) => (
              <span>{(page - 1) * pageSize + row._idx + 1}</span>
            )},
            { key: 'title', title: '标题', render: (row: PublishRecord) => (
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium truncate" title={row.title || ''} style={{ color: row.isDuplicate ? undefined : '#0F172A' }}>
                  {row.title || '-'}
                </span>
                {row.isDuplicate && (
                  <Pill variant="muted">重复登记</Pill>
                )}
              </div>
            )},
            { key: 'contentType', title: '类型', width: '100px', render: (row: PublishRecord) => (
              <span className="text-[#5B6B85]">{getContentTypeLabel(row.contentType)}</span>
            )},
            { key: 'platform', title: '平台', width: '120px', render: (row: PublishRecord) => (
              <span className="text-[#5B6B85]">{getPlatformLabel(row.platform)}</span>
            )},
            { key: 'status', title: '状态', width: '100px', render: (row: PublishRecord) => (
              <Pill variant={STATUS_PILL_VARIANT[row.status]}>
                {PUBLISH_STATUS_LABELS[row.status]}
              </Pill>
            )},
            { key: 'externalUrl', title: '外链', width: '200px', render: (row: PublishRecord) => (
              row.externalUrl ? (
                <UniversalLink
                  to={row.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[13px] hover:underline"
                  style={{ color: PRIMARY }}
                >
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  查看
                </UniversalLink>
              ) : (
                <span className="text-[#5B6B85]">-</span>
              )
            )},
            { key: 'publishDate', title: '发布时间', width: '140px', render: (row: PublishRecord) => (
              <span className="text-[#5B6B85]">
                {row.publishDate
                  ? new Date(row.publishDate).toLocaleDateString('zh-CN')
                  : '-'}
              </span>
            )},
            { key: 'actions', title: '操作', width: '180px', align: 'right', render: (row: PublishRecord) => (
              <div className="flex items-center justify-end gap-2 flex-nowrap whitespace-nowrap">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => openEdit(row)}
                  style={{ color: row.isDuplicate ? '#94A3B8' : PRIMARY }}
                >
                  <Pencil className="h-3 w-3" />
                  编辑
                </Button>
                {row.status === 'published' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    style={{ color: row.isDuplicate ? '#94A3B8' : '#f97316' }}
                    onClick={async () => {
                      if (
                        await showConfirm(
                          '确认回收该外链？回收后状态将变为已回收。',
                        )
                      ) {
                        recycleMutation.mutate(row.id);
                      }
                    }}
                  >
                    <Recycle className="h-3 w-3" />
                    回收
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  style={{ color: row.isDuplicate ? '#94A3B8' : DANGER }}
                  onClick={async () => {
                    if (
                      await showConfirm(
                        '确认删除该发布记录？',
                      )
                    ) {
                      deleteMutation.mutate(row.id);
                    }
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                  删除
                </Button>
              </div>
            )},
          ]}
          data={(recordsData?.items || []).map((item, i) => ({ ...item, _idx: i }))}
          rowKey="id"
          emptyText="暂无发稿记录"
          emptyAction={
            <Button
              size="sm"
              style={{ backgroundColor: PRIMARY }}
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              登记发布
            </Button>
          }
          pagination={recordsData ? {
            total: recordsData.total,
            page,
            pageSize,
            onPageChange: setPage,
            onPageSizeChange: (size) => {
              setPageSize(size);
              setPage(1);
            },
          } : undefined}
        />
      )}

    </SectionCard>

      {/* 登记占位弹窗 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>登记发布记录</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-[70vh] overflow-y-auto">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">品牌</label>
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
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">内容类型</label>
              <Select
                value={createForm.contentType}
                onValueChange={(v) =>
                  setCreateForm({ ...createForm, contentType: v })
                }
              >
                <SelectTrigger className="w-full h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">标题</label>
              <Input
                value={createForm.title || ''}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    title: e.target.value,
                  })
                }
                placeholder="请输入内容标题"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">平台</label>
              <Select
                value={createForm.platform || ''}
                onValueChange={(v) =>
                  setCreateForm({ ...createForm, platform: v })
                }
              >
                <SelectTrigger className="w-full h-9">
                  <SelectValue placeholder="请选择平台" />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">外链</label>
              <Input
                value={createForm.externalUrl || ''}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    externalUrl: e.target.value,
                  })
                }
                placeholder="https://..."
                className="h-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">状态</label>
                <Select
                  value={createForm.status || 'pending'}
                  onValueChange={(v) =>
                    setCreateForm({
                      ...createForm,
                      status: v as PublishStatus,
                    })
                  }
                >
                  <SelectTrigger className="w-full h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PUBLISH_STATUS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {PUBLISH_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">发布日期</label>
                <Input
                  type="date"
                  value={createForm.publishDate || ''}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      publishDate: e.target.value,
                    })
                  }
                  className="h-9"
                />
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
              disabled={createMutation.isPending || !createForm.brandId}
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
            <DialogTitle>编辑发布记录</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-[70vh] overflow-y-auto">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">品牌</label>
              <Select
                value={editForm.brandId || ''}
                onValueChange={(v) =>
                  setEditForm({ ...editForm, brandId: v })
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
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">内容类型</label>
              <Select
                value={editForm.contentType || ''}
                onValueChange={(v) =>
                  setEditForm({ ...editForm, contentType: v })
                }
              >
                <SelectTrigger className="w-full h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">标题</label>
              <Input
                value={editForm.title || ''}
                onChange={(e) =>
                  setEditForm({ ...editForm, title: e.target.value })
                }
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">平台</label>
              <Select
                value={editForm.platform || ''}
                onValueChange={(v) =>
                  setEditForm({ ...editForm, platform: v })
                }
              >
                <SelectTrigger className="w-full h-9">
                  <SelectValue placeholder="请选择平台" />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">外链</label>
              <Input
                value={editForm.externalUrl || ''}
                onChange={(e) =>
                  setEditForm({ ...editForm, externalUrl: e.target.value })
                }
                placeholder="https://..."
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
                      status: v as PublishStatus,
                    })
                  }
                >
                  <SelectTrigger className="w-full h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PUBLISH_STATUS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {PUBLISH_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">发布日期</label>
                <Input
                  type="date"
                  value={editForm.publishDate || ''}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      publishDate: e.target.value,
                    })
                  }
                  className="h-9"
                />
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
                !editForm.brandId ||
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
  <div className="space-y-2 rounded-md border p-4">
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="flex items-center gap-4">
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-24" />
      </div>
    ))}
  </div>
);

export default PublishRecordsPage;
