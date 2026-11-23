import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Link2,
  ExternalLink as ExternalLinkIcon,
  FileCheck,
  Search,
  Plus,
  Sparkles,
  Check,
  X,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@client/src/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@client/src/components/ui/card';
import { Badge } from '@client/src/components/ui/badge';
import { Checkbox } from '@client/src/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@client/src/components/ui/dialog';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@client/src/components/ui/table';
import { DataTable } from '@client/src/components/layout';
import { getApiErrorMessage } from '@client/src/lib/api-error';
import {
  getInternalLinks,
  generateInternalLinks,
  createInternalLink,
  updateInternalLinkStatus,
  getExternalLinks,
  getExternalLinkOverview,
  createExternalLink,
  getPageChecks,
  createPageCheck,
  getIndexChecks,
  createIndexCheck,
} from '@client/src/api/geo-loop';
import type {
  InternalLink,
  InternalLinkStatus,
  ExternalLink,
  ExternalLinkStatus,
  ExternalLinkType,
  PageCheck,
  PageCheckCreateRequest,
  IndexCheck,
  SearchEngine,
  WeightTier,
} from '@shared/api.interface';
import {
  INTERNAL_LINK_STATUS_LABELS,
  EXTERNAL_LINK_TYPE_LABELS,
  EXTERNAL_LINK_STATUS_LABELS,
  EXTERNAL_LINK_TYPES,
  SEARCH_ENGINE_LABELS,
  SEARCH_ENGINES,
  INDEXED_STATUS_LABELS,
  WEIGHT_TIER_LABELS,
  WEIGHT_TIERS,
} from '@shared/api.interface';

interface IndexingStepProps {
  brandId: string;
  showSkeleton?: boolean;
}

/* ---------- 主组件 ---------- */

export function IndexingStep({ brandId, showSkeleton }: IndexingStepProps) {
  return (
    <div className="space-y-5 min-w-0">
      {/* 行 1：内链计划 + 外链台账，<1536px上下堆叠，≥1536px左右两列 */}
      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-5 items-stretch">
        <div className="min-w-0 flex flex-col">
          <InternalLinksCard brandId={brandId} showSkeleton={showSkeleton} />
        </div>
        <div className="min-w-0 flex flex-col">
          <ExternalLinksCard brandId={brandId} showSkeleton={showSkeleton} />
        </div>
      </div>
      {/* 行 2：页面体检（全宽） */}
      <div className="min-w-0">
        <PageCheckCard brandId={brandId} showSkeleton={showSkeleton} />
      </div>
      {/* 行 3：收录提交记录（全宽） */}
      <div className="min-w-0">
        <IndexCheckCard brandId={brandId} showSkeleton={showSkeleton} />
      </div>
    </div>
  );
}

/* ---------- 内链计划卡 ---------- */

