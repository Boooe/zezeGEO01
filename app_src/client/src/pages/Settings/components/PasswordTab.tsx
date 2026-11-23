import React, { useState, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Lock, Check, X, Eye, EyeOff, AlertCircle } from 'lucide-react';
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
import {
  Alert,
  AlertDescription,
} from '@client/src/components/ui/alert';
import { changePassword } from '@client/src/api/settings';

const PRIMARY = '#1e40af';
const SUCCESS = '#10b981';
const DANGER = '#ef4444';

const PasswordTab = () => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const strength = useMemo(() => {
    const pwd = newPassword;
    if (!pwd) return { level: 0, label: '', valid: false };
    const hasLength = pwd.length >= 8;
    const hasLower = /[a-z]/.test(pwd);
    const hasUpper = /[A-Z]/.test(pwd);
    const hasDigit = /\d/.test(pwd);
    const valid = hasLength && hasLower && hasUpper && hasDigit;

    let level = 0;
    if (hasLength) level++;
    if (hasLower || hasUpper) level++;
    if (hasDigit) level++;
    if (hasLower && hasUpper && hasDigit) level = 4;

    const labels = ['', '弱', '中', '较强', '强'];
    return { level, label: labels[level] ?? '', valid };
  }, [newPassword]);

  const confirmMatch =
    confirmPassword.length > 0 && confirmPassword === newPassword;
  const confirmMismatch =
    confirmPassword.length > 0 && confirmPassword !== newPassword;

  const mutation = useMutation({
    mutationFn: changePassword,
    retry: false,
    onSuccess: () => {
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccessMsg('密码修改成功');
      setErrorMsg('');
      setTimeout(() => setSuccessMsg(''), 3000);
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.error?.message ?? '修改失败，请重试';
      setErrorMsg(msg);
      setSuccessMsg('');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!oldPassword || !newPassword || !confirmPassword) {
      setErrorMsg('请填写所有密码字段');
      return;
    }
    if (!strength.valid) {
      setErrorMsg('新密码不符合强度要求：至少8位，含大小写字母和数字');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('两次输入的新密码不一致');
      return;
    }
    if (oldPassword === newPassword) {
      setErrorMsg('新密码不能与旧密码相同');
      return;
    }

    mutation.mutate({ oldPassword, newPassword });
  };

  const strengthColors = ['#cbd5e1', DANGER, '#f97316', PRIMARY, SUCCESS];
  const strengthColor = strengthColors[strength.level] ?? strengthColors[0];

  return (
    <div className="space-y-6">
      {successMsg && (
        <div
          className="flex items-center justify-between rounded-md px-4 py-3 text-sm"
          style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: SUCCESS }}
        >
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4" />
            <span>{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg('')}
            className="hover:opacity-70"
            aria-label="关闭提示"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {errorMsg && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      <Card style={{ borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <CardHeader>
          <CardTitle className="font-semibold flex items-center gap-2">
            <Lock className="h-4 w-4" style={{ color: PRIMARY }} />
            修改密码
          </CardTitle>
          <CardDescription>定期修改密码以保障账号安全</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="old-password">旧密码</Label>
              <div className="relative">
                <Input
                  id="old-password"
                  type={showOld ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="请输入旧密码"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowOld(!showOld)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  aria-label={showOld ? '隐藏密码' : '显示密码'}
                >
                  {showOld ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">新密码</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="请输入新密码"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  aria-label={showNew ? '隐藏密码' : '显示密码'}
                >
                  {showNew ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {/* 强度条 */}
              {newPassword && (
                <div className="space-y-1.5">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="h-1.5 flex-1 rounded-full"
                        style={{
                          backgroundColor:
                            i <= strength.level ? strengthColor : '#e2e8f0',
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: strengthColor }}>
                      强度：{strength.label}
                    </span>
                  </div>
                </div>
              )}
              {/* 强度要求 */}
              <div className="space-y-1 text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5">
                  <Check
                    className="h-3 w-3"
                    style={{
                      color:
                        newPassword.length >= 8 ? SUCCESS : '#cbd5e1',
                    }}
                  />
                  至少 8 位
                </p>
                <p className="flex items-center gap-1.5">
                  <Check
                    className="h-3 w-3"
                    style={{
                      color: /[A-Z]/.test(newPassword)
                        ? SUCCESS
                        : '#cbd5e1',
                    }}
                  />
                  包含大写字母
                </p>
                <p className="flex items-center gap-1.5">
                  <Check
                    className="h-3 w-3"
                    style={{
                      color: /[a-z]/.test(newPassword)
                        ? SUCCESS
                        : '#cbd5e1',
                    }}
                  />
                  包含小写字母
                </p>
                <p className="flex items-center gap-1.5">
                  <Check
                    className="h-3 w-3"
                    style={{
                      color: /\d/.test(newPassword)
                        ? SUCCESS
                        : '#cbd5e1',
                    }}
                  />
                  包含数字
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">确认新密码</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="请再次输入新密码"
                  autoComplete="new-password"
                  style={{
                    borderColor: confirmMismatch ? DANGER : undefined,
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  aria-label={showConfirm ? '隐藏密码' : '显示密码'}
                >
                  {showConfirm ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {confirmMismatch && (
                <p className="text-xs" style={{ color: DANGER }}>
                  两次输入的密码不一致
                </p>
              )}
              {confirmMatch && (
                <p className="text-xs flex items-center gap-1" style={{ color: SUCCESS }}>
                  <Check className="h-3 w-3" />
                  密码一致
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={mutation.isPending}
              style={{ backgroundColor: PRIMARY, borderColor: PRIMARY }}
            >
              {mutation.isPending ? '修改中...' : '确认修改'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default PasswordTab;
