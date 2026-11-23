import React from 'react';
import { DollarSign, FileText, Clock } from 'lucide-react';
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@client/src/components/ui/table';
import { SectionCard } from '@client/src/components/layout/SectionCard';
import { StatCard } from '@client/src/components/layout/StatCard';
import { useSupplierSettlement } from '@client/src/api/media-market';
import { formatMoneyCents, formatMoneyCentsRaw } from '@client/src/utils/format';

const PRIMARY = '#2563EB';
const SUCCESS = '#16A34A';
const WARNING = '#F59E0B';

const SettlementPage: React.FC = () => {
  const { data, isLoading } = useSupplierSettlement();

  const totalCost = data?.reduce((sum, s) => sum + s.totalCostCents, 0) ?? 0;
  const totalUnsettled = data?.reduce((sum, s) => sum + s.unsettledCents, 0) ?? 0;
  const totalOrders = data?.reduce((sum, s) => sum + s.orderCount, 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* 统计概览 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label="订单总数"
          value={isLoading ? '...' : String(totalOrders)}
        />
        <StatCard
          label="采购总金额"
          value={isLoading ? '...' : formatMoneyCents(totalCost)}
          trendUp
        />
        <StatCard
          label="未结算金额"
          value={isLoading ? '...' : formatMoneyCents(totalUnsettled)}
        />
      </div>

      {/* 结算明细表 */}
      <SectionCard title="供应商结算">
        <div className="overflow-x-auto">
          <Table className="table-fixed w-full" style={{ tableLayout: 'fixed' }}>
            <TableHeader style={{ backgroundColor: '#F1F5F9' }}>
              <TableRow style={{ height: '44px' }}>
                <TableHead className="text-[12px] font-medium text-[#334155]">供应商</TableHead>
                <TableHead style={{ width: '120px' }} className="text-right text-[12px] font-medium text-[#334155] tnum">订单数</TableHead>
                <TableHead style={{ width: '140px' }} className="text-right text-[12px] font-medium text-[#334155] tnum">采购总金额</TableHead>
                <TableHead style={{ width: '140px' }} className="text-right text-[12px] font-medium text-[#334155] tnum">未结算金额</TableHead>
                <TableHead style={{ width: '180px' }} className="text-right text-[12px] font-medium text-[#334155]">结算占比</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i} style={{ height: '44px' }}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : !data?.length
                ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-12 text-center text-[#94A3B8] text-[13px]">
                        暂无供应商结算数据
                      </TableCell>
                    </TableRow>
                  )
                : data.map((stat) => {
                    const ratio =
                      totalCost > 0
                        ? ((stat.totalCostCents / totalCost) * 100).toFixed(1)
                        : '0.0';
                    return (
                      <TableRow key={stat.supplierId} style={{ height: '44px' }}>
                        <TableCell className="text-[13px] font-medium text-[#0f172a]">
                          {stat.supplierName}
                        </TableCell>
                        <TableCell className="text-right text-[13px] tnum text-[#475569]">
                          {stat.orderCount}
                        </TableCell>
                        <TableCell className="text-right text-[13px] tnum font-medium text-[#334155]">
                          {formatMoneyCentsRaw(stat.totalCostCents)}
                        </TableCell>
                        <TableCell className="text-right text-[13px] tnum font-semibold" style={{ color: WARNING }}>
                          {formatMoneyCentsRaw(stat.unsettledCents)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#E2E8F0]">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.min(100, parseFloat(ratio))}%`,
                                  backgroundColor: PRIMARY,
                                }}
                              />
                            </div>
                            <span className="tnum text-[12px] text-[#64748b]">{ratio}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
            </TableBody>
          </Table>
        </div>
      </SectionCard>
    </div>
  );
};

export default SettlementPage;
