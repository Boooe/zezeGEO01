import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Share2,
  FileDown,
  Copy,
  Check,
  AlertCircle,
  RefreshCw,
  Eye,
  TrendingUp,
  Target,
  BookOpen,
  Quote,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { SectionCard } from '@client/src/components/layout/SectionCard';
import { Pill } from '@client/src/components/layout/Pill';
import { StatCard } from '@client/src/components/layout/StatCard';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@client/src/components/ui/tabs';
import {
  getDiagnosisReport,
  getDiagnosisResults,
  getDiagnosisTask,
  shareDiagnosisReport,
} from '@client/src/api/diagnosis';
import {
  DIAGNOSIS_PLATFORM_LABELS,
  DIAGNOSIS_STATUS_LABELS,
  MENTION_POSITION_LABELS,
  SENTIMENT_LABELS,
} from '@shared/api.interface';
import type {
  DiagnosisReport,
  DiagnosisResultItem,
  DiagnosisRecommendation,
} from '@shared/api.interface';

const PRIMARY = '#2E7DFF';
const SUCCESS = '#10B981';
const DANGER = '#EF4444';
const WARNING = '#F59E0B';

const PRIORITY_COLORS: Record<string, { variant: 'danger' | 'warning' | 'info'; label: string }> = {
  high: { variant: 'danger', label: '高优先级' },
  medium: { variant: 'warning', label: '中优先级' },
  low: { variant: 'info', label: '低优先级' },
};

function getScoreColor(score: number): string {
  if (score >= 80) return SUCCESS;
  if (score >= 60) return WARNING;
  return DANGER;
}

function getScoreLevel(score: number): string {
  if (score >= 80) return '优秀';
  if (score >= 60) return '良好';
  if (score >= 40) return '一般';
  return '待提升';
}

const DiagnosisReportPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const {
    data: report,
    isLoading: reportLoading,
    isError: reportError,
    refetch: refetchReport,
  } = useQuery({
    queryKey: ['diagnosis', 'report', id],
    queryFn: () => getDiagnosisReport(id!),
    enabled: !!id,
  });

  const {
    data: taskInfo,
    refetch: refetchTask,
  } = useQuery({
    queryKey: ['diagnosis', 'task', report?.taskId],
    queryFn: () => getDiagnosisTask(report!.taskId),
    enabled: !!report?.taskId,
    refetchInterval: (query) => (query.state.data?.status === 'running' ? 3000 : false),
  });

  const isRunning = taskInfo?.status === 'running';

  const { data: results = [], isLoading: resultsLoading } = useQuery({
    queryKey: ['diagnosis', 'results', id],
    queryFn: () => getDiagnosisResults(id!),
    enabled: !!id && !!report,
    refetchInterval: isRunning ? 3000 : false,
  });

  const shareMutation = useMutation({
    mutationFn: () => shareDiagnosisReport(id!),
    retry: false,
    onSuccess: () => {
      setShareOpen(true);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message ?? '生成分享链接失败';
      toast.error(msg);
    },
  });

  const handleCopyLink = () => {
    if (shareMutation.data?.shareUrl) {
      navigator.clipboard.writeText(shareMutation.data.shareUrl).then(() => {
        setCopied(true);
        toast.success('链接已复制');
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const handleExport = () => {
    toast.info('导出 PDF 功能开发中，敬请期待');
  };

  const toggleRow = (rowId: string) => {
    const next = new Set(expandedRows);
    if (next.has(rowId)) {
      next.delete(rowId);
    } else {
      next.add(rowId);
    }
    setExpandedRows(next);
  };

  if (reportLoading) {
    return <ReportSkeleton />;
  }

  if (reportError) {
    return (
      <div className="space-y-4">
        <Link
          to="/diagnosis?tab=reports"
          className="inline-flex items-center text-sm"
          style={{ color: PRIMARY }}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          返回诊断列表
        </Link>
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4">
          <div
            className="flex items-center gap-2 text-sm"
            style={{ color: DANGER }}
          >
            <AlertCircle className="h-4 w-4" />
            <span>报告加载失败，请重试</span>
          </div>
          <button
            onClick={() => refetchReport()}
            className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-red-100"
            style={{ color: DANGER }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            重试
          </button>
        </div>
      </div>
    );
  }

  if (!report) return null;

  const { reportData, overallScore, visibilityScore, rankingScore, coverageScore, citationScore } = report as DiagnosisReport;
  const groupedRecs = reportData?.recommendations?.reduce(
    (acc: Record<string, DiagnosisRecommendation[]>, rec) => {
      const key = rec.priority || 'low';
      if (!acc[key]) acc[key] = [];
      acc[key].push(rec);
      return acc;
    },
    {},
  ) ?? {};

  const platforms = Array.from(new Set(results.map((r: DiagnosisResultItem) => r.platform)));

  const activePlatforms = platforms.filter((p) =>
    results.some((r: DiagnosisResultItem) => r.platform === p && r.status !== 'skipped'),
  );
  const skippedPlatformNames = platforms
    .filter((p) => results.filter((r: DiagnosisResultItem) => r.platform === p).every((r: DiagnosisResultItem) => r.status === 'skipped'))
    .map((p) => DIAGNOSIS_PLATFORM_LABELS[p as keyof typeof DIAGNOSIS_PLATFORM_LABELS] || p);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/diagnosis?tab=reports"
            className="inline-flex items-center text-sm"
            style={{ color: PRIMARY }}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            返回诊断列表
          </Link>
          <div>
            <h1
              className="text-[20px] font-semibold leading-none"
              style={{ color: '#101828' }}
            >
              {report.brandName} GEO 诊断报告
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              生成时间：
              {report.createdAt
                ? new Date(report.createdAt).toLocaleString('zh-CN')
                : '-'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <FileDown className="mr-1 h-4 w-4" />
            导出 PDF
          </Button>
          <Button
            size="sm"
            style={{ backgroundColor: PRIMARY }}
            onClick={() => shareMutation.mutate()}
            disabled={shareMutation.isPending}
          >
            <Share2 className="mr-1 h-4 w-4" />
            {shareMutation.isPending ? '生成中...' : '生成分享链接'}
          </Button>
        </div>
      </div>

      {/* 演示样例提示 */}
      {report.isDemo && (
        <div
          className="mb-4 rounded-lg px-4 py-3 text-sm"
          style={{
            backgroundColor: '#fffbeb',
            border: '1px solid #fde68a',
            color: '#92400e',
          }}
        >
          ⚠ 演示样例数据 · 用于展示报告结构，非真实 AI 检测结果
        </div>
      )}

      {/* 诊断进度条 */}
      {taskInfo && taskInfo.status !== 'completed' && (
        <div
          className="rounded-lg px-4 py-3"
          style={{
            backgroundColor: taskInfo.status === 'failed' ? '#FEF2F2' : '#EFF6FF',
            border: `1px solid ${taskInfo.status === 'failed' ? '#FECACA' : '#BFDBFE'}`,
          }}
        >
          <div className="mb-2 flex items-center justify-between text-sm">
            <span style={{ color: taskInfo.status === 'failed' ? '#DC2626' : '#1D4ED8', fontWeight: 500 }}>
              {taskInfo.status === 'running' ? '诊断进行中' : taskInfo.status === 'failed' ? '诊断失败' : DIAGNOSIS_STATUS_LABELS[taskInfo.status] ?? taskInfo.status}
              {taskInfo.totalCount > 0 && ` · 已完成 ${taskInfo.completedCount}/${taskInfo.totalCount}`}
              {taskInfo.failedCount > 0 && ` · 失败 ${taskInfo.failedCount} 条`}
              {taskInfo.skippedCount > 0 && ` · 未接入 ${taskInfo.skippedCount} 条`}
            </span>
            {taskInfo.status === 'running' && (
              <span style={{ color: '#64748B', fontSize: 12 }}>
                请稍候，完成后自动刷新
              </span>
            )}
          </div>
          {taskInfo.totalCount > 0 && (
            <div
              style={{
                height: 6,
                borderRadius: 3,
                backgroundColor: '#E5E9F2',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, Math.round((taskInfo.completedCount + taskInfo.failedCount + taskInfo.skippedCount) / taskInfo.totalCount * 100))}%`,
                  backgroundColor: taskInfo.status === 'failed' ? '#DC2626' : PRIMARY,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          )}
          {taskInfo.status === 'failed' && taskInfo.error && (
            <p className="mt-2 text-xs" style={{ color: '#B91C1C' }}>
              失败原因：{taskInfo.error}
            </p>
          )}
        </div>
      )}

      {/* 部分完成提示 */}
      {taskInfo && taskInfo.status === 'completed' && taskInfo.failedCount > 0 && (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{
            backgroundColor: '#FFFBEB',
            border: '1px solid #FDE68A',
            color: '#92400e',
          }}
        >
          已完成 {taskInfo.completedCount}/{taskInfo.totalCount}，失败 {taskInfo.failedCount} 条
          {taskInfo.skippedCount > 0 && `，未接入跳过 ${taskInfo.skippedCount} 条`}
          ，可在下方明细中查看各题状态
        </div>
      )}

      {/* 综合评分卡片 */}
      <SectionCard title="综合 GEO 评分">
        <div className="flex flex-col items-center gap-5 py-2 md:flex-row md:justify-around">
          <div className="text-center">
            <div
              className="text-[48px] font-bold leading-none tabular-nums"
              style={{ color: getScoreColor(overallScore) }}
            >
              {overallScore}
            </div>
            <div
              className="mt-2 text-[13px] font-medium"
              style={{ color: getScoreColor(overallScore) }}
            >
              综合评分 · {getScoreLevel(overallScore)}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="AI 可见度" value={visibilityScore} />
            <StatCard label="推荐顺位" value={rankingScore} />
            <StatCard label="问题覆盖度" value={coverageScore} />
            <StatCard label="内容可引用度" value={citationScore} />
          </div>
        </div>
      </SectionCard>

      {/* 诊断摘要 */}
      <SectionCard title="诊断摘要">
        <p className="text-[13px] leading-relaxed" style={{ color: '#5B6B85', lineHeight: 1.6 }}>
          {reportData?.summary ?? '暂无摘要'}
        </p>
      </SectionCard>

      {/* 四维度详情 */}
      <div className="grid gap-5 md:grid-cols-2">
        <DimensionCard
          title="AI 可见度"
          desc="用户提问后，品牌被 AI 提及的比例"
          score={visibilityScore}
          detail={`${reportData?.visibility?.hitQuestions ?? 0} / ${reportData?.visibility?.totalQuestions ?? 0} 题被提及`}
        />
        <DimensionCard
          title="推荐顺位"
          desc="品牌在 AI 回答中的排序位置"
          score={rankingScore}
          detail={`平均位次：${reportData?.ranking?.avgPosition ?? '-'}`}
        />
        <DimensionCard
          title="问题覆盖度"
          desc="能触达的用户问题类型数量"
          score={coverageScore}
          detail={`覆盖 ${reportData?.coverage?.coveredTypes?.length ?? 0} / ${reportData?.coverage?.totalTypes ?? 0} 种类型`}
        />
        <DimensionCard
          title="内容可引用度"
          desc="AI 回答中可引用的品牌自有内容丰富度"
          score={citationScore}
          detail={
            reportData?.citation?.citedSources?.length
              ? `引用来源：${reportData.citation.citedSources.join('、')}`
              : '暂无可引用来源'
          }
        />
      </div>

      {/* 逐题检测结果 */}
      <SectionCard title="逐题检测结果">
        {activePlatforms.length > 0 && (
          <p className="text-[12px] mb-4" style={{ color: '#94A3B8' }}>
            实际检测平台：{activePlatforms.map((p) => DIAGNOSIS_PLATFORM_LABELS[p as keyof typeof DIAGNOSIS_PLATFORM_LABELS] || p).join('、')}
            {skippedPlatformNames.length > 0 && `；未接入未检测：${skippedPlatformNames.join('、')}`}
          </p>
        )}
        {resultsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-md" />
            ))}
          </div>
        ) : activePlatforms.length > 1 ? (
          <Tabs defaultValue={activePlatforms[0]}>
            <TabsList>
              {activePlatforms.map((p) => (
                <TabsTrigger key={p} value={p}>
                  {DIAGNOSIS_PLATFORM_LABELS[p as keyof typeof DIAGNOSIS_PLATFORM_LABELS] || p}
                </TabsTrigger>
              ))}
            </TabsList>
            {activePlatforms.map((p) => (
              <TabsContent key={p} value={p}>
                <ResultsTable
                  results={results.filter((r: DiagnosisResultItem) => r.platform === p)}
                  expandedRows={expandedRows}
                  toggleRow={toggleRow}
                />
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <ResultsTable
            results={results}
            expandedRows={expandedRows}
            toggleRow={toggleRow}
          />
        )}
      </SectionCard>

      {/* 改进建议 */}
      <SectionCard title="改进建议">
        <div className="flex items-center gap-2 mb-5">
          <BookOpen className="h-5 w-5" style={{ color: WARNING }} />
          <span className="text-[14px] font-semibold" style={{ color: '#0F172A' }}>优化方向</span>
        </div>
        <div className="space-y-5">
          {reportData?.recommendations && reportData.recommendations.length > 0 ? (
            ['high', 'medium', 'low'].map((priority) => {
              const items = groupedRecs[priority];
              if (!items || items.length === 0) return null;
              const pConfig =
                PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.low;
              return (
                <div key={priority} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Pill variant={pConfig.variant}>{pConfig.label}</Pill>
                    <span className="text-[12px]" style={{ color: '#94A3B8' }}>
                      共 {items.length} 条
                    </span>
                  </div>
                  <div className="space-y-3">
                    {items.map((rec, idx) => (
                      <div
                        key={idx}
                        className="rounded-[8px] border p-4"
                        style={{ borderColor: '#E6EAF2' }}
                      >
                        <h4 className="text-[13px] font-semibold" style={{ color: '#0F172A' }}>
                          {rec.title}
                        </h4>
                        <p
                          className="mt-2 text-[13px]"
                          style={{ color: '#5B6B85', lineHeight: 1.6 }}
                        >
                          {rec.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-[13px]" style={{ color: '#94A3B8' }}>暂无改进建议</p>
          )}
        </div>
      </SectionCard>

      {/* 分享链接弹窗 */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>分享链接已生成</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              将以下链接分享给他人，对方可匿名查看此诊断报告
            </p>
            <div className="flex items-center gap-2 rounded-md border bg-slate-50 p-2">
              <input
                readOnly
                value={shareMutation.data?.shareUrl ?? ''}
                className="flex-1 bg-transparent text-sm text-slate-700 outline-none"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={handleCopyLink}
              >
                {copied ? (
                  <>
                    <Check className="mr-1 h-3.5 w-3.5" />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy className="mr-1 h-3.5 w-3.5" />
                    复制
                  </>
                )}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

function DimensionCard({
  title,
  desc,
  score,
  detail,
}: {
  title: string;
  desc: string;
  score: number;
  detail: string;
}) {
  return (
    <div
      className="rounded-[12px] border bg-white p-5"
      style={{
        borderColor: '#E6EAF2',
        boxShadow: '0 1px 2px rgba(15,23,42,.04), 0 8px 24px -12px rgba(15,23,42,.10)',
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-[14px] font-semibold" style={{ color: '#0F172A' }}>{title}</h3>
          <p className="mt-1 text-[12px]" style={{ color: '#94A3B8' }}>{desc}</p>
        </div>
        <div
          className="text-[28px] font-bold tabular-nums leading-none"
          style={{ color: getScoreColor(score) }}
        >
          {score}
        </div>
      </div>
      <div className="mt-4">
        <div className="h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: '#EEF2F7' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${score}%`,
              backgroundColor: getScoreColor(score),
            }}
          />
        </div>
        <p className="mt-2 text-[12px]" style={{ color: '#5B6B85' }}>{detail}</p>
      </div>
    </div>
  );
}

function ResultsTable({
  results,
  expandedRows,
  toggleRow,
}: {
  results: DiagnosisResultItem[];
  expandedRows: Set<string>;
  toggleRow: (id: string) => void;
}) {
  if (results.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        暂无检测结果
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {results.map((r) => (
        <div key={r.id} className="overflow-hidden rounded-[8px] border" style={{ borderColor: '#E6EAF2' }}>
          <div
            className="flex items-center gap-3 p-3 cursor-pointer transition-colors"
            style={{
              backgroundColor: r.status === 'failed' ? 'rgba(239, 68, 68, 0.04)' : undefined,
            }}
            onMouseEnter={(e) => { if (r.status !== 'failed') e.currentTarget.style.backgroundColor = '#F7FAFF'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = r.status === 'failed' ? 'rgba(239, 68, 68, 0.04)' : ''; }}
            onClick={() => toggleRow(r.id)}
          >
            <button
              style={{ color: '#94A3B8' }}
              aria-label={expandedRows.has(r.id) ? '收起' : '展开'}
            >
              {expandedRows.has(r.id) ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            <span className="flex-1 text-[13px] truncate" style={{ color: '#0F172A' }} title={r.question}>{r.question}</span>
            {r.status === 'failed' ? (
              <Pill variant="danger">检测失败</Pill>
            ) : r.status === 'skipped' ? (
              <Pill variant="muted">未接入</Pill>
            ) : (
              <Pill variant={r.isMentioned ? 'success' : 'muted'}>
                {r.isMentioned ? '已提及' : '未提及'}
              </Pill>
            )}
            {r.mentionPosition && (
              <span className="text-[12px] tabular-nums" style={{ color: '#94A3B8' }}>
                {MENTION_POSITION_LABELS[r.mentionPosition as keyof typeof MENTION_POSITION_LABELS] || r.mentionPosition}
              </span>
            )}
            <Pill
              variant={
                r.sentiment === 'positive'
                  ? 'success'
                  : r.sentiment === 'negative'
                  ? 'danger'
                  : 'muted'
              }
            >
              {SENTIMENT_LABELS[r.sentiment as keyof typeof SENTIMENT_LABELS] || r.sentiment}
            </Pill>
          </div>
          {expandedRows.has(r.id) && (
            <div className="border-t p-4" style={{ borderColor: '#EEF2F7', backgroundColor: '#F8FAFC' }}>
              <div className="space-y-3 text-[13px]" style={{ lineHeight: 1.6 }}>
                {r.answerSummary && (
                  <div>
                    <span className="font-medium" style={{ color: '#0F172A' }}>回答摘要：</span>
                    <span style={{ color: '#5B6B85' }}>{r.answerSummary}</span>
                  </div>
                )}
                {r.otherBrands && r.otherBrands.length > 0 && (
                  <div>
                    <span className="font-medium" style={{ color: '#0F172A' }}>提到的其他品牌：</span>
                    <span style={{ color: '#5B6B85' }}>{r.otherBrands.join('、')}</span>
                  </div>
                )}
                {r.rawAnswer && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[12px] hover:opacity-80" style={{ color: '#94A3B8' }}>
                      查看原始回答全文
                    </summary>
                    <p className="mt-2 whitespace-pre-wrap rounded-[8px] border bg-white p-3 text-[12px]" style={{ color: '#5B6B85', borderColor: '#E6EAF2', lineHeight: 1.6 }}>
                      {r.rawAnswer}
                    </p>
                  </details>
                )}
                {r.error && (
                  <div className="text-[12px]" style={{ color: DANGER }}>
                    检测错误：{r.error}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-64" />
      </div>
      <Skeleton className="h-40 w-full rounded-lg" />
      <Skeleton className="h-32 w-full rounded-lg" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}

export default DiagnosisReportPage;
