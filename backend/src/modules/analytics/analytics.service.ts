import { OrgHierarchyLevel, Prisma, RoleType, TaskStatus, TrainingStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { UserHierarchyScope } from '../../common/types.js';

export interface ComputeAnalyticsOptions {
  organisationId?: string | null;
  geoEntityId?: string | null;
  geoLevel?: OrgHierarchyLevel;
  pollingStationId?: string | null;
}

export interface DemographicFilterOptions {
  villageId?: string;
  village?: string;
  boothId?: string;
  caste?: string;
  gender?: string;
  ageGroup?: string;
  profession?: string;
}

export interface ChildAreaRollup {
  unitId: string;
  id: string;
  name: string;
  code: string | null;
  level: string;
  totalVoters: number;
  voted: number;
  notVoted: number;
  surveyed: number;
  fakeVoters: number;
  local: number;
  migrated: number;
  partyPreference: Record<string, number>;
  primaryPartyCode: string;
  primaryPartyVotes: number;
  topOpponentCode: string;
  topOpponentVotes: number;
  tdp: number;
  ysrcp: number;
  lead: number;
  margin: number;
  leadingParty: string;
  status: 'WINNING' | 'TRAILING' | 'CLOSE_CONTEST' | 'UNSURVEYED';
}

const NEUTRAL_PREF_SET = new Set(['NEUTRAL', 'OTH', 'OTHER', 'OTHERS', 'UNDECIDED', 'UNKNOWN', '']);

export class AnalyticsService {
  /**
   * Resolves tenant's configured active primary party and party codes from DB.
   */
  private static async resolveTenantPartyConfig(organisationId?: string | null): Promise<{
    primaryPartyCode: string;
    configuredPartyCodes: string[];
  }> {
    const [cmsConfig, parties] = await Promise.all([
      prisma.cMSConfiguration.findFirst({
        where: organisationId ? { organisationId } : undefined,
        select: { activePartyCode: true },
      }),
      prisma.politicalParty.findMany({
        where: {
          isActive: true,
          ...(organisationId ? { organisationId } : {}),
        },
        orderBy: { sortOrder: 'asc' },
        select: { code: true, shortName: true, name: true },
      }),
    ]);

    const configuredPartyCodes: string[] = [];
    const seen = new Set<string>();
    const pushCode = (raw?: string | null) => {
      const code = (raw || '').trim().toUpperCase();
      if (!code || NEUTRAL_PREF_SET.has(code) || seen.has(code)) return;
      seen.add(code);
      configuredPartyCodes.push(code);
    };

    pushCode(cmsConfig?.activePartyCode);
    for (const p of parties) {
      pushCode(p.code || p.shortName);
    }

    const primaryPartyCode = configuredPartyCodes[0] || (cmsConfig?.activePartyCode || 'PRIMARY').trim().toUpperCase();
    return { primaryPartyCode, configuredPartyCodes };
  }

  /**
   * Evaluates leading party, opponent, margin, and WINNING/TRAILING/CLOSE_CONTEST/UNSURVEYED status
   * dynamically for any tenant's configured parties (no hardcoded TDP/YSRCP).
   */
  private static evaluatePartyStanding(
    partyPref: Record<string, number>,
    primaryPartyCode: string,
    totalVoters: number
  ): {
    primaryPartyVotes: number;
    topOpponentCode: string;
    topOpponentVotes: number;
    leadingParty: string;
    lead: number;
    margin: number;
    status: 'WINNING' | 'TRAILING' | 'CLOSE_CONTEST' | 'UNSURVEYED';
  } {
    const normalizedPrimary = primaryPartyCode.toUpperCase();
    const primaryVotes = Number(partyPref[normalizedPrimary] || 0);

    let topOpponentCode = 'OPPONENT';
    let topOpponentVotes = 0;
    let totalClassified = 0;

    for (const [rawKey, rawVal] of Object.entries(partyPref)) {
      const key = rawKey.toUpperCase();
      const val = Number(rawVal || 0);
      if (NEUTRAL_PREF_SET.has(key) || val <= 0) continue;
      totalClassified += val;
      if (key !== normalizedPrimary && val > topOpponentVotes) {
        topOpponentVotes = val;
        topOpponentCode = key;
      }
    }

    if (totalClassified === 0) {
      return {
        primaryPartyVotes: 0,
        topOpponentCode,
        topOpponentVotes: 0,
        leadingParty: 'NEUTRAL',
        lead: 0,
        margin: 0,
        status: 'UNSURVEYED',
      };
    }

    const margin = primaryVotes - topOpponentVotes;
    const lead = Math.abs(margin);
    const leadingParty = margin >= 0 ? normalizedPrimary : topOpponentCode;
    const denom = totalClassified > 0 ? totalClassified : totalVoters;
    const diffPct = denom > 0 ? (lead / denom) * 100 : 0;

    const status: 'WINNING' | 'TRAILING' | 'CLOSE_CONTEST' =
      diffPct < 4 ? 'CLOSE_CONTEST' : margin > 0 ? 'WINNING' : 'TRAILING';

    return {
      primaryPartyVotes: primaryVotes,
      topOpponentCode,
      topOpponentVotes,
      leadingParty,
      lead,
      margin,
      status,
    };
  }

  /**
   * Resolves the caller's exact authoritative geographic entity & org scope from RBAC scope.
   */
  static async resolveScopeTarget(scope: UserHierarchyScope, userId: string): Promise<{
    unitId: string;
    geoEntityId: string | null;
    geoLevel: OrgHierarchyLevel;
    pollingStationId: string | null;
    organisationId: string | null;
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        hierarchyAssignments: {
          where: { isActive: true },
          take: 1,
        },
      },
    });

    const orgId = scope.organisationId || user?.organisationId || null;
    const assignment = user?.hierarchyAssignments?.[0] || null;
    const role = scope.role;

    const pickFirst = (set: Set<string>): string | null => {
      for (const v of set) return v;
      return null;
    };

    if (role === RoleType.VOTER_100_INCHARGE) {
      const vgId = assignment?.voterGroupId || pickFirst(scope.accessibleVoterGroupIds);
      if (vgId) {
        return { unitId: vgId, geoEntityId: vgId, geoLevel: OrgHierarchyLevel.VOTER_GROUP, pollingStationId: null, organisationId: orgId };
      }
    }

    if (role === RoleType.BOOTH_PRESIDENT || role === RoleType.BOOTH_INCHARGE || role === RoleType.POLLING_AGENT) {
      const boothId = assignment?.boothId || pickFirst(scope.accessibleBoothIds);
      if (boothId) {
        return { unitId: boothId, geoEntityId: boothId, geoLevel: OrgHierarchyLevel.BOOTH, pollingStationId: null, organisationId: orgId };
      }
    }

    if (role === RoleType.VILLAGE_INCHARGE) {
      if (assignment?.pollingStationId) {
        return {
          unitId: assignment.pollingStationId,
          geoEntityId: assignment.pollingStationId,
          geoLevel: OrgHierarchyLevel.VILLAGE,
          pollingStationId: assignment.pollingStationId,
          organisationId: orgId,
        };
      }
      const villageId = assignment?.villageId || pickFirst(scope.accessibleVillageIds);
      if (villageId) {
        return { unitId: villageId, geoEntityId: villageId, geoLevel: OrgHierarchyLevel.VILLAGE, pollingStationId: null, organisationId: orgId };
      }
    }

    if (role === RoleType.MANDAL_INCHARGE) {
      const mandalId = assignment?.mandalId || pickFirst(scope.accessibleMandalIds);
      if (mandalId) {
        return { unitId: mandalId, geoEntityId: mandalId, geoLevel: OrgHierarchyLevel.MANDAL, pollingStationId: null, organisationId: orgId };
      }
    }

    if (role === RoleType.CONSTITUENCY_INCHARGE || role === RoleType.VIEWER) {
      const constId = assignment?.constituencyId || pickFirst(scope.accessibleConstituencyIds);
      if (constId) {
        return { unitId: constId, geoEntityId: constId, geoLevel: OrgHierarchyLevel.CONSTITUENCY, pollingStationId: null, organisationId: orgId };
      }
    }

    if (role === RoleType.PARLIAMENT_INCHARGE) {
      const parlId = assignment?.parliamentId || pickFirst(scope.accessibleParliamentIds);
      if (parlId) {
        return { unitId: parlId, geoEntityId: parlId, geoLevel: OrgHierarchyLevel.PARLIAMENT, pollingStationId: null, organisationId: orgId };
      }
    }

    if (role === RoleType.ZONE_INCHARGE) {
      const zoneId = assignment?.zoneId || pickFirst(scope.accessibleZoneIds);
      if (zoneId) {
        return { unitId: zoneId, geoEntityId: zoneId, geoLevel: OrgHierarchyLevel.ZONE, pollingStationId: null, organisationId: orgId };
      }
    }

    // State / Party Admin / High Command / Super Admin fallback
    let stateId = assignment?.stateId || pickFirst(scope.accessibleStateIds);
    if (!stateId && orgId) {
      const st = await prisma.state.findFirst({ where: { organisationId: orgId }, select: { id: true } });
      stateId = st?.id || null;
    }
    if (!stateId && scope.isGlobalScope) {
      const st = await prisma.state.findFirst({ select: { id: true } });
      stateId = st?.id || null;
    }
    if (stateId) {
      return { unitId: stateId, geoEntityId: stateId, geoLevel: OrgHierarchyLevel.STATE, pollingStationId: null, organisationId: orgId };
    }

    // Legacy OrganizationUnit fallback
    const fallbackUnitId = user?.unitId || pickFirst(scope.accessibleUnitIds) || '';
    return { unitId: fallbackUnitId, geoEntityId: null, geoLevel: scope.maxLevel, pollingStationId: null, organisationId: orgId };
  }

  /**
   * Computes full scope analytics for the authenticated caller (`GET /api/analytics/me`).
   */
  static async computeAnalyticsForScope(scope: UserHierarchyScope, userId: string) {
    const target = await this.resolveScopeTarget(scope, userId);
    if (!target.unitId) {
      return this.buildEmptyAnalyticsResponse({ id: '', name: 'Unassigned Scope', code: '', level: scope.maxLevel, parentId: null });
    }
    return this.computeAnalyticsForUnit(target.unitId, {
      organisationId: target.organisationId,
      geoEntityId: target.geoEntityId,
      geoLevel: target.geoLevel,
      pollingStationId: target.pollingStationId,
    });
  }

  private static buildEmptyAnalyticsResponse(unit: any, primaryPartyCode = 'PRIMARY') {
    return {
      unit,
      summary: {
        totalVoters: 0,
        voted: 0,
        notVoted: 0,
        turnoutPercentage: 0,
        surveyed: 0,
        pendingSurvey: 0,
        surveyCompletionPct: 0,
        fakeVoters: 0,
        doubtfulVoters: 0,
        shiftedVoters: 0,
        deceasedVoters: 0,
        activeVoters: 0,
        migratedVoters: 0,
        localVoters: 0,
      },
      hierarchyCounts: {
        ZONE: 0,
        PARLIAMENT: 0,
        CONSTITUENCY: 0,
        MANDAL: 0,
        POLLING_STATION: 0,
        VILLAGE: 0,
        BOOTH: 0,
        VOTER_GROUP: 0,
      },
      demographics: {
        caste: {},
        profession: {},
        age: { '18-25': 0, '26-40': 0, '41-60': 0, '60+': 0 },
        gender: { Male: 0, Female: 0, Other: 0 },
      },
      partyPreference: { [primaryPartyCode]: 0, NEUTRAL: 0, OTH: 0 },
      projections: {
        primaryPartyCode,
        topOpponentCode: 'OPPONENT',
        leadingParty: 'NEUTRAL',
        lead: 0,
        margin: 0,
        winningAreasCount: 0,
        trailingAreasCount: 0,
        closeContestAreasCount: 0,
        unsurveyedAreasCount: 0,
        winningAreas: [] as ChildAreaRollup[],
        trailingAreas: [] as ChildAreaRollup[],
        closeContestAreas: [] as ChildAreaRollup[],
      },
      children: [] as ChildAreaRollup[],
      boothRollups: [] as ChildAreaRollup[],
      operations: {
        teamStrength: 0,
        cadrePerformance: { totalCadres: 0, averageScore: 0 },
        taskPerformance: { totalTasks: 0, completed: 0, pending: 0, inProgress: 0, completionRate: 0 },
        trainingPerformance: { totalAssigned: 0, completed: 0, completionRate: 0 },
      },
    };
  }

  /**
   * Computes complete SQL-aggregated analytics for any hierarchy node (geographic entity ID or OrganizationUnit ID).
   */
  static async computeAnalyticsForUnit(unitId: string, opts: ComputeAnalyticsOptions = {}) {
    const allUnits = await prisma.organizationUnit.findMany({
      select: { id: true, parentId: true, level: true, name: true, code: true },
    });

    const byParent = new Map<string | null, typeof allUnits>();
    allUnits.forEach((u) => {
      const p = u.parentId ?? null;
      const list = byParent.get(p) ?? [];
      list.push(u);
      byParent.set(p, list);
    });

    const currentUnit = allUnits.find((u) => u.id === unitId);

    // Resolve geographic entity accurately (preferring explicit geoEntityId / pollingStationId over name match)
    let geoCondition: Prisma.Sql | null = null;
    let targetGeoLevel: OrgHierarchyLevel = opts.geoLevel || currentUnit?.level || OrgHierarchyLevel.STATE;
    let resolvedGeoId: string | null = opts.geoEntityId || null;
    let resolvedOrgId: string | null = opts.organisationId || null;
    let resolvedEntityName: string = currentUnit?.name || 'Jurisdiction Unit';
    let resolvedEntityCode: string = currentUnit?.code || unitId.slice(0, 8);
    let resolvedPollingStationId: string | null = opts.pollingStationId || null;
    let psBoothIds: string[] = [];

    const tryResolvePollingStation = async (psId: string) => {
      const ps = await prisma.pollingStation.findUnique({
        where: { id: psId },
        include: {
          booths: { select: { id: true } },
          constituency: { include: { parliament: { include: { zone: { include: { state: true } } } } } },
        },
      });
      if (!ps) return false;
      resolvedPollingStationId = ps.id;
      resolvedGeoId = ps.id;
      targetGeoLevel = OrgHierarchyLevel.VILLAGE;
      resolvedEntityName = ps.name;
      resolvedEntityCode = ps.code || ps.id.slice(0, 8);
      resolvedOrgId = resolvedOrgId || ps.constituency?.parliament?.zone?.state?.organisationId || null;
      psBoothIds = ps.booths.map((b) => b.id);
      if (psBoothIds.length === 0) {
        // Fallback: match booths by pollingStation text or village name in same mandal
        const fallbackBooths = await prisma.booth.findMany({
          where: {
            village: { mandalId: ps.mandalId },
            OR: [
              { pollingStation: { equals: ps.name, mode: 'insensitive' } },
              { name: { contains: ps.name, mode: 'insensitive' } },
              { village: { name: { equals: ps.name, mode: 'insensitive' } } },
            ],
          },
          select: { id: true },
        });
        psBoothIds = fallbackBooths.map((b) => b.id);
        if (psBoothIds.length > 0) {
          await prisma.booth.updateMany({
            where: { id: { in: psBoothIds } },
            data: { pollingStationId: ps.id },
          }).catch(() => {});
        }
      }
      if (psBoothIds.length > 0) {
        const bSql = psBoothIds.map((id) => Prisma.sql`${id}::uuid`);
        geoCondition = Prisma.sql`"boothId" IN (${Prisma.join(bSql)})`;
      } else {
        geoCondition = Prisma.sql`1=0`;
      }
      return true;
    };

    const resolveGeoByIdAndLevel = async (id: string, level: OrgHierarchyLevel): Promise<boolean> => {
      if (level === OrgHierarchyLevel.STATE) {
        const st = await prisma.state.findUnique({ where: { id }, select: { id: true, name: true, code: true, organisationId: true } });
        if (!st) return false;
        geoCondition = Prisma.sql`"stateId" = ${st.id}::uuid`;
        resolvedGeoId = st.id;
        resolvedEntityName = st.name;
        resolvedEntityCode = st.code;
        resolvedOrgId = resolvedOrgId || st.organisationId;
        return true;
      }
      if (level === OrgHierarchyLevel.ZONE) {
        const z = await prisma.zone.findUnique({ where: { id }, include: { state: { select: { organisationId: true } } } });
        if (!z) return false;
        geoCondition = Prisma.sql`"zoneId" = ${z.id}::uuid`;
        resolvedGeoId = z.id;
        resolvedEntityName = z.name;
        resolvedEntityCode = z.code;
        resolvedOrgId = resolvedOrgId || z.state.organisationId;
        return true;
      }
      if (level === OrgHierarchyLevel.PARLIAMENT) {
        const p = await prisma.parliament.findUnique({ where: { id }, include: { zone: { include: { state: { select: { organisationId: true } } } } } });
        if (!p) return false;
        geoCondition = Prisma.sql`"parliamentId" = ${p.id}::uuid`;
        resolvedGeoId = p.id;
        resolvedEntityName = p.name;
        resolvedEntityCode = p.code;
        resolvedOrgId = resolvedOrgId || p.zone.state.organisationId;
        return true;
      }
      if (level === OrgHierarchyLevel.CONSTITUENCY) {
        const c = await prisma.constituency.findUnique({ where: { id }, include: { parliament: { include: { zone: { include: { state: { select: { organisationId: true } } } } } } } });
        if (!c) return false;
        geoCondition = Prisma.sql`"constituencyId" = ${c.id}::uuid`;
        resolvedGeoId = c.id;
        resolvedEntityName = c.name;
        resolvedEntityCode = c.code;
        resolvedOrgId = resolvedOrgId || c.parliament.zone.state.organisationId;
        return true;
      }
      if (level === OrgHierarchyLevel.MANDAL) {
        const m = await prisma.mandal.findUnique({ where: { id }, include: { constituency: { include: { parliament: { include: { zone: { include: { state: { select: { organisationId: true } } } } } } } } } });
        if (!m) return false;
        geoCondition = Prisma.sql`"mandalId" = ${m.id}::uuid`;
        resolvedGeoId = m.id;
        resolvedEntityName = m.name;
        resolvedEntityCode = m.code;
        resolvedOrgId = resolvedOrgId || m.constituency?.parliament?.zone?.state?.organisationId || null;
        return true;
      }
      if (level === OrgHierarchyLevel.VILLAGE) {
        const v = await prisma.village.findUnique({ where: { id }, include: { mandal: { include: { constituency: { include: { parliament: { include: { zone: { include: { state: { select: { organisationId: true } } } } } } } } } } } });
        if (v) {
          geoCondition = Prisma.sql`"villageId" = ${v.id}::uuid`;
          resolvedGeoId = v.id;
          resolvedEntityName = v.name;
          resolvedEntityCode = v.code;
          resolvedOrgId = resolvedOrgId || v.mandal?.constituency?.parliament?.zone?.state?.organisationId || null;
          return true;
        }
        return tryResolvePollingStation(id);
      }
      if (level === OrgHierarchyLevel.BOOTH) {
        const b = await prisma.booth.findUnique({ where: { id }, include: { village: { include: { mandal: { include: { constituency: { include: { parliament: { include: { zone: { include: { state: { select: { organisationId: true } } } } } } } } } } } } } });
        if (!b) return false;
        geoCondition = Prisma.sql`"boothId" = ${b.id}::uuid`;
        resolvedGeoId = b.id;
        resolvedEntityName = b.name || `Booth ${b.boothNumber}`;
        resolvedEntityCode = b.code;
        resolvedOrgId = resolvedOrgId || b.village?.mandal?.constituency?.parliament?.zone?.state?.organisationId || null;
        return true;
      }
      if (level === OrgHierarchyLevel.VOTER_GROUP) {
        const vg = await prisma.voterGroup.findUnique({ where: { id }, include: { booth: { include: { village: { include: { mandal: { include: { constituency: { include: { parliament: { include: { zone: { include: { state: { select: { organisationId: true } } } } } } } } } } } } } } } });
        if (!vg) return false;
        geoCondition = Prisma.sql`"voterGroupId" = ${vg.id}::uuid`;
        resolvedGeoId = vg.id;
        resolvedEntityName = vg.name;
        resolvedEntityCode = vg.code;
        resolvedOrgId = resolvedOrgId || vg.booth?.village?.mandal?.constituency?.parliament?.zone?.state?.organisationId || null;
        return true;
      }
      return false;
    };

    if (resolvedPollingStationId) {
      await tryResolvePollingStation(resolvedPollingStationId);
    } else if (opts.geoEntityId && opts.geoLevel) {
      await resolveGeoByIdAndLevel(opts.geoEntityId, opts.geoLevel);
    }

    // If not resolved yet via explicit hints, resolve from OrganizationUnit or direct geographic lookup
    if (!geoCondition && currentUnit) {
      const code = currentUnit.code || undefined;
      if (currentUnit.level === OrgHierarchyLevel.STATE) {
        const state = await prisma.state.findFirst({
          where: {
            ...(resolvedOrgId ? { organisationId: resolvedOrgId } : {}),
            OR: [{ code }, { name: currentUnit.name }],
          },
          select: { id: true, name: true, code: true, organisationId: true },
        });
        if (state) {
          geoCondition = Prisma.sql`"stateId" = ${state.id}::uuid`;
          resolvedGeoId = state.id;
          resolvedEntityName = state.name;
          resolvedEntityCode = state.code;
          resolvedOrgId = resolvedOrgId || state.organisationId;
        }
      } else if (currentUnit.level === OrgHierarchyLevel.ZONE) {
        const zone = await prisma.zone.findFirst({
          where: {
            ...(resolvedOrgId ? { state: { organisationId: resolvedOrgId } } : {}),
            OR: [{ code }, { name: currentUnit.name }],
          },
          include: { state: { select: { organisationId: true } } },
        });
        if (zone) {
          geoCondition = Prisma.sql`"zoneId" = ${zone.id}::uuid`;
          resolvedGeoId = zone.id;
          resolvedEntityName = zone.name;
          resolvedEntityCode = zone.code;
          resolvedOrgId = resolvedOrgId || zone.state.organisationId;
        }
      } else if (currentUnit.level === OrgHierarchyLevel.PARLIAMENT) {
        const par = await prisma.parliament.findFirst({
          where: {
            ...(resolvedOrgId ? { zone: { state: { organisationId: resolvedOrgId } } } : {}),
            OR: [{ code }, { name: currentUnit.name }],
          },
          include: { zone: { include: { state: { select: { organisationId: true } } } } },
        });
        if (par) {
          geoCondition = Prisma.sql`"parliamentId" = ${par.id}::uuid`;
          resolvedGeoId = par.id;
          resolvedEntityName = par.name;
          resolvedEntityCode = par.code;
          resolvedOrgId = resolvedOrgId || par.zone.state.organisationId;
        }
      } else if (currentUnit.level === OrgHierarchyLevel.CONSTITUENCY) {
        const c = await prisma.constituency.findFirst({
          where: {
            ...(resolvedOrgId ? { parliament: { zone: { state: { organisationId: resolvedOrgId } } } } : {}),
            OR: [{ code }, { name: currentUnit.name }],
          },
          include: { parliament: { include: { zone: { include: { state: { select: { organisationId: true } } } } } } },
        });
        if (c) {
          geoCondition = Prisma.sql`"constituencyId" = ${c.id}::uuid`;
          resolvedGeoId = c.id;
          resolvedEntityName = c.name;
          resolvedEntityCode = c.code;
          resolvedOrgId = resolvedOrgId || c.parliament.zone.state.organisationId;
        }
      } else if (currentUnit.level === OrgHierarchyLevel.MANDAL) {
        const m = await prisma.mandal.findFirst({
          where: {
            ...(resolvedOrgId ? { constituency: { parliament: { zone: { state: { organisationId: resolvedOrgId } } } } } : {}),
            OR: [{ code }, { name: currentUnit.name }],
          },
          include: { constituency: { include: { parliament: { include: { zone: { include: { state: { select: { organisationId: true } } } } } } } } },
        });
        if (m) {
          geoCondition = Prisma.sql`"mandalId" = ${m.id}::uuid`;
          resolvedGeoId = m.id;
          resolvedEntityName = m.name;
          resolvedEntityCode = m.code;
          resolvedOrgId = resolvedOrgId || m.constituency.parliament.zone.state.organisationId;
        }
      } else if (currentUnit.level === OrgHierarchyLevel.VILLAGE) {
        const v = await prisma.village.findFirst({
          where: {
            ...(resolvedOrgId ? { mandal: { constituency: { parliament: { zone: { state: { organisationId: resolvedOrgId } } } } } } : {}),
            OR: [{ code }, { name: currentUnit.name }],
          },
          include: { mandal: { include: { constituency: { include: { parliament: { include: { zone: { include: { state: { select: { organisationId: true } } } } } } } } } } },
        });
        if (v) {
          geoCondition = Prisma.sql`"villageId" = ${v.id}::uuid`;
          resolvedGeoId = v.id;
          resolvedEntityName = v.name;
          resolvedEntityCode = v.code;
          resolvedOrgId = resolvedOrgId || v.mandal.constituency.parliament.zone.state.organisationId;
        }
      } else if (currentUnit.level === OrgHierarchyLevel.BOOTH) {
        const b = await prisma.booth.findFirst({
          where: {
            ...(resolvedOrgId ? { village: { mandal: { constituency: { parliament: { zone: { state: { organisationId: resolvedOrgId } } } } } } } : {}),
            OR: [{ code }, { boothNumber: currentUnit.name }, { name: currentUnit.name }],
          },
          include: { village: { include: { mandal: { include: { constituency: { include: { parliament: { include: { zone: { include: { state: { select: { organisationId: true } } } } } } } } } } } } },
        });
        if (b) {
          geoCondition = Prisma.sql`"boothId" = ${b.id}::uuid`;
          resolvedGeoId = b.id;
          resolvedEntityName = b.name || `Booth ${b.boothNumber}`;
          resolvedEntityCode = b.code;
          resolvedOrgId = resolvedOrgId || b.village.mandal.constituency.parliament.zone.state.organisationId;
        }
      } else if (currentUnit.level === OrgHierarchyLevel.VOTER_GROUP) {
        const vg = await prisma.voterGroup.findFirst({
          where: {
            ...(resolvedOrgId ? { booth: { village: { mandal: { constituency: { parliament: { zone: { state: { organisationId: resolvedOrgId } } } } } } } } : {}),
            OR: [{ code }, { name: currentUnit.name }],
          },
          include: { booth: { include: { village: { include: { mandal: { include: { constituency: { include: { parliament: { include: { zone: { include: { state: { select: { organisationId: true } } } } } } } } } } } } } } },
        });
        if (vg) {
          geoCondition = Prisma.sql`"voterGroupId" = ${vg.id}::uuid`;
          resolvedGeoId = vg.id;
          resolvedEntityName = vg.name;
          resolvedEntityCode = vg.code;
          resolvedOrgId = resolvedOrgId || vg.booth.village.mandal.constituency.parliament.zone.state.organisationId;
        }
      }
    } else if (!geoCondition) {
      // unitId might be a direct geographic entity ID without explicit levelHint
      const levelsToProbe: OrgHierarchyLevel[] = [
        OrgHierarchyLevel.MANDAL,
        OrgHierarchyLevel.VILLAGE,
        OrgHierarchyLevel.BOOTH,
        OrgHierarchyLevel.CONSTITUENCY,
        OrgHierarchyLevel.PARLIAMENT,
        OrgHierarchyLevel.ZONE,
        OrgHierarchyLevel.STATE,
        OrgHierarchyLevel.VOTER_GROUP,
      ];
      for (const lvl of levelsToProbe) {
        if (await resolveGeoByIdAndLevel(unitId, lvl)) {
          targetGeoLevel = lvl;
          break;
        }
      }
    }

    // Collect OrganizationUnit subtree (only meaningful if currentUnit exists or matching unit exists)
    const matchedOrgUnit =
      currentUnit ||
      (resolvedEntityCode
        ? allUnits.find((u) => u.code === resolvedEntityCode && u.level === targetGeoLevel)
        : undefined);
    const rootOrgUnitId = matchedOrgUnit?.id || (currentUnit ? unitId : null);

    const descendantUnitIds: string[] = [];
    if (rootOrgUnitId) {
      descendantUnitIds.push(rootOrgUnitId);
      const queue = [rootOrgUnitId];
      while (queue.length > 0) {
        const curr = queue.shift()!;
        const kids = byParent.get(curr) ?? [];
        kids.forEach((k) => {
          descendantUnitIds.push(k.id);
          queue.push(k.id);
        });
      }
    }

    const effectiveUnit = {
      id: resolvedGeoId || matchedOrgUnit?.id || unitId,
      name: resolvedEntityName,
      code: resolvedEntityCode,
      level: targetGeoLevel,
      parentId: matchedOrgUnit?.parentId ?? null,
    };

    const { primaryPartyCode, configuredPartyCodes } = await this.resolveTenantPartyConfig(resolvedOrgId);

    if (!geoCondition && descendantUnitIds.length === 0) {
      return this.buildEmptyAnalyticsResponse(effectiveUnit, primaryPartyCode);
    }

    const unitSqlList = descendantUnitIds.map((id) => Prisma.sql`${id}::uuid`);
    const whereClause = geoCondition
      ? unitSqlList.length > 0
        ? Prisma.sql`("unitId" IN (${Prisma.join(unitSqlList)}) OR ${geoCondition})`
        : geoCondition
      : Prisma.sql`"unitId" IN (${Prisma.join(unitSqlList)})`;

    // Execute primary PostgreSQL pushdown aggregations in parallel
    const [
      summaryRows,
      partyRows,
      casteRows,
      professionRows,
      hierarchyCounts,
      childrenAndBooths,
      operationsData,
    ] = await Promise.all([
      prisma.$queryRaw<
        Array<{
          totalVoters: number;
          voted: number;
          surveyed: number;
          fakeVoters: number;
          doubtfulVoters: number;
          shiftedVoters: number;
          deceasedVoters: number;
          activeVoters: number;
          migratedVoters: number;
          localVoters: number;
          age_18_25: number;
          age_26_40: number;
          age_41_60: number;
          age_60_plus: number;
          gender_male: number;
          gender_female: number;
          gender_other: number;
        }>
      >`
        SELECT
          COUNT(*)::int AS "totalVoters",
          COUNT(*) FILTER (WHERE "voteStatus" = 'VOTE_DONE')::int AS "voted",
          COUNT(*) FILTER (WHERE "surveyStatus" IN ('SURVEYED', 'VERIFIED'))::int AS "surveyed",
          COUNT(*) FILTER (WHERE "voterStatus" = 'FAKE')::int AS "fakeVoters",
          COUNT(*) FILTER (WHERE "voterStatus" = 'DOUBTFUL')::int AS "doubtfulVoters",
          COUNT(*) FILTER (WHERE "voterStatus" = 'SHIFTED')::int AS "shiftedVoters",
          COUNT(*) FILTER (WHERE "voterStatus" = 'DECEASED')::int AS "deceasedVoters",
          COUNT(*) FILTER (WHERE "voterStatus" = 'ACTIVE')::int AS "activeVoters",
          COUNT(*) FILTER (WHERE "voterLocationStatus" = 'MIGRATED')::int AS "migratedVoters",
          COUNT(*) FILTER (WHERE "voterLocationStatus" = 'LOCAL')::int AS "localVoters",
          COUNT(*) FILTER (WHERE "age" <= 25)::int AS "age_18_25",
          COUNT(*) FILTER (WHERE "age" >= 26 AND "age" <= 40)::int AS "age_26_40",
          COUNT(*) FILTER (WHERE "age" >= 41 AND "age" <= 60)::int AS "age_41_60",
          COUNT(*) FILTER (WHERE "age" > 60)::int AS "age_60_plus",
          COUNT(*) FILTER (WHERE "gender" = 'MALE')::int AS "gender_male",
          COUNT(*) FILTER (WHERE "gender" = 'FEMALE')::int AS "gender_female",
          COUNT(*) FILTER (WHERE "gender" = 'OTHER')::int AS "gender_other"
        FROM "Voter"
        WHERE ${whereClause}
      `,
      prisma.$queryRaw<Array<{ politicalPreference: string | null; count: number }>>`
        SELECT COALESCE(NULLIF(UPPER(TRIM("politicalPreference")), ''), 'NEUTRAL') AS "politicalPreference", COUNT(*)::int AS count
        FROM "Voter"
        WHERE ${whereClause}
        GROUP BY COALESCE(NULLIF(UPPER(TRIM("politicalPreference")), ''), 'NEUTRAL')
      `,
      prisma.$queryRaw<Array<{ caste: string | null; count: number }>>`
        SELECT COALESCE(NULLIF(TRIM("caste"), ''), 'Unknown') AS caste, COUNT(*)::int AS count
        FROM "Voter"
        WHERE ${whereClause}
        GROUP BY COALESCE(NULLIF(TRIM("caste"), ''), 'Unknown')
      `,
      prisma.$queryRaw<Array<{ profession: string | null; count: number }>>`
        SELECT COALESCE(NULLIF(TRIM("profession"), ''), 'Other') AS profession, COUNT(*)::int AS count
        FROM "Voter"
        WHERE ${whereClause}
        GROUP BY COALESCE(NULLIF(TRIM("profession"), ''), 'Other')
      `,
      this.computeHierarchyCounts(targetGeoLevel, resolvedGeoId, resolvedPollingStationId, psBoothIds),
      this.computeChildAndBoothRollups({
        targetGeoLevel,
        resolvedGeoId,
        resolvedPollingStationId,
        psBoothIds,
        whereClause,
        primaryPartyCode,
        allUnits,
        byParent,
        rootOrgUnitId,
      }),
      this.computeOperationsRollups(targetGeoLevel, resolvedGeoId, resolvedPollingStationId, psBoothIds, descendantUnitIds),
    ]);

    const s = summaryRows[0] || {
      totalVoters: 0,
      voted: 0,
      surveyed: 0,
      fakeVoters: 0,
      doubtfulVoters: 0,
      shiftedVoters: 0,
      deceasedVoters: 0,
      activeVoters: 0,
      migratedVoters: 0,
      localVoters: 0,
      age_18_25: 0,
      age_26_40: 0,
      age_41_60: 0,
      age_60_plus: 0,
      gender_male: 0,
      gender_female: 0,
      gender_other: 0,
    };

    const totalVoters = Number(s.totalVoters || 0);
    const voted = Number(s.voted || 0);
    const notVoted = Math.max(0, totalVoters - voted);
    const turnoutPct = totalVoters > 0 ? Math.round((voted / totalVoters) * 1000) / 10 : 0;
    const surveyed = Number(s.surveyed || 0);
    const pendingSurvey = Math.max(0, totalVoters - surveyed);
    const surveyCompletionPct = totalVoters > 0 ? Math.round((surveyed / totalVoters) * 1000) / 10 : 0;

    const partyPreference: Record<string, number> = {
      [primaryPartyCode]: 0,
      NEUTRAL: 0,
      OTH: 0,
    };
    for (const code of configuredPartyCodes) {
      if (partyPreference[code] === undefined) partyPreference[code] = 0;
    }
    partyRows.forEach((r) => {
      const pref = (r.politicalPreference || 'NEUTRAL').toUpperCase();
      partyPreference[pref] = (partyPreference[pref] ?? 0) + Number(r.count || 0);
    });

    const caste: Record<string, number> = {};
    casteRows.forEach((r) => {
      const c = r.caste || 'Unknown';
      caste[c] = (caste[c] ?? 0) + Number(r.count || 0);
    });

    const profession: Record<string, number> = {};
    professionRows.forEach((r) => {
      const p = r.profession || 'Other';
      profession[p] = (profession[p] ?? 0) + Number(r.count || 0);
    });

    const unitStanding = this.evaluatePartyStanding(partyPreference, primaryPartyCode, totalVoters);

    const children = childrenAndBooths.children;
    const winningAreas = children.filter((c) => c.status === 'WINNING');
    const trailingAreas = children.filter((c) => c.status === 'TRAILING');
    const closeContestAreas = children.filter((c) => c.status === 'CLOSE_CONTEST');
    const unsurveyedAreas = children.filter((c) => c.status === 'UNSURVEYED');

    return {
      unit: effectiveUnit as any,
      summary: {
        totalVoters,
        voted,
        notVoted,
        turnoutPercentage: turnoutPct,
        surveyed,
        pendingSurvey,
        surveyCompletionPct,
        fakeVoters: Number(s.fakeVoters || 0),
        doubtfulVoters: Number(s.doubtfulVoters || 0),
        shiftedVoters: Number(s.shiftedVoters || 0),
        deceasedVoters: Number(s.deceasedVoters || 0),
        activeVoters: Number(s.activeVoters || 0),
        migratedVoters: Number(s.migratedVoters || 0),
        localVoters: Number(s.localVoters || 0),
      },
      hierarchyCounts,
      demographics: {
        caste,
        profession,
        age: {
          '18-25': Number(s.age_18_25 || 0),
          '26-40': Number(s.age_26_40 || 0),
          '41-60': Number(s.age_41_60 || 0),
          '60+': Number(s.age_60_plus || 0),
        },
        gender: {
          Male: Number(s.gender_male || 0),
          Female: Number(s.gender_female || 0),
          Other: Number(s.gender_other || 0),
        },
      },
      partyPreference,
      projections: {
        primaryPartyCode,
        topOpponentCode: unitStanding.topOpponentCode,
        leadingParty: unitStanding.leadingParty,
        lead: unitStanding.lead,
        margin: unitStanding.margin,
        winningAreasCount: winningAreas.length,
        trailingAreasCount: trailingAreas.length,
        closeContestAreasCount: closeContestAreas.length,
        unsurveyedAreasCount: unsurveyedAreas.length,
        winningAreas,
        trailingAreas,
        closeContestAreas,
      },
      children,
      boothRollups: childrenAndBooths.boothRollups,
      operations: operationsData,
    };
  }

  /**
   * Exact DB counts of subordinate geographic units within scope.
   */
  private static async computeHierarchyCounts(
    level: OrgHierarchyLevel,
    geoId: string | null,
    pollingStationId: string | null,
    psBoothIds: string[]
  ): Promise<Record<string, number>> {
    const counts: Record<string, number> = {
      ZONE: 0,
      PARLIAMENT: 0,
      CONSTITUENCY: 0,
      MANDAL: 0,
      POLLING_STATION: 0,
      VILLAGE: 0,
      BOOTH: 0,
      VOTER_GROUP: 0,
    };

    if (!geoId) return counts;

    if (pollingStationId) {
      const vgCount = psBoothIds.length > 0
        ? await prisma.voterGroup.count({ where: { boothId: { in: psBoothIds }, name: { not: 'Deleted Electors' } } })
        : 0;
      counts.POLLING_STATION = 1;
      counts.BOOTH = psBoothIds.length;
      counts.VOTER_GROUP = vgCount;
      return counts;
    }

    if (level === OrgHierarchyLevel.STATE) {
      const [z, p, c, m, ps, v, b, vg] = await Promise.all([
        prisma.zone.count({ where: { stateId: geoId } }),
        prisma.parliament.count({ where: { zone: { stateId: geoId } } }),
        prisma.constituency.count({ where: { parliament: { zone: { stateId: geoId } } } }),
        prisma.mandal.count({ where: { constituency: { parliament: { zone: { stateId: geoId } } } } }),
        prisma.pollingStation.count({ where: { constituency: { parliament: { zone: { stateId: geoId } } } } }),
        prisma.village.count({ where: { mandal: { constituency: { parliament: { zone: { stateId: geoId } } } } } }),
        prisma.booth.count({ where: { village: { mandal: { constituency: { parliament: { zone: { stateId: geoId } } } } } } }),
        prisma.voterGroup.count({ where: { booth: { village: { mandal: { constituency: { parliament: { zone: { stateId: geoId } } } } } }, name: { not: 'Deleted Electors' } } }),
      ]);
      counts.ZONE = z; counts.PARLIAMENT = p; counts.CONSTITUENCY = c; counts.MANDAL = m;
      counts.POLLING_STATION = ps; counts.VILLAGE = v; counts.BOOTH = b; counts.VOTER_GROUP = vg;
    } else if (level === OrgHierarchyLevel.ZONE) {
      const [p, c, m, ps, v, b, vg] = await Promise.all([
        prisma.parliament.count({ where: { zoneId: geoId } }),
        prisma.constituency.count({ where: { parliament: { zoneId: geoId } } }),
        prisma.mandal.count({ where: { constituency: { parliament: { zoneId: geoId } } } }),
        prisma.pollingStation.count({ where: { constituency: { parliament: { zoneId: geoId } } } }),
        prisma.village.count({ where: { mandal: { constituency: { parliament: { zoneId: geoId } } } } }),
        prisma.booth.count({ where: { village: { mandal: { constituency: { parliament: { zoneId: geoId } } } } } }),
        prisma.voterGroup.count({ where: { booth: { village: { mandal: { constituency: { parliament: { zoneId: geoId } } } } }, name: { not: 'Deleted Electors' } } }),
      ]);
      counts.ZONE = 1; counts.PARLIAMENT = p; counts.CONSTITUENCY = c; counts.MANDAL = m;
      counts.POLLING_STATION = ps; counts.VILLAGE = v; counts.BOOTH = b; counts.VOTER_GROUP = vg;
    } else if (level === OrgHierarchyLevel.PARLIAMENT) {
      const [c, m, ps, v, b, vg] = await Promise.all([
        prisma.constituency.count({ where: { parliamentId: geoId } }),
        prisma.mandal.count({ where: { constituency: { parliamentId: geoId } } }),
        prisma.pollingStation.count({ where: { constituency: { parliamentId: geoId } } }),
        prisma.village.count({ where: { mandal: { constituency: { parliamentId: geoId } } } }),
        prisma.booth.count({ where: { village: { mandal: { constituency: { parliamentId: geoId } } } } }),
        prisma.voterGroup.count({ where: { booth: { village: { mandal: { constituency: { parliamentId: geoId } } } }, name: { not: 'Deleted Electors' } } }),
      ]);
      counts.PARLIAMENT = 1; counts.CONSTITUENCY = c; counts.MANDAL = m;
      counts.POLLING_STATION = ps; counts.VILLAGE = v; counts.BOOTH = b; counts.VOTER_GROUP = vg;
    } else if (level === OrgHierarchyLevel.CONSTITUENCY) {
      const [m, ps, v, b, vg] = await Promise.all([
        prisma.mandal.count({ where: { constituencyId: geoId } }),
        prisma.pollingStation.count({ where: { constituencyId: geoId } }),
        prisma.village.count({ where: { mandal: { constituencyId: geoId } } }),
        prisma.booth.count({ where: { village: { mandal: { constituencyId: geoId } } } }),
        prisma.voterGroup.count({ where: { booth: { village: { mandal: { constituencyId: geoId } } }, name: { not: 'Deleted Electors' } } }),
      ]);
      counts.CONSTITUENCY = 1; counts.MANDAL = m; counts.POLLING_STATION = ps; counts.VILLAGE = v; counts.BOOTH = b; counts.VOTER_GROUP = vg;
    } else if (level === OrgHierarchyLevel.MANDAL) {
      const [ps, v, b, vg] = await Promise.all([
        prisma.pollingStation.count({ where: { mandalId: geoId } }),
        prisma.village.count({ where: { mandalId: geoId } }),
        prisma.booth.count({ where: { village: { mandalId: geoId } } }),
        prisma.voterGroup.count({ where: { booth: { village: { mandalId: geoId } }, name: { not: 'Deleted Electors' } } }),
      ]);
      counts.MANDAL = 1; counts.POLLING_STATION = ps; counts.VILLAGE = v; counts.BOOTH = b; counts.VOTER_GROUP = vg;
    } else if (level === OrgHierarchyLevel.VILLAGE) {
      const [b, vg] = await Promise.all([
        prisma.booth.count({ where: { villageId: geoId } }),
        prisma.voterGroup.count({ where: { booth: { villageId: geoId }, name: { not: 'Deleted Electors' } } }),
      ]);
      counts.VILLAGE = 1; counts.BOOTH = b; counts.VOTER_GROUP = vg;
    } else if (level === OrgHierarchyLevel.BOOTH) {
      const vg = await prisma.voterGroup.count({ where: { boothId: geoId, name: { not: 'Deleted Electors' } } });
      counts.BOOTH = 1; counts.VOTER_GROUP = vg;
    } else if (level === OrgHierarchyLevel.VOTER_GROUP) {
      counts.VOTER_GROUP = 1;
    }

    return counts;
  }

  /**
   * Computes SQL-aggregated child geographic rollups (and booth rollups for Mandals/Villages).
   * Falls back to OrganizationUnit subtree rollups when no geographic children exist (legacy unit-only data).
   */
  private static async computeChildAndBoothRollups(params: {
    targetGeoLevel: OrgHierarchyLevel;
    resolvedGeoId: string | null;
    resolvedPollingStationId: string | null;
    psBoothIds: string[];
    whereClause: Prisma.Sql;
    primaryPartyCode: string;
    allUnits: Array<{ id: string; parentId: string | null; level: OrgHierarchyLevel; name: string; code: string | null }>;
    byParent: Map<string | null, Array<{ id: string; parentId: string | null; level: OrgHierarchyLevel; name: string; code: string | null }>>;
    rootOrgUnitId: string | null;
  }): Promise<{ children: ChildAreaRollup[]; boothRollups: ChildAreaRollup[] }> {
    const {
      targetGeoLevel,
      resolvedGeoId,
      resolvedPollingStationId,
      psBoothIds,
      whereClause,
      primaryPartyCode,
      allUnits,
      byParent,
      rootOrgUnitId,
    } = params;

    const aggregateByColumn = async (
      colName: 'constituencyId' | 'mandalId' | 'villageId' | 'boothId' | 'voterGroupId',
      entities: Array<{ id: string; name: string; code: string | null; level: string }>
    ): Promise<ChildAreaRollup[]> => {
      if (entities.length === 0) return [];

      const colSql = Prisma.raw(`"${colName}"`);
      const [baseRows, prefRows] = await Promise.all([
        prisma.$queryRaw<
          Array<{
            entityId: string;
            totalVoters: number;
            voted: number;
            surveyed: number;
            fakeVoters: number;
            local: number;
            migrated: number;
          }>
        >`
          SELECT
            ${colSql}::text AS "entityId",
            COUNT(*)::int AS "totalVoters",
            COUNT(*) FILTER (WHERE "voteStatus" = 'VOTE_DONE')::int AS "voted",
            COUNT(*) FILTER (WHERE "surveyStatus" IN ('SURVEYED', 'VERIFIED'))::int AS "surveyed",
            COUNT(*) FILTER (WHERE "voterStatus" = 'FAKE')::int AS "fakeVoters",
            COUNT(*) FILTER (WHERE "voterLocationStatus" = 'LOCAL')::int AS "local",
            COUNT(*) FILTER (WHERE "voterLocationStatus" = 'MIGRATED')::int AS "migrated"
          FROM "Voter"
          WHERE ${whereClause} AND ${colSql} IS NOT NULL
          GROUP BY ${colSql}
        `,
        prisma.$queryRaw<
          Array<{ entityId: string; politicalPreference: string; count: number }>
        >`
          SELECT
            ${colSql}::text AS "entityId",
            COALESCE(NULLIF(UPPER(TRIM("politicalPreference")), ''), 'NEUTRAL') AS "politicalPreference",
            COUNT(*)::int AS count
          FROM "Voter"
          WHERE ${whereClause} AND ${colSql} IS NOT NULL
          GROUP BY ${colSql}, COALESCE(NULLIF(UPPER(TRIM("politicalPreference")), ''), 'NEUTRAL')
        `,
      ]);

      const baseMap = new Map(baseRows.map((r) => [r.entityId, r]));
      const prefMap = new Map<string, Record<string, number>>();
      for (const pr of prefRows) {
        const entry = prefMap.get(pr.entityId) || {};
        entry[pr.politicalPreference] = (entry[pr.politicalPreference] || 0) + Number(pr.count || 0);
        prefMap.set(pr.entityId, entry);
      }

      return entities.map((ent) => {
        const b = baseMap.get(ent.id);
        const totalVoters = Number(b?.totalVoters || 0);
        const voted = Number(b?.voted || 0);
        const notVoted = Math.max(0, totalVoters - voted);
        const surveyed = Number(b?.surveyed || 0);
        const fakeVoters = Number(b?.fakeVoters || 0);
        const local = Number(b?.local || 0);
        const migrated = Number(b?.migrated || 0);
        const partyPreference = prefMap.get(ent.id) || { [primaryPartyCode]: 0, NEUTRAL: totalVoters };
        const standing = this.evaluatePartyStanding(partyPreference, primaryPartyCode, totalVoters);

        return {
          unitId: ent.id,
          id: ent.id,
          name: ent.name,
          code: ent.code,
          level: ent.level,
          totalVoters,
          voted,
          notVoted,
          surveyed,
          fakeVoters,
          local,
          migrated,
          partyPreference,
          primaryPartyCode,
          primaryPartyVotes: standing.primaryPartyVotes,
          topOpponentCode: standing.topOpponentCode,
          topOpponentVotes: standing.topOpponentVotes,
          tdp: Number(partyPreference.TDP || 0),
          ysrcp: Number(partyPreference.YSRCP || 0),
          lead: standing.lead,
          margin: standing.margin,
          leadingParty: standing.leadingParty,
          status: standing.status,
        };
      });
    };

    let children: ChildAreaRollup[] = [];
    let boothRollups: ChildAreaRollup[] = [];

    if (resolvedGeoId) {
      if (resolvedPollingStationId) {
        const booths = psBoothIds.length > 0
          ? await prisma.booth.findMany({
              where: { id: { in: psBoothIds } },
              orderBy: { boothNumber: 'asc' },
              select: { id: true, name: true, boothNumber: true, code: true },
            })
          : [];
        boothRollups = await aggregateByColumn(
          'boothId',
          booths.map((b) => ({ id: b.id, name: b.name || `Booth ${b.boothNumber}`, code: b.code, level: 'BOOTH' }))
        );
        children = boothRollups;
      } else if (targetGeoLevel === OrgHierarchyLevel.STATE) {
        const constituencies = await prisma.constituency.findMany({
          where: { parliament: { zone: { stateId: resolvedGeoId } } },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, code: true },
        });
        children = await aggregateByColumn(
          'constituencyId',
          constituencies.map((c) => ({ id: c.id, name: c.name, code: c.code, level: 'CONSTITUENCY' }))
        );
      } else if (targetGeoLevel === OrgHierarchyLevel.ZONE) {
        const constituencies = await prisma.constituency.findMany({
          where: { parliament: { zoneId: resolvedGeoId } },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, code: true },
        });
        children = await aggregateByColumn(
          'constituencyId',
          constituencies.map((c) => ({ id: c.id, name: c.name, code: c.code, level: 'CONSTITUENCY' }))
        );
      } else if (targetGeoLevel === OrgHierarchyLevel.PARLIAMENT) {
        const constituencies = await prisma.constituency.findMany({
          where: { parliamentId: resolvedGeoId },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, code: true },
        });
        children = await aggregateByColumn(
          'constituencyId',
          constituencies.map((c) => ({ id: c.id, name: c.name, code: c.code, level: 'CONSTITUENCY' }))
        );
      } else if (targetGeoLevel === OrgHierarchyLevel.CONSTITUENCY) {
        const mandals = await prisma.mandal.findMany({
          where: { constituencyId: resolvedGeoId },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, code: true },
        });
        children = await aggregateByColumn(
          'mandalId',
          mandals.map((m) => ({ id: m.id, name: m.name, code: m.code, level: 'MANDAL' }))
        );
      } else if (targetGeoLevel === OrgHierarchyLevel.MANDAL) {
        const [villages, booths] = await Promise.all([
          prisma.village.findMany({
            where: { mandalId: resolvedGeoId },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, code: true },
          }),
          prisma.booth.findMany({
            where: { village: { mandalId: resolvedGeoId } },
            orderBy: { boothNumber: 'asc' },
            select: { id: true, name: true, boothNumber: true, code: true },
          }),
        ]);
        const [villageRollups, mandalBoothRollups] = await Promise.all([
          aggregateByColumn(
            'villageId',
            villages.map((v) => ({ id: v.id, name: v.name, code: v.code, level: 'VILLAGE' }))
          ),
          aggregateByColumn(
            'boothId',
            booths.map((b) => ({ id: b.id, name: b.name || `Booth ${b.boothNumber}`, code: b.code, level: 'BOOTH' }))
          ),
        ]);
        children = villageRollups;
        boothRollups = mandalBoothRollups;
      } else if (targetGeoLevel === OrgHierarchyLevel.VILLAGE) {
        const booths = await prisma.booth.findMany({
          where: { villageId: resolvedGeoId },
          orderBy: { boothNumber: 'asc' },
          select: { id: true, name: true, boothNumber: true, code: true },
        });
        boothRollups = await aggregateByColumn(
          'boothId',
          booths.map((b) => ({ id: b.id, name: b.name || `Booth ${b.boothNumber}`, code: b.code, level: 'BOOTH' }))
        );
        children = boothRollups;
      } else if (targetGeoLevel === OrgHierarchyLevel.BOOTH) {
        const groups = await prisma.voterGroup.findMany({
          where: { boothId: resolvedGeoId, name: { not: 'Deleted Electors' } },
          orderBy: { rangeStart: 'asc' },
          select: { id: true, name: true, code: true },
        });
        children = await aggregateByColumn(
          'voterGroupId',
          groups.map((g) => ({ id: g.id, name: g.name, code: g.code, level: 'VOTER_GROUP' }))
        );
      }
    }

    // Legacy OrganizationUnit fallback if no geographic children exist
    if (children.length === 0 && rootOrgUnitId) {
      const directChildren = allUnits.filter((u) => u.parentId === rootOrgUnitId);
      if (directChildren.length > 0) {
        const [unitBaseRows, unitPrefRows] = await Promise.all([
          prisma.$queryRaw<Array<{ unitId: string; total: number; voted: number; surveyed: number; fake: number; local: number; migrated: number }>>`
            SELECT
              "unitId"::text AS "unitId",
              COUNT(*)::int AS "total",
              COUNT(*) FILTER (WHERE "voteStatus" = 'VOTE_DONE')::int AS "voted",
              COUNT(*) FILTER (WHERE "surveyStatus" IN ('SURVEYED', 'VERIFIED'))::int AS "surveyed",
              COUNT(*) FILTER (WHERE "voterStatus" = 'FAKE')::int AS "fake",
              COUNT(*) FILTER (WHERE "voterLocationStatus" = 'LOCAL')::int AS "local",
              COUNT(*) FILTER (WHERE "voterLocationStatus" = 'MIGRATED')::int AS "migrated"
            FROM "Voter"
            WHERE ${whereClause} AND "unitId" IS NOT NULL
            GROUP BY "unitId"
          `,
          prisma.$queryRaw<Array<{ unitId: string; pref: string; count: number }>>`
            SELECT
              "unitId"::text AS "unitId",
              COALESCE(NULLIF(UPPER(TRIM("politicalPreference")), ''), 'NEUTRAL') AS "pref",
              COUNT(*)::int AS count
            FROM "Voter"
            WHERE ${whereClause} AND "unitId" IS NOT NULL
            GROUP BY "unitId", COALESCE(NULLIF(UPPER(TRIM("politicalPreference")), ''), 'NEUTRAL')
          `,
        ]);

        const baseMap = new Map(unitBaseRows.map((r) => [r.unitId, r]));
        const prefMap = new Map<string, Record<string, number>>();
        for (const pr of unitPrefRows) {
          const m = prefMap.get(pr.unitId) || {};
          m[pr.pref] = (m[pr.pref] || 0) + Number(pr.count || 0);
          prefMap.set(pr.unitId, m);
        }

        children = directChildren.map((child) => {
          const desc = new Set<string>([child.id]);
          const q = [child.id];
          while (q.length > 0) {
            const c = q.shift()!;
            (byParent.get(c) ?? []).forEach((k) => {
              desc.add(k.id);
              q.push(k.id);
            });
          }

          let totalVoters = 0, voted = 0, surveyed = 0, fakeVoters = 0, local = 0, migrated = 0;
          const partyPreference: Record<string, number> = {};
          for (const uid of desc) {
            const b = baseMap.get(uid);
            if (b) {
              totalVoters += Number(b.total || 0);
              voted += Number(b.voted || 0);
              surveyed += Number(b.surveyed || 0);
              fakeVoters += Number(b.fake || 0);
              local += Number(b.local || 0);
              migrated += Number(b.migrated || 0);
            }
            const p = prefMap.get(uid);
            if (p) {
              for (const [k, v] of Object.entries(p)) {
                partyPreference[k] = (partyPreference[k] || 0) + v;
              }
            }
          }

          const standing = this.evaluatePartyStanding(partyPreference, primaryPartyCode, totalVoters);
          return {
            unitId: child.id,
            id: child.id,
            name: child.name,
            code: child.code,
            level: child.level,
            totalVoters,
            voted,
            notVoted: Math.max(0, totalVoters - voted),
            surveyed,
            fakeVoters,
            local,
            migrated,
            partyPreference,
            primaryPartyCode,
            primaryPartyVotes: standing.primaryPartyVotes,
            topOpponentCode: standing.topOpponentCode,
            topOpponentVotes: standing.topOpponentVotes,
            tdp: Number(partyPreference.TDP || 0),
            ysrcp: Number(partyPreference.YSRCP || 0),
            lead: standing.lead,
            margin: standing.margin,
            leadingParty: standing.leadingParty,
            status: standing.status,
          };
        });
      }
    }

    return { children, boothRollups };
  }

  /**
   * Computes cadre, task, and training operational rollups across both geographic assignments and OrganizationUnits.
   */
  private static async computeOperationsRollups(
    level: OrgHierarchyLevel,
    geoId: string | null,
    pollingStationId: string | null,
    psBoothIds: string[],
    descendantUnitIds: string[]
  ) {
    const assignWhere: Prisma.UserHierarchyAssignmentWhereInput = { isActive: true };
    let hasGeoAssignFilter = false;

    if (pollingStationId) {
      assignWhere.OR = [
        { pollingStationId },
        ...(psBoothIds.length > 0 ? [{ boothId: { in: psBoothIds } }] : []),
      ];
      hasGeoAssignFilter = true;
    } else if (geoId) {
      if (level === OrgHierarchyLevel.STATE) { assignWhere.stateId = geoId; hasGeoAssignFilter = true; }
      else if (level === OrgHierarchyLevel.ZONE) { assignWhere.zoneId = geoId; hasGeoAssignFilter = true; }
      else if (level === OrgHierarchyLevel.PARLIAMENT) { assignWhere.parliamentId = geoId; hasGeoAssignFilter = true; }
      else if (level === OrgHierarchyLevel.CONSTITUENCY) { assignWhere.constituencyId = geoId; hasGeoAssignFilter = true; }
      else if (level === OrgHierarchyLevel.MANDAL) { assignWhere.mandalId = geoId; hasGeoAssignFilter = true; }
      else if (level === OrgHierarchyLevel.VILLAGE) { assignWhere.villageId = geoId; hasGeoAssignFilter = true; }
      else if (level === OrgHierarchyLevel.BOOTH) { assignWhere.boothId = geoId; hasGeoAssignFilter = true; }
      else if (level === OrgHierarchyLevel.VOTER_GROUP) { assignWhere.voterGroupId = geoId; hasGeoAssignFilter = true; }
    }

    const userWhereOr: Prisma.UserWhereInput[] = [];
    if (descendantUnitIds.length > 0) {
      userWhereOr.push({ unitId: { in: descendantUnitIds } });
    }
    if (hasGeoAssignFilter) {
      userWhereOr.push({ hierarchyAssignments: { some: assignWhere } });
    }

    const [cadres, taskCounts, trainingCounts] = await Promise.all([
      userWhereOr.length > 0
        ? prisma.user.findMany({
            where: { OR: userWhereOr },
            select: { id: true, cadreProfile: { select: { performanceScore: true } } },
          })
        : Promise.resolve([]),
      descendantUnitIds.length > 0
        ? prisma.task.groupBy({
            by: ['status'],
            where: { unitId: { in: descendantUnitIds } },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      userWhereOr.length > 0
        ? prisma.trainingProgress.groupBy({
            by: ['status'],
            where: { user: { OR: userWhereOr } },
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ]);

    const teamStrength = cadres.length;
    const cadrePerformance = {
      totalCadres: teamStrength,
      averageScore:
        cadres.length > 0
          ? Math.round(cadres.reduce((sum, c) => sum + (c.cadreProfile?.performanceScore ?? 80), 0) / cadres.length)
          : 0,
    };

    let totalTasks = 0, completedTasks = 0, pendingTasks = 0, inProgressTasks = 0;
    taskCounts.forEach((t) => {
      const c = Number(t._count._all || 0);
      totalTasks += c;
      if (t.status === TaskStatus.COMPLETED) completedTasks += c;
      else if (t.status === TaskStatus.PENDING) pendingTasks += c;
      else if (t.status === TaskStatus.IN_PROGRESS) inProgressTasks += c;
    });

    let totalTrainingAssigned = 0, completedTraining = 0;
    trainingCounts.forEach((tr) => {
      const c = Number(tr._count._all || 0);
      totalTrainingAssigned += c;
      if (tr.status === TrainingStatus.COMPLETED) completedTraining += c;
    });

    return {
      teamStrength,
      cadrePerformance,
      taskPerformance: {
        totalTasks,
        completed: completedTasks,
        pending: pendingTasks,
        inProgress: inProgressTasks,
        completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      },
      trainingPerformance: {
        totalAssigned: totalTrainingAssigned,
        completed: completedTraining,
        completionRate: totalTrainingAssigned > 0 ? Math.round((completedTraining / totalTrainingAssigned) * 100) : 0,
      },
    };
  }

  /**
   * Filterable server-side SQL demographics & caste analytics for the caller's authorized scope.
   */
  static async computeDemographicsForScope(
    scope: UserHierarchyScope,
    userId: string,
    filters: DemographicFilterOptions = {}
  ) {
    const target = await this.resolveScopeTarget(scope, userId);
    const conditions: Prisma.Sql[] = [Prisma.sql`("voterStatus" IS NULL OR "voterStatus" IN ('ACTIVE', 'SHIFTED'))`];

    if (target.pollingStationId) {
      const ps = await prisma.pollingStation.findUnique({
        where: { id: target.pollingStationId },
        include: { booths: { select: { id: true } } },
      });
      let bIds = (ps?.booths || []).map((b) => b.id);
      if (bIds.length === 0 && ps) {
        const fallbackBooths = await prisma.booth.findMany({
          where: {
            village: { mandalId: ps.mandalId },
            OR: [
              { pollingStation: { equals: ps.name, mode: 'insensitive' } },
              { name: { contains: ps.name, mode: 'insensitive' } },
              { village: { name: { equals: ps.name, mode: 'insensitive' } } },
            ],
          },
          select: { id: true },
        });
        bIds = fallbackBooths.map((b) => b.id);
        if (bIds.length > 0) {
          await prisma.booth.updateMany({
            where: { id: { in: bIds } },
            data: { pollingStationId: ps.id },
          }).catch(() => {});
        }
      }
      if (bIds.length === 0) {
        return {
          totalVoters: 0,
          caste: {},
          profession: {},
          gender: { Male: 0, Female: 0, Other: 0 },
          age: { '18-25': 0, '26-40': 0, '41-60': 0, '60+': 0 },
          partyPreference: {},
          villageBreakdown: [],
          availableFilters: { villages: [], castes: [], professions: [] },
        };
      }
      conditions.push(Prisma.sql`"boothId" IN (${Prisma.join(bIds.map((id) => Prisma.sql`${id}::uuid`))})`);
    } else if (target.geoEntityId) {
      const colByLevel: Record<OrgHierarchyLevel, string> = {
        STATE: 'stateId',
        ZONE: 'zoneId',
        PARLIAMENT: 'parliamentId',
        CONSTITUENCY: 'constituencyId',
        MANDAL: 'mandalId',
        VILLAGE: 'villageId',
        BOOTH: 'boothId',
        VOTER_GROUP: 'voterGroupId',
      };
      const col = colByLevel[target.geoLevel];
      conditions.push(Prisma.sql`${Prisma.raw(`"${col}"`)} = ${target.geoEntityId}::uuid`);
    } else if (target.unitId) {
      conditions.push(Prisma.sql`"unitId" = ${target.unitId}::uuid`);
    }

    const baseScopeWhere = Prisma.join(conditions, ' AND ');
    const filteredConditions: Prisma.Sql[] = [...conditions];

    if (filters.villageId && filters.villageId !== 'all') {
      filteredConditions.push(Prisma.sql`"villageId" = ${filters.villageId}::uuid`);
    } else if (filters.village && filters.village !== 'all') {
      filteredConditions.push(Prisma.sql`"villageId" IN (SELECT "id" FROM "Village" WHERE LOWER(TRIM("name")) = LOWER(TRIM(${filters.village})))`);
    }

    if (filters.boothId && filters.boothId !== 'all') {
      filteredConditions.push(Prisma.sql`"boothId" = ${filters.boothId}::uuid`);
    }
    if (filters.caste && filters.caste !== 'all') {
      filteredConditions.push(Prisma.sql`LOWER(COALESCE(NULLIF(TRIM("caste"), ''), 'Unknown')) = LOWER(TRIM(${filters.caste}))`);
    }
    if (filters.gender && filters.gender !== 'all') {
      const g = filters.gender.trim().toUpperCase();
      filteredConditions.push(Prisma.sql`"gender" = ${g}`);
    }
    if (filters.ageGroup && filters.ageGroup !== 'all') {
      if (filters.ageGroup === '18-25') filteredConditions.push(Prisma.sql`"age" >= 18 AND "age" <= 25`);
      else if (filters.ageGroup === '26-40') filteredConditions.push(Prisma.sql`"age" >= 26 AND "age" <= 40`);
      else if (filters.ageGroup === '41-60') filteredConditions.push(Prisma.sql`"age" >= 41 AND "age" <= 60`);
      else if (filters.ageGroup === '60+') filteredConditions.push(Prisma.sql`"age" > 60`);
    }
    if (filters.profession && filters.profession !== 'all') {
      filteredConditions.push(Prisma.sql`LOWER(COALESCE(NULLIF(TRIM("profession"), ''), 'Other')) = LOWER(TRIM(${filters.profession}))`);
    }

    const filteredWhere = Prisma.join(filteredConditions, ' AND ');

    const [
      totalsRows,
      casteRows,
      professionRows,
      partyRows,
      villageRows,
      allCastesRows,
      allProfRows,
      allVillagesRows,
    ] = await Promise.all([
      prisma.$queryRaw<Array<{
        totalVoters: number;
        male: number; female: number; other: number;
        age_18_25: number; age_26_40: number; age_41_60: number; age_60_plus: number;
      }>>`
        SELECT
          COUNT(*)::int AS "totalVoters",
          COUNT(*) FILTER (WHERE "gender" = 'MALE')::int AS "male",
          COUNT(*) FILTER (WHERE "gender" = 'FEMALE')::int AS "female",
          COUNT(*) FILTER (WHERE "gender" = 'OTHER')::int AS "other",
          COUNT(*) FILTER (WHERE "age" <= 25)::int AS "age_18_25",
          COUNT(*) FILTER (WHERE "age" >= 26 AND "age" <= 40)::int AS "age_26_40",
          COUNT(*) FILTER (WHERE "age" >= 41 AND "age" <= 60)::int AS "age_41_60",
          COUNT(*) FILTER (WHERE "age" > 60)::int AS "age_60_plus"
        FROM "Voter"
        WHERE ${filteredWhere}
      `,
      prisma.$queryRaw<Array<{ caste: string; count: number }>>`
        SELECT COALESCE(NULLIF(TRIM("caste"), ''), 'Unknown') AS caste, COUNT(*)::int AS count
        FROM "Voter"
        WHERE ${filteredWhere}
        GROUP BY COALESCE(NULLIF(TRIM("caste"), ''), 'Unknown')
        ORDER BY count DESC
      `,
      prisma.$queryRaw<Array<{ profession: string; count: number }>>`
        SELECT COALESCE(NULLIF(TRIM("profession"), ''), 'Other') AS profession, COUNT(*)::int AS count
        FROM "Voter"
        WHERE ${filteredWhere}
        GROUP BY COALESCE(NULLIF(TRIM("profession"), ''), 'Other')
        ORDER BY count DESC
      `,
      prisma.$queryRaw<Array<{ pref: string; count: number }>>`
        SELECT COALESCE(NULLIF(UPPER(TRIM("politicalPreference")), ''), 'NEUTRAL') AS pref, COUNT(*)::int AS count
        FROM "Voter"
        WHERE ${filteredWhere}
        GROUP BY COALESCE(NULLIF(UPPER(TRIM("politicalPreference")), ''), 'NEUTRAL')
      `,
      prisma.$queryRaw<Array<{ villageId: string; villageName: string; count: number }>>`
        SELECT v."id"::text AS "villageId", v."name" AS "villageName", COUNT(vt."id")::int AS count
        FROM "Voter" vt
        JOIN "Village" v ON v."id" = vt."villageId"
        WHERE ${filteredWhere}
        GROUP BY v."id", v."name"
        ORDER BY count DESC
      `,
      prisma.$queryRaw<Array<{ val: string }>>`
        SELECT DISTINCT COALESCE(NULLIF(TRIM("caste"), ''), 'Unknown') AS val
        FROM "Voter"
        WHERE ${baseScopeWhere}
        ORDER BY val ASC
      `,
      prisma.$queryRaw<Array<{ val: string }>>`
        SELECT DISTINCT COALESCE(NULLIF(TRIM("profession"), ''), 'Other') AS val
        FROM "Voter"
        WHERE ${baseScopeWhere}
        ORDER BY val ASC
      `,
      prisma.$queryRaw<Array<{ id: string; name: string }>>`
        SELECT DISTINCT v."id"::text AS id, v."name" AS name
        FROM "Voter" vt
        JOIN "Village" v ON v."id" = vt."villageId"
        WHERE ${baseScopeWhere}
        ORDER BY v."name" ASC
      `,
    ]);

    const t = totalsRows[0] || { totalVoters: 0, male: 0, female: 0, other: 0, age_18_25: 0, age_26_40: 0, age_41_60: 0, age_60_plus: 0 };
    const caste: Record<string, number> = {};
    casteRows.forEach((r) => { caste[r.caste] = Number(r.count || 0); });
    const profession: Record<string, number> = {};
    professionRows.forEach((r) => { profession[r.profession] = Number(r.count || 0); });
    const partyPreference: Record<string, number> = {};
    partyRows.forEach((r) => { partyPreference[r.pref] = Number(r.count || 0); });

    return {
      totalVoters: Number(t.totalVoters || 0),
      gender: {
        Male: Number(t.male || 0),
        Female: Number(t.female || 0),
        Other: Number(t.other || 0),
      },
      age: {
        '18-25': Number(t.age_18_25 || 0),
        '26-40': Number(t.age_26_40 || 0),
        '41-60': Number(t.age_41_60 || 0),
        '60+': Number(t.age_60_plus || 0),
      },
      caste,
      profession,
      partyPreference,
      villageBreakdown: villageRows.map((v) => ({
        id: v.villageId,
        name: v.villageName,
        count: Number(v.count || 0),
      })),
      availableFilters: {
        villages: allVillagesRows.map((v) => ({ id: v.id, name: v.name })),
        castes: allCastesRows.map((r) => r.val).filter(Boolean),
        professions: allProfRows.map((r) => r.val).filter(Boolean),
      },
    };
  }
}
