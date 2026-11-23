import * as React from 'react';
import { Check, Lightbulb, Send, Link2, Target } from 'lucide-react';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { cn } from '@/lib/utils';

/* ========== 类型定义 ========== */

export type StepStatus = 'completed' | 'inProgress' | 'notStarted';

export interface StepRailStep {
  id: number;
  name: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

export interface StepRailProps {
  steps: StepRailStep[];
  statuses: Record<number, StepStatus>;
  activeStep: number;
  completedCount: number;
  onStepClick: (stepId: number) => void;
  loading?: boolean;
}

/* ========== 状态胶囊样式 ========== */

const statusPillStyles: Record<StepStatus, string> = {
  completed: 'bg-[#10B981] text-white border-[#10B981]',
  inProgress: 'bg-[#2E7DFF] text-white border-[#2E7DFF]',
  notStarted: 'bg-[#F1F5F9] text-[#94A3B8] border-[#F1F5F9]',
};

const statusLabel: Record<StepStatus, string> = {
  completed: '已完成',
  inProgress: '进行中',
  notStarted: '未开始',
};

const circleStyles: Record<StepStatus, string> = {
  completed: 'bg-[#ECFDF5] border-[#A7F3D0] text-[#10B981]',
  inProgress: 'bg-[#EAF2FF] border-[#BFDBFE] text-[#2E7DFF]',
  notStarted: 'bg-[#F8FAFC] border-[#E2E8F0] text-[#94A3B8]',
};

/* ========== 子组件：单步项 ========== */

interface StepRailItemProps {
  step: StepRailStep;
  status: StepStatus;
  isActive: boolean;
  hasConnector: boolean;
  onClick: () => void;
}

const StepRailItem: React.FC<StepRailItemProps> = ({
  step,
  status,
  isActive,
  hasConnector,
  onClick,
}) => {
  return (
    <div className="relative flex w-full flex-col items-center">
      {/* 激活态左侧蓝色竖条 */}
      {isActive && (
        <div
          className="absolute left-0 top-0 bottom-0 w-[2px] rounded-r bg-[#2E7DFF]"
          aria-hidden="true"
        />
      )}
      <button
        onClick={onClick}
        className={cn(
          'relative flex w-full flex-col items-center gap-1 rounded-lg border px-2 py-2 text-center transition-colors',
          isActive
            ? 'border-[#2E7DFF] bg-[#F0F6FF]'
            : 'border-transparent hover:bg-[#F8FAFC]',
        )}
        aria-label={`跳转到第 ${step.id} 步 ${step.name}`}
      >
        {/* 圆形图标 36px */}
        <div
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-full border',
            circleStyles[status],
          )}
        >
          {status === 'completed' ? (
            <Check className="h-4 w-4" strokeWidth={2.5} />
          ) : (
            <step.icon className="h-4 w-4" />
          )}
        </div>
        {/* 步骤名 */}
        <div className="mt-1 text-[13px] font-medium text-[#0F172A]">
          {step.name}
        </div>
        {/* 状态胶囊 */}
        <div className="mt-1">
          <span
            className={cn(
              'inline-flex h-[22px] items-center rounded-[6px] border px-2 text-[12px] font-medium',
              statusPillStyles[status],
            )}
          >
            {statusLabel[status]}
          </span>
        </div>
      </button>
      {/* 竖向连接线 */}
      {hasConnector && (
        <div
          className="absolute top-10 left-1/2 -translate-x-1/2 border-l border-dashed border-[#E6EAF2]"
          style={{ height: '24px' }}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

/* ========== 加载骨架 ========== */

function StepRailSkeleton({ count }: { count: number }) {
  return (
    <div className="flex w-48 flex-col items-center gap-0">
      {/* 总进度骨架 */}
      <Skeleton className="mb-4 h-5 w-20" />
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="relative flex w-full flex-col items-center">
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="mt-2 h-4 w-16" />
          <Skeleton className="mt-1 h-5 w-12 rounded-[6px]" />
          {i < count - 1 && (
            <div
              className="mt-2 border-l border-dashed border-[#E6EAF2]"
              style={{ height: '24px' }}
              aria-hidden="true"
            />
          )}
        </div>
      ))}
    </div>
  );
}

/* ========== 主组件 ========== */

export const StepRail: React.FC<StepRailProps> = ({
  steps,
  statuses,
  activeStep,
  completedCount,
  onStepClick,
  loading = false,
}) => {
  if (loading) {
    return <StepRailSkeleton count={steps.length} />;
  }

  return (
    <div className="flex w-48 flex-col items-center">
      {/* 总进度 */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-[13px] text-[#64748B]">总进度</span>
        <span className="text-[14px] font-semibold text-[#0F172A]">
          已完成 {completedCount}/{steps.length}
        </span>
      </div>

      {/* 步骤列表 */}
      <div className="flex w-full flex-col gap-0">
        {steps.map((step, idx) => (
          <div key={step.id} className="w-full pb-6 last:pb-0">
            <StepRailItem
              step={step}
              status={statuses[step.id]}
              isActive={activeStep === step.id}
              hasConnector={idx < steps.length - 1}
              onClick={() => onStepClick(step.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export { Lightbulb, Send, Link2, Target };
