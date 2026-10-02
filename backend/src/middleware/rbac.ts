import { FastifyReply, FastifyRequest } from 'fastify';
import { OrgHierarchyLevel, RoleType } from '@prisma/client';
import { HIERARCHY_LEVEL_WEIGHT, ROLE_HIERARCHY_MAP } from '../config/constants.js';
import { errorResponse } from '../common/response.js';
import { prisma } from '../lib/prisma.js';
import { UserHierarchyScope } from '../common/types.js';

export const ROLE_RANK_WEIGHT: Record<RoleType, number> = {
  [RoleType.SUPER_ADMIN]: 100,
  [RoleType.HIGH_COMMAND]: 90,
  [RoleType.STATE_ADMIN]: 80,
  [RoleType.ZONE_INCHARGE]: 70,
  [RoleType.PARLIAMENT_INCHARGE]: 60,
  [RoleType.CONSTITUENCY_INCHARGE]: 50,
  [RoleType.MANDAL_INCHARGE]: 40,
  [RoleType.VILLAGE_INCHARGE]: 30,
  [RoleType.BOOTH_PRESIDENT]: 20,
  [RoleType.BOOTH_INCHARGE]: 20,
  [RoleType.VOTER_100_INCHARGE]: 10,
  [RoleType.POLLING_AGENT]: 10,
  [RoleType.VOLUNTEER]: 5,
  [RoleType.VIEWER]: 1,
};

/**
 * Enforce minimum role rank or specific allowed roles
 */
export function requireRoles(...allowedRoles: RoleType[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.user) {
      return reply.status(401).send(errorResponse('Authentication required.', 'UNAUTHORIZED'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return reply.status(403).send(errorResponse('Insufficient role permissions for this operation.', 'FORBIDDEN_ROLE'));
    }
  };
}

/**
 * Guard for Super Administrator exclusively
 */
export function requireSuperAdmin() {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.user) {
      return reply.status(401).send(errorResponse('Authentication required.', 'UNAUTHORIZED'));
    }

    if (req.user.role !== RoleType.SUPER_ADMIN) {
      return reply.status(403).send(errorResponse('Access restricted to Super Administrators only.', 'SUPER_ADMIN_REQUIRED'));
    }
  };
}

/**
 * Rejects mutation actions for read-only roles like VIEWER
 */
export function requireNotReadOnly() {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.user?.role === RoleType.VIEWER) {
      return reply.status(403).send(errorResponse('Read-only accounts cannot modify or create records.', 'READ_ONLY_ACCESS'));
    }
  };
}

/**
 * Computes full hierarchical subtree and relational scope for a user
 */
