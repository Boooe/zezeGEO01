import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  PlanItem,
  PlanListResponse,
  PlanUpsertRequest,
  CustomerCreateResponse,
  CreateCustomerFullRequest,
  CustomerResetPasswordResponse,
  UpdatePlanRequest,
  RenewRequest,
  RenewResponse,
  CreditOverviewResponse,
  BatchRechargeRequest,
  BatchRechargeResult,
  ConsumptionRankItem,
  MonthlyBillResponse,
  DeliveryOverviewResponse,
  BrandActivityResponse,
} from '@shared/api.interface';

// ======== 套餐管理 ========
export const getPlans = (params: { page?: number; pageSize?: number }) =>
  axiosForBackend.get<PlanListResponse>('/api/admin/plans', { params }).then((r) => r.data);

export const getActivePlans = () =>
  axiosForBackend.get<{ items: PlanItem[] }>('/api/admin/plans/active').then((r) => r.data);

export const createPlan = (body: PlanUpsertRequest) =>
  axiosForBackend.post<PlanItem>('/api/admin/plans', body).then((r) => r.data);

export const updatePlan = (id: string, body: PlanUpsertRequest) =>
  axiosForBackend.put<PlanItem>(`/api/admin/plans/${id}`, body).then((r) => r.data);

export const deletePlan = (id: string) =>
  axiosForBackend.delete<{ success: boolean }>(`/api/admin/plans/${id}`).then((r) => r.data);

// ======== 客户开通 ========
export const createCustomerFull = (body: CreateCustomerFullRequest) =>
  axiosForBackend.post<CustomerCreateResponse>('/api/admin/customers', body).then((r) => r.data);

export const disableCustomerUser = (brandId: string, userId: string) =>
  axiosForBackend.post<{ success: boolean }>(`/api/admin/customers/${brandId}/users/${userId}/disable`).then((r) => r.data);

export const enableCustomerUser = (brandId: string, userId: string) =>
  axiosForBackend.post<{ success: boolean }>(`/api/admin/customers/${brandId}/users/${userId}/enable`).then((r) => r.data);

export const resetCustomerPassword = (brandId: string, userId: string) =>
  axiosForBackend.post<CustomerResetPasswordResponse>(`/api/admin/customers/${brandId}/users/${userId}/reset-password`).then((r) => r.data);

export const updateCustomerPlan = (brandId: string, body: UpdatePlanRequest) =>
  axiosForBackend.patch<{ success: boolean }>(`/api/admin/customers/${brandId}/plan`, body).then((r) => r.data);

export const renewCustomer = (brandId: string, body: RenewRequest) =>
  axiosForBackend.post<RenewResponse>(`/api/admin/customers/${brandId}/renew`, body).then((r) => r.data);

export const getExpiringSoonCount = () =>
  axiosForBackend.get<{ count: number }>('/api/admin/customers/expiring-soon').then((r) => r.data);

// ======== 算力总览 ========
export const getCreditOverview = (params: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  healthStatus?: string;
}) =>
  axiosForBackend.get<CreditOverviewResponse>('/api/admin/credit/overview', { params }).then((r) => r.data);

export const batchRecharge = (body: BatchRechargeRequest) =>
  axiosForBackend.post<BatchRechargeResult>('/api/admin/credit/batch-recharge', body).then((r) => r.data);

export const getConsumptionRank = (params?: { month?: string }) =>
  axiosForBackend.get<{ items: ConsumptionRankItem[] }>('/api/admin/credit/consumption-rank', { params }).then((r) => r.data);

export const getMonthlyBill = (params: { month?: string; page?: number; pageSize?: number; keyword?: string }) =>
  axiosForBackend.get<MonthlyBillResponse>('/api/admin/credit/monthly-bill', { params }).then((r) => r.data);

export const exportMonthlyBillCsv = (month?: string) => {
  const url = `/api/admin/credit/monthly-bill/export${month ? `?month=${month}` : ''}`;
  window.open(url, '_blank');
};

// ======== 交付看板 ========
export const getDeliveryOverview = (params: {
  page?: number;
  pageSize?: number;
  deliveryStatus?: string;
  keyword?: string;
  sortBy?: string;
  sortOrder?: string;
}) =>
  axiosForBackend.get<DeliveryOverviewResponse>('/api/admin/delivery/overview', { params }).then((r) => r.data);

export const getBrandActivity = (brandId: string, params?: { limit?: number }) =>
  axiosForBackend.get<BrandActivityResponse>(`/api/admin/delivery/brands/${brandId}/activity`, { params }).then((r) => r.data);
