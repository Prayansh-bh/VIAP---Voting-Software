export type HierarchyLevelKey =
  | 'STATE'
  | 'ZONE'
  | 'PARLIAMENT'
  | 'DISTRICT'
  | 'CONSTITUENCY'
  | 'MANDAL'
  | 'VILLAGE'
  | 'BOOTH'
  | 'VOTER_GROUP';

export type VoterPreference = 'TDP' | 'YSRCP' | 'JSP' | 'BJP' | 'INC' | 'Neutral' | 'OTH';

export interface HierarchyTierConfig {
  id: HierarchyLevelKey;
  label: string;
  scope: string;
  count: number;
  description: string;
  badge: string;
}

export interface AppInstance {
  id: string;
  name: string;
  party: string;
  partyCode: string;
  leaderName: string;
  jurisdiction: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  totalVoters: number;
  turnoutPercent: number;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  activeHierarchyLevels?: HierarchyLevelKey[];
}

export interface InchargeRecord {
  id: string;
  name: string;
  phone: string;
  role: string;
  level: HierarchyLevelKey;
  jurisdiction: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  assignedVoters: number;
  coverageRate: number;
  appointedAt: string;
}

export interface ApprovalRecord {
  id: string;
  type: 'USER_REGISTRATION' | 'INCHARGE_REQUEST' | 'DATA_CORRECTION' | 'SURVEY_APPROVAL' | 'TRANSFER_REQUEST';
  title: string;
  applicantName: string;
  applicantPhone: string;
  jurisdiction: string;
  requestedRole?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedAt: string;
  details: Record<string, any>;
  reviewerNote?: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ORGANISER' | 'SYSTEM_ADMIN';
  token?: string;
}

export interface ApplicationSummary {
  applicationId: string;
  appName: string;
  stateName: string;
  totalVoters: number;
  verifiedCount: number;
  verificationRate: number;
  totalBooths: number;
  totalGroups: number;
  totalIncharges: number;
  totalTasks: number;
  totalMandals?: number;
  totalConstituencies?: number;
}
