import { apiFetch } from './client';

export async function fetchCadreNetwork(_unitId?: string): Promise<any> {
  const data = await apiFetch<any[]>('/api/cadre/network');
  return Array.isArray(data) ? { items: data } : data;
}

export async function fetchCadrePerformance(): Promise<any> {
  return apiFetch<any>('/api/cadre/performance');
}

export async function createCadreApi(payload: {
  name: string;
  mobileNumber?: string;
  role: string;
  assignedUnitLevel?: string;
  assignedUnitId?: string;
  notes?: string;
}): Promise<any> {
  return apiFetch('/api/cadre', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
