import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { Textarea } from '@client/src/components/ui/textarea';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { SectionCard } from '@client/src/components/layout/SectionCard';
import { Toolbar } from '@client/src/components/layout/Toolbar';
import {
  getWebsiteSettings,
  saveWebsiteSettings,
  type SaveWebsiteSettingsRequest,
} from '@client/src/api/website';
import { useBrandSelector } from '@client/src/hooks/useBrandSelector';

const PRIMARY = '#2E7DFF';
const DANGER = '#EF4444';

const WebsiteSettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { brands: brandOptions, selectedBrandId, setSelectedBrandId } =
    useBrandSelector();
  const brandId = selectedBrandId;

  const {
    data: settings,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['website', 'settings', brandId],
    queryFn: () => getWebsiteSettings(brandId),
    enabled: !!brandId,
  });

  const [form, setForm] = useState<SaveWebsiteSettingsRequest>({
    brandId: '',
    domain: '',
    siteName: '',
    siteDescription: '',
    contactInfo: {
      phone: '',
      email: '',
      address: '',
    },
  });

  useEffect(() => {
    if (settings) {
      setForm({
        brandId: settings.brandId,
        domain: settings.domain ?? '',
        siteName: settings.siteName ?? '',
        siteDescription: settings.siteDescription ?? '',
        contactInfo: {
          phone: settings.contactInfo?.phone ?? '',
          email: settings.contactInfo?.email ?? '',
          address: settings.contactInfo?.address ?? '',
        },
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: saveWebsiteSettings,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['website', 'settings'] });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      brandId,
      domain: form.domain || undefined,
      siteName: form.siteName || undefined,
      siteDescription: form.siteDescription || undefined,
      contactInfo: form.contactInfo || undefined,
    });
  };

  return (
    <SectionCard title="基本设置">
      <Toolbar>
        <Select
          value={brandId}
          onValueChange={(v) => {
            setSelectedBrandId(v);
          }}
        >
          <SelectTrigger className="h-8 w-[160px] text-[13px]">
            <SelectValue placeholder="选择品牌" />
          </SelectTrigger>
          <SelectContent>
            {brandOptions.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Toolbar>

      <div className="space-y-5 pt-4">
          {isLoading ? (
            <SettingsSkeleton />
          ) : isError ? (
            <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4">
              <div
                className="flex items-center gap-2 text-sm"
                style={{ color: DANGER }}
              >
                <span>数据加载失败，请重试</span>
              </div>
              <button
                onClick={() => refetch()}
                className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-red-100"
                style={{ color: DANGER }}
              >
                重试
              </button>
            </div>
          ) : !brandId ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
              请先选择品牌
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">域名</label>
                <Input
                  value={form.domain || ''}
                  onChange={(e) =>
                    setForm({ ...form, domain: e.target.value })
                  }
                  placeholder="https://www.example.com"
                  className="h-9"
                />
                <p className="text-xs text-muted-foreground">
                  请填写完整的官网域名，包含 http:// 或 https://
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">站点名</label>
                <Input
                  value={form.siteName || ''}
                  onChange={(e) =>
                    setForm({ ...form, siteName: e.target.value })
                  }
                  placeholder="请输入站点名称"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">站点描述</label>
                <Textarea
                  value={form.siteDescription || ''}
                  onChange={(e) =>
                    setForm({ ...form, siteDescription: e.target.value })
                  }
                  placeholder="请输入站点描述，用于 SEO 及首页展示"
                  className="min-h-[100px] resize-y"
                />
              </div>

              <div className="pt-2">
                <h3 className="text-sm font-semibold mb-4">联系方式</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">电话</label>
                    <Input
                      value={form.contactInfo?.phone || ''}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          contactInfo: {
                            phone: e.target.value,
                            email: form.contactInfo?.email ?? '',
                            address: form.contactInfo?.address ?? '',
                          },
                        })
                      }
                      placeholder="联系电话"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">邮箱</label>
                    <Input
                      value={form.contactInfo?.email || ''}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          contactInfo: {
                            phone: form.contactInfo?.phone ?? '',
                            email: e.target.value,
                            address: form.contactInfo?.address ?? '',
                          },
                        })
                      }
                      placeholder="联系邮箱"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">地址</label>
                    <Input
                      value={form.contactInfo?.address || ''}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          contactInfo: {
                            phone: form.contactInfo?.phone ?? '',
                            email: form.contactInfo?.email ?? '',
                            address: e.target.value,
                          },
                        })
                      }
                      placeholder="公司地址"
                      className="h-9"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button
                  className="bg-[#2E7DFF] text-white hover:bg-[#1E5FD6]"
                  onClick={handleSave}
                  disabled={saveMutation.isPending || !brandId}
                >
                  {saveMutation.isPending ? '保存中...' : '保存设置'}
                </Button>
              </div>
            </>
          )}
      </div>
    </SectionCard>
  );
};

const SettingsSkeleton = () => (
  <div className="space-y-5">
    <div className="space-y-2">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-9 w-full" />
    </div>
    <div className="space-y-2">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-9 w-full" />
    </div>
    <div className="space-y-2">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-24 w-full" />
    </div>
    <div className="space-y-3">
      <Skeleton className="h-4 w-20" />
      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
    <div className="flex justify-end">
      <Skeleton className="h-9 w-28" />
    </div>
  </div>
);

export default WebsiteSettingsPage;
