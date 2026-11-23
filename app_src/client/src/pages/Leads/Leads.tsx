import React, { useCallback, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Plus,
  Phone,
  MapPin,
  Building2,
  MoreHorizontal,
  Trash2,
  Edit3,
  MessageSquare,
  ArrowRightLeft,
  CalendarClock,
  RefreshCw,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';

import { Pill } from '@client/src/components/layout/Pill';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@client/src/components/ui/select';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@client/src/components/ui/table';
import { ColumnResizeHandle } from '@client/src/components/ui/column-resize-handle';
import { useResizableColumns } from '@client/src/hooks/use-resizable-columns';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@client/src/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@client/src/components/ui/alert-dialog';
import { DataPagination } from '@client/src/components/ui/data-pagination';
import { SectionCard } from '@client/src/components/layout/SectionCard';
import { Toolbar } from '@client/src/components/layout/Toolbar';

import {
  getLeads,
  getLeadStats,
  deleteLead,
  type LeadsQueryParams,
} from '@client/src/api/leads';
import {
  LEAD_STAGE_LABELS,
  INTENT_LEVELS,
  INTENT_LEVEL_LABELS,
  type Lead,
  type LeadStage,
  type IntentLevel,
} from '@shared/api.interface';
import { useAuth } from '@client/src/contexts/AuthContext';

import StageStats from './components/StageStats';
import { StageBadge, IntentBadge } from './components/LeadBadges';
import LeadListSkeleton, { LeadCardSkeleton } from './components/LeadListSkeleton';
import LeadFormDialog from './components/LeadFormDialog';
import FollowupDialog from './components/FollowupDialog';
import ConvertDialog from './components/ConvertDialog';

const PRIMARY = '#2563EB';
const DANGER = '#DC2626';

const DEFAULT_PAGE_SIZE = 10;

const LEADS_COL_DEFAULTS: Record<string, number> = {
  merchantName: 240,
  industry: 120,
  region: 120,
  phone: 130,
  source: 120,
  intentLevel: 100,
  stage: 100,
  nextFollowupDate: 130,
  actions: 132,
};

const Leads = () => {
  const queryClient = useQueryClient();
  const { user, hasRole } = useAuth();

  const {
    getThStyle,
    getTdStyle,
    getTableStyle,
    handleResizeStart,
    resetAll,
    isResizing,
  } = useResizableColumns({
    tableKey: 'leads',
    defaultWidths: LEADS_COL_DEFAULTS,
    defaultVersion: 3,
    userId: user?.id || 'guest',
  });

  // 查询参数
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [stageFilter, setStageFilter] = useState<LeadStage | ''>('');
  const [intentFilter, setIntentFilter] = useState<'high' | 'medium' | 'low' | ''>('');
  const [keyword, setKeyword] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [includeDemo, setIncludeDemo] = useState(false);

  // 弹窗状态
  const [formOpen, setFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [followupOpen, setFollowupOpen] = useState(false);
  const [followupLead, setFollowupLead] = useState<Lead | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertLeadData, setConvertLeadData] = useState<Lead | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingLead, setDeletingLead] = useState<Lead | null>(null);

  // 搜索防抖
  const handleSearch = useCallback(() => {
    setKeyword(searchInput.trim());
    setPage(1);
  }, [searchInput]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleStageClick = useCallback((stage: LeadStage | '') => {
    setStageFilter(stage);
    setPage(1);
  }, []);

  const handleIntentChange = useCallback((val: string) => {
    setIntentFilter(val as 'high' | 'medium' | 'low' | '');
    setPage(1);
  }, []);

  const handleDataRangeChange = useCallback((val: string) => {
    setIncludeDemo(val === 'withDemo');
    setPage(1);
  }, []);

  // 统计数据
  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['leads', 'stats', includeDemo],
    queryFn: () => getLeadStats({ includeDemo }),
  });

  // 列表数据
  const queryParams: LeadsQueryParams = useMemo(() => {
    const params: LeadsQueryParams = {
      page,
      pageSize,
    };
    if (stageFilter) params.stage = stageFilter;
    if (intentFilter) params.intentLevel = intentFilter;
    if (keyword) params.keyword = keyword;
    if (includeDemo) params.includeDemo = true;
    return params;
  }, [page, pageSize, stageFilter, intentFilter, keyword, includeDemo]);

  const {
    data: leadsData,
    isLoading: listLoading,
    isError: listError,
    refetch: refetchList,
  } = useQuery({
    queryKey: ['leads', 'list', queryParams],
    queryFn: () => getLeads(queryParams),
  });

  // 删除
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteLead(id),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads', 'stats'] });
      toast.success('线索已删除');
    },
    onError: (error: any) => {
      const msg =
        error?.response?.data?.error?.message ?? '删除失败，请重试';
      toast.error(msg);
    },
  });

  const isAdmin = hasRole('admin');
  const canEdit = hasRole('admin') || hasRole('operator');
  const totalCount = leadsData?.total ?? 0;
  const demoCount = leadsData?.demoCount ?? 0;

  const handleEdit = (lead: Lead) => {
    setEditingLead(lead);
    setFormOpen(true);
  };

  const handleAdd = () => {
    setEditingLead(null);
    setFormOpen(true);
  };

  const handleFollowup = (lead: Lead) => {
    setFollowupLead(lead);
    setFollowupOpen(true);
  };

  const handleConvert = (lead: Lead) => {
    setConvertLeadData(lead);
    setConvertOpen(true);
  };

  // 格式化日期显示
  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '-';
    return dateStr.slice(0, 10);
  };

  // 判断是否逾期（下次跟进日期早于今天）
  const isOverdue = (dateStr: string | null): boolean => {
    if (!dateStr) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    return target.getTime() < today.getTime();
  };

  const isEmpty = !listLoading && !listError && leadsData && leadsData.items.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {/* 主内容卡 */}
      <SectionCard
        title="线索池"
        count={totalCount}
        subtitle={
          demoCount > 0 ? (
            <span className="tabular-nums">· 另有 {demoCount} 条演示数据</span>
          ) : null
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetAll}
              className="text-[12px] transition-colors hover:underline"
              style={{ color: '#94A3B8' }}
            >
              重置列宽
            </button>
            {canEdit && (
              <Button onClick={handleAdd} style={{ backgroundColor: PRIMARY }}>
                <Plus className="h-4 w-4" />
                新增线索
              </Button>
            )}
          </div>
        }
      >
        {/* 阶段统计 */}
        <div className="mb-4">
          <StageStats
            stats={stats}
            isLoading={statsLoading}
            activeStage={stageFilter}
            onStageClick={handleStageClick}
          />
        </div>

        {/* 统计错误态 */}
        {statsError && (
          <div
            className="mb-4 flex items-center justify-between rounded-lg border border-red-200 p-4"
            style={{ backgroundColor: 'rgba(220, 38, 38, 0.05)' }}
          >
            <div className="flex items-center gap-2 text-sm" style={{ color: DANGER }}>
              <AlertCircle className="h-4 w-4" />
              <span>统计数据加载失败</span>
            </div>
            <button
              onClick={() => refetchStats()}
              className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-red-100"
              style={{ color: DANGER }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              重试
            </button>
          </div>
        )}

        {/* 筛选工具栏 */}
        <div className="mb-4">
          <Toolbar>
            <div className="relative w-[260px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="搜索商户名称或电话..."
                className="h-9 pl-9"
              />
            </div>
            <Select value={intentFilter} onValueChange={handleIntentChange}>
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue placeholder="意向等级" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部等级</SelectItem>
                {INTENT_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {INTENT_LEVEL_LABELS[level]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={includeDemo ? 'withDemo' : 'real'}
              onValueChange={handleDataRangeChange}
            >
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue placeholder="数据范围" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="real">真实数据</SelectItem>
                <SelectItem value="withDemo">含演示数据</SelectItem>
              </SelectContent>
            </Select>
          </Toolbar>
        </div>

        {/* 列表错误态 */}
        {listError && (
          <div
            className="mb-4 flex items-center justify-between rounded-lg border border-red-200 p-4"
            style={{ backgroundColor: 'rgba(220, 38, 38, 0.05)' }}
          >
            <div
              className="flex items-center gap-2 text-sm"
              style={{ color: DANGER }}
            >
              <AlertCircle className="h-4 w-4" />
              <span>线索列表加载失败</span>
            </div>
            <button
              onClick={() => refetchList()}
              className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-red-100"
              style={{ color: DANGER }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              重试
            </button>
          </div>
        )}

        {/* 加载态 */}
        {listLoading && (
          <>
            <LeadListSkeleton rows={pageSize} />
            <LeadCardSkeleton />
          </>
        )}

        {/* 空态 */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-16">
            <FileText className="mb-3 h-8 w-8 text-[#94A3B8] opacity-50" />
            <div className="text-[14px] font-medium text-[#0F172A] mb-1">
              暂无线索数据
            </div>
            <div className="text-[13px] text-[#64748B] mb-4">
              {keyword || stageFilter || intentFilter
                ? '当前筛选条件下没有线索，试试调整筛选条件'
                : '点击「新增线索」添加第一条线索'}
            </div>
            {canEdit && !keyword && !stageFilter && !intentFilter && (
              <Button onClick={handleAdd} style={{ backgroundColor: PRIMARY }}>
                <Plus className="h-4 w-4" />
                新增线索
              </Button>
            )}
          </div>
        )}

        {/* 桌面端表格 */}
        {!listLoading && !listError && leadsData && leadsData.items.length > 0 && (
          <div className="hidden md:block overflow-x-auto">
            <Table className="table-fixed" style={getTableStyle()}>
              <TableHeader style={{ backgroundColor: '#F1F5F9' }}>
                <TableRow style={{ height: '44px' }}>
                  <TableHead data-col="merchantName" className="group relative" style={{ ...getThStyle('merchantName'), fontSize: '12px', fontWeight: 500, color: '#334155' }}>
                    商户名称
                    <ColumnResizeHandle
                      onResizeStart={(e) => handleResizeStart('merchantName', e)}
                      isResizing={isResizing}
                    />
                  </TableHead>
                  <TableHead data-col="industry" className="group relative" style={{ ...getThStyle('industry'), fontSize: '12px', fontWeight: 500, color: '#334155' }}>
                    行业
                    <ColumnResizeHandle
                      onResizeStart={(e) => handleResizeStart('industry', e)}
                      isResizing={isResizing}
                    />
                  </TableHead>
                  <TableHead data-col="region" className="group relative" style={{ ...getThStyle('region'), fontSize: '12px', fontWeight: 500, color: '#334155' }}>
                    区域
                    <ColumnResizeHandle
                      onResizeStart={(e) => handleResizeStart('region', e)}
                      isResizing={isResizing}
                    />
                  </TableHead>
                  <TableHead data-col="phone" className="group relative" style={{ ...getThStyle('phone'), fontSize: '12px', fontWeight: 500, color: '#334155' }}>
                    电话
                    <ColumnResizeHandle
                      onResizeStart={(e) => handleResizeStart('phone', e)}
                      isResizing={isResizing}
                    />
                  </TableHead>
                  <TableHead data-col="source" className="group relative" style={{ ...getThStyle('source'), fontSize: '12px', fontWeight: 500, color: '#334155' }}>
                    来源
                    <ColumnResizeHandle
                      onResizeStart={(e) => handleResizeStart('source', e)}
                      isResizing={isResizing}
                    />
                  </TableHead>
                  <TableHead data-col="intentLevel" className="group relative" style={{ ...getThStyle('intentLevel'), fontSize: '12px', fontWeight: 500, color: '#334155' }}>
                    意向等级
                    <ColumnResizeHandle
                      onResizeStart={(e) => handleResizeStart('intentLevel', e)}
                      isResizing={isResizing}
                    />
                  </TableHead>
                  <TableHead data-col="stage" className="group relative" style={{ ...getThStyle('stage'), fontSize: '12px', fontWeight: 500, color: '#334155' }}>
                    阶段
                    <ColumnResizeHandle
                      onResizeStart={(e) => handleResizeStart('stage', e)}
                      isResizing={isResizing}
                    />
                  </TableHead>
                  <TableHead data-col="nextFollowupDate" className="group relative" style={{ ...getThStyle('nextFollowupDate'), fontSize: '12px', fontWeight: 500, color: '#334155' }}>
                    下次跟进
                    <ColumnResizeHandle
                      onResizeStart={(e) => handleResizeStart('nextFollowupDate', e)}
                      isResizing={isResizing}
                    />
                  </TableHead>
                  <TableHead data-col="actions" className="group relative text-right" style={{ ...getThStyle('actions'), fontSize: '12px', fontWeight: 500, color: '#334155' }}>
                    操作
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leadsData.items.map((lead: Lead) => (
                  <TableRow key={lead.id} style={{ height: '44px', borderBottom: '1px solid #EEF2F7' }}>
                    <TableCell className="font-medium text-[#0F172A] text-[13px]" style={getTdStyle('merchantName')}>
                      <div className="flex items-center gap-2">
                        {(/^1380000/.test(lead.phone || '') || /测试|演示/.test(lead.remark || '')) && (
                          <Pill variant="muted">演示</Pill>
                        )}
                        <span className="truncate">{lead.merchantName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-[#64748B] text-[13px]" style={getTdStyle('industry')}>
                      {lead.industry || '-'}
                    </TableCell>
                    <TableCell className="text-[#64748B] text-[13px]" style={getTdStyle('region')}>
                      {lead.region || '-'}
                    </TableCell>
                    <TableCell className="text-[#64748B] text-[13px]" style={getTdStyle('phone')}>
                      {lead.phone || '-'}
                    </TableCell>
                    <TableCell className="text-[#64748B] text-[13px]" style={getTdStyle('source')}>
                      {lead.source || '-'}
                    </TableCell>
                    <TableCell style={getTdStyle('intentLevel')}>
                      <IntentBadge level={lead.intentLevel} />
                    </TableCell>
                    <TableCell style={getTdStyle('stage')}>
                      <StageBadge stage={lead.stage} />
                    </TableCell>
                    <TableCell style={getTdStyle('nextFollowupDate')}>
                      {lead.nextFollowupDate ? (
                        <span
                          className="inline-flex items-center gap-1 text-[12px]"
                          style={{
                            color: isOverdue(lead.nextFollowupDate)
                              ? DANGER
                              : '#64748B',
                          }}
                        >
                          <CalendarClock className="h-3.5 w-3.5" />
                          {formatDate(lead.nextFollowupDate)}
                        </span>
                      ) : (
                        <span className="text-[12px] text-[#94A3B8]">
                          -
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right" style={getTdStyle('actions')}>
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleFollowup(lead)}
                            className="h-7 px-2 text-xs"
                            style={{ color: PRIMARY }}
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            跟进
                          </Button>
                        )}

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              aria-label="更多操作"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canEdit && (
                              <DropdownMenuItem
                                onClick={() => handleEdit(lead)}
                              >
                                <Edit3 className="mr-2 h-4 w-4" />
                                编辑线索
                              </DropdownMenuItem>
                            )}
                            {canEdit && lead.stage !== 'signed' && (
                              <DropdownMenuItem
                                onClick={() => handleConvert(lead)}
                                style={{ color: PRIMARY }}
                              >
                                <ArrowRightLeft className="mr-2 h-4 w-4" />
                                转客户
                              </DropdownMenuItem>
                            )}
                            {isAdmin && (
                              <DropdownMenuItem
                                style={{ color: DANGER }}
                                onClick={() => {
                                  setDeletingLead(lead);
                                  setDeleteOpen(true);
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                删除线索
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* 移动端卡片视图 */}
        {!listLoading && !listError && leadsData && leadsData.items.length > 0 && (
          <div className="space-y-3 md:hidden pt-4">
            {leadsData.items.map((lead: Lead) => (
              <div
                key={lead.id}
                className="rounded-lg border p-4"
                style={{ borderColor: '#E6EAF2' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-[#0F172A]">
                      {lead.merchantName}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <StageBadge stage={lead.stage} />
                      <IntentBadge level={lead.intentLevel} />
                    </div>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-[#64748B]">
                  {lead.industry && (
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-[#94A3B8]" />
                      <span>{lead.industry}</span>
                    </div>
                  )}
                  {lead.region && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-[#94A3B8]" />
                      <span>{lead.region}</span>
                    </div>
                  )}
                  {lead.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-[#94A3B8]" />
                      <span>{lead.phone}</span>
                    </div>
                  )}
                  {lead.nextFollowupDate && (
                    <div className="flex items-center gap-1.5">
                      <CalendarClock
                        className="h-3.5 w-3.5"
                        style={{
                          color: isOverdue(lead.nextFollowupDate)
                            ? DANGER
                            : '#94A3B8',
                        }}
                      />
                      <span
                        style={{
                          color: isOverdue(lead.nextFollowupDate)
                            ? DANGER
                            : '#64748B',
                        }}
                      >
                        下次跟进：{formatDate(lead.nextFollowupDate)}
                      </span>
                    </div>
                  )}
                  {lead.source && (
                    <div className="text-[#94A3B8]">
                      来源：{lead.source}
                    </div>
                  )}
                </div>

                <div className="mt-3 flex gap-2 border-t pt-3" style={{ borderColor: '#EEF2F7' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleFollowup(lead)}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    跟进
                  </Button>
                  {canEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleEdit(lead)}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      编辑
                    </Button>
                  )}
                  {canEdit && lead.stage !== 'signed' && (
                    <Button
                      size="sm"
                      className="flex-1"
                      style={{ backgroundColor: PRIMARY }}
                      onClick={() => handleConvert(lead)}
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                      转客户
                    </Button>
                  )}
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      style={{ color: DANGER, borderColor: 'rgba(220, 38, 38, 0.3)' }}
                      onClick={() => {
                        setDeletingLead(lead);
                        setDeleteOpen(true);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      删除
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 分页 */}
        {leadsData && leadsData.total > pageSize && (
          <div className="mt-4 flex justify-end">
            <DataPagination
              total={leadsData.total}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </div>
        )}
      </SectionCard>

      {/* 弹窗 */}
      <LeadFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editLead={editingLead}
      />

      {followupLead && (
        <FollowupDialog
          open={followupOpen}
          onOpenChange={setFollowupOpen}
          leadId={followupLead.id}
          merchantName={followupLead.merchantName}
        />
      )}

      <ConvertDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        lead={convertLeadData}
      />

      {/* 删除确认弹窗 */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除线索「{deletingLead?.merchantName}」吗？
              此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingLead) {
                  deleteMutation.mutate(deletingLead.id);
                  setDeleteOpen(false);
                }
              }}
              style={{ backgroundColor: DANGER }}
            >
              {deleteMutation.isPending ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Leads;
