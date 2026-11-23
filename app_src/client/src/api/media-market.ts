import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { getApiErrorMessage } from '@client/src/lib/api-error';
import type {
  MediaMarketStats,
  MediaSupplier,
  MediaSupplierListItem,
  MediaSupplierListResponse,
  ChannelPricingAdmin,
  ChannelPricingListResponse,
  MarketChannel,
  MarketChannelListResponse,
  MarketFilterOptions,
  PriceImportResult,
  SupplierSettlementStat,
  SourceType,
} from '@shared/api.interface';
import { SOURCE_TYPE_LABELS } from '@shared/api.interface';
import type { SupplierStatus } from '@shared/api.interface';

/* ---------- 查询参数类型 ---------- */

export interface SupplierListQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: SupplierStatus;
}

export interface ChannelListQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  supplierId?: string;
  sellable?: boolean;
  libraryType?: string;
  region?: string;
  industry?: string;
  priceMin?: number;
  priceMax?: number;
  sortBy?: 'price' | 'turnaroundHours';
  sortOrder?: 'asc' | 'desc';
}

export interface MarketChannelQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  mediaType?: string;
  region?: string;
  industry?: string;
  priceMin?: number;
  priceMax?: number;
  turnaroundMax?: number;
  sortBy?: 'price' | 'turnaroundHours';
  sortOrder?: 'asc' | 'desc';
  sourceType?: SourceType;
}

/* ---------- 基础 API 函数 ---------- */

async function fetchStats(): Promise<MediaMarketStats> {
  const { data } = await axiosForBackend.get('/api/media-market/stats');
  return data;
}

async function listSuppliers(
  params: SupplierListQuery,
): Promise<MediaSupplierListResponse> {
  const { data } = await axiosForBackend.get('/api/media-market/suppliers', {
    params,
  });
  return data;
}

async function createSupplier(body: {
  name: string;
  contact?: string;
  contactPhone?: string;
  settlementCycle?: string;
  apiBase?: string;
  status: SupplierStatus;
  markupRate: number;
  note?: string;
}): Promise<MediaSupplier> {
  const { data } = await axiosForBackend.post(
    '/api/media-market/suppliers',
    body,
  );
  return data;
}

async function updateSupplier(
  id: string,
  body: Partial<{
    name: string;
    contact: string;
    contactPhone: string;
    settlementCycle: string;
    apiBase: string;
    status: SupplierStatus;
    markupRate: number;
    note: string;
  }>,
): Promise<MediaSupplier> {
  const { data } = await axiosForBackend.patch(
    `/api/media-market/suppliers/${id}`,
    body,
  );
  return data;
}

async function deleteSupplier(id: string): Promise<void> {
  await axiosForBackend.delete(`/api/media-market/suppliers/${id}`);
}

async function recalculateSupplierPrices(id: string): Promise<{ updated: number }> {
  const { data } = await axiosForBackend.post(
    `/api/media-market/suppliers/${id}/recalculate-prices`,
  );
  return data;
}

async function listChannels(
  params: ChannelListQuery,
): Promise<ChannelPricingListResponse> {
  const { data } = await axiosForBackend.get('/api/media-market/channels', {
    params,
  });
  return data;
}

async function updateChannelPricing(
  id: string,
  body: {
    costPriceCents?: number;
    salePriceCents?: number;
    stock?: number;
    turnaroundHours?: number;
    priceUnit?: string;
  },
): Promise<ChannelPricingAdmin> {
  const { data } = await axiosForBackend.patch(
    `/api/media-market/channels/${id}/pricing`,
    body,
  );
  return data;
}

async function toggleChannelSellable(id: string): Promise<ChannelPricingAdmin> {
  const { data } = await axiosForBackend.patch(
    `/api/media-market/channels/${id}/toggle-sellable`,
  );
  return data;
}

async function importPrices(params: { csvText: string; allowCreate?: boolean }): Promise<PriceImportResult> {
  const { data } = await axiosForBackend.post('/api/media-market/channels/import', params);
  return data;
}

export async function listMarketChannels(
  params: MarketChannelQuery,
): Promise<MarketChannelListResponse> {
  const { data } = await axiosForBackend.get(
    '/api/media-market/market-channels',
    { params },
  );
  return data;
}

async function fetchFilterOptions(): Promise<MarketFilterOptions> {
  const { data } = await axiosForBackend.get('/api/media-market/filters');
  return data;
}

async function fetchSettlement(): Promise<SupplierSettlementStat[]> {
  const { data } = await axiosForBackend.get('/api/media-market/settlement');
  return data;
}

