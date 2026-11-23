import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  DiagnosisTask,
  DiagnosisReport,
  DiagnosisStatus,
  DiagnosisResultItem,
  DiagnosisPlatform,
  DiagnosisQuestionScenario,
  DiagnosisRecommendQuotaResponse,
  DiagnosisCreditInfoResponse,
  CompetitorCompareRequest,
  CompetitorCompareResponse,
} from '@shared/api.interface';

export interface CreateDiagnosisTaskRequest {
  brandId?: string;
  brandName: string;
  city: string;
  category: string;
  platforms: DiagnosisPlatform[];
  competitors?: string[];
  website?: string;
  brandAliases?: string[];
  brandIntro?: string;
  products?: Array<{ name: string }>;
}

export interface GenerateQuestionsRequest {
  brandName: string;
  city: string;
  category: string;
}

export interface GenerateQuestionsResponse {
  questions: string[];
}

export interface RunDiagnosisRequest {
  questions: string[];
}

export interface RunDiagnosisResponse {
  taskId: string;
  status: DiagnosisStatus;
}

export interface DiagnosisTaskListQuery {
  page?: number;
  pageSize?: number;
  status?: DiagnosisStatus;
  keyword?: string;
  brandId?: string;
}

export interface DiagnosisTaskListResponse {
  items: DiagnosisTask[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DiagnosisReportListQuery {
  page?: number;
  pageSize?: number;
  brandId?: string;
}

export interface DiagnosisReportListResponse {
  items: DiagnosisReport[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ShareReportResponse {
  shareToken: string;
  shareUrl: string;
}

export async function createDiagnosisTask(
  body: CreateDiagnosisTaskRequest,
): Promise<DiagnosisTask> {
  const res = await axiosForBackend.post('/api/diagnosis/tasks', body);
  return res.data;
}

export async function generateQuestions(
  body: GenerateQuestionsRequest,
): Promise<GenerateQuestionsResponse> {
  const res = await axiosForBackend.post('/api/diagnosis/generate-questions', body);
  return res.data;
}

export async function runDiagnosis(
  taskId: string,
  body: RunDiagnosisRequest,
): Promise<RunDiagnosisResponse> {
  const res = await axiosForBackend.post(`/api/diagnosis/tasks/${taskId}/run`, body);
  return res.data;
}

export async function getDiagnosisResults(
  reportId: string,
): Promise<DiagnosisResultItem[]> {
  const res = await axiosForBackend.get(`/api/diagnosis/results/${reportId}`);
  return res.data;
}

export async function getDiagnosisTasks(
  query: DiagnosisTaskListQuery,
): Promise<DiagnosisTaskListResponse> {
  const res = await axiosForBackend.get('/api/diagnosis/tasks', { params: query });
  return res.data;
}

export async function getDiagnosisTask(id: string): Promise<DiagnosisTask> {
  const res = await axiosForBackend.get(`/api/diagnosis/tasks/${id}`);
  return res.data;
}

export async function deleteDiagnosisTask(id: string): Promise<void> {
  await axiosForBackend.delete(`/api/diagnosis/tasks/${id}`);
}

export async function retryDiagnosisTask(id: string): Promise<DiagnosisTask> {
  const res = await axiosForBackend.post(`/api/diagnosis/tasks/${id}/retry`);
  return res.data;
}

export async function getDiagnosisReports(
  query: DiagnosisReportListQuery,
): Promise<DiagnosisReportListResponse> {
  const res = await axiosForBackend.get('/api/diagnosis/reports', { params: query });
  return res.data;
}

export async function getDiagnosisReport(id: string): Promise<DiagnosisReport> {
  const res = await axiosForBackend.get(`/api/diagnosis/reports/${id}`);
  return res.data;
}

export async function shareDiagnosisReport(
  id: string,
): Promise<ShareReportResponse> {
  const res = await axiosForBackend.post(`/api/diagnosis/reports/${id}/share`);
  return res.data;
}

export async function competitorCompare(
  body: CompetitorCompareRequest,
): Promise<CompetitorCompareResponse> {
  const res = await axiosForBackend.post('/api/diagnosis/competitor-compare', body);
  return res.data;
}

export interface GenerateQuestionScenariosRequest {
  productName: string;
  brandName: string;
  city: string;
  category: string;
  brandId?: string;
}

export interface GenerateQuestionScenariosResponse {
  scenarios: DiagnosisQuestionScenario[];
}

export async function generateQuestionScenarios(
  body: GenerateQuestionScenariosRequest,
): Promise<GenerateQuestionScenariosResponse> {
  const res = await axiosForBackend.post('/api/diagnosis/generate-question-scenarios', body);
  return res.data;
}

export async function getRecommendQuota(
  brandId?: string,
): Promise<DiagnosisRecommendQuotaResponse> {
  const res = await axiosForBackend.get('/api/diagnosis/recommend-quota', {
    params: { brandId },
  });
  return res.data;
}

export async function getDiagnosisCreditInfo(
  brandId?: string,
): Promise<DiagnosisCreditInfoResponse> {
  const res = await axiosForBackend.get('/api/diagnosis/credit-info', {
    params: { brandId },
  });
  return res.data;
}