function InternalLinksCard({ brandId, showSkeleton }: IndexingStepProps) {
  const queryClient = useQueryClient();
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const {
    data: links,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['geo-loop', 'internal-links', brandId],
    queryFn: () => getInternalLinks(brandId),
  });

  const generateMutation = useMutation({
    mutationFn: () => generateInternalLinks(brandId),
    retry: false,
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ['geo-loop', 'internal-links', brandId],
      });
      toast.success(`已生成 ${data.generated} 条内链建议`);
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, '生成失败'));
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: InternalLinkStatus }) =>
      updateInternalLinkStatus(id, status),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['geo-loop', 'internal-links', brandId],
      });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, '状态更新失败'));
    },
  });

  const cycleStatus = (current: InternalLinkStatus): InternalLinkStatus => {
    if (current === 'planned') return 'added';
    if (current === 'added') return 'indexed';
    return 'planned';
  };

  const handleStatusClick = (id: string, current: InternalLinkStatus) => {
    updateStatusMutation.mutate({ id, status: cycleStatus(current) });
  };

  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Link2 className="h-4 w-4 text-[#2E7DFF]" />
          内链计划
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
          >
            <Sparkles
              className={
                'h-3.5 w-3.5 ' +
                (generateMutation.isPending ? 'animate-spin' : '')
              }
            />
            生成建议
          </Button>
          <Button size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            新增
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        {showSkeleton || isLoading ? (
          <LinkListSkeleton cols={5} />
        ) : isError ? (
          <ErrorState onRetry={refetch} />
        ) : !links?.length ? (
          <EmptyState text="暂无内链计划，点击生成建议或手动新增" />
        ) : (
          <DataTable
            rowKey="id"
            data={links.slice(0, 5)}
            emptyText="暂无内链计划，点击生成建议或手动新增"
            columns={[
              {
                key: 'fromTitle',
                title: '源页标题',
                width: '22%',
                render: (row: InternalLink) => (
                  <span className="text-[13px] text-[#0F172A] truncate whitespace-nowrap block w-full" title={row.fromTitle ?? '未命名'}>
                    {row.fromTitle ?? '未命名'}
                  </span>
                ),
              },
              {
                key: 'toTitle',
                title: '目标页标题',
                width: '22%',
                render: (row: InternalLink) => (
                  <span className="text-[13px] text-[#0F172A] truncate whitespace-nowrap block w-full" title={row.toTitle ?? '未命名'}>
                    {row.toTitle ?? '未命名'}
                  </span>
                ),
              },
              {
                key: 'anchorText',
                title: '锚文本',
                width: '18%',
                render: (row: InternalLink) => (
                  <span className="text-[13px] text-[#475569] truncate whitespace-nowrap block w-full" title={row.anchorText ?? ''}>
                    {row.anchorText ?? '-'}
                  </span>
                ),
              },
              {
                key: 'status',
                title: '状态',
                width: '14%',
                render: (row: InternalLink) => (
                  <button onClick={() => handleStatusClick(row.id, row.status)} className="inline-flex" aria-label="切换状态">
                    <InternalLinkStatusBadge status={row.status} />
                  </button>
                ),
              },
              {
                key: 'action',
                title: '操作',
                width: '20%',
                render: (row: InternalLink) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStatusClick(row.id, row.status)}
                    className="h-7 px-2 text-xs text-[#2563EB]"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    切换
                  </Button>
                ),
              },
            ]}
          />
        )}
      </CardContent>

      <AddInternalLinkDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        brandId={brandId}
        onSuccess={() => {
          queryClient.invalidateQueries({
            queryKey: ['geo-loop', 'internal-links', brandId],
          });
        }}
      />
    </Card>
  );
}

function InternalLinkRow({
  link,
  onStatusClick,
}: {
  link: InternalLink;
  onStatusClick: () => void;
}) {
  return (
    <TableRow className="h-11">
      <TableCell className="px-3">
        <div
          className="text-sm text-slate-800 truncate"
          title={link.fromTitle ?? link.fromUrl ?? ''}
        >
          {link.fromTitle ?? '未命名'}
        </div>
      </TableCell>
      <TableCell className="px-3">
        <div
          className="text-sm text-slate-800 truncate"
          title={link.toTitle ?? link.toUrl ?? ''}
        >
          {link.toTitle ?? '未命名'}
        </div>
      </TableCell>
      <TableCell className="px-3">
        <div
          className="text-sm text-slate-600 truncate"
          title={link.anchorText ?? ''}
        >
          {link.anchorText ?? '-'}
        </div>
      </TableCell>
      <TableCell className="px-3">
        <button onClick={onStatusClick} className="inline-flex" aria-label="切换状态">
          <InternalLinkStatusBadge status={link.status} />
        </button>
      </TableCell>
      <TableCell className="px-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onStatusClick}
          className="h-7 px-2 text-xs text-[#2E7DFF]"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          切换
        </Button>
      </TableCell>
    </TableRow>
  );
}

function InternalLinkStatusBadge({ status }: { status: InternalLinkStatus }) {
  const colorMap: Record<InternalLinkStatus, string> = {
    planned: 'bg-slate-100 text-slate-600 border-slate-200',
    added: 'bg-blue-50 text-blue-600 border-blue-100',
    indexed: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  };
  return (
    <Badge
      variant="outline"
      className={
        'h-5 px-1.5 text-[11px] font-normal whitespace-nowrap ' + colorMap[status]
      }
    >
      {INTERNAL_LINK_STATUS_LABELS[status]}
    </Badge>
  );
}

