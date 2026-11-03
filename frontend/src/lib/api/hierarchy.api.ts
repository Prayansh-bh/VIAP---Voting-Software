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

export async function fetchStates(): Promise<any[]> {
  try {
    const res = await apiFetch<any[]>('/api/states');
    return Array.isArray(res) ? res : [];
  } catch (err) {
    console.warn('[Hierarchy API] Failed to fetch states:', err);
    return [];
  }
}

export async function fetchZones(stateId?: string): Promise<any[]> {
  try {
    const url = stateId ? `/api/zones?stateId=${encodeURIComponent(stateId)}` : '/api/zones';
    const res = await apiFetch<any[]>(url);
    return Array.isArray(res) ? res : [];
  } catch (err) {
    console.warn('[Hierarchy API] Failed to fetch zones:', err);
    return [];
  }
}

export async function fetchParliaments(zoneId?: string): Promise<any[]> {
  try {
    const url = zoneId ? `/api/parliaments?zoneId=${encodeURIComponent(zoneId)}` : '/api/parliaments';
    const res = await apiFetch<any[]>(url);
    return Array.isArray(res) ? res : [];
  } catch (err) {
    console.warn('[Hierarchy API] Failed to fetch parliaments:', err);
    return [];
  }
}

export async function fetchConstituencies(parliamentId?: string): Promise<any[]> {
  try {
    const url = parliamentId ? `/api/constituencies?parliamentId=${encodeURIComponent(parliamentId)}` : '/api/constituencies';
    const res = await apiFetch<any[]>(url);
    return Array.isArray(res) ? res : [];
  } catch (err) {
    console.warn('[Hierarchy API] Failed to fetch constituencies:', err);
    return [];
  }
}

export async function fetchMandals(constituencyId?: string): Promise<any[]> {
  try {
    const url = constituencyId ? `/api/mandals?constituencyId=${encodeURIComponent(constituencyId)}` : '/api/mandals';
    const res = await apiFetch<any[]>(url);
    return Array.isArray(res) ? res : [];
  } catch (err) {
    console.warn('[Hierarchy API] Failed to fetch mandals:', err);
    return [];
  }
}

export async function fetchHierarchyVillages(mandalId?: string): Promise<HierarchyVillage[]> {
  try {
    const url = mandalId ? `/api/villages?mandalId=${encodeURIComponent(mandalId)}` : '/api/villages';
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
    const res = await apiFetch<HierarchyBooth[]>(`/api/booths${qs}`);
    return Array.isArray(res) ? res : [];
  } catch (err) {
    console.warn('[Hierarchy API] Failed to fetch booths:', err);
    return [];
  }
}
