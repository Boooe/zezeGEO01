import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Upload,
  Search,
  Trash2,
  RefreshCw,
  AlertCircle,
  ArrowRightCircle,
  CheckSquare,
  ArrowUpDown,
  Sparkles,
  MoreHorizontal,
  Info,
  FileSearch,
} from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { useAuth } from '@client/src/hooks/useAuth';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@client/src/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@client/src/components/ui/dropdown-menu';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { PageHeader } from '@client/src/components/layout/PageHeader';
import { Pill } from '@client/src/components/layout/Pill';
import { SectionCard } from '@client/src/components/layout/SectionCard';
import { DataTable } from '@client/src/components/layout/DataTable';
import { Toolbar } from '@client/src/components/layout/Toolbar';
import { EmptyState } from '@client/src/components/layout/EmptyState';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@client/src/components/ui/dialog';
import { Textarea } from '@client/src/components/ui/textarea';
import { Checkbox } from '@client/src/components/ui/checkbox';
import { DataPagination } from '@client/src/components/ui/data-pagination';
import {
  getKeywordPool,
  addPoolKeyword,
  batchImportPool,
  movePoolToLibrary,
  batchMovePoolToLibrary,
  deletePoolItem,
  getBrandList,
  getKeywordGroups,
  getKeywordIndexLatestBatch,
} from '@client/src/api/keywords';
import {
  KEYWORD_TYPE_LABELS,
  KEYWORD_TYPES,
  KEYWORD_POOL_SOURCES,
  KEYWORD_POOL_SOURCE_LABELS,
} from '@shared/api.interface';
import type { KeywordPoolItemWithOpportunity, KeywordGroup } from '@shared/api.interface';
import {
  IndexRegisterDialog,
  IndexDetailDialog,
  IndexCell,
} from '@client/src/components/keywords/KeywordIndexDialogs';
import { showConfirm } from '@lark-apaas/client-toolkit';
import { toast } from 'sonner';

const DEFAULT_PAGE_SIZE = 10;

// 指数（人工采集）功能开关：true=显示，false=隐藏（代码与数据均保留，仅隐藏入口）
const INDEX_LOG_ENABLED = true;

const KeywordPoolPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [brandId, setBrandId] = useState<string>('');
  const [keywordType, setKeywordType] = useState<string>('');
  const [groupId, setGroupId] = useState<string>('');
  const [source, setSource] = useState<string>('');
  const [keywordSearch, setKeywordSearch] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'opportunity' | 'default'>('default');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [highOpportunityOnly, setHighOpportunityOnly] = useState(false);

  const {
    data: poolData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [
      'keywordPool',
      'list',
      page,
      brandId,
      keywordType,
      groupId,
      source,
      keywordSearch,
      sortBy,
      sortDirection,
      highOpportunityOnly,
    ],
    queryFn: () =>
      getKeywordPool({
        page,
        pageSize,
        brandId: brandId || undefined,
        keywordType: keywordType || undefined,
        groupId: groupId || undefined,
        source: source || undefined,
        keyword: keywordSearch || undefined,
        sortBy,
        highOpportunityOnly,
      }),
  });

  const { data: brandOptions = [] } = useQuery({
    queryKey: ['brands', 'options'],
    queryFn: getBrandList,
  });

  const { data: groupOptions = [] } = useQuery<KeywordGroup[]>({
    queryKey: ['keywordGroups', brandId],
    queryFn: () => getKeywordGroups(brandId),
    enabled: !!brandId,
  });

  const totalPages = useMemo(() => {
    if (!poolData) return 1;
    return Math.max(1, Math.ceil(poolData.total / pageSize));
  }, [poolData]);

  const allSelected = useMemo(() => {
    if (!poolData?.items.length) return false;
    return poolData.items.every((item) => selectedIds.has(item.id));
  }, [poolData, selectedIds]);

  const toggleSelectAll = () => {
    if (!poolData) return;
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(poolData.items.map((item) => item.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // ---- 指数批量查询 ----
  const keywordIds = useMemo(
    () => (poolData?.items ?? []).map((item) => item.id),
    [poolData],
  );
  const keywordIdsKey = keywordIds.join(',');
  const {
    data: indexBatchData,
    isLoading: indexBatchLoading,
    isError: indexBatchError,
  } = useQuery({
    queryKey: ['keyword-index-batch', keywordIdsKey],
    queryFn: () => getKeywordIndexLatestBatch(keywordIds),
    enabled: !!poolData && keywordIds.length > 0,
    staleTime: 30_000,
  });
  const indexBatch = indexBatchData?.data ?? {};

  // ---- 登记/详情弹窗 ----
  const [registerOpen, setRegisterOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeKeywordId, setActiveKeywordId] = useState('');
  const [activeKeywordText, setActiveKeywordText] = useState('');

  const openRegister = (item: KeywordPoolItemWithOpportunity) => {
    setActiveKeywordId(item.id);
    setActiveKeywordText(item.keyword);
    setRegisterOpen(true);
  };

  const openDetail = (item: KeywordPoolItemWithOpportunity) => {
    setActiveKeywordId(item.id);
    setActiveKeywordText(item.keyword);
    setDetailOpen(true);
  };

  /* ---------- 新增弹窗 ---------- */
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    keyword: '',
    keywordType: 'core' as 'core' | 'longtail',
    brandId: '',
    groupId: '',
  });
  const createMutation = useMutation({
    mutationFn: addPoolKeyword,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keywordPool', 'list'] });
      setCreateOpen(false);
      setCreateForm({
        keyword: '',
        keywordType: 'core',
        brandId: '',
        groupId: '',
      });
      toast.success('添加成功');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || '添加失败');
    },
  });

  /* ---------- 批量导入弹窗 ---------- */
  const [importOpen, setImportOpen] = useState(false);
  const [importForm, setImportForm] = useState({
    keywordType: 'core' as 'core' | 'longtail',
    brandId: '',
    groupId: '',
    text: '',
  });
  const importMutation = useMutation({
    mutationFn: batchImportPool,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keywordPool', 'list'] });
      setImportOpen(false);
      setImportForm({
        keywordType: 'core',
        brandId: '',
        groupId: '',
        text: '',
      });
      toast.success('批量导入成功');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || '导入失败');
    },
  });

  /* ---------- 单条移入词库 ---------- */
  const moveMutation = useMutation({
    mutationFn: movePoolToLibrary,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keywordPool', 'list'] });
      toast.success('已移入词库');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || '移入失败');
    },
  });

  /* ---------- 批量移入词库 ---------- */
  const batchMoveMutation = useMutation({
    mutationFn: batchMovePoolToLibrary,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keywordPool', 'list'] });
      setSelectedIds(new Set());
      toast.success('批量移入成功');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || '批量移入失败');
    },
  });

  /* ---------- 删除 ---------- */
  const deleteMutation = useMutation({
    mutationFn: deletePoolItem,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keywordPool', 'list'] });
      toast.success('删除成功');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || '删除失败');
    },
  });

  const handleSearch = () => {
    setPage(1);
  };

  const handleOpportunitySort = () => {
    if (sortBy !== 'opportunity') {
      setSortBy('opportunity');
      setSortDirection('desc');
    } else {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    }
    setPage(1);
  };

  const handleBatchMove = async () => {
    if (selectedIds.size === 0) return;
    const ok = await showConfirm(
      `确认将选中的 ${selectedIds.size} 个关键词移入词库？`,
    );
    if (ok) {
      batchMoveMutation.mutate(Array.from(selectedIds));
    }
  };

  // ---- 判断各数据列是否有真实数据（全列无数据则隐藏对应列）----
  const hasSearchVolumeData = useMemo(() => {
    const items = poolData?.items ?? [];
    return items.some((item: KeywordPoolItemWithOpportunity) => {
      const v = item.searchVolume;
      return v !== null && v !== undefined && v !== 0;
    });
  }, [poolData]);

  const hasCompetitionData = useMemo(() => {
    const items = poolData?.items ?? [];
    return items.some((item: KeywordPoolItemWithOpportunity) => {
      const v = item.competition;
      return v !== null && v !== undefined && v !== 0;
    });
  }, [poolData]);

  const hasIndexData = useMemo(() => {
    if (indexBatchLoading) return true; // 加载中仍显示列（展示骨架屏）
    if (indexBatchError) return false;
    const items = poolData?.items ?? [];
    return items.some((item: KeywordPoolItemWithOpportunity) => {
      const entry = indexBatch[item.id];
      return entry && (entry.baidu !== null || entry.weixin !== null);
    });
  }, [poolData, indexBatch, indexBatchLoading, indexBatchError]);

  // ---- 表格列定义 ----
  const poolColumns = useMemo(() => {
    const cols: Array<{ key: string; title: React.ReactNode; width?: string; align?: 'left' | 'right' | 'center'; render: (row: KeywordPoolItemWithOpportunity) => React.ReactNode }> = [
      {
        key: 'select',
        title: (
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleSelectAll}
            className="h-4 w-4 cursor-pointer accent-[#2E7DFF]"
            aria-label="全选"
          />
        ),
        width: '44px',
        render: (row: KeywordPoolItemWithOpportunity) => (
          <input
            type="checkbox"
            checked={selectedIds.has(row.id)}
            onChange={() => toggleSelect(row.id)}
            className="h-4 w-4 cursor-pointer accent-[#2E7DFF]"
            aria-label={`选择 ${row.keyword}`}
          />
        ),
      },
      {
        key: 'keyword',
        title: '关键词',
        width: '16%',
        render: (row: KeywordPoolItemWithOpportunity) => (
          <span className="font-medium text-[#0F172A]" title={row.keyword}>
            {row.keyword}
          </span>
        ),
      },
      {
        key: 'type',
        title: '类型',
        width: '8%',
        render: (row: KeywordPoolItemWithOpportunity) => (
          <Pill variant={row.keywordType === 'core' ? 'info' : 'muted'}>
            {KEYWORD_TYPE_LABELS[row.keywordType]}
          </Pill>
        ),
      },
      {
        key: 'group',
        title: '所属分组',
        width: '12%',
        render: (row: KeywordPoolItemWithOpportunity) => (
          <span title={row.groupName ?? ''} className="text-[#5B6B85]">
            {row.groupName ?? '—'}
          </span>
        ),
      },
      {
        key: 'source',
        title: '来源',
        width: '10%',
        render: (row: KeywordPoolItemWithOpportunity) => (
          <Pill variant="muted">
            {KEYWORD_POOL_SOURCE_LABELS[row.source] ?? row.source}
          </Pill>
        ),
      },
      {
        key: 'searchVolume',
        title: '搜索量',
        width: '8%',
        align: 'right',
        render: (row: KeywordPoolItemWithOpportunity) => {
          const v = row.searchVolume;
          if (v === null || v === undefined || v === 0) {
            return <span className="text-[#94A3B8]">—</span>;
          }
          return <span className="tabular-nums text-[#0F172A]">{v.toLocaleString()}</span>;
        },
      },
      {
        key: 'competition',
        title: '竞争度',
        width: '8%',
        align: 'right',
        render: (row: KeywordPoolItemWithOpportunity) => {
          const v = row.competition;
          if (v === null || v === undefined || v === 0) {
            return <span className="text-[#94A3B8]">—</span>;
          }
          return <span className="tabular-nums text-[#0F172A]">{v.toLocaleString()}</span>;
        },
      },
      {
        key: 'opportunity',
        title: (
          <span
            className="inline-flex cursor-pointer select-none items-center gap-1"
            onClick={handleOpportunitySort}
          >
            机会分
            <ArrowUpDown className="h-3 w-3 text-[#94A3B8]" />
          </span>
        ),
        width: '16%',
        render: (row: KeywordPoolItemWithOpportunity) => {
          const score = row.opportunityScore;
          if (!score) {
            return (
              <Pill variant="muted" className="text-[#94A3B8]">
                待评估
              </Pill>
            );
          }
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="inline-flex w-full items-center gap-1.5 cursor-help">
                  <span
                    className="shrink-0 text-[13px] font-semibold tabular-nums w-7"
                    style={{
                      color:
                        score >= 60
                          ? '#2E7DFF'
                          : score >= 40
                            ? '#10B981'
                            : '#94A3B8',
                    }}
                  >
                    {score}
                  </span>
                  <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-[#EEF2F7] min-w-0">
                    <div
                      className="absolute left-0 top-0 h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, Math.max(0, score))}%`,
                        backgroundColor:
                          score >= 60
                            ? '#2E7DFF'
                            : score >= 40
                                ? '#10B981'
                              : '#CBD5E1',
                      }}
                    />
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px]">
                <div className="space-y-1">
                  <div className="font-medium">加分原因</div>
                  {row.opportunityReasons && row.opportunityReasons.length > 0 ? (
                    <ul className="list-disc pl-4 space-y-0.5">
                      {row.opportunityReasons.map((r: string, ri: number) => (
                        <li key={ri}>{r}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-[#94A3B8]">暂无</div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        },
      },
      {
        key: 'addedAt',
        title: '添加时间',
        width: '10%',
        render: (row: KeywordPoolItemWithOpportunity) => {
          if (!row.addedAt && !row.createdAt) return <span className="text-[#94A3B8]">—</span>;
          const d = new Date(row.addedAt || row.createdAt!);
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          const hh = String(d.getHours()).padStart(2, '0');
          const mi = String(d.getMinutes()).padStart(2, '0');
          return <span className="text-[#5B6B85] tabular-nums">{`${mm}-${dd} ${hh}:${mi}`}</span>;
        },
      },
    ];

    if (INDEX_LOG_ENABLED && hasIndexData) {
      cols.splice(9, 0, {
        key: 'manualIndex',
        title: '指数（人工采集）',
        width: '12%',
        align: 'center',
        render: (row: KeywordPoolItemWithOpportunity) => {
          if (indexBatchLoading) return <Skeleton className="h-4 w-20 mx-auto" />;
          if (indexBatchError) return <span className="text-[#94A3B8]">—</span>;
          return (
            <IndexCell
              keywordId={row.id}
              latestData={indexBatch[row.id]}
              onRegister={() => openRegister(row)}
              onViewDetail={() => openDetail(row)}
            />
          );
        },
      });
    }

    cols.push({
      key: 'actions',
      title: '操作',
      width: '10%',
      align: 'right',
      render: (row: KeywordPoolItemWithOpportunity) => (
        <div className="flex items-center justify-end gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-[#2E7DFF] hover:bg-[#EAF2FF] hover:text-[#2E7DFF]"
                onClick={() => {
                  navigate(`/creation/article?keyword=${encodeURIComponent(row.keyword)}`);
                }}
                aria-label="去创作"
              >
                <Sparkles className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">去创作</TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-[#5B6B85] hover:text-[#0F172A]"
                aria-label="更多操作"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              {INDEX_LOG_ENABLED && (
                <>
                  <DropdownMenuItem onClick={() => openRegister(row)}>
                    <Info className="mr-2 h-4 w-4 text-[#2E7DFF]" />
                    登记指数
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => moveMutation.mutate(row.id)}>
                <ArrowRightCircle className="mr-2 h-4 w-4 text-[#10B981]" />
                移入词库
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-[#EF4444] focus:text-[#EF4444]"
                onClick={async () => {
                  if (await showConfirm('确认删除该关键词？')) {
                    deleteMutation.mutate(row.id);
                  }
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    });

    // 隐藏全列无数据的列
    const visibleCols = cols.filter((col) => {
      if (col.key === 'searchVolume') return hasSearchVolumeData;
      if (col.key === 'competition') return hasCompetitionData;
      return true;
    });

    return visibleCols;
  }, [allSelected, selectedIds, navigate, moveMutation, deleteMutation, indexBatch, indexBatchLoading, indexBatchError, openRegister, openDetail, handleOpportunitySort, toggleSelectAll, toggleSelect, hasSearchVolumeData, hasCompetitionData, hasIndexData]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="词池"
        description="管理候选关键词，批量导入，一键移入词库"
      />

      <SectionCard
        title="关键词词池"
        count={poolData?.total ?? 0}
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-9"
              disabled={selectedIds.size === 0}
              onClick={handleBatchMove}
            >
              <CheckSquare className="h-3.5 w-3.5" />
              批量移入词库
              {selectedIds.size > 0 && (
                <span className="ml-1 rounded-full bg-[#EAF2FF] px-1.5 text-xs text-[#2E7DFF]">
                  {selectedIds.size}
                </span>
              )}
            </Button>
            <Button size="sm" variant="outline" className="h-9" onClick={() => setImportOpen(true)}>
              <Upload className="h-3.5 w-3.5" />
              批量导入
            </Button>
            <Button size="sm" className="h-9 bg-[#2E7DFF] text-white hover:bg-[#1E5FD6]" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              添加关键词
            </Button>
          </>
        }
      >
        <Toolbar>
          <Select value={brandId} onValueChange={setBrandId}>
            <SelectTrigger className="h-9 w-[140px]">
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
          <Select value={keywordType} onValueChange={setKeywordType}>
            <SelectTrigger className="h-9 w-[120px]">
              <SelectValue placeholder="全部类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部类型</SelectItem>
              {KEYWORD_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {KEYWORD_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={groupId} onValueChange={setGroupId}>
            <SelectTrigger className="h-9 w-[140px]">
              <SelectValue placeholder="全部分组" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部分组</SelectItem>
              {groupOptions.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="h-9 w-[120px]">
              <SelectValue placeholder="全部来源" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部来源</SelectItem>
              {KEYWORD_POOL_SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {KEYWORD_POOL_SOURCE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative w-[260px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <Input
              placeholder="搜索关键词"
              value={keywordSearch}
              onChange={(e) => setKeywordSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="h-9 pl-9"
            />
          </div>
          <Button
            size="sm"
            className="h-9 bg-[#2E7DFF] text-white hover:bg-[#1E5FD6]"
            onClick={handleSearch}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            查询
          </Button>
          <label className="flex items-center gap-2 text-xs cursor-pointer ml-2">
            <Checkbox
              checked={highOpportunityOnly}
              onCheckedChange={(checked) => {
                setHighOpportunityOnly(Boolean(checked));
                setPage(1);
              }}
            />
            <span className="text-[#5B6B85]">只看高机会（≥60分）</span>
          </label>
        </Toolbar>

        {isError && (
          <div className="flex items-center justify-between rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-4 mb-4">
            <div className="flex items-center gap-2 text-sm text-[#EF4444]">
              <AlertCircle className="h-4 w-4" />
              <span>数据加载失败，请重试</span>
            </div>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-[#EF4444] transition-colors hover:bg-[#FECACA]/30"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              重试
            </button>
          </div>
        )}

        {isLoading && <TableSkeleton />}

        {!isLoading && !isError && poolData && poolData.items.length === 0 && (
          <EmptyState
            icon={<FileSearch />}
            description="可以通过「批量导入」或「添加关键词」将候选关键词加入词池，机会分高的关键词建议优先移入词库并创作内容"
            action={
              <Button className="bg-[#2E7DFF] text-white hover:bg-[#1E5FD6]" onClick={() => setCreateOpen(true)}>
                添加关键词
              </Button>
            }
          />
        )}

        {!isLoading && poolData && poolData.items.length > 0 && (
          <DataTable
            columns={poolColumns}
            data={poolData.items}
            rowKey="id"
            headerRender={() =>
              INDEX_LOG_ENABLED && hasIndexData ? (
                <div className="px-4 pt-2">
                  <p className="mb-2 text-[12px] text-[#94A3B8]">
                    指数为人工从百度指数/微信指数截图采集，非平台接口数据，点击可查看原始截图。
                  </p>
                </div>
              ) : null
            }
            pagination={{
              total: poolData.total,
              page,
              pageSize,
              onPageChange: setPage,
              onPageSizeChange: (size) => {
                setPageSize(size);
                setPage(1);
              },
            }}
          />
        )}
      </SectionCard>

      {/* 批量导入弹窗 */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>批量导入关键词</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">所属品牌</label>
              <Select
                value={importForm.brandId}
                onValueChange={(v) =>
                  setImportForm({ ...importForm, brandId: v })
                }
              >
                <SelectTrigger className="h-9 w-full">
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
              <label className="text-sm font-medium">关键词类型</label>
              <Select
                value={importForm.keywordType}
                onValueChange={(v) =>
                  setImportForm({
                    ...importForm,
                    keywordType: v as 'core' | 'longtail',
                  })
                }
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KEYWORD_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {KEYWORD_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">所属分组</label>
              <Select
                value={importForm.groupId}
                onValueChange={(v) =>
                  setImportForm({ ...importForm, groupId: v })
                }
                disabled={!importForm.brandId}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="不分组" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">不分组</SelectItem>
                  {groupOptions.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                关键词列表（每行一个）
              </label>
              <Textarea
                placeholder="关键词1&#10;关键词2&#10;关键词3"
                value={importForm.text}
                onChange={(e) =>
                  setImportForm({
                    ...importForm,
                    text: e.target.value,
                  })
                }
                className="min-h-[200px] resize-y"
              />
              <p className="text-xs text-muted-foreground">
                共{' '}
                {
                  importForm.text
                    .split('\n')
                    .filter((l) => l.trim()).length
                }{' '}
                个关键词
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setImportOpen(false)}
            >
              取消
            </Button>
            <Button
              className="bg-[#2E7DFF] text-white hover:bg-[#1E5FD6]"
              disabled={
                importMutation.isPending ||
                !importForm.brandId ||
                !importForm.text.trim()
              }
              onClick={() => {
                const keywords = importForm.text
                  .split('\n')
                  .map((l) => l.trim())
                  .filter(Boolean)
                  .map((kw) => ({
                    keyword: kw,
                    keywordType: importForm.keywordType,
                  }));
                importMutation.mutate({
                  keywords,
                  brandId: importForm.brandId,
                  groupId: importForm.groupId || undefined,
                  source: 'import',
                });
              }}
            >
              {importMutation.isPending ? '导入中...' : '确认导入'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 添加关键词弹窗 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>添加关键词</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">关键词</label>
              <Input
                value={createForm.keyword}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    keyword: e.target.value,
                  })
                }
                placeholder="请输入关键词"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">类型</label>
              <Select
                value={createForm.keywordType}
                onValueChange={(v) =>
                  setCreateForm({
                    ...createForm,
                    keywordType: v as 'core' | 'longtail',
                  })
                }
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KEYWORD_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {KEYWORD_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">所属品牌</label>
              <Select
                value={createForm.brandId}
                onValueChange={(v) =>
                  setCreateForm({ ...createForm, brandId: v })
                }
              >
                <SelectTrigger className="h-9 w-full">
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
              <label className="text-sm font-medium">所属分组</label>
              <Select
                value={createForm.groupId}
                onValueChange={(v) =>
                  setCreateForm({ ...createForm, groupId: v })
                }
                disabled={!createForm.brandId}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="不分组" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">不分组</SelectItem>
                  {groupOptions.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              className="bg-[#2E7DFF] text-white hover:bg-[#1E5FD6]"
              disabled={
                createMutation.isPending ||
                !createForm.keyword.trim() ||
                !createForm.brandId
              }
              onClick={() =>
                createMutation.mutate({
                  keyword: createForm.keyword.trim(),
                  keywordType: createForm.keywordType,
                  brandId: createForm.brandId,
                  groupId: createForm.groupId || undefined,
                  source: 'manual',
                })
              }
            >
              {createMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 指数登记弹窗 */}
      <IndexRegisterDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        keywordId={activeKeywordId}
        keywordText={activeKeywordText}
      />

      {/* 指数详情弹窗 */}
      <IndexDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        keywordId={activeKeywordId}
        keywordText={activeKeywordText}
      />
    </div>
  );
};

const TableSkeleton = () => (
  <div className="space-y-1 rounded-md border p-3">
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 h-10 px-1">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>
    ))}
  </div>
);

export default KeywordPoolPage;

