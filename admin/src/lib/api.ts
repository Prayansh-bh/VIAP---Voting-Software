import { AppInstance, InchargeRecord, ApprovalRecord, AdminUser, ApplicationSummary } from '../types';
import { getAdminToken, setAdminToken, setAdminSession } from './auth';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAdminToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const contentType = res.headers.get('content-type');
  let data: any = null;
  if (contentType && contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  if (!res.ok) {
    const errorMsg = data?.error?.message || data?.error || data?.message || `Request failed with status ${res.status}`;
    throw new Error(errorMsg);
  }

  return (data?.data !== undefined ? data.data : data) as T;
}

// ── Admin Authentication (Real JWT via Backend) ──
export async function authenticateAdminRole(role: 'SUPER_ADMIN' | 'ORGANISER' = 'SUPER_ADMIN'): Promise<AdminUser> {
  const backendRole = role === 'ORGANISER' ? 'STATE_ADMIN' : 'SUPER_ADMIN';
  const res: any = await request('/auth/demo-login', {
    method: 'POST',
    body: JSON.stringify({
      role: backendRole,
      deviceId: 'cms-admin-console-session',
      deviceName: 'Platform CMS & Admin Console',
    }),
  });

  const token = res?.token;
  if (!token) {
    throw new Error('No JWT token returned from backend auth.');
  }

  setAdminToken(token);

  const u = res.user || {};
  const adminUser: AdminUser = {
    id: u.id || 'admin-super',
    name: u.name || (role === 'SUPER_ADMIN' ? 'State War Room Director' : 'Chief Party Organiser'),
    email: u.email || 'admin@politicalconnect.in',
    role: role,
    token: token,
  };

  setAdminSession(adminUser);
  return adminUser;
}

export async function authenticateAdminCredentials(mobileNumber: string, passcode?: string): Promise<AdminUser> {
  const res: any = await request('/auth/admin-login', {
    method: 'POST',
    body: JSON.stringify({
      mobileNumber,
      passcode,
      password: passcode,
      deviceId: `admin-device-${mobileNumber.replace(/\D/g, '').slice(-4) || 'master'}`,
      deviceName: `CMS Admin Terminal (${mobileNumber})`,
    }),
  });

  const token = res?.token;
  if (!token) {
    throw new Error('Authentication failed. No token returned.');
  }

  setAdminToken(token);

  const u = res.user || {};
  const adminUser: AdminUser = {
    id: u.id || 'admin-master',
    name: u.name || 'Party Super Admin',
    email: u.email || `${mobileNumber}@politicalconnect.in`,
    role: u.role || 'SUPER_ADMIN',
    token: token,
  };

  setAdminSession(adminUser);
  return adminUser;
}

// ── Applications (Multi-Party Engine) ──
export async function fetchApplications(): Promise<AppInstance[]> {
  try {
    const rawRes = await request<any>('/applications');
    const res = Array.isArray(rawRes) ? rawRes : rawRes ? [rawRes] : [];
    if (res.length > 0) {
      return res.map((c: any) => ({
        id: c.id,
        name: c.appName || c.organisationName || 'Party Connect',
        party: c.parties?.[0]?.name || c.organisationName || c.appName || 'Party Alliance',
        partyCode: c.activePartyCode || c.parties?.[0]?.code || 'APP',
        leaderName: c.candidateName || 'Party Leadership',
        jurisdiction: c.parliamentName ? `${c.parliamentName} (${c.constituenciesCount || 1} Constituencies)` : `${c.appName || 'Assembly'} (Segment)`,
        description: `Operational Tenant for ${c.appName || 'Party'}, ${c.stateName || 'Apex'}`,
        primaryColor: c.primaryColor || c.parties?.[0]?.primaryColor || '#F59E0B',
        secondaryColor: c.secondaryColor || '#DC2626',
        accentColor: c.accentColor || '#0F172A',
        totalVoters: typeof c.votersCount === 'number' ? c.votersCount : 0,
        turnoutPercent: typeof c.turnoutPercent === 'number' ? c.turnoutPercent : 0,
        isActive: true,
        isDefault: c.isDefault || false,
        createdAt: c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN') : 'Active',
        activeHierarchyLevels: c.activeHierarchyLevels || ['VOTER_GROUP', 'BOOTH', 'VILLAGE', 'MANDAL', 'CONSTITUENCY'],
      }));
    }
  } catch (err) {
    console.warn('Backend /applications offline or empty:', err);
  }

  return [];
}

