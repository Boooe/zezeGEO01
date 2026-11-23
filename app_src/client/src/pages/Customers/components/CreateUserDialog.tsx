import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, RefreshCw, CheckCircle2 } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { Badge } from '@client/src/components/ui/badge';
import { createBrandUser } from '@client/src/api/customers';
import {
  USER_ROLES,
  USER_ROLE_LABELS,
  type CreateBrandUserResponse,
  type UserRole,
} from '@shared/api.interface';

const PRIMARY = '#1e40af';
const SUCCESS = '#10b981';

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandId: string | null;
  brandName: string | null;
  defaultPhone: string;
  onSuccess: () => void;
}

/** 生成 8-10 位随机密码，含大小写字母 + 数字 */
function generatePassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;
  const len = 8 + Math.floor(Math.random() * 3); // 8-10
  const arr: string[] = [];
  // 确保至少各含一位
  arr.push(upper[Math.floor(Math.random() * upper.length)]);
  arr.push(lower[Math.floor(Math.random() * lower.length)]);
  arr.push(digits[Math.floor(Math.random() * digits.length)]);
  for (let i = 3; i < len; i++) {
    arr.push(all[Math.floor(Math.random() * all.length)]);
  }
  // 洗牌
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join('');
}

const CreateUserDialog: React.FC<CreateUserDialogProps> = ({
  open,
  onOpenChange,
  brandId,
  brandName,
  defaultPhone,
  onSuccess,
}) => {
  const queryClient = useQueryClient();

  const [username, setUsername] = useState('');
  const [role, setRole] = useState<UserRole>('client');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<CreateBrandUserResponse | null>(null);

  useEffect(() => {
    if (open) {
      setUsername(defaultPhone || '');
      setRole('client');
      setPassword(generatePassword());
      setErrors({});
      setResult(null);
    }
  }, [open, defaultPhone]);

  const regeneratePassword = () => {
    setPassword(generatePassword());
  };

  const copyToClipboard = useCallback(async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('已复制到剪贴板');
    } catch (err) {
      logger.error('复制失败', err);
      toast.error('复制失败，请手动复制');
    }
  }, []);

  const createMutation = useMutation({
    mutationFn: () => {
      if (!brandId) throw new Error('缺少品牌ID');
      return createBrandUser(brandId, {
        brandId,
        username,
        password,
        role,
        displayName: brandName || undefined,
      });
    },
    retry: false,
    onSuccess: (data) => {
      toast.success('账号开通成功');
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: unknown) => {
      logger.error('开通账号失败', err);
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          .response?.data?.error?.message || '开通失败，请重试';
      toast.error(msg);
    },
  });

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!username.trim()) {
      newErrors.username = '请输入登录名';
    }
    if (!password) {
      newErrors.password = '请输入初始密码';
    } else if (password.length < 8) {
      newErrors.password = '密码长度至少8位';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    createMutation.mutate();
  };

  const handleCopyAll = () => {
    const loginUrl = `${window.location.origin}/login`;
    const text =
      `登录网址：${loginUrl}\n` +
      `登录名：${result?.username || username}\n` +
      `初始密码：${result?.password || password}`;
    copyToClipboard(text);
  };

  const handleFinish = () => {
    onSuccess();
    onOpenChange(false);
  };

  const loginUrl = `${window.location.origin}/login`;

  // 开通成功后的结果卡片
  if (result) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center py-2">
            <div
              className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: `${SUCCESS}15` }}
            >
              <CheckCircle2 className="h-8 w-8" style={{ color: SUCCESS }} />
            </div>
            <DialogTitle className="text-lg font-semibold">
              账号开通成功
            </DialogTitle>
            <DialogDescription className="text-center">
              请妥善保管以下登录信息
            </DialogDescription>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                登录网址
              </Label>
              <div className="flex items-center gap-2">
                <Input readOnly value={loginUrl} className="flex-1" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(loginUrl)}
                  aria-label="复制登录网址"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">登录名</Label>
              <div className="flex items-center gap-2">
                <Input readOnly value={result.username} className="flex-1" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(result.username)}
                  aria-label="复制登录名"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">初始密码</Label>
              <div className="flex items-center gap-2">
                <Input readOnly value={result.password} className="flex-1" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(result.password)}
                  aria-label="复制密码"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Badge
              variant="outline"
              className="w-full justify-center font-medium"
              style={{
                borderColor: 'transparent',
                backgroundColor: `${SUCCESS}15`,
                color: SUCCESS,
              }}
            >
              角色：{USER_ROLE_LABELS[result.role]}
            </Badge>
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-col">
            <Button
              type="button"
              className="w-full"
              onClick={handleCopyAll}
              style={{ backgroundColor: PRIMARY }}
            >
              <Copy className="h-4 w-4" />
              复制全部
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleFinish}
            >
              完成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>开通账号</DialogTitle>
          <DialogDescription>
            为「{brandName || '-'}」开通客户登录账号
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 登录名 */}
          <div className="space-y-2">
            <Label htmlFor="username">
              登录名 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入登录名"
            />
            {errors.username && (
              <p className="text-xs text-red-500">{errors.username}</p>
            )}
          </div>

          {/* 角色 */}
          <div className="space-y-2">
            <Label htmlFor="role">角色</Label>
            <Select
              value={role}
              onValueChange={(value: string) =>
                setRole(value as UserRole)
              }
            >
              <SelectTrigger id="role">
                <SelectValue placeholder="请选择角色" />
              </SelectTrigger>
              <SelectContent>
                {USER_ROLES.filter((r: UserRole) => r === 'client' || r === 'operator').map(
                  (r: UserRole) => (
                    <SelectItem key={r} value={r}>
                      {USER_ROLE_LABELS[r]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>

          {/* 初始密码 */}
          <div className="space-y-2">
            <Label htmlFor="password">
              初始密码 <span className="text-red-500">*</span>
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8-10位，含大小写字母和数字"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={regeneratePassword}
                aria-label="重新生成密码"
                title="重新生成"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(password)}
                aria-label="复制密码"
                title="复制"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            {errors.password && (
              <p className="text-xs text-red-500">{errors.password}</p>
            )}
            <p className="text-xs text-muted-foreground">
              8-10 位，包含大小写字母和数字
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              style={{ backgroundColor: PRIMARY }}
            >
              {createMutation.isPending ? '开通中...' : '确认开通'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateUserDialog;