export async function computeUserHierarchyScope(userId: string): Promise<UserHierarchyScope> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      organisation: true,
      unit: true,
      hierarchyAssignments: {
        where: { isActive: true },
        include: {
          state: true,
          zone: true,
          parliament: true,
          constituency: true,
          mandal: true,
          village: true,
          booth: true,
          voterGroup: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const role = user.role;
  const isGlobalScope = role === RoleType.SUPER_ADMIN;
  const isReadOnly = role === RoleType.VIEWER;
  const maxLevel = ROLE_HIERARCHY_MAP[role] || OrgHierarchyLevel.VOTER_GROUP;

  const accessibleUnitIds = new Set<string>();
  const accessibleStateIds = new Set<string>();
  const accessibleZoneIds = new Set<string>();
  const accessibleParliamentIds = new Set<string>();
  const accessibleConstituencyIds = new Set<string>();
  const accessibleMandalIds = new Set<string>();
  const accessibleVillageIds = new Set<string>();
  const accessibleBoothIds = new Set<string>();
  const accessibleVoterGroupIds = new Set<string>();

  // If Super Admin, grant all nodes
  if (isGlobalScope) {
    const [units, states, zones, parliaments, constituencies, mandals, villages, booths, voterGroups] = await Promise.all([
      prisma.organizationUnit.findMany({ select: { id: true } }),
      prisma.state.findMany({ select: { id: true } }),
      prisma.zone.findMany({ select: { id: true } }),
      prisma.parliament.findMany({ select: { id: true } }),
      prisma.constituency.findMany({ select: { id: true } }),
      prisma.mandal.findMany({ select: { id: true } }),
      prisma.village.findMany({ select: { id: true } }),
      prisma.booth.findMany({ select: { id: true } }),
      prisma.voterGroup.findMany({ select: { id: true } }),
    ]);

    units.forEach((u) => accessibleUnitIds.add(u.id));
    states.forEach((s) => accessibleStateIds.add(s.id));
    zones.forEach((z) => accessibleZoneIds.add(z.id));
    parliaments.forEach((p) => accessibleParliamentIds.add(p.id));
    constituencies.forEach((c) => accessibleConstituencyIds.add(c.id));
    mandals.forEach((m) => accessibleMandalIds.add(m.id));
    villages.forEach((v) => accessibleVillageIds.add(v.id));
    booths.forEach((b) => accessibleBoothIds.add(b.id));
    voterGroups.forEach((vg) => accessibleVoterGroupIds.add(vg.id));

    return {
      userId: user.id,
      role,
      organisationId: user.organisationId,
      maxLevel,
      isGlobalScope: true,
      isReadOnly: false,
      accessibleUnitIds,
      accessibleStateIds,
      accessibleZoneIds,
      accessibleParliamentIds,
      accessibleConstituencyIds,
      accessibleMandalIds,
      accessibleVillageIds,
      accessibleBoothIds,
      accessibleVoterGroupIds,
    };
  }

  // Traverse tree for assigned hierarchy node
  const assignment = user.hierarchyAssignments[0];

  if (assignment) {
    if (assignment.stateId) accessibleStateIds.add(assignment.stateId);
    if (assignment.zoneId) accessibleZoneIds.add(assignment.zoneId);
    if (assignment.parliamentId) accessibleParliamentIds.add(assignment.parliamentId);
    if (assignment.constituencyId) accessibleConstituencyIds.add(assignment.constituencyId);
    if (assignment.mandalId) accessibleMandalIds.add(assignment.mandalId);
    if (assignment.villageId) accessibleVillageIds.add(assignment.villageId);
    if (assignment.boothId) accessibleBoothIds.add(assignment.boothId);
    if (assignment.voterGroupId) accessibleVoterGroupIds.add(assignment.voterGroupId);

    // Resolve downward descendants
    if (role === RoleType.STATE_ADMIN || role === RoleType.HIGH_COMMAND) {
      if (assignment.stateId) {
        const state = await prisma.state.findUnique({
          where: { id: assignment.stateId },
          include: {
            zones: {
              include: {
                parliaments: {
                  include: {
                    constituencies: {
                      include: {
                        mandals: {
                          include: {
                            villages: {
                              include: {
                                booths: {
                                  include: {
                                    voterGroups: true,
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        });

        if (state) {
          accessibleStateIds.add(state.id);
          state.zones.forEach((z) => {
            accessibleZoneIds.add(z.id);
            z.parliaments.forEach((p) => {
              accessibleParliamentIds.add(p.id);
              p.constituencies.forEach((c) => {
                accessibleConstituencyIds.add(c.id);
                c.mandals.forEach((m) => {
                  accessibleMandalIds.add(m.id);
                  m.villages.forEach((v) => {
                    accessibleVillageIds.add(v.id);
                    v.booths.forEach((b) => {
                      accessibleBoothIds.add(b.id);
                      b.voterGroups.forEach((vg) => accessibleVoterGroupIds.add(vg.id));
                    });
                  });
                });
              });
            });
          });
        }
      }
    } else if (role === RoleType.ZONE_INCHARGE && assignment.zoneId) {
      const zone = await prisma.zone.findUnique({
        where: { id: assignment.zoneId },
        include: {
          parliaments: {
            include: {
              constituencies: {
                include: {
                  mandals: {
                    include: {
                      villages: {
                        include: {
                          booths: {
                            include: {
                              voterGroups: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (zone) {
        accessibleZoneIds.add(zone.id);
        zone.parliaments.forEach((p) => {
          accessibleParliamentIds.add(p.id);
          p.constituencies.forEach((c) => {
            accessibleConstituencyIds.add(c.id);
            c.mandals.forEach((m) => {
              accessibleMandalIds.add(m.id);
              m.villages.forEach((v) => {
                accessibleVillageIds.add(v.id);
                v.booths.forEach((b) => {
                  accessibleBoothIds.add(b.id);
                  b.voterGroups.forEach((vg) => accessibleVoterGroupIds.add(vg.id));
                });
              });
            });
          });
        });
      }
    } else if (role === RoleType.PARLIAMENT_INCHARGE && assignment.parliamentId) {
      const parliament = await prisma.parliament.findUnique({
        where: { id: assignment.parliamentId },
        include: {
          constituencies: {
            include: {
              mandals: {
                include: {
                  villages: {
                    include: {
                      booths: {
                        include: {
                          voterGroups: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (parliament) {
        accessibleParliamentIds.add(parliament.id);
        parliament.constituencies.forEach((c) => {
          accessibleConstituencyIds.add(c.id);
          c.mandals.forEach((m) => {
            accessibleMandalIds.add(m.id);
            m.villages.forEach((v) => {
              accessibleVillageIds.add(v.id);
              v.booths.forEach((b) => {
                accessibleBoothIds.add(b.id);
                b.voterGroups.forEach((vg) => accessibleVoterGroupIds.add(vg.id));
              });
            });
          });
        });
      }
    } else if ((role === RoleType.CONSTITUENCY_INCHARGE || role === RoleType.VIEWER) && assignment.constituencyId) {
      const constituency = await prisma.constituency.findUnique({
        where: { id: assignment.constituencyId },
        include: {
          mandals: {
            include: {
              villages: {
                include: {
                  booths: {
                    include: {
                      voterGroups: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (constituency) {
        accessibleConstituencyIds.add(constituency.id);
        constituency.mandals.forEach((m) => {
          accessibleMandalIds.add(m.id);
          m.villages.forEach((v) => {
            accessibleVillageIds.add(v.id);
            v.booths.forEach((b) => {
              accessibleBoothIds.add(b.id);
              b.voterGroups.forEach((vg) => accessibleVoterGroupIds.add(vg.id));
            });
          });
        });
      }
    } else if (role === RoleType.MANDAL_INCHARGE && assignment.mandalId) {
      const mandal = await prisma.mandal.findUnique({
        where: { id: assignment.mandalId },
        include: {
          villages: {
            include: {
              booths: {
                include: {
                  voterGroups: true,
                },
              },
            },
          },
        },
      });

      if (mandal) {
        accessibleMandalIds.add(mandal.id);
        mandal.villages.forEach((v) => {
          accessibleVillageIds.add(v.id);
          v.booths.forEach((b) => {
            accessibleBoothIds.add(b.id);
            b.voterGroups.forEach((vg) => accessibleVoterGroupIds.add(vg.id));
          });
        });
      }
    } else if (role === RoleType.VILLAGE_INCHARGE && assignment.villageId) {
      const village = await prisma.village.findUnique({
        where: { id: assignment.villageId },
        include: {
          booths: {
            include: {
              voterGroups: true,
            },
          },
        },
      });

      if (village) {
        accessibleVillageIds.add(village.id);
        village.booths.forEach((b) => {
          accessibleBoothIds.add(b.id);
          b.voterGroups.forEach((vg) => accessibleVoterGroupIds.add(vg.id));
        });
      }
    } else if ((role === RoleType.BOOTH_PRESIDENT || role === RoleType.BOOTH_INCHARGE) && assignment.boothId) {
      const booth = await prisma.booth.findUnique({
        where: { id: assignment.boothId },
        include: { voterGroups: true },
      });

      if (booth) {
        accessibleBoothIds.add(booth.id);
        booth.voterGroups.forEach((vg) => accessibleVoterGroupIds.add(vg.id));
      }
    } else if (role === RoleType.VOTER_100_INCHARGE && assignment.voterGroupId) {
      accessibleVoterGroupIds.add(assignment.voterGroupId);
      if (assignment.boothId) accessibleBoothIds.add(assignment.boothId);
    }
  }

  // Recursive organizationUnit subtree traversal for unitId
  if (user.unitId) {
    const allUnits = await prisma.organizationUnit.findMany({
      select: { id: true, parentId: true },
    });

    const childrenByParent = new Map<string | null, string[]>();
    allUnits.forEach((u) => {
      const p = u.parentId ?? null;
      const list = childrenByParent.get(p) ?? [];
      list.push(u.id);
      childrenByParent.set(p, list);
    });

    const queue = [user.unitId];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      accessibleUnitIds.add(curr);
      const kids = childrenByParent.get(curr) ?? [];
      kids.forEach((k) => queue.push(k));
    }
  }

  return {
    userId: user.id,
    role,
    organisationId: user.organisationId,
    maxLevel,
    isGlobalScope: false,
    isReadOnly,
    accessibleUnitIds,
    accessibleStateIds,
    accessibleZoneIds,
    accessibleParliamentIds,
    accessibleConstituencyIds,
    accessibleMandalIds,
    accessibleVillageIds,
    accessibleBoothIds,
    accessibleVoterGroupIds,
    stateId: assignment?.stateId,
    zoneId: assignment?.zoneId,
    parliamentId: assignment?.parliamentId,
    constituencyId: assignment?.constituencyId,
    mandalId: assignment?.mandalId,
    villageId: assignment?.villageId,
    boothId: assignment?.boothId,
    voterGroupId: assignment?.voterGroupId,
  };
}

/**
 * Middleware hook to populate req.hierarchyScope
 */
export async function populateHierarchyScope(req: FastifyRequest, reply: FastifyReply) {
  if (!req.user) {
    return reply.status(401).send(errorResponse('Authentication required.', 'UNAUTHORIZED'));
  }

  try {
    req.hierarchyScope = await computeUserHierarchyScope(req.user.userId);
  } catch (err) {
    return reply.status(500).send(errorResponse('Failed to resolve user hierarchy scope.', 'SCOPE_RESOLUTION_ERROR'));
  }
}

/**
 * Assert Organisation Isolation (Prevents Cross-Tenant Data Access)
 */
export function assertOrganisationAccess(req: FastifyRequest, reply: FastifyReply, targetOrgId?: string | null): boolean {
  if (!req.hierarchyScope) return false;
  if (req.hierarchyScope.isGlobalScope) return true; // Super admin
  if (!targetOrgId) return true;

  if (req.hierarchyScope.organisationId !== targetOrgId) {
    reply.status(403).send(errorResponse('Access denied: Cross-organisation data access is strictly forbidden.', 'CROSS_ORG_ACCESS_FORBIDDEN'));
    return false;
  }
  return true;
}

/**
 * Assert Unit / Geographical Access (Prevents Horizontal Privilege Escalation)
 */
export function assertUnitAccess(req: FastifyRequest, reply: FastifyReply, targetUnitId?: string | null): boolean {
  if (!req.hierarchyScope) return false;
  if (req.hierarchyScope.isGlobalScope) return true;
  if (!targetUnitId) return true;

  if (!req.hierarchyScope.accessibleUnitIds.has(targetUnitId)) {
    reply.status(403).send(errorResponse(`Access denied: Geographical node ${targetUnitId} is outside your authorized hierarchy scope.`, 'FORBIDDEN_SCOPE'));
    return false;
  }
  return true;
}

/**
 * Assert Voter Resource Scope (Prevents Horizontal & Cross-Unit Access)
 */
export async function assertVoterScope(req: FastifyRequest, reply: FastifyReply, voterId: string): Promise<boolean> {
  const scope = req.hierarchyScope;
  if (!scope) return false;
  if (scope.isGlobalScope) return true;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(voterId);
  if (!isUuid) {
    reply.status(404).send(errorResponse('Voter record not found.', 'NOT_FOUND'));
    return false;
  }

  const voter = await prisma.voter.findUnique({
    where: { id: voterId },
    select: {
      id: true,
      unitId: true,
      voterGroupId: true,
      boothId: true,
      villageId: true,
      mandalId: true,
      constituencyId: true,
      assignedInchargeId: true,
    },
  });

  if (!voter) {
    reply.status(404).send(errorResponse('Voter record not found.', 'NOT_FOUND'));
    return false;
  }

  // 100-Voter In-Charge: Must belong to their exact voter group or assigned incharge
  if (scope.role === RoleType.VOTER_100_INCHARGE) {
    const isAssigned = (voter.voterGroupId && scope.accessibleVoterGroupIds.has(voter.voterGroupId)) ||
                       (voter.assignedInchargeId === req.user?.userId);

    if (!isAssigned) {
      reply.status(403).send(errorResponse('Access denied: You can only access voters assigned to your 100-voter cluster.', 'FORBIDDEN_VOTER_SCOPE'));
      return false;
    }
    return true;
  }

  // Booth Level
  if (scope.role === RoleType.BOOTH_PRESIDENT || scope.role === RoleType.BOOTH_INCHARGE) {
    if (voter.boothId && !scope.accessibleBoothIds.has(voter.boothId)) {
      reply.status(403).send(errorResponse('Access denied: This voter is not in your assigned Booth.', 'FORBIDDEN_VOTER_SCOPE'));
      return false;
    }
    return true;
  }

  // Village Level
  if (scope.role === RoleType.VILLAGE_INCHARGE) {
    if (voter.villageId && !scope.accessibleVillageIds.has(voter.villageId)) {
      reply.status(403).send(errorResponse('Access denied: This voter is not in your assigned Village.', 'FORBIDDEN_VOTER_SCOPE'));
      return false;
    }
    return true;
  }

  // Mandal Level
  if (scope.role === RoleType.MANDAL_INCHARGE) {
    if (voter.mandalId && !scope.accessibleMandalIds.has(voter.mandalId)) {
      reply.status(403).send(errorResponse('Access denied: This voter is not in your assigned Mandal.', 'FORBIDDEN_VOTER_SCOPE'));
      return false;
    }
    return true;
  }

  // Constituency Level
  if (scope.role === RoleType.CONSTITUENCY_INCHARGE || scope.role === RoleType.VIEWER) {
    if (voter.constituencyId && !scope.accessibleConstituencyIds.has(voter.constituencyId)) {
      reply.status(403).send(errorResponse('Access denied: This voter is not in your assigned Assembly Constituency.', 'FORBIDDEN_VOTER_SCOPE'));
      return false;
    }
    return true;
  }

  // Fallback to unit check
  if (voter.unitId && !scope.accessibleUnitIds.has(voter.unitId)) {
    reply.status(403).send(errorResponse('Access denied: Voter is outside your authorized hierarchy scope.', 'FORBIDDEN_VOTER_SCOPE'));
    return false;
  }

  return true;
}

/**
 * Field-level mutation restrictions for 100-Voter Incharges
 */
export function assertVoterFieldPermitted(req: FastifyRequest, reply: FastifyReply, updateData: any): boolean {
  if (req.user?.role === RoleType.VOTER_100_INCHARGE) {
    const forbiddenFields = [
      'id', 'serialNumber', 'epicNumber', 'name', 'fatherHusbandName',
      'gender', 'age', 'houseNumber', 'constituencyId', 'mandalId',
      'villageId', 'boothId', 'voterGroupId', 'unitId', 'stateId', 'zoneId', 'parliamentId'
    ];

    for (const key of Object.keys(updateData)) {
      if (forbiddenFields.includes(key) && updateData[key] !== undefined) {
        reply.status(403).send(errorResponse(`Access denied: 100-Voter Incharge cannot modify core electoral property "${key}".`, 'FORBIDDEN_FIELD_MUTATION'));
        return false;
      }
    }
  }

  return true;
}

/**
 * Prevent Vertical Privilege Escalation when creating or updating users
 */
export function assertRoleHierarchy(callerRole: RoleType, targetRole?: RoleType | null): boolean {
  if (!targetRole) return true;
  const callerRank = ROLE_RANK_WEIGHT[callerRole] ?? 0;
  const targetRank = ROLE_RANK_WEIGHT[targetRole] ?? 0;

  // Caller can only assign roles with strictly lower rank
  if (callerRole === RoleType.SUPER_ADMIN) return true;
  return callerRank > targetRank;
}

/**
 * Assert user management scope (Vertical + Horizontal)
 */
export async function assertUserScope(req: FastifyRequest, reply: FastifyReply, targetUserId: string, targetRole?: RoleType): Promise<boolean> {
  if (!req.user || !req.hierarchyScope) return false;

  // 1. Vertical Check: Cannot assign or modify roles higher than or equal to caller's rank
  if (targetRole && !assertRoleHierarchy(req.user.role, targetRole)) {
    reply.status(403).send(errorResponse(`Access denied: Cannot assign or elevate role (${targetRole}) beyond your authority level (${req.user.role}).`, 'VERTICAL_PRIVILEGE_VIOLATION'));
    return false;
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: {
      hierarchyAssignments: true,
    },
  });

  if (!target) {
    reply.status(404).send(errorResponse('Target user not found.', 'NOT_FOUND'));
    return false;
  }

  // 2. Cross-organisation check
  if (!assertOrganisationAccess(req, reply, target.organisationId)) {
    return false;
  }

  // 3. Cannot modify someone of higher or equal rank unless Super Admin
  if (req.user.role !== RoleType.SUPER_ADMIN && (ROLE_RANK_WEIGHT[target.role] || 0) >= (ROLE_RANK_WEIGHT[req.user.role] || 0)) {
    reply.status(403).send(errorResponse(`Access denied: Cannot manage or modify a user with rank (${target.role}) equal or higher than yours.`, 'VERTICAL_PRIVILEGE_VIOLATION'));
    return false;
  }

  // 4. Horizontal check on unit/hierarchy assignment
  const targetUnitId = target.unitId || target.hierarchyAssignments[0]?.constituencyId;
  return assertUnitAccess(req, reply, targetUnitId);
}
