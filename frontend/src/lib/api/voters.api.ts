import { SurveyStatus, Voter, VoterPreference, VoterStatus } from '../../types';
import { apiFetch, apiFetchWithMeta } from './client';

export interface VoterQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  constituencyId?: string;
  mandalId?: string;
  villageId?: string;
  boothId?: string;
  voterGroupId?: string;
  unitId?: string;
  voterStatus?: string;
  surveyStatus?: string;
  voteStatus?: string;
  voterLocationStatus?: string;
  politicalPreference?: string;
  caste?: string;
  assignedInchargeId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedVotersResponse {
  items: Voter[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export function normalizeVoter(v: any): Voter {
  return {
    id: String(v.id || ''),
    serialNumber: Number(v.serialNumber || 0),
    epicNumber: String(v.epicNumber || ''),
    name: String(v.name || ''),
    fatherHusbandName: String(v.fatherHusbandName || ''),
    relationType: v.relationType || 'Other',
    houseNumber: String(v.houseNumber || ''),
    age: Number(v.age || 18),
    gender: v.gender || 'Other',
    mobileNumber: String(v.mobileNumber || ''),
    assemblyConstituency: typeof v.constituency === 'object' ? String(v.constituency?.name || '') : String(v.constituency || ''),
    mandal: typeof v.mandal === 'object' ? String(v.mandal?.name || '') : String(v.mandal || ''),
    village: typeof v.village === 'object' ? String(v.village?.name || '') : String(v.village || ''),
    boothNumber: typeof v.booth === 'object' ? String(v.booth?.boothNumber || v.booth?.name || '') : String(v.boothNumber || ''),
    assignedVoterGroup: typeof v.voterGroup === 'object' ? String(v.voterGroup?.name || '') : String(v.assignedVoterGroup || ''),
    assignedInchargeId: String(v.assignedInchargeId || ''),
    politicalPreference: (v.politicalPreference || 'Neutral') as VoterPreference,
    voterStatus: (v.voterStatus || 'Active') as VoterStatus,
    surveyStatus: (v.surveyStatus || 'Surveyed') as SurveyStatus,
    notes: String(v.notes || ''),
    lastUpdated: v.updatedAt ? new Date(v.updatedAt).toISOString().split('T')[0] : (v.lastUpdated || ''),
    updatedBy: String(v.updatedBy || ''),
    caste: typeof v.voterCaste === 'object' ? String(v.voterCaste?.name || v.caste || '') : String(v.caste || ''),
    subCaste: typeof v.voterCaste === 'object' ? String(v.voterCaste?.name || v.subCaste || '') : String(v.subCaste || ''),
    profession: String(v.profession || ''),
    voterLocationStatus: v.locationStatus === 'MIGRATED' || v.voterLocationStatus === 'Migrated' ? 'Migrated' : 'Local',
    currentLocation: String(v.currentLocation || v.migrationCity || 'Local'),
    voteStatus: v.voteStatus === 'VOTE_DONE' || v.voteStatus === 'VOTE DONE' ? 'VOTE DONE' : 'NOT VOTED',
    voteDoneTime: v.voteDoneAt || v.voteDoneTime,
    inchargeAssessment: v.inchargeAssessment || v.politicalPreference || 'Unknown',
  };
}

export async function fetchVoters(params: VoterQueryParams = {}): Promise<PaginatedVotersResponse> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      searchParams.set(key, String(val));
    }
  });

  const queryString = searchParams.toString();
  const endpoint = `/api/voters${queryString ? `?${queryString}` : ''}`;

  try {
    const envelope = await apiFetchWithMeta<any[]>(endpoint);
    const rawList = Array.isArray(envelope.data)
      ? envelope.data
      : (Array.isArray((envelope.data as any)?.items) ? (envelope.data as any).items : []);
    const meta = envelope.meta || (envelope.data as any)?.__meta;

    const total = typeof meta?.total === 'number' ? meta.total : rawList.length;
    const limit = typeof meta?.limit === 'number' ? meta.limit : (params.limit || 50);
    const page = typeof meta?.page === 'number' ? meta.page : (params.page || 1);
    const totalPages = typeof meta?.totalPages === 'number'
      ? meta.totalPages
      : (total > 0 ? Math.ceil(total / limit) : 1);

    return {
      items: rawList.map(normalizeVoter),
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  } catch (err) {
    console.warn('[Voters API] Error fetching voters from DB:', err);
  }

  return {
    items: [],
    total: 0,
    page: params.page || 1,
    limit: params.limit || 50,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  };
}

