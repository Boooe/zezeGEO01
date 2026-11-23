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
import { addFollowup, type CreateFollowupPayload } from '@client/src/api/leads';

const FOLLOWUP_TYPES = [
  { value: 'phone', label: '电话' },
  { value: 'visit', label: '拜访' },
  { value: 'wechat', label: '微信' },
  { value: 'meeting', label: '会议' },
];

interface FollowupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  merchantName: string;
}

type FormValues = CreateFollowupPayload;

const FollowupDialog: React.FC<FollowupDialogProps> = ({
  open,
  onOpenChange,
  leadId,
  merchantName,
}) => {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      content: '',
      followupType: 'phone',
      nextFollowupDate: undefined,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        content: '',
        followupType: 'phone',
        nextFollowupDate: undefined,
      });
    }
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: FormValues }) =>
      addFollowup(id, data),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads', 'detail'] });
      toast.success('跟进记录已添加');
      onOpenChange(false);
    },
    onError: (error: any) => {
      const msg =
        error?.response?.data?.error?.message ?? '添加失败，请重试';
      toast.error(msg);
    },
  });

  const onSubmit = (data: FormValues) => {
    mutation.mutate({ id: leadId, data });
  };

  const followupType = watch('followupType');
  const nextFollowupDate = watch('nextFollowupDate');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>新增跟进记录</DialogTitle>
          <p className="text-sm text-muted-foreground">
            商户：<span className="font-medium text-foreground">{merchantName}</span>
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>跟进类型</Label>
            <Select
              value={followupType}
              onValueChange={(val) =>
                setValue('followupType', val, { shouldValidate: true })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="选择跟进类型" />
              </SelectTrigger>
              <SelectContent>
                {FOLLOWUP_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="content">
              跟进内容 <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="content"
              {...register('content', {
                required: '请输入跟进内容',
              })}
              placeholder="请输入跟进详情..."
              className="min-h-[120px]"
            />
            {errors.content && (
              <p className="text-xs text-red-500">{errors.content.message}</p>
            )}
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

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                取消
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? '提交中...' : '保存跟进'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default FollowupDialog;
