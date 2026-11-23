import React, { useState, useMemo } from 'react';
import { useAuditLogList } from '@client/src/api/audit-logs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@client/src/components/ui/table';
import { Badge } from '@client/src/components/ui/badge';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { Input } from '@client/src/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { Button } from '@client/src/components/ui/button';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import type { OperationLog } from '@shared/api.interface';

/* ---------- 操作类型 → badge 颜色映射 ---------- */

type BadgeColor = 'blue' | 'green' | 'orange' | 'red' | 'gray';

const ACTION_COLOR_MAP: Record<string, BadgeColor> = {
  login: 'blue',
  logout: 'blue',
  diagnosis_create: 'green',
  diagnosis_update: 'green',
  media_order: 'green',
  publish_record: 'green',
  recharge_approve: 'orange',
  recharge_reject: 'orange',
  member_enable: 'orange',
  member_disable: 'red',
  account_disable: 'red',
  delete: 'red',
};

const BADGE_CLASS_MAP: Record<BadgeColor, string> = {
  blue: 'bg-[#E8F1FF] text-[#2E7DFF] border-transparent',
  green: 'bg-[#E7F8EF] text-[#17C964] border-transparent',
  orange: 'bg-[#FFF4E5] text-[#FFA940] border-transparent',
  red: 'bg-[#FFECEC] text-[#FF5C5C] border-transparent',
  gray: 'bg-[#F2F4F7] text-[#475467] border-transparent',
};

function getActionBadgeClass(action: string): string {
  const color = ACTION_COLOR_MAP[action] ?? 'gray';
  return BADGE_CLASS_MAP[color];
}

/* ---------- 角色标签 ---------- */

const ROLE_LABELS: Record<string, string> = {
  admin: '管理员',
  operator: '运营员',
  client: '客户',
};

/* ---------- 操作类型选项（前端常用项，可自由输入） ---------- */

const ACTION_OPTIONS = [
  { value: 'login', label: '登录' },
  { value: 'logout', label: '登出' },
  { value: 'diagnosis_create', label: '创建诊断' },
  { value: 'diagnosis_update', label: '更新诊断' },
  { value: 'media_order', label: '媒介下单' },
  { value: 'recharge_approve', label: '充值审批通过' },
  { value: 'recharge_reject', label: '充值审批驳回' },
  { value: 'publish_record', label: '发布记录' },
  { value: 'member_enable', label: '启用成员' },
  { value: 'member_disable', label: '禁用成员' },
];

const PAGE_SIZE = 20;

const OperationLogsPage: React.FC = () => {
  const [keyword, setKeyword] = useState('');
  const [role, setRole] = useState('');
  const [action, setAction] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);

  const queryParams = useMemo(() => {
    const params: Record<string, string | number | undefined> = {
      page,
      pageSize: PAGE_SIZE,
    };
    if (keyword.trim()) params.keyword = keyword.trim();
    if (role) params.role = role;
    if (action) params.action = action;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    return params;
  }, [keyword, role, action, startDate, endDate, page]);

  const { data, isLoading, isError } = useAuditLogList(queryParams);

  const totalPages = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  }, [data]);

  const handleSearch = (): void => {
    setPage(1);
  };

  const handleReset = (): void => {
    setKeyword('');
    setRole('');
    setAction('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const formatTime = (iso: string): string => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] p-6">
      {/* 标题区 */}
      <div className="mb-4">
        <h1 className="text-[20px] font-semibold text-[#0f172a]">操作日志</h1>
        <p className="mt-1 text-[13px] text-[#64748b]">
          记录系统内所有关键操作行为，便于追溯与审计
        </p>
      </div>

      {/* 筛选条卡片 */}
      <div className="mb-4 rounded-[12px] border border-[#E5E9F2] bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          {/* 关键字搜索 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] text-[#64748b]">关键字</label>
            <div className="relative w-[220px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
              <Input
                placeholder="操作人 / 对象 / 详情"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch();
                }}
                className="pl-8"
              />
            </div>
          </div>

          {/* 角色筛选 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] text-[#64748b]">角色</label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="全部" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部</SelectItem>
                <SelectItem value="admin">管理员</SelectItem>
                <SelectItem value="operator">运营员</SelectItem>
                <SelectItem value="client">客户</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 操作类型 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] text-[#64748b]">操作类型</label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="全部" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部</SelectItem>
                {ACTION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 开始日期 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] text-[#64748b]">开始日期</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-[160px]"
            />
          </div>

          {/* 结束日期 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] text-[#64748b]">结束日期</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-[160px]"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" onClick={handleReset}>
              重置
            </Button>
            <Button onClick={handleSearch}>查询</Button>
            <span className="ml-2 text-[12px] text-[#94a3b8]">
              仅保留最近 7 天日志
            </span>
          </div>
        </div>
      </div>

      {/* 表格卡片 */}
      <div className="rounded-[12px] border border-[#E5E9F2] bg-white">
        <Table>
          <TableHeader className="bg-[#F7F9FC]">
            <TableRow className="h-11">
              <TableHead className="w-[170px]">时间</TableHead>
              <TableHead className="w-[120px]">操作人</TableHead>
              <TableHead className="w-[100px]">角色</TableHead>
              <TableHead className="w-[140px]">操作</TableHead>
              <TableHead className="w-[180px]">操作对象</TableHead>
              <TableHead>详情</TableHead>
              <TableHead className="w-[130px] text-right tabular-nums">
                IP
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`} className="h-11">
                  <TableCell>
                    <Skeleton className="h-4 w-[140px]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-[80px]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-[60px] rounded-[6px]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-[80px] rounded-[6px]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-[120px]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-4 w-[100px]" />
                  </TableCell>
                </TableRow>
              ))}

            {!isLoading && isError && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-12 text-center text-[13px] text-[#64748b]"
                >
                  加载失败，请稍后重试
                </TableCell>
              </TableRow>
            )}

            {!isLoading && !isError && data?.items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-12 text-center text-[13px] text-[#94a3b8]"
                >
                  暂无操作日志
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              !isError &&
              data?.items &&
              data.items.length > 0 &&
              data.items.map((log: OperationLog) => (
                <TableRow key={log.id} className="h-11">
                  <TableCell className="text-[13px] text-[#0f172a] tabular-nums">
                    {formatTime(log.createdAt)}
                  </TableCell>
                  <TableCell className="text-[13px] text-[#0f172a]">
                    {log.actor || '-'}
                  </TableCell>
                  <TableCell className="text-[13px] text-[#64748b]">
                    {log.role
                      ? ROLE_LABELS[log.role] ?? log.role
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge className={getActionBadgeClass(log.action)}>
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[13px] text-[#0f172a]">
                    {log.target || '-'}
                  </TableCell>
                  <TableCell className="text-[13px] text-[#64748b]">
                    <div
                      className="line-clamp-2 text-[13px] leading-relaxed"
                      title={log.detail ?? ''}
                    >
                      {log.detail || '-'}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-[13px] text-[#64748b] tabular-nums">
                    {log.ip || '-'}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>

        {/* 底部分页 */}
        {!isLoading && data && data.total > 0 && (
          <div className="flex items-center justify-between border-t border-[#EEF2F7] px-4 py-3">
            <div className="text-[12px] text-[#64748b]">
              共{' '}
              <span className="font-medium text-[#334155] tabular-nums">
                {data.total}
              </span>{' '}
              条
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                className="h-7 px-2"
                aria-label="上一页"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-2 text-[12px] text-[#334155] tabular-nums">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
                className="h-7 px-2"
                aria-label="下一页"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OperationLogsPage;