/* ---------- React Query hooks ---------- */

export function useMarketStats() {
  return useQuery({
    queryKey: ['media-market', 'stats'],
    queryFn: fetchStats,
    retry: false,
    staleTime: 60_000,
  });
}

export function useSuppliers(params: SupplierListQuery = {}) {
  return useQuery({
    queryKey: ['media-market', 'suppliers', params],
    queryFn: () => listSuppliers(params),
    retry: false,
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSupplier,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-market', 'suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['media-market', 'stats'] });
      toast.success('供应商创建成功');
    },
    onError: (error: unknown) => {
      const msg = getApiErrorMessage(error, '创建供应商失败');
      logger.error('创建供应商失败', error);
      toast.error(msg);
    },
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof updateSupplier>[1] }) =>
      updateSupplier(id, body),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-market', 'suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['media-market', 'stats'] });
      toast.success('供应商更新成功');
    },
    onError: (error: unknown) => {
      const msg = getApiErrorMessage(error, '更新供应商失败');
      logger.error('更新供应商失败', error);
      toast.error(msg);
    },
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteSupplier,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-market', 'suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['media-market', 'stats'] });
      toast.success('供应商已删除');
    },
    onError: (error: unknown) => {
      const msg = getApiErrorMessage(error, '删除供应商失败');
      logger.error('删除供应商失败', error);
      toast.error(msg);
    },
  });
}

export function useRecalculateSupplierPrices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: recalculateSupplierPrices,
    retry: false,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['media-market', 'channels'] });
      queryClient.invalidateQueries({ queryKey: ['media-market', 'stats'] });
      toast.success(`已重新计算 ${result.updated} 条渠道价格`);
    },
    onError: (error: unknown) => {
      const msg = getApiErrorMessage(error, '重算价格失败');
      logger.error('重算价格失败', error);
      toast.error(msg);
    },
  });
}

export function useChannels(params: ChannelListQuery = {}) {
  return useQuery({
    queryKey: ['media-market', 'channels', params],
    queryFn: () => listChannels(params),
    retry: false,
  });
}

export function useUpdateChannelPricing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Parameters<typeof updateChannelPricing>[1];
    }) => updateChannelPricing(id, body),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-market', 'channels'] });
      queryClient.invalidateQueries({ queryKey: ['media-market', 'market-channels'] });
      queryClient.invalidateQueries({ queryKey: ['media-market', 'stats'] });
      toast.success('价格更新成功');
    },
    onError: (error: unknown) => {
      const msg = getApiErrorMessage(error, '更新价格失败');
      logger.error('更新价格失败', error);
      toast.error(msg);
    },
  });
}

export function useToggleChannelSellable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: toggleChannelSellable,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-market', 'channels'] });
      queryClient.invalidateQueries({ queryKey: ['media-market', 'market-channels'] });
      queryClient.invalidateQueries({ queryKey: ['media-market', 'stats'] });
    },
    onError: (error: unknown) => {
      const msg = getApiErrorMessage(error, '操作失败');
      logger.error('切换上架状态失败', error);
      toast.error(msg);
    },
  });
}

export function useImportPrices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: importPrices,
    retry: false,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['media-market', 'channels'] });
      queryClient.invalidateQueries({ queryKey: ['media-market', 'stats'] });
      toast.success(
        `导入完成：成功 ${result.success} 条，未匹配 ${result.unmatched} 条，失败 ${result.failed} 条`,
      );
    },
    onError: (error: unknown) => {
      const msg = getApiErrorMessage(error, '导入失败');
      logger.error('批量导入价格失败', error);
      toast.error(msg);
    },
  });
}

export function useMarketChannels(params: MarketChannelQuery = {}) {
  return useQuery({
    queryKey: ['media-market', 'market-channels', params],
    queryFn: () => listMarketChannels(params),
    retry: false,
  });
}

export function useMarketFilterOptions() {
  return useQuery({
    queryKey: ['media-market', 'filter-options'],
    queryFn: fetchFilterOptions,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSupplierSettlement() {
  return useQuery({
    queryKey: ['media-market', 'settlement'],
    queryFn: fetchSettlement,
    retry: false,
  });
}

export function downloadTemplate(): void {
  const link = document.createElement('a');
  link.href = '/api/media-market/template.csv';
  link.download = 'price_import_template.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/* ---------- 类型导出 ---------- */

export type {
  MediaMarketStats,
  MediaSupplier,
  MediaSupplierListItem,
  ChannelPricingAdmin,
  MarketChannel,
  MarketChannelListResponse,
  PriceImportResult,
  SupplierSettlementStat,
};
