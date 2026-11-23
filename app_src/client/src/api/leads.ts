import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  Lead,
  LeadFollowup,
  PagedResponse,
  LeadStage,
} from '@shared/api.interface';

export interface LeadsQueryParams {
  page?: number;
  pageSize?: number;
  stage?: LeadStage | '';
  keyword?: string;
  intentLevel?: 'high' | 'medium' | 'low' | '';
  includeDemo?: boolean;
}

export interface CreateLeadPayload {
  merchantName: string;
  industry?: string;
  region?: string;
  phone?: string;
  source?: string;
  intentLevel?: 'high' | 'medium' | 'low';
  stage?: LeadStage;
  nextFollowupDate?: string;
  remark?: string;
}

export interface UpdateLeadPayload extends Partial<CreateLeadPayload> {
  merchantName?: string;
}

export interface CreateFollowupPayload {
  content: string;
  followupType?: string;
  nextFollowupDate?: string;
}

export interface ConvertLeadPayload {
  industry?: string;
  contactPerson?: string;
  contactPhone?: string;
}

export interface LeadDetailResponse {
  lead: Lead;
  followups: LeadFollowup[];
}

export interface LeadStatsItem {
  stage: string;
  count: number;
  demoCount?: number;
}

export interface LeadStatsParams {
  includeDemo?: boolean;
}

/** 线索阶段统计 */
export async function getLeadStats(
  params: LeadStatsParams = {},
): Promise<LeadStatsItem[]> {
  const response = await axiosForBackend.get('/api/leads/stats', {
    params,
  });
  return response.data;
}

/** 线索分页列表 */
export async function getLeads(
  params: LeadsQueryParams,
): Promise<PagedResponse<Lead>> {
  const response = await axiosForBackend.get('/api/leads', { params });
  return response.data;
}

/** 线索详情 */
export async function getLeadDetail(id: string): Promise<LeadDetailResponse> {
  const response = await axiosForBackend.get(`/api/leads/${id}`);
  return response.data;
}

/** 新增线索 */
export async function createLead(payload: CreateLeadPayload): Promise<Lead> {
  const response = await axiosForBackend.post('/api/leads', payload);
  return response.data;
}

/** 编辑线索 */
export async function updateLead(
  id: string,
  payload: UpdateLeadPayload,
): Promise<{ success: boolean }> {
  const response = await axiosForBackend.patch(`/api/leads/${id}`, payload);
  return response.data;
}

/** 删除线索 */
export async function deleteLead(id: string): Promise<{ success: boolean }> {
  const response = await axiosForBackend.delete(`/api/leads/${id}`);
  return response.data;
}

/** 新增跟进记录 */
export async function addFollowup(
  id: string,
  payload: CreateFollowupPayload,
): Promise<LeadFollowup> {
  const response = await axiosForBackend.post(
    `/api/leads/${id}/followups`,
    payload,
  );
  return response.data;
}

/** 线索转客户 */
export async function convertLead(
  id: string,
  payload: ConvertLeadPayload,
): Promise<{ brandId: string }> {
  const response = await axiosForBackend.post(
    `/api/leads/${id}/convert`,
    payload,
  );
  return response.data;
}
