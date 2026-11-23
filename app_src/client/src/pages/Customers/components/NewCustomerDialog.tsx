import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, RefreshCw } from 'lucide-react';
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
import {
  Card,
  CardContent,
} from '@client/src/components/ui/card';
import { Badge } from '@client/src/components/ui/badge';
import {
  INDUSTRIES,
  INDUSTRY_LABELS,
  type Industry,
  type PlanItem,
  type CustomerLoginCard,
  type CreateCustomerFullRequest,
} from '@shared/api.interface';
import {
  createCustomerFull,
  getActivePlans,
} from '@client/src/api/admin';
import DatePicker from '@client/src/pages/Leads/components/DatePicker';

const PRIMARY = '#3B5BFF';

const generateRandomPassword = (length: number = 8): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

interface NewCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface FormData {
  companyName: string;
  brandName: string;
  industry: string;
  contactPerson: string;
  contactPhone: string;
  planId: string;
  initialCredit: number;
  serviceEnd: string;
  username: string;
  password: string;
}

const defaultForm: FormData = {
  companyName: '',
  brandName: '',
  industry: '',
  contactPerson: '',
  contactPhone: '',
  planId: '',
  initialCredit: 0,
  serviceEnd: '',
  username: '',
  password: generateRandomPassword(),
};

