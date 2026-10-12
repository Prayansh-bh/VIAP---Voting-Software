import { OrgHierarchyLevel, RoleType } from '@prisma/client';

export interface AuthenticatedUserPayload {
  userId: string;
  userCode: string;
  mobileNumber: string;
  role: RoleType;
  organisationId?: string | null;
  unitId?: string | null;
  assignedStateId?: string | null;
  assignedZoneId?: string | null;
  assignedParliamentId?: string | null;
  assignedConstituencyId?: string | null;
  assignedMandalId?: string | null;
  assignedVillageId?: string | null;
  assignedBoothId?: string | null;
  assignedVoterGroupId?: string | null;
}

export interface UserHierarchyScope {
  userId: string;
  role: RoleType;
  organisationId: string | null;
  maxLevel: OrgHierarchyLevel;
  isGlobalScope: boolean;
  isReadOnly: boolean;
  accessibleUnitIds: Set<string>;
  accessibleStateIds: Set<string>;
  accessibleZoneIds: Set<string>;
  accessibleParliamentIds: Set<string>;
  accessibleConstituencyIds: Set<string>;
  accessibleMandalIds: Set<string>;
  accessibleVillageIds: Set<string>;
  accessibleBoothIds: Set<string>;
  accessibleVoterGroupIds: Set<string>;
  stateId?: string | null;
  zoneId?: string | null;
  parliamentId?: string | null;
  constituencyId?: string | null;
  mandalId?: string | null;
  villageId?: string | null;
  boothId?: string | null;
  voterGroupId?: string | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUserPayload;
    hierarchyScope?: UserHierarchyScope;
  }
}
