import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type { BrandReadinessResponse } from '@shared/api.interface';

export interface BrandOption {
  id: string;
  name: string;
  industry: string | null;
}

export interface GetBrandsParams {
  includeDemo?: boolean;
}

export async function getBrands(
  params: GetBrandsParams = {},
): Promise<BrandOption[]> {
  const response = await axiosForBackend.get('/api/brands/options', {
    params,
  });
  return response.data.items;
}

export async function getBrandReadiness(
  brandId: string,
): Promise<BrandReadinessResponse> {
  const response = await axiosForBackend.get(`/api/brands/${brandId}/readiness`);
  return response.data;
}
