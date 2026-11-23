import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { getApiErrorMessage } from '@client/src/lib/api-error';
import type {
  CustomerWallet,
  WalletTransaction,
  WalletTransactionListResponse,
  RechargeApplication,
  RechargeApplicationListResponse,
  RechargeStatsResponse,
} from '@shared/api.interface';
import type { WalletTxType, RechargeStatus } from '@shared/api.interface';

/* ---------- 查询参数 ---------- */

export interface WalletQuery {
  brandId?: string;
}

export interface TransactionListQuery {
  brandId?: string;
  type?: WalletTxType;
  page?: number;
  pageSize?: number;
}

export interface RechargeApplicationQuery {
  status?: RechargeStatus;
  brandId?: string;
  page?: number;
  pageSize?: number;
  startDate?: string;
  endDate?: string;
}

/* ---------- 基础 API 函数 ---------- */

async function fetchWallet(brandId?: string): Promise<CustomerWallet> {
  const { data } = await axiosForBackend.get('/api/media-wallet/wallet', {
    params: brandId ? { brandId } : undefined,
  });
  return data;
}

async function listTransactions(
  params: TransactionListQuery,
): Promise<WalletTransactionListResponse> {
  const { data } = await axiosForBackend.get(
    '/api/media-wallet/wallet/transactions',
    { params },
  );
  return data;
}

async function applyRecharge(amountYuan: number): Promise<RechargeApplication> {
  const { data } = await axiosForBackend.post(
    '/api/media-wallet/recharge/apply',
    { amountYuan },
  );
  return data;
}

async function listRechargeApplications(
  params: RechargeApplicationQuery,
): Promise<RechargeApplicationListResponse> {
  const { data } = await axiosForBackend.get(
    '/api/media-wallet/recharge/applications',
    { params },
  );
  return data;
}

async function approveRecharge(
  id: string,
  actualAmountYuan?: number,
): Promise<RechargeApplication> {
  const { data } = await axiosForBackend.post(
    `/api/media-wallet/recharge/applications/${id}/approve`,
    { actualAmountYuan },
  );
  return data;
}

async function rejectRecharge(
  id: string,
  rejectReason: string,
): Promise<RechargeApplication> {
  const { data } = await axiosForBackend.post(
    `/api/media-wallet/recharge/applications/${id}/reject`,
    { rejectReason },
  );
  return data;
}

/* ---------- React Query hooks ---------- */

export function useWallet(brandId?: string, enabled = true) {
  return useQuery({
    queryKey: ['media-wallet', 'wallet', brandId],
    queryFn: () => fetchWallet(brandId!),
    retry: false,
    staleTime: 30_000,
    enabled: enabled && Boolean(brandId),
  });
}

export function useWalletTransactions(params: TransactionListQuery = {}) {
  return useQuery({
    queryKey: ['media-wallet', 'transactions', params],
    queryFn: () => listTransactions(params),
    retry: false,
  });
}

export function useApplyRecharge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: applyRecharge,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['media-wallet', 'recharge-applications'],
      });
      toast.success('已提交，等待服务商审核');
    },
    onError: (error: unknown) => {
      const msg = getApiErrorMessage(error, '提交充值申请失败');
      logger.error('提交充值申请失败', error);
      toast.error(msg);
    },
  });
}

export function useRechargeApplications(params: RechargeApplicationQuery = {}) {
  return useQuery({
    queryKey: ['media-wallet', 'recharge-applications', params],
    queryFn: () => listRechargeApplications(params),
    retry: false,
  });
}

export function useApproveRecharge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      actualAmountYuan,
    }: {
      id: string;
      actualAmountYuan?: number;
    }) => approveRecharge(id, actualAmountYuan),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['media-wallet', 'recharge-applications'],
      });
      queryClient.invalidateQueries({ queryKey: ['media-wallet', 'wallet'] });
      queryClient.invalidateQueries({
        queryKey: ['media-wallet', 'transactions'],
      });
      queryClient.invalidateQueries({
        queryKey: ['media-wallet', 'recharge-stats'],
      });
      toast.success('充值申请已通过');
    },
    onError: (error: unknown) => {
      const msg = getApiErrorMessage(error, '审核失败');
      logger.error('充值申请审核失败', error);
      toast.error(msg);
    },
  });
}

export function useRejectRecharge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      rejectReason,
    }: {
      id: string;
      rejectReason: string;
    }) => rejectRecharge(id, rejectReason),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['media-wallet', 'recharge-applications'],
      });
      queryClient.invalidateQueries({
        queryKey: ['media-wallet', 'recharge-stats'],
      });
      toast.success('已驳回充值申请');
    },
    onError: (error: unknown) => {
      const msg = getApiErrorMessage(error, '驳回失败');
      logger.error('驳回充值申请失败', error);
      toast.error(msg);
    },
  });
}

/* ---------- 类型导出 ---------- */

export type {
  CustomerWallet,
  WalletTransaction,
  RechargeApplication,
};

/* ---------- 充值统计 ---------- */

async function fetchRechargeStats(): Promise<RechargeStatsResponse> {
  const { data } = await axiosForBackend.get('/api/media-wallet/recharge/stats');
  return data;
}

export function useRechargeStats(enabled: boolean = true) {
  return useQuery({
    queryKey: ['media-wallet', 'recharge-stats'],
    queryFn: () => fetchRechargeStats(),
    retry: false,
    enabled,
  });
}
