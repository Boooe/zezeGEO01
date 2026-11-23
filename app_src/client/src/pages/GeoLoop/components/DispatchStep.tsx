import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, CreditCard, Wand2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@client/src/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@client/src/components/ui/card';
import { Badge } from '@client/src/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@client/src/components/ui/tooltip';
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
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@client/src/components/ui/table';
import { getApiErrorMessage } from '@client/src/lib/api-error';
import {
  getDispatchOverview,
  getDispatchPlans,
  smartSchedule,
  previewConvertOrders,
  convertToOrders,
} from '@client/src/api/geo-loop';
import type { DispatchPlan, DispatchPlanStatus, WeightTier } from '@shared/api.interface';
import {
  DISPATCH_PLAN_STATUS_LABELS,
  WEIGHT_TIER_LABELS,
  WEIGHT_TIERS,
} from '@shared/api.interface';
import { logger } from '@lark-apaas/client-toolkit/logger';

interface DispatchStepProps {
  brandId: string;
  showSkeleton?: boolean;
}

/* ---------- 计算 4 周日期范围 ---------- */

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateKeyToLabel(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${Number(m)}.${Number(d)}`;
}

function getWeeksDateRange(): { startDate: string; endDate: string; weeks: WeekInfo[] } {
  const today = new Date();
  // 找到本周一
  const day = today.getDay(); // 0=周日, 1=周一
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() + diffToMonday);
  thisMonday.setHours(0, 0, 0, 0);

  const weeks: WeekInfo[] = [];
  for (let w = 0; w < 4; w++) {
    const weekStart = new Date(thisMonday);
    weekStart.setDate(thisMonday.getDate() + w * 7);
    const days: { date: string; dayLabel: string; weekday: string }[] = [];
    const weekdayNames = ['一', '二', '三', '四', '五', '六', '日'];
    for (let d = 0; d < 7; d++) {
      const dt = new Date(weekStart);
      dt.setDate(weekStart.getDate() + d);
      const dateStr = formatLocalDate(dt);
      const dayLabel = dateKeyToLabel(dateStr);
      days.push({ date: dateStr, dayLabel, weekday: weekdayNames[d] });
    }
    const weekEndDate = new Date(weekStart);
    weekEndDate.setDate(weekStart.getDate() + 6);
    const startLabel = dateKeyToLabel(formatLocalDate(weekStart));
    const endLabel = dateKeyToLabel(formatLocalDate(weekEndDate));
    const rangeLabel = `${startLabel}-${endLabel}`;
    weeks.push({
      weekIndex: w + 1,
      rangeLabel,
      weekStart: formatLocalDate(weekStart),
      days,
    });
  }

  const startDate = weeks[0].weekStart;
  const endDate = weeks[3].days[6].date;
  return { startDate, endDate, weeks };
}

interface WeekInfo {
  weekIndex: number;
  rangeLabel: string;
  weekStart: string;
  days: { date: string; dayLabel: string; weekday: string }[];
}

/* ---------- 主组件 ---------- */

export function DispatchStep({ brandId, showSkeleton }: DispatchStepProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { startDate, endDate, weeks } = useMemo(() => getWeeksDateRange(), []);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [dayDialogOpen, setDayDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [balanceError, setBalanceError] = useState<string>('');

  const {
    data: overview,
    isLoading: overviewLoading,
    isError: overviewError,
    refetch: refetchOverview,
  } = useQuery({
    queryKey: ['geo-loop', 'dispatch-overview', brandId],
    queryFn: () => getDispatchOverview(brandId),
  });

  const {
    data: plans,
    isLoading: plansLoading,
    isError: plansError,
    refetch: refetchPlans,
  } = useQuery({
    queryKey: ['geo-loop', 'dispatch-plans', brandId, startDate, endDate],
    queryFn: () => getDispatchPlans(brandId, startDate, endDate),
  });

  const plansByDate = useMemo(() => {
    const map = new Map<string, DispatchPlan[]>();
    if (!plans) return map;
    for (const plan of plans) {
      const date = plan.planDate.slice(0, 10);
      const list = map.get(date) ?? [];
      list.push(plan);
      map.set(date, list);
    }
    return map;
  }, [plans]);

  const dayPlans = plansByDate.get(selectedDate) ?? [];

  const allPlannedIds = (plans ?? [])
    .filter((p) => p.status === 'planned')
    .map((p) => p.id);
  const plannedCount = allPlannedIds.length;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{
    matchedCount: number;
    unmatchedCount: number;
    totalPriceCents: number;
    balanceCents: number;
    sufficient: boolean;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const openConfirmDialog = async () => {
    if (allPlannedIds.length === 0) return;
    setConfirmOpen(true);
    setPreviewData(null);
    setPreviewLoading(true);
    try {
      const data = await previewConvertOrders(brandId, allPlannedIds);
      setPreviewData(data);
    } catch (err) {
      toast.error(getApiErrorMessage(err, '获取预估信息失败'));
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConfirmConvert = () => {
    if (!previewData || !previewData.sufficient || previewData.unmatchedCount > 0) return;
    convertMutation.mutate(allPlannedIds, {
      onSuccess: () => {
        setConfirmOpen(false);
      },
    });
  };

  const convertMutation = useMutation({
    mutationFn: (ids: string[]) => convertToOrders(brandId, ids),
    retry: false,
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ['geo-loop', 'dispatch-plans', brandId],
      });
      queryClient.invalidateQueries({
        queryKey: ['geo-loop', 'dispatch-overview', brandId],
      });
      queryClient.invalidateQueries({
        queryKey: ['media-wallet', 'wallet', brandId],
      });
      toast.success(`已创建 ${data.success} 条订单`);
    },
    onError: (err) => {
      const msg = getApiErrorMessage(err, '转订单失败');
      if (msg.includes('余额不足')) {
        setBalanceError(msg);
      } else {
        toast.error(msg);
      }
    },
  });

  const handleDayClick = (date: string) => {
    setSelectedDate(date);
    setDayDialogOpen(true);
  };

  const handleConvertInDialog = (ids: string[]) => {
    if (ids.length === 0) return;
    convertMutation.mutate(ids);
  };

  return (
    <div className="space-y-4">
      {/* 顶部 3 张指标卡 */}
      <div className="grid grid-cols-3 gap-3">
        {showSkeleton || overviewLoading ? (
          <>
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
          </>
        ) : overviewError ? (
          <div className="col-span-3">
            <ErrorState onRetry={refetchOverview} />
          </div>
        ) : (
          <>
            <MetricCard
              label="本月计划"
              value={overview?.monthlyPlanned ?? 0}
              unit="篇"
              accent="blue"
            />
            <MetricCard
              label="已发布"
              value={overview?.monthlyPublished ?? 0}
              unit="篇"
              accent="emerald"
            />
            <TierCard distribution={overview?.tierDistribution ?? { A: 0, B: 0, C: 0 }} />
          </>
        )}
      </div>

      {/* 操作栏 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-slate-500" />
          <span className="text-sm text-slate-600">
            未来 4 周排期（{startDate.replace(/-/g, '/').slice(5)} ~ {endDate.replace(/-/g, '/').slice(5)}）
          </span>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={openConfirmDialog}
                    disabled={plannedCount === 0 || convertMutation.isPending}
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    待排期转订单（{plannedCount}条）
                  </Button>
                </span>
              </TooltipTrigger>
              {plannedCount === 0 && (
                <TooltipContent>
                  当前没有待转订单计划
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          <Button size="sm" onClick={() => setScheduleDialogOpen(true)}>
            <Wand2 className="h-3.5 w-3.5" />
            智能排期
          </Button>
        </div>
      </div>

      {/* 周历视图 */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        {showSkeleton || plansLoading ? (
          <>
            <WeekCardSkeleton />
            <WeekCardSkeleton />
            <WeekCardSkeleton />
            <WeekCardSkeleton />
          </>
        ) : plansError ? (
          <div className="col-span-full">
            <ErrorState onRetry={refetchPlans} />
          </div>
        ) : (
          weeks.map((week) => (
            <Card key={week.weekIndex} className="overflow-hidden">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm font-semibold text-slate-700">
                  第 {week.weekIndex} 周 · {week.rangeLabel}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 pt-0">
                <Table className="table-fixed w-full overflow-hidden">
                  <colgroup>
                    {week.days.map((_, i) => (
                      <col key={i} style={{ width: `${100 / 7}%`, minWidth: '40px' }} />
                    ))}
                  </colgroup>
                  <TableHeader>
                    <TableRow className="h-6">
                      {week.days.map((d) => (
                        <TableHead
                          key={d.date}
                          className="h-6 px-1 text-center text-[11px] font-medium text-slate-400 whitespace-nowrap"
                        >
                          {d.dayLabel} 周{d.weekday}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="h-auto align-top">
                      {week.days.map((d) => {
                        const dayPlansList = plansByDate.get(d.date) ?? [];
                        const visible = dayPlansList.slice(0, 2);
                        const extra = dayPlansList.length - 2;
                        return (
                          <TableCell
                            key={d.date}
                            className="align-top px-1 py-1"
                          >
                            <button
                              onClick={() => handleDayClick(d.date)}
                              className="w-full overflow-hidden text-left rounded-md border border-transparent hover:border-blue-200 hover:bg-blue-50/50 transition-all p-1 min-h-[48px]"
                              aria-label={`查看 ${d.date} 排期`}
                            >
                              <div className="space-y-0.5">
                                {visible.map((plan) => (
                                  <div
                                    key={plan.id}
                                    className={
                                      'text-[10px] line-clamp-2 px-1 py-0.5 rounded w-full overflow-hidden leading-tight ' +
                                      (plan.status === 'published'
                                        ? 'bg-emerald-50 text-emerald-600'
                                        : plan.status === 'failed'
                                        ? 'bg-red-50 text-red-500'
                                        : plan.status === 'queued'
                                        ? 'bg-blue-50 text-blue-600'
                                        : 'bg-slate-100 text-slate-600')
                                    }
                                    title={plan.channelName ?? plan.title ?? ''}
                                  >
                                    {plan.channelName ?? '未命名'}
                                  </div>
                                ))}
                                {extra > 0 && (
                                  <div className="text-[10px] text-slate-400 px-1 truncate">
                                    +{extra} 更多
                                  </div>
                                )}
                              </div>
                            </button>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* 智能排期弹窗 */}
      <ScheduleDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        brandId={brandId}
        onSuccess={() => {
          queryClient.invalidateQueries({
            queryKey: ['geo-loop', 'dispatch-plans', brandId],
          });
          queryClient.invalidateQueries({
            queryKey: ['geo-loop', 'dispatch-overview', brandId],
          });
        }}
      />

      {/* 当日清单弹窗 */}
      <DayPlanDialog
        open={dayDialogOpen}
        onOpenChange={setDayDialogOpen}
        date={selectedDate}
        plans={dayPlans}
        onConvert={handleConvertInDialog}
        converting={convertMutation.isPending}
      />

      {/* 转订单确认弹窗 */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50">
                <CreditCard className="h-4 w-4 text-blue-500" />
              </span>
              确认转订单
            </DialogTitle>
            <DialogDescription>
              已匹配 {previewLoading ? '-' : previewData?.matchedCount ?? 0} 条可转订单计划
              {previewData && previewData.unmatchedCount > 0 && (
                <span className="text-amber-600">
                  （{previewData.unmatchedCount} 条未关联渠道）
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {previewData && previewData.unmatchedCount > 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-sm text-amber-700">
                请先为这 {previewData.unmatchedCount} 条计划选择可售渠道
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">预计扣款</span>
              <span className="font-semibold text-slate-800 tnum">
                {previewLoading ? '计算中...' : previewData ? `¥${(previewData.totalPriceCents / 100).toFixed(2)}` : '-'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">当前钱包余额</span>
              <span className={`font-semibold tnum ${previewData && !previewData.sufficient ? 'text-red-500' : 'text-slate-800'}`}>
                {previewLoading ? '计算中...' : previewData ? `¥${(previewData.balanceCents / 100).toFixed(2)}` : '-'}
              </span>
            </div>
            {previewData && !previewData.sufficient && (
              <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-sm text-red-600">
                余额不足，还需 ¥{((previewData.totalPriceCents - previewData.balanceCents) / 100).toFixed(2)}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              取消
            </Button>
            {previewData && !previewData.sufficient ? (
              <Button onClick={() => navigate('/media-market?tab=wallet')}>
                去充值
              </Button>
            ) : (
              <Button
                onClick={handleConfirmConvert}
                disabled={previewLoading || convertMutation.isPending || !previewData?.sufficient || previewData.unmatchedCount > 0}
              >
                {convertMutation.isPending ? '转单中...' : '确认转订单'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 余额不足提示弹窗 */}
      <Dialog open={!!balanceError} onOpenChange={(v) => !v && setBalanceError('')}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50">
                <span className="text-amber-500 text-lg">!</span>
              </span>
              钱包余额不足
            </DialogTitle>
            <DialogDescription>
              {balanceError}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setBalanceError('')}
            >
              取消
            </Button>
            <Button
              onClick={() => {
                setBalanceError('');
                navigate('/media-market?tab=wallet');
              }}
            >
              去充值
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- 指标卡 ---------- */

function MetricCard({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: number;
  unit: string;
  accent: 'blue' | 'emerald';
}) {
  const colorMap = {
    blue: 'text-[#2E7DFF]',
    emerald: 'text-emerald-500',
  } as const;
  return (
    <Card className="p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={'text-2xl font-bold tnum ' + colorMap[accent]}>{value}</span>
        <span className="text-xs text-slate-400">{unit}</span>
      </div>
    </Card>
  );
}

function TierCard({
  distribution,
}: {
  distribution: { A: number; B: number; C: number };
}) {
  return (
    <Card className="p-4">
      <div className="text-xs text-slate-500 mb-1">档位分布</div>
      <div className="flex items-center gap-2 flex-wrap">
        {(Object.keys(distribution) as WeightTier[]).map((tier) => (
          <Badge
            key={tier}
            variant="outline"
            className="h-5 px-2 text-[11px] border-slate-200 text-slate-600 bg-slate-50"
          >
            {tier}档 × {distribution[tier]}
          </Badge>
        ))}
      </div>
    </Card>
  );
}

function MetricSkeleton() {
  return (
    <Card className="p-4">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="mt-2 h-7 w-12" />
    </Card>
  );
}

function WeekCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 pt-3 px-3">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent className="p-2 pt-0">
        <Skeleton className="h-16 w-full" />
      </CardContent>
    </Card>
  );
}

/* ---------- 智能排期弹窗 ---------- */

function ScheduleDialog({
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
  const [totalArticles, setTotalArticles] = useState<string>('20');
  const [weeks, setWeeks] = useState<string>('4');
  const [perWeek, setPerWeek] = useState<string>('5');
  const [selectedTiers, setSelectedTiers] = useState<Set<WeightTier>>(
    new Set(['A', 'B', 'C']),
  );
  const [budgetLimit, setBudgetLimit] = useState<string>('');

  const toggleTier = (tier: WeightTier) => {
    const next = new Set(selectedTiers);
    if (next.has(tier)) next.delete(tier);
    else next.add(tier);
    setSelectedTiers(next);
  };

  const mutation = useMutation({
    mutationFn: () =>
      smartSchedule({
        brandId,
        totalArticles: Number(totalArticles) || 0,
        weeks: Number(weeks) || 4,
        perWeek: Number(perWeek) || 5,
        tiers: Array.from(selectedTiers),
        budgetLimit: budgetLimit ? Number(budgetLimit) : undefined,
      }),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['geo-loop', 'dispatch-plans', brandId],
      });
      queryClient.invalidateQueries({
        queryKey: ['geo-loop', 'dispatch-overview', brandId],
      });
      onSuccess();
      onOpenChange(false);
      toast.success('智能排期已生成');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, '生成失败'));
    },
  });

  const handleSubmit = () => {
    if (selectedTiers.size === 0) {
      toast.error('请至少选择一个渠道档位');
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-[#2E7DFF]" />
            智能排期
          </DialogTitle>
          <DialogDescription>
            基于内容量和渠道档位，自动分配未来发布节奏
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">总篇数</label>
              <Input
                type="number"
                value={totalArticles}
                onChange={(e) => setTotalArticles(e.target.value)}
                placeholder="20"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">周数</label>
              <Input
                type="number"
                value={weeks}
                onChange={(e) => setWeeks(e.target.value)}
                placeholder="4"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">每周篇数</label>
              <Input
                type="number"
                value={perWeek}
                onChange={(e) => setPerWeek(e.target.value)}
                placeholder="5"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">渠道档位</label>
            <div className="flex gap-3 flex-wrap">
              {WEIGHT_TIERS.map((tier) => (
                <label
                  key={tier}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedTiers.has(tier)}
                    onCheckedChange={() => toggleTier(tier)}
                    aria-label={`选择 ${tier} 档`}
                  />
                  <span className="text-sm text-slate-700">
                    {WEIGHT_TIER_LABELS[tier]}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">
              预算上限（元，选填）
            </label>
            <Input
              type="number"
              value={budgetLimit}
              onChange={(e) => setBudgetLimit(e.target.value)}
              placeholder="不限制"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? '生成中...' : '生成排期'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- 当日清单弹窗 ---------- */

function DayPlanDialog({
  open,
  onOpenChange,
  date,
  plans,
  onConvert,
  converting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  date: string;
  plans: DispatchPlan[];
  onConvert: (ids: string[]) => void;
  converting: boolean;
}) {
  const [convertingIds, setConvertingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!converting) {
      setConvertingIds(new Set());
    }
  }, [converting]);

  const plannableCount = plans.filter((p) => p.status === 'planned').length;

  const dateLabel = date
    ? (() => {
        const [, m, d] = date.split('-');
        return `${Number(m)}月${Number(d)}日`;
      })()
    : '';

  const handleConvertOne = (planId: string) => {
    logger.info('[convert-btn] click', String(planId));
    setConvertingIds((prev) => new Set(prev).add(planId));
    onConvert([planId]);
  };

  const handleConvertAll = () => {
    const ids = plans.filter((p) => p.status === 'planned').map((p) => p.id);
    if (ids.length > 0) {
      onConvert(ids);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{dateLabel} · 发布计划</DialogTitle>
          <DialogDescription>
            每行可单独转单；批量操作请使用卡片右上角「待排期转订单」按钮
          </DialogDescription>
        </DialogHeader>
        {plans.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-slate-400">
            当天暂无排期计划
          </div>
        ) : (
          <div className="max-h-[320px] overflow-y-auto -mx-2">
            <Table className="table-fixed w-full">
              <colgroup>
                <col style={{ width: 'auto' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '22%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '70px' }} />
              </colgroup>
              <TableHeader>
                <TableRow className="h-8">
                  <TableHead className="h-8 px-3 text-xs">标题/渠道</TableHead>
                  <TableHead className="h-8 px-3 text-xs">档位</TableHead>
                  <TableHead className="h-8 px-3 text-xs">订单号</TableHead>
                  <TableHead className="h-8 px-3 text-xs">状态</TableHead>
                  <TableHead className="h-8 px-2 text-xs text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id} className="h-9">
                    <TableCell className="px-3">
                      <div className="text-[13px] font-medium text-[#0F172A] break-words min-w-0">
                        {plan.title ?? plan.channelName ?? '未命名'}
                      </div>
                      {plan.channelName && plan.title && (
                        <div className="text-[12px] text-[#94A3B8] break-words min-w-0">
                          {plan.channelName}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="px-3">
                      {plan.weightTier && (
                        <Badge
                          variant="outline"
                          className="h-5 px-1.5 text-[11px] border-slate-200 text-slate-600 bg-slate-50"
                        >
                          {plan.weightTier}档
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="px-3">
                      <span className="text-[12px] text-[#94A3B8] break-all block">
                        {plan.orderId ?? '-'}
                      </span>
                    </TableCell>
                    <TableCell className="px-3">
                      <PlanStatusBadge status={plan.status} />
                    </TableCell>
                    <TableCell
                      className="px-2 text-right"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (plan.status !== 'planned') return;
                        if (converting || convertingIds.has(plan.id)) return;
                        logger.info('[convert-cell] click', String(plan.id));
                        handleConvertOne(plan.id);
                      }}
                      style={{ cursor: plan.status === 'planned' ? 'pointer' : 'default' }}
                    >
                      {plan.status === 'planned' ? (
                        <button
                          type="button"
                          data-testid={`convert-btn-${plan.id}`}
                          className="h-7 px-2 text-[11px] rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={(e) => {
                            e.stopPropagation();
                            logger.info('[convert-btn] click', String(plan.id));
                            handleConvertOne(plan.id);
                          }}
                          disabled={converting || convertingIds.has(plan.id)}
                        >
                          {convertingIds.has(plan.id) ? '转单中' : '转成订单'}
                        </button>
                      ) : plan.status === 'queued' ? (
                        <span className="text-[11px] text-blue-500">已下单</span>
                      ) : plan.status === 'published' ? (
                        <span className="text-[11px] text-emerald-500">已发布</span>
                      ) : plan.status === 'failed' ? (
                        <span className="text-[11px] text-red-400">失败</span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <DialogFooter className="justify-between">
          <span className="text-xs text-slate-400">
            共 {plannableCount} 条待排期
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              关闭
            </Button>
            <Button
              size="sm"
              onClick={handleConvertAll}
              disabled={plannableCount === 0 || converting}
            >
              {converting ? '转单中...' : `全部转成订单（${plannableCount}条）`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlanStatusBadge({ status }: { status: DispatchPlanStatus }) {
  const colorMap: Record<DispatchPlanStatus, string> = {
    planned: 'bg-slate-100 text-slate-600 border-slate-200',
    queued: 'bg-blue-50 text-blue-600 border-blue-100',
    published: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    failed: 'bg-red-50 text-red-500 border-red-100',
  };
  return (
    <Badge
      variant="outline"
      className={
        'h-5 px-1.5 text-[11px] font-normal whitespace-nowrap ' + colorMap[status]
      }
    >
      {DISPATCH_PLAN_STATUS_LABELS[status]}
    </Badge>
  );
}

/* ---------- 通用 ---------- */

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-24 flex-col items-center justify-center text-center">
      <XCircle className="mb-1 h-6 w-6 text-red-400" />
      <p className="mb-2 text-xs text-slate-500">加载失败</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        重试
      </Button>
    </div>
  );
}

// 避免 CheckCircle2 未使用警告
void CheckCircle2;
