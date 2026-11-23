import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@client/src/components/ui/dialog';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
import { Label } from '@client/src/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@client/src/components/ui/select';
import DatePicker from './DatePicker';
import {
  createLead,
  updateLead,
  type CreateLeadPayload,
} from '@client/src/api/leads';
import {
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  INTENT_LEVELS,
  INTENT_LEVEL_LABELS,
  type Lead,
  type LeadStage,
  type IntentLevel,
} from '@shared/api.interface';

interface LeadFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editLead?: Lead | null;
}

type FormValues = CreateLeadPayload & {
  stage: LeadStage;
  intentLevel: IntentLevel;
};

const LeadFormDialog: React.FC<LeadFormDialogProps> = ({
  open,
  onOpenChange,
  editLead,
}) => {
  const queryClient = useQueryClient();
  const isEdit = !!editLead;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      merchantName: '',
      industry: '',
      region: '',
      phone: '',
      source: '',
      intentLevel: 'medium',
      stage: 'pending',
      nextFollowupDate: undefined,
      remark: '',
    },
  });

  useEffect(() => {
    if (open && editLead) {
      reset({
        merchantName: editLead.merchantName,
        industry: editLead.industry ?? '',
        region: editLead.region ?? '',
        phone: editLead.phone ?? '',
        source: editLead.source ?? '',
        intentLevel: editLead.intentLevel,
        stage: editLead.stage,
        nextFollowupDate: editLead.nextFollowupDate ?? undefined,
        remark: editLead.remark ?? '',
      });
    } else if (open && !editLead) {
      reset({
        merchantName: '',
        industry: '',
        region: '',
        phone: '',
        source: '',
        intentLevel: 'medium',
        stage: 'pending',
        nextFollowupDate: undefined,
        remark: '',
      });
    }
  }, [open, editLead, reset]);

  const createMutation = useMutation({
    mutationFn: createLead,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads', 'stats'] });
      toast.success('线索创建成功');
      onOpenChange(false);
    },
    onError: (error: any) => {
      const msg =
        error?.response?.data?.error?.message ?? '创建失败，请重试';
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FormValues> }) =>
      updateLead(id, data),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads', 'stats'] });
      toast.success('线索更新成功');
      onOpenChange(false);
    },
    onError: (error: any) => {
      const msg =
        error?.response?.data?.error?.message ?? '更新失败，请重试';
      toast.error(msg);
    },
  });

  const onSubmit = (data: FormValues) => {
    // 清理空字符串字段
    const payload: CreateLeadPayload = {
      ...data,
      industry: data.industry || undefined,
      region: data.region || undefined,
      phone: data.phone || undefined,
      source: data.source || undefined,
      remark: data.remark || undefined,
    };

    if (isEdit && editLead) {
      updateMutation.mutate({ id: editLead.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const stage = watch('stage');
  const intentLevel = watch('intentLevel');
  const nextFollowupDate = watch('nextFollowupDate');
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑线索' : '新增线索'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="merchantName">
                商户名称 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="merchantName"
                {...register('merchantName', {
                  required: '请输入商户名称',
                  maxLength: { value: 100, message: '最多100个字符' },
                })}
                placeholder="请输入商户名称"
              />
              {errors.merchantName && (
                <p className="text-xs text-red-500">
                  {errors.merchantName.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="industry">行业</Label>
              <Input
                id="industry"
                {...register('industry')}
                placeholder="如：餐饮、教育"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="region">区域</Label>
              <Input
                id="region"
                {...register('region')}
                placeholder="如：北京市朝阳区"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">电话</Label>
              <Input
                id="phone"
                {...register('phone')}
                placeholder="联系电话"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="source">来源</Label>
              <Input
                id="source"
                {...register('source')}
                placeholder="如：百度推广、转介绍"
              />
            </div>

            <div className="space-y-1.5">
              <Label>意向等级</Label>
              <Select
                value={intentLevel}
                onValueChange={(val) =>
                  setValue('intentLevel', val as IntentLevel, {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择意向等级" />
                </SelectTrigger>
                <SelectContent>
                  {INTENT_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {INTENT_LEVEL_LABELS[level]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>阶段</Label>
              <Select
                value={stage}
                onValueChange={(val) =>
                  setValue('stage', val as LeadStage, {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择阶段" />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {LEAD_STAGE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>下次跟进日期</Label>
              <DatePicker
                value={nextFollowupDate}
                onChange={(date) =>
                  setValue('nextFollowupDate', date, { shouldValidate: true })
                }
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="remark">备注</Label>
            <Textarea
              id="remark"
              {...register('remark')}
              placeholder="补充说明..."
              className="min-h-[80px]"
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                取消
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? '提交中...' : isEdit ? '保存修改' : '创建线索'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default LeadFormDialog;
