import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  KeyRound,
  Plus,
  Copy,
  RotateCw,
  Pencil,
  Trash2,
  Check,
  X,
  AlertTriangle,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import { Badge } from '@client/src/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@client/src/components/ui/dialog';
import {
  Alert,
  AlertDescription,
} from '@client/src/components/ui/alert';
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  createToken,
  deleteToken,
  getTokens,
  resetToken,
  updateTokenName,
} from '@client/src/api/settings';
import type { AutoToken } from '@shared/api.interface';

const PRIMARY = '#1e40af';
const SUCCESS = '#10b981';
const DANGER = '#ef4444';
const ACCENT = '#f97316';

function maskToken(token: string | null): string {
  if (!token) return '••••••••';
  if (token.length <= 8) return '••••••••';
  const prefix = token.slice(0, 4);
  const suffix = token.slice(-4);
  return `${prefix}****${suffix}`;
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '从未';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      return false;
    }
  }
}

interface CopyButtonProps {
  text: string;
  size?: 'default' | 'sm' | 'icon';
  label?: string;
}

const CopyButton: React.FC<CopyButtonProps> = ({ text, size = 'icon', label }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (size === 'icon') {
    return (
      <Button
        size="icon"
        variant="ghost"
        onClick={handleCopy}
        aria-label={copied ? '已复制' : '复制'}
        className="h-7 w-7"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5" style={{ color: SUCCESS }} />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleCopy}
      className="gap-1.5"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" style={{ color: SUCCESS }} />
          已复制
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          {label ?? '复制'}
        </>
      )}
    </Button>
  );
};

