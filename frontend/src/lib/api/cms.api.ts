import { apiFetch } from './client';

export interface InchargeNode {
  id: string;
  name: string;
  code?: string;
  totalVoters?: number;
  incharge?: {
    id: string;
    userName: string;
    mobileNumber: string;
    role: string;
    accountStatus: string;
  } | null;
}

export interface InchargeHierarchyTree {
  constituency: InchargeNode;
  mandals: (InchargeNode & {
    villages: (InchargeNode & {
      booths: (InchargeNode & {
        boothNumber: string;
        voterGroups: InchargeNode[];
      })[];
    })[];
  })[];
}

export async function reassignInchargeApi(data: {
  unitLevel: string;
  unitId: string;
  currentUserId?: string;
  newUserName: string;
  newMobileNumber: string;
  reason?: string;
}): Promise<any> {
  return apiFetch('/api/cms/assign-incharge', {
    method: 'POST',
    body: JSON.stringify({
      unitLevel: data.unitLevel,
      unitId: data.unitId,
      userName: data.newUserName,
      mobileNumber: data.newMobileNumber,
      role: data.unitLevel === 'VOTER_GROUP' ? 'VOTER_100_INCHARGE' : `${data.unitLevel}_INCHARGE`,
    }),
  });
}

export async function bulkImportInchargesApi(data: {
  applicationId?: string;
  constituencyId?: string;
  level: string;
  rows: any[];
  validateOnly?: boolean;
}): Promise<any> {
  const res = await apiFetch<any>('/api/cms/incharges/bulk-import', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data || res;
}

export async function fetchInchargeTemplateApi(level: string): Promise<any> {
  const res = await apiFetch<any>(`/api/cms/incharges/template?level=${encodeURIComponent(level)}`);
  return res.data || res;
}

export async function deactivateInchargeApi(userId: string, reason?: string): Promise<any> {
  const res = await apiFetch<any>('/api/cms/incharges/deactivate', {
    method: 'POST',
    body: JSON.stringify({ userId, reason }),
  });
  return res.data || res;
}

export async function searchInchargeUsersApi(query: string): Promise<any[]> {
  const res = await apiFetch<any>(`/api/cms/incharges/users/search?q=${encodeURIComponent(query)}`);
  return res.data || res || [];
}

export async function transferInchargeApi(data: {
  userId: string;
  fromUnitLevel?: string;
  fromUnitId?: string;
  toUnitLevel: string;
  toUnitId: string;
  reason?: string;
}): Promise<any> {
  const res = await apiFetch<any>('/api/cms/incharges/transfer', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data || res;
}

export async function replaceInchargeApi(data: {
  currentUserId?: string;
  unitLevel: string;
  unitId: string;
  newUserName: string;
  newMobileNumber: string;
  newUserId?: string;
  reason?: string;
}): Promise<any> {
  const res = await apiFetch<any>('/api/cms/incharges/replace', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data || res;
}

export async function fetchInchargeHistoryApi(): Promise<any[]> {
  const res = await apiFetch<any>('/api/cms/incharges/history');
  return res.data || res || [];
}

export async function fetchInchargesHierarchy(constituencyId?: string): Promise<InchargeHierarchyTree> {
  const endpoint = constituencyId ? `/api/cms/incharges?constituencyId=${encodeURIComponent(constituencyId)}` : '/api/cms/incharges';
  const res = await apiFetch<{ success: boolean; data: InchargeHierarchyTree }>(endpoint);
  return res.data;
}

export async function assignIncharge(data: {
  unitLevel: 'STATE' | 'ZONE' | 'PARLIAMENT' | 'CONSTITUENCY' | 'MANDAL' | 'VILLAGE' | 'BOOTH' | 'VOTER_GROUP';
  unitId: string;
  role: string;
  userName: string;
  mobileNumber: string;
  email?: string;
}): Promise<any> {
  return apiFetch('/api/cms/assign-incharge', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchCmsApplications(): Promise<any[]> {
  return apiFetch('/api/cms/applications');
}

export async function switchCmsApplication(configKey: string): Promise<any> {
  return apiFetch(`/api/cms/applications/switch/${encodeURIComponent(configKey)}`, {
    method: 'POST',
  });
}

export async function fetchCmsVersions(): Promise<any[]> {
  return apiFetch('/api/cms/versions');
}

export async function createCmsVersionSnapshot(data: { versionName: string; changeSummary: string }): Promise<any> {
  return apiFetch('/api/cms/versions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchCmsRolesPermissions(): Promise<any[]> {
  return apiFetch('/api/cms/roles-permissions');
}

export async function fetchCmsGeography(): Promise<any[]> {
  return apiFetch('/api/cms/geography');
}

export async function createCmsGeographyUnit(data: {
  level: 'STATE' | 'ZONE' | 'PARLIAMENT' | 'CONSTITUENCY' | 'MANDAL';
  name: string;
  code?: string;
  parentId?: string;
  totalVoters?: number;
}): Promise<any> {
  return apiFetch('/api/cms/geography/unit', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function validateExcelMapping(columnMapping: Record<string, string>, sampleRows: any[]): Promise<any> {
  return apiFetch('/api/cms/validate-excel-mapping', {
    method: 'POST',
    body: JSON.stringify({ columnMapping, sampleRows }),
  });
}

export async function fetchCmsParties(): Promise<any[]> {
  return apiFetch('/api/cms/parties');
}

export async function createCmsParty(data: {
  name: string;
  code: string;
  shortName: string;
  primaryColor: string;
  secondaryColor?: string;
  accentColor?: string;
  symbolName?: string;
  lifecycleStatus?: 'DRAFT' | 'PUBLISHED' | 'LOCKED';
}): Promise<any> {
  return apiFetch('/api/cms/parties', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function publishCmsParty(partyId: string): Promise<any> {
  return apiFetch(`/api/cms/parties/${encodeURIComponent(partyId)}/publish`, {
    method: 'POST',
  });
}

export async function deleteCmsParty(partyId: string): Promise<any> {
  return apiFetch(`/api/cms/parties/${encodeURIComponent(partyId)}`, {
    method: 'DELETE',
  });
}
