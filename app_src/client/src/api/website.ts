import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  WebsiteSettings,
  TdkTemplate,
  SiteNetworkItem,
  SiteStatus,
  SiteType,
  PagedResponse,
} from '@shared/api.interface';

/* ---------------- 官网设置 ---------------- */

export async function getWebsiteSettings(
  brandId: string,
): Promise<WebsiteSettings> {
  const response = await axiosForBackend.get('/api/website/settings', {
    params: { brandId },
  });
  return response.data;
}

export interface SaveWebsiteSettingsRequest {
  brandId: string;
  domain?: string;
  siteName?: string;
  siteDescription?: string;
  contactInfo?: {
    phone: string;
    email: string;
    address: string;
  };
}

export async function saveWebsiteSettings(
  body: SaveWebsiteSettingsRequest,
): Promise<WebsiteSettings> {
  const response = await axiosForBackend.put('/api/website/settings', body);
  return response.data;
}

/* ---------------- TDK 模板 ---------------- */

export interface GetTdkTemplatesParams {
  brandId?: string;
  pageType?: string;
}

export async function getTdkTemplates(
  params: GetTdkTemplatesParams,
): Promise<TdkTemplate[]> {
  const response = await axiosForBackend.get('/api/website/tdk', { params });
  return response.data;
}

export interface CreateTdkTemplateRequest {
  brandId: string;
  name: string;
  titleTemplate: string;
  descriptionTemplate: string;
  keywordsTemplate: string;
  pageType?: string;
  isDefault: boolean;
}

export async function createTdkTemplate(
  body: CreateTdkTemplateRequest,
): Promise<TdkTemplate> {
  const response = await axiosForBackend.post('/api/website/tdk', body);
  return response.data;
}

export interface UpdateTdkTemplateRequest {
  name?: string;
  titleTemplate?: string;
  descriptionTemplate?: string;
  keywordsTemplate?: string;
  pageType?: string | null;
  isDefault?: boolean;
}

export async function updateTdkTemplate(
  id: string,
  body: UpdateTdkTemplateRequest,
): Promise<TdkTemplate> {
  const response = await axiosForBackend.patch(
    `/api/website/tdk/${id}`,
    body,
  );
  return response.data;
}

export async function deleteTdkTemplate(id: string): Promise<void> {
  await axiosForBackend.delete(`/api/website/tdk/${id}`);
}

export interface ApplyTdkTemplateRequest {
  brandName: string;
  keywords: string[];
}

export interface ApplyTdkTemplateResponse {
  title: string;
  description: string;
  keywords: string;
}

export async function applyTdkTemplate(
  id: string,
  body: ApplyTdkTemplateRequest,
): Promise<ApplyTdkTemplateResponse> {
  const response = await axiosForBackend.post(
    `/api/website/tdk/${id}/apply`,
    body,
  );
  return response.data;
}

/* ---------------- 站群 ---------------- */

export interface GetSitesParams {
  page?: number;
  limit?: number;
  brandId?: string;
  status?: SiteStatus | '';
  keyword?: string;
  siteType?: SiteType;
}

export async function getSites(
  params: GetSitesParams,
): Promise<PagedResponse<SiteNetworkItem>> {
  const response = await axiosForBackend.get('/api/website/sites', { params });
  return response.data;
}

export interface CreateSiteRequest {
  brandId: string;
  siteType: SiteType;
  siteName: string;
  domain: string;
  status: SiteStatus;
  cmsType?: string;
  notes?: string;
}

export async function createSite(
  body: CreateSiteRequest,
): Promise<SiteNetworkItem> {
  const response = await axiosForBackend.post('/api/website/sites', body);
  return response.data;
}

export interface UpdateSiteRequest {
  siteName?: string;
  domain?: string;
  status?: SiteStatus;
  cmsType?: string | null;
  notes?: string | null;
  siteType?: SiteType;
}

export async function updateSite(
  id: string,
  body: UpdateSiteRequest,
): Promise<SiteNetworkItem> {
  const response = await axiosForBackend.patch(
    `/api/website/sites/${id}`,
    body,
  );
  return response.data;
}

export async function deleteSite(id: string): Promise<void> {
  await axiosForBackend.delete(`/api/website/sites/${id}`);
}
