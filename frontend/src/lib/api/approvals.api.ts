import { apiFetch } from '../api';

export interface ApprovalItem {
  id: string;
  partyId?: string;
  type: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  title: string;
  description?: string;
  entityId?: string;
  entityType?: string;
  payload: Record<string, any>;
  requestedByName: string;
  requestedByRole: string;
  requestedByMobile: string;
  actionedByName?: string;
  actionedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalStats {
  totalPending: number;
  totalApproved: number;
  totalRejected: number;
  userRegistrations: number;
  inchargeRequests: number;
  dataCorrections: number;
  surveyApprovals: number;
  transferApprovals: number;
}

export async function fetchApprovalStats(partyId?: string): Promise<ApprovalStats> {
  const query = partyId ? `?partyId=${encodeURIComponent(partyId)}` : '';
  const res = await apiFetch<ApprovalStats>(`/api/approvals/stats${query}`);
  return (
    res || {
      totalPending: 0,
      totalApproved: 0,
      totalRejected: 0,
      userRegistrations: 0,
      inchargeRequests: 0,
      dataCorrections: 0,
      surveyApprovals: 0,
      transferApprovals: 0,
    }
  );
}

export async function fetchApprovals(query: {
  partyId?: string;
  type?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ total: number; items: ApprovalItem[] }> {
  const params = new URLSearchParams();
  if (query.partyId) params.append('partyId', query.partyId);
  if (query.type) params.append('type', query.type);
  if (query.status) params.append('status', query.status);
  if (query.limit) params.append('limit', String(query.limit));
  if (query.offset) params.append('offset', String(query.offset));

  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await apiFetch<{ total: number; items: ApprovalItem[] }>(`/api/approvals${qs}`);
  return res || { total: 0, items: [] };
}

export async function approveRequest(id: string): Promise<any> {
  return apiFetch(`/api/approvals/${encodeURIComponent(id)}/approve`, {
    method: 'PATCH',
  });
}

export async function rejectRequest(id: string, reason: string): Promise<any> {
  return apiFetch(`/api/approvals/${encodeURIComponent(id)}/reject`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });
}

export async function createApprovalRequest(data: {
  partyId?: string;
  type: string;
  title: string;
  description?: string;
  entityId?: string;
  entityType?: string;
  payload?: Record<string, any>;
  requestedByName?: string;
  requestedByRole?: string;
  requestedByMobile?: string;
}): Promise<any> {
  return apiFetch('/api/approvals', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
