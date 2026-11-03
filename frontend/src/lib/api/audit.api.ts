import { apiFetch } from './client';

export async function fetchAuditLogs(params: number | { page?: number; limit?: number; entityType?: string } = {}): Promise<any> {
  const query = new URLSearchParams();
  if (typeof params === 'number') {
    query.set('limit', String(params));
  } else {
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.entityType) query.set('entityType', params.entityType);
  }
  return apiFetch(`/api/audit?${query.toString()}`);
}

export async function fetchAuditStats(): Promise<any> {
  return apiFetch('/api/audit/stats');
}
