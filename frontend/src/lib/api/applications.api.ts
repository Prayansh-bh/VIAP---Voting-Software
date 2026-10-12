import { apiFetch } from './client';

export interface ApplicationHierarchy {
  applicationId: string;
  configKey: string;
  appName: string;
  appScope: string;
  activeHierarchyLevels: string[];
  hierarchyLabels: Record<string, string>;
  state: any;
  constituencies: any[];
}

export interface ApplicationConfig {
  id: string;
  configKey: string;
  appName: string;
  stateName: string;
  parliamentName?: string;
  appScope: string;
  defaultLanguage: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl?: string;
  hierarchyLabels: Record<string, string>;
  activeHierarchyLevels: string[];
  featureToggles: Record<string, boolean>;
  aiEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConstituencyItem {
  id: string;
  name: string;
  code: string;
  constituencyNumber?: number | null;
  stateName: string;
  zoneName: string;
  parliamentName: string;
  mandalsCount: number;
  villagesCount: number;
  boothsCount: number;
  totalVoters: number;
  lastImported?: string | null;
  importStatus: string;
  importedRecords: number;
}

export interface ValidationReport {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateCount: number;
  warningsCount: number;
  errors: {
    rowNumber: number;
    field: string;
    value?: any;
    message: string;
    suggestion: string;
    severity?: 'ERROR' | 'WARNING';
  }[];
  preview: {
    rowNumber: number;
    state: string;
    parliament: string;
    constituency: string;
    mandal: string;
    village: string;
    booth: string;
    voterGroup: string;
    epicNumber: string;
    name: string;
    status: 'VALID' | 'WARNING' | 'ERROR';
    reason?: string;
  }[];
}

export interface ImportSummary {
  importId?: string;
  jobId?: string;
  status: string;
  applicationName?: string;
  targetConstituency?: string;
  targetConstituencyId?: string;
  totalRows: number;
  totalRecords?: number;
  successCount: number;
  importedCount?: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  failedCount?: number;
  boothsCount?: number;
  voterGroupsCount?: number;
  errors: any[];
}

export interface DataImportRecord {
  id: string;
  applicationId?: string;
  applicationName: string;
  stateName: string;
  zoneName: string;
  parliamentName: string;
  constituencyName: string;
  constituencyId?: string;
  fileName: string;
  fileSize?: number;
  mode: string;
  status: string;
  totalRecords: number;
  validRecords: number;
  importedRecords: number;
  updatedRecords: number;
  skippedRecords: number;
  failedRecords: number;
  boothsCount: number;
  voterGroupsCount: number;
  uploadedBy: string;
  uploadedByMobile?: string;
  createdAt: string;
  completedAt?: string;
}

export interface InchargeRecord {
  id: string;
  userId: string;
  userName: string;
  mobileNumber: string;
  email?: string;
  role: string;
  inchargeType: string;
  jurisdictionType: string;
  jurisdictionName: string;
  parentJurisdiction: string;
  status: 'ACTIVE' | 'INACTIVE';
  assignedAt: string;
  details: {
    stateId?: string;
    zoneId?: string;
    parliamentId?: string;
    constituencyId?: string;
    mandalId?: string;
    villageId?: string;
    boothId?: string;
    voterGroupId?: string;
  };
}

export interface ApplicationSummaryKpis {
  applicationId: string;
  appName: string;
  stateName: string;
  totalVoters: number;
  totalBooths: number;
  totalGroups: number;
  totalIncharges: number;
  totalTasks: number;
  verifiedCount: number;
  verificationRate: number;
}

export async function fetchCmsApplications(): Promise<any[]> {
  const res = await apiFetch<any>('/api/applications');
  return res.data || res || [];
}

export async function fetchApplicationConfig(appId: string): Promise<ApplicationConfig> {
  const res = await apiFetch<any>(`/api/applications/${encodeURIComponent(appId)}/configuration`);
  return res.data || res;
}

export async function fetchApplicationHierarchy(appId: string): Promise<ApplicationHierarchy> {
  const res = await apiFetch<any>(`/api/applications/${encodeURIComponent(appId)}/hierarchy`);
  return res.data || res;
}

export async function fetchHierarchyNodes(
  appId: string,
  level: string,
  parentId?: string,
): Promise<any[]> {
  const qs = parentId ? `?parentId=${encodeURIComponent(parentId)}` : '';
  const res = await apiFetch<any>(
    `/api/applications/${encodeURIComponent(appId)}/hierarchy/${encodeURIComponent(level)}${qs}`,
  );
  return res.data || res || [];
}

export async function fetchApplicationConstituencies(
  appId: string,
  scopeFilters?: { stateId?: string; zoneId?: string; parliamentId?: string },
): Promise<ConstituencyItem[]> {
  const params = new URLSearchParams();
  if (scopeFilters?.stateId) params.append('stateId', scopeFilters.stateId);
  if (scopeFilters?.zoneId) params.append('zoneId', scopeFilters.zoneId);
  if (scopeFilters?.parliamentId) params.append('parliamentId', scopeFilters.parliamentId);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await apiFetch<any>(`/api/applications/${encodeURIComponent(appId)}/constituencies${qs}`);
  return res.data || res || [];
}

export async function fetchColumnMappingSuggestions(
  appId: string,
  headers: string[],
): Promise<{ suggestions: Record<string, string>; unmapped: string[]; systemFields: Array<{ key: string; label: string; required: boolean; description: string }> }> {
  const res = await apiFetch<any>(`/api/applications/${encodeURIComponent(appId)}/data/mapping`, {
    method: 'POST',
    body: JSON.stringify({ headers }),
  });
  return res.data || res;
}

export async function validateApplicationData(
  appId: string,
  level: string,
  rows: any[],
  options?: {
    targetConstituencyId?: string;
    columnMapping?: Record<string, string>;
    fileName?: string;
  },
): Promise<ValidationReport> {
  const res = await apiFetch<any>(`/api/applications/${encodeURIComponent(appId)}/data/validate`, {
    method: 'POST',
    body: JSON.stringify({
      level,
      rows,
      targetConstituencyId: options?.targetConstituencyId,
      columnMapping: options?.columnMapping,
      fileName: options?.fileName,
    }),
  });
  return res.data || res;
}

export async function importApplicationData(
  appId: string,
  payload: {
    level: string;
    rows: any[];
    targetConstituencyId?: string;
    columnMapping?: Record<string, string>;
    importMode?: 'APPEND' | 'REPLACE';
    voterGroupSize?: number;
    fileName?: string;
    fileSize?: number;
  },
): Promise<ImportSummary> {
  const res = await apiFetch<any>(`/api/applications/${encodeURIComponent(appId)}/data/import`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data || res;
}

export async function fetchDataImports(
  appId: string,
  params?: {
    status?: string;
    constituencyId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  },
): Promise<{ items: DataImportRecord[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> {
  const qs = new URLSearchParams();
  if (params?.status) qs.append('status', params.status);
  if (params?.constituencyId) qs.append('constituencyId', params.constituencyId);
  if (params?.startDate) qs.append('startDate', params.startDate);
  if (params?.endDate) qs.append('endDate', params.endDate);
  if (params?.page) qs.append('page', String(params.page));
  if (params?.limit) qs.append('limit', String(params.limit));

  const queryStr = qs.toString() ? `?${qs.toString()}` : '';
  const res = await apiFetch<any>(`/api/applications/${encodeURIComponent(appId)}/data/imports${queryStr}`);
  return res.data || res || { items: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0 } };
}

export async function fetchDataImportById(appId: string, importId: string): Promise<any> {
  const res = await apiFetch<any>(`/api/applications/${encodeURIComponent(appId)}/data/imports/${encodeURIComponent(importId)}`);
  return res.data || res;
}

export async function fetchDataImportErrors(importId: string): Promise<any[]> {
  const res = await apiFetch<any>(`/api/applications/data/errors/${encodeURIComponent(importId)}`);
  return res.data || res || [];
}

export async function fetchImportHistory(appId: string): Promise<any[]> {
  const data = await fetchDataImports(appId, { limit: 20 });
  return data.items || [];
}

export async function fetchImportErrors(jobId: string): Promise<any> {
  return fetchDataImportErrors(jobId);
}

export async function fetchApplicationIncharges(
  appId: string,
  level?: string,
  jurisdictionId?: string,
): Promise<InchargeRecord[]> {
  const params = new URLSearchParams();
  if (level) params.append('level', level);
  if (jurisdictionId) params.append('jurisdictionId', jurisdictionId);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await apiFetch<any>(
    `/api/applications/${encodeURIComponent(appId)}/incharges${qs}`,
  );
  return res.data || res || [];
}

export async function assignApplicationIncharge(
  appId: string,
  payload: {
    userId?: string;
    name?: string;
    mobileNumber?: string;
    email?: string;
    role: string;
    unitLevel: string;
    unitId: string;
    parentUnitId?: string;
    reason?: string;
  },
): Promise<any> {
  const res = await apiFetch<any>(`/api/applications/${encodeURIComponent(appId)}/incharges`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data || res;
}

export async function deleteApplicationIncharge(
  appId: string,
  inchargeId: string,
): Promise<any> {
  const res = await apiFetch<any>(
    `/api/applications/${encodeURIComponent(appId)}/incharges/${encodeURIComponent(inchargeId)}`,
    {
      method: 'DELETE',
    },
  );
  return res.data || res;
}

export async function transferApplicationIncharge(
  appId: string,
  inchargeId: string,
  payload: { targetUnitLevel: string; targetUnitId: string; reason?: string },
): Promise<any> {
  const res = await apiFetch<any>(
    `/api/applications/${encodeURIComponent(appId)}/incharges/${encodeURIComponent(inchargeId)}/transfer`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return res.data || res;
}

export async function replaceApplicationIncharge(
  appId: string,
  inchargeId: string,
  payload: { name: string; mobileNumber: string; email?: string; reason?: string },
): Promise<any> {
  const res = await apiFetch<any>(
    `/api/applications/${encodeURIComponent(appId)}/incharges/${encodeURIComponent(inchargeId)}/replace`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return res.data || res;
}

export async function updateInchargeStatusApi(
  appId: string,
  inchargeId: string,
  isActive: boolean,
): Promise<any> {
  const res = await apiFetch<any>(
    `/api/applications/${encodeURIComponent(appId)}/incharges/${encodeURIComponent(inchargeId)}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    },
  );
  return res.data || res;
}

export async function resetInchargeCredentialsApi(
  appId: string,
  inchargeId: string,
): Promise<any> {
  const res = await apiFetch<any>(
    `/api/applications/${encodeURIComponent(appId)}/incharges/${encodeURIComponent(inchargeId)}/reset-credentials`,
    {
      method: 'POST',
    },
  );
  return res.data || res;
}

export async function fetchInchargePerformanceApi(appId: string): Promise<any> {
  const res = await apiFetch<any>(
    `/api/applications/${encodeURIComponent(appId)}/incharges/performance`,
  );
  return res.data || res;
}

export async function fetchApplicationSummary(appId: string): Promise<ApplicationSummaryKpis> {
  const res = await apiFetch<any>(`/api/applications/${encodeURIComponent(appId)}/reports/summary`);
  return res.data || res;
}
