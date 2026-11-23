import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type { MonthlyReport, PagedResponse } from '@shared/api.interface';

export interface ReportsQueryParams {
  page: number;
  pageSize: number;
  brandId?: string;
  month?: string;
  isSent?: string;
}

/** 分页获取月报列表 */
export async function getReports(
  params: ReportsQueryParams,
): Promise<PagedResponse<MonthlyReport>> {
  const searchParams = new URLSearchParams();
  searchParams.set('page', String(params.page));
  searchParams.set('pageSize', String(params.pageSize));
  if (params.brandId) searchParams.set('brandId', params.brandId);
  if (params.month) searchParams.set('month', params.month);
  if (params.isSent !== undefined && params.isSent !== '') {
    searchParams.set('isSent', params.isSent);
  }
  const response = await axiosForBackend.get(
    `/api/reports?${searchParams.toString()}`,
  );
  return response.data;
}

/** 获取月报详情 */
export async function getReportDetail(id: string): Promise<MonthlyReport> {
  const response = await axiosForBackend.get(`/api/reports/${id}`);
  return response.data;
}

export interface CreateReportPayload {
  brandId: string;
  reportMonth: string;
  includedCount: number;
  prevIncludedCount: number;
  contentOutput: number;
  notes?: string | null;
}

/** 新建月报 */
export async function createReport(
  payload: CreateReportPayload,
): Promise<MonthlyReport> {
  const response = await axiosForBackend.post('/api/reports', payload);
  return response.data;
}

export interface UpdateReportPayload {
  brandId?: string;
  reportMonth?: string;
  includedCount?: number;
  prevIncludedCount?: number;
  contentOutput?: number;
  notes?: string | null;
}

/** 编辑月报 */
export async function updateReport(
  id: string,
  payload: UpdateReportPayload,
): Promise<MonthlyReport> {
  const response = await axiosForBackend.patch(`/api/reports/${id}`, payload);
  return response.data;
}

/** 删除月报 */
export async function deleteReport(id: string): Promise<void> {
  await axiosForBackend.delete(`/api/reports/${id}`);
}

/** 标记已发送 / 取消发送（取消时走 PATCH） */
export async function toggleReportSent(
  id: string,
  sent: boolean,
): Promise<MonthlyReport> {
  if (sent) {
    const response = await axiosForBackend.post(`/api/reports/${id}/send`);
    return response.data;
  }
  const response = await axiosForBackend.patch(`/api/reports/${id}`, {
    isSent: false,
    sentAt: null,
  });
  return response.data;
}

/** 获取打印视图数据 */
export async function getPrintReport(id: string): Promise<MonthlyReport> {
  const response = await axiosForBackend.get(`/api/reports/print/${id}`);
  return response.data;
}

/** 导出月报PDF，返回可下载的临时blob URL，使用后需调用 URL.revokeObjectURL 释放 */
export async function exportReportPdf(id: string): Promise<string> {
  const response = await axiosForBackend.get(`/api/reports/${id}/export-pdf`, {
    responseType: 'blob',
  });
  const blob = response.data as Blob;
  return URL.createObjectURL(blob);
}
