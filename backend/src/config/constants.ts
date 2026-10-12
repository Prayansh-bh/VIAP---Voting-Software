import { OrgHierarchyLevel, RoleType } from '@prisma/client';

export const HIERARCHY_LEVEL_ORDER: OrgHierarchyLevel[] = [
  OrgHierarchyLevel.STATE,
  OrgHierarchyLevel.ZONE,
  OrgHierarchyLevel.PARLIAMENT,
  OrgHierarchyLevel.CONSTITUENCY,
  OrgHierarchyLevel.MANDAL,
  OrgHierarchyLevel.VILLAGE,
  OrgHierarchyLevel.BOOTH,
  OrgHierarchyLevel.VOTER_GROUP,
];

export const HIERARCHY_LEVEL_WEIGHT: Record<OrgHierarchyLevel, number> = {
  [OrgHierarchyLevel.STATE]: 8,
  [OrgHierarchyLevel.ZONE]: 7,
  [OrgHierarchyLevel.PARLIAMENT]: 6,
  [OrgHierarchyLevel.CONSTITUENCY]: 5,
  [OrgHierarchyLevel.MANDAL]: 4,
  [OrgHierarchyLevel.VILLAGE]: 3,
  [OrgHierarchyLevel.BOOTH]: 2,
  [OrgHierarchyLevel.VOTER_GROUP]: 1,
};

export const ROLE_HIERARCHY_MAP: Record<RoleType, OrgHierarchyLevel> = {
  [RoleType.SUPER_ADMIN]: OrgHierarchyLevel.STATE,
  [RoleType.HIGH_COMMAND]: OrgHierarchyLevel.STATE,
  [RoleType.STATE_ADMIN]: OrgHierarchyLevel.STATE,
  [RoleType.ZONE_INCHARGE]: OrgHierarchyLevel.ZONE,
  [RoleType.PARLIAMENT_INCHARGE]: OrgHierarchyLevel.PARLIAMENT,
  [RoleType.CONSTITUENCY_INCHARGE]: OrgHierarchyLevel.CONSTITUENCY,
  [RoleType.MANDAL_INCHARGE]: OrgHierarchyLevel.MANDAL,
  [RoleType.VILLAGE_INCHARGE]: OrgHierarchyLevel.VILLAGE,
  [RoleType.BOOTH_PRESIDENT]: OrgHierarchyLevel.BOOTH,
  [RoleType.BOOTH_INCHARGE]: OrgHierarchyLevel.BOOTH,
  [RoleType.VOTER_100_INCHARGE]: OrgHierarchyLevel.VOTER_GROUP,
  [RoleType.POLLING_AGENT]: OrgHierarchyLevel.BOOTH,
  [RoleType.VOLUNTEER]: OrgHierarchyLevel.VOTER_GROUP,
  [RoleType.VIEWER]: OrgHierarchyLevel.CONSTITUENCY,
};

export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 100;
