import { GroundReport } from '../../types';
import { apiFetch } from './client';

export async function fetchGroundReports(unitId?: string): Promise<GroundReport[]> {
  const endpoint = unitId ? `/api/reports/ground?unitId=${unitId}` : '/api/reports/ground';
  return apiFetch<GroundReport[]>(endpoint);
}

export async function fetchReportsForUser(_userId: string): Promise<GroundReport[]> {
  return fetchGroundReports();
}

export async function fetchReportsForUnit(unitId: string): Promise<GroundReport[]> {
  return fetchGroundReports(unitId);
}

export async function createGroundReport(data: Partial<GroundReport>): Promise<GroundReport> {
  return apiFetch<GroundReport>('/api/reports/ground', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function createReport(data: Partial<GroundReport>): Promise<GroundReport> {
  return createGroundReport(data);
}

export async function fetchPollingReports(unitId?: string): Promise<any[]> {
  const endpoint = unitId ? `/api/reports/polling?unitId=${unitId}` : '/api/reports/polling';
  return apiFetch<any[]>(endpoint);
}

export async function createPollingReport(data: any): Promise<any> {
  return apiFetch<any>('/api/reports/polling', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
