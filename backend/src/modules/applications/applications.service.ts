import {
  AuditAction,
  Gender,
  ImportJobStatus,
  OrgHierarchyLevel,
  Prisma,
  RelationType,
  RoleType,
  SurveyStatus,
  VoterStatus,
  VoteStatus,
} from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { logAudit } from '../../middleware/audit.js';
import { AuthenticatedUserPayload, UserHierarchyScope } from '../../common/types.js';
import { assertRoleHierarchy } from '../../middleware/rbac.js';
import { getConstituencyLockKey } from '../../common/lock.js';
import { UpdateApplicationDto } from './applications.schema.js';
import bcrypt from 'bcryptjs';

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
    aliases: ['voter id', 'epic', 'epic number', 'voter id / epic', 'epic_no', 'voter_id', 'card no', 'epicno', 'voter id no', 'voter id card', 'epic id', 'epic_num', 'electors no', 'epic id no', 'epic id no.', 'epicidno'],
  },
  {
    key: 'serialNumber',
    label: 'Serial Number / ECI Serial',
    required: false,
    description: 'Official elector serial number within the booth/part',
    aliases: ['new serial no', 'new serial number', 'serial no', 'serial number', 'sl no', 'slno', 'serial', 'new_serial_no', 'newserialno', 'serial_no', 'new serial no.'],
  },
  {
    key: 'pollingStation',
    label: 'Polling Station Name',
    required: false,
    description: 'Physical polling station location or facility name',
    aliases: ['polling station name', 'polling station', 'ps name', 'station name', 'polling_station_name', 'pollingstationname'],
  },
  {
    key: 'voterStatus',
    label: 'Voter Status (Active / Deleted)',
    required: false,
    description: 'Official gazette status: ACTIVE or DELETE',
    aliases: ['active/delete', 'active delete', 'status', 'voter status', 'activedelete', 'active_delete', 'official status'],
  },
  {
    key: 'fullName',
    label: 'Voter Full Name',
    required: true,
    description: 'Citizen legal full name',
    aliases: ['voter name', 'full name', 'name', 'citizen name', 'voter_name', 'candidate name', 'voter fullname', 'elector name', 'fullname'],
  },
  {
    key: 'relativeName',
    label: 'Father / Husband / Relative Name',
    required: false,
    description: 'Father or husband name as registered in electoral roll',
    aliases: ['relative name', 'father/husband name', 'father name', 'husband name', 'guardian name', 'relative_name', 'father_husband_name', 'father_name', 'husband_name', 'parent name', 'care of'],
  },
  {
    key: 'relationType',
    label: 'Relation Type',
    required: false,
    description: 'FATHER, HUSBAND, MOTHER, or OTHER',
    aliases: ['relation type', 'relation', 'relationship', 'rel_type', 'relation_type'],
  },
  {
    key: 'age',
    label: 'Age',
    required: true,
    description: 'Voter legal age (must be >= 18)',
    aliases: ['age', 'voter age', 'years', 'age in years'],
  },
  {
    key: 'gender',
    label: 'Gender',
    required: true,
    description: 'MALE, FEMALE, or OTHER',
    aliases: ['gender', 'sex', 'gender type'],
  },
  {
    key: 'mobileNumber',
    label: 'Mobile Number',
    required: false,
    description: '10-digit citizen contact number',
    aliases: ['mobile number', 'mobile', 'phone', 'contact', 'cell', 'phone number', 'mobile_number', 'mobile_no'],
  },
  {
    key: 'houseNumber',
    label: 'House / Door No',
    required: false,
    description: 'Residential address / door number',
    aliases: ['house number', 'door no', 'house no', 'address', 'h.no', 'door_no', 'house_no', 'd.no', 'hno', 'dno'],
  },
  {
    key: 'constituency',
    label: 'Constituency',
    required: false,
    description: 'Assembly Constituency name or code',
    aliases: ['constituency', 'constituency name', 'assembly constituency', 'ac', 'ac name', 'constituency_name', 'assembly_constituency', 'ac_no', 'acno'],
  },
  {
    key: 'mandal',
    label: 'Mandal',
    required: true,
    description: 'Sub-district / administrative Mandal name',
    aliases: ['mandal', 'mandal name', 'tehsil', 'block', 'taluk', 'mandal_name'],
  },
  {
    key: 'village',
    label: 'Village / Ward',
    required: true,
    description: 'Revenue Village, Panchayat, or Urban Ward',
    aliases: ['village', 'village name', 'panchayat', 'ward', 'town', 'village / ward', 'village_name', 'ward no'],
  },
  {
    key: 'boothNumber',
    label: 'Booth Number',
    required: true,
    description: 'Assigned polling booth or part number',
    aliases: ['booth number', 'booth', 'part no', 'polling station no', 'booth no', 'booth_no', 'part_no', 'ps no', 'booth_number'],
  },
  {
    key: 'voterGroup',
    label: '100-Voter Group',
    required: false,
    description: 'Cluster / micro-incharge group name or number',
    aliases: ['voter group', '100-voter group', 'group', 'cluster', 'section', '100 voter incharge', 'voter_group'],
  },
  {
    key: 'caste',
    label: 'Caste / Category',
    required: false,
    description: 'Demographic caste or social group',
    aliases: ['caste', 'community', 'category', 'sub-caste', 'social group', 'sub_caste'],
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
    aliases: ['political preference', 'party preference', 'leaning', 'preference', 'party', 'political_preference'],
  },
];

