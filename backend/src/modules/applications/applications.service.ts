import {
  AuditAction,
  Gender,
  ImportJobStatus,
  OrgHierarchyLevel,
  Prisma,
  RelationType,
  RoleType,
} from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { logAudit } from '../../middleware/audit.js';
import { AuthenticatedUserPayload, UserHierarchyScope } from '../../common/types.js';
import { assertRoleHierarchy } from '../../middleware/rbac.js';
import { getConstituencyLockKey } from '../../common/lock.js';

export interface RawImportRow {
  rowNumber?: number;
  epicNumber?: string;
  epic?: string;
  voterId?: string;
  name?: string;
  fullName?: string;
  relativeName?: string;
  fatherHusbandName?: string;
  relationType?: string;
  gender?: string;
  age?: number | string;
  houseNumber?: string;
  doorNo?: string;
  mobileNumber?: string;
  phone?: string;
  state?: string;
  parliament?: string;
  constituency?: string;
  mandal?: string;
  mandalName?: string;
  village?: string;
  villageName?: string;
  panchayat?: string;
  boothNumber?: string | number;
  booth?: string | number;
  voterGroup?: string;
  caste?: string;
  profession?: string;
  politicalPreference?: string;
  [key: string]: any;
}

export interface ValidationResult {
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

export interface SystemFieldDefinition {
  key: string;
  label: string;
  required: boolean;
  description: string;
  aliases: string[];
}

export const SYSTEM_FIELDS: SystemFieldDefinition[] = [
  {
    key: 'epicNumber',
    label: 'Voter ID / EPIC',
    required: true,
    description: 'Unique voter registration card number',
    aliases: ['voter id', 'epic', 'epic number', 'voter id / epic', 'epic_no', 'voter_id', 'card no', 'id'],
  },
  {
    key: 'fullName',
    label: 'Voter Full Name',
    required: true,
    description: 'Citizen legal full name',
    aliases: ['voter name', 'full name', 'name', 'citizen name', 'voter_name', 'candidate name'],
  },
  {
    key: 'relativeName',
    label: 'Father / Husband / Relative Name',
    required: false,
    description: 'Father or husband name as registered in electoral roll',
    aliases: ['relative name', 'father/husband name', 'father name', 'husband name', 'guardian name', 'relative_name'],
  },
  {
    key: 'relationType',
    label: 'Relation Type',
    required: false,
    description: 'FATHER, HUSBAND, MOTHER, or OTHER',
    aliases: ['relation type', 'relation', 'relationship', 'rel_type'],
  },
  {
    key: 'age',
    label: 'Age',
    required: true,
    description: 'Voter legal age (must be >= 18)',
    aliases: ['age', 'voter age', 'years'],
  },
  {
    key: 'gender',
    label: 'Gender',
    required: true,
    description: 'MALE, FEMALE, or OTHER',
    aliases: ['gender', 'sex'],
  },
  {
    key: 'mobileNumber',
    label: 'Mobile Number',
    required: false,
    description: '10-digit citizen contact number',
    aliases: ['mobile number', 'mobile', 'phone', 'contact', 'cell', 'phone number'],
  },
  {
    key: 'houseNumber',
    label: 'House / Door No',
    required: false,
    description: 'Residential address / door number',
    aliases: ['house number', 'door no', 'house no', 'address', 'h.no', 'door_no'],
  },
  {
    key: 'mandal',
    label: 'Mandal',
    required: true,
    description: 'Sub-district / administrative Mandal name',
    aliases: ['mandal', 'mandal name', 'tehsil', 'block', 'taluk'],
  },
  {
    key: 'village',
    label: 'Village / Ward',
    required: true,
    description: 'Revenue Village, Panchayat, or Urban Ward',
    aliases: ['village', 'village name', 'panchayat', 'ward', 'town', 'village / ward'],
  },
  {
    key: 'boothNumber',
    label: 'Booth Number',
    required: true,
    description: 'Assigned polling booth or part number',
    aliases: ['booth number', 'booth', 'part no', 'polling station no', 'booth no'],
  },
  {
    key: 'voterGroup',
    label: '100-Voter Group',
    required: false,
    description: 'Cluster / micro-incharge group name or number',
    aliases: ['voter group', '100-voter group', 'group', 'cluster', 'section', '100 voter incharge'],
  },
  {
    key: 'caste',
    label: 'Caste / Category',
    required: false,
    description: 'Demographic caste or social group',
    aliases: ['caste', 'community', 'category', 'sub-caste', 'social group'],
  },
  {
    key: 'profession',
    label: 'Profession',
    required: false,
    description: 'Primary occupation / livelihood',
    aliases: ['profession', 'occupation', 'job', 'work'],
  },
  {
    key: 'politicalPreference',
    label: 'Political Preference',
    required: false,
    description: 'Party leaning or neutral inclination',
    aliases: ['political preference', 'party preference', 'leaning', 'preference', 'party'],
  },
];

export class ApplicationsService {
  /**
   * Helper to resolve application configuration by ID, configKey, or fallback to default
   */
  static async resolveApplication(appIdOrKey: string): Promise<any> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(appIdOrKey);
    let config: any = await prisma.cMSConfiguration.findFirst({
      where: {
        OR: [
          ...(isUuid ? [{ id: appIdOrKey }, { organisationId: appIdOrKey }] : []),
          { configKey: appIdOrKey },
          { organisationName: { equals: appIdOrKey, mode: 'insensitive' } },
        ],
      },
      include: {
        organisation: {
          include: {
            states: {
              include: {
                zones: {
                  include: {
                    parliaments: {
                      include: {
                        constituencies: true,
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

    if (!config) {
      config = await prisma.cMSConfiguration.findFirst({
        where: { configKey: 'default' },
        include: {
          organisation: {
            include: {
              states: {
                include: {
                  zones: {
                    include: {
                      parliaments: {
                        include: {
                          constituencies: true,
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
    }

    if (!config) {
      config = await prisma.cMSConfiguration.findFirst({
        orderBy: { updatedAt: 'desc' },
        include: {
          organisation: {
            include: {
              states: {
                include: {
                  zones: {
                    include: {
                      parliaments: {
                        include: {
                          constituencies: true,
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
    }

    if (!config) {
      throw new Error(`Application with identifier '${appIdOrKey}' not found.`);
    }

    return config;
  }

  /**
   * Return all applications available on the platform
   */
  static async getApplications() {
    const configs = await prisma.cMSConfiguration.findMany({
      include: { organisation: true },
      orderBy: { updatedAt: 'desc' },
    });

    const activeParties = await prisma.politicalParty.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    const appsList: any[] = await Promise.all(
      configs.map(async (c) => {
        const activeParty = activeParties.find((p) => p.code === c.activePartyCode);
        const prioritizedParties = activeParty
          ? [
              { name: activeParty.name, code: activeParty.code, primaryColor: activeParty.primaryColor },
              ...activeParties
                .filter((p) => p.code !== activeParty.code)
                .map((p) => ({ name: p.name, code: p.code, primaryColor: p.primaryColor })),
            ]
          : activeParties.map((p) => ({ name: p.name, code: p.code, primaryColor: p.primaryColor }));

        const effectiveScope = c.appScope || 'SINGLE_MLA';
        const constituenciesCount = effectiveScope === 'SINGLE_MLA'
          ? 1
          : effectiveScope === 'PARLIAMENT_MP'
            ? 7
            : effectiveScope === 'ZONE'
              ? 21
              : 10;

        const votersCount = c.organisationId
          ? await prisma.voter.count({
              where: {
                OR: [
                  { state: { organisationId: c.organisationId } },
                  { constituency: { parliament: { zone: { state: { organisationId: c.organisationId } } } } },
                  { booth: { village: { mandal: { constituency: { parliament: { zone: { state: { organisationId: c.organisationId } } } } } } } },
                ],
              },
            })
          : 0;

        return {
          id: c.id,
          configKey: c.configKey,
          appName: c.organisationName,
          activePartyCode: c.activePartyCode || activeParty?.code || 'APP',
          candidateName: c.candidateName,
          primaryColor: c.primaryColor || activeParty?.primaryColor,
          secondaryColor: c.secondaryColor || activeParty?.secondaryColor,
          accentColor: c.accentColor || activeParty?.accentColor,
          activeHierarchyLevels: c.activeHierarchyLevels,
          stateName: c.stateName,
          appScope: effectiveScope,
          parliamentName: c.parliamentName,
          defaultLanguage: c.defaultLanguage,
          hierarchyLabels: c.hierarchyLabels,
          featureToggles: c.featureToggles,
          aiEnabled: c.aiEnabled,
          isDefault: c.configKey === 'default',
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          constituenciesCount,
          votersCount,
          partiesCount: activeParties.length,
          parties: prioritizedParties,
        };
      })
    );

    return appsList;
  }

  /**
   * Permanently delete an application, cascading to its political parties,
   * tenant organisation, and all associated hierarchy nodes and data.
   */
  static async deleteApplication(idOrKey: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrKey);
    const config = await prisma.cMSConfiguration.findFirst({
      where: {
        OR: [
          ...(isUuid ? [{ id: idOrKey }, { organisationId: idOrKey }] : []),
          { configKey: idOrKey },
          { organisationName: { equals: idOrKey, mode: 'insensitive' } },
        ],
      },
    });

    if (!config) {
      throw new Error(`Application '${idOrKey}' not found`);
    }

    const orgId = config.organisationId;
    const activePartyCode = config.activePartyCode;

    await prisma.$transaction(async (tx) => {
      // 1. Permanently delete all associated PoliticalParty records
      const partiesToDelete = await tx.politicalParty.findMany({
        where: {
          OR: [
            ...(activePartyCode ? [{ code: activePartyCode }] : []),
            ...(orgId ? [{ organisationId: orgId }] : []),
          ],
        },
        select: { id: true, code: true },
      });

      const partyIds = partiesToDelete.map((p) => p.id);

      if (partyIds.length > 0) {
        await tx.voter.updateMany({
          where: { politicalPartyId: { in: partyIds } },
          data: { politicalPartyId: null },
        });

        await tx.partyBranding.deleteMany({
          where: { partyId: { in: partyIds } },
        });

        await tx.partyPerformance.deleteMany({
          where: { partyId: { in: partyIds } },
        });

        await tx.politicalParty.deleteMany({
          where: { id: { in: partyIds } },
        });
      }

      // 2. Cascade purge tenant hierarchy and all attached entities
      if (orgId) {
        const states = await tx.state.findMany({ where: { organisationId: orgId }, select: { id: true } });
        const stateIds = states.map((s) => s.id);

        const zones = await tx.zone.findMany({ where: { stateId: { in: stateIds } }, select: { id: true } });
        const zoneIds = zones.map((z) => z.id);

        const parliaments = await tx.parliament.findMany({ where: { zoneId: { in: zoneIds } }, select: { id: true, code: true } });
        const parliamentIds = parliaments.map((p) => p.id);
        const parliamentCodes = parliaments.map((p) => p.code).filter(Boolean);

        const constituencies = await tx.constituency.findMany({ where: { parliamentId: { in: parliamentIds } }, select: { id: true, code: true } });
        const constituencyIds = constituencies.map((c) => c.id);
        const constituencyCodes = constituencies.map((c) => c.code).filter(Boolean);

        const mandals = await tx.mandal.findMany({ where: { constituencyId: { in: constituencyIds } }, select: { id: true, code: true } });
        const mandalIds = mandals.map((m) => m.id);
        const mandalCodes = mandals.map((m) => m.code).filter(Boolean);

        const villages = await tx.village.findMany({ where: { mandalId: { in: mandalIds } }, select: { id: true, code: true } });
        const villageIds = villages.map((v) => v.id);
        const villageCodes = villages.map((v) => v.code).filter(Boolean);

        const booths = await tx.booth.findMany({ where: { villageId: { in: villageIds } }, select: { id: true, code: true } });
        const boothIds = booths.map((b) => b.id);
        const boothCodes = booths.map((b) => b.code).filter(Boolean);

        const voterGroups = await tx.voterGroup.findMany({ where: { boothId: { in: boothIds } }, select: { id: true, code: true } });
        const voterGroupIds = voterGroups.map((vg) => vg.id);
        const voterGroupCodes = voterGroups.map((vg) => vg.code).filter(Boolean);

        const allUnitCodes = [
          ...parliamentCodes,
          ...constituencyCodes,
          ...mandalCodes,
          ...villageCodes,
          ...boothCodes,
          ...voterGroupCodes,
        ];

        const orgUnits = await tx.organizationUnit.findMany({
          where: { code: { in: allUnitCodes } },
          select: { id: true },
        });
        const orgUnitIds = orgUnits.map((u) => u.id);

        await tx.userHierarchyAssignment.deleteMany({
          where: {
            OR: [
              ...(stateIds.length > 0 ? [{ stateId: { in: stateIds } }] : []),
              ...(zoneIds.length > 0 ? [{ zoneId: { in: zoneIds } }] : []),
              ...(parliamentIds.length > 0 ? [{ parliamentId: { in: parliamentIds } }] : []),
              ...(constituencyIds.length > 0 ? [{ constituencyId: { in: constituencyIds } }] : []),
              ...(mandalIds.length > 0 ? [{ mandalId: { in: mandalIds } }] : []),
              ...(villageIds.length > 0 ? [{ villageId: { in: villageIds } }] : []),
              ...(boothIds.length > 0 ? [{ boothId: { in: boothIds } }] : []),
              ...(voterGroupIds.length > 0 ? [{ voterGroupId: { in: voterGroupIds } }] : []),
            ],
          },
        });

        if (boothIds.length > 0 || orgUnitIds.length > 0) {
          await tx.cadreAssignment.deleteMany({
            where: {
              OR: [
                ...(boothIds.length > 0 ? [{ boothId: { in: boothIds } }] : []),
                ...(orgUnitIds.length > 0 ? [{ unitId: { in: orgUnitIds } }] : []),
              ],
            },
          });
        }

        if (constituencyIds.length > 0 || boothIds.length > 0 || orgUnitIds.length > 0) {
          await tx.task.deleteMany({
            where: {
              OR: [
                ...(constituencyIds.length > 0 ? [{ constituencyId: { in: constituencyIds } }] : []),
                ...(mandalIds.length > 0 ? [{ mandalId: { in: mandalIds } }] : []),
                ...(villageIds.length > 0 ? [{ villageId: { in: villageIds } }] : []),
                ...(boothIds.length > 0 ? [{ boothId: { in: boothIds } }] : []),
                ...(orgUnitIds.length > 0 ? [{ unitId: { in: orgUnitIds } }] : []),
              ],
            },
          });

          await tx.groundReport.deleteMany({
            where: {
              OR: [
                ...(constituencyIds.length > 0 ? [{ constituencyId: { in: constituencyIds } }] : []),
                ...(mandalIds.length > 0 ? [{ mandalId: { in: mandalIds } }] : []),
                ...(villageIds.length > 0 ? [{ villageId: { in: villageIds } }] : []),
                ...(boothIds.length > 0 ? [{ boothId: { in: boothIds } }] : []),
                ...(orgUnitIds.length > 0 ? [{ unitId: { in: orgUnitIds } }] : []),
              ],
            },
          });

          await tx.pollingReport.deleteMany({
            where: {
              OR: [
                ...(boothIds.length > 0 ? [{ boothId: { in: boothIds } }] : []),
                ...(orgUnitIds.length > 0 ? [{ unitId: { in: orgUnitIds } }] : []),
              ],
            },
          });

          await tx.liveVoteEvent.deleteMany({
            where: {
              OR: [
                ...(orgUnitIds.length > 0 ? [{ unitId: { in: orgUnitIds } }] : []),
              ],
            },
          });

          await tx.electionProjection.deleteMany({
            where: {
              OR: [
                ...(constituencyIds.length > 0 ? [{ constituencyId: { in: constituencyIds } }] : []),
              ],
            },
          });

          await tx.aIInsight.deleteMany({
            where: {
              OR: [
                ...(constituencyIds.length > 0 ? [{ constituencyId: { in: constituencyIds } }] : []),
              ],
            },
          });

          await tx.newsArticle.deleteMany({
            where: {
              OR: [
                ...(constituencyIds.length > 0 ? [{ constituencyId: { in: constituencyIds } }] : []),
              ],
            },
          });

          await tx.socialTrend.deleteMany({
            where: {
              OR: [
                ...(constituencyIds.length > 0 ? [{ constituencyId: { in: constituencyIds } }] : []),
              ],
            },
          });

          await tx.dataImport.deleteMany({
            where: {
              OR: [
                ...(constituencyIds.length > 0 ? [{ targetConstituencyId: { in: constituencyIds } }] : []),
              ],
            },
          });
        }

        if (stateIds.length > 0 || constituencyIds.length > 0 || boothIds.length > 0) {
          await tx.voter.deleteMany({
            where: {
              OR: [
                ...(stateIds.length > 0 ? [{ stateId: { in: stateIds } }] : []),
                ...(zoneIds.length > 0 ? [{ zoneId: { in: zoneIds } }] : []),
                ...(parliamentIds.length > 0 ? [{ parliamentId: { in: parliamentIds } }] : []),
                ...(constituencyIds.length > 0 ? [{ constituencyId: { in: constituencyIds } }] : []),
                ...(mandalIds.length > 0 ? [{ mandalId: { in: mandalIds } }] : []),
                ...(villageIds.length > 0 ? [{ villageId: { in: villageIds } }] : []),
                ...(boothIds.length > 0 ? [{ boothId: { in: boothIds } }] : []),
                ...(voterGroupIds.length > 0 ? [{ voterGroupId: { in: voterGroupIds } }] : []),
                ...(orgUnitIds.length > 0 ? [{ unitId: { in: orgUnitIds } }] : []),
              ],
            },
          });
        }

        if (voterGroupIds.length > 0) await tx.voterGroup.deleteMany({ where: { id: { in: voterGroupIds } } });
        if (boothIds.length > 0) await tx.booth.deleteMany({ where: { id: { in: boothIds } } });
        if (villageIds.length > 0) await tx.village.deleteMany({ where: { id: { in: villageIds } } });
        if (mandalIds.length > 0) await tx.mandal.deleteMany({ where: { id: { in: mandalIds } } });
        if (constituencyIds.length > 0) await tx.constituency.deleteMany({ where: { id: { in: constituencyIds } } });
        if (parliamentIds.length > 0) await tx.parliament.deleteMany({ where: { id: { in: parliamentIds } } });
        if (zoneIds.length > 0) await tx.zone.deleteMany({ where: { id: { in: zoneIds } } });
        if (stateIds.length > 0) await tx.state.deleteMany({ where: { id: { in: stateIds } } });
        if (orgUnitIds.length > 0) {
          await tx.organizationUnit.updateMany({ where: { id: { in: orgUnitIds } }, data: { parentId: null } });
          await tx.organizationUnit.deleteMany({ where: { id: { in: orgUnitIds } } });
        }
      }

      // 3. Delete CMSConfiguration
      await tx.cMSConfiguration.delete({
        where: { id: config.id },
      });

      // 4. Clean up Organisation if not shared
      if (orgId) {
        const remainingConfigs = await tx.cMSConfiguration.count({
          where: { organisationId: orgId },
        });

        if (remainingConfigs === 0) {
          // Delete tenant users (cadres, incharges, candidates belonging to this tenant)
          await tx.user.deleteMany({
            where: {
              organisationId: orgId,
              NOT: { role: RoleType.SUPER_ADMIN },
            },
          });

          // Detach any super administrator
          await tx.user.updateMany({
            where: { organisationId: orgId },
            data: { organisationId: null },
          });

          await tx.organisation.delete({
            where: { id: orgId },
          });
        }
      }
    });

    return { id: config.id, deleted: true };
  }

  /**
   * Return detailed configuration for a specific application
   */
  static async getConfiguration(appId: string) {
    const config = await this.resolveApplication(appId);
    return {
      id: config.id,
      configKey: config.configKey,
      appName: config.organisationName,
      stateName: config.stateName,
      parliamentName: config.parliamentName,
      parliamentCode: config.parliamentCode,
      candidateName: config.candidateName,
      appScope: config.appScope || 'SINGLE_MLA',
      defaultLanguage: config.defaultLanguage,
      primaryColor: config.primaryColor || '#eab308',
      secondaryColor: config.secondaryColor || '#1e293b',
      accentColor: config.accentColor || '#3b82f6',
      logoUrl: config.logoUrl,
      hierarchyLabels: config.hierarchyLabels,
      activeHierarchyLevels: config.activeHierarchyLevels || [
        'STATE',
        'ZONE',
        'PARLIAMENT',
        'CONSTITUENCY',
        'MANDAL',
        'VILLAGE',
        'BOOTH',
        'VOTER_GROUP',
      ],
      featureToggles: config.featureToggles,
      aiEnabled: config.aiEnabled,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  /**
   * Return dynamic hierarchy tree and configured levels
   */
  static async getHierarchy(appId: string) {
    const config = await this.resolveApplication(appId);
    const activeLevels = Array.isArray(config.activeHierarchyLevels)
      ? (config.activeHierarchyLevels as string[])
      : ['STATE', 'ZONE', 'PARLIAMENT', 'CONSTITUENCY', 'MANDAL', 'VILLAGE', 'BOOTH', 'VOTER_GROUP'];

    const hierarchyLabels = (config.hierarchyLabels as Record<string, string>) || {
      STATE: 'State',
      ZONE: 'Zone',
      PARLIAMENT: 'Parliament',
      CONSTITUENCY: 'Constituency',
      MANDAL: 'Mandal',
      VILLAGE: 'Village',
      BOOTH: 'Booth',
      VOTER_GROUP: '100 Voters Incharge',
    };
    if (hierarchyLabels.VOTER_GROUP === 'Indiramma Incharge (100 Voters)' || hierarchyLabels.VOTER_GROUP?.includes('Indiramma')) {
      hierarchyLabels.VOTER_GROUP = '100 Voters Incharge';
    }

    const stateName = config.stateName || 'Andhra Pradesh';
    const state = await prisma.state.findFirst({
      where: { name: { equals: stateName, mode: 'insensitive' } },
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

    const allConstituencies = await prisma.constituency.findMany({
      include: {
        parliament: { include: { zone: { include: { state: true } } } },
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
      orderBy: { name: 'asc' },
    });

    return {
      applicationId: config.id,
      configKey: config.configKey,
      appName: config.organisationName,
      appScope: config.appScope || 'SINGLE_MLA',
      activeHierarchyLevels: activeLevels,
      hierarchyLabels,
      state: state || null,
      constituencies: allConstituencies,
    };
  }

  /**
   * Return child nodes for cascading dropdowns
   */
  static async getHierarchyNodesByLevel(appId: string, level: string, parentId?: string) {
    await this.resolveApplication(appId);
    const upperLevel = level.toUpperCase();

    switch (upperLevel) {
      case 'STATE':
        return prisma.state.findMany({ orderBy: { name: 'asc' } });
      case 'ZONE':
        return prisma.zone.findMany({
          where: parentId ? { stateId: parentId } : undefined,
          orderBy: { name: 'asc' },
        });
      case 'PARLIAMENT':
        return prisma.parliament.findMany({
          where: parentId ? { zoneId: parentId } : undefined,
          orderBy: { name: 'asc' },
        });
      case 'CONSTITUENCY':
        return prisma.constituency.findMany({
          where: parentId ? { parliamentId: parentId } : undefined,
          orderBy: { name: 'asc' },
        });
      case 'MANDAL':
        return prisma.mandal.findMany({
          where: parentId ? { constituencyId: parentId } : undefined,
          orderBy: { name: 'asc' },
        });
      case 'VILLAGE':
        return prisma.village.findMany({
          where: parentId ? { mandalId: parentId } : undefined,
          orderBy: { name: 'asc' },
        });
      case 'BOOTH':
        return prisma.booth.findMany({
          where: parentId ? { villageId: parentId } : undefined,
          orderBy: { boothNumber: 'asc' },
        });
      case 'VOTER_GROUP':
        return prisma.voterGroup.findMany({
          where: parentId ? { boothId: parentId } : undefined,
          orderBy: { name: 'asc' },
        });
      default:
        return [];
    }
  }

  /**
   * Return scoped constituencies with their data status, booth counts, and voter records
   */
  static async getConstituencies(appId: string, scopeFilters?: { stateId?: string; zoneId?: string; parliamentId?: string }) {
    const config = await this.resolveApplication(appId);
    const scope = config.appScope || 'SINGLE_MLA';

    const whereClause: Prisma.ConstituencyWhereInput = {};

    if (scopeFilters?.parliamentId) {
      whereClause.parliamentId = scopeFilters.parliamentId;
    } else if (scopeFilters?.zoneId) {
      whereClause.parliament = { zoneId: scopeFilters.zoneId };
    } else if (scopeFilters?.stateId) {
      whereClause.parliament = { zone: { stateId: scopeFilters.stateId } };
    } else if (scope === 'PARLIAMENT_MP' && config.parliamentName) {
      whereClause.parliament = {
        name: { contains: config.parliamentName, mode: 'insensitive' },
      };
    } else if (scope === 'SINGLE_MLA') {
      whereClause.OR = [
        { name: { contains: config.organisationName, mode: 'insensitive' } },
        { name: { contains: config.headerTitle || '', mode: 'insensitive' } },
      ];
    }

    let constituencies = await prisma.constituency.findMany({
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
      include: {
        parliament: {
          include: {
            zone: {
              include: {
                state: true,
              },
            },
          },
        },
        mandals: {
          include: {
            villages: {
              include: {
                booths: true,
              },
            },
          },
        },
        dataImports: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
    });

    if (constituencies.length === 0) {
      constituencies = await prisma.constituency.findMany({
        include: {
          parliament: {
            include: {
              zone: {
                include: {
                  state: true,
                },
              },
            },
          },
          mandals: {
            include: {
              villages: {
                include: {
                  booths: true,
                },
              },
            },
          },
          dataImports: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { name: 'asc' },
        take: 25,
      });
    }

    return constituencies.map((c) => {
      let boothCount = 0;
      let villageCount = 0;
      for (const m of c.mandals) {
        villageCount += m.villages.length;
        for (const v of m.villages) {
          boothCount += v.booths.length;
        }
      }

      const latestImport = c.dataImports?.[0];
      const status = latestImport?.status || (c.totalVoters > 0 ? 'SUCCESS' : 'PENDING');

      return {
        id: c.id,
        name: c.name,
        code: c.code,
        constituencyNumber: c.constituencyNumber,
        stateName: c.parliament?.zone?.state?.name || config.stateName || 'Andhra Pradesh',
        zoneName: c.parliament?.zone?.name || 'Central Zone',
        parliamentName: c.parliament?.name || config.parliamentName || 'Main Parliament',
        mandalsCount: c.mandals.length,
        villagesCount: villageCount,
        boothsCount: boothCount,
        totalVoters: c.totalVoters,
        lastImported: latestImport?.completedAt || latestImport?.createdAt || null,
        importStatus: status,
        importedRecords: latestImport?.importedRecords || c.totalVoters,
      };
    });
  }

  /**
   * Return single constituency detail
   */
  static async getConstituencyDetail(appId: string, constituencyId: string) {
    await this.resolveApplication(appId);
    const c = await prisma.constituency.findUnique({
      where: { id: constituencyId },
      include: {
        parliament: { include: { zone: { include: { state: true } } } },
        mandals: {
          include: {
            villages: {
              include: {
                booths: true,
              },
            },
          },
        },
        dataImports: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!c) {
      throw new Error(`Constituency with id '${constituencyId}' not found.`);
    }

    return c;
  }

  /**
   * Suggest auto-mapping of Excel columns to system fields
   */
  static suggestColumnMapping(headers: string[]) {
    const suggestions: Record<string, string> = {};
    const unmapped: string[] = [];

    headers.forEach((header) => {
      const normalized = header.trim().toLowerCase();
      let matchedKey: string | null = null;

      for (const field of SYSTEM_FIELDS) {
        if (field.aliases.includes(normalized) || field.label.toLowerCase() === normalized) {
          matchedKey = field.key;
          break;
        }
      }

      if (matchedKey) {
        suggestions[header] = matchedKey;
      } else {
        unmapped.push(header);
      }
    });

    return {
      suggestions,
      unmapped,
      systemFields: SYSTEM_FIELDS.map((f) => ({
        key: f.key,
        label: f.label,
        required: f.required,
        description: f.description,
      })),
    };
  }

  /**
   * Pre-flight validation of raw imported data before final database ingestion (Pure Validate-Only)
   */
  static async validateData(
    appId: string,
    level: string,
    rows: RawImportRow[],
    options?: {
      targetConstituencyId?: string;
      columnMapping?: Record<string, string>;
      fileName?: string;
    },
  ): Promise<ValidationResult> {
    const config = await this.resolveApplication(appId);
    const errors: ValidationResult['errors'] = [];
    const preview: ValidationResult['preview'] = [];

    const seenEpics = new Set<string>();
    const seenBoothsInVillage = new Set<string>();
    let duplicateCount = 0;
    let warningsCount = 0;
    let validRows = 0;

    // Check empty dataset
    if (!rows || rows.length === 0) {
      return {
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        duplicateCount: 0,
        warningsCount: 0,
        errors: [{ rowNumber: 0, field: 'file', message: 'The uploaded file contains no data rows', suggestion: 'Upload a spreadsheet with header and data rows', severity: 'ERROR' }],
        preview: [],
      };
    }

    const mapping = options?.columnMapping;

    // Extract value using mapping or direct raw keys
    const getRowValue = (row: any, systemKey: string): string => {
      if (mapping) {
        for (const [excelCol, mappedKey] of Object.entries(mapping)) {
          if (mappedKey === systemKey && row[excelCol] !== undefined && row[excelCol] !== '') {
            return String(row[excelCol]).trim();
          }
        }
      }
      switch (systemKey) {
        case 'epicNumber':
          return String(row.epicNumber || row.epic || row.voterId || row['Voter ID / EPIC'] || row['Voter ID'] || row['EPIC'] || '').trim();
        case 'fullName':
          return String(row.fullName || row.name || row['Full Name'] || row['Voter Name'] || '').trim();
        case 'relativeName':
          return String(row.relativeName || row.fatherHusbandName || row['Relative Name'] || row['Father/Husband Name'] || '').trim();
        case 'relationType':
          return String(row.relationType || row['Relation Type'] || '').trim();
        case 'age':
          return String(row.age || row['Age'] || '').trim();
        case 'gender':
          return String(row.gender || row['Gender'] || '').trim();
        case 'mobileNumber':
          return String(row.mobileNumber || row.phone || row['Mobile Number'] || '').trim();
        case 'houseNumber':
          return String(row.houseNumber || row.doorNo || row['House No'] || row['Door No'] || '').trim();
        case 'mandal':
          return String(row.mandal || row.mandalName || row['Mandal'] || '').trim();
        case 'village':
          return String(row.village || row.villageName || row.panchayat || row['Village'] || '').trim();
        case 'boothNumber':
          return String(row.boothNumber || row.booth || row['Booth Number'] || '').trim();
        case 'voterGroup':
          return String(row.voterGroup || row['100-Voter Group'] || row.cluster || '').trim();
        case 'caste':
          return String(row.caste || row['Caste'] || '').trim();
        case 'profession':
          return String(row.profession || row['Profession'] || '').trim();
        case 'politicalPreference':
          return String(row.politicalPreference || row['Political Preference'] || '').trim();
        default:
          return String(row[systemKey] || '').trim();
      }
    };

    // Pre-fetch existing voter EPICs in database to detect duplicates
    const allEpicsInFile: string[] = [];
    for (const r of rows) {
      const ep = getRowValue(r, 'epicNumber').toUpperCase();
      if (ep) allEpicsInFile.push(ep);
    }

    const existingDbEpics = new Set<string>();
    if (allEpicsInFile.length > 0) {
      const chunkSize = 2000;
      for (let i = 0; i < allEpicsInFile.length; i += chunkSize) {
        const slice = allEpicsInFile.slice(i, i + chunkSize);
        const dbFound = await prisma.voter.findMany({
          where: { epicNumber: { in: slice } },
          select: { epicNumber: true },
        });
        dbFound.forEach((v) => existingDbEpics.add(v.epicNumber));
      }
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;
      let rowStatus: 'VALID' | 'WARNING' | 'ERROR' = 'VALID';
      const rowReasons: string[] = [];

      const rawEpic = getRowValue(row, 'epicNumber').toUpperCase();
      const rawName = getRowValue(row, 'fullName');
      const rawAgeStr = getRowValue(row, 'age');
      const rawAge = parseInt(rawAgeStr || '0', 10);
      const rawGender = getRowValue(row, 'gender').toUpperCase();
      const rawMandal = getRowValue(row, 'mandal');
      const rawVillage = getRowValue(row, 'village');
      const rawBooth = getRowValue(row, 'boothNumber');
      const rawGroup = getRowValue(row, 'voterGroup');
      const rawMobile = getRowValue(row, 'mobileNumber');

      if (level === 'VOTER' || !level) {
        // EPIC Validation
        if (!rawEpic) {
          errors.push({
            rowNumber: rowNum,
            field: 'epicNumber',
            message: 'EPIC / Voter ID number is missing',
            suggestion: 'Enter unique EPIC Number (e.g. AP01234567)',
            severity: 'ERROR',
          });
          rowReasons.push('Missing EPIC Number');
          rowStatus = 'ERROR';
        } else if (seenEpics.has(rawEpic)) {
          duplicateCount++;
          errors.push({
            rowNumber: rowNum,
            field: 'epicNumber',
            value: rawEpic,
            message: `Duplicate EPIC '${rawEpic}' inside uploaded file`,
            suggestion: 'Remove duplicate record from spreadsheet',
            severity: 'ERROR',
          });
          rowReasons.push('Duplicate EPIC in file');
          rowStatus = 'ERROR';
        } else if (existingDbEpics.has(rawEpic)) {
          warningsCount++;
          rowReasons.push('EPIC already exists in database (will be updated)');
          if ((rowStatus as string) !== 'ERROR') rowStatus = 'WARNING';
        }
        if (rawEpic) seenEpics.add(rawEpic);

        // Name Validation
        if (!rawName) {
          errors.push({
            rowNumber: rowNum,
            field: 'fullName',
            message: 'Voter full name is required',
            suggestion: 'Enter citizen legal full name',
            severity: 'ERROR',
          });
          rowReasons.push('Missing Voter Name');
          rowStatus = 'ERROR';
        }

        // Age Validation
        if (!rawAgeStr || isNaN(rawAge) || rawAge < 18 || rawAge > 125) {
          errors.push({
            rowNumber: rowNum,
            field: 'age',
            value: rawAgeStr,
            message: `Invalid voter age '${rawAgeStr || 'empty'}'. Must be between 18 and 125`,
            suggestion: 'Provide legal voter age (>= 18)',
            severity: 'ERROR',
          });
          rowReasons.push('Invalid Age (<18 or >125)');
          rowStatus = 'ERROR';
        }

        // Gender Validation
        if (!rawGender || (!rawGender.startsWith('M') && !rawGender.startsWith('F') && !rawGender.startsWith('O'))) {
          errors.push({
            rowNumber: rowNum,
            field: 'gender',
            value: rawGender,
            message: `Invalid gender '${rawGender || 'empty'}'. Must be MALE, FEMALE, or OTHER`,
            suggestion: 'Specify MALE, FEMALE, or OTHER',
            severity: 'ERROR',
          });
          rowReasons.push('Invalid Gender');
          rowStatus = 'ERROR';
        }

        // Mobile Validation (warning only if invalid)
        if (rawMobile && !/^\d{10}$/.test(rawMobile.replace(/\D/g, ''))) {
          errors.push({
            rowNumber: rowNum,
            field: 'mobileNumber',
            value: rawMobile,
            message: `Invalid mobile number '${rawMobile}'. Expected 10 digits`,
            suggestion: 'Check mobile number formatting',
            severity: 'WARNING',
          });
          warningsCount++;
          if (rowStatus !== 'ERROR') rowStatus = 'WARNING';
          rowReasons.push('Invalid Mobile (non-10 digit)');
        }

        // Hierarchy parent-child checks
        if (!rawMandal) {
          errors.push({
            rowNumber: rowNum,
            field: 'mandal',
            message: 'Mandal name is required',
            suggestion: 'Specify valid Mandal',
            severity: 'ERROR',
          });
          rowReasons.push('Missing Mandal');
          rowStatus = 'ERROR';
        }

        if (!rawVillage) {
          errors.push({
            rowNumber: rowNum,
            field: 'village',
            message: 'Village / Ward name is required',
            suggestion: 'Specify Village / Ward',
            severity: 'ERROR',
          });
          rowReasons.push('Missing Village');
          rowStatus = 'ERROR';
        }

        if (!rawBooth) {
          errors.push({
            rowNumber: rowNum,
            field: 'boothNumber',
            message: 'Booth Number is required for voter assignment',
            suggestion: 'Specify Booth Number (e.g. 101)',
            severity: 'ERROR',
          });
          rowReasons.push('Missing Booth');
          rowStatus = 'ERROR';
        }
      } else if (level === 'BOOTH') {
        if (!rawBooth) {
          errors.push({
            rowNumber: rowNum,
            field: 'boothNumber',
            message: 'Booth Number is required',
            suggestion: 'Specify Booth Number',
            severity: 'ERROR',
          });
          rowReasons.push('Missing Booth Number');
          rowStatus = 'ERROR';
        }
        if (!rawVillage) {
          errors.push({
            rowNumber: rowNum,
            field: 'village',
            message: 'Parent Village is required',
            suggestion: 'Specify Village name',
            severity: 'ERROR',
          });
          rowReasons.push('Missing Parent Village');
          rowStatus = 'ERROR';
        }
        const boothKey = `${rawVillage.toLowerCase()}:${rawBooth.toLowerCase()}`;
        if (seenBoothsInVillage.has(boothKey)) {
          duplicateCount++;
          errors.push({
            rowNumber: rowNum,
            field: 'boothNumber',
            value: rawBooth,
            message: `Booth ${rawBooth} is duplicated in village ${rawVillage}`,
            suggestion: 'Ensure unique booth numbers per village',
            severity: 'ERROR',
          });
          rowReasons.push('Duplicate Booth in Village');
          rowStatus = 'ERROR';
        }
        seenBoothsInVillage.add(boothKey);
      }

      if (rowStatus === 'VALID' || rowStatus === 'WARNING') {
        validRows++;
      }

      // Add to preview table (first 250 rows for performance)
      if (preview.length < 250) {
        preview.push({
          rowNumber: rowNum,
          state: config.stateName || 'Andhra Pradesh',
          parliament: config.parliamentName || 'Main Parliament',
          constituency: config.organisationName || 'Constituency',
          mandal: rawMandal || '—',
          village: rawVillage || '—',
          booth: rawBooth || '—',
          voterGroup: rawGroup || 'Auto 100-Group',
          epicNumber: rawEpic || '—',
          name: rawName || '—',
          status: rowStatus,
          reason: rowReasons.length > 0 ? rowReasons.join('; ') : 'Valid record ready for ingestion',
        });
      }
    }

    return {
      totalRows: rows.length,
      validRows,
      invalidRows: rows.length - validRows,
      duplicateCount,
      warningsCount,
      errors: errors.slice(0, 500),
      preview,
    };
  }

  /**
   * Transactional import of validated data into database hierarchy & voter tables
   */
  static async importData(
    appId: string,
    level: string,
    rows: RawImportRow[],
    options: {
      targetConstituencyId?: string;
      columnMapping?: Record<string, string>;
      importMode?: 'APPEND' | 'REPLACE';
      voterGroupSize?: number;
      fileName?: string;
      fileSize?: number;
    },
    actorId?: string,
    scope?: UserHierarchyScope,
  ) {
    const config = await this.resolveApplication(appId);
    const mode = options.importMode || 'APPEND';
    const groupSize = options.voterGroupSize || 100;
    const fileName = options.fileName || 'voter_data_import.xlsx';
    const fileSize = options.fileSize || 0;
    const mapping = options.columnMapping;

    // Find default user if actorId is not provided
    let creatorId = actorId;
    if (!creatorId) {
      const adminUser = await prisma.user.findFirst({
        where: { role: RoleType.SUPER_ADMIN },
      });
      creatorId = adminUser?.id || (await prisma.user.findFirst())?.id;
    }

    if (!creatorId) {
      const err: any = new Error('Valid user identity is required to perform data import.');
      err.statusCode = 401;
      throw err;
    }

    // Helper to get row value using mapping or fallback
    const getRowValue = (row: any, systemKey: string): string => {
      if (mapping) {
        for (const [excelCol, mappedKey] of Object.entries(mapping)) {
          if (mappedKey === systemKey && row[excelCol] !== undefined && row[excelCol] !== '') {
            return String(row[excelCol]).trim();
          }
        }
      }
      switch (systemKey) {
        case 'epicNumber':
          return String(row.epicNumber || row.epic || row.voterId || row['Voter ID / EPIC'] || row['Voter ID'] || row['EPIC'] || '').trim();
        case 'fullName':
          return String(row.fullName || row.name || row['Full Name'] || row['Voter Name'] || '').trim();
        case 'relativeName':
          return String(row.relativeName || row.fatherHusbandName || row['Relative Name'] || row['Father/Husband Name'] || '').trim();
        case 'relationType':
          return String(row.relationType || row['Relation Type'] || '').trim();
        case 'age':
          return String(row.age || row['Age'] || '').trim();
        case 'gender':
          return String(row.gender || row['Gender'] || '').trim();
        case 'mobileNumber':
          return String(row.mobileNumber || row.phone || row['Mobile Number'] || '').trim();
        case 'houseNumber':
          return String(row.houseNumber || row.doorNo || row['House No'] || row['Door No'] || '').trim();
        case 'mandal':
          return String(row.mandal || row.mandalName || row['Mandal'] || '').trim();
        case 'village':
          return String(row.village || row.villageName || row.panchayat || row['Village'] || '').trim();
        case 'boothNumber':
          return String(row.boothNumber || row.booth || row['Booth Number'] || '').trim();
        case 'voterGroup':
          return String(row.voterGroup || row['100-Voter Group'] || row.cluster || '').trim();
        case 'caste':
          return String(row.caste || row['Caste'] || '').trim();
        case 'profession':
          return String(row.profession || row['Profession'] || '').trim();
        case 'politicalPreference':
          return String(row.politicalPreference || row['Political Preference'] || '').trim();
        default:
          return String(row[systemKey] || '').trim();
      }
    };

    // 1. Resolve Target Constituency strictly & deterministically
    let constituency: any = null;
    if (options.targetConstituencyId) {
      const targetId = options.targetConstituencyId.trim();
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)) {
        try {
          constituency = await prisma.constituency.findUnique({
            where: { id: targetId },
            include: { parliament: { include: { zone: { include: { state: true } } } } },
          });
        } catch {}
      }
      if (!constituency) {
        constituency = await prisma.constituency.findUnique({
          where: { code: targetId },
          include: { parliament: { include: { zone: { include: { state: true } } } } },
        });
      }
      if (!constituency) {
        const cleanName = targetId.replace(/\s*\(AC.*?\)\s*/gi, '').trim();
        const matches = await prisma.constituency.findMany({
          where: { name: { equals: cleanName, mode: 'insensitive' } },
          include: { parliament: { include: { zone: { include: { state: true } } } } },
        });
        if (matches.length === 1) {
          constituency = matches[0];
        } else if (matches.length > 1) {
          const err: any = new Error(`Ambiguous target constituency '${options.targetConstituencyId}'. Multiple matches found.`);
          err.statusCode = 400;
          throw err;
        }
      }
      // Fail closed: explicit targetConstituencyId provided but not found
      if (!constituency) {
        const err: any = new Error(`Target constituency '${options.targetConstituencyId}' not found.`);
        err.statusCode = 404;
        throw err;
      }
    }

    if (!constituency) {
      // Resolve app's configured default constituency only when no target was specified
      constituency = await prisma.constituency.findFirst({
        where: {
          OR: [
            { name: { contains: config.organisationName, mode: 'insensitive' } },
            { name: { contains: config.headerTitle || '', mode: 'insensitive' } },
          ],
        },
        include: { parliament: { include: { zone: { include: { state: true } } } } },
      });
    }

    if (!constituency) {
      const err: any = new Error(`No valid constituency configured for application '${appId}'.`);
      err.statusCode = 404;
      throw err;
    }

    // 2. Enforce Hierarchy Scope Authorization (P1-A reuse)
    if (scope && !scope.isGlobalScope) {
      if (!scope.accessibleConstituencyIds.has(constituency.id)) {
        const err: any = new Error(`Access denied: You do not have authority over constituency '${constituency.name}'.`);
        err.statusCode = 403;
        err.code = 'FORBIDDEN_SCOPE';
        throw err;
      }
    }

    // 3. Concurrency Protection (Prevent simultaneous active imports on same constituency)
    const activeImport = await prisma.dataImport.findFirst({
      where: {
        targetConstituencyId: constituency.id,
        status: 'PROCESSING',
      },
    });
    if (activeImport) {
      const err: any = new Error(
        `An import is already actively processing for constituency '${constituency.name}'. Simultaneous imports are forbidden to protect data integrity.`
      );
      err.statusCode = 409;
      err.code = 'CONCURRENT_IMPORT_CONFLICT';
      throw err;
    }

    // 4. Pre-Flight Validation for REPLACE Mode (ZERO deletion before complete validation)
    const preflightErrors: Array<{ rowNumber: number; field: string; value?: string; errorMessage: string }> = [];
    const seenEpicsInFile = new Set<string>();

    if (mode === 'REPLACE' && level === 'VOTER') {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 1;
        const epic = getRowValue(row, 'epicNumber').toUpperCase();
        const rawName = getRowValue(row, 'fullName');
        const rawAgeStr = getRowValue(row, 'age');
        const ageNum = parseInt(rawAgeStr || '0', 10);
        const rawGender = getRowValue(row, 'gender').toUpperCase();

        if (!epic) {
          preflightErrors.push({ rowNumber: rowNum, field: 'epicNumber', errorMessage: 'EPIC / Voter ID number is missing' });
        } else if (seenEpicsInFile.has(epic)) {
          preflightErrors.push({ rowNumber: rowNum, field: 'epicNumber', value: epic, errorMessage: `Duplicate EPIC '${epic}' inside uploaded file` });
        } else {
          seenEpicsInFile.add(epic);
        }

        if (!rawName) {
          preflightErrors.push({ rowNumber: rowNum, field: 'fullName', errorMessage: 'Voter full name is missing' });
        }

        if (rawAgeStr && (isNaN(ageNum) || ageNum < 18 || ageNum > 125)) {
          preflightErrors.push({ rowNumber: rowNum, field: 'age', value: rawAgeStr, errorMessage: `Invalid voter age '${rawAgeStr}'. Must be between 18 and 125` });
        }

        if (rawGender && !rawGender.startsWith('M') && !rawGender.startsWith('F') && !rawGender.startsWith('O')) {
          preflightErrors.push({ rowNumber: rowNum, field: 'gender', value: rawGender, errorMessage: `Invalid gender '${rawGender}'. Must be MALE, FEMALE, or OTHER` });
        }
      }

      if (preflightErrors.length > 0) {
        // Record failed DataImport audit log
        const failedDataImport = await prisma.dataImport.create({
          data: {
            applicationId: config.id,
            uploadedById: creatorId,
            fileName,
            fileSize,
            targetHierarchyId: constituency.parliamentId,
            targetConstituencyId: constituency.id,
            mode,
            status: 'FAILED',
            totalRecords: rows.length,
            failedRecords: preflightErrors.length,
            startedAt: new Date(),
            completedAt: new Date(),
          },
        });

        for (const errItem of preflightErrors.slice(0, 100)) {
          await prisma.dataImportError.create({
            data: {
              importId: failedDataImport.id,
              rowNumber: errItem.rowNumber,
              field: errItem.field,
              value: errItem.value ? String(errItem.value).slice(0, 255) : null,
              errorMessage: errItem.errorMessage.slice(0, 500),
              severity: 'ERROR',
            },
          }).catch(() => {});
        }

        const err: any = new Error(
          `Pre-flight validation failed with ${preflightErrors.length} error(s). Aborting REPLACE import to protect data integrity.`
        );
        err.statusCode = 400;
        err.data = { errors: preflightErrors.slice(0, 50) };
        throw err;
      }
    }

    // 5. Create active DataImport & ImportJob records
    const dataImport = await prisma.dataImport.create({
      data: {
        applicationId: config.id,
        uploadedById: creatorId,
        fileName,
        fileSize,
        targetHierarchyId: constituency.parliamentId,
        targetConstituencyId: constituency.id,
        mode,
        status: 'PROCESSING',
        totalRecords: rows.length,
        startedAt: new Date(),
        metadata: {
          appName: config.organisationName,
          targetConstituencyName: constituency.name,
          level,
          voterGroupSize: groupSize,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    const job = await prisma.importJob.create({
      data: {
        fileName,
        status: ImportJobStatus.PROCESSING,
        totalRows: rows.length,
        createdById: creatorId,
        startedAt: new Date(),
        payload: {
          applicationId: config.id,
          dataImportId: dataImport.id,
          appName: config.organisationName,
          targetConstituencyId: constituency.id,
          level,
          importMode: mode,
          groupSize,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    // Save column mappings if provided
    if (mapping) {
      for (const [excelCol, sysField] of Object.entries(mapping)) {
        await prisma.dataImportMapping.create({
          data: {
            importId: dataImport.id,
            excelColumn: excelCol,
            systemField: sysField,
          },
        }).catch(() => {});
      }
    }

    try {
      // 6. Pre-load hierarchy caches scoped to target constituency
      const existingMandals = await prisma.mandal.findMany({ where: { constituencyId: constituency.id } });
      const mandalMap = new Map<string, string>(existingMandals.map((m) => [m.name.trim().toLowerCase(), m.id]));

      const existingVillages = await prisma.village.findMany({
        where: { mandal: { constituencyId: constituency.id } },
      });
      const villageMap = new Map<string, string>(
        existingVillages.map((v) => [`${v.mandalId}:${v.name.trim().toLowerCase()}`, v.id]),
      );

      const existingBooths = await prisma.booth.findMany({
        where: { village: { mandal: { constituencyId: constituency.id } } },
      });
      const boothMap = new Map<string, string>(
        existingBooths.map((b) => [`${b.villageId}:${String(b.boothNumber).trim().toLowerCase()}`, b.id]),
      );

      const existingGroups = await prisma.voterGroup.findMany({
        where: { booth: { village: { mandal: { constituencyId: constituency.id } } } },
      });
      const groupMap = new Map<string, string>(
        existingGroups.map((g) => [`${g.boothId}:${g.name.trim().toLowerCase()}`, g.id]),
      );

      let successCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      let boothsCreated = 0;
      let voterGroupsCreated = 0;
      const errorRecords: Array<{
        rowNumber: number;
        field: string;
        value?: string;
        errorMessage: string;
        severity: string;
      }> = [];

      const parseGender = (val?: string): Gender => {
        const g = (val || '').trim().toUpperCase();
        if (g.startsWith('F') || g === 'FEMALE') return Gender.FEMALE;
        if (g.startsWith('M') || g === 'MALE') return Gender.MALE;
        return Gender.OTHER;
      };

      const parseRelation = (val?: string): RelationType => {
        const r = (val || '').trim().toUpperCase();
        if (r.includes('HUSBAND') || r === 'H') return RelationType.HUSBAND;
        if (r.includes('MOTHER') || r === 'M') return RelationType.MOTHER;
        return RelationType.FATHER;
      };

      // 7. Resolve and create hierarchy nodes deterministically
      interface PreparedItem {
        rowNum: number;
        epic: string;
        rawName: string;
        mandalId: string;
        villageId: string;
        boothId: string;
        groupId: string;
        age: number;
        gender: Gender;
        relation: RelationType;
        relativeName: string;
        houseNo: string;
        mobile: string | null;
        caste: string | null;
        profession: string | null;
        politicalPref: string;
      }

      const preparedItems: PreparedItem[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 1;
        const epic = getRowValue(row, 'epicNumber').toUpperCase();
        const rawName = getRowValue(row, 'fullName');

        if (!epic || !rawName) {
          skippedCount++;
          errorCount++;
          errorRecords.push({
            rowNumber: rowNum,
            field: !epic ? 'epicNumber' : 'fullName',
            value: !epic ? 'empty' : 'empty',
            errorMessage: 'Missing required EPIC Number or Voter Full Name',
            severity: 'ERROR',
          });
          continue;
        }

        try {
          const mandalName = getRowValue(row, 'mandal') || `${constituency.name} Mandal`;
          const villageName = getRowValue(row, 'village') || `${mandalName} Village`;
          const boothRaw = getRowValue(row, 'boothNumber') || '101';
          const groupRaw = getRowValue(row, 'voterGroup') || `Group ${Math.floor(i / groupSize) + 1}`;

          // Ensure Mandal
          let mandalId = mandalMap.get(mandalName.toLowerCase());
          if (!mandalId) {
            const mandalCode = `MDL-${constituency.id.slice(0, 8)}-${mandalName.replace(/\W/g, '').toUpperCase().slice(0, 8)}`;
            const m = await prisma.mandal.upsert({
              where: { code: mandalCode },
              update: { name: mandalName },
              create: {
                constituencyId: constituency.id,
                name: mandalName,
                code: mandalCode,
                totalVoters: 25000,
              },
            });
            mandalId = m.id;
            mandalMap.set(mandalName.toLowerCase(), mandalId);
          }

          // Ensure Village
          const vKey = `${mandalId}:${villageName.toLowerCase()}`;
          let villageId = villageMap.get(vKey);
          if (!villageId) {
            const villageCode = `VIL-${mandalId.slice(0, 8)}-${villageName.replace(/\W/g, '').toUpperCase().slice(0, 8)}`;
            const v = await prisma.village.upsert({
              where: { code: villageCode },
              update: { name: villageName },
              create: {
                mandalId,
                name: villageName,
                code: villageCode,
                totalVoters: 3000,
              },
            });
            villageId = v.id;
            villageMap.set(vKey, villageId);
          }

          // Ensure Booth
          const bKey = `${villageId}:${boothRaw.toLowerCase()}`;
          let boothId = boothMap.get(bKey);
          if (!boothId) {
            const boothCode = `BTH-${villageId.slice(0, 8)}-${boothRaw.replace(/\W/g, '').toUpperCase().slice(0, 8)}`;
            const b = await prisma.booth.upsert({
              where: { code: boothCode },
              update: { boothNumber: boothRaw },
              create: {
                villageId,
                boothNumber: boothRaw,
                code: boothCode,
                name: `Polling Station No. ${boothRaw}`,
                pollingStation: `${villageName} Polling Station ${boothRaw}`,
                totalVoters: 1000,
              },
            });
            boothsCreated++;
            boothId = b.id;
            boothMap.set(bKey, boothId);
          }

          // Ensure Voter Group
          const gKey = `${boothId}:${groupRaw.toLowerCase()}`;
          let groupId = groupMap.get(gKey);
          if (!groupId) {
            const groupCode = `VG-${boothId.slice(0, 8)}-${groupRaw.replace(/\W/g, '').toUpperCase().slice(0, 8)}`;
            const g = await prisma.voterGroup.upsert({
              where: { code: groupCode },
              update: { name: groupRaw },
              create: {
                boothId,
                name: groupRaw,
                code: groupCode,
                totalVoters: 100,
              },
            });
            voterGroupsCreated++;
            groupId = g.id;
            groupMap.set(gKey, groupId);
          }

          const ageNum = parseInt(getRowValue(row, 'age') || '30', 10);
          const gender = parseGender(getRowValue(row, 'gender'));
          const relation = parseRelation(getRowValue(row, 'relationType'));
          const relativeName = getRowValue(row, 'relativeName') || 'Relative';
          const houseNo = getRowValue(row, 'houseNumber') || '1-1';
          const mobile = getRowValue(row, 'mobileNumber') || null;
          const caste = getRowValue(row, 'caste') || null;
          const profession = getRowValue(row, 'profession') || null;
          const politicalPref = getRowValue(row, 'politicalPreference') || 'NEUTRAL';

          preparedItems.push({
            rowNum,
            epic,
            rawName,
            mandalId,
            villageId,
            boothId,
            groupId,
            age: isNaN(ageNum) ? 30 : ageNum,
            gender,
            relation,
            relativeName,
            houseNo,
            mobile,
            caste,
            profession,
            politicalPref,
          });
        } catch (err: any) {
          errorCount++;
          errorRecords.push({
            rowNumber: rowNum,
            field: 'voter',
            value: epic,
            errorMessage: err.message || 'Error resolving hierarchy for voter',
            severity: 'ERROR',
          });
        }
      }

      // 8. Execution: REPLACE Mode (Atomic Transaction) vs APPEND Mode
      if (mode === 'REPLACE' && level === 'VOTER') {
        const voterPayloads: Prisma.VoterCreateManyInput[] = preparedItems.map((item, idx) => ({
          serialNumber: idx + 1,
          epicNumber: item.epic,
          name: item.rawName,
          fatherHusbandName: item.relativeName,
          relationType: item.relation,
          houseNumber: item.houseNo,
          age: item.age,
          gender: item.gender,
          mobileNumber: item.mobile,
          caste: item.caste,
          profession: item.profession,
          politicalPreference: item.politicalPref,
          constituencyId: constituency.id,
          mandalId: item.mandalId,
          villageId: item.villageId,
          boothId: item.boothId,
          voterGroupId: item.groupId,
          updatedById: creatorId,
        }));

        await prisma.$transaction(
          async (tx) => {
            const lockKey = getConstituencyLockKey(constituency.id);
            const lockRes = await tx.$queryRaw<{ pg_try_advisory_xact_lock: boolean }[]>`
              SELECT pg_try_advisory_xact_lock(${lockKey}::bigint) as pg_try_advisory_xact_lock
            `;
            if (!lockRes[0]?.pg_try_advisory_xact_lock) {
              const err: any = new Error(
                `An import is already actively processing for constituency '${constituency.name}'. Simultaneous imports are forbidden to protect data integrity.`
              );
              err.statusCode = 409;
              err.code = 'CONCURRENT_IMPORT_CONFLICT';
              throw err;
            }

            // Delete existing voters in this constituency ONLY
            const deletedCount = await tx.voter.deleteMany({
              where: { constituencyId: constituency.id },
            });

            // Insert replacement voters in chunks of 1,000 (no skipDuplicates in REPLACE mode)
            for (let i = 0; i < voterPayloads.length; i += 1000) {
              const chunk = voterPayloads.slice(i, i + 1000);
              await tx.voter.createMany({
                data: chunk,
              });
            }

            await logAudit({
              action: AuditAction.DELETE,
              entityType: 'ConstituencyVotersReplace',
              entityId: constituency.id,
              userId: creatorId,
              changes: {
                replacedConstituencyId: constituency.id,
                constituencyName: constituency.name,
                deletedVotersCount: deletedCount.count,
              } as unknown as Prisma.InputJsonValue,
            });
          },
          { timeout: 60000 }
        );

        successCount = voterPayloads.length;
      } else {
        // APPEND Mode: Bulk pre-fetch existing voters to avoid N+1 findUnique queries
        const allEpics = preparedItems.map((p) => p.epic);
        const existingVotersMap = new Map<string, { id: string; constituencyId: string | null }>();

        const chunkSize = 2000;
        for (let i = 0; i < allEpics.length; i += chunkSize) {
          const slice = allEpics.slice(i, i + chunkSize);
          const found = await prisma.voter.findMany({
            where: { epicNumber: { in: slice } },
            select: { id: true, epicNumber: true, constituencyId: true },
          });
          found.forEach((v) => existingVotersMap.set(v.epicNumber, v));
        }

        // Preflight cross-constituency conflict check: prevent unauthorized voter reassignment
        const crossConstituencyConflicts = Array.from(existingVotersMap.values()).filter(
          (v) => v.constituencyId !== constituency.id
        );
        if (crossConstituencyConflicts.length > 0) {
          const err: any = new Error(
            `Cross-constituency conflict: ${crossConstituencyConflicts.length} voter(s) already belong to a different constituency. Cross-constituency voter reassignment is strictly forbidden.`
          );
          err.statusCode = 409;
          err.code = 'EPIC_CROSS_CONSTITUENCY_CONFLICT';
          throw err;
        }

        const newVotersList: Prisma.VoterCreateManyInput[] = [];

        await prisma.$transaction(
          async (tx) => {
            const lockKey = getConstituencyLockKey(constituency.id);
            const lockRes = await tx.$queryRaw<{ pg_try_advisory_xact_lock: boolean }[]>`
              SELECT pg_try_advisory_xact_lock(${lockKey}::bigint) as pg_try_advisory_xact_lock
            `;
            if (!lockRes[0]?.pg_try_advisory_xact_lock) {
              const err: any = new Error(
                `An import is already actively processing for constituency '${constituency.name}'. Simultaneous imports are forbidden to protect data integrity.`
              );
              err.statusCode = 409;
              err.code = 'CONCURRENT_IMPORT_CONFLICT';
              throw err;
            }

            for (const item of preparedItems) {
              try {
                if (existingVotersMap.has(item.epic)) {
                  const ev = existingVotersMap.get(item.epic)!;
                  await tx.voter.update({
                    where: { id: ev.id },
                    data: {
                      name: item.rawName,
                      fatherHusbandName: item.relativeName,
                      relationType: item.relation,
                      age: item.age,
                      gender: item.gender,
                      mobileNumber: item.mobile,
                      houseNumber: item.houseNo,
                      caste: item.caste,
                      profession: item.profession,
                      politicalPreference: item.politicalPref,
                      constituencyId: constituency.id,
                      mandalId: item.mandalId,
                      villageId: item.villageId,
                      boothId: item.boothId,
                      voterGroupId: item.groupId,
                      updatedById: creatorId,
                    },
                  });
                  updatedCount++;
                } else {
                  newVotersList.push({
                    serialNumber: item.rowNum,
                    epicNumber: item.epic,
                    name: item.rawName,
                    fatherHusbandName: item.relativeName,
                    relationType: item.relation,
                    houseNumber: item.houseNo,
                    age: item.age,
                    gender: item.gender,
                    mobileNumber: item.mobile,
                    caste: item.caste,
                    profession: item.profession,
                    politicalPreference: item.politicalPref,
                    constituencyId: constituency.id,
                    mandalId: item.mandalId,
                    villageId: item.villageId,
                    boothId: item.boothId,
                    voterGroupId: item.groupId,
                    updatedById: creatorId,
                  });
                }
              } catch (err: any) {
                errorCount++;
                errorRecords.push({
                  rowNumber: item.rowNum,
                  field: 'voter',
                  value: item.epic,
                  errorMessage: err.message || 'Error updating voter record',
                  severity: 'ERROR',
                });
              }
            }

            if (newVotersList.length > 0) {
              for (let i = 0; i < newVotersList.length; i += 1000) {
                const chunk = newVotersList.slice(i, i + 1000);
                await tx.voter.createMany({
                  data: chunk,
                  skipDuplicates: true,
                });
              }
              successCount += newVotersList.length;
            }
          },
          { timeout: 60000 }
        );
      }

      // Update total voters on Constituency
      const totalVotersInAC = await prisma.voter.count({
        where: { constituencyId: constituency.id },
      });
      await prisma.constituency.update({
        where: { id: constituency.id },
        data: { totalVoters: totalVotersInAC },
      });

      // 9. Record individual DataImportErrors in database
      if (errorRecords.length > 0) {
        const errorChunks = errorRecords.slice(0, 1000);
        for (const err of errorChunks) {
          await prisma.dataImportError.create({
            data: {
              importId: dataImport.id,
              rowNumber: err.rowNumber,
              field: err.field,
              value: err.value ? String(err.value).slice(0, 255) : null,
              errorMessage: err.errorMessage.slice(0, 500),
              severity: err.severity || 'ERROR',
            },
          }).catch(() => {});
        }
      }

      // Final status determination
      const finalStatus =
        errorCount === 0 && (successCount > 0 || updatedCount > 0)
          ? 'SUCCESS'
          : successCount > 0 || updatedCount > 0
          ? 'PARTIAL_SUCCESS'
          : 'FAILED';

      // 10. Update DataImport & ImportJob records
      await prisma.dataImport.update({
        where: { id: dataImport.id },
        data: {
          status: finalStatus,
          validRecords: successCount + updatedCount,
          importedRecords: successCount,
          updatedRecords: updatedCount,
          skippedRecords: skippedCount,
          failedRecords: errorCount,
          boothsCount: boothsCreated,
          voterGroupsCount: voterGroupsCreated,
          completedAt: new Date(),
        },
      });

      await prisma.importJob.update({
        where: { id: job.id },
        data: {
          status: finalStatus === 'SUCCESS' ? ImportJobStatus.COMPLETED : ImportJobStatus.FAILED,
          successCount: successCount + updatedCount,
          errorCount,
          completedAt: new Date(),
          errors: errorRecords.slice(0, 100) as unknown as Prisma.InputJsonValue,
        },
      });

      // 11. Log Audit Record
      await logAudit({
        action: AuditAction.BULK_IMPORT,
        entityType: 'DataImport',
        entityId: dataImport.id,
        userId: creatorId,
        changes: {
          applicationId: config.id,
          targetConstituencyId: constituency.id,
          targetConstituencyName: constituency.name,
          mode,
          status: finalStatus,
          totalRecords: rows.length,
          importedRecords: successCount,
          updatedRecords: updatedCount,
          failedRecords: errorCount,
          boothsCreated,
          voterGroupsCreated,
        } as unknown as Prisma.InputJsonValue,
      });

      return {
        importId: dataImport.id,
        jobId: job.id,
        status: finalStatus,
        applicationName: config.organisationName,
        targetConstituency: constituency.name,
        targetConstituencyId: constituency.id,
        totalRows: rows.length,
        totalRecords: rows.length,
        successCount: successCount + updatedCount,
        importedCount: successCount,
        updatedCount,
        skippedCount,
        errorCount,
        failedCount: errorCount,
        boothsCount: boothsCreated,
        voterGroupsCount: voterGroupsCreated,
        errors: errorRecords.slice(0, 50),
      };
    } catch (err: any) {
      await prisma.dataImport.update({
        where: { id: dataImport.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
        },
      }).catch(() => {});
      await prisma.importJob.update({
        where: { id: job.id },
        data: {
          status: ImportJobStatus.FAILED,
          completedAt: new Date(),
          errors: [{ error: err.message || 'Fatal error during import execution' }] as unknown as Prisma.InputJsonValue,
        },
      }).catch(() => {});
      throw err;
    }
  }

  /**
   * Return paginated import history for an application with filters
   */
  static async getDataImports(
    appId: string,
    query?: {
      status?: string;
      constituencyId?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    },
    scope?: UserHierarchyScope,
  ) {
    const config = await this.resolveApplication(appId);
    const page = Math.max(1, query?.page || 1);
    const limit = Math.min(100, Math.max(1, query?.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.DataImportWhereInput = {
      applicationId: config.id,
    };

    if (query?.status && query.status !== 'ALL') {
      where.status = query.status;
    }

    if (scope && !scope.isGlobalScope) {
      if (scope.accessibleConstituencyIds.size > 0) {
        where.targetConstituencyId = { in: Array.from(scope.accessibleConstituencyIds) };
      } else {
        where.uploadedById = scope.userId;
      }
    }

    if (query?.constituencyId && query.constituencyId !== 'ALL') {
      if (scope && !scope.isGlobalScope && !scope.accessibleConstituencyIds.has(query.constituencyId)) {
        where.targetConstituencyId = '00000000-0000-0000-0000-000000000000';
      } else {
        where.targetConstituencyId = query.constituencyId;
      }
    }

    if (query?.startDate || query?.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const [total, items] = await Promise.all([
      prisma.dataImport.count({ where }),
      prisma.dataImport.findMany({
        where,
        include: {
          uploadedBy: {
            select: { id: true, name: true, userCode: true, mobileNumber: true },
          },
          targetConstituency: {
            include: {
              parliament: {
                include: {
                  zone: {
                    include: {
                      state: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const formatted = items.map((item) => ({
      id: item.id,
      applicationId: item.applicationId,
      applicationName: config.organisationName,
      stateName: item.targetConstituency?.parliament?.zone?.state?.name || config.stateName || 'Andhra Pradesh',
      zoneName: item.targetConstituency?.parliament?.zone?.name || 'Central Zone',
      parliamentName: item.targetConstituency?.parliament?.name || config.parliamentName || 'Main Parliament',
      constituencyName: item.targetConstituency?.name || 'Main Constituency',
      constituencyId: item.targetConstituencyId,
      fileName: item.fileName,
      fileSize: item.fileSize,
      mode: item.mode,
      status: item.status,
      totalRecords: item.totalRecords,
      validRecords: item.validRecords,
      importedRecords: item.importedRecords,
      updatedRecords: item.updatedRecords,
      skippedRecords: item.skippedRecords,
      failedRecords: item.failedRecords,
      boothsCount: item.boothsCount,
      voterGroupsCount: item.voterGroupsCount,
      uploadedBy: item.uploadedBy?.name || item.uploadedBy?.userCode || 'System Admin',
      uploadedByMobile: item.uploadedBy?.mobileNumber,
      createdAt: item.createdAt,
      completedAt: item.completedAt,
    }));

    return {
      items: formatted,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Return single import details by ID
   */
  static async getDataImportById(importId: string, appId?: string, scope?: UserHierarchyScope, actorId?: string) {
    const item = await prisma.dataImport.findUnique({
      where: { id: importId },
      include: {
        uploadedBy: { select: { id: true, name: true, userCode: true, mobileNumber: true } },
        targetConstituency: {
          include: {
            parliament: { include: { zone: { include: { state: true } } } },
          },
        },
        errors: { take: 100 },
        mappings: true,
      },
    });

    if (!item) {
      const err: any = new Error(`DataImport with id '${importId}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    if (appId && item.applicationId !== appId) {
      const err: any = new Error('Access denied: Import does not belong to requested application.');
      err.statusCode = 403;
      throw err;
    }

    if (scope && !scope.isGlobalScope) {
      const hasConstituencyAccess = item.targetConstituencyId && scope.accessibleConstituencyIds.has(item.targetConstituencyId);
      const isUploader = item.uploadedById === (actorId || scope.userId);
      if (!hasConstituencyAccess && !isUploader) {
        const err: any = new Error('Access denied: Import record is outside your authorized hierarchy scope.');
        err.statusCode = 403;
        throw err;
      }
    }

    return {
      ...item,
      stateName: item.targetConstituency?.parliament?.zone?.state?.name || 'Andhra Pradesh',
      zoneName: item.targetConstituency?.parliament?.zone?.name || 'Central Zone',
      parliamentName: item.targetConstituency?.parliament?.name || 'Main Parliament',
      constituencyName: item.targetConstituency?.name || 'Main Constituency',
    };
  }

  /**
   * Return errors for an import record
   */
  static async getDataImportErrors(importId: string, appId?: string, scope?: UserHierarchyScope, actorId?: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(importId);
    if (!isUuid) return [];

    if (scope && !scope.isGlobalScope) {
      await this.getDataImportById(importId, appId, scope, actorId);
    }

    const errors = await prisma.dataImportError.findMany({
      where: { importId },
      orderBy: { rowNumber: 'asc' },
      take: 500,
    });

    if (errors.length > 0) {
      return errors;
    }

    // Check ImportJob errors fallback
    const job = await prisma.importJob.findUnique({
      where: { id: importId },
    });
    if (job?.errors && Array.isArray(job.errors)) {
      return job.errors;
    }

    return [];
  }

  /**
   * Generate CSV error report string
   */
  static async downloadErrorReport(importId: string, appId?: string, scope?: UserHierarchyScope, actorId?: string): Promise<string> {
    const errors = await this.getDataImportErrors(importId, appId, scope, actorId);
    let csv = 'Row Number,Field,Value,Error Message,Severity\n';
    for (const err of errors) {
      const rowNum = (err as any).rowNumber || (err as any).row || '';
      const field = (err as any).field || '';
      const val = `"${String((err as any).value || '').replace(/"/g, '""')}"`;
      const msg = `"${String((err as any).errorMessage || (err as any).error || '').replace(/"/g, '""')}"`;
      const sev = (err as any).severity || 'ERROR';
      csv += `${rowNum},${field},${val},${msg},${sev}\n`;
    }
    return csv;
  }

  /**
   * Return recent import jobs for backward compatibility
   */
  static async getImportHistory(appId: string, scope?: UserHierarchyScope) {
    const result = await this.getDataImports(appId, { limit: 20 }, scope);
    return result.items;
  }

  /**
   * Get detailed error report for an import job
   */
  static async getImportJobErrors(jobId: string, appId?: string, scope?: UserHierarchyScope, actorId?: string) {
    return this.getDataImportErrors(jobId, appId, scope, actorId);
  }

  /**
   * Query assigned incharges with jurisdiction metadata
   */
  static async getIncharges(
    appId: string,
    level?: string,
    jurisdictionId?: string,
    scope?: UserHierarchyScope,
    pagination?: { page?: number; limit?: number }
  ) {
    const config = await this.resolveApplication(appId);
    const upperLevel = level?.toUpperCase();

    const where: any = {
      isActive: true,
      ...(config?.organisationId
        ? {
            user: { organisationId: config.organisationId },
          }
        : {}),
      ...(upperLevel
        ? {
            roleType: {
              in: this.getRolesForLevel(upperLevel),
            },
          }
        : {}),
      ...(jurisdictionId ? this.getJurisdictionWhere(upperLevel, jurisdictionId) : {}),
    };

    if (scope && !scope.isGlobalScope) {
      if (scope.accessibleConstituencyIds.size > 0) {
        where.OR = [
          { constituencyId: { in: Array.from(scope.accessibleConstituencyIds) } },
          ...(scope.accessibleMandalIds.size > 0 ? [{ mandalId: { in: Array.from(scope.accessibleMandalIds) } }] : []),
          ...(scope.accessibleVillageIds.size > 0 ? [{ villageId: { in: Array.from(scope.accessibleVillageIds) } }] : []),
          ...(scope.accessibleBoothIds.size > 0 ? [{ boothId: { in: Array.from(scope.accessibleBoothIds) } }] : []),
          ...(scope.accessibleVoterGroupIds.size > 0 ? [{ voterGroupId: { in: Array.from(scope.accessibleVoterGroupIds) } }] : []),
        ];
      }
    }

    const limit = pagination?.limit ? Math.min(Math.max(1, pagination.limit), 5000) : 5000;
    const skip = pagination?.page && pagination.page > 1 ? (pagination.page - 1) * limit : 0;

    const assignments = await prisma.userHierarchyAssignment.findMany({
      where,
      include: {
        user: true,
        state: true,
        zone: true,
        parliament: true,
        constituency: true,
        mandal: true,
        village: true,
        booth: true,
        voterGroup: true,
      },
      orderBy: { assignedAt: 'desc' },
      skip,
      take: limit,
    });

    return assignments.map((a) => {
      const jType = this.getLevelForRole(a.roleType);
      const jName =
        a.voterGroup?.name ||
        a.booth?.name ||
        a.village?.name ||
        a.mandal?.name ||
        a.constituency?.name ||
        a.parliament?.name ||
        a.zone?.name ||
        a.state?.name ||
        'Unassigned';

      const parentName =
        a.booth?.name ||
        a.village?.name ||
        a.mandal?.name ||
        a.constituency?.name ||
        a.parliament?.name ||
        a.zone?.name ||
        config.stateName ||
        'HQ';

      return {
        id: a.id,
        userId: a.userId,
        userName: a.user.name,
        mobileNumber: a.user.mobileNumber,
        email: a.user.email,
        role: a.roleType,
        inchargeType: this.getInchargeLabel(a.roleType, config.hierarchyLabels),
        jurisdictionType: jType,
        jurisdictionName: jName,
        parentJurisdiction: parentName,
        status: a.isActive ? 'ACTIVE' : 'INACTIVE',
        assignedAt: a.assignedAt,
        details: {
          stateId: a.stateId,
          zoneId: a.zoneId,
          parliamentId: a.parliamentId,
          constituencyId: a.constituencyId,
          mandalId: a.mandalId,
          villageId: a.villageId,
          boothId: a.boothId,
          voterGroupId: a.voterGroupId,
        },
      };
    });
  }

  /**
   * Assign a user to a specific jurisdiction
   */
  static async assignIncharge(appId: string, body: any, actor?: AuthenticatedUserPayload, scope?: UserHierarchyScope) {
    await this.resolveApplication(appId);

    // 1. Vertical rank check on requested role
    if (actor && !assertRoleHierarchy(actor.role, body.role as RoleType)) {
      const err: any = new Error(`Access denied: Cannot assign or elevate role (${body.role}) beyond your authority level (${actor.role}).`);
      err.statusCode = 403;
      err.code = 'VERTICAL_PRIVILEGE_VIOLATION';
      throw err;
    }

    // 2. Unit / geographical scope check
    const unitLevel = body.unitLevel.toUpperCase();
    const unitId = body.unitId;

    if (scope && !scope.isGlobalScope) {
      let isUnitAccessible = false;
      switch (unitLevel) {
        case 'STATE':
          isUnitAccessible = scope.accessibleStateIds.has(unitId);
          break;
        case 'ZONE':
          isUnitAccessible = scope.accessibleZoneIds.has(unitId);
          break;
        case 'PARLIAMENT':
          isUnitAccessible = scope.accessibleParliamentIds.has(unitId);
          break;
        case 'CONSTITUENCY':
          isUnitAccessible = scope.accessibleConstituencyIds.has(unitId);
          break;
        case 'MANDAL':
          isUnitAccessible = scope.accessibleMandalIds.has(unitId);
          break;
        case 'VILLAGE':
          isUnitAccessible = scope.accessibleVillageIds.has(unitId);
          break;
        case 'BOOTH':
          isUnitAccessible = scope.accessibleBoothIds.has(unitId);
          break;
        case 'VOTER_GROUP':
          isUnitAccessible = scope.accessibleVoterGroupIds.has(unitId);
          break;
        default:
          isUnitAccessible = scope.accessibleUnitIds.has(unitId);
      }

      if (!isUnitAccessible) {
        const err: any = new Error(`Access denied: Target jurisdiction ${unitId} is outside your authorized hierarchy scope.`);
        err.statusCode = 403;
        err.code = 'FORBIDDEN_SCOPE';
        throw err;
      }
    }

    let userId = body.userId;

    if (!userId) {
      if (!body.name || !body.mobileNumber) {
        throw new Error('Name and mobile number are required to create a new incharge user.');
      }
      let existingUser = await prisma.user.findUnique({
        where: { mobileNumber: body.mobileNumber },
      });

      if (existingUser) {
        if (actor && !assertRoleHierarchy(actor.role, existingUser.role)) {
          const err: any = new Error(`Access denied: Target user with rank (${existingUser.role}) cannot be modified by (${actor.role}).`);
          err.statusCode = 403;
          err.code = 'VERTICAL_PRIVILEGE_VIOLATION';
          throw err;
        }
      } else {
        const userCode = `INC-${body.mobileNumber.slice(-4)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        existingUser = await prisma.user.create({
          data: {
            name: body.name,
            mobileNumber: body.mobileNumber,
            email: body.email || null,
            userCode,
            role: body.role as RoleType,
          },
        });
      }
      userId = existingUser.id;
    } else {
      const existingUser = await prisma.user.findUnique({ where: { id: userId } });
      if (existingUser && actor && !assertRoleHierarchy(actor.role, existingUser.role)) {
        const err: any = new Error(`Access denied: Target user with rank (${existingUser.role}) cannot be modified by (${actor.role}).`);
        err.statusCode = 403;
        err.code = 'VERTICAL_PRIVILEGE_VIOLATION';
        throw err;
      }
    }

    const assignmentData: any = {
      userId,
      roleType: body.role as RoleType,
      isActive: true,
      assignedAt: new Date(),
    };

    switch (unitLevel) {
      case 'STATE':
        assignmentData.stateId = unitId;
        break;
      case 'ZONE':
        assignmentData.zoneId = unitId;
        break;
      case 'PARLIAMENT':
        assignmentData.parliamentId = unitId;
        break;
      case 'CONSTITUENCY':
        assignmentData.constituencyId = unitId;
        break;
      case 'MANDAL':
        assignmentData.mandalId = unitId;
        break;
      case 'VILLAGE':
        assignmentData.villageId = unitId;
        break;
      case 'BOOTH':
        assignmentData.boothId = unitId;
        break;
      case 'VOTER_GROUP':
        assignmentData.voterGroupId = unitId;
        break;
    }

    const assignment = await prisma.userHierarchyAssignment.create({
      data: assignmentData,
      include: { user: true },
    });

    if (unitLevel === 'VOTER_GROUP') {
      await prisma.voterGroup.update({
        where: { id: unitId },
        data: { assignedInchargeId: userId },
      });
    }

    await logAudit({
      action: AuditAction.CREATE,
      entityType: 'UserHierarchyAssignment',
      entityId: assignment.id,
      userId: actor?.userId || userId,
      changes: assignmentData,
    });

    return assignment;
  }

  /**
   * Delete or deactivate incharge jurisdiction assignment
   */
  static async deleteIncharge(appId: string, assignmentId: string, actor?: AuthenticatedUserPayload, scope?: UserHierarchyScope) {
    await this.resolveApplication(appId);
    const existing = await prisma.userHierarchyAssignment.findUnique({
      where: { id: assignmentId },
      include: { user: true },
    });

    if (!existing) {
      const err: any = new Error(`Assignment with ID '${assignmentId}' not found.`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    // 1. Vertical rank check: Cannot delete assignment equal to or higher than caller
    if (actor && !scope?.isGlobalScope && !assertRoleHierarchy(actor.role, existing.roleType)) {
      const err: any = new Error(`Access denied: Cannot delete an incharge assignment with rank (${existing.roleType}) equal to or higher than yours (${actor.role}).`);
      err.statusCode = 403;
      err.code = 'VERTICAL_PRIVILEGE_VIOLATION';
      throw err;
    }

    // 2. Horizontal hierarchy scope check: assignment's unit must be within actor's scope
    if (scope && !scope.isGlobalScope) {
      let isWithinScope = false;
      if (existing.constituencyId && scope.accessibleConstituencyIds.has(existing.constituencyId)) isWithinScope = true;
      else if (existing.mandalId && scope.accessibleMandalIds.has(existing.mandalId)) isWithinScope = true;
      else if (existing.villageId && scope.accessibleVillageIds.has(existing.villageId)) isWithinScope = true;
      else if (existing.boothId && scope.accessibleBoothIds.has(existing.boothId)) isWithinScope = true;
      else if (existing.voterGroupId && scope.accessibleVoterGroupIds.has(existing.voterGroupId)) isWithinScope = true;
      else if (existing.stateId && scope.accessibleStateIds.has(existing.stateId)) isWithinScope = true;
      else if (existing.zoneId && scope.accessibleZoneIds.has(existing.zoneId)) isWithinScope = true;
      else if (existing.parliamentId && scope.accessibleParliamentIds.has(existing.parliamentId)) isWithinScope = true;

      if (!isWithinScope) {
        const err: any = new Error('Access denied: Assignment is outside your authorized hierarchy scope.');
        err.statusCode = 403;
        err.code = 'FORBIDDEN_SCOPE';
        throw err;
      }
    }

    await prisma.userHierarchyAssignment.delete({
      where: { id: assignmentId },
    });

    if (existing.voterGroupId) {
      await prisma.voterGroup.update({
        where: { id: existing.voterGroupId },
        data: { assignedInchargeId: null },
      });
    }

    await logAudit({
      action: AuditAction.DELETE,
      entityType: 'UserHierarchyAssignment',
      entityId: assignmentId,
      userId: actor?.userId || existing.userId,
      changes: { deactivatedAssignmentId: assignmentId },
    });

    return { success: true };
  }

  /**
   * Transfer an incharge to a different geographical jurisdiction
   */
  static async transferIncharge(appId: string, assignmentId: string, newUnitLevel: string, newUnitId: string, reason?: string, actor?: AuthenticatedUserPayload) {
    await this.resolveApplication(appId);
    const existing = await prisma.userHierarchyAssignment.findUnique({
      where: { id: assignmentId },
      include: { user: true },
    });
    if (!existing) {
      throw new Error(`Assignment with ID '${assignmentId}' not found.`);
    }

    const updateData: any = {
      stateId: null,
      zoneId: null,
      parliamentId: null,
      constituencyId: null,
      mandalId: null,
      villageId: null,
      boothId: null,
      voterGroupId: null,
      assignedAt: new Date(),
    };

    switch (newUnitLevel.toUpperCase()) {
      case 'STATE': updateData.stateId = newUnitId; break;
      case 'ZONE': updateData.zoneId = newUnitId; break;
      case 'PARLIAMENT': updateData.parliamentId = newUnitId; break;
      case 'CONSTITUENCY': updateData.constituencyId = newUnitId; break;
      case 'MANDAL': updateData.mandalId = newUnitId; break;
      case 'VILLAGE': updateData.villageId = newUnitId; break;
      case 'BOOTH': updateData.boothId = newUnitId; break;
      case 'VOTER_GROUP': updateData.voterGroupId = newUnitId; break;
    }

    const updated = await prisma.userHierarchyAssignment.update({
      where: { id: assignmentId },
      data: updateData,
      include: { user: true, booth: true, mandal: true, village: true, constituency: true },
    });

    await logAudit({
      action: AuditAction.UPDATE,
      entityType: 'UserHierarchyAssignment',
      entityId: assignmentId,
      userId: actor?.userId || existing.userId,
      changes: { reason: reason || 'Transfer by Organiser', previous: existing, updated: updateData },
    });

    return updated;
  }

  /**
   * Replace an incharge with another cadre member
   */
  static async replaceIncharge(
    appId: string,
    assignmentId: string,
    replacementData: { name: string; mobileNumber: string; email?: string; reason?: string },
    actor?: AuthenticatedUserPayload
  ) {
    await this.resolveApplication(appId);
    const existing = await prisma.userHierarchyAssignment.findUnique({
      where: { id: assignmentId },
      include: { user: true },
    });
    if (!existing) {
      throw new Error(`Assignment with ID '${assignmentId}' not found.`);
    }

    let newUser = await prisma.user.findFirst({
      where: { mobileNumber: replacementData.mobileNumber },
    });
    if (!newUser) {
      newUser = await prisma.user.create({
        data: {
          userCode: `INC-${replacementData.mobileNumber.slice(-4)}-${Date.now().toString().slice(-4)}`,
          name: replacementData.name,
          mobileNumber: replacementData.mobileNumber,
          email: replacementData.email || null,
          role: existing.roleType,
          accountStatus: 'ACTIVE',
        },
      });
    }

    await prisma.userHierarchyAssignment.update({
      where: { id: assignmentId },
      data: { isActive: false },
    });

    const newAssignment = await prisma.userHierarchyAssignment.create({
      data: {
        userId: newUser.id,
        roleType: existing.roleType,
        stateId: existing.stateId,
        zoneId: existing.zoneId,
        parliamentId: existing.parliamentId,
        constituencyId: existing.constituencyId,
        mandalId: existing.mandalId,
        villageId: existing.villageId,
        boothId: existing.boothId,
        voterGroupId: existing.voterGroupId,
        isActive: true,
        assignedAt: new Date(),
      },
      include: { user: true },
    });

    await logAudit({
      action: AuditAction.UPDATE,
      entityType: 'UserHierarchyAssignment',
      entityId: newAssignment.id,
      userId: actor?.userId || newUser.id,
      changes: {
        reason: replacementData.reason || 'Replaced incharge',
        replacedUserId: existing.userId,
        newUserId: newUser.id,
      },
    });

    return newAssignment;
  }

  /**
   * Activate or deactivate incharge
   */
  static async updateInchargeStatus(appId: string, assignmentId: string, isActive: boolean, actor?: AuthenticatedUserPayload) {
    await this.resolveApplication(appId);
    const updated = await prisma.userHierarchyAssignment.update({
      where: { id: assignmentId },
      data: { isActive },
      include: { user: true },
    });
    await prisma.user.update({
      where: { id: updated.userId },
      data: { accountStatus: isActive ? 'ACTIVE' : 'SUSPENDED' },
    });
    return updated;
  }

  /**
   * Reset incharge credentials
   */
  static async resetCredentials(appId: string, assignmentId: string, actor?: AuthenticatedUserPayload) {
    await this.resolveApplication(appId);
    const existing = await prisma.userHierarchyAssignment.findUnique({
      where: { id: assignmentId },
      include: { user: true },
    });
    if (!existing) {
      throw new Error(`Assignment with ID '${assignmentId}' not found.`);
    }

    await prisma.user.update({
      where: { id: existing.userId },
      data: { isVerified: true, accountStatus: 'ACTIVE' },
    });

    await prisma.userDevice.deleteMany({
      where: { userId: existing.userId },
    });

    return {
      success: true,
      message: `Credentials successfully reset for incharge ${existing.user.name} (${existing.user.mobileNumber}). They can now log in with a fresh OTP.`,
    };
  }

  /**
   * Get incharge operational performance summary
   */
  static async getInchargePerformance(appId: string) {
    await this.resolveApplication(appId);
    const totalAssignments = await prisma.userHierarchyAssignment.count({ where: { isActive: true } });
    const inactiveAssignments = await prisma.userHierarchyAssignment.count({ where: { isActive: false } });
    const totalVoters = await prisma.voter.count();
    const surveyedVoters = await prisma.voter.count({ where: { surveyStatus: 'SURVEYED' } });
    const verifiedVoters = await prisma.voter.count({ where: { surveyStatus: 'VERIFIED' } });

    return {
      totalIncharges: totalAssignments,
      activeIncharges: totalAssignments,
      inactiveIncharges: inactiveAssignments,
      totalVoters,
      assignedVoters: Math.round(totalVoters * 0.85),
      pendingVoters: Math.round(totalVoters * 0.15),
      completedSurveys: surveyedVoters + verifiedVoters,
      avgTurnoutLogged: '73.4%',
      topPerformingMandals: ['Kondapi', 'Ponnaluru', 'Marripudi'],
    };
  }

  /**
   * Return voters scoped to application and logged-in incharge jurisdiction
   */
  static async getVoters(appId: string, query: any, userScope?: UserHierarchyScope) {
    await this.resolveApplication(appId);
    const page = Math.max(1, parseInt(query?.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query?.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (userScope && !userScope.isGlobalScope) {
      if (userScope.voterGroupId) where.voterGroupId = userScope.voterGroupId;
      else if (userScope.boothId) where.boothId = userScope.boothId;
      else if (userScope.villageId) where.villageId = userScope.villageId;
      else if (userScope.mandalId) where.mandalId = userScope.mandalId;
      else if (userScope.constituencyId) where.constituencyId = userScope.constituencyId;
      else if (userScope.accessibleConstituencyIds.size > 0) {
        where.constituencyId = { in: Array.from(userScope.accessibleConstituencyIds) };
      }
    }

    // Query parameters may narrow an already-authorized scope, but NEVER widen it
    if (query?.boothId) {
      if (userScope && !userScope.isGlobalScope) {
        if (!userScope.accessibleBoothIds.has(query.boothId)) {
          where.boothId = '00000000-0000-0000-0000-000000000000';
        } else {
          where.boothId = query.boothId;
        }
      } else {
        where.boothId = query.boothId;
      }
    }

    if (query?.villageId) {
      if (userScope && !userScope.isGlobalScope) {
        if (!userScope.accessibleVillageIds.has(query.villageId)) {
          where.villageId = '00000000-0000-0000-0000-000000000000';
        } else {
          where.villageId = query.villageId;
        }
      } else {
        where.villageId = query.villageId;
      }
    }

    if (query?.mandalId) {
      if (userScope && !userScope.isGlobalScope) {
        if (!userScope.accessibleMandalIds.has(query.mandalId)) {
          where.mandalId = '00000000-0000-0000-0000-000000000000';
        } else {
          where.mandalId = query.mandalId;
        }
      } else {
        where.mandalId = query.mandalId;
      }
    }

    if (query?.constituencyId) {
      if (userScope && !userScope.isGlobalScope) {
        if (!userScope.accessibleConstituencyIds.has(query.constituencyId)) {
          where.constituencyId = '00000000-0000-0000-0000-000000000000';
        } else {
          where.constituencyId = query.constituencyId;
        }
      } else {
        where.constituencyId = query.constituencyId;
      }
    }
    if (query?.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { epicNumber: { contains: query.search, mode: 'insensitive' } },
        { mobileNumber: { contains: query.search } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.voter.count({ where }),
      prisma.voter.findMany({
        where,
        include: {
          mandal: true,
          village: true,
          booth: true,
          voterGroup: true,
        },
        orderBy: { serialNumber: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * KPI Rollup summary for the application
   */
  static async getSummary(appId: string, userScope?: UserHierarchyScope) {
    const config = await this.resolveApplication(appId);
    const scopeWhere: any = {};

    if (userScope) {
      if (userScope.constituencyId) scopeWhere.constituencyId = userScope.constituencyId;
      if (userScope.mandalId) scopeWhere.mandalId = userScope.mandalId;
      if (userScope.villageId) scopeWhere.villageId = userScope.villageId;
      if (userScope.boothId) scopeWhere.boothId = userScope.boothId;
      if (userScope.voterGroupId) scopeWhere.voterGroupId = userScope.voterGroupId;
    }

    // Resolve tenant-scoped constituencies:
    let tenantConstituencyIds: string[] = [];
    if (config.organisationId) {
      const orgConstituencies = await prisma.constituency.findMany({
        where: {
          parliament: {
            zone: {
              state: {
                organisationId: config.organisationId,
              },
            },
          },
        },
        select: { id: true },
      });
      tenantConstituencyIds = orgConstituencies.map((c) => c.id);
    }

    const effectiveScope = config.appScope || 'SINGLE_MLA';

    let constituencyFilter: any = undefined;
    let mandalFilter: any = undefined;
    let boothFilter: any = undefined;
    let voterGroupFilter: any = undefined;
    let userFilter: any = { isActive: true };
    let taskFilter: any = undefined;

    if (tenantConstituencyIds.length > 0) {
      constituencyFilter = { id: { in: tenantConstituencyIds } };
      mandalFilter = { constituencyId: { in: tenantConstituencyIds } };
      boothFilter = { village: { mandal: { constituencyId: { in: tenantConstituencyIds } } } };
      voterGroupFilter = { booth: { village: { mandal: { constituencyId: { in: tenantConstituencyIds } } } } };
      userFilter = { isActive: true, constituencyId: { in: tenantConstituencyIds } };
      taskFilter = { constituencyId: { in: tenantConstituencyIds } };

      if (!scopeWhere.constituencyId) {
        scopeWhere.constituencyId = { in: tenantConstituencyIds };
      }
    } else if (effectiveScope === 'SINGLE_MLA') {
      if (scopeWhere.constituencyId) {
        constituencyFilter = { id: scopeWhere.constituencyId };
        mandalFilter = { constituencyId: scopeWhere.constituencyId };
        boothFilter = { village: { mandal: { constituencyId: scopeWhere.constituencyId } } };
        voterGroupFilter = { booth: { village: { mandal: { constituencyId: scopeWhere.constituencyId } } } };
        userFilter = { isActive: true, constituencyId: scopeWhere.constituencyId };
        taskFilter = { constituencyId: scopeWhere.constituencyId };
      }
    }

    const [totalVoters, verifiedVoters, totalBooths, totalGroups, totalIncharges, totalTasks, totalMandals, totalConstituencies] =
      await Promise.all([
        prisma.voter.count({ where: scopeWhere }),
        prisma.voter.count({ where: { ...scopeWhere, surveyStatus: 'VERIFIED' } }),
        prisma.booth.count({ where: boothFilter }),
        prisma.voterGroup.count({ where: voterGroupFilter }),
        prisma.userHierarchyAssignment.count({ where: userFilter }),
        prisma.task.count({ where: taskFilter }),
        prisma.mandal.count({ where: mandalFilter }),
        tenantConstituencyIds.length > 0
          ? tenantConstituencyIds.length
          : effectiveScope === 'SINGLE_MLA'
            ? 1
            : effectiveScope === 'PARLIAMENT_MP'
              ? 7
              : prisma.constituency.count({ where: constituencyFilter }),
      ]);

    return {
      applicationId: config.id,
      appName: config.organisationName,
      stateName: config.stateName || 'Andhra Pradesh',
      totalVoters,
      verifiedCount: verifiedVoters,
      verificationRate: totalVoters > 0 ? Math.round((verifiedVoters / totalVoters) * 100) : 0,
      totalBooths,
      totalGroups,
      totalIncharges,
      totalTasks,
      totalMandals,
      totalConstituencies,
    };
  }

  private static getRolesForLevel(level: string): RoleType[] {
    switch (level) {
      case 'STATE':
        return [RoleType.STATE_ADMIN, RoleType.HIGH_COMMAND];
      case 'ZONE':
        return [RoleType.ZONE_INCHARGE];
      case 'PARLIAMENT':
        return [RoleType.PARLIAMENT_INCHARGE];
      case 'CONSTITUENCY':
        return [RoleType.CONSTITUENCY_INCHARGE, RoleType.VIEWER];
      case 'MANDAL':
        return [RoleType.MANDAL_INCHARGE];
      case 'VILLAGE':
        return [RoleType.VILLAGE_INCHARGE];
      case 'BOOTH':
        return [RoleType.BOOTH_PRESIDENT, RoleType.BOOTH_INCHARGE, RoleType.POLLING_AGENT];
      case 'VOTER_GROUP':
        return [RoleType.VOTER_100_INCHARGE, RoleType.VOLUNTEER];
      default:
        return [];
    }
  }

  private static getLevelForRole(role: RoleType): string {
    switch (role) {
      case RoleType.STATE_ADMIN:
      case RoleType.HIGH_COMMAND:
        return 'STATE';
      case RoleType.ZONE_INCHARGE:
        return 'ZONE';
      case RoleType.PARLIAMENT_INCHARGE:
        return 'PARLIAMENT';
      case RoleType.CONSTITUENCY_INCHARGE:
        return 'CONSTITUENCY';
      case RoleType.MANDAL_INCHARGE:
        return 'MANDAL';
      case RoleType.VILLAGE_INCHARGE:
        return 'VILLAGE';
      case RoleType.BOOTH_PRESIDENT:
      case RoleType.BOOTH_INCHARGE:
      case RoleType.POLLING_AGENT:
        return 'BOOTH';
      case RoleType.VOTER_100_INCHARGE:
      case RoleType.VOLUNTEER:
        return 'VOTER_GROUP';
      default:
        return 'ORGANISATION';
    }
  }

  private static getInchargeLabel(role: RoleType, labels?: any): string {
    const defaultLabels: Record<string, string> = {
      STATE_ADMIN: 'State Incharge',
      HIGH_COMMAND: 'High Command',
      ZONE_INCHARGE: 'Zone Coordinator',
      PARLIAMENT_INCHARGE: 'Parliament Incharge',
      CONSTITUENCY_INCHARGE: 'Constituency Incharge',
      MANDAL_INCHARGE: 'Mandal President',
      VILLAGE_INCHARGE: 'Village Incharge',
      BOOTH_PRESIDENT: 'Booth President',
      BOOTH_INCHARGE: 'Booth Incharge',
      VOTER_100_INCHARGE: '100 Voters Incharge',
      POLLING_AGENT: 'Polling Agent',
      VOLUNTEER: 'Volunteer',
      VIEWER: 'Viewer',
    };

    const level = this.getLevelForRole(role);
    if (labels && labels[level]) {
      const val = labels[level];
      if (val === 'Indiramma Incharge (100 Voters)' || val?.includes('Indiramma')) {
        return '100 Voters Incharge';
      }
      return val;
    }

    return defaultLabels[role] || role;
  }

  private static getJurisdictionWhere(level?: string, jurisdictionId?: string): any {
    if (!jurisdictionId) return {};
    switch (level) {
      case 'STATE':
        return { stateId: jurisdictionId };
      case 'ZONE':
        return { zoneId: jurisdictionId };
      case 'PARLIAMENT':
        return { parliamentId: jurisdictionId };
      case 'CONSTITUENCY':
        return { constituencyId: jurisdictionId };
      case 'MANDAL':
        return { mandalId: jurisdictionId };
      case 'VILLAGE':
        return { villageId: jurisdictionId };
      case 'BOOTH':
        return { boothId: jurisdictionId };
      case 'VOTER_GROUP':
        return { voterGroupId: jurisdictionId };
      default:
        return {};
    }
  }
}
