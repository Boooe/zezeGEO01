import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { getApiErrorMessage } from '@client/src/lib/api-error';
import type {
  MediaOrderAdmin,
  MediaOrderClient,
  MediaOrderListResponse,
  CreateMediaOrderRequest,
  BatchCreateOrdersResponse,
} from '@shared/api.interface';
import type { MediaOrderStatus } from '@shared/api.interface';

/* ---------- 查询参数 ---------- */

export interface AdminOrderQuery {
  status?: MediaOrderStatus;
  brandId?: string;
  channelId?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export interface ClientOrderQuery {
  status?: MediaOrderStatus;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

/* ---------- 基础 API 函数 ---------- */

async function listAdminOrders(
  params: AdminOrderQuery,
): Promise<MediaOrderListResponse<MediaOrderAdmin>> {
  const { data } = await axiosForBackend.get('/api/media-orders/admin', {
    params,
  });
  return data;
}

async function listMyOrders(
  params: ClientOrderQuery,
): Promise<MediaOrderListResponse<MediaOrderClient>> {
  const { data } = await axiosForBackend.get('/api/media-orders/my', {
    params,
  });
  return data;
}

async function createOrder(
  body: CreateMediaOrderRequest,
): Promise<MediaOrderClient> {
  const { data } = await axiosForBackend.post('/api/media-orders', body);
  return data;
}

async function getOrderDetail(id: string): Promise<MediaOrderAdmin> {
  const { data } = await axiosForBackend.get(`/api/media-orders/${id}`);
  return data;
}

async function acceptOrder(id: string): Promise<void> {
  await axiosForBackend.post(`/api/media-orders/${id}/accept`);
}

async function submitSupplierOrder(
  id: string,
  supplierOrderNo: string,
): Promise<void> {
  await axiosForBackend.post(`/api/media-orders/${id}/submit-supplier`, {
    supplierOrderNo,
  });
}

async function publishOrder(
  id: string,
  publishedUrl: string,
): Promise<void> {
  await axiosForBackend.post(`/api/media-orders/${id}/publish`, {
    publishedUrl,
  });
}

async function rejectRefundOrder(
  id: string,
  rejectReason: string,
): Promise<void> {
  await axiosForBackend.post(`/api/media-orders/${id}/reject-refund`, {
    rejectReason,
  });
}

async function batchCreateOrders(body: {
  articleIds: string[];
  channelIds: string[];
  remark?: string;
}): Promise<BatchCreateOrdersResponse> {
  const { data } = await axiosForBackend.post('/api/media-orders/batch', body);
  return data;
}

/* ---------- React Query hooks ---------- */

export function useAdminOrders(params: AdminOrderQuery = {}) {
  return useQuery({
    queryKey: ['media-orders', 'admin', params],
    queryFn: () => listAdminOrders(params),
    retry: false,
  });
}

export function useMyOrders(params: ClientOrderQuery = {}) {
  return useQuery({
    queryKey: ['media-orders', 'my', params],
    queryFn: () => listMyOrders(params),
    retry: false,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createOrder,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-orders', 'my'] });
      queryClient.invalidateQueries({ queryKey: ['media-wallet', 'wallet'] });
      queryClient.invalidateQueries({
        queryKey: ['media-wallet', 'transactions'],
      });
      toast.success('订单提交成功');
    },
    onError: (error: unknown) => {
      const msg = getApiErrorMessage(error, '下单失败');
      logger.error('提交订单失败', error);
      toast.error(msg);
    },
  });
}

export function useOrderDetail(id: string | null) {
  return useQuery({
    queryKey: ['media-orders', 'detail', id],
    queryFn: () => getOrderDetail(id!),
    enabled: !!id,
    retry: false,
  });
}

export function useAcceptOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: acceptOrder,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-orders', 'admin'] });
      toast.success('已接单，进入发布中状态');
    },
    onError: (error: unknown) => {
      const msg = getApiErrorMessage(error, '接单失败');
      logger.error('接单失败', error);
      toast.error(msg);
    },
  });
}

export function useSubmitSupplierOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      supplierOrderNo,
    }: {
      id: string;
      supplierOrderNo: string;
    }) => submitSupplierOrder(id, supplierOrderNo),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-orders', 'admin'] });
      toast.success('已提交供应商单号');
    },
    onError: (error: unknown) => {
      const msg = getApiErrorMessage(error, '提交失败');
      logger.error('提交供应商单号失败', error);
      toast.error(msg);
    },
  });
}

export function usePublishOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      publishedUrl,
    }: {
      id: string;
      publishedUrl: string;
    }) => publishOrder(id, publishedUrl),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-orders', 'admin'] });
      queryClient.invalidateQueries({ queryKey: ['media-orders', 'my'] });
      toast.success('已标记为已发布');
    },
    onError: (error: unknown) => {
      const msg = getApiErrorMessage(error, '发布失败');
      logger.error('标记发布失败', error);
      toast.error(msg);
    },
  });
}

export function useRejectRefundOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      rejectReason,
    }: {
      id: string;
      rejectReason: string;
    }) => rejectRefundOrder(id, rejectReason),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-orders', 'admin'] });
      queryClient.invalidateQueries({ queryKey: ['media-orders', 'my'] });
      toast.success('已驳回退款申请');
    },
    onError: (error: unknown) => {
      const msg = getApiErrorMessage(error, '操作失败');
      logger.error('驳回退款失败', error);
      toast.error(msg);
    },
  });
}

export function useBatchCreateOrders() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: batchCreateOrders,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-orders', 'my'] });
      queryClient.invalidateQueries({ queryKey: ['media-wallet', 'wallet'] });
    },
    onError: (error: unknown) => {
      const msg = getApiErrorMessage(error, '批量下单失败');
      logger.error('批量下单失败', error);
      toast.error(msg);
    },
  });
}

/* ---------- 类型导出 ---------- */

export type {
  MediaOrderAdmin,
  MediaOrderClient,
  CreateMediaOrderRequest,
};