// Helper to normalize strings for robust fuzzy key matching (e.g., "EPIC_NO" -> "epicno", "Polling Station No." -> "pollingstationno")
export function normalizeColumnKey(str: string): string {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export const SYSTEM_FIELD_ALIASES: Record<string, string[]> = {
  epicNumber: [
    'epicnumber', 'epicno', 'epicnum', 'epic', 'voterid', 'voteridno', 'voteridnumber',
    'voteridcard', 'cardno', 'idno', 'electorsno', 'epicid', 'epicidno',
  ],
  serialNumber: [
    'newserialno', 'newserialnumber', 'serialno', 'serialnumber', 'slno', 'serial', 'newserial',
  ],
  pollingStation: [
    'pollingstationname', 'pollingstation', 'psname', 'stationname', 'pollingstationlabel',
  ],
  voterStatus: [
    'activedelete', 'active', 'delete', 'voterstatus', 'status', 'officialstatus',
  ],
  fullName: [
    'fullname', 'votername', 'electorname', 'citizenname', 'name', 'candidatename',
    'personname', 'applicantname', 'voterfullname',
  ],
  relativeName: [
    'relativename', 'fatherhusbandname', 'fathername', 'husbandname', 'guardianname',
    'relationname', 'parentname', 'careof', 'fatherorhusbandname', 'fname', 'hname',
  ],
  relationType: [
    'relationtype', 'relationship', 'relation', 'reltype', 'reltypecode',
  ],
  age: [
    'age', 'voterage', 'citizenage', 'ageinyears', 'years',
  ],
  gender: [
    'gender', 'sex', 'gendertype',
  ],
  mobileNumber: [
    'mobilenumber', 'mobile', 'mobileno', 'phone', 'phonenumber', 'contact',
    'contactno', 'cell', 'cellno', 'whatsapp', 'whatsappno',
  ],
  houseNumber: [
    'housenumber', 'houseno', 'doorno', 'doornumber', 'dno', 'hno', 'address',
    'residentialaddress', 'flatno', 'buildingno',
  ],
  constituency: [
    'constituency', 'constituencyname', 'assemblyconstituency', 'ac', 'acname', 'acno', 'constituencycode',
  ],
  mandal: [
    'mandal', 'mandalname', 'tehsil', 'taluka', 'block', 'mandalblock',
  ],
  village: [
    'village', 'villagename', 'panchayat', 'ward', 'town', 'habitation',
    'locality', 'grampanchayat', 'villageward',
  ],
  boothNumber: [
    'boothnumber', 'boothno', 'booth', 'pollingstationno', 'pollingstationnumber',
    'psno', 'psnumber', 'partno', 'partnumber', 'stationno', 'boothcode',
  ],
  voterGroup: [
    'votergroup', '100votergroup', 'cluster', 'group', 'votergroupno',
    'votercluster', 'unit',
  ],
  caste: [
    'caste', 'community', 'socialcategory', 'category', 'subcaste',
  ],
  profession: [
    'profession', 'occupation', 'employment', 'job',
  ],
  politicalPreference: [
    'politicalpreference', 'preference', 'partypreference', 'leaning',
    'affiliation', 'party', 'supporter',
  ],
};

export function extractRowValue(row: any, systemKey: string, mapping?: Record<string, string>): string {
  if (!row || typeof row !== 'object') return '';

  // 1. Explicit user/caller column mapping
  if (mapping) {
    for (const [excelCol, mappedKey] of Object.entries(mapping)) {
      if (mappedKey === systemKey && row[excelCol] !== undefined && row[excelCol] !== null && String(row[excelCol]).trim() !== '') {
        return String(row[excelCol]).trim();
      }
    }
  }

  // 2. Direct property access
  if (row[systemKey] !== undefined && row[systemKey] !== null && String(row[systemKey]).trim() !== '') {
    return String(row[systemKey]).trim();
  }

  // 3. Normalized fuzzy lookup against known aliases
  const aliases = SYSTEM_FIELD_ALIASES[systemKey] || [normalizeColumnKey(systemKey)];
  const rowEntries = Object.entries(row);

  for (const [rawKey, rawVal] of rowEntries) {
    if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') continue;
    const normKey = normalizeColumnKey(rawKey);
    if (aliases.includes(normKey)) {
      return String(rawVal).trim();
    }
  }

  return '';
}

export class ApplicationsService {
  /**
   * Helper to resolve application configuration by ID, configKey, or fallback to default
   */
  static async resolveApplication(appIdOrKey: string, user?: AuthenticatedUserPayload): Promise<any> {
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

    // If explicit UUID appId was requested but not found, DO NOT fall back to default or other apps!
    if (!config && isUuid) {
      const err: any = new Error(`Application with identifier '${appIdOrKey}' not found.`);
      err.statusCode = 404;
      err.code = 'APPLICATION_NOT_FOUND';
      throw err;
    }

    if (!config && (appIdOrKey === 'default' || !appIdOrKey)) {
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
      const err: any = new Error(`Application with identifier '${appIdOrKey}' not found.`);
      err.statusCode = 404;
      err.code = 'APPLICATION_NOT_FOUND';
      throw err;
    }

    // Tenant Isolation Guard: Verify caller has authority over this application's organization
    if (user && user.role !== RoleType.SUPER_ADMIN) {
      if (user.organisationId && config.organisationId && user.organisationId !== config.organisationId) {
        const err: any = new Error(`Access denied: Application '${appIdOrKey}' belongs to another organization.`);
        err.statusCode = 403;
        err.code = 'FORBIDDEN_TENANT';
        throw err;
      }
    }

    return config;
  }

  /**
   * Authoritatively resolves the target constituency for an application or import job
   */
  static async resolveConstituencyForApp(
    config: any,
    targetConstituencyId?: string
  ): Promise<any> {
    let constituency: any = null;

    if (targetConstituencyId) {
      const targetId = targetConstituencyId.trim();
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
          const err: any = new Error(`Ambiguous target constituency '${targetConstituencyId}'. Multiple matches found.`);
          err.statusCode = 400;
          throw err;
        }
      }
      if (!constituency) {
        const err: any = new Error(`Target constituency '${targetConstituencyId}' not found.`);
        err.statusCode = 404;
        throw err;
      }

      // Enforce strict tenant boundary check on target constituency
      const constOrgId = constituency.parliament?.zone?.state?.organisationId;
      if (config.organisationId && constOrgId && constOrgId !== config.organisationId) {
        const err: any = new Error(`Access denied: Target constituency '${targetConstituencyId}' belongs to another organization.`);
        err.statusCode = 403;
        err.code = 'FORBIDDEN_TENANT_CONSTITUENCY';
        throw err;
      }

      return constituency;
    }

    // Try unambiguous match by app organisationName / headerTitle within tenant
    if (config?.organisationName || config?.headerTitle) {
      const candidates = await prisma.constituency.findMany({
        where: {
          AND: [
            ...(config.organisationId ? [{ parliament: { zone: { state: { organisationId: config.organisationId } } } }] : []),
            {
              OR: [
                ...(config.organisationName ? [{ name: { equals: config.organisationName.trim(), mode: 'insensitive' as const } }] : []),
                ...(config.headerTitle ? [{ name: { equals: config.headerTitle.trim(), mode: 'insensitive' as const } }] : []),
              ],
            },
          ],
        },
        include: { parliament: { include: { zone: { include: { state: true } } } } },
      });
      if (candidates.length === 1) {
        return candidates[0];
      }
      if (candidates.length > 1) {
        const err: any = new Error(
          `Ambiguous constituency match for application '${config?.id || config?.configKey}'. Multiple matches found within tenant.`
        );
        err.statusCode = 400;
        err.code = 'AMBIGUOUS_CONSTITUENCY_MATCH';
        throw err;
      }
    }

    // 4. Fail closed: Never guess or pick a constituency from another tenant or global pool
    const err: any = new Error(
      `Target constituency could not be resolved safely for application '${config?.id || 'unknown'}'. Please specify a valid targetConstituencyId within your organization.`
    );
    err.statusCode = 400;
    err.code = 'TARGET_CONSTITUENCY_REQUIRED';
    throw err;
  }

  /**
   * Ensures that a root geographic hierarchy (State -> Zone -> Parliament -> Constituency)
   * exists for a given tenant organisation. Idempotent and strictly scoped to organisationId.
   */
  static async ensureTenantConstituency(config: any, rawName?: string): Promise<any> {
    const orgId = config.organisationId;
    if (!orgId) {
      const err: any = new Error('Cannot provision hierarchy: Application has no organisation assigned.');
      err.statusCode = 400;
      throw err;
    }

    const cleanName = (rawName || config.headerTitle || config.organisationName || config.appName || '110 Kondapi')
      .replace(/\s*\(AC.*?\)\s*/gi, '')
      .trim();
    const parsedNum = parseInt(cleanName.replace(/\D/g, ''), 10);
    const constNumber = !isNaN(parsedNum) && parsedNum > 0 ? parsedNum : 110;
    const constCode = `AC-${orgId.slice(0, 8)}-${constNumber}`;

    // 1. Ensure State for this organisation
    const stateCode = `ST-${orgId.slice(0, 8)}`;
    const state = await prisma.state.upsert({
      where: { code: stateCode },
      update: {},
      create: {
        code: stateCode,
        name: config.stateName || 'Andhra Pradesh',
        organisationId: orgId,
      },
    });

    // 2. Ensure Zone
    const zoneCode = `ZN-${orgId.slice(0, 8)}`;
    const zone = await prisma.zone.upsert({
      where: { code: zoneCode },
      update: {},
      create: {
        code: zoneCode,
        name: `${config.appName || 'Party'} Zone`,
        stateId: state.id,
      },
    });

    // 3. Ensure Parliament
    const pcCode = `PC-${orgId.slice(0, 8)}`;
    const pcName = config.parliamentName || `${cleanName} Parliament`;
    const parliament = await prisma.parliament.upsert({
      where: { code: pcCode },
      update: {},
      create: {
        code: pcCode,
        name: pcName,
        zoneId: zone.id,
      },
    });

    // 4. Ensure Constituency
    const constituency = await prisma.constituency.upsert({
      where: { code: constCode },
      update: { name: cleanName, constituencyNumber: constNumber },
      create: {
        code: constCode,
        name: cleanName,
        constituencyNumber: constNumber,
        parliamentId: parliament.id,
      },
      include: { parliament: { include: { zone: { include: { state: true } } } } },
    });

    // Update config with parliament details if needed
    if (config.id) {
      await prisma.cMSConfiguration.update({
        where: { id: config.id },
        data: {
          parliamentName: pcName,
          parliamentCode: pcCode,
        },
      }).catch(() => {});
    }

    return constituency;
  }

  /**
   * Return applications available on the platform, optionally filtered by organisationId
   */
  static async getApplications(organisationId?: string, isSuperAdmin = false) {
    if (!isSuperAdmin && !organisationId) {
      return []; // Non-superadmin without organisation context fails closed
    }

    const where: Prisma.CMSConfigurationWhereInput = {};
    if (organisationId !== undefined) {
      const isValidUuid = typeof organisationId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(organisationId);
      where.organisationId = isValidUuid ? organisationId : '00000000-0000-0000-0000-000000000000';
    }

    const configs = await prisma.cMSConfiguration.findMany({
      where,
      include: { organisation: true },
      orderBy: { updatedAt: 'desc' },
    });

    const activeParties = await prisma.politicalParty.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    // Optimization: Pre-aggregate voter counts by organisation in 2 bounded batch queries
    // instead of executing an N+1 Cartesian join across 7 tables per application
    const orgIds = configs
      .map((c) => c.organisationId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    const voterCountByOrg = new Map<string, number>();
    const constCountByOrg = new Map<string, number>();

    if (orgIds.length > 0) {
      const orgStates = await prisma.state.findMany({
        where: { organisationId: { in: orgIds } },
        select: { id: true, organisationId: true },
      });

      const stateToOrgMap = new Map<string, string>();
      for (const s of orgStates) {
        if (s.organisationId) stateToOrgMap.set(s.id, s.organisationId);
      }
      const stateIds = Array.from(stateToOrgMap.keys());

      if (stateIds.length > 0) {
        const [voterCountsByState, orgConstituencies] = await Promise.all([
          prisma.voter.groupBy({
            by: ['stateId'],
            where: { stateId: { in: stateIds } },
            _count: { id: true },
          }),
          prisma.constituency.findMany({
            where: {
              parliament: {
                zone: {
                  stateId: { in: stateIds },
                },
              },
            },
            select: {
              id: true,
              parliament: {
                select: {
                  zone: {
                    select: { stateId: true },
                  },
                },
              },
            },
          }),
        ]);

        for (const item of voterCountsByState) {
          if (item.stateId) {
            const matchedOrgId = stateToOrgMap.get(item.stateId);
            if (matchedOrgId) {
              voterCountByOrg.set(matchedOrgId, (voterCountByOrg.get(matchedOrgId) || 0) + item._count.id);
            }
          }
        }

        for (const cItem of orgConstituencies) {
          const sId = cItem.parliament?.zone?.stateId;
          if (sId) {
            const matchedOrgId = stateToOrgMap.get(sId);
            if (matchedOrgId) {
              constCountByOrg.set(matchedOrgId, (constCountByOrg.get(matchedOrgId) || 0) + 1);
            }
          }
        }
      }
    }

    const appsList: any[] = configs.map((c) => {
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
      const constituenciesCount = c.organisationId ? (constCountByOrg.get(c.organisationId) || 0) : 0;
      const votersCount = c.organisationId ? (voterCountByOrg.get(c.organisationId) || 0) : 0;

      return {
        id: c.id,
        organisationId: c.organisationId,
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
    });

    return appsList;
  }

  /**
   * Permanently delete an application, cascading to its political parties,
   * tenant organisation, and all associated hierarchy nodes and data.
   */
  static async deleteApplication(idOrKey: string, actor?: AuthenticatedUserPayload) {
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

    const totalConfigs = await prisma.cMSConfiguration.count();
    if (totalConfigs <= 1) {
      throw new Error('Cannot delete the sole remaining application. At least one party application must remain active.');
    }

    const orgId = config.organisationId;
    let permanentOrgPurge = false;
    let purgedUserCount = 0;

    const t0 = performance.now();
    let lockMs = 0;
    let configDeleteMs = 0;
    let sharedCheckMs = 0;
    let partyCleanupMs = 0;
    let hierarchyDiscoveryMs = 0;
    let childEntitiesDeleteMs = 0;
    let hierarchyNodesDeleteMs = 0;
    let announcementsVideosMs = 0;
    let tenantUsersCleanupMs = 0;
    let orgDeleteMs = 0;

    await prisma.$transaction(
      async (tx) => {
        // Concurrency protection: If an organisation is attached, acquire a row lock
        if (orgId) {
          const tLockStart = performance.now();
          await tx.$executeRaw`SELECT id FROM "Organisation" WHERE id = ${orgId}::uuid FOR UPDATE`;
          lockMs = Math.round((performance.now() - tLockStart) * 100) / 100;
        }

        // 1. Delete the target CMSConfiguration record
        const tCfgStart = performance.now();
        await tx.cMSConfiguration.delete({
          where: { id: config.id },
        });

        // If the deleted application was default, promote the next available application
        if (config.configKey === 'default') {
          const nextConfig = await tx.cMSConfiguration.findFirst({
            where: { id: { not: config.id } },
            orderBy: { createdAt: 'asc' },
          });
          if (nextConfig) {
            await tx.cMSConfiguration.update({
              where: { id: nextConfig.id },
              data: { configKey: 'default' },
            });
          }
        }
        configDeleteMs = Math.round((performance.now() - tCfgStart) * 100) / 100;

        // 2. Check if any other configurations still reference this Organisation
        if (orgId) {
          const tSharedStart = performance.now();
          const remainingConfigs = await tx.cMSConfiguration.count({
            where: { organisationId: orgId },
          });
          sharedCheckMs = Math.round((performance.now() - tSharedStart) * 100) / 100;

          // If other configurations still use this organization, do NOT purge the organization or its tenant data!
          if (remainingConfigs > 0) {
            return;
          }

          permanentOrgPurge = true;

          // 3. Final applicable reference removed: Proceed with safe, dependency-ordered tenant purge

          // 3a. Clean up unshared political parties owned by this organization
          const tPartyStart = performance.now();
          const otherConfigs = await tx.cMSConfiguration.findMany({
            where: { id: { not: config.id } },
            select: { activePartyCode: true },
          });
          const otherActiveCodes: string[] = otherConfigs
            .map((c) => c.activePartyCode)
            .filter((code): code is string => typeof code === 'string' && code.length > 0);

          const partiesToDelete = await tx.politicalParty.findMany({
            where: {
              organisationId: orgId,
              code: { notIn: otherActiveCodes },
            },
            select: { id: true, code: true },
          });

          const partyIds = partiesToDelete.map((p) => p.id);

          if (partyIds.length > 0) {
            await tx.voter.updateMany({
              where: { politicalPartyId: { in: partyIds } },
              data: { politicalPartyId: null },
            });

            // PostgreSQL foreign keys cascade PartyBranding and PartyPerformance automatically on party deletion
            await tx.politicalParty.deleteMany({
              where: { id: { in: partyIds } },
            });
          }
          partyCleanupMs = Math.round((performance.now() - tPartyStart) * 100) / 100;

          // 3b. Hierarchy tree lookup in a single batch query (replaces 9 sequential WAN round trips)
          const tHierStart = performance.now();
          const states = await tx.state.findMany({
            where: { organisationId: orgId },
            select: {
              id: true,
              code: true,
              zones: {
                select: {
                  id: true,
                  code: true,
                  parliaments: {
                    select: {
                      id: true,
                      code: true,
                      constituencies: {
                        select: {
                          id: true,
                          code: true,
                          mandals: {
                            select: {
                              id: true,
                              code: true,
                              villages: {
                                select: {
                                  id: true,
                                  code: true,
                                  booths: {
                                    select: {
                                      id: true,
                                      code: true,
                                      voterGroups: {
                                        select: {
                                          id: true,
                                          code: true,
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
              },
            },
          });

          const stateIds: string[] = [];
          const zoneIds: string[] = [];
          const parliamentIds: string[] = [];
          const constituencyIds: string[] = [];
          const mandalIds: string[] = [];
          const villageIds: string[] = [];
          const boothIds: string[] = [];
          const voterGroupIds: string[] = [];
          const allUnitCodes: string[] = [];

          for (const s of states) {
            stateIds.push(s.id);
            if (s.code) allUnitCodes.push(s.code);
            for (const z of s.zones) {
              zoneIds.push(z.id);
              if (z.code) allUnitCodes.push(z.code);
              for (const p of z.parliaments) {
                parliamentIds.push(p.id);
                if (p.code) allUnitCodes.push(p.code);
                for (const c of p.constituencies) {
                  constituencyIds.push(c.id);
                  if (c.code) allUnitCodes.push(c.code);
                  for (const m of c.mandals) {
                    mandalIds.push(m.id);
                    if (m.code) allUnitCodes.push(m.code);
                    for (const v of m.villages) {
                      villageIds.push(v.id);
                      if (v.code) allUnitCodes.push(v.code);
                      for (const b of v.booths) {
                        boothIds.push(b.id);
                        if (b.code) allUnitCodes.push(b.code);
                        for (const vg of b.voterGroups) {
                          voterGroupIds.push(vg.id);
                          if (vg.code) allUnitCodes.push(vg.code);
                        }
                      }
                    }
                  }
                }
              }
            }
          }

          const orgUnits = allUnitCodes.length > 0
            ? await tx.organizationUnit.findMany({
                where: { code: { in: allUnitCodes } },
                select: { id: true },
              })
            : [];
          const orgUnitIds = orgUnits.map((u) => u.id);
          hierarchyDiscoveryMs = Math.round((performance.now() - tHierStart) * 100) / 100;

          // 3c. Delete Voters matching hierarchy
          const tChildStart = performance.now();
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

          // 3d. Bounded parallel deletion of operational child records referencing hierarchy nodes
          const childDeletes: Promise<any>[] = [];

          if (boothIds.length > 0 || orgUnitIds.length > 0) {
            childDeletes.push(
              tx.cadreAssignment.deleteMany({
                where: {
                  OR: [
                    ...(boothIds.length > 0 ? [{ boothId: { in: boothIds } }] : []),
                    ...(orgUnitIds.length > 0 ? [{ unitId: { in: orgUnitIds } }] : []),
                  ],
                },
              }),
              tx.pollingReport.deleteMany({
                where: {
                  OR: [
                    ...(boothIds.length > 0 ? [{ boothId: { in: boothIds } }] : []),
                    ...(orgUnitIds.length > 0 ? [{ unitId: { in: orgUnitIds } }] : []),
                  ],
                },
              }),
            );
          }

          if (constituencyIds.length > 0 || boothIds.length > 0 || orgUnitIds.length > 0) {
            childDeletes.push(
              tx.task.deleteMany({
                where: {
                  OR: [
                    ...(constituencyIds.length > 0 ? [{ constituencyId: { in: constituencyIds } }] : []),
                    ...(mandalIds.length > 0 ? [{ mandalId: { in: mandalIds } }] : []),
                    ...(villageIds.length > 0 ? [{ villageId: { in: villageIds } }] : []),
                    ...(boothIds.length > 0 ? [{ boothId: { in: boothIds } }] : []),
                    ...(orgUnitIds.length > 0 ? [{ unitId: { in: orgUnitIds } }] : []),
                  ],
                },
              }),
              tx.groundReport.deleteMany({
                where: {
                  OR: [
                    ...(constituencyIds.length > 0 ? [{ constituencyId: { in: constituencyIds } }] : []),
                    ...(mandalIds.length > 0 ? [{ mandalId: { in: mandalIds } }] : []),
                    ...(villageIds.length > 0 ? [{ villageId: { in: villageIds } }] : []),
                    ...(boothIds.length > 0 ? [{ boothId: { in: boothIds } }] : []),
                    ...(orgUnitIds.length > 0 ? [{ unitId: { in: orgUnitIds } }] : []),
                  ],
                },
              }),
              tx.liveVoteEvent.deleteMany({
                where: {
                  OR: [
                    ...(orgUnitIds.length > 0 ? [{ unitId: { in: orgUnitIds } }] : []),
                  ],
                },
              }),
              tx.aIInsight.deleteMany({
                where: {
                  OR: [
                    ...(constituencyIds.length > 0 ? [{ constituencyId: { in: constituencyIds } }] : []),
                  ],
                },
              }),
              tx.newsArticle.deleteMany({
                where: {
                  OR: [
                    ...(constituencyIds.length > 0 ? [{ constituencyId: { in: constituencyIds } }] : []),
                  ],
                },
              }),
              tx.socialTrend.deleteMany({
                where: {
                  OR: [
                    ...(constituencyIds.length > 0 ? [{ constituencyId: { in: constituencyIds } }] : []),
                  ],
                },
              }),
              tx.dataImport.deleteMany({
                where: {
                  OR: [
                    ...(constituencyIds.length > 0 ? [{ targetConstituencyId: { in: constituencyIds } }] : []),
                  ],
                },
              }),
            );
          }

          if (childDeletes.length > 0) {
            await Promise.all(childDeletes);
          }
          childEntitiesDeleteMs = Math.round((performance.now() - tChildStart) * 100) / 100;

          // 3e. Hierarchy node deletion
          const tNodesStart = performance.now();
          if (orgUnitIds.length > 0) {
            await tx.organizationUnit.updateMany({ where: { id: { in: orgUnitIds } }, data: { parentId: null } });
            await tx.organizationUnit.deleteMany({ where: { id: { in: orgUnitIds } } });
          }

          if (stateIds.length > 0) {
            // In PostgreSQL, deleting State natively cascades Zone -> Parliament -> Constituency -> Mandal -> Village -> Booth -> VoterGroup
            // as well as all UserHierarchyAssignment records in a single database-side engine cascade.
            await tx.state.deleteMany({ where: { id: { in: stateIds } } });
          }
          hierarchyNodesDeleteMs = Math.round((performance.now() - tNodesStart) * 100) / 100;

          // 3f. Clean up Announcements & Training Videos in parallel
          const tAnnounceStart = performance.now();
          await Promise.all([
            tx.announcement.deleteMany({ where: { organisationId: orgId } }),
            tx.trainingVideo.deleteMany({ where: { organisationId: orgId } }),
          ]);
          announcementsVideosMs = Math.round((performance.now() - tAnnounceStart) * 100) / 100;

          // 3g. Protect platform SUPER_ADMIN accounts and permanently purge tenant users
          const tUsersStart = performance.now();
          await tx.user.updateMany({
            where: { organisationId: orgId, role: RoleType.SUPER_ADMIN },
            data: { organisationId: null, unitId: null },
          });

          const tenantUsers = await tx.user.findMany({
            where: {
              organisationId: orgId,
              role: { not: RoleType.SUPER_ADMIN },
            },
            select: { id: true, mobileNumber: true },
          });

          const tenantUserIds = tenantUsers.map((u) => u.id);
          const tenantMobiles = tenantUsers.map((u) => u.mobileNumber).filter((m): m is string => Boolean(m));
          purgedUserCount = tenantUserIds.length;

          if (tenantUserIds.length > 0) {
            // Delete OTP records so mobile numbers are immediately unlocked for registration
            await tx.oTPVerification.deleteMany({
              where: {
                OR: [
                  { userId: { in: tenantUserIds } },
                  ...(tenantMobiles.length > 0 ? [{ mobileNumber: { in: tenantMobiles } }] : []),
                ],
              },
            });

            // Permanently purge tenant user records:
            // PostgreSQL foreign keys natively cascade: LoginSession, UserDevice, Notification, Cadre,
            // TrainingProgress, PollVote, TaskAssignment, UserHierarchyAssignment, and AuditLog!
            await tx.user.deleteMany({
              where: { id: { in: tenantUserIds } },
            });
          }
          tenantUsersCleanupMs = Math.round((performance.now() - tUsersStart) * 100) / 100;

          // 3h. Delete organisation custom roles and organisation record
          const tOrgStart = performance.now();
          await tx.role.deleteMany({
            where: { organisationId: orgId },
          });

          await tx.organisation.delete({
            where: { id: orgId },
          });
          orgDeleteMs = Math.round((performance.now() - tOrgStart) * 100) / 100;
        }
      },
      { timeout: 30000, maxWait: 10000 },
    );

    const transactionTotalMs = Math.round((performance.now() - t0) * 100) / 100;

    // Record immutable audit event under the calling operator/admin account
    let auditWriteMs = 0;
    if (actor?.userId) {
      const tAuditStart = performance.now();
      await logAudit({
        action: AuditAction.DELETE,
        entityType: 'CMSConfiguration',
        entityId: config.id,
        userId: actor.userId,
        changes: {
          deletedApplication: config.organisationName,
          configKey: config.configKey,
          organisationId: orgId,
          permanentOrgPurge,
          purgedTenantUserCount: purgedUserCount,
        },
      });
      auditWriteMs = Math.round((performance.now() - tAuditStart) * 100) / 100;
    }

    const totalDurationMs = Math.round((performance.now() - t0) * 100) / 100;

    const timings = {
      lockMs,
      configDeleteMs,
      sharedCheckMs,
      partyCleanupMs,
      hierarchyDiscoveryMs,
      childEntitiesDeleteMs,
      hierarchyNodesDeleteMs,
      announcementsVideosMs,
      tenantUsersCleanupMs,
      orgDeleteMs,
      transactionTotalMs,
      auditWriteMs,
      totalDurationMs,
    };

    return { id: config.id, deleted: true, permanentOrgPurge, purgedUserCount, timings };
  }

  /**
   * Update an existing party application, synchronizing CMSConfiguration,
   * Organisation, and PoliticalParty records in an atomic transaction.
   * Strictly preserves existing voter records, geographical hierarchy nodes, and assignments.
   */
  static async updateApplication(
    idOrKey: string,
    payload: UpdateApplicationDto,
    actor?: AuthenticatedUserPayload,
  ) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrKey);
    let config = await prisma.cMSConfiguration.findFirst({
      where: {
        OR: [
          ...(isUuid ? [{ id: idOrKey }, { organisationId: idOrKey }] : []),
          { configKey: idOrKey },
          { organisationName: { equals: idOrKey, mode: 'insensitive' } },
        ],
      },
      include: {
        organisation: true,
      },
    });

    if (!config && (idOrKey === 'default' || !idOrKey)) {
      if (actor?.organisationId) {
        config = await prisma.cMSConfiguration.findFirst({
          where: { organisationId: actor.organisationId },
          include: { organisation: true },
        });
      }
      if (!config) {
        config =
          (await prisma.cMSConfiguration.findFirst({
            where: { configKey: 'default' },
            include: { organisation: true },
          })) ||
          (await prisma.cMSConfiguration.findFirst({
            include: { organisation: true },
          }));
      }
    }

    if (!config) {
      throw new Error(`Application '${idOrKey}' not found`);
    }

    // Authorization: Super admins can edit any party. Other roles can only edit their own organisation's party.
    const isSuperAdmin = actor?.role === RoleType.SUPER_ADMIN;
    if (!isSuperAdmin) {
      if (!actor?.organisationId || actor.organisationId !== config.organisationId) {
        throw new Error('Forbidden: You do not have permission to manage this application');
      }
    }

    // Atomic update of CMSConfiguration, Organisation, and PoliticalParty
    const updated = await prisma.$transaction(
      async (tx) => {
        // 1. If partyCode is being updated and changed, ensure uniqueness
        if (payload.partyCode && payload.partyCode !== config.activePartyCode) {
          const conflictingParty = await tx.politicalParty.findFirst({
            where: {
              code: payload.partyCode,
              ...(config.organisationId ? { organisationId: { not: config.organisationId } } : {}),
            },
          });
          if (conflictingParty) {
            throw new Error(`Party code '${payload.partyCode}' is already in use by another political party.`);
          }
        }

        // 2. Prepare CMSConfiguration updates
        const cmsData: Prisma.CMSConfigurationUpdateInput = {};
        if (payload.name) cmsData.organisationName = payload.name;
        if (payload.headerTitle) cmsData.headerTitle = payload.headerTitle;
        if (payload.slogan) cmsData.slogan = payload.slogan;
        else if (payload.description) cmsData.slogan = payload.description;
        if (payload.primaryColor) cmsData.primaryColor = payload.primaryColor;
        if (payload.secondaryColor) cmsData.secondaryColor = payload.secondaryColor;
        if (payload.accentColor) cmsData.accentColor = payload.accentColor;
        if (payload.logoUrl) cmsData.logoUrl = payload.logoUrl;
        if (payload.leaderName) cmsData.candidateName = payload.leaderName;
        if (payload.partyCode) cmsData.activePartyCode = payload.partyCode;
        const levels = payload.activeHierarchyLevels || payload.hierarchyLevels;
        if (levels) {
          cmsData.activeHierarchyLevels = levels;
        }
        if (payload.stateName) cmsData.stateName = payload.stateName;
        if (payload.appScope) cmsData.appScope = payload.appScope;
        if (payload.parliamentName) cmsData.parliamentName = payload.parliamentName;
        if (payload.parliamentCode) cmsData.parliamentCode = payload.parliamentCode;
        if (payload.hierarchyLabels) cmsData.hierarchyLabels = payload.hierarchyLabels;
        if (payload.featureToggles) cmsData.featureToggles = payload.featureToggles;
        if (payload.dashboardConfig) cmsData.dashboardConfig = payload.dashboardConfig;
        if (payload.analyticsConfig) cmsData.analyticsConfig = payload.analyticsConfig;
        if (payload.aiEnabled !== undefined) cmsData.aiEnabled = payload.aiEnabled;

        const updatedConfig = await tx.cMSConfiguration.update({
          where: { id: config.id },
          data: cmsData,
        });

        // 3. Update Organisation if linked
        if (config.organisationId) {
          const orgData: Prisma.OrganisationUpdateInput = {};
          if (payload.name) orgData.name = payload.name;
          if (payload.description) orgData.description = payload.description;
          if (payload.logoUrl) orgData.logoUrl = payload.logoUrl;

          if (Object.keys(orgData).length > 0) {
            await tx.organisation.update({
              where: { id: config.organisationId },
              data: orgData,
            });
          }
        }

        // 4. Update PoliticalParty and PartyBranding if linked
        const party = await tx.politicalParty.findFirst({
          where: {
            OR: [
              ...(config.activePartyCode ? [{ code: config.activePartyCode }] : []),
              ...(config.organisationId ? [{ organisationId: config.organisationId }] : []),
            ],
          },
          include: { brandings: true },
        });

        if (party) {
          const partyData: Prisma.PoliticalPartyUpdateInput = {};
          if (payload.party) {
            partyData.name = payload.party;
            partyData.shortName = payload.partyCode || party.shortName;
          }
          if (payload.partyCode && payload.partyCode !== party.code) {
            const conflict = await tx.politicalParty.findFirst({
              where: {
                code: payload.partyCode,
                id: { not: party.id },
              },
            });
            if (!conflict) {
              partyData.code = payload.partyCode;
            } else {
              console.warn(`[ApplicationsService] Skipping party code update to '${payload.partyCode}': code already in use by party ${conflict.id}`);
            }
          }
          if (payload.primaryColor) partyData.primaryColor = payload.primaryColor;
          if (payload.secondaryColor) partyData.secondaryColor = payload.secondaryColor;
          if (payload.accentColor) partyData.accentColor = payload.accentColor;
          if (payload.logoUrl) partyData.logoUrl = payload.logoUrl;

          await tx.politicalParty.update({
            where: { id: party.id },
            data: partyData,
          });

          // Update default PartyBranding if present
          if (party.brandings && party.brandings.length > 0) {
            const defaultBranding = party.brandings.find((b) => b.isDefault) || party.brandings[0];
            const brandingData: Prisma.PartyBrandingUpdateInput = {};
            if (payload.name) brandingData.title = payload.name;
            if (payload.slogan || payload.description) {
              brandingData.slogan = payload.slogan || payload.description;
            }
            if (payload.leaderName) {
              brandingData.leaderNames = [payload.leaderName];
            }
            if (Object.keys(brandingData).length > 0) {
              await tx.partyBranding.update({
                where: { id: defaultBranding.id },
                data: brandingData,
              });
            }
          }
        }

        // 5. Sync politicalParties if provided
        if (Array.isArray(payload.politicalParties) && payload.politicalParties.length > 0 && config.organisationId) {
          for (let i = 0; i < payload.politicalParties.length; i++) {
            const p = payload.politicalParties[i];
            const pCode = p.code?.trim().toUpperCase();
            if (!pCode) continue;

            const existingP = await tx.politicalParty.findUnique({
              where: { code: pCode },
            });

            if (existingP) {
              await tx.politicalParty.update({
                where: { id: existingP.id },
                data: {
                  name: p.name,
                  shortName: p.shortName || pCode,
                  ...(p.primaryColor ? { primaryColor: p.primaryColor } : {}),
                  ...(p.secondaryColor !== undefined ? { secondaryColor: p.secondaryColor } : {}),
                  ...(p.accentColor !== undefined ? { accentColor: p.accentColor } : {}),
                  ...(p.symbolName !== undefined ? { symbolName: p.symbolName } : {}),
                  ...(p.logoUrl !== undefined ? { logoUrl: p.logoUrl } : {}),
                  ...(p.isActive !== undefined ? { isActive: p.isActive } : {}),
                  ...(p.sortOrder !== undefined ? { sortOrder: p.sortOrder } : {}),
                  ...(!existingP.organisationId ? { organisationId: config.organisationId } : {}),
                },
              });
            } else {
              await tx.politicalParty.create({
                data: {
                  organisationId: config.organisationId,
                  name: p.name,
                  code: pCode,
                  shortName: p.shortName || pCode,
                  primaryColor: p.primaryColor || '#eab308',
                  secondaryColor: p.secondaryColor || null,
                  accentColor: p.accentColor || null,
                  symbolName: p.symbolName || null,
                  logoUrl: p.logoUrl || null,
                  isActive: p.isActive !== false,
                  sortOrder: p.sortOrder ?? i + 1,
                },
              });
            }
          }
        }

        // 6. Provision newly enabled tier incharges if provided
        if (Array.isArray(payload.newTierIncharges) && payload.newTierIncharges.length > 0 && config.organisationId) {
          const TIER_TO_ROLE: Record<string, RoleType> = {
            STATE: RoleType.STATE_ADMIN,
            ZONE: RoleType.ZONE_INCHARGE,
            PARLIAMENT: RoleType.PARLIAMENT_INCHARGE,
            CONSTITUENCY: RoleType.CONSTITUENCY_INCHARGE,
            MANDAL: RoleType.MANDAL_INCHARGE,
            VILLAGE: RoleType.VILLAGE_INCHARGE,
            BOOTH: RoleType.BOOTH_PRESIDENT,
            VOTER_GROUP: RoleType.VOTER_100_INCHARGE,
            DISTRICT: RoleType.CONSTITUENCY_INCHARGE,
          };

          const defaultPassword = 'Party@' + new Date().getFullYear();
          const passwordHash = await bcrypt.hash(defaultPassword, 10);

          for (const inc of payload.newTierIncharges) {
            const cleanMobile = (inc.mobileNumber || '').replace(/\D/g, '').slice(-10);
            if (cleanMobile.length < 10) continue;

            const tierKey = (inc.tierLevel || '').toUpperCase();
            const role = inc.role ? (inc.role as RoleType) : (TIER_TO_ROLE[tierKey] || RoleType.CONSTITUENCY_INCHARGE);

            let user = await tx.user.findFirst({
              where: { mobileNumber: cleanMobile },
            });

            if (user) {
              if (!user.organisationId || user.organisationId === config.organisationId) {
                user = await tx.user.update({
                  where: { id: user.id },
                  data: {
                    organisationId: config.organisationId,
                    role,
                    name: inc.name.trim() || user.name,
                  },
                });
              }
            } else {
              user = await tx.user.create({
                data: {
                  organisationId: config.organisationId,
                  userCode: `USR-${role.slice(0, 3)}-${cleanMobile.slice(-4)}-${Date.now().toString().slice(-4)}`,
                  name: inc.name.trim(),
                  mobileNumber: cleanMobile,
                  role,
                  passwordHash,
                  accountStatus: 'ACTIVE',
                  isVerified: true,
                },
              });
            }

            if (user) {
              const existingAssignment = await tx.userHierarchyAssignment.findFirst({
                where: {
                  userId: user.id,
                },
              });

              if (!existingAssignment) {
                await tx.userHierarchyAssignment.create({
                  data: {
                    userId: user.id,
                    roleType: role,
                  },
                });
              } else {
                await tx.userHierarchyAssignment.update({
                  where: { id: existingAssignment.id },
                  data: {
                    roleType: role,
                  },
                });
              }
            }
          }
        }

        return updatedConfig;
      },
      { timeout: 15000 },
    );

    // Audit Log recording
    if (actor?.userId) {
      try {
        await logAudit({
          action: AuditAction.UPDATE,
          entityType: 'CMSConfiguration',
          entityId: config.id,
          userId: actor.userId,
          changes: {
            updatedFields: Object.keys(payload),
            applicationId: config.id,
            name: payload.name || config.organisationName,
            partyCode: payload.partyCode || config.activePartyCode,
          },
        });
      } catch (auditErr: any) {
        console.warn('[ApplicationsService] Failed to record party update audit:', auditErr?.message);
      }
    }

    return updated;
  }

  /**
   * Return detailed configuration for a specific application
   */
  static async getConfiguration(appId: string, user?: AuthenticatedUserPayload) {
    const config = await this.resolveApplication(appId, user);
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
  static async getHierarchy(appId: string, userScope?: UserHierarchyScope, user?: AuthenticatedUserPayload) {
    const config = await this.resolveApplication(appId, user);
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
      where: {
        AND: [
          ...(config.organisationId ? [{ organisationId: config.organisationId }] : []),
          { name: { equals: stateName, mode: 'insensitive' as const } },
        ],
      },
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

    const resolvedState = state || (config.organisationId ? await prisma.state.findFirst({
      where: { organisationId: config.organisationId },
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
    }) : null);

    const constWhere: Prisma.ConstituencyWhereInput = {};
    if (config.organisationId) {
      constWhere.parliament = { zone: { state: { organisationId: config.organisationId } } };
    }
    if (userScope && user?.role !== RoleType.SUPER_ADMIN && userScope.accessibleConstituencyIds.size > 0) {
      constWhere.id = { in: Array.from(userScope.accessibleConstituencyIds) };
    }

    const allConstituencies = await prisma.constituency.findMany({
      where: Object.keys(constWhere).length > 0 ? constWhere : undefined,
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
      state: resolvedState || null,
      constituencies: allConstituencies,
    };
  }

  /**
   * Return child nodes for cascading dropdowns
   */
  static async getHierarchyNodesByLevel(
    appId: string,
    level: string,
    parentId?: string,
    userScope?: UserHierarchyScope,
    user?: AuthenticatedUserPayload
  ) {
    const config = await this.resolveApplication(appId, user);
    const upperLevel = level.toUpperCase();
    const effectiveOrgId = config.organisationId;
    const isSuperAdmin = user?.role === RoleType.SUPER_ADMIN;

    switch (upperLevel) {
      case 'STATE':
        return prisma.state.findMany({
          where: effectiveOrgId ? { organisationId: effectiveOrgId } : undefined,
          orderBy: { name: 'asc' },
        });

      case 'ZONE':
        return prisma.zone.findMany({
          where: {
            AND: [
              ...(effectiveOrgId ? [{ state: { organisationId: effectiveOrgId } }] : []),
              ...(parentId ? [{ stateId: parentId }] : []),
            ],
          },
          orderBy: { name: 'asc' },
        });

      case 'PARLIAMENT':
        return prisma.parliament.findMany({
          where: {
            AND: [
              ...(effectiveOrgId ? [{ zone: { state: { organisationId: effectiveOrgId } } }] : []),
              ...(parentId ? [{ zoneId: parentId }] : []),
            ],
          },
          orderBy: { name: 'asc' },
        });

      case 'CONSTITUENCY': {
        const constWhere: Prisma.ConstituencyWhereInput = {
          AND: [
            ...(effectiveOrgId ? [{ parliament: { zone: { state: { organisationId: effectiveOrgId } } } }] : []),
            ...(parentId ? [{ parliamentId: parentId }] : []),
          ],
        };
        if (!isSuperAdmin && userScope && userScope.accessibleConstituencyIds.size > 0) {
          constWhere.id = { in: Array.from(userScope.accessibleConstituencyIds) };
        }
        return prisma.constituency.findMany({
          where: constWhere,
          orderBy: { name: 'asc' },
        });
      }

      case 'MANDAL': {
        const mandalWhere: Prisma.MandalWhereInput = {
          AND: [
            ...(effectiveOrgId ? [{ constituency: { parliament: { zone: { state: { organisationId: effectiveOrgId } } } } }] : []),
            ...(parentId ? [{ constituencyId: parentId }] : []),
          ],
        };
        if (!isSuperAdmin && userScope && userScope.accessibleConstituencyIds.size > 0) {
          mandalWhere.constituencyId = parentId
            ? (userScope.accessibleConstituencyIds.has(parentId) ? parentId : '00000000-0000-0000-0000-000000000000')
            : { in: Array.from(userScope.accessibleConstituencyIds) };
        }
        return prisma.mandal.findMany({
          where: mandalWhere,
          orderBy: { name: 'asc' },
        });
      }

      case 'VILLAGE': {
        const villageWhere: Prisma.VillageWhereInput = {
          AND: [
            ...(effectiveOrgId ? [{ mandal: { constituency: { parliament: { zone: { state: { organisationId: effectiveOrgId } } } } } }] : []),
            ...(parentId ? [{ mandalId: parentId }] : []),
          ],
        };
        if (!isSuperAdmin && userScope && userScope.accessibleConstituencyIds.size > 0) {
          villageWhere.mandal = {
            ...(effectiveOrgId ? { constituency: { parliament: { zone: { state: { organisationId: effectiveOrgId } } } } } : {}),
            constituencyId: { in: Array.from(userScope.accessibleConstituencyIds) },
          };
        }
        return prisma.village.findMany({
          where: villageWhere,
          orderBy: { name: 'asc' },
        });
      }

      case 'BOOTH': {
        const boothWhere: Prisma.BoothWhereInput = {
          AND: [
            ...(effectiveOrgId ? [{ village: { mandal: { constituency: { parliament: { zone: { state: { organisationId: effectiveOrgId } } } } } } }] : []),
            ...(parentId ? [{ villageId: parentId }] : []),
          ],
        };
        if (!isSuperAdmin && userScope && userScope.accessibleConstituencyIds.size > 0) {
          boothWhere.village = {
            ...(effectiveOrgId ? { mandal: { constituency: { parliament: { zone: { state: { organisationId: effectiveOrgId } } } } } } : {}),
            mandal: {
              constituencyId: { in: Array.from(userScope.accessibleConstituencyIds) },
            },
          };
        }
        if (!isSuperAdmin && userScope && userScope.accessibleBoothIds.size > 0) {
          boothWhere.id = parentId
            ? (userScope.accessibleBoothIds.has(parentId) ? parentId : '00000000-0000-0000-0000-000000000000')
            : { in: Array.from(userScope.accessibleBoothIds) };
        }
        return prisma.booth.findMany({
          where: boothWhere,
          orderBy: { boothNumber: 'asc' },
        });
      }

      case 'VOTER_GROUP': {
        const vgWhere: Prisma.VoterGroupWhereInput = {
          AND: [
            ...(effectiveOrgId ? [{ booth: { village: { mandal: { constituency: { parliament: { zone: { state: { organisationId: effectiveOrgId } } } } } } } }] : []),
            ...(parentId ? [{ boothId: parentId }] : []),
          ],
        };
        if (!isSuperAdmin && userScope && userScope.accessibleBoothIds.size > 0) {
          vgWhere.boothId = parentId
            ? (userScope.accessibleBoothIds.has(parentId) ? parentId : '00000000-0000-0000-0000-000000000000')
            : { in: Array.from(userScope.accessibleBoothIds) };
        }
        return prisma.voterGroup.findMany({
          where: vgWhere,
          orderBy: { name: 'asc' },
        });
      }

      default:
        return [];
    }
  }

  /**
   * Return scoped constituencies with their data status, booth counts, and voter records
   */
  static async getConstituencies(
    appId: string,
    scopeFilters?: { stateId?: string; zoneId?: string; parliamentId?: string },
    userScope?: UserHierarchyScope,
    user?: AuthenticatedUserPayload,
  ) {
    const config = await this.resolveApplication(appId, user);
    const scope = config.appScope || 'SINGLE_MLA';

    const whereClause: Prisma.ConstituencyWhereInput = {};

    if (config.organisationId) {
      whereClause.parliament = {
        zone: {
          state: {
            organisationId: config.organisationId,
          },
        },
      };
    }

    if (scopeFilters?.parliamentId) {
      whereClause.parliamentId = scopeFilters.parliamentId;
    } else if (scopeFilters?.zoneId) {
      whereClause.parliament = {
        ...(whereClause.parliament as any),
        zoneId: scopeFilters.zoneId,
      };
    } else if (scopeFilters?.stateId) {
      whereClause.parliament = {
        ...(whereClause.parliament as any),
        zone: {
          stateId: scopeFilters.stateId,
          ...(config.organisationId ? { state: { organisationId: config.organisationId } } : {}),
        },
      };
    } else if (scope === 'PARLIAMENT_MP' && config.parliamentName) {
      whereClause.parliament = {
        ...(whereClause.parliament as any),
        name: { contains: config.parliamentName, mode: 'insensitive' },
      };
    } else if (scope === 'SINGLE_MLA') {
      whereClause.OR = [
        { name: { contains: config.organisationName, mode: 'insensitive' } },
        { name: { contains: config.headerTitle || '', mode: 'insensitive' } },
      ];
    }

    if (userScope && user?.role !== RoleType.SUPER_ADMIN && userScope.accessibleConstituencyIds.size > 0) {
      whereClause.id = { in: Array.from(userScope.accessibleConstituencyIds) };
    }

    const constituencies = await prisma.constituency.findMany({
      where: whereClause,
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
  static async getConstituencyDetail(
    appId: string,
    constituencyId: string,
    userScope?: UserHierarchyScope,
    user?: AuthenticatedUserPayload,
  ) {
    const config = await this.resolveApplication(appId, user);
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
      const err: any = new Error(`Constituency with id '${constituencyId}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    const constOrgId = c.parliament?.zone?.state?.organisationId;
    if (config.organisationId && constOrgId && constOrgId !== config.organisationId) {
      const err: any = new Error(`Access denied: Constituency '${constituencyId}' belongs to another organization.`);
      err.statusCode = 403;
      err.code = 'FORBIDDEN_TENANT';
      throw err;
    }

    if (user?.role !== RoleType.SUPER_ADMIN && userScope && userScope.accessibleConstituencyIds.size > 0) {
      if (!userScope.accessibleConstituencyIds.has(c.id)) {
        const err: any = new Error(`Access denied: Outside authorized constituency scope.`);
        err.statusCode = 403;
        err.code = 'FORBIDDEN_CONSTITUENCY_SCOPE';
        throw err;
      }
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

    // Extract value using robust normalized fuzzy mapping
    const getRowValue = (row: any, systemKey: string): string => extractRowValue(row, systemKey, mapping);

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
      importMode?: 'APPEND' | 'REPLACE' | 'UPSERT' | 'REFRESH';
      voterGroupSize?: number;
      fileName?: string;
      fileSize?: number;
      allowDangerousReplace?: boolean;
      _testHookDuringTransaction?: (tx: any) => Promise<void>;
    },
    actorId?: string,
    scope?: UserHierarchyScope,
  ) {
    const config = await this.resolveApplication(appId);
    const rawMode = (options.importMode || 'REFRESH').toUpperCase();
    const mode = (rawMode === 'UPSERT' || rawMode === 'REFRESH') ? 'APPEND' : rawMode;
    const isExplicitReplace = rawMode === 'REPLACE';
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
    const getRowValue = (row: any, systemKey: string): string => extractRowValue(row, systemKey, mapping);

    // 1. Resolve Target Constituency strictly & deterministically
    let targetConstId = options.targetConstituencyId;
    if (!targetConstId && rows.length > 0) {
      for (const r of rows) {
        const val = getRowValue(r, 'constituency');
        if (val) {
          targetConstId = val;
          break;
        }
      }
    }

    let constituency: any;
    try {
      constituency = await this.resolveConstituencyForApp(config, targetConstId);
    } catch (resolveErr: any) {
      if ((resolveErr.code === 'TARGET_CONSTITUENCY_REQUIRED' || resolveErr.statusCode === 404) && config.organisationId) {
        const fallbackName = targetConstId || config.headerTitle || config.appName || '110 Kondapi';
        constituency = await this.ensureTenantConstituency(config, fallbackName);
      } else {
        throw resolveErr;
      }
    }
    const resolvedParliamentId = constituency.parliamentId || constituency.parliament?.id || null;
    const resolvedZoneId = constituency.parliament?.zoneId || constituency.parliament?.zone?.id || null;
    const resolvedStateId = constituency.parliament?.zone?.stateId || constituency.parliament?.zone?.state?.id || null;

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
    const seenEpicsStatus = new Map<string, string>();

    if (isExplicitReplace && level === 'VOTER') {
      const existingVotersCount = await prisma.voter.count({ where: { constituencyId: constituency.id } });
      if (existingVotersCount > 0 && !options.allowDangerousReplace) {
        const hasLiveOps = await prisma.voter.findFirst({
          where: {
            constituencyId: constituency.id,
            OR: [
              { voteStatus: { not: VoteStatus.NOT_VOTED } },
              { surveyStatus: { not: SurveyStatus.NOT_SURVEYED } },
              { assignedInchargeId: { not: null } },
              { assignments: { some: {} } },
              { voteTrackings: { some: {} } },
              { fakeVoterFlags: { some: {} } },
              { migrations: { some: {} } },
              { statusHistory: { some: {} } },
              { liveVoteEvents: { some: {} } },
            ],
          },
        });

        if (hasLiveOps) {
          const err: any = new Error(
            `REPLACE mode is forbidden: Constituency '${constituency.name}' contains ${existingVotersCount} existing voters with live operational data (assessments, surveys, assignments, or vote tracking). Use UPSERT / REFRESH mode to prevent data loss.`
          );
          err.statusCode = 400;
          err.code = 'REPLACE_MODE_FORBIDDEN_LIVE_OPERATIONAL_DATA';
          throw err;
        }
      }

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 1;
        const epic = getRowValue(row, 'epicNumber').toUpperCase();
        const rawName = getRowValue(row, 'fullName') || (epic ? `[Name Not Recorded - ${epic}]` : '');
        const villageName = getRowValue(row, 'village');
        const isOverseas = (villageName || '').toLowerCase().includes('overseas');
        const statusRaw = (getRowValue(row, 'voterStatus') || '').trim().toUpperCase();

        if (!rawName) {
          preflightErrors.push({ rowNumber: rowNum, field: 'fullName', errorMessage: 'Voter full name is missing' });
        }

        if (!epic) {
          if (!isOverseas) {
            preflightErrors.push({ rowNumber: rowNum, field: 'epicNumber', errorMessage: 'EPIC / Voter ID number is missing' });
          }
        } else {
          if (seenEpicsInFile.has(epic)) {
            const prevStatus = seenEpicsStatus.get(epic) || '';
            const isRevisionPair = (prevStatus.includes('DELETE') && statusRaw.includes('ACTIVE')) ||
                                   (prevStatus.includes('ACTIVE') && statusRaw.includes('DELETE'));
            const isDoubleActive = prevStatus.includes('ACTIVE') && statusRaw.includes('ACTIVE');
            if (!isRevisionPair && !isDoubleActive) {
              preflightErrors.push({ rowNumber: rowNum, field: 'epicNumber', value: epic, errorMessage: `Duplicate EPIC '${epic}' inside uploaded file` });
            }
          } else {
            seenEpicsInFile.add(epic);
            seenEpicsStatus.set(epic, statusRaw);
          }
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
        include: { village: { select: { mandalId: true } } },
      });
      const boothMap = new Map<string, string>(
        existingBooths.map((b) => [`${b.village.mandalId}:${String(b.boothNumber).replace(/^Booth\s*/i, '').trim().toLowerCase()}`, b.id]),
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
      let warningsCount = 0;
      let boothsCreated = 0;
      let voterGroupsCreated = 0;
      let activeSourceCount = 0;
      let deletedSourceCount = 0;
      let blankEpicCount = 0;
      let duplicateEpicCount = 0;
      const boothTotals: Record<string, { total: number; active: number; deleted: number }> = {};
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
        serialNumber: number;
        age: number;
        gender: Gender;
        relation: RelationType;
        relativeName: string;
        houseNo: string;
        mobile: string | null;
        caste: string | null;
        profession: string | null;
        politicalPref: string;
        voterStatus: VoterStatus;
        notes?: string;
      }

      interface ParsedRowItem {
        rowNum: number;
        epic: string;
        rawName: string;
        mandalId: string;
        villageId: string;
        boothId: string;
        serialNumber: number;
        age: number;
        gender: Gender;
        relation: RelationType;
        relativeName: string;
        houseNo: string;
        mobile: string | null;
        caste: string | null;
        profession: string | null;
        politicalPref: string;
        voterStatus: VoterStatus;
        notes?: string;
        isDelete: boolean;
        explicitGroupRaw: string;
      }

      const parsedRowItems: ParsedRowItem[] = [];
      const preparedItems: PreparedItem[] = [];
      const seenEpicCounts = new Map<string, number>();

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 1;
        const rawEpic = getRowValue(row, 'epicNumber').trim().toUpperCase();
        const parsedSerial = parseInt(getRowValue(row, 'serialNumber') || '', 10);
        const serialNumber = (!isNaN(parsedSerial) && parsedSerial > 0) ? parsedSerial : (i + 1);
        const boothRaw = getRowValue(row, 'boothNumber').trim();

        // Strict SRP validation: Booth Number is a required structural identifier
        if (!boothRaw) {
          skippedCount++;
          errorCount++;
          errorRecords.push({
            rowNumber: rowNum,
            field: 'boothNumber',
            value: 'empty',
            errorMessage: 'Missing required Booth Number / Part Number',
            severity: 'ERROR',
          });
          continue;
        }

        const rawName = getRowValue(row, 'fullName').trim();
        // Strict SRP validation: Voter Full Name is a required personal identifier
        if (!rawName) {
          skippedCount++;
          errorCount++;
          errorRecords.push({
            rowNumber: rowNum,
            field: 'fullName',
            value: 'empty',
            errorMessage: 'Missing required Voter Full Name',
            severity: 'ERROR',
          });
          continue;
        }

        // Blank EPIC preservation: PostgreSQL schema requires a unique non-null String key.
        // We preserve blank source records by using an explicitly designated internal surrogate key
        // while tracking in metadata/notes that the official source EPIC is BLANK.
        const isBlankEpic = !rawEpic;
        const baseEpic = isBlankEpic
          ? `INTERNAL-NO-EPIC-${constituency.code || 'AC'}-P${boothRaw}-S${serialNumber}`
          : rawEpic;

        let epic = '';
        try {
          const mandalName = getRowValue(row, 'mandal').trim() || `${constituency.name} Mandal`;
          const villageName = getRowValue(row, 'village').trim() || `${mandalName} Village`;
          const pollingStationName = getRowValue(row, 'pollingStation').trim() || '';
          const statusRaw = (getRowValue(row, 'voterStatus') || '').trim().toUpperCase();
          const isDelete = statusRaw.includes('DELETE');
          const voterStatus = isDelete ? VoterStatus.SHIFTED : VoterStatus.ACTIVE;

          epic = baseEpic;
          let notes: string | undefined = undefined;

          if (isBlankEpic) {
            blankEpicCount++;
            notes = 'SOURCE_EPIC_STATUS: BLANK; INTERNAL_SURROGATE_KEY';
          } else if (isDelete) {
            notes = 'ECI_OFFICIAL_SOURCE_STATUS: DELETE';
          }

          if (seenEpicCounts.has(baseEpic)) {
            const count = (seenEpicCounts.get(baseEpic) || 0) + 1;
            seenEpicCounts.set(baseEpic, count);
            duplicateEpicCount++;
            if (isDelete) {
              epic = `${baseEpic}-DEL-P${boothRaw}-S${serialNumber}`;
              notes = notes ? `${notes}; ECI_DELETED_IN_REVISION: Migrated entry` : 'ECI_DELETED_IN_REVISION: Migrated entry';
            } else {
              epic = `${baseEpic}-DUP-P${boothRaw}-S${serialNumber}`;
              notes = notes ? `${notes}; DUPLICATE_ACTIVE_CONFLICT: Original EPIC ${baseEpic}` : `DUPLICATE_ACTIVE_CONFLICT: Original EPIC ${baseEpic}`;
            }
          } else {
            seenEpicCounts.set(baseEpic, 1);
          }

          // Provenance retention: capture source row, file, part, and official status
          const rowProvenance = `SRC: file=${fileName}; row=${rowNum}; part=${boothRaw}; slno=${serialNumber}; status=${statusRaw || 'ACTIVE'}`;
          notes = notes ? `${notes}; ${rowProvenance}` : rowProvenance;

          // Track status totals and per-booth distribution
          if (isDelete) {
            deletedSourceCount++;
          } else {
            activeSourceCount++;
          }

          if (!boothTotals[boothRaw]) {
            boothTotals[boothRaw] = { total: 0, active: 0, deleted: 0 };
          }
          boothTotals[boothRaw].total++;
          if (isDelete) {
            boothTotals[boothRaw].deleted++;
          } else {
            boothTotals[boothRaw].active++;
          }

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

          // Ensure Booth: Keyed strictly by mandalId and cleanBooth to prevent multi-village hamlet duplication
          const cleanBooth = boothRaw.replace(/^Booth\s*/i, '').trim().toLowerCase();
          const bKey = `${mandalId}:${cleanBooth}`;
          let boothId = boothMap.get(bKey);
          if (!boothId) {
            const boothCode = `BTH-${constituency.id.slice(0, 8)}-M${mandalId.slice(0, 4)}-${boothRaw.replace(/\W/g, '').toUpperCase()}`;
            const b = await prisma.booth.upsert({
              where: { code: boothCode },
              update: { 
                boothNumber: boothRaw,
                pollingStation: pollingStationName || `${villageName} Polling Station ${boothRaw}`,
              },
              create: {
                villageId,
                boothNumber: boothRaw,
                code: boothCode,
                name: pollingStationName ? `Polling Station: ${pollingStationName}` : `Polling Station No. ${boothRaw}`,
                pollingStation: pollingStationName || `${villageName} Polling Station ${boothRaw}`,
                totalVoters: 1000,
              },
            });
            boothsCreated++;
            boothId = b.id;
            boothMap.set(bKey, boothId);
          }

          // Capture explicit voter group if provided by user; otherwise groups will be assigned deterministically
          const explicitGroupRaw = getRowValue(row, 'voterGroup').trim();

          // Demographics: Validate required fields and preserve valid source values without synthetic inventions
          const rawAgeStr = getRowValue(row, 'age').trim();
          const parsedAge = parseInt(rawAgeStr || '', 10);
          if (rawAgeStr && (isNaN(parsedAge) || parsedAge < 18 || parsedAge > 125)) {
            warningsCount++;
            errorRecords.push({
              rowNumber: rowNum,
              field: 'age',
              value: rawAgeStr,
              errorMessage: `Age '${rawAgeStr}' is outside standard voting age range [18-125]`,
              severity: 'WARNING',
            });
          }
          const ageNum = (!isNaN(parsedAge) && parsedAge > 0) ? parsedAge : 0;
          const gender = parseGender(getRowValue(row, 'gender'));
          const relation = parseRelation(getRowValue(row, 'relationType'));
          const relativeName = getRowValue(row, 'relativeName').trim();
          const houseNo = getRowValue(row, 'houseNumber').trim();
          const rawMobile = getRowValue(row, 'mobileNumber').trim();
          const mobile = rawMobile ? rawMobile : null;
          const rawCaste = getRowValue(row, 'caste').trim();
          const caste = rawCaste ? rawCaste : null;
          const rawProf = getRowValue(row, 'profession').trim();
          const profession = rawProf ? rawProf : null;
          const rawPref = getRowValue(row, 'politicalPreference').trim();
          const politicalPref = rawPref ? rawPref : 'NEUTRAL';

          parsedRowItems.push({
            rowNum,
            epic,
            rawName,
            mandalId,
            villageId,
            boothId,
            serialNumber,
            age: ageNum,
            gender,
            relation,
            relativeName,
            houseNo,
            mobile,
            caste,
            profession,
            politicalPref,
            voterStatus,
            notes,
            isDelete,
            explicitGroupRaw,
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

      // 7b. Deterministic 100-Voter Group Assignment per Booth:
      // - Active voters without explicit groups are ordered strictly by serialNumber ASC, tie-breaking by rowNum ASC.
      // - Rank 1..100 -> Group 1, 101..200 -> Group 2, etc.
      // - ECI DELETE records (isDelete === true) are assigned to 'Deleted Electors' group and do NOT consume active rank.
      const itemsByBooth = new Map<string, ParsedRowItem[]>();
      for (const item of parsedRowItems) {
        let bList = itemsByBooth.get(item.boothId);
        if (!bList) {
          bList = [];
          itemsByBooth.set(item.boothId, bList);
        }
        bList.push(item);
      }

      for (const [boothId, bItems] of itemsByBooth.entries()) {
        const activeItemsToGroup: ParsedRowItem[] = [];
        const otherItems: Array<{ item: ParsedRowItem; groupName: string }> = [];

        for (const item of bItems) {
          if (item.isDelete) {
            otherItems.push({
              item,
              groupName: item.explicitGroupRaw || 'Deleted Electors',
            });
          } else if (item.explicitGroupRaw) {
            otherItems.push({
              item,
              groupName: item.explicitGroupRaw,
            });
          } else {
            activeItemsToGroup.push(item);
          }
        }

        // Sort active voters deterministically by serialNumber ASC, then original row encounter order
        activeItemsToGroup.sort((a, b) => a.serialNumber - b.serialNumber || a.rowNum - b.rowNum);

        const assignedItems: Array<{ item: ParsedRowItem; groupName: string }> = [];
        for (let idx = 0; idx < activeItemsToGroup.length; idx++) {
          const item = activeItemsToGroup[idx];
          const rank = idx + 1;
          const groupNum = Math.floor((rank - 1) / groupSize) + 1;
          assignedItems.push({
            item,
            groupName: `Group ${groupNum}`,
          });
        }

        const allBoothAssigned = [...assignedItems, ...otherItems];

        for (const { item, groupName } of allBoothAssigned) {
          const gKey = `${item.boothId}:${groupName.toLowerCase()}`;
          let groupId = groupMap.get(gKey);
          if (!groupId) {
            const groupCode = `VG-${item.boothId.slice(0, 8)}-${groupName.replace(/\W/g, '').toUpperCase()}`;
            const g = await prisma.voterGroup.upsert({
              where: { code: groupCode },
              update: { name: groupName },
              create: {
                boothId: item.boothId,
                name: groupName,
                code: groupCode,
                totalVoters: 100,
              },
            });
            voterGroupsCreated++;
            groupId = g.id;
            groupMap.set(gKey, groupId);
          }

          preparedItems.push({
            rowNum: item.rowNum,
            epic: item.epic,
            rawName: item.rawName,
            mandalId: item.mandalId,
            villageId: item.villageId,
            boothId: item.boothId,
            groupId,
            serialNumber: item.serialNumber,
            age: item.age,
            gender: item.gender,
            relation: item.relation,
            relativeName: item.relativeName,
            houseNo: item.houseNo,
            mobile: item.mobile,
            caste: item.caste,
            profession: item.profession,
            politicalPref: item.politicalPref,
            voterStatus: item.voterStatus,
            notes: item.notes,
          });
        }
      }

      // 8. Execution: REPLACE Mode (Atomic Transaction) vs REFRESH/UPSERT Mode
      if (isExplicitReplace && level === 'VOTER') {
        // Map all prepared items by their unique or disambiguated EPIC to preserve 100% of source records
        const deduplicatedVoterMap = new Map<string, PreparedItem>();
        for (const item of preparedItems) {
          deduplicatedVoterMap.set(item.epic, item);
        }

        const voterPayloads: Prisma.VoterCreateManyInput[] = Array.from(deduplicatedVoterMap.values()).map((item) => ({
          serialNumber: item.serialNumber,
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
          voterStatus: item.voterStatus,
          notes: item.notes,
          stateId: resolvedStateId,
          zoneId: resolvedZoneId,
          parliamentId: resolvedParliamentId,
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

            if (options._testHookDuringTransaction) {
              await options._testHookDuringTransaction(tx);
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
          { timeout: 300000, maxWait: 60000 }
        );

        successCount = voterPayloads.length;
      } else {
        // REFRESH / UPSERT / APPEND Mode: Preserves existing voter IDs and operational history
        const allEpics = preparedItems.map((p) => p.epic);
        const existingVotersMap = new Map<string, any>();

        const chunkSize = 2000;
        for (let i = 0; i < allEpics.length; i += chunkSize) {
          const slice = allEpics.slice(i, i + chunkSize);
          const found = await prisma.voter.findMany({
            where: { epicNumber: { in: slice } },
            select: {
              id: true,
              epicNumber: true,
              constituencyId: true,
              voterStatus: true,
              surveyStatus: true,
              voteStatus: true,
              mobileNumber: true,
              caste: true,
              subCaste: true,
              profession: true,
              politicalPreference: true,
              notes: true,
            },
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

            if (options._testHookDuringTransaction) {
              await options._testHookDuringTransaction(tx);
            }

            for (const item of preparedItems) {
              try {
                if (existingVotersMap.has(item.epic)) {
                  const ev = existingVotersMap.get(item.epic)!;

                  // 1. Revision & status resolution with explicit audit provenance
                  let newVoterStatus = ev.voterStatus;
                  let updatedNotes = ev.notes || '';

                  if (item.voterStatus === 'SHIFTED') {
                    newVoterStatus = VoterStatus.SHIFTED;
                    const deleteProvenance = 'ECI_OFFICIAL_SOURCE_STATUS: DELETE; DB_INTERNAL_STATUS: SHIFTED';
                    if (!updatedNotes.includes(deleteProvenance)) {
                      updatedNotes = updatedNotes ? `${updatedNotes}; ${deleteProvenance}` : deleteProvenance;
                    }
                  } else if (item.voterStatus === 'ACTIVE') {
                    if (ev.voterStatus === VoterStatus.SHIFTED) {
                      newVoterStatus = VoterStatus.ACTIVE;
                      const activeProvenance = 'ECI_OFFICIAL_SOURCE_STATUS: ACTIVE; RESTORED_FROM_SHIFTED';
                      if (!updatedNotes.includes(activeProvenance)) {
                        updatedNotes = updatedNotes ? `${updatedNotes}; ${activeProvenance}` : activeProvenance;
                      }
                    }
                  }

                  if (item.notes && !updatedNotes.includes(item.notes)) {
                    updatedNotes = updatedNotes ? `${updatedNotes}; ${item.notes}` : item.notes;
                  }

                  // 2. Preserve operational attributes without overwriting surveyed data
                  const mobileNumber = (item.mobile && item.mobile.trim()) ? item.mobile.trim() : ev.mobileNumber;
                  const caste = (item.caste && item.caste.trim()) ? item.caste.trim() : ev.caste;
                  const profession = (item.profession && item.profession.trim()) ? item.profession.trim() : ev.profession;

                  let politicalPreference = ev.politicalPreference;
                  if (ev.politicalPreference === 'NEUTRAL' && item.politicalPref && item.politicalPref !== 'NEUTRAL') {
                    politicalPreference = item.politicalPref;
                  }

                  // In-place selective update: Voter UUID is preserved, preventing cascade-deletion of operational tables
                  // Do not silently overwrite a correct existing record because an optional source field is blank.
                  const name = (item.rawName && item.rawName.trim()) ? item.rawName.trim() : ev.name;
                  const fatherHusbandName = (item.relativeName && item.relativeName.trim()) ? item.relativeName.trim() : ev.fatherHusbandName;
                  const houseNumber = (item.houseNo && item.houseNo.trim()) ? item.houseNo.trim() : ev.houseNumber;
                  const age = item.age > 0 ? item.age : ev.age;

                  await tx.voter.update({
                    where: { id: ev.id },
                    data: {
                      serialNumber: item.serialNumber,
                      name,
                      fatherHusbandName,
                      relationType: item.relation,
                      age,
                      gender: item.gender,
                      houseNumber,
                      mandalId: item.mandalId,
                      villageId: item.villageId,
                      boothId: item.boothId,
                      voterGroupId: item.groupId,
                      stateId: resolvedStateId,
                      zoneId: resolvedZoneId,
                      parliamentId: resolvedParliamentId,
                      constituencyId: constituency.id,
                      voterStatus: newVoterStatus,
                      notes: updatedNotes || null,
                      mobileNumber,
                      caste,
                      profession,
                      politicalPreference,
                      updatedById: creatorId,
                    },
                  });
                  updatedCount++;
                } else {
                  newVotersList.push({
                    serialNumber: item.serialNumber,
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
                    voterStatus: item.voterStatus,
                    notes: item.notes,
                    stateId: resolvedStateId,
                    zoneId: resolvedZoneId,
                    parliamentId: resolvedParliamentId,
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
          { timeout: 300000, maxWait: 60000 }
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

      // Construct structured reconciliation report covering source counts, statuses, and per-booth distribution
      const reconciliationReport = {
        sourceRowCount: rows.length,
        importedRowCount: successCount,
        updatedRowCount: updatedCount,
        rejectedRowCount: skippedCount,
        errorCount,
        warningCount: warningsCount,
        duplicateOrConflictCount: duplicateEpicCount,
        blankEpicCount,
        statusTotals: {
          active: activeSourceCount,
          deleted: deletedSourceCount,
        },
        targetConstituency: {
          id: constituency.id,
          name: constituency.name,
          code: constituency.code,
          totalVotersInAC,
        },
        boothSummary: {
          distinctBoothsCount: Object.keys(boothTotals).length,
          perBoothTotals: boothTotals,
        },
      };

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
          metadata: {
            appName: config.organisationName,
            targetConstituencyName: constituency.name,
            level,
            voterGroupSize: groupSize,
            reconciliationReport,
          } as unknown as Prisma.InputJsonValue,
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
          reconciliationReport,
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
        warningsCount,
        boothsCount: boothsCreated,
        voterGroupsCount: voterGroupsCreated,
        reconciliationReport,
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
    user?: AuthenticatedUserPayload,
  ) {
    const config = await this.resolveApplication(appId, user);
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
  static async getDataImportById(
    importId: string,
    appId?: string,
    scope?: UserHierarchyScope,
    actorId?: string,
    user?: AuthenticatedUserPayload,
  ) {
    if (appId) {
      await this.resolveApplication(appId, user);
    }

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
      err.code = 'FORBIDDEN_TENANT';
      throw err;
    }

    const itemOrgId = item.targetConstituency?.parliament?.zone?.state?.organisationId;
    if (scope && !scope.isGlobalScope && scope.organisationId) {
      if (itemOrgId && itemOrgId !== scope.organisationId) {
        const err: any = new Error('Access denied: Import record belongs to another organization.');
        err.statusCode = 403;
        err.code = 'FORBIDDEN_TENANT';
        throw err;
      }
    }

    if (scope && !scope.isGlobalScope) {
      const hasConstituencyAccess = item.targetConstituencyId && scope.accessibleConstituencyIds.has(item.targetConstituencyId);
      const isUploader = item.uploadedById === (actorId || scope.userId);
      if (!hasConstituencyAccess && !isUploader) {
        const err: any = new Error('Access denied: Import record is outside your authorized hierarchy scope.');
        err.statusCode = 403;
        err.code = 'FORBIDDEN_HIERARCHY_SCOPE';
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
  static async getDataImportErrors(
    importId: string,
    appId?: string,
    scope?: UserHierarchyScope,
    actorId?: string,
    user?: AuthenticatedUserPayload,
  ) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(importId);
    if (!isUuid) return [];

    if (scope && !scope.isGlobalScope) {
      await this.getDataImportById(importId, appId, scope, actorId, user);
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
    const config = await this.resolveApplication(appId);

    // Resolve tenant-scoped constituencies to guarantee strict multi-tenant isolation
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

    const voterScope: Prisma.VoterWhereInput = tenantConstituencyIds.length > 0
      ? { constituencyId: { in: tenantConstituencyIds } }
      : { constituencyId: '00000000-0000-0000-0000-000000000000' };

    const assignmentScope: Prisma.UserHierarchyAssignmentWhereInput = tenantConstituencyIds.length > 0
      ? { constituencyId: { in: tenantConstituencyIds } }
      : { constituencyId: '00000000-0000-0000-0000-000000000000' };

    const [
      totalAssignments,
      inactiveAssignments,
      voterSurveyGroups,
      voterVoteGroups,
      assignedVoters,
      mandals,
    ] = await Promise.all([
      prisma.userHierarchyAssignment.count({
        where: { ...assignmentScope, isActive: true },
      }),
      prisma.userHierarchyAssignment.count({
        where: { ...assignmentScope, isActive: false },
      }),
      prisma.voter.groupBy({
        by: ['surveyStatus'],
        where: voterScope,
        _count: { _all: true },
      }),
      prisma.voter.groupBy({
        by: ['voteStatus'],
        where: voterScope,
        _count: { _all: true },
      }),
      prisma.voter.count({
        where: { ...voterScope, assignedInchargeId: { not: null } },
      }),
      tenantConstituencyIds.length > 0
        ? prisma.mandal.findMany({
            where: { constituencyId: { in: tenantConstituencyIds } },
            select: { name: true },
            take: 5,
            orderBy: { name: 'asc' },
          })
        : Promise.resolve([]),
    ]);

    let totalVoters = 0;
    let completedSurveys = 0;
    for (const g of voterSurveyGroups) {
      const count = Number(g._count._all || 0);
      totalVoters += count;
      if (g.surveyStatus === 'SURVEYED' || g.surveyStatus === 'VERIFIED') {
        completedSurveys += count;
      }
    }

    let votedCount = 0;
    for (const v of voterVoteGroups) {
      if (v.voteStatus === 'VOTE_DONE') {
        votedCount += Number(v._count._all || 0);
      }
    }

    const pendingVoters = Math.max(0, totalVoters - assignedVoters);
    const avgTurnoutLogged = totalVoters > 0
      ? `${((votedCount / totalVoters) * 100).toFixed(1)}%`
      : '0.0%';
    const topPerformingMandals = mandals.map((m) => m.name);

    return {
      totalIncharges: totalAssignments,
      activeIncharges: totalAssignments,
      inactiveIncharges: inactiveAssignments,
      totalVoters,
      assignedVoters,
      pendingVoters,
      completedSurveys,
      avgTurnoutLogged,
      topPerformingMandals,
    };
  }

  /**
   * Return voters scoped to application and logged-in incharge jurisdiction
   */
  static async getVoters(appId: string, query: any, userScope?: UserHierarchyScope) {
    const config = await this.resolveApplication(appId);
    const page = Math.max(1, parseInt(query?.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query?.limit || '20', 10)));
    const skip = (page - 1) * limit;

    // Cross-tenant verification for non-global callers
    if (userScope && !userScope.isGlobalScope) {
      if (userScope.organisationId && config.organisationId && userScope.organisationId !== config.organisationId) {
        const err: any = new Error('Access denied: You cannot view voters of another tenant application.');
        err.statusCode = 403;
        err.code = 'FORBIDDEN_TENANT';
        throw err;
      }
    }

    const where: any = {};

    // Explicitly scope query to the target application's organization (via direct state OR constituency hierarchy chain)
    if (config.organisationId) {
      where.AND = [
        {
          OR: [
            { state: { organisationId: config.organisationId } },
            { constituency: { parliament: { zone: { state: { organisationId: config.organisationId } } } } },
          ],
        },
      ];
    } else {
      where.state = { organisationId: '00000000-0000-0000-0000-000000000000' };
    }

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
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { epicNumber: { contains: query.search, mode: 'insensitive' } },
            { mobileNumber: { contains: query.search } },
          ],
        },
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
        orderBy: [{ serialNumber: 'asc' }, { id: 'asc' }],
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
  static async getSummary(appId: string, userScope?: UserHierarchyScope, user?: AuthenticatedUserPayload) {
    const config = await this.resolveApplication(appId, user);
    if (user && user.role !== RoleType.SUPER_ADMIN && user.organisationId && config.organisationId && user.organisationId !== config.organisationId) {
      const err: any = new Error(`Access denied: Application belongs to another organization.`);
      err.statusCode = 403;
      err.code = 'FORBIDDEN_TENANT';
      throw err;
    }
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

      if (tenantConstituencyIds.length === 0) {
        return {
          applicationId: config.id,
          appName: config.organisationName,
          stateName: config.stateName || 'Andhra Pradesh',
          totalVoters: 0,
          verifiedCount: 0,
          verificationRate: 0,
          totalBooths: 0,
          totalGroups: 0,
          totalIncharges: 0,
          totalTasks: 0,
          totalMandals: 0,
          totalConstituencies: 0,
        };
      }
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

    // Consolidate voter counts into a single groupBy query to avoid double full-table scans
    const [voterSurveyGroups, totalBooths, totalGroups, totalIncharges, totalTasks, totalMandals, totalConstituencies] =
      await Promise.all([
        prisma.voter.groupBy({
          by: ['surveyStatus'],
          where: scopeWhere,
          _count: { _all: true },
        }),
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

    let totalVoters = 0;
    let verifiedVoters = 0;
    for (const g of voterSurveyGroups) {
      const count = Number(g._count._all || 0);
      totalVoters += count;
      if (g.surveyStatus === 'VERIFIED') {
        verifiedVoters += count;
      }
    }

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
