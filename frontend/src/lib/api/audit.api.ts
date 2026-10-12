import { apiFetch } from './client';

export async function fetchAuditLogs(params: { page?: number; limit?: number; entityType?: string } = {}): Promise<any> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.entityType) query.set('entityType', params.entityType);
  return apiFetch(`/api/audit?${query.toString()}`);
}
