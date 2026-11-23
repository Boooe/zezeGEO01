import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@client/src/components/ui/dialog';
import { Button } from '@client/src/components/ui/button';
import { Textarea } from '@client/src/components/ui/textarea';
import { Badge } from '@client/src/components/ui/badge';
import { Switch } from '@client/src/components/ui/switch';
import {
  Upload,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Info,
  Plus,
} from 'lucide-react';
import { useImportPrices } from '@client/src/api/media-market';
import { downloadTemplate } from '@client/src/api/media-market';
import { SUBMISSION_LIBRARY_TYPE_LABELS } from '@shared/api.interface';
import type { PriceImportResult } from '@shared/api.interface';

interface PriceImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PriceImportDialog: React.FC<PriceImportDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const [csvText, setCsvText] = useState('');
  const [allowCreate, setAllowCreate] = useState(false);
  const [result, setResult] = useState<PriceImportResult | null>(null);
  const importPrices = useImportPrices();

  const handleImport = () => {
    if (!csvText.trim()) return;
    importPrices.mutate(
      { csvText, allowCreate },
      {
        onSuccess: (data) => {
          setResult(data);
        },
      },
    );
  };

  const handleClose = () => {
    setCsvText('');
    setAllowCreate(false);
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[680px]">
        <DialogHeader>
          <DialogTitle>批量导入报价</DialogTitle>
          <DialogDescription>
            粘贴 CSV 内容，系统将按渠道名称匹配并更新价格
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg bg-[#F7F9FC] p-3 text-sm">
            <div className="flex items-center gap-2 text-slate-600">
              <Info className="h-4 w-4 text-[#2E7DFF]" />
              <span>
                支持 CSV 格式：渠道名, 库类型, 供应商, 采购价(分), 售价(分), 时效(小时), 库存,
                行业, 粉丝
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={downloadTemplate}
              className="text-[#2E7DFF]"
            >
              <Download className="mr-1 h-3.5 w-3.5" />
              下载模板
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-[#E5E9F2] p-3">
            <div className="flex items-center gap-3">
              <Switch
                checked={allowCreate}
                onCheckedChange={setAllowCreate}
                id="allow-create-switch"
              />
              <label htmlFor="allow-create-switch" className="text-sm font-medium text-[#0f172a]">
                允许新建渠道（供应商渠道）
              </label>
            </div>
            {allowCreate && (
              <p className="text-xs text-[#FFA940]">
                新建渠道仅用于供应商报价单，建完后进入信源库并参与商城售卖
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#0f172a]">
              CSV 内容
            </label>
            <Textarea
              placeholder="粘贴 CSV 内容，首行为表头或直接粘贴数据"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="min-h-[200px] resize-y font-mono text-xs"
              disabled={importPrices.isPending}
            />
          </div>

          {/* 导入结果 */}
          {result && (
            <div className="space-y-3 rounded-lg border border-[#E5E9F2] p-4">
              <p className="font-medium text-[#0f172a]">导入结果</p>

              <div className="grid grid-cols-6 gap-2">
                <div className="rounded-md bg-slate-50 p-3 text-center">
                  <p className="text-xs text-slate-500">解析总数</p>
                  <p className="mt-1 tnum text-xl font-bold text-slate-700">
                    {result.parsed}
                  </p>
                </div>
                <div className="rounded-md bg-[#17C964]/10 p-3 text-center">
                  <p className="text-xs text-[#17C964]">成功</p>
                  <p className="mt-1 tnum text-xl font-bold text-[#17C964]">
                    {result.success}
                  </p>
                </div>
                <div className="rounded-md bg-[#3B5BFF]/10 p-3 text-center">
                  <p className="text-xs text-[#3B5BFF]">更新</p>
                  <p className="mt-1 tnum text-xl font-bold text-[#3B5BFF]">
                    {result.updated}
                  </p>
                </div>
                <div className="rounded-md bg-[#00C2FF]/10 p-3 text-center">
                  <p className="text-xs text-[#00A3CC]">新建</p>
                  <p className="mt-1 tnum text-xl font-bold text-[#00A3CC]">
                    {result.created}
                  </p>
                </div>
                <div className="rounded-md bg-[#FFA940]/10 p-3 text-center">
                  <p className="text-xs text-[#FFA940]">未匹配</p>
                  <p className="mt-1 tnum text-xl font-bold text-[#FFA940]">
                    {result.unmatched}
                  </p>
                </div>
                <div className="rounded-md bg-[#FF5C5C]/10 p-3 text-center">
                  <p className="text-xs text-[#FF5C5C]">失败</p>
                  <p className="mt-1 tnum text-xl font-bold text-[#FF5C5C]">
                    {result.failed}
                  </p>
                </div>
              </div>

              {/* 未匹配明细 */}
              {result.unmatchedItems.length > 0 && (
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-sm text-[#FFA940]">
                    <AlertTriangle className="h-4 w-4" />
                    <span>未匹配渠道（{result.unmatchedItems.length} 条）</span>
                  </div>
                  <div className="max-h-[120px] space-y-1 overflow-y-auto rounded-md bg-[#FFA940]/5 p-2 text-xs">
                    {result.unmatchedItems.slice(0, 10).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-slate-700">
                          第 {item.row} 行：{item.name}
                        </span>
                        <span className="text-slate-400">
                          {item.libraryType ? SUBMISSION_LIBRARY_TYPE_LABELS[item.libraryType as keyof typeof SUBMISSION_LIBRARY_TYPE_LABELS] ?? item.libraryType : ''} {item.supplier || ''}
                        </span>
                      </div>
                    ))}
                    {result.unmatchedItems.length > 10 && (
                      <div className="text-center text-slate-400">
                        还有 {result.unmatchedItems.length - 10} 条...
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 失败明细 */}
              {result.failedItems.length > 0 && (
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-sm text-[#FF5C5C]">
                    <XCircle className="h-4 w-4" />
                    <span>失败记录（{result.failedItems.length} 条）</span>
                  </div>
                  <div className="max-h-[120px] space-y-1 overflow-y-auto rounded-md bg-[#FF5C5C]/5 p-2 text-xs">
                    {result.failedItems.slice(0, 10).map((item, idx) => (
                      <div key={idx} className="flex items-start justify-between gap-2">
                        <span className="text-slate-700">
                          第 {item.row} 行：{item.name}
                        </span>
                        <span className="text-[#FF5C5C] shrink-0">{item.reason}</span>
                      </div>
                    ))}
                    {result.failedItems.length > 10 && (
                      <div className="text-center text-slate-400">
                        还有 {result.failedItems.length - 10} 条...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {result ? '关闭' : '取消'}
          </Button>
          {!result && (
            <Button
              className="bg-[#2E7DFF] hover:bg-[#2563EB]"
              onClick={handleImport}
              disabled={!csvText.trim() || importPrices.isPending}
            >
              <Upload className="mr-2 h-4 w-4" />
              {importPrices.isPending ? '导入中...' : '开始导入'}
            </Button>
          )}
          {result && (
            <Button
              className="bg-[#2E7DFF] hover:bg-[#2563EB]"
              onClick={() => {
                setResult(null);
                setCsvText('');
              }}
            >
              继续导入
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PriceImportDialog;