const TokensTab = () => {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newTokenData, setNewTokenData] = useState<(AutoToken & { token: string }) | null>(null);
  const [resetTokenData, setResetTokenData] = useState<(AutoToken & { token: string }) | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const { data: tokens, isLoading } = useQuery({
    queryKey: ['settings', 'tokens'],
    queryFn: getTokens,
  });

  const createMutation = useMutation({
    mutationFn: createToken,
    retry: false,
    onSuccess: (data) => {
      setNewTokenData(data);
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['settings', 'tokens'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message ?? '创建失败，请重试';
      setErrorMsg(msg);
      setCreateOpen(false);
      setTimeout(() => setErrorMsg(''), 3000);
    },
  });

  const handleCreate = (name: string) => {
    createMutation.mutate({ name });
  };

  const handleCloseNewTokenDialog = () => {
    setNewTokenData(null);
  };

  const handleCloseResetDialog = () => {
    setResetTokenData(null);
  };

  return (
    <div className="space-y-6">
      {errorMsg && (
        <Alert variant="destructive">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      <Card style={{ borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-semibold flex items-center gap-2">
              <KeyRound className="h-4 w-4" style={{ color: PRIMARY }} />
              自动化令牌
            </CardTitle>
            <CardDescription>
              用于自动化接口调用的身份凭证，请妥善保管
            </CardDescription>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" style={{ backgroundColor: PRIMARY, borderColor: PRIMARY }}>
                <Plus className="h-3.5 w-3.5" />
                新增令牌
              </Button>
            </DialogTrigger>
            <CreateTokenDialogContent
              onSubmit={handleCreate}
              isLoading={createMutation.isPending}
            />
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TokenListSkeleton />
          ) : tokens && tokens.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-muted-foreground">
                    <th className="pb-3 pr-4 font-medium">名称</th>
                    <th className="pb-3 pr-4 font-medium">令牌</th>
                    <th className="pb-3 pr-4 font-medium">状态</th>
                    <th className="pb-3 pr-4 font-medium">最后使用</th>
                    <th className="pb-3 pr-4 font-medium">创建时间</th>
                    <th className="pb-3 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((token) => (
                    <TokenRow
                      key={token.id}
                      token={token}
                      onReset={(data) => setResetTokenData(data)}
                      onError={(msg) => {
                        setErrorMsg(msg);
                        setTimeout(() => setErrorMsg(''), 3000);
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <KeyRound className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">暂无自动化令牌</p>
              <p className="text-xs text-muted-foreground mt-1">
                点击"新增令牌"创建第一个自动化令牌
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 新令牌展示弹窗 */}
      <Dialog open={!!newTokenData} onOpenChange={(open) => !open && handleCloseNewTokenDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5" style={{ color: SUCCESS }} />
              令牌创建成功
            </DialogTitle>
            <DialogDescription>
              令牌只显示一次，请妥善保存。关闭后将无法再次查看完整令牌。
            </DialogDescription>
          </DialogHeader>
          {newTokenData && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">名称</Label>
                <p className="mt-1 text-sm font-medium text-slate-800">
                  {newTokenData.name}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">令牌</Label>
                <div className="mt-1 flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <code className="flex-1 break-all text-xs font-mono text-slate-700">
                    {newTokenData.token}
                  </code>
                  <CopyButton text={newTokenData.token} label="复制" size="sm" />
                </div>
              </div>
              <div
                className="flex items-start gap-2 rounded-md p-3 text-xs"
                style={{ backgroundColor: 'rgba(249, 115, 22, 0.1)', color: ACCENT }}
              >
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>令牌只显示一次，请妥善保存到安全的地方。关闭此弹窗后将无法再次查看完整令牌。</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button style={{ backgroundColor: PRIMARY, borderColor: PRIMARY }}>
                我已保存
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重置令牌结果弹窗 */}
      <Dialog open={!!resetTokenData} onOpenChange={(open) => !open && handleCloseResetDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCw className="h-5 w-5" style={{ color: ACCENT }} />
              令牌已重置
            </DialogTitle>
            <DialogDescription>
              旧令牌立即失效，新令牌只显示一次，请妥善保存。
            </DialogDescription>
          </DialogHeader>
          {resetTokenData && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">名称</Label>
                <p className="mt-1 text-sm font-medium text-slate-800">
                  {resetTokenData.name}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">新令牌</Label>
                <div className="mt-1 flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <code className="flex-1 break-all text-xs font-mono text-slate-700">
                    {resetTokenData.token}
                  </code>
                  <CopyButton text={resetTokenData.token} label="复制" size="sm" />
                </div>
              </div>
              <div
                className="flex items-start gap-2 rounded-md p-3 text-xs"
                style={{ backgroundColor: 'rgba(249, 115, 22, 0.1)', color: ACCENT }}
              >
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>新令牌只显示一次，请妥善保存。旧令牌将立即失效。</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button style={{ backgroundColor: PRIMARY, borderColor: PRIMARY }}>
                我已保存
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ---------- Token Row ---------- */

interface TokenRowProps {
  token: AutoToken;
  onReset: (data: AutoToken & { token: string }) => void;
  onError: (msg: string) => void;
}

const TokenRow: React.FC<TokenRowProps> = ({ token, onReset, onError }) => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(token.name);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      updateTokenName(id, { name }),
    retry: false,
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['settings', 'tokens'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message ?? '更新失败';
      onError(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteToken,
    retry: false,
    onSuccess: () => {
      setDeleteConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['settings', 'tokens'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message ?? '删除失败';
      onError(msg);
    },
  });

  const resetMutation = useMutation({
    mutationFn: resetToken,
    retry: false,
    onSuccess: (data) => {
      setResetConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['settings', 'tokens'] });
      onReset(data);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message ?? '重置失败';
      onError(msg);
    },
  });

  const handleStartEdit = () => {
    setEditName(token.name);
    setEditing(true);
  };

  const handleSaveEdit = () => {
    if (!editName.trim()) return;
    updateMutation.mutate({ id: token.id, name: editName.trim() });
  };

  const handleCancelEdit = () => {
    setEditName(token.name);
    setEditing(false);
  };

  const isActive = token.status === 'active';

  return (
    <tr className="border-b border-slate-100" style={{ height: 48 }}>
      <td className="pr-4">
        {editing ? (
          <div className="flex items-center gap-1.5">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-7 w-32 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEdit();
                if (e.key === 'Escape') handleCancelEdit();
              }}
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={handleSaveEdit}
              disabled={updateMutation.isPending || !editName.trim()}
              aria-label="保存"
            >
              <Check className="h-3.5 w-3.5" style={{ color: SUCCESS }} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={handleCancelEdit}
              disabled={updateMutation.isPending}
              aria-label="取消"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <span className="font-medium text-slate-800">{token.name}</span>
        )}
      </td>
      <td className="pr-4">
        <div className="flex items-center gap-1">
          <code className="font-mono text-xs text-slate-600">
            {maskToken(token.token)}
          </code>
          {token.token && (
            <CopyButton text={token.token} />
          )}
        </div>
      </td>
      <td className="pr-4">
        <Badge
          variant="secondary"
          style={{
            backgroundColor: isActive
              ? 'rgba(16, 185, 129, 0.1)'
              : 'rgba(239, 68, 68, 0.1)',
            color: isActive ? SUCCESS : DANGER,
          }}
        >
          {isActive ? '启用' : '已停用'}
        </Badge>
      </td>
      <td className="pr-4 text-muted-foreground text-xs">
        {formatDateTime(token.lastUsedAt)}
      </td>
      <td className="pr-4 text-muted-foreground text-xs">
        {formatDateTime(token.createdAt)}
      </td>
      <td className="text-right">
        <div className="flex items-center justify-end gap-1">
          {!editing && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={handleStartEdit}
              aria-label="编辑名称"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          <Dialog
            open={resetConfirmOpen}
            onOpenChange={setResetConfirmOpen}
          >
            <DialogTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                aria-label="重置令牌"
              >
                <RotateCw className="h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>确认重置令牌</DialogTitle>
                <DialogDescription>
                  重置后旧令牌立即失效，将生成新的令牌。此操作不可撤销。
                </DialogDescription>
              </DialogHeader>
              <div className="py-2">
                <p className="text-sm">
                  确定要重置令牌 <span className="font-medium">{token.name}</span> 吗？
                </p>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">取消</Button>
                </DialogClose>
                <Button
                  variant="destructive"
                  onClick={() => resetMutation.mutate(token.id)}
                  disabled={resetMutation.isPending}
                >
                  {resetMutation.isPending ? '重置中...' : '确认重置'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={deleteConfirmOpen}
            onOpenChange={setDeleteConfirmOpen}
          >
            <DialogTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                aria-label="删除令牌"
              >
                <Trash2 className="h-3.5 w-3.5" style={{ color: DANGER }} />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>确认删除令牌</DialogTitle>
                <DialogDescription>
                  删除后令牌将立即失效，且无法恢复。
                </DialogDescription>
              </DialogHeader>
              <div className="py-2">
                <p className="text-sm">
                  确定要删除令牌 <span className="font-medium">{token.name}</span> 吗？
                </p>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">取消</Button>
                </DialogClose>
                <Button
                  variant="destructive"
                  onClick={() => deleteMutation.mutate(token.id)}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? '删除中...' : '确认删除'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </td>
    </tr>
  );
};

/* ---------- Create Token Dialog ---------- */

interface CreateTokenDialogContentProps {
  onSubmit: (name: string) => void;
  isLoading: boolean;
}

const CreateTokenDialogContent: React.FC<CreateTokenDialogContentProps> = ({
  onSubmit,
  isLoading,
}) => {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim());
  };

  return (
    <DialogContent>
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>新增令牌</DialogTitle>
          <DialogDescription>
            给新令牌起一个名称，便于识别用途
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-2">
          <Label htmlFor="token-name">令牌名称</Label>
          <Input
            id="token-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="如：关键词检测服务"
            autoFocus
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" type="button">
              取消
            </Button>
          </DialogClose>
          <Button
            type="submit"
            disabled={isLoading || !name.trim()}
            style={{ backgroundColor: PRIMARY, borderColor: PRIMARY }}
          >
            {isLoading ? '创建中...' : '创建'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};

/* ---------- Skeleton ---------- */

const TokenListSkeleton = () => (
  <div className="space-y-3">
    {Array.from({ length: 4 }).map((_, i) => (
      <div
        key={i}
        className="flex items-center gap-4 py-2 border-b border-slate-100"
      >
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-5 w-12 rounded-full" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-28" />
        <div className="ml-auto flex gap-1">
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-7 w-7 rounded-md" />
        </div>
      </div>
    ))}
  </div>
);

export default TokensTab;
