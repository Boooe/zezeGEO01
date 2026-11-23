import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  ComplianceCheckRequest,
  ComplianceCheckResponse,
} from '@shared/api.interface';

export async function checkCompliance(
  body: ComplianceCheckRequest,
): Promise<ComplianceCheckResponse> {
  const res = await axiosForBackend.post('/api/compliance/check', body);
  return res.data;
}
