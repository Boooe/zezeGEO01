import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Textarea } from '@client/src/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import {
  createCustomer,
} from '@client/src/api/customers';
import {
  INDUSTRIES,
  INDUSTRY_LABELS,
  PACKAGE_TYPES,
  PACKAGE_TYPE_LABELS,
  type Industry,
  type PackageType,
  type CreateCustomerRequest,
} from '@shared/api.interface';

const PRIMARY = '#1e40af';

interface CreateCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const defaultForm: CreateCustomerRequest = {
  companyName: '',
  brandName: '',
  industry: '',
  contactPerson: '',
  contactPhone: '',
  address: '',
  domain: '',
  packageType: 'basic',
  initialCredit: 0,
  remark: '',
};

const CreateCustomerDialog: React.FC<CreateCustomerDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const queryClient = useQueryClient();

  const [formData, setFormData] =
    useState<CreateCustomerRequest>(defaultForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setFormData(defaultForm);
      setErrors({});
    }
  }, [open]);

  const createMutation = useMutation({
    mutationFn: (payload: CreateCustomerRequest) => createCustomer(payload),
    retry: false,
    onSuccess: () => {
      toast.success('客户创建成功');
      onSuccess();
    },
    onError: (err: unknown) => {
      logger.error('创建客户失败', err);
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          .response?.data?.error?.message || '创建失败，请重试';
      toast.error(msg);
    },
  });

  const isPending = createMutation.isPending;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.companyName.trim()) {
      newErrors.companyName = '请输入企业名称';
    }
    if (!formData.brandName.trim()) {
      newErrors.brandName = '请输入品牌名称';
    }
    if (!formData.industry) {
      newErrors.industry = '请选择行业';
    }
    if (!formData.contactPerson.trim()) {
      newErrors.contactPerson = '请输入联系人';
    }
    if (!formData.contactPhone.trim()) {
      newErrors.contactPhone = '请输入手机号';
    } else if (!/^1\d{10}$/.test(formData.contactPhone)) {
      newErrors.contactPhone = '请输入正确的11位手机号';
    }
    if (!formData.packageType) {
      newErrors.packageType = '请选择套餐档位';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload: CreateCustomerRequest = {
      ...formData,
      industry: formData.industry || undefined,
      address: formData.address || undefined,
      domain: formData.domain || undefined,
      remark: formData.remark || undefined,
    };

    createMutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新建客户</DialogTitle>
          <DialogDescription>填写企业与品牌基本信息</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* 企业名称 */}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="company-name">
                企业名称 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="company-name"
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

            {/* 品牌名称 */}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="brand-name">
                品牌名称 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="brand-name"
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

            {/* 行业 */}
            <div className="space-y-2">
              <Label htmlFor="industry">
                行业 <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.industry || ''}
                onValueChange={(value: string) =>
                  setFormData({ ...formData, industry: value })
                }
              >
                <SelectTrigger id="industry">
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

            {/* 联系人 */}
            <div className="space-y-2">
              <Label htmlFor="contact-person">
                联系人 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="contact-person"
                value={formData.contactPerson}
                onChange={(e) =>
                  setFormData({ ...formData, contactPerson: e.target.value })
                }
                placeholder="联系人姓名"
              />
              {errors.contactPerson && (
                <p className="text-xs text-red-500">
                  {errors.contactPerson}
                </p>
              )}
            </div>

            {/* 手机号 */}
            <div className="space-y-2">
              <Label htmlFor="contact-phone">
                手机号 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="contact-phone"
                value={formData.contactPhone}
                onChange={(e) =>
                  setFormData({ ...formData, contactPhone: e.target.value })
                }
                placeholder="11位手机号码"
                maxLength={11}
              />
              {errors.contactPhone && (
                <p className="text-xs text-red-500">{errors.contactPhone}</p>
              )}
            </div>

            {/* 网站域名 */}
            <div className="space-y-2">
              <Label htmlFor="domain">网站域名（选填）</Label>
              <Input
                id="domain"
                value={formData.domain}
                onChange={(e) =>
                  setFormData({ ...formData, domain: e.target.value })
                }
                placeholder="如 example.com"
              />
            </div>

            {/* 套餐档位 */}
            <div className="space-y-2">
              <Label htmlFor="package-type">
                套餐档位 <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.packageType}
                onValueChange={(value: string) =>
                  setFormData({
                    ...formData,
                    packageType: value as PackageType,
                  })
                }
              >
                <SelectTrigger id="package-type">
                  <SelectValue placeholder="请选择套餐" />
                </SelectTrigger>
                <SelectContent>
                  {PACKAGE_TYPES.map((pkg: PackageType) => (
                    <SelectItem key={pkg} value={pkg}>
                      {PACKAGE_TYPE_LABELS[pkg]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.packageType && (
                <p className="text-xs text-red-500">{errors.packageType}</p>
              )}
            </div>

            {/* 初始算力额度 */}
            <div className="space-y-2">
              <Label htmlFor="initial-credit">初始算力额度</Label>
              <Input
                id="initial-credit"
                type="number"
                min="0"
                value={formData.initialCredit}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    initialCredit: Number(e.target.value) || 0,
                  })
                }
                placeholder="默认 0"
              />
            </div>

            {/* 地址 */}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="address">地址（选填）</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                placeholder="企业详细地址"
                rows={2}
              />
            </div>

            {/* 备注 */}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="remark">备注（选填）</Label>
              <Textarea
                id="remark"
                value={formData.remark}
                onChange={(e) =>
                  setFormData({ ...formData, remark: e.target.value })
                }
                placeholder="其他说明信息"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              style={{ backgroundColor: PRIMARY }}
            >
              {isPending ? '创建中...' : '创建客户'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateCustomerDialog;
