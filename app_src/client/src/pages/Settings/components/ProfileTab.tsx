import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Check, X, User, Shield, Calendar, LogOut, AlertTriangle } from 'lucide-react';
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
  Alert,
  AlertDescription,
} from '@client/src/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@client/src/components/ui/dialog';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { useAuth } from '@client/src/hooks/useAuth';
import { getProfile, updateProfile } from '@client/src/api/settings';
import { USER_ROLE_LABELS } from '@shared/api.interface';

const PRIMARY = '#1e40af';
const SUCCESS = '#10b981';

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '从未';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const ProfileTab = () => {
  const { user: authUser, refetch: refetchAuth, hasRole, logoutAll } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [logoutAllOpen, setLogoutAllOpen] = useState(false);
  const [logoutAllLoading, setLogoutAllLoading] = useState(false);
  const isAdmin = hasRole('admin');

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'profile'],
    queryFn: getProfile,
    initialData: authUser ? { user: authUser } : undefined,
    enabled: !!authUser,
  });

  const user = data?.user;

  const mutation = useMutation({
    mutationFn: updateProfile,
    retry: false,
    onSuccess: (result) => {
      queryClient.setQueryData(['settings', 'profile'], result);
      refetchAuth();
      setEditing(false);
      setSuccessMsg('显示名称已更新');
      setErrorMsg('');
      setTimeout(() => setSuccessMsg(''), 3000);
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.error?.message ?? '更新失败，请重试';
      setErrorMsg(msg);
      setSuccessMsg('');
    },
  });

  const handleStartEdit = () => {
    setEditValue(user?.displayName ?? '');
    setEditing(true);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleCancel = () => {
    setEditing(false);
    setErrorMsg('');
  };

  const handleSave = () => {
    if (!user) return;
    mutation.mutate({ displayName: editValue.trim() });
  };

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
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      <Card style={{ borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <CardHeader>
          <CardTitle className="font-semibold">个人资料</CardTitle>
          <CardDescription>查看和编辑您的账号信息</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading || !user ? (
            <ProfileSkeleton />
          ) : (
            <>
              <ProfileRow
                icon={<User className="h-4 w-4" />}
                label="用户名"
                value={user.username}
              />
              <ProfileRow
                icon={<Shield className="h-4 w-4" />}
                label="角色"
                value={
                  <Badge
                    variant="secondary"
                    style={{ backgroundColor: 'rgba(30, 64, 175, 0.1)', color: PRIMARY }}
                  >
                    {USER_ROLE_LABELS[user.role] ?? user.role}
                  </Badge>
                }
              />
              <div className="flex items-start gap-4">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                  style={{ backgroundColor: 'rgba(30, 64, 175, 0.1)', color: PRIMARY }}
                >
                  <Pencil className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <Label className="text-sm text-muted-foreground">显示名称</Label>
                  {editing ? (
                    <div className="mt-2 flex items-center gap-2">
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder="请输入显示名称"
                        className="max-w-xs"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={mutation.isPending || !editValue.trim()}
                      >
                        保存
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancel}
                        disabled={mutation.isPending}
                      >
                        取消
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800">
                        {user.displayName || '未设置'}
                      </span>
                      <button
                        onClick={handleStartEdit}
                        className="text-xs hover:underline"
                        style={{ color: PRIMARY }}
                        aria-label="编辑显示名称"
                      >
                        编辑
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <ProfileRow
                icon={<Calendar className="h-4 w-4" />}
                label="最后登录时间"
                value={formatDateTime(user.lastLoginAt)}
              />
            </>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <Card style={{ borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <CardHeader>
            <CardTitle className="font-semibold">会话安全</CardTitle>
            <CardDescription>管理当前账号的登录会话</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-4">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                style={{ backgroundColor: 'rgba(255, 92, 92, 0.1)', color: '#FF5C5C' }}
              >
                <LogOut className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground">强制下线所有设备</Label>
                <p className="mt-1 text-xs text-slate-500">
                  作废当前账号在所有设备上的登录令牌，仅保留本次会话。
                </p>
                <Dialog open={logoutAllOpen} onOpenChange={setLogoutAllOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      style={{ color: '#FF5C5C', borderColor: 'rgba(255, 92, 92, 0.3)' }}
                    >
                      强制下线所有设备
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" style={{ color: '#FFA940' }} />
                        确认强制下线？
                      </DialogTitle>
                      <DialogDescription>
                        此操作将立即作废当前账号在所有其他设备上的登录令牌。
                        <br />
                        当前设备的登录状态保持不变。
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setLogoutAllOpen(false)}
                        disabled={logoutAllLoading}
                      >
                        取消
                      </Button>
                      <Button
                        onClick={async () => {
                          setLogoutAllLoading(true);
                          try {
                            await logoutAll();
                            setLogoutAllOpen(false);
                          } catch {
                            setErrorMsg('操作失败，请重试');
                          } finally {
                            setLogoutAllLoading(false);
                          }
                        }}
                        disabled={logoutAllLoading}
                        style={{ backgroundColor: '#FF5C5C' }}
                      >
                        {logoutAllLoading ? '处理中...' : '确认下线'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

interface ProfileRowProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}

const ProfileRow: React.FC<ProfileRowProps> = ({ icon, label, value }) => (
  <div className="flex items-center gap-4">
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
      style={{ backgroundColor: 'rgba(30, 64, 175, 0.1)', color: PRIMARY }}
    >
      {icon}
    </div>
    <div className="flex-1">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <div className="mt-1 text-sm font-medium text-slate-800">{value}</div>
    </div>
  </div>
);

const ProfileSkeleton = () => (
  <div className="space-y-5">
    {[0, 1, 2, 3].map((i) => (
      <div key={i} className="flex items-center gap-4">
        <Skeleton className="h-9 w-9 rounded-md" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    ))}
  </div>
);

export default ProfileTab;
