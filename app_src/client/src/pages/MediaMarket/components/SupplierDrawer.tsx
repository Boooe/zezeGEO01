import React, { useState } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from '@client/src/components/ui/drawer';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Badge } from '@client/src/components/ui/badge';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { RefreshCw, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  useSuppliers,
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
  useRecalculateSupplierPrices,
} from '@client/src/api/media-market';
import { SUPPLIER_STATUS_LABELS } from '@shared/api.interface';
import type { SupplierStatus, MediaSupplier } from '@shared/api.interface';
import { yuanToCents, formatMarkupRate } from '@client/src/utils/format';
import { showConfirm } from '@lark-apaas/client-toolkit';

interface SupplierDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SupplierDrawer: React.FC<SupplierDrawerProps> = ({ open, onOpenChange }) => {
  const { data, isLoading, refetch } = useSuppliers({ page: 1, pageSize: 50 });
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const deleteSupplier = useDeleteSupplier();
  const recalculatePrices = useRecalculateSupplierPrices();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    contactPhone: '',
    markupRate: '',
    status: 'active' as SupplierStatus,
    note: '',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      contact: '',
      contactPhone: '',
      markupRate: '',
      status: 'active',
      note: '',
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleAdd = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEdit = (supplier: MediaSupplier) => {
    setFormData({
      name: supplier.name,
      contact: supplier.contact || '',
      contactPhone: supplier.contactPhone || '',
      markupRate: String(supplier.markupRate),
      status: supplier.status,
      note: supplier.note || '',
    });
    setEditingId(supplier.id);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast.error('请输入供应商名称');
      return;
    }
    const markupRateNum = parseFloat(formData.markupRate) || 0;

    if (editingId) {
      updateSupplier.mutate(
        {
          id: editingId,
          body: {
            name: formData.name.trim(),
            contact: formData.contact.trim() || undefined,
            contactPhone: formData.contactPhone.trim() || undefined,
            markupRate: markupRateNum,
            status: formData.status,
            note: formData.note.trim() || undefined,
          },
        },
        {
          onSuccess: () => resetForm(),
        },
      );
    } else {
      createSupplier.mutate(
        {
          name: formData.name.trim(),
          contact: formData.contact.trim() || undefined,
          contactPhone: formData.contactPhone.trim() || undefined,
          markupRate: markupRateNum,
          status: formData.status,
          note: formData.note.trim() || undefined,
        },
        {
          onSuccess: () => resetForm(),
        },
      );
    }
  };

  const handleDelete = async (id: string) => {
    if (!await showConfirm('确定删除该供应商吗？删除后关联渠道将失去供应商归属。')) return;
    deleteSupplier.mutate(id);
  };

  const handleRecalculate = (id: string) => {
    recalculatePrices.mutate(id);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="h-full w-full max-w-[480px] right-0 left-auto">
        <DrawerHeader>
          <DrawerTitle>价格规则 / 供应商管理</DrawerTitle>
          <DrawerDescription>
            管理媒体供应商及加价规则
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {/* 新增按钮 */}
          {!showForm && (
            <Button
              variant="outline"
              className="mb-4 w-full border-dashed border-[#E5E9F2] text-[#2E7DFF] hover:bg-[#2E7DFF]/5"
              onClick={handleAdd}
            >
              <Plus className="mr-2 h-4 w-4" />
              新增供应商
            </Button>
          )}

          {/* 新增/编辑表单 */}
          {showForm && (
            <div className="mb-4 space-y-3 rounded-lg border border-[#2E7DFF]/30 bg-[#2E7DFF]/5 p-4">
              <p className="font-medium text-[#0f172a]">
                {editingId ? '编辑供应商' : '新增供应商'}
              </p>

              <div>
                <label className="mb-1 block text-xs text-slate-500">
                  供应商名称 <span className="text-[#FF5C5C]">*</span>
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="请输入供应商名称"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">联系人</label>
                  <Input
                    value={formData.contact}
                    onChange={(e) =>
                      setFormData({ ...formData, contact: e.target.value })
                    }
                    placeholder="联系人"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">联系电话</label>
                  <Input
                    value={formData.contactPhone}
                    onChange={(e) =>
                      setFormData({ ...formData, contactPhone: e.target.value })
                    }
                    placeholder="联系电话"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">加价率(%)</label>
                  <Input
                    type="number"
                    value={formData.markupRate}
                    onChange={(e) =>
                      setFormData({ ...formData, markupRate: e.target.value })
                    }
                    placeholder="例如 30"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">状态</label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.value as SupplierStatus,
                      })
                    }
                    className="flex h-9 w-full rounded-md border border-[#E5E9F2] bg-white px-3 text-sm outline-none focus:border-[#2E7DFF]"
                  >
                    <option value="active">启用</option>
                    <option value="inactive">停用</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-500">备注</label>
                <textarea
                  value={formData.note}
                  onChange={(e) =>
                    setFormData({ ...formData, note: e.target.value })
                  }
                  placeholder="备注信息"
                  rows={2}
                  className="flex w-full rounded-md border border-[#E5E9F2] bg-white px-3 py-2 text-sm outline-none focus:border-[#2E7DFF]"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-[#2E7DFF] hover:bg-[#2563EB]"
                  onClick={handleSave}
                  disabled={createSupplier.isPending || updateSupplier.isPending}
                >
                  <Check className="mr-2 h-4 w-4" />
                  保存
                </Button>
                <Button variant="outline" onClick={resetForm}>
                  <X className="mr-2 h-4 w-4" />
                  取消
                </Button>
              </div>
            </div>
          )}

          {/* 供应商列表 */}
          <div className="space-y-3">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-[#E5E9F2] bg-white p-4"
                  >
                    <Skeleton className="mb-2 h-5 w-32" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))
              : data?.items.map((supplier) => (
                  <div
                    key={supplier.id}
                    className="rounded-lg border border-[#E5E9F2] bg-white p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-[#0f172a]">{supplier.name}</h4>
                          <Badge
                            className={
                              supplier.status === 'active'
                                ? 'bg-[#17C964]/10 text-[#17C964] border-none text-[11px]'
                                : 'bg-slate-100 text-slate-500 border-none text-[11px]'
                            }
                          >
                            {SUPPLIER_STATUS_LABELS[supplier.status]}
                          </Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
                          <span>
                            加价率：<span className="tnum font-medium text-[#2E7DFF]">{formatMarkupRate(supplier.markupRate)}</span>
                          </span>
                          <span>
                            渠道数：<span className="tnum font-medium text-slate-700">{supplier.channelCount}</span>
                          </span>
                          <span>
                            可售：<span className="tnum font-medium text-slate-700">{supplier.sellableCount}</span>
                          </span>
                        </div>
                        {supplier.contact && (
                          <p className="mt-1 text-xs text-slate-400">
                            {supplier.contact} {supplier.contactPhone || ''}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[12px]"
                        onClick={() => handleEdit(supplier)}
                      >
                        <Edit2 className="mr-1 h-3 w-3" />
                        编辑
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[12px] text-[#2E7DFF]"
                        onClick={() => handleRecalculate(supplier.id)}
                        disabled={recalculatePrices.isPending}
                      >
                        <RefreshCw className="mr-1 h-3 w-3" />
                        一键重算
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[12px] text-[#FF5C5C] hover:text-[#FF5C5C] hover:bg-[#FF5C5C]/10"
                        onClick={() => handleDelete(supplier.id)}
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        删除
                      </Button>
                    </div>
                  </div>
                ))}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default SupplierDrawer;