export async function fetchVotersForIncharge(userId: string, params: Omit<VoterQueryParams, 'assignedInchargeId'> = {}): Promise<Voter[]> {
  try {
    const res = await fetchVoters({ ...params, assignedInchargeId: userId, limit: params.limit || 100 });
    const items = res.items;
    (items as any).pagination = res;
    return items;
  } catch {
    return [];
  }
}

export async function fetchVotersForUnit(
  unitId: string,
  params: Omit<VoterQueryParams, 'unitId'> = {}
): Promise<Voter[]> {
  const res = await fetchVoters({ ...params, unitId, limit: params.limit || 50 });
  const items = res.items;
  (items as any).pagination = res;
  return items;
}

export async function fetchPaginatedVotersForUnit(
  unitId: string,
  params: Omit<VoterQueryParams, 'unitId'> = {}
): Promise<PaginatedVotersResponse> {
  return fetchVoters({ ...params, unitId });
}

export async function syncVoter(voter: Partial<Voter> & { id: string }, _userId?: string): Promise<Voter> {
  return updateVoter(voter.id, voter);
}

export async function getVoterById(id: string): Promise<Voter> {
  return apiFetch<Voter>(`/api/voters/${id}`);
}

export async function createVoter(data: Partial<Voter>): Promise<Voter> {
  return apiFetch<Voter>('/api/voters', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateVoter(id: string, data: Partial<Voter>): Promise<Voter> {
  return apiFetch<Voter>(`/api/voters/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function markVoteDone(id: string): Promise<Voter> {
  return apiFetch<Voter>(`/api/voters/${id}/mark-vote-done`, {
    method: 'POST',
  });
}

export async function markNotVoted(id: string): Promise<Voter> {
  return apiFetch<Voter>(`/api/voters/${id}/mark-not-voted`, {
    method: 'POST',
  });
}

export async function flagFakeVoter(id: string, reason: string, evidenceUrl?: string): Promise<any> {
  return apiFetch(`/api/voters/${id}/flag-fake`, {
    method: 'POST',
    body: JSON.stringify({ reason, evidenceUrl }),
  });
}

export async function updateVoterMigration(id: string, data: any): Promise<any> {
  return apiFetch(`/api/voters/${id}/migration`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function bulkImportVoters(
  constituencyId: string,
  rows: any[],
  options?: { validateOnly?: boolean; importMode?: 'APPEND' | 'REPLACE'; voterGroupSize?: number },
): Promise<{
  success: boolean;
  constituencyName?: string;
  totalProcessed?: number;
  newVotersAdded?: number;
  votersUpdated?: number;
  mandalsCreated?: number;
  villagesCreated?: number;
  boothsCreated?: number;
  voterGroupsCreated?: number;
  totalRows?: number;
  validRows?: number;
  invalidRows?: number;
  duplicateEpicsCount?: number;
  missingRequiredCount?: number;
  errors?: any[];
  sampleValidRows?: any[];
}> {
  const res = await apiFetch<any>('/api/voters/bulk-import', {
    method: 'POST',
    body: JSON.stringify({
      constituencyId,
      rows,
      validateOnly: options?.validateOnly,
      importMode: options?.importMode,
      voterGroupSize: options?.voterGroupSize,
    }),
  });
  return res.data || res;
}
