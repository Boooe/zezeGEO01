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
import { Label } from '@client/src/components/ui/label';
import { convertLead, type ConvertLeadPayload } from '@client/src/api/leads';
import type { Lead } from '@shared/api.interface';

interface ConvertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
}

const ConvertDialog: React.FC<ConvertDialogProps> = ({
  open,
  onOpenChange,
  lead,
}) => {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ConvertLeadPayload>({
    defaultValues: {
      industry: '',
      contactPerson: '',
      contactPhone: '',
    },
  });

  useEffect(() => {
    if (open && lead) {
      reset({
        industry: lead.industry ?? '',
        contactPerson: '',
        contactPhone: lead.phone ?? '',
      });
    }
  }, [open, lead, reset]);

  const mutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ConvertLeadPayload }) =>
      convertLead(id, data),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads', 'stats'] });
      toast.success('线索已成功转为客户');
      onOpenChange(false);
    },
    onError: (error: any) => {
      const msg =
        error?.response?.data?.error?.message ?? '转换失败，请重试';
      toast.error(msg);
    },
  });

  const onSubmit = (data: ConvertLeadPayload) => {
    if (!lead) return;
    const payload: ConvertLeadPayload = {
      industry: data.industry || undefined,
      contactPerson: data.contactPerson || undefined,
      contactPhone: data.contactPhone || undefined,
    };
    mutation.mutate({ id: lead.id, data: payload });
  };

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>线索转客户</DialogTitle>
          <p className="text-sm text-muted-foreground">
            将线索「<span className="font-medium text-foreground">{lead.merchantName}</span>」转为客户品牌
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="rounded-md bg-slate-50 p-3 text-sm">
            <div className="text-muted-foreground">
              品牌名称：
              <span className="font-medium text-foreground">
                {lead.merchantName}
              </span>
            </div>
            {lead.brandName && (
              <div className="mt-1 text-xs text-amber-600">
                ⚠ 该线索已关联品牌，将直接更新阶段为「已签单」
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="industry">行业</Label>
              <Input
                id="industry"
                {...register('industry')}
                placeholder="请输入行业"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contactPerson">联系人</Label>
              <Input
                id="contactPerson"
                {...register('contactPerson')}
                placeholder="请输入联系人"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="contactPhone">联系电话</Label>
              <Input
                id="contactPhone"
                {...register('contactPhone')}
                placeholder="请输入联系电话"
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                取消
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? '转换中...' : '确认转换'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ConvertDialog;
