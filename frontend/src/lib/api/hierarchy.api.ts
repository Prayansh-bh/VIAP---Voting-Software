import { apiFetch } from './client';

export interface HierarchyVillage {
  id: string;
  name: string;
  code: string;
  isPanchayat: boolean;
  totalVoters: number;
  mandalId: string;
  mandal?: {
    id: string;
    name: string;
    code: string;
    constituency?: {
      id: string;
      name: string;
      code: string;
    };
  };
  booths?: {
    id: string;
    boothNumber: string;
    name: string;
    totalVoters: number;
  }[];
}

export interface HierarchyBooth {
  id: string;
  boothNumber: string;
  code: string;
  name: string;
  pollingStation: string | null;
  totalVoters: number;
  villageId: string;
  village?: {
    id: string;
    name: string;
  };
  users?: {
    roleType: string;
    user: {
      id: string;
      name: string;
      mobileNumber: string;
      role: string;
    };
  }[];
}

export async function fetchHierarchyVillages(mandalId?: string): Promise<HierarchyVillage[]> {
  try {
    const url = mandalId ? `/api/hierarchy/villages?mandalId=${mandalId}` : '/api/hierarchy/villages';
    const res = await apiFetch<HierarchyVillage[]>(url);
    return Array.isArray(res) ? res : [];
  } catch (err) {
    console.warn('[Hierarchy API] Failed to fetch villages:', err);
    return [];
  }
}

export async function fetchHierarchyBooths(mandalId?: string, villageId?: string): Promise<HierarchyBooth[]> {
  try {
    const params = new URLSearchParams();
    if (mandalId) params.append('mandalId', mandalId);
    if (villageId) params.append('villageId', villageId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await apiFetch<HierarchyBooth[]>(`/api/hierarchy/booths${qs}`);
    return Array.isArray(res) ? res : [];
  } catch (err) {
    console.warn('[Hierarchy API] Failed to fetch booths:', err);
    return [];
  }
}
