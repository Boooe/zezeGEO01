import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import { Button } from '@client/src/components/ui/button';
import { AlertCircle, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import type {
  ComplianceCheckResponse,
  ComplianceRiskLevel,
} from '@shared/api.interface';

interface ComplianceCheckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: ComplianceCheckResponse | null;
  isLoading?: boolean;
  title?: string;
}

const statusConfig: Record<
  ComplianceRiskLevel,
  { label: string; bg: string; color: string; border: string; icon: React.ComponentType<{ className?: string }> }
> = {
  pass: {
    label: '合规通过',
    bg: 'rgba(23, 201, 100, 0.08)',
    color: 'text-emerald-500',
    border: '1px solid rgba(23, 201, 100, 0.2)',
    icon: CheckCircle2,
  },
  warn: {
    label: '存在警告',
    bg: 'rgba(255, 169, 64, 0.08)',
    color: 'text-amber-500',
    border: '1px solid rgba(255, 169, 64, 0.2)',
    icon: AlertTriangle,
  },
  block: {
    label: '高风险拦截',
    bg: 'rgba(255, 92, 92, 0.08)',
    color: 'text-red-500',
    border: '1px solid rgba(255, 92, 92, 0.2)',
    icon: AlertCircle,
  },
};

export const ComplianceCheckDialog: React.FC<ComplianceCheckDialogProps> = ({
  open,
  onOpenChange,
  result,
  isLoading = false,
  title = '合规预检结果',
}) => {
  const level = result?.riskLevel ?? 'pass';
  const config = statusConfig[level];
  const Icon = config.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* 状态条 */}
          <div
            className="flex items-center gap-3 rounded-lg px-4 py-3"
            style={{
              backgroundColor: config.bg,
              border: config.border,
            }}
          >
            <Icon className={`h-5 w-5 shrink-0 ${config.color}`} />
            <div className="flex-1">
              <div className={`font-medium ${config.color}`}>
                {isLoading ? '正在检测...' : config.label}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {isLoading
                  ? '正在扫描内容中的敏感表述...'
                  : result
                    ? `共检测到 ${result.totalHits} 处风险表述`
                    : ''}
              </div>
            </div>
            {result && result.checkedAt && (
              <div className="text-xs text-muted-foreground">
                {new Date(result.checkedAt).toLocaleString('zh-CN')}
              </div>
            )}
          </div>

          {/* 命中列表 */}
          {result && result.hits.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">命中详情</div>
              <div className="space-y-2">
                {result.hits.map((hit, i) => (
                  <div
                    key={i}
                    className="rounded-md border p-3 space-y-1.5"
                    style={{ borderColor: '#E5E9F2' }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: 'rgba(255, 92, 92, 0.1)',
                          color: '#FF5C5C',
                        }}
                      >
                        {hit.word}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {hit.category}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span className="text-slate-500">建议：</span>
                      {hit.suggestion}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result && result.hits.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mb-2" style={{ color: '#17C964' }} />
              内容未发现违规表述
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground">
              <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin mb-2" />
              正在进行合规检测...
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ComplianceCheckDialog;