function AddInternalLinkDialog({
  open,
  onOpenChange,
  brandId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  brandId: string;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const [fromUrl, setFromUrl] = useState('');
  const [toUrl, setToUrl] = useState('');
  const [anchorText, setAnchorText] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      createInternalLink({
        brandId,
        fromUrl,
        toUrl,
        anchorText,
        status: 'planned',
      }),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['geo-loop', 'internal-links', brandId],
      });
      onSuccess();
      onOpenChange(false);
      setFromUrl('');
      setToUrl('');
      setAnchorText('');
      toast.success('已添加内链');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, '添加失败'));
    },
  });

  const handleSubmit = () => {
    if (!fromUrl || !toUrl) {
      toast.error('请填写源页和目标页 URL');
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新增内链</DialogTitle>
          <DialogDescription>手动添加一条内链计划</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">源页 URL</label>
            <Input
              value={fromUrl}
              onChange={(e) => setFromUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">目标页 URL</label>
            <Input
              value={toUrl}
              onChange={(e) => setToUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">锚文本</label>
            <Input
              value={anchorText}
              onChange={(e) => setAnchorText(e.target.value)}
              placeholder="点击查看详情"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={mutation.isPending}>
            添加
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- 外链台账卡 ---------- */

function ExternalLinksCard({ brandId, showSkeleton }: IndexingStepProps) {
  const queryClient = useQueryClient();
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const {
    data: links,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['geo-loop', 'external-links', brandId],
    queryFn: () => getExternalLinks(brandId),
  });

  const { data: overview } = useQuery({
    queryKey: ['geo-loop', 'external-link-overview', brandId],
    queryFn: () => getExternalLinkOverview(brandId),
  });

  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <ExternalLinkIcon className="h-4 w-4 text-[#2E7DFF]" />
          外链台账
        </CardTitle>
        <Button size="sm" onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          新增外链
        </Button>
      </CardHeader>
      <CardContent className="p-5 pt-0 space-y-3">
        {/* 顶部 3 个数字 */}
        <div className="grid grid-cols-3 gap-2">
          {showSkeleton || isLoading ? (
            <>
              <StatMiniSkeleton />
              <StatMiniSkeleton />
              <StatMiniSkeleton />
            </>
          ) : (
            <>
              <StatMini label="总数" value={overview?.total ?? 0} color="slate" />
              <StatMini label="已收录" value={overview?.indexed ?? 0} color="emerald" />
              <StatMini label="待提交" value={overview?.pending ?? 0} color="amber" />
            </>
          )}
        </div>

        {showSkeleton || isLoading ? (
          <LinkListSkeleton cols={7} />
        ) : isError ? (
          <ErrorState onRetry={refetch} />
        ) : !links?.length ? (
          <EmptyState text="暂无外链记录" />
        ) : (
          <DataTable
            rowKey="id"
            data={links.slice(0, 4)}
            emptyText="暂无外链记录"
            columns={[
              {
                key: 'resourceName',
                title: '资源名',
                width: '16%',
                render: (row: ExternalLink) => (
                  <span className="text-[13px] text-[#0F172A] truncate whitespace-nowrap block w-full" title={row.resourceName}>
                    {row.resourceName}
                  </span>
                ),
              },
              {
                key: 'resourceType',
                title: '类型',
                width: '9%',
                render: (row: ExternalLink) => (
                  <LinkTypeBadge type={row.resourceType} />
                ),
              },
              {
                key: 'domain',
                title: '域名',
                width: '16%',
                render: (row: ExternalLink) => (
                  <span className="text-[12px] text-[#94A3B8] truncate whitespace-nowrap block w-full" title={row.domain ?? ''}>
                    {row.domain ?? '-'}
                  </span>
                ),
              },
              {
                key: 'domainWeight',
                title: '权重',
                width: '8%',
                render: (row: ExternalLink) => (
                  row.domainWeight ? (
                    <Badge
                      variant="outline"
                      className="h-5 px-1.5 text-[10px] border-[#E6EAF2] text-[#475569] bg-[#F8FAFC] whitespace-nowrap"
                    >
                      {row.domainWeight}
                    </Badge>
                  ) : null
                ),
              },
              {
                key: 'linkUrl',
                title: '链接',
                width: '22%',
                render: (row: ExternalLink) => (
                  <span className="text-[12px] text-[#2563EB] truncate whitespace-nowrap block min-w-[220px]" title={row.linkUrl ?? ''}>
                    {row.linkUrl ?? '-'}
                  </span>
                ),
              },
              {
                key: 'submittedAt',
                title: '提交日',
                width: '14%',
                render: (row: ExternalLink) => (
                  <span className="text-[12px] text-[#94A3B8] tabular-nums">
                    {row.submittedAt ? row.submittedAt.slice(0, 10) : '-'}
                  </span>
                ),
              },
              {
                key: 'status',
                title: '状态',
                width: '12%',
                render: (row: ExternalLink) => (
                  <ExternalLinkStatusBadge status={row.status} />
                ),
              },
            ]}
          />
        )}
      </CardContent>

      <AddExternalLinkDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        brandId={brandId}
        onSuccess={() => {
          queryClient.invalidateQueries({
            queryKey: ['geo-loop', 'external-links', brandId],
          });
          queryClient.invalidateQueries({
            queryKey: ['geo-loop', 'external-link-overview', brandId],
          });
        }}
      />
    </Card>
  );
}

function ExternalLinkRow({ link }: { link: ExternalLink }) {
  const submittedLabel = link.submittedAt
    ? link.submittedAt.slice(0, 10)
    : '-';
  return (
    <TableRow className="h-11">
      <TableCell className="px-2">
        <div
          className="text-sm text-slate-800 truncate"
          title={link.resourceName}
        >
          {link.resourceName}
        </div>
      </TableCell>
      <TableCell className="px-2">
        <LinkTypeBadge type={link.resourceType} />
      </TableCell>
      <TableCell className="px-2">
        <div
          className="text-xs text-slate-500 truncate"
          title={link.domain ?? ''}
        >
          {link.domain ?? '-'}
        </div>
      </TableCell>
      <TableCell className="px-2">
        {link.domainWeight && (
          <Badge
            variant="outline"
            className="h-5 px-1.5 text-[10px] border-slate-200 text-slate-600 bg-slate-50"
          >
            {link.domainWeight}
          </Badge>
        )}
      </TableCell>
      <TableCell className="px-2">
        <div
          className="text-xs text-[#2E7DFF] truncate"
          title={link.linkUrl ?? ''}
        >
          {link.linkUrl ?? '-'}
        </div>
      </TableCell>
      <TableCell className="px-2">
        <span className="text-xs text-slate-500 tnum">{submittedLabel}</span>
      </TableCell>
      <TableCell className="px-2">
        <ExternalLinkStatusBadge status={link.status} />
      </TableCell>
    </TableRow>
  );
}

function LinkTypeBadge({ type }: { type: ExternalLinkType }) {
  const colorMap: Record<ExternalLinkType, string> = {
    news: 'bg-blue-50 text-blue-600 border-blue-100',
    baike: 'bg-purple-50 text-purple-600 border-purple-100',
    forum: 'bg-amber-50 text-amber-600 border-amber-100',
    self_media: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  };
  return (
    <Badge
      variant="outline"
      className={
        'h-5 px-1.5 text-[10px] font-normal whitespace-nowrap ' + colorMap[type]
      }
    >
      {EXTERNAL_LINK_TYPE_LABELS[type]}
    </Badge>
  );
}

function ExternalLinkStatusBadge({ status }: { status: ExternalLinkStatus }) {
  const colorMap: Record<ExternalLinkStatus, string> = {
    pending: 'bg-amber-50 text-amber-600 border-amber-100',
    indexed: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    rejected: 'bg-red-50 text-red-500 border-red-100',
  };
  return (
    <Badge
      variant="outline"
      className={
        'h-5 px-1.5 text-[10px] font-normal whitespace-nowrap ' + colorMap[status]
      }
    >
      {EXTERNAL_LINK_STATUS_LABELS[status]}
    </Badge>
  );
}

function AddExternalLinkDialog({
  open,
  onOpenChange,
  brandId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  brandId: string;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const [resourceName, setResourceName] = useState('');
  const [resourceType, setResourceType] = useState<ExternalLinkType>('news');
  const [domain, setDomain] = useState('');
  const [domainWeight, setDomainWeight] = useState<WeightTier>('B');
  const [linkUrl, setLinkUrl] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      createExternalLink({
        brandId,
        resourceName,
        resourceType,
        domain,
        domainWeight,
        linkUrl,
        status: 'pending',
      }),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['geo-loop', 'external-links', brandId],
      });
      queryClient.invalidateQueries({
        queryKey: ['geo-loop', 'external-link-overview', brandId],
      });
      onSuccess();
      onOpenChange(false);
      setResourceName('');
      setDomain('');
      setLinkUrl('');
      toast.success('已添加外链');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, '添加失败'));
    },
  });

  const handleSubmit = () => {
    if (!resourceName) {
      toast.error('请填写资源名');
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新增外链</DialogTitle>
          <DialogDescription>记录一条外链资源到台账</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">资源名</label>
            <Input
              value={resourceName}
              onChange={(e) => setResourceName(e.target.value)}
              placeholder="如：XX 新闻报道"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">类型</label>
              <Select
                value={resourceType}
                onValueChange={(v) => setResourceType(v as ExternalLinkType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXTERNAL_LINK_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {EXTERNAL_LINK_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">权重</label>
              <Select
                value={domainWeight}
                onValueChange={(v) => setDomainWeight(v as WeightTier)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEIGHT_TIERS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}档
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">域名</label>
            <Input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="example.com"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">链接 URL</label>
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={mutation.isPending}>
            添加
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatMini({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: 'slate' | 'emerald' | 'amber';
}) {
  const colorMap = {
    slate: 'text-slate-700',
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
  } as const;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-center min-w-0 overflow-hidden">
      <div className={'text-lg font-bold tnum ' + colorMap[color]}>{value}</div>
      <div className="text-[11px] text-slate-500 whitespace-nowrap">{label}</div>
    </div>
  );
}

function StatMiniSkeleton() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-center">
      <Skeleton className="mx-auto h-5 w-10" />
      <Skeleton className="mx-auto mt-1 h-3 w-8" />
    </div>
  );
}

function LinkListSkeleton({ cols }: { cols: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex h-11 items-center gap-2 border-b border-slate-100 px-3"
        >
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton
              key={j}
              className="h-4"
              style={{ width: `${80 + Math.random() * 40}px` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ---------- 页面体检卡 ---------- */

function PageCheckCard({ brandId, showSkeleton }: IndexingStepProps) {
  const queryClient = useQueryClient();
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const {
    data: checks,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['geo-loop', 'page-checks', brandId],
    queryFn: () => getPageChecks(brandId),
  });

  const latest = checks?.[0];

  const checkItems = latest
    ? [
        { label: 'JSON-LD', ok: latest.hasJsonld },
        { label: 'FAQ 模块', ok: latest.hasFaq },
        { label: '首段答案块', ok: latest.hasAnswerBlock },
        { label: 'H 层级结构', ok: latest.hLevelOk },
        { label: '内链数充足', ok: latest.internalLinkCount >= 3 },
      ]
    : [];

  const suggestionList = latest?.suggestions
    ? Object.values(latest.suggestions).filter(Boolean)
    : [];

  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <FileCheck className="h-4 w-4 text-[#2E7DFF]" />
          页面体检
        </CardTitle>
        <Button size="sm" onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          新增体检
        </Button>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        {showSkeleton || isLoading ? (
          <PageCheckSkeleton />
        ) : isError ? (
          <ErrorState onRetry={refetch} />
        ) : !latest ? (
          <EmptyState text="暂无体检记录，点击右上角新增" />
        ) : (
          <div className="space-y-3">
            {/* URL */}
            <div
              className="text-xs text-[#2E7DFF] truncate"
              title={latest.pageUrl}
            >
              {latest.pageUrl}
            </div>

            <div className="flex items-start gap-4">
              {/* 得分 */}
              <div className="flex flex-col items-center shrink-0 min-w-0 overflow-hidden">
                <div className="text-4xl font-bold text-[#2E7DFF] tnum">
                  {latest.score ?? 0}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 whitespace-nowrap">/ 100</div>
              </div>
              {/* 5 项检查 */}
              <div className="flex-1 grid grid-cols-1 gap-1.5">
                {checkItems.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-2 text-xs"
                  >
                    {item.ok ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <X className="h-3.5 w-3.5 text-red-400 shrink-0" />
                    )}
                    <span className="text-slate-600">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 建议 */}
            {suggestionList.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <div className="text-xs font-medium text-slate-600 mb-1.5">
                  优化建议
                </div>
                <ul className="space-y-1">
                  {suggestionList.slice(0, 3).map((s, i) => (
                    <li
                      key={i}
                      className="text-xs text-slate-500 flex items-start gap-1.5"
                    >
                      <span className="text-[#2E7DFF] mt-0.5">·</span>
                      <span className="leading-relaxed">{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <AddPageCheckDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        brandId={brandId}
        onSuccess={() => {
          queryClient.invalidateQueries({
            queryKey: ['geo-loop', 'page-checks', brandId],
          });
        }}
      />
    </Card>
  );
}

function PageCheckSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-3 w-48" />
      <div className="flex items-start gap-4">
        <Skeleton className="h-14 w-16" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="space-y-1 pt-2 border-t border-slate-100">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 flex-1 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  );
}

function AddPageCheckDialog({
  open,
  onOpenChange,
  brandId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  brandId: string;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const [pageUrl, setPageUrl] = useState('');
  const [hasJsonld, setHasJsonld] = useState(false);
  const [hasFaq, setHasFaq] = useState(false);
  const [hasAnswerBlock, setHasAnswerBlock] = useState(false);
  const [hLevelOk, setHLevelOk] = useState(false);
  const [internalLinkCount, setInternalLinkCount] = useState<string>('0');
  const [note, setNote] = useState('');

  const mutation = useMutation({
    mutationFn: (): Promise<PageCheck> => {
      const body: PageCheckCreateRequest = {
        brandId,
        pageUrl,
        hasJsonld,
        hasFaq,
        hasAnswerBlock,
        hLevelOk,
        internalLinkCount: Number(internalLinkCount) || 0,
        note: note || undefined,
      };
      return createPageCheck(body);
    },
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['geo-loop', 'page-checks', brandId],
      });
      onSuccess();
      onOpenChange(false);
      setPageUrl('');
      setHasJsonld(false);
      setHasFaq(false);
      setHasAnswerBlock(false);
      setHLevelOk(false);
      setInternalLinkCount('0');
      setNote('');
      toast.success('已添加体检记录');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, '添加失败'));
    },
  });

  const handleSubmit = () => {
    if (!pageUrl) {
      toast.error('请填写页面 URL');
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新增页面体检</DialogTitle>
          <DialogDescription>手动录入一次页面体检结果</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">页面 URL</label>
            <Input
              value={pageUrl}
              onChange={(e) => setPageUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">检查项</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'JSON-LD', value: hasJsonld, onChange: setHasJsonld },
                { label: 'FAQ 模块', value: hasFaq, onChange: setHasFaq },
                { label: '首段答案块', value: hasAnswerBlock, onChange: setHasAnswerBlock },
                { label: 'H 层级结构', value: hLevelOk, onChange: setHLevelOk },
              ].map((item) => (
                <label
                  key={item.label}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox
                    checked={item.value}
                    onCheckedChange={(checked) =>
                      item.onChange(checked === true)
                    }
                    aria-label={item.label}
                  />
                  <span className="text-sm text-slate-700">{item.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">内链数</label>
            <Input
              type="number"
              value={internalLinkCount}
              onChange={(e) => setInternalLinkCount(e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">备注</label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="选填"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={mutation.isPending}>
            添加
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- 收录提交记录卡 ---------- */

function IndexCheckCard({ brandId, showSkeleton }: IndexingStepProps) {
  const queryClient = useQueryClient();
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const {
    data: checks,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['geo-loop', 'index-checks', brandId],
    queryFn: () => getIndexChecks(brandId),
  });

  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Search className="h-4 w-4 text-[#2E7DFF]" />
          收录提交记录
        </CardTitle>
        <Button size="sm" onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          提交收录
        </Button>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        {showSkeleton || isLoading ? (
          <LinkListSkeleton cols={4} />
        ) : isError ? (
          <ErrorState onRetry={refetch} />
        ) : !checks?.length ? (
          <EmptyState text="暂无收录提交记录" />
        ) : (
          <DataTable
            rowKey="id"
            data={checks.slice(0, 5)}
            emptyText="暂无收录提交记录"
            columns={[
              {
                key: 'url',
                title: 'URL',
                width: '38%',
                render: (row: IndexCheck) => (
                  <span className="text-[13px] text-[#0F172A] break-all">
                    {row.url}
                  </span>
                ),
              },
              {
                key: 'searchEngine',
                title: '搜索引擎',
                width: '18%',
                render: (row: IndexCheck) => (
                  <span className="text-[12px] text-[#94A3B8]">
                    {SEARCH_ENGINE_LABELS[row.searchEngine]}
                  </span>
                ),
              },
              {
                key: 'submittedAt',
                title: '提交日',
                width: '22%',
                render: (row: IndexCheck) => (
                  <span className="text-[12px] text-[#94A3B8] tabular-nums">
                    {row.submittedAt ? row.submittedAt.slice(0, 10) : '-'}
                  </span>
                ),
              },
              {
                key: 'indexed',
                title: '状态',
                width: '22%',
                render: (row: IndexCheck) => (
                  <IndexedStatusBadge status={row.indexed} />
                ),
              },
            ]}
          />
        )}
      </CardContent>

      <AddIndexCheckDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        brandId={brandId}
        onSuccess={() => {
          queryClient.invalidateQueries({
            queryKey: ['geo-loop', 'index-checks', brandId],
          });
        }}
      />
    </Card>
  );
}

function IndexCheckRow({ check }: { check: IndexCheck }) {
  const submittedLabel = check.submittedAt
    ? check.submittedAt.slice(0, 10)
    : '-';
  return (
    <TableRow className="h-11">
      <TableCell className="px-3">
        <div
          className="text-sm text-slate-800 truncate"
          title={check.url}
        >
          {check.url}
        </div>
      </TableCell>
      <TableCell className="px-3">
        <span className="text-xs text-slate-500">
          {SEARCH_ENGINE_LABELS[check.searchEngine]}
        </span>
      </TableCell>
      <TableCell className="px-3">
        <span className="text-xs text-slate-500 tnum">{submittedLabel}</span>
      </TableCell>
      <TableCell className="px-3">
        <IndexedStatusBadge status={check.indexed} />
      </TableCell>
    </TableRow>
  );
}

function IndexedStatusBadge({ status }: { status: IndexCheck['indexed'] }) {
  const colorMap: Record<IndexCheck['indexed'], string> = {
    yes: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    no: 'bg-red-50 text-red-500 border-red-100',
    unknown: 'bg-slate-100 text-slate-500 border-slate-200',
  };
  return (
    <Badge
      variant="outline"
      className={
        'h-5 px-1.5 text-[11px] font-normal whitespace-nowrap ' + colorMap[status]
      }
    >
      {INDEXED_STATUS_LABELS[status]}
    </Badge>
  );
}

function AddIndexCheckDialog({
  open,
  onOpenChange,
  brandId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  brandId: string;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState('');
  const [searchEngine, setSearchEngine] = useState<SearchEngine>('baidu');

  const mutation = useMutation({
    mutationFn: () => createIndexCheck(brandId, url, searchEngine),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['geo-loop', 'index-checks', brandId],
      });
      onSuccess();
      onOpenChange(false);
      setUrl('');
      toast.success('已提交收录');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, '提交失败'));
    },
  });

  const handleSubmit = () => {
    if (!url) {
      toast.error('请填写 URL');
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>提交收录</DialogTitle>
          <DialogDescription>
            向搜索引擎提交 URL，追踪收录状态
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">页面 URL</label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">搜索引擎</label>
            <Select
              value={searchEngine}
              onValueChange={(v) => setSearchEngine(v as SearchEngine)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEARCH_ENGINES.map((e) => (
                  <SelectItem key={e} value={e}>
                    {SEARCH_ENGINE_LABELS[e]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={mutation.isPending}>
            提交
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- 通用 ---------- */

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-32 flex-col items-center justify-center text-center">
      <div className="text-xs text-slate-400">{text}</div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-24 flex-col items-center justify-center text-center">
      <AlertCircle className="mb-1 h-6 w-6 text-red-400" />
      <p className="mb-2 text-xs text-slate-500">加载失败</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        重试
      </Button>
    </div>
  );
}

// 保留 WEIGHT_TIER_LABELS 引用避免未使用警告
void WEIGHT_TIER_LABELS;
