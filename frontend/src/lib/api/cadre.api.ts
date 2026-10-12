import { apiFetch } from './client';

export async function fetchCadreNetwork(_unitId?: string): Promise<any> {
  const data = await apiFetch<any[]>('/api/cadre/network');
  return Array.isArray(data) ? { items: data } : data;
}

export async function fetchCadrePerformance(): Promise<any> {
  return apiFetch<any>('/api/cadre/performance');
}
