import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Lock, User, Building2, Briefcase, MapPin, Phone } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import { Skeleton } from '@client/src/components/ui/skeleton';

import { account } from '@client/src/api';
import type {
  AccountProfile,
  UpdateAccountProfileRequest,
} from '@shared/api.interface';

interface FormErrors {
  companyName?: string;
  contactPhone?: string;
  oldPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

const AccountProfilePage: React.FC = () => {
  const queryClient = useQueryClient();

  const [form, setForm] = useState<UpdateAccountProfileRequest>({
    companyName: '',
    industry: '',
    region: '',
    contactName: '',
    contactPhone: '',
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<FormErrors>({});

  const { data: profile, isLoading } = useQuery<AccountProfile | null, unknown>({
    queryKey: ['accountProfile'],
    queryFn: () => account.getAccountProfile(),
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (profile) {
      setForm({
        companyName: profile.companyName ?? '',
        industry: profile.industry ?? '',
        region: profile.region ?? '',
        contactName: profile.contactName ?? '',
        contactPhone: profile.contactPhone ?? '',
      });
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: (body: UpdateAccountProfileRequest) =>
      account.updateAccountProfile(body),
    retry: false,
    onSuccess: (data: AccountProfile) => {
      queryClient.setQueryData(['accountProfile'], data);
      toast.success('账号信息已保存');
    },
    onError: (error: any) => {
      const msg =
        error?.response?.data?.error?.message ?? '保存失败，请稍后再试';
      toast.error(msg);
    },
  });

  const passwordMutation = useMutation({
    mutationFn: (body: { oldPassword: string; newPassword: string }) =>
      account.changePassword(body),
    retry: false,
    onSuccess: () => {
      toast.success('密码修改成功');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordErrors({});
    },
    onError: (error: any) => {
      const msg =
        error?.response?.data?.error?.message ?? '修改失败，请稍后再试';
      toast.error(msg);
    },
  });

  const validateProfile = (): boolean => {
    const errors: FormErrors = {};
    if (!form.companyName?.trim()) {
      errors.companyName = '请输入企业名称';
    }
    if (form.contactPhone && !/^1[3-9]\d{9}$/.test(form.contactPhone)) {
      errors.contactPhone = '请输入正确的手机号';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveProfile = () => {
    if (!validateProfile()) return;
    updateMutation.mutate(form);
  };

  const validatePassword = (): boolean => {
    const errors: FormErrors = {};
    if (!oldPassword) {
      errors.oldPassword = '请输入原密码';
    }
    if (!newPassword) {
      errors.newPassword = '请输入新密码';
    } else if (newPassword.length < 6) {
      errors.newPassword = '新密码至少 6 位';
    }
    if (!confirmPassword) {
      errors.confirmPassword = '请确认新密码';
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = '两次输入的密码不一致';
    }
    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChangePassword = () => {
    if (!validatePassword()) return;
    passwordMutation.mutate({ oldPassword, newPassword });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[20px] font-semibold" style={{ color: '#101828' }}>账号信息</h1>
        <p className="text-sm text-gray-500 mt-1">
          管理您的企业信息和账号密码
        </p>
      </div>

      {/* 账号信息卡片 */}
      <Card
        className="rounded-lg border bg-white"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
      >
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#1e40af]" />
            账号信息
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
              ))}
              <Skeleton className="h-9 w-24 rounded-md" />
            </div>
          ) : (
            <div className="space-y-5 max-w-xl">
              <div className="space-y-2">
                <Label htmlFor="companyName">
                  企业名称 <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="companyName"
                    className="pl-9"
                    value={form.companyName ?? ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setForm({ ...form, companyName: e.target.value })
                    }
                    placeholder="请输入企业名称"
                  />
                </div>
                {formErrors.companyName && (
                  <p className="text-xs text-red-500">
                    {formErrors.companyName}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry">所属行业</Label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="industry"
                    className="pl-9"
                    value={form.industry ?? ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setForm({ ...form, industry: e.target.value })
                    }
                    placeholder="请输入所属行业"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="region">所在地区</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="region"
                    className="pl-9"
                    value={form.region ?? ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setForm({ ...form, region: e.target.value })
                    }
                    placeholder="请输入所在地区"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactName">联系人</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="contactName"
                    className="pl-9"
                    value={form.contactName ?? ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setForm({ ...form, contactName: e.target.value })
                    }
                    placeholder="请输入联系人姓名"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactPhone">联系手机</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="contactPhone"
                    type="tel"
                    className="pl-9"
                    value={form.contactPhone ?? ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setForm({ ...form, contactPhone: e.target.value })
                    }
                    placeholder="请输入联系手机号"
                  />
                </div>
                {formErrors.contactPhone && (
                  <p className="text-xs text-red-500">
                    {formErrors.contactPhone}
                  </p>
                )}
              </div>

              <div className="pt-2">
                <Button
                  className="bg-[#1e40af] hover:bg-[#1e3a8a]"
                  onClick={handleSaveProfile}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? '保存中...' : '保存'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 修改密码卡片 */}
      <Card
        className="rounded-lg border bg-white"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
      >
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#1e40af]" />
            修改密码
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-5 max-w-xl">
            <div className="space-y-2">
              <Label htmlFor="oldPassword">
                原密码 <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="oldPassword"
                  type="password"
                  className="pl-9"
                  value={oldPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setOldPassword(e.target.value)
                  }
                  placeholder="请输入原密码"
                  autoComplete="current-password"
                />
              </div>
              {passwordErrors.oldPassword && (
                <p className="text-xs text-red-500">
                  {passwordErrors.oldPassword}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">
                新密码 <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="newPassword"
                  type="password"
                  className="pl-9"
                  value={newPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setNewPassword(e.target.value)
                  }
                  placeholder="请输入新密码（至少 6 位）"
                  autoComplete="new-password"
                />
              </div>
              {passwordErrors.newPassword && (
                <p className="text-xs text-red-500">
                  {passwordErrors.newPassword}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                确认新密码 <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="confirmPassword"
                  type="password"
                  className="pl-9"
                  value={confirmPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setConfirmPassword(e.target.value)
                  }
                  placeholder="请再次输入新密码"
                  autoComplete="new-password"
                />
              </div>
              {passwordErrors.confirmPassword && (
                <p className="text-xs text-red-500">
                  {passwordErrors.confirmPassword}
                </p>
              )}
            </div>

            <div className="pt-2">
              <Button
                className="bg-[#1e40af] hover:bg-[#1e3a8a]"
                onClick={handleChangePassword}
                disabled={passwordMutation.isPending}
              >
                {passwordMutation.isPending ? '修改中...' : '确认修改'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountProfilePage;