// ── Live KPI Summary Rollup from PostgreSQL ──
export async function fetchApplicationSummary(appId: string = 'default'): Promise<ApplicationSummary | null> {
  try {
    const res = await request<ApplicationSummary>(`/applications/${appId}/summary`);
    return res;
  } catch (err) {
    console.warn('Backend /summary fetch note:', err);
    return null;
  }
}

export async function createApplication(formData: any): Promise<AppInstance> {
  const partyCode = (formData.partyCode || 'APP').trim().toUpperCase();
  const partyName = formData.party || formData.name;
  const appName = formData.name;
  const levels = formData.activeHierarchyLevels && formData.activeHierarchyLevels.length > 0
    ? formData.activeHierarchyLevels
    : ['VOTER_GROUP', 'BOOTH', 'VILLAGE', 'MANDAL', 'CONSTITUENCY'];

  const backendPayload = {
    appName,
    organisationName: partyName,
    headerTitle: appName,
    slogan: formData.description || `Platform tenant for ${appName}`,
    primaryColor: formData.primaryColor || '#F59E0B',
    secondaryColor: formData.secondaryColor || '#DC2626',
    accentColor: formData.accentColor || '#0F172A',
    activePartyCode: partyCode,
    appScope: 'SINGLE_MLA',
    stateName: formData.stateName || 'Andhra Pradesh',
    candidateName: formData.leaderName || 'Party Candidate',
    activeHierarchyLevels: levels,
    politicalParties: [
      {
        name: partyName,
        code: partyCode,
        shortName: partyCode,
        primaryColor: formData.primaryColor || '#F59E0B',
        secondaryColor: formData.secondaryColor || '#DC2626',
        accentColor: formData.accentColor || '#0F172A',
        isActive: true,
      },
    ],
    constituencies: [
      {
        name: formData.jurisdiction || appName,
        code: `AC-${partyCode}-01`,
        totalVoters: typeof formData.totalVoters === 'number' ? formData.totalVoters : 0,
        mlaName: formData.leaderName || 'Party Candidate',
      },
    ],
  };

  const res: any = await request('/cms/build-application', {
    method: 'POST',
    body: JSON.stringify(backendPayload),
  });

  const app = res?.application || res;
  return {
    id: app.id || app.appKey || `app-${Date.now()}`,
    name: app.appName || appName,
    party: partyName,
    partyCode: partyCode,
    leaderName: formData.leaderName || 'Party Candidate',
    jurisdiction: formData.jurisdiction || `${appName} Assembly`,
    description: formData.description || `Application for ${appName}`,
    primaryColor: app.primaryColor || formData.primaryColor || '#F59E0B',
    secondaryColor: app.secondaryColor || formData.secondaryColor || '#DC2626',
    accentColor: app.accentColor || formData.accentColor || '#0F172A',
    totalVoters: typeof app.totalVoters === 'number' ? app.totalVoters : 0,
    turnoutPercent: typeof app.turnoutPercent === 'number' ? app.turnoutPercent : 0,
    isActive: true,
    isDefault: false,
    createdAt: new Date().toLocaleDateString('en-IN'),
    activeHierarchyLevels: app.activeHierarchyLevels || levels,
  };
}

