import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  createContract,
  updateContract,
  type CreateContractPayload,
} from '@client/src/api/contracts';
import { getBrands } from '@client/src/api/brands';
import {
  PACKAGE_TYPES,
  PACKAGE_TYPE_LABELS,
  PACKAGE_PRICES,
  PAYMENT_STATUS,
  PAYMENT_STATUS_LABELS,
  type Contract,
  type PackageType,
  type PaymentStatus,
} from '@shared/api.interface';

const PRIMARY = '#1e40af';

interface ContractFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingContract: Contract | null;
  onSuccess: () => void;
}

const ContractFormDialog: React.FC<ContractFormDialogProps> = ({
  open,
  onOpenChange,
  editingContract,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const isEditing = !!editingContract;

  const defaultForm: CreateContractPayload = {
    brandId: '',
    customerName: '',
    industry: '',
    contactPerson: '',
    contactPhone: '',
    packageType: 'basic',
    contractAmount: PACKAGE_PRICES.basic,
    signDate: new Date().toISOString().slice(0, 10),
    serviceStart: new Date().toISOString().slice(0, 10),
    serviceEnd: '',
    paymentStatus: 'unpaid',
    remark: '',
  };

  const [formData, setFormData] = useState<CreateContractPayload>(defaultForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      if (editingContract) {
        setFormData({
          brandId: editingContract.brandId ?? '',
          customerName: editingContract.customerName,
          industry: editingContract.industry ?? '',
          contactPerson: editingContract.contactPerson ?? '',
          contactPhone: editingContract.contactPhone ?? '',
          packageType: editingContract.packageType,
          contractAmount: editingContract.contractAmount,
          signDate: editingContract.signDate
            ? editingContract.signDate.slice(0, 10)
            : '',
          serviceStart: editingContract.serviceStart
            ? editingContract.serviceStart.slice(0, 10)
            : '',
          serviceEnd: editingContract.serviceEnd
            ? editingContract.serviceEnd.slice(0, 10)
            : '',
          paymentStatus: editingContract.paymentStatus,
          remark: editingContract.remark ?? '',
        });
      } else {
        setFormData(defaultForm);
      }
      setErrors({});
    }
  }, [open, editingContract]);

  const { data: brandOptions = [] } = useQuery({
    queryKey: ['brand-options'],
    queryFn: () => getBrands(),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateContractPayload) => createContract(payload),
    retry: false,
    onSuccess: () => {
      toast.success('合同创建成功');
      onSuccess();
    },
    onError: (err) => {
      logger.error('创建合同失败', err);
      toast.error('创建失败，请重试');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Partial<CreateContractPayload>) =>
      updateContract(editingContract!.id, payload),
    retry: false,
    onSuccess: () => {
      toast.success('合同更新成功');
      onSuccess();
    },
    onError: (err) => {
      logger.error('更新合同失败', err);
      toast.error('更新失败，请重试');
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handlePackageChange = (value: string) => {
    const pkg = value as PackageType;
    setFormData({
      ...formData,
      packageType: pkg,
      contractAmount: PACKAGE_PRICES[pkg] ?? formData.contractAmount,
    });
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.brandId) {
      newErrors.brandId = '请选择品牌';
    }
    if (!formData.customerName.trim()) {
      newErrors.customerName = '请输入客户名称';
    }
    if (!formData.packageType) {
      newErrors.packageType = '请选择套餐';
    }
    if (!formData.contractAmount || formData.contractAmount <= 0) {
      newErrors.contractAmount = '请输入有效金额';
    }
    if (!formData.paymentStatus) {
      newErrors.paymentStatus = '请选择收款状态';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // 清理空值字段
    const payload: CreateContractPayload = {
      ...formData,
      industry: formData.industry || undefined,
      contactPerson: formData.contactPerson || undefined,
      contactPhone: formData.contactPhone || undefined,
      signDate: formData.signDate || undefined,
      serviceStart: formData.serviceStart || undefined,
      serviceEnd: formData.serviceEnd || undefined,
      remark: formData.remark || undefined,
    };

    if (isEditing) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? '编辑合同' : '新增合同'}</DialogTitle>
          <DialogDescription>
            {isEditing ? '修改合同信息，保存后立即生效' : '填写客户合同基本信息'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="brand-id">
                品牌 <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.brandId || ''}
                onValueChange={(value) =>
                  setFormData({ ...formData, brandId: value })
                }
              >
                <SelectTrigger id="brand-id">
                  <SelectValue placeholder="请选择品牌" />
                </SelectTrigger>
                <SelectContent>
                  {brandOptions.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.brandId && (
                <p className="text-xs text-red-500">{errors.brandId}</p>
              )}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="customer-name">
                客户名称 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="customer-name"
                value={formData.customerName}
                onChange={(e) =>
                  setFormData({ ...formData, customerName: e.target.value })
                }
                placeholder="请输入客户名称"
              />
              {errors.customerName && (
                <p className="text-xs text-red-500">{errors.customerName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry">行业</Label>
              <Input
                id="industry"
                value={formData.industry}
                onChange={(e) =>
                  setFormData({ ...formData, industry: e.target.value })
                }
                placeholder="如：餐饮、教育"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-person">联系人</Label>
              <Input
                id="contact-person"
                value={formData.contactPerson}
                onChange={(e) =>
                  setFormData({ ...formData, contactPerson: e.target.value })
                }
                placeholder="联系人姓名"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-phone">联系电话</Label>
              <Input
                id="contact-phone"
                value={formData.contactPhone}
                onChange={(e) =>
                  setFormData({ ...formData, contactPhone: e.target.value })
                }
                placeholder="手机号码"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="package-type">
                套餐 <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.packageType}
                onValueChange={handlePackageChange}
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="contract-amount">
                合同金额 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="contract-amount"
                type="number"
                min="0"
                step="0.01"
                value={formData.contractAmount || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    contractAmount: Number(e.target.value),
                  })
                }
                placeholder="合同金额（元）"
              />
              {errors.contractAmount && (
                <p className="text-xs text-red-500">{errors.contractAmount}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sign-date">签约日期</Label>
              <Input
                id="sign-date"
                type="date"
                value={formData.signDate}
                onChange={(e) =>
                  setFormData({ ...formData, signDate: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-status">
                收款状态 <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.paymentStatus}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    paymentStatus: value as PaymentStatus,
                  })
                }
              >
                <SelectTrigger id="payment-status">
                  <SelectValue placeholder="请选择收款状态" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_STATUS.map((s: PaymentStatus) => (
                    <SelectItem key={s} value={s}>
                      {PAYMENT_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-start">服务开始日期</Label>
              <Input
                id="service-start"
                type="date"
                value={formData.serviceStart}
                onChange={(e) =>
                  setFormData({ ...formData, serviceStart: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-end">服务结束日期</Label>
              <Input
                id="service-end"
                type="date"
                value={formData.serviceEnd}
                onChange={(e) =>
                  setFormData({ ...formData, serviceEnd: e.target.value })
                }
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="remark">备注</Label>
              <Textarea
                id="remark"
                value={formData.remark}
                onChange={(e) =>
                  setFormData({ ...formData, remark: e.target.value })
                }
                placeholder="选填，备注信息"
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
              {isPending
                ? '提交中...'
                : isEditing
                  ? '保存修改'
                  : '创建合同'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ContractFormDialog;
