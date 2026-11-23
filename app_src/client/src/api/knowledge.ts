import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  KnowledgeItem,
  KnowledgeCategory,
  PagedResponse,
} from '@shared/api.interface';

/* ---------------- 知识库 ---------------- */

export interface GetKnowledgeParams {
  page?: number;
  pageSize?: number;
  category?: KnowledgeCategory | '';
  keyword?: string;
  brandId?: string;
  isActive?: boolean;
}

export async function getKnowledgeList(
  params: GetKnowledgeParams,
): Promise<PagedResponse<KnowledgeItem>> {
  const response = await axiosForBackend.get('/api/knowledge', { params });
  return response.data;
}

export async function getKnowledgeDetail(id: string): Promise<KnowledgeItem> {
  const response = await axiosForBackend.get(`/api/knowledge/${id}`);
  return response.data;
}

export interface CreateKnowledgeRequest {
  brandId: string;
  category: KnowledgeCategory;
  title: string;
  content: string;
  tags?: string[];
  isActive: boolean;
}

export async function createKnowledge(
  body: CreateKnowledgeRequest,
): Promise<KnowledgeItem> {
  const response = await axiosForBackend.post('/api/knowledge', body);
  return response.data;
}

export interface UpdateKnowledgeRequest {
  brandId?: string;
  category?: KnowledgeCategory;
  title?: string;
  content?: string;
  tags?: string[];
  isActive?: boolean;
}

export async function updateKnowledge(
  id: string,
  body: UpdateKnowledgeRequest,
): Promise<KnowledgeItem> {
  const response = await axiosForBackend.patch(`/api/knowledge/${id}`, body);
  return response.data;
}

export async function deleteKnowledge(id: string): Promise<void> {
  await axiosForBackend.delete(`/api/knowledge/${id}`);
}

export interface GetActiveKnowledgeParams {
  brandId?: string;
  category?: KnowledgeCategory;
}

export async function getActiveKnowledge(
  params: GetActiveKnowledgeParams,
): Promise<KnowledgeItem[]> {
  const response = await axiosForBackend.get('/api/knowledge/list/active', {
    params,
  });
  return response.data;
}

export interface BatchImportKnowledgeItem {
  category: KnowledgeCategory;
  title: string;
  content: string;
  tags?: string[];
}

export interface BatchImportKnowledgeRequest {
  items: BatchImportKnowledgeItem[];
  brandId: string;
}

export async function batchImportKnowledge(
  body: BatchImportKnowledgeRequest,
): Promise<{ count: number }> {
  const response = await axiosForBackend.post('/api/knowledge/batch', body);
  return response.data;
}