// ── Incharge Lifecycle & Management ──
export async function fetchIncharges(appId?: string): Promise<InchargeRecord[]> {
  try {
    const targetId = appId || 'default';
    const res = await request<any[]>(`/applications/${targetId}/incharges`);
    if (Array.isArray(res)) {
      return res.map((i) => ({
        id: i.id,
        name: i.name || i.userName || 'Party Cadre',
        phone: i.phone || i.mobileNumber || '9876543210',
        role: i.role || 'INCHARGE',
        level: i.level || i.jurisdictionType || 'BOOTH',
        jurisdiction: i.jurisdiction || i.jurisdictionName || i.unitName || 'Sector 1',
        status: i.status || (i.accountStatus === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'),
        assignedVoters: typeof i.assignedVoters === 'number' ? i.assignedVoters : 0,
        coverageRate: typeof i.coverageRate === 'number' ? i.coverageRate : 0,
        appointedAt: i.appointedAt || (i.assignedAt ? new Date(i.assignedAt).toLocaleDateString('en-IN') : 'Active'),
      }));
    }
  } catch (err) {
    console.warn('Backend incharges fetch failed:', err);
  }

  return [];
}

export async function transferIncharge(appId: string, id: string, targetJurisdiction: string, targetLevel: string): Promise<any> {
  return request(`/applications/${appId}/incharges/${id}/transfer`, {
    method: 'POST',
    body: JSON.stringify({ targetJurisdiction, targetLevel }),
  });
}

export async function replaceIncharge(appId: string, id: string, replacementName: string, replacementMobile: string, handoverNote?: string): Promise<any> {
  return request(`/applications/${appId}/incharges/${id}/replace`, {
    method: 'POST',
    body: JSON.stringify({ replacementName, replacementMobile, handoverNote }),
  });
}

export async function updateInchargeStatus(appId: string, id: string, status: string): Promise<any> {
  return request(`/applications/${appId}/incharges/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function resetInchargeCredentials(appId: string, id: string): Promise<any> {
  return request(`/applications/${appId}/incharges/${id}/reset-credentials`, {
    method: 'POST',
  });
}

// ── Approvals Engine ──
export async function fetchApprovals(params?: { type?: string; status?: string; search?: string }): Promise<ApprovalRecord[]> {
  try {
    const q = new URLSearchParams();
    if (params?.type && params.type !== 'ALL') q.set('type', params.type);
    if (params?.status && params.status !== 'ALL') q.set('status', params.status);
    if (params?.search) q.set('search', params.search);

    const res: any = await request(`/approvals?${q.toString()}`);
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.items)) return res.items;
  } catch (err) {
    console.warn('Backend /approvals failed:', err);
  }

  return [];
}

export async function approveRequest(id: string, reviewerNote?: string): Promise<any> {
  return request(`/approvals/${id}/approve`, {
    method: 'PATCH',
    body: JSON.stringify({ reviewerNote }),
  });
}

export async function rejectRequest(id: string, reason: string): Promise<any> {
  return request(`/approvals/${id}/reject`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });
}

// ── Data Ingestion & Live Voters ──
export async function fetchVotersList(params?: { limit?: number; page?: number; search?: string }): Promise<{ items: any[]; total: number }> {
  try {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.page) q.set('page', String(params.page));
    if (params?.search) q.set('search', params.search);

    const res: any = await request(`/voters?${q.toString()}`);
    const items = Array.isArray(res?.data) ? res.data : (Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []));
    const total = res?.meta?.total ?? items.length;
    return { items, total };
  } catch (err) {
    console.warn('Backend /voters fetch note:', err);
    return { items: [], total: 0 };
  }
}

export async function importVoterRolls(appId: string, payload: {
  rows: any[];
  fileName?: string;
  fileSize?: number;
  targetConstituencyId?: string;
  importMode?: 'APPEND' | 'REPLACE';
}): Promise<any> {
  return request(`/applications/${appId}/data/import`, {
    method: 'POST',
    body: JSON.stringify({
      level: 'VOTER',
      rows: payload.rows,
      fileName: payload.fileName || 'voter_roll.xlsx',
      fileSize: payload.fileSize || 0,
      targetConstituencyId: payload.targetConstituencyId,
      importMode: payload.importMode || 'APPEND',
    }),
  });
}

