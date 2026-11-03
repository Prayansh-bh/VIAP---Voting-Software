import { GroundReport } from '../../types';
import { apiFetch } from './client';

export async function fetchGroundReports(unitId?: string): Promise<GroundReport[]> {
  const endpoint = unitId ? `/api/reports/ground?unitId=${unitId}` : '/api/reports/ground';
  const res = await apiFetch<any>(endpoint);
  const items = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : Array.isArray(res?.data) ? res.data : [];
  return items.map(normalizeGroundReport);
}

export async function fetchReportsForUser(_userId: string): Promise<GroundReport[]> {
  return fetchGroundReports();
}

export async function fetchReportsForUnit(unitId: string): Promise<GroundReport[]> {
  return fetchGroundReports(unitId);
}

function normalizeGroundReport(r: any): GroundReport {
  const typeMap: Record<string, 'General Update' | 'Complaint / Issue'> = {
    GENERAL_UPDATE: 'General Update',
    COMPLAINT: 'Complaint / Issue',
  };
  const prioMap: Record<string, 'Low' | 'Medium' | 'High' | 'Urgent'> = {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
    URGENT: 'Urgent',
  };
  const dateObj = r.createdAt ? new Date(r.createdAt) : new Date();
  return {
    id: r.id || '',
    inchargeId: r.createdById || r.inchargeId || '',
    inchargeName: r.createdBy?.name || r.inchargeName || 'Incharge',
    constituency: r.constituency?.name || r.constituency || '',
    mandal: r.mandal?.name || r.mandal || '',
    village: r.village?.name || r.village || '',
    booth: r.booth?.name || (r.booth?.boothNumber ? `Booth ${r.booth.boothNumber}` : (r.booth || '')),
    unitId: r.unitId,
    createdById: r.createdById,
    date: r.date || dateObj.toISOString().split('T')[0],
    time: r.time || dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    reportType: typeMap[String(r.reportType || '').toUpperCase()] || (r.reportType as any) || 'General Update',
    priority: prioMap[String(r.priority || '').toUpperCase()] || (r.priority as any) || 'Medium',
    issueCategory: r.issueCategory || '',
    affectedVotersCount: r.affectedVotersCount,
    description: r.description || '',
    status: r.status === 'RESOLVED' ? 'Resolved' : r.status === 'IN_PROGRESS' ? 'In Progress' : 'Pending',
  };
}

async function createGroundReport(data: Partial<GroundReport>): Promise<GroundReport> {
  const typeUpper = String(data.reportType || '').toUpperCase();
  const reportType = typeUpper.includes('COMPLAINT') || typeUpper.includes('ISSUE') ? 'COMPLAINT' : 'GENERAL_UPDATE';
  const priority = String(data.priority || 'MEDIUM').toUpperCase();

  const payload = {
    ...data,
    reportType,
    priority,
  };

  const res = await apiFetch<any>('/api/reports/ground', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return normalizeGroundReport(res);
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