const NewCustomerDialog: React.FC<NewCustomerDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<FormData>(defaultForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loginCard, setLoginCard] = useState<CustomerLoginCard | null>(null);

  const { data: plansData } = useQuery({
    queryKey: ['admin-active-plans'],
    queryFn: () => getActivePlans(),
    enabled: open,
  });

  const planOptions = plansData?.items ?? [];

  const selectedPlan = useMemo(
    () => planOptions.find((p: PlanItem) => p.id === formData.planId) || null,
    [formData.planId, planOptions],
  );

  useEffect(() => {
    if (open) {
      setFormData({ ...defaultForm, password: generateRandomPassword() });
      setErrors({});
      setLoginCard(null);
    }
  }, [open]);

  // 当选择套餐时自动填入初始算力
  useEffect(() => {
    if (selectedPlan && formData.initialCredit === 0) {
      setFormData((prev) => ({
        ...prev,
        initialCredit: selectedPlan.creditAmount,
      }));
    }
  }, [selectedPlan]);

  const createMutation = useMutation({
    mutationFn: (payload: CreateCustomerFullRequest) =>
      createCustomerFull(payload),
    retry: false,
    onSuccess: (res) => {
      toast.success('客户创建成功');
      setLoginCard(res.loginCard);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: unknown) => {
      logger.error('创建客户失败', err);
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          .response?.data?.error?.message || '创建失败，请重试';
      toast.error(msg);
    },
  });

  const handlePhoneChange = (value: string) => {
    const phone = value.replace(/\D/g, '').slice(0, 11);
    setFormData((prev) => ({
      ...prev,
      contactPhone: phone,
      // 手机号作为默认登录账号
      username: prev.username === prev.contactPhone ? phone : prev.username || phone,
    }));
  };

  const handleRegeneratePassword = () => {
    setFormData((prev) => ({
      ...prev,
      password: generateRandomPassword(),
    }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.companyName.trim())
      newErrors.companyName = '请输入企业名称';
    if (!formData.brandName.trim())
      newErrors.brandName = '请输入品牌名称';
    if (!formData.industry) newErrors.industry = '请选择行业';
    if (!formData.contactPerson.trim())
      newErrors.contactPerson = '请输入联系人';
    if (!formData.contactPhone.trim()) {
      newErrors.contactPhone = '请输入手机号';
    } else if (!/^1\d{10}$/.test(formData.contactPhone)) {
      newErrors.contactPhone = '请输入正确的11位手机号';
    }
    if (!formData.planId) newErrors.planId = '请选择套餐';
    if (!formData.serviceEnd) newErrors.serviceEnd = '请选择服务到期日';
    if (!formData.username.trim())
      newErrors.username = '请输入登录账号';
    if (!formData.password || formData.password.length < 6)
      newErrors.password = '密码至少6位';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload: CreateCustomerFullRequest = {
      companyName: formData.companyName,
      brandName: formData.brandName,
      industry: formData.industry || undefined,
      contactPerson: formData.contactPerson || undefined,
      contactPhone: formData.contactPhone,
      planId: formData.planId,
      initialCredit: formData.initialCredit,
      serviceEnd: formData.serviceEnd,
      username: formData.username,
      password: formData.password,
    };

    createMutation.mutate(payload);
  };

  const handleCopyAll = async () => {
    if (!loginCard) return;
    const text = `【星河GEO 客户账号】
企业：${loginCard.companyName}
登录地址：${loginCard.loginUrl}
账号：${loginCard.username}
密码：${loginCard.password}
套餐：${loginCard.planName}（含 ${loginCard.creditAmount.toLocaleString('zh-CN')} 算力）
到期：${loginCard.serviceEnd.slice(0, 10)}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('已复制');
    } catch {
      toast.error('复制失败，请手动复制');
    }
  };

  const handleContinueCreate = () => {
    setFormData({ ...defaultForm, password: generateRandomPassword() });
    setErrors({});
    setLoginCard(null);
    onSuccess();
  };

  const handleClose = () => {
    onOpenChange(false);
    if (loginCard) {
      onSuccess();
    }
  };

  // 成功态：显示登录卡片
  if (loginCard) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>客户创建成功</DialogTitle>
            <DialogDescription>
              客户账号信息已生成，请妥善保存
            </DialogDescription>
          </DialogHeader>

          <Card
            className="relative"
            style={{
              borderRadius: '12px',
              border: '1px solid #E5E9F2',
              background: 'linear-gradient(135deg, #EEF2FF 0%, #FFFFFF 100%)',
            }}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <Badge
                    className="mb-3 font-medium"
                    style={{
                      backgroundColor: `${PRIMARY}15`,
                      color: PRIMARY,
                      borderColor: 'transparent',
                    }}
                  >
                    星河GEO 客户账号
                  </Badge>
                  <h3 className="text-lg font-semibold" style={{ color: '#0f172a' }}>
                    {loginCard.companyName}
                  </h3>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyAll}
                  style={{ borderColor: '#E5E9F2', color: PRIMARY }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  复制全部
                </Button>
              </div>

              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-slate-400">登录地址</span>
                  <span
                    className="flex-1 break-all font-medium"
                    style={{ color: PRIMARY }}
                  >
                    {loginCard.loginUrl}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-slate-400">账号</span>
                  <span className="flex-1 font-medium text-slate-800 tnum">
                    {loginCard.username}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-slate-400">密码</span>
                  <span className="flex-1 font-medium text-slate-800 tnum">
                    {loginCard.password}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-slate-400">套餐</span>
                  <span className="flex-1 text-slate-700">
                    {loginCard.planName}
                    <span className="ml-1 tnum" style={{ color: PRIMARY }}>
                      （含 {loginCard.creditAmount.toLocaleString('zh-CN')} 算力）
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-slate-400">到期</span>
                  <span className="flex-1 text-slate-700">
                    {loginCard.serviceEnd.slice(0, 10)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleClose}
            >
              关闭
            </Button>
            <Button
              onClick={handleContinueCreate}
              style={{ backgroundColor: PRIMARY }}
            >
              继续新建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新建客户</DialogTitle>
          <DialogDescription>填写企业、品牌与账号信息</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 企业与品牌信息 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>
                企业名称 <span className="text-red-500">*</span>
              </Label>
              <Input
                value={formData.companyName}
                onChange={(e) =>
                  setFormData({ ...formData, companyName: e.target.value })
                }
                placeholder="请输入企业全称"
              />
              {errors.companyName && (
                <p className="text-xs text-red-500">{errors.companyName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>
                品牌名称 <span className="text-red-500">*</span>
              </Label>
              <Input
                value={formData.brandName}
                onChange={(e) =>
                  setFormData({ ...formData, brandName: e.target.value })
                }
                placeholder="请输入品牌名称"
              />
              {errors.brandName && (
                <p className="text-xs text-red-500">{errors.brandName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>
                行业 <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.industry}
                onValueChange={(value: string) =>
                  setFormData({ ...formData, industry: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择行业" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((ind: Industry) => (
                    <SelectItem key={ind} value={ind}>
                      {INDUSTRY_LABELS[ind]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.industry && (
                <p className="text-xs text-red-500">{errors.industry}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>联系人</Label>
              <Input
                value={formData.contactPerson}
                onChange={(e) =>
                  setFormData({ ...formData, contactPerson: e.target.value })
                }
                placeholder="联系人姓名"
              />
            </div>

            <div className="space-y-2">
              <Label>
                手机号 <span className="text-red-500">*</span>
              </Label>
              <Input
                value={formData.contactPhone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="11位手机号码"
                maxLength={11}
              />
              {errors.contactPhone && (
                <p className="text-xs text-red-500">{errors.contactPhone}</p>
              )}
            </div>
          </div>

          {/* 套餐与算力 */}
          <div
            className="rounded-lg border p-4"
            style={{ borderColor: '#E5E9F2', backgroundColor: '#F7F9FC' }}
          >
            <h4 className="mb-3 text-sm font-semibold" style={{ color: '#0f172a' }}>
              套餐与算力
            </h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  套餐 <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.planId}
                  onValueChange={(value: string) =>
                    setFormData({ ...formData, planId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="请选择套餐" />
                  </SelectTrigger>
                  <SelectContent>
                    {planOptions.map((plan: PlanItem) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.planName} · {plan.creditAmount.toLocaleString()}算力
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.planId && (
                  <p className="text-xs text-red-500">{errors.planId}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>初始算力</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.initialCredit}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      initialCredit: Number(e.target.value) || 0,
                    })
                  }
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>
                  服务到期日 <span className="text-red-500">*</span>
                </Label>
                <DatePicker
                  value={formData.serviceEnd || undefined}
                  onChange={(date) =>
                    setFormData({ ...formData, serviceEnd: date || '' })
                  }
                  placeholder="选择到期日期"
                />
                {errors.serviceEnd && (
                  <p className="text-xs text-red-500">{errors.serviceEnd}</p>
                )}
              </div>
            </div>
          </div>

          {/* 账号信息 */}
          <div
            className="rounded-lg border p-4"
            style={{ borderColor: '#E5E9F2', backgroundColor: '#F7F9FC' }}
          >
            <h4 className="mb-3 text-sm font-semibold" style={{ color: '#0f172a' }}>
              登录账号
            </h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  登录账号 <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  placeholder="默认取手机号"
                />
                {errors.username && (
                  <p className="text-xs text-red-500">{errors.username}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>
                    登录密码 <span className="text-red-500">*</span>
                  </Label>
                  <button
                    type="button"
                    onClick={handleRegeneratePassword}
                    className="flex items-center gap-1 text-xs transition-colors hover:opacity-80"
                    style={{ color: PRIMARY }}
                  >
                    <RefreshCw className="h-3 w-3" />
                    重新生成
                  </button>
                </div>
                <Input
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="至少6位"
                />
                {errors.password && (
                  <p className="text-xs text-red-500">{errors.password}</p>
                )}
              </div>
            </div>
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
              {createMutation.isPending ? '创建中...' : '创建客户'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default NewCustomerDialog;
