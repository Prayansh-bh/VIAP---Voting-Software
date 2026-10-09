import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AuditAction, OrgHierarchyLevel, Prisma, RoleType, TaskPriority, TaskStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { successResponse } from '../../common/response.js';
import { validateBody } from '../../common/validation.js';
import { authenticate, optionalAuthenticate } from '../../middleware/auth.js';
import { populateHierarchyScope, requireRoles } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import bcrypt from 'bcryptjs';
import {
  DEFAULT_ANALYTICS_CONFIG,
  DEFAULT_DASHBOARD_CONFIG,
  isUuid,
  loadCmsBundle,
  persistCmsConfig,
  serializeCmsConfig,
} from './cms.service.js';

// Schemas
const organisationSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2),
  description: z.string().optional(),
  logoUrl: z.string().optional(),
  website: z.string().optional(),
  isActive: z.boolean().default(true),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  faviconUrl: z.string().optional(),
});

const partySchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2),
  shortName: z.string().min(1),
  primaryColor: z.string().default('#eab308'),
  secondaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  symbolName: z.string().optional(),
  logoUrl: z.string().optional(),
  flagUrl: z.string().optional(),
  sortOrder: z.number().default(0),
  isActive: z.boolean().default(true),
  lifecycleStatus: z.enum(['DRAFT', 'PUBLISHED', 'LOCKED']).optional(),
  isLocked: z.boolean().optional(),
});

const brandingSchema = z.object({
  appName: z.string().min(2),
  headerTitle: z.string().min(2),
  logoUrl: z.string().optional(),
  faviconUrl: z.string().optional(),
  primaryColor: z.string(),
  secondaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  activePartyCode: z.string().default('TDP'),
  slogan: z.string().optional(),
  loginTitle: z.string().optional(),
  loginSubtitle: z.string().optional(),
  loginBannerUrl: z.string().optional(),
  typography: z.string().default('Inter'),
});

const featureTogglesSchema = z.record(z.string(), z.boolean());

const hierarchyLabelsSchema = z.record(z.string(), z.string());

const dashboardConfigSchema = z.record(z.string(), z.any());

const analyticsConfigSchema = z.object({
  electionYear: z.number().default(2024),
  targetSeats: z.number().default(175),
  majorityMark: z.number().default(88),
  projectionLabels: z.record(z.string(), z.string()).optional(),
  trackedParties: z.array(z.string()).default(['TDP', 'YSRCP', 'JSP', 'BJP', 'INC', 'OTH']),
});

const taskTemplateSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  instructions: z.string().optional(),
  category: z.enum(['CAMPAIGN', 'SURVEY', 'VOTER_VERIFICATION', 'TRAINING', 'HIGH_COMMAND']).default('CAMPAIGN'),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  targetLevel: z.nativeEnum(OrgHierarchyLevel).default(OrgHierarchyLevel.VOTER_GROUP),
});

const announcementSchema = z.object({
  title: z.string().min(3),
  content: z.string().min(3),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.HIGH),
  targetLevel: z.nativeEnum(OrgHierarchyLevel).optional(),
  targetUnitId: z.string().uuid().optional(),
  expiresAt: z.string().datetime().optional(),
});

const buildApplicationSchema = z.object({
  id: z.string().nullish(),
  appKey: z.string().nullish(),
  appName: z.string().min(1).default('My Application'),
  organisationName: z.string().min(1).default('My Organisation'),
  headerTitle: z.string().nullish(),
  slogan: z.string().nullish(),
  logoUrl: z.string().nullish(),
  faviconUrl: z.string().nullish(),
  stateName: z.string().nullish().default('Andhra Pradesh'),
  primaryColor: z.string().nullish().default('#eab308'),
  secondaryColor: z.string().nullish().default('#1e293b'),
  accentColor: z.string().nullish().default('#3b82f6'),
  activePartyCode: z.string().nullish().default('TDP'),
  appScope: z.enum(['SINGLE_MLA', 'PARLIAMENT_MP', 'ZONE', 'STATE']).default('SINGLE_MLA'),
  activeHierarchyLevels: z.array(z.string()).default(['STATE', 'ZONE', 'PARLIAMENT', 'DISTRICT', 'CONSTITUENCY', 'MANDAL', 'VILLAGE', 'BOOTH', 'VOTER_GROUP']),
  parliamentName: z.string().nullish(),
  parliamentCode: z.string().nullish(),
  constituencies: z.array(z.object({
    id: z.string().nullish(),
    name: z.string().min(1),
    code: z.string().nullish(),
    totalVoters: z.number().nullish(),
    votersCount: z.number().nullish(),
    candidateName: z.string().nullish(),
    mlaName: z.string().nullish(),
    parliamentName: z.string().nullish(),
    candidateEmail: z.string().nullish(),
  }).passthrough()).default([]),
  candidateName: z.string().nullish(),
  candidateMobile: z.string().nullish(),
  candidateEmail: z.string().nullish(),
  password: z.string().nullish(),
  tenantCode: z.string().nullish(),
  politicalParties: z.array(z.object({
    name: z.string().min(1),
    code: z.string().min(1),
    shortName: z.string().nullish(),
    primaryColor: z.string().nullish().default('#eab308'),
    secondaryColor: z.string().nullish(),
    accentColor: z.string().nullish(),
    symbolName: z.string().nullish(),
    logoUrl: z.string().nullish(),
    isActive: z.boolean().default(true),
    sortOrder: z.number().nullish(),
  }).passthrough()).default([]),
  hierarchyLabels: z.record(z.string(), z.string()).nullish(),
  featureToggles: z.record(z.string(), z.boolean()).nullish(),
}).passthrough();

export async function cmsRoutes(fastify: FastifyInstance) {
  // --------------------------------------------------------------------------
  // PUBLIC / APP CONFIG ENDPOINT (Consumed dynamically by Frontend)
  // --------------------------------------------------------------------------
  fastify.get('/config', { preHandler: [optionalAuthenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const query = (req.query || {}) as Record<string, string>;
    const orgId = (req as any).user?.organisationId || (req.headers['x-organisation-id'] as string) || query.organisationId || query.orgId;
    const tenantCode = (req.headers['x-tenant-code'] as string) || query.app || query.tenant || query.tenantCode;
    const bundle = await loadCmsBundle({ organisationId: orgId, configKey: tenantCode });
    return reply.send(
      successResponse({
        config: bundle.config,
        parties: bundle.parties,
        announcements: bundle.announcements,
        constituencies: bundle.constituencies,
      }),
    );
  });

  fastify.put(
    '/config',
    {
      preHandler: [authenticate, requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND)],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = (req.body || {}) as Record<string, any>;
      const saved = await persistCmsConfig({
        organisationName: body.organisationName || body.appName,
        headerTitle: body.headerTitle || body.organisationName || body.appName,
        slogan: body.slogan,
        logoUrl: body.logoUrl,
        faviconUrl: body.faviconUrl,
        stateName: body.stateName,
        defaultLanguage: body.defaultLanguage,
        primaryColor: body.primaryColor,
        secondaryColor: body.secondaryColor,
        accentColor: body.accentColor,
        activePartyCode: body.activePartyCode,
        appScope: body.appScope,
        parliamentName: body.parliamentName,
        parliamentCode: body.parliamentCode,
        candidateName: body.candidateName,
        hierarchyLabels: body.hierarchyLabels,
        featureToggles: body.featureToggles,
        activeHierarchyLevels: body.activeHierarchyLevels,
        dashboardConfig: body.dashboardConfig,
        analyticsConfig: body.analyticsConfig,
        aiEnabled: body.aiEnabled,
      });

      if (body.activePartyCode && body.primaryColor) {
        await prisma.politicalParty.updateMany({
          where: { code: body.activePartyCode },
          data: {
            primaryColor: body.primaryColor,
            secondaryColor: body.secondaryColor,
            accentColor: body.accentColor,
            logoUrl: body.logoUrl,
          },
        });
      }

      await logAudit({
        action: AuditAction.UPDATE,
        entityType: 'CMSConfiguration',
        entityId: saved.id,
        req,
        changes: body as unknown as Prisma.InputJsonValue,
      });

      const parties = await prisma.politicalParty.findMany({
        where: {
          isActive: true,
          NOT: {
            code: { startsWith: 'TEST_' },
          },
        },
        orderBy: { sortOrder: 'asc' },
      });

      return reply.send(successResponse(serializeCmsConfig(saved, { parties }), 'CMS configuration saved'));
    },
  );

  // --------------------------------------------------------------------------
  // DYNAMIC APPLICATION BUILDER & GENERATOR (CMS Phase 1)
  // --------------------------------------------------------------------------
  fastify.post(
    '/build-application',
    {
      preHandler: [authenticate],
      preValidation: [validateBody(buildApplicationSchema)],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = req.body as z.infer<typeof buildApplicationSchema>;

      // 1. Ensure distinct Organisation exists or create new isolated tenant
      const rawCode = (body.tenantCode || body.appKey || `${body.activePartyCode || 'APP'}-${body.appName || 'DEFAULT'}`)
        .replace(/[^A-Za-z0-9]/g, '-')
        .toUpperCase()
        .slice(0, 15);

      let org = await prisma.organisation.findFirst({
        where: {
          OR: [
            { code: rawCode },
            { name: { equals: body.organisationName || body.appName, mode: 'insensitive' } },
          ],
        },
      });

      if (!org) {
        let uniqueCode = rawCode;
        const codeCollision = await prisma.organisation.findUnique({ where: { code: uniqueCode } });
        if (codeCollision) {
          uniqueCode = `${rawCode.slice(0, 10)}-${Date.now().toString().slice(-4)}`;
        }

        org = await prisma.organisation.create({
          data: {
            name: body.organisationName || body.appName,
            code: uniqueCode,
            logoUrl: body.logoUrl,
            isActive: true,
          },
        });
      } else {
        org = await prisma.organisation.update({
          where: { id: org.id },
          data: {
            name: body.organisationName || body.appName,
            logoUrl: body.logoUrl || org.logoUrl,
          },
        });
      }

      // 2. Ensure State exists for this organisation
      const targetStateName = body.stateName || 'Andhra Pradesh';
      let state = await prisma.state.findFirst({
        where: {
          organisationId: org.id,
          name: { equals: targetStateName, mode: 'insensitive' },
        },
      });
      if (!state) {
        let stateCode = `${(body.stateName || 'AP').slice(0, 3).toUpperCase()}-${org.code.slice(0, 4)}`;
        const stateCodeCollision = await prisma.state.findUnique({ where: { code: stateCode } });
        if (stateCodeCollision) {
          stateCode = `${(body.stateName || 'AP').slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;
        }
        state = await prisma.state.create({
          data: {
            organisationId: org.id,
            name: body.stateName || 'Andhra Pradesh',
            code: stateCode,
            totalVoters: 0,
          },
        });
        await prisma.organizationUnit.upsert({
          where: { code: state.code },
          update: {
            name: `${state.name} (${org.name})`,
            level: OrgHierarchyLevel.STATE,
          },
          create: {
            name: `${state.name} (${org.name})`,
            code: state.code,
            level: OrgHierarchyLevel.STATE,
          },
        });
      }

      // 3. Ensure Zone exists for this State
      let zone = await prisma.zone.findFirst({
        where: { stateId: state.id },
      });
      if (!zone) {
        let zoneCode = `ZN-${state.code}-01`;
        const zoneCollision = await prisma.zone.findUnique({ where: { code: zoneCode } });
        if (zoneCollision) zoneCode = `ZN-${state.code}-${Date.now().toString().slice(-4)}`;
        zone = await prisma.zone.create({
          data: {
            stateId: state.id,
            name: `${state.name} Central Zone`,
            code: zoneCode,
            totalVoters: 0,
          },
        });
        const stateUnit = await prisma.organizationUnit.findFirst({
          where: { code: state.code, level: OrgHierarchyLevel.STATE },
        });
        await prisma.organizationUnit.upsert({
          where: { code: zone.code },
          update: {
            name: zone.name,
            level: OrgHierarchyLevel.ZONE,
            parentId: stateUnit?.id,
          },
          create: {
            name: zone.name,
            code: zone.code,
            level: OrgHierarchyLevel.ZONE,
            parentId: stateUnit?.id,
          },
        });
      }

      // 4. Ensure Parliament exists for this Zone
      const parName = body.parliamentName || (body.appScope === 'PARLIAMENT_MP' ? 'Ongole Parliament Constituency' : 'Central Parliament');
      let parliament = await prisma.parliament.findFirst({
        where: {
          zoneId: zone.id,
          name: { equals: parName, mode: 'insensitive' },
        },
      });
      if (!parliament) {
        let parCode = body.parliamentCode || `PC-${parName.slice(0, 4).toUpperCase()}-${org.code.slice(0, 4)}`;
        const parCollision = await prisma.parliament.findUnique({ where: { code: parCode } });
        if (parCollision) parCode = `PC-${parName.slice(0, 4).toUpperCase()}-${Date.now().toString().slice(-4)}`;
        parliament = await prisma.parliament.create({
          data: {
            zoneId: zone.id,
            name: parName,
            code: parCode,
            totalVoters: 0,
          },
        });
        const zoneUnit = await prisma.organizationUnit.findFirst({
          where: { code: zone.code, level: OrgHierarchyLevel.ZONE },
        });
        await prisma.organizationUnit.upsert({
          where: { code: parliament.code },
          update: {
            name: parliament.name,
            level: OrgHierarchyLevel.PARLIAMENT,
            parentId: zoneUnit?.id,
          },
          create: {
            name: parliament.name,
            code: parliament.code,
            level: OrgHierarchyLevel.PARLIAMENT,
            parentId: zoneUnit?.id,
          },
        });
      } else if (body.parliamentName) {
        parliament = await prisma.parliament.update({
          where: { id: parliament.id },
          data: { name: body.parliamentName },
        });
      }

      const parUnit = await prisma.organizationUnit.findFirst({
        where: { code: parliament.code, level: OrgHierarchyLevel.PARLIAMENT },
      });

      // 5. Create / Update all specified Assembly Constituencies (zero default voters)
      const createdConstituencies: any[] = [];
      const incomingConstituencies = body.constituencies && body.constituencies.length > 0
        ? body.constituencies
        : [{ name: body.headerTitle || body.organisationName || 'Kondapi', code: `AC-${org.code.slice(0, 4)}-01`, totalVoters: 0 }];

      for (let i = 0; i < incomingConstituencies.length; i++) {
        const c = incomingConstituencies[i];
        const cleanName = c.name.trim();
        if (!cleanName) continue;

        let constRecord = await prisma.constituency.findFirst({
          where: {
            parliamentId: parliament.id,
            name: { equals: cleanName, mode: 'insensitive' },
          },
        });

        let code = c.code || `AC-${cleanName.slice(0, 4).toUpperCase()}-${org.code.slice(0, 4)}-${i + 1}`;
        const codeCollision = await prisma.constituency.findUnique({ where: { code } });
        if (codeCollision && (!constRecord || constRecord.id !== codeCollision.id)) {
          code = `AC-${cleanName.slice(0, 4).toUpperCase()}-${Date.now().toString().slice(-4)}-${i + 1}`;
        }
        const totalVoters = c.totalVoters || (c as any).votersCount || 0;

        if (!constRecord) {
          constRecord = await prisma.constituency.create({
            data: {
              parliamentId: parliament.id,
              name: cleanName,
              code,
              totalVoters,
            },
          });
          await prisma.organizationUnit.upsert({
            where: { code },
            update: {
              name: cleanName,
              level: OrgHierarchyLevel.CONSTITUENCY,
              parentId: parUnit?.id,
            },
            create: {
              name: cleanName,
              code,
              level: OrgHierarchyLevel.CONSTITUENCY,
              parentId: parUnit?.id,
            },
          });
        } else {
          constRecord = await prisma.constituency.update({
            where: { id: constRecord.id },
            data: {
              name: cleanName,
              code,
              totalVoters: totalVoters,
              parliamentId: parliament.id,
            },
          });
          await prisma.organizationUnit.upsert({
            where: { code },
            update: {
              name: cleanName,
              level: OrgHierarchyLevel.CONSTITUENCY,
              parentId: parUnit?.id,
            },
            create: {
              name: cleanName,
              code,
              level: OrgHierarchyLevel.CONSTITUENCY,
              parentId: parUnit?.id,
            },
          });
        }

        createdConstituencies.push(constRecord);
      }

      // 6. Sync Political Parties
      if (body.politicalParties && body.politicalParties.length > 0) {
        for (let i = 0; i < body.politicalParties.length; i++) {
          const p = body.politicalParties[i];
          const partyCode = p.code.trim().toUpperCase();
          if (!partyCode) continue;

          const existingParty = await prisma.politicalParty.findUnique({ where: { code: partyCode } });
          if (!existingParty) {
            await prisma.politicalParty.create({
              data: {
                organisationId: org.id,
                name: p.name,
                code: partyCode,
                shortName: p.shortName || partyCode,
                primaryColor: p.primaryColor || '#eab308',
                secondaryColor: p.secondaryColor || null,
                accentColor: p.accentColor || null,
                symbolName: p.symbolName || null,
                logoUrl: p.logoUrl || null,
                isActive: p.isActive !== false,
                sortOrder: p.sortOrder !== undefined && p.sortOrder !== null ? p.sortOrder : i,
              },
            });
          } else {
            await prisma.politicalParty.update({
              where: { id: existingParty.id },
              data: {
                name: p.name,
                shortName: p.shortName || partyCode,
                primaryColor: p.primaryColor || '#eab308',
                secondaryColor: p.secondaryColor || null,
                accentColor: p.accentColor || null,
                symbolName: p.symbolName || null,
                logoUrl: p.logoUrl || null,
                isActive: p.isActive !== false,
                sortOrder: p.sortOrder !== undefined && p.sortOrder !== null ? p.sortOrder : i,
                ...(!existingParty.organisationId ? { organisationId: org.id } : {}),
              },
            });
          }
        }
      }

      // 7. Store / Update CMSConfiguration
      const mergedHierarchyLabels = {
        STATE: 'State',
        ZONE: 'Zone',
        PARLIAMENT: 'Parliament',
        CONSTITUENCY: 'Constituency',
        MANDAL: 'Mandal',
        VILLAGE: 'Village',
        BOOTH: 'Booth',
        VOTER_GROUP: '100-Voter Incharge',
        ...(body.hierarchyLabels || {}),
      };

      const tenantConfigKey = (body.appKey || body.tenantCode || org.code).toLowerCase();
      const configPayload = {
        organisationId: org.id,
        organisationName: body.organisationName || body.appName,
        headerTitle: body.headerTitle || body.appName,
        slogan: body.slogan || undefined,
        logoUrl: body.logoUrl || undefined,
        faviconUrl: body.faviconUrl || undefined,
        stateName: body.stateName || 'Andhra Pradesh',
        primaryColor: body.primaryColor || '#eab308',
        secondaryColor: body.secondaryColor || '#1e293b',
        accentColor: body.accentColor || '#3b82f6',
        activePartyCode: body.activePartyCode || 'TDP',
        appScope: body.appScope,
        parliamentName: parliament.name,
        parliamentCode: parliament.code,
        candidateName: ((body as any).candidateName || undefined) as string | undefined,
        hierarchyLabels: mergedHierarchyLabels,
        featureToggles: body.featureToggles || undefined,
        activeHierarchyLevels: body.activeHierarchyLevels,
      };

      const updatedConfig = await persistCmsConfig({
        ...configPayload,
        configKey: tenantConfigKey,
      });



      // 8. Provision Incharge Accounts & Candidate Credentials
      const rawCandidateMobile = (body as any).candidateMobile?.trim() || '9848012345';
      const candidateMobile = rawCandidateMobile.replace(/\D/g, '').slice(-10) || '9848012345';
      const candidateEmail = (body as any).candidateEmail?.trim().toLowerCase() || `candidate@${(body.appName || 'party').toLowerCase().replace(/[^a-z0-9]/g, '')}.org`;
      const candidateName = (body as any).candidateName?.trim() || 'Key Candidate';
      const initialPassword = (body as any).password?.trim() || 'Kondapi@2026';
      const passwordHash = await bcrypt.hash(initialPassword, 10);

      const stateUnitRecord = await prisma.organizationUnit.findFirst({
        where: { code: state.code, level: OrgHierarchyLevel.STATE },
      });
      const zoneUnitRecord = await prisma.organizationUnit.findFirst({
        where: { code: zone.code, level: OrgHierarchyLevel.ZONE },
      });
      const parUnitRecord = await prisma.organizationUnit.findFirst({
        where: { code: parliament.code, level: OrgHierarchyLevel.PARLIAMENT },
      });
      const constUnitRecord = createdConstituencies[0]
        ? await prisma.organizationUnit.findFirst({
            where: { code: createdConstituencies[0].code, level: OrgHierarchyLevel.CONSTITUENCY },
          })
        : null;

      const primaryRole = body.appScope === 'STATE'
        ? RoleType.STATE_ADMIN
        : body.appScope === 'ZONE'
        ? RoleType.ZONE_INCHARGE
        : body.appScope === 'PARLIAMENT_MP'
        ? RoleType.PARLIAMENT_INCHARGE
        : RoleType.CONSTITUENCY_INCHARGE;

      const primaryUnitId = body.appScope === 'STATE'
        ? stateUnitRecord?.id
        : body.appScope === 'ZONE'
        ? zoneUnitRecord?.id
        : body.appScope === 'PARLIAMENT_MP'
        ? parUnitRecord?.id
        : constUnitRecord?.id || null;

      // Upsert primary candidate user in database
      const candidateUser = await prisma.user.upsert({
        where: { mobileNumber: candidateMobile },
        update: {
          name: candidateName,
          email: candidateEmail,
          passwordHash,
          role: primaryRole,
          accountStatus: 'ACTIVE',
          organisationId: org.id,
          unitId: primaryUnitId,
          isVerified: true,
        },
        create: {
          organisationId: org.id,
          userCode: `LEADER-${primaryRole.slice(0, 3)}-${candidateMobile.slice(-4)}`,
          name: candidateName,
          mobileNumber: candidateMobile,
          email: candidateEmail,
          passwordHash,
          role: primaryRole,
          accountStatus: 'ACTIVE',
          isVerified: true,
          unitId: primaryUnitId,
        },
      });

      if (primaryUnitId) {
        const existingAssignment = await prisma.userHierarchyAssignment.findFirst({
          where: { userId: candidateUser.id },
        });
        if (existingAssignment) {
          await prisma.userHierarchyAssignment.update({
            where: { id: existingAssignment.id },
            data: {
              roleType: primaryRole,
              isActive: true,
              stateId: state.id,
              zoneId: zone.id,
              parliamentId: parliament.id,
              constituencyId: createdConstituencies[0]?.id || null,
            },
          });
        } else {
          await prisma.userHierarchyAssignment.create({
            data: {
              userId: candidateUser.id,
              roleType: primaryRole,
              isActive: true,
              stateId: state.id,
              zoneId: zone.id,
              parliamentId: parliament.id,
              constituencyId: createdConstituencies[0]?.id || null,
            },
          });
        }
      }

      // Also ensure standard role accounts exist in DB for each hierarchy tier
      const standardRoles = [
        { role: RoleType.SUPER_ADMIN, email: 'superadmin@politicalconnect.in', mobile: '9848099999', name: 'Super Administrator', unitId: null },
        { role: RoleType.STATE_ADMIN, email: 'stateincharge@politicalconnect.in', mobile: '9848088888', name: `${state.name} State Incharge`, unitId: stateUnitRecord?.id || null },
        { role: RoleType.ZONE_INCHARGE, email: 'zone@politicalconnect.in', mobile: '9848099998', name: `${zone.name} Coordinator`, unitId: zoneUnitRecord?.id || null },
        { role: RoleType.PARLIAMENT_INCHARGE, email: 'mp@politicalconnect.in', mobile: '9848088887', name: `${parliament.name} Incharge`, unitId: parUnitRecord?.id || null },
        { role: RoleType.MANDAL_INCHARGE, email: 'mandal@politicalconnect.in', mobile: '9848077777', name: 'Mandal President', unitId: null },
        { role: RoleType.BOOTH_PRESIDENT, email: 'booth@politicalconnect.in', mobile: '9848010002', name: 'Booth President', unitId: null },
        { role: RoleType.VOTER_100_INCHARGE, email: 'voter100@politicalconnect.in', mobile: '9848010003', name: '100 Voter Incharge', unitId: null },
      ];

      for (const r of standardRoles) {
        if (r.mobile === candidateMobile) continue;
        const existing = await prisma.user.findUnique({ where: { mobileNumber: r.mobile } });
        if (!existing) {
          await prisma.user.create({
            data: {
              organisationId: org.id,
              userCode: `DEMO-${r.role.slice(0, 3)}-${r.mobile.slice(-4)}`,
              name: r.name,
              email: r.email,
              mobileNumber: r.mobile,
              passwordHash,
              role: r.role,
              accountStatus: 'ACTIVE',
              isVerified: true,
              unitId: r.unitId,
            },
          });
        }
      }


      const allParties = await prisma.politicalParty.findMany({
        where: {
          isActive: true,
          NOT: {
            code: { startsWith: 'TEST_' },
          },
        },
        orderBy: { sortOrder: 'asc' },
      });

      await logAudit({
        action: AuditAction.CREATE,
        entityType: 'ApplicationBuilder',
        entityId: updatedConfig.id,
        req,
        changes: body as unknown as Prisma.InputJsonValue,
      });

      return reply.status(201).send(
        successResponse({
          application: {
            appKey: body.appKey || `app_${Date.now()}`,
            tenantCode: org.code,
            organisationId: org.id,
            appName: body.appName,
            organisationName: body.organisationName,
            headerTitle: body.headerTitle || body.appName,
            slogan: body.slogan,
            logoUrl: body.logoUrl,
            stateName: body.stateName,
            primaryColor: body.primaryColor,
            secondaryColor: body.secondaryColor,
            accentColor: body.accentColor,
            activePartyCode: body.activePartyCode,
            appScope: body.appScope,
            activeHierarchyLevels: body.activeHierarchyLevels,
            parliamentName: parliament.name,
            candidateName,
            candidateMobile,
            candidateRole: primaryRole,
            initialPassword,
            constituencies: createdConstituencies,
            parties: allParties,
          },
          credentials: {
            mobileNumber: candidateMobile,
            role: primaryRole,
            password: initialPassword,
            tenantCode: org.code,
          },
          constituencies: createdConstituencies,
          parties: allParties,
        }, 'Application built and provisioned successfully! Ready for Data & Incharge Assignment.'),
      );
    },
  );

  // --------------------------------------------------------------------------
  // LIST CONSTITUENCIES
  // --------------------------------------------------------------------------
  fastify.get('/constituencies', { preHandler: [authenticate] }, async (_req: FastifyRequest, reply: FastifyReply) => {
    const list = await prisma.constituency.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        totalVoters: true,
        parliament: { select: { id: true, name: true, code: true } },
        _count: { select: { mandals: true, voters: true } },
      },
      orderBy: { name: 'asc' },
    });
    return reply.send(successResponse(list));
  });

  // --------------------------------------------------------------------------
  // 1. ORGANISATION MANAGEMENT
  // --------------------------------------------------------------------------
  fastify.get('/organisation', { preHandler: [authenticate] }, async (_req: FastifyRequest, reply: FastifyReply) => {
    const org = await prisma.organisation.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    return reply.send(successResponse(org));
  });

  fastify.put(
    '/organisation',
    {
      preHandler: [authenticate, requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN)],
      preValidation: [validateBody(organisationSchema)],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = req.body as z.infer<typeof organisationSchema>;
      const existing = await prisma.organisation.findFirst({ orderBy: { createdAt: 'asc' } });
      const orgData = {
        name: body.name,
        code: body.code,
        description: body.description,
        logoUrl: body.logoUrl,
        website: body.website,
        isActive: body.isActive,
      };

      let org;
      if (existing) {
        org = await prisma.organisation.update({
          where: { id: existing.id },
          data: orgData,
        });
      } else {
        org = await prisma.organisation.create({
          data: orgData,
        });
      }

      await logAudit({
        action: AuditAction.UPDATE,
        entityType: 'Organisation',
        entityId: org.id,
        req,
        changes: body as unknown as Prisma.InputJsonValue,
      });

      return reply.send(successResponse(org, 'Organisation settings updated'));
    },
  );

  // 2. POLITICAL PARTY MANAGEMENT (ONE-TIME LIFECYCLE: DRAFT -> PUBLISHED -> LOCKED)
  // --------------------------------------------------------------------------
  fastify.get('/parties', async (_req: FastifyRequest, reply: FastifyReply) => {
    const parties = await prisma.politicalParty.findMany({
      where: {
        NOT: {
          code: { startsWith: 'TEST_' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
    return reply.send(successResponse(parties));
  });

  // Create Party (Draft or Published/Locked)
  fastify.post(
    '/parties',
    {
      preHandler: [authenticate, requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN)],
      preValidation: [validateBody(partySchema)],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = req.body as z.infer<typeof partySchema>;
      const isDraft = body.lifecycleStatus === 'DRAFT';
      const org = await prisma.organisation.findFirst();

      const party = await prisma.politicalParty.create({
        data: {
          ...body,
          organisationId: org?.id,
          lifecycleStatus: isDraft ? 'DRAFT' : 'LOCKED',
          isLocked: !isDraft,
          publishedAt: isDraft ? null : new Date(),
        },
      });

      await logAudit({
        action: AuditAction.CREATE,
        entityType: 'PoliticalParty',
        entityId: party.id,
        req,
        changes: {
          ...body,
          lifecycleStatus: party.lifecycleStatus,
          isLocked: party.isLocked,
        } as unknown as Prisma.InputJsonValue,
      });

      return reply.status(201).send(successResponse(party, isDraft ? 'Party created in DRAFT state' : 'Party created, published and locked (immutable)'));
    },
  );

  // Publish & Lock Party (Transitions DRAFT -> PUBLISHED -> LOCKED)
  fastify.post(
    '/parties/:id/publish',
    {
      preHandler: [authenticate, requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN)],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const params = req.params as { id: string };
      const party = await prisma.politicalParty.findUnique({
        where: { id: params.id },
      });

      if (!party) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Party not found' },
        });
      }

      if (party.isLocked || party.lifecycleStatus === 'LOCKED') {
        return reply.status(200).send(successResponse(party, 'Party is already published and locked (immutable)'));
      }

      const lockedParty = await prisma.politicalParty.update({
        where: { id: params.id },
        data: {
          lifecycleStatus: 'LOCKED',
          isLocked: true,
          publishedAt: new Date(),
        },
      });

      await logAudit({
        action: AuditAction.UPDATE,
        entityType: 'PoliticalParty',
        entityId: lockedParty.id,
        req,
        changes: { lifecycleStatus: 'LOCKED', isLocked: true, publishedAt: lockedParty.publishedAt } as unknown as Prisma.InputJsonValue,
      });

      return reply.send(successResponse(lockedParty, 'Party published and locked successfully. Party is now immutable.'));
    },
  );

  // Patch / Edit Party (Forbidden if LOCKED)
  fastify.patch(
    '/parties/:id',
    {
      preHandler: [authenticate, requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN)],
      preValidation: [validateBody(partySchema.partial())],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const params = req.params as { id: string };
      const body = req.body as Partial<z.infer<typeof partySchema>>;

      const existingParty = await prisma.politicalParty.findUnique({
        where: { id: params.id },
      });

      if (!existingParty) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Party not found' },
        });
      }

      // STRICT IMMUTABILITY CHECK
      if (existingParty.isLocked || existingParty.lifecycleStatus === 'LOCKED') {
        await logAudit({
          action: AuditAction.UPDATE,
          entityType: 'PoliticalParty',
          entityId: existingParty.id,
          req,
          changes: {
            attemptedChanges: body,
            status: 'BLOCKED',
            reason: 'Party is published and immutable (LOCKED)',
          } as unknown as Prisma.InputJsonValue,
        });

        return reply.status(403).send({
          success: false,
          error: {
            code: 'PARTY_CONFIGURATION_LOCKED',
            message: 'Party configuration is published, locked and immutable. No modifications are permitted.',
          },
        });
      }

      const party = await prisma.politicalParty.update({
        where: { id: params.id },
        data: body,
      });

      await logAudit({
        action: AuditAction.UPDATE,
        entityType: 'PoliticalParty',
        entityId: party.id,
        req,
        changes: body as unknown as Prisma.InputJsonValue,
      });

      return reply.send(successResponse(party, 'Draft party updated successfully'));
    },
  );

  // Put / Replace Party (Forbidden if LOCKED)
  fastify.put(
    '/parties/:id',
    {
      preHandler: [authenticate, requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN)],
      preValidation: [validateBody(partySchema)],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const params = req.params as { id: string };
      const body = req.body as z.infer<typeof partySchema>;

      const existingParty = await prisma.politicalParty.findUnique({
        where: { id: params.id },
      });

      if (!existingParty) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Party not found' },
        });
      }

      // STRICT IMMUTABILITY CHECK
      if (existingParty.isLocked || existingParty.lifecycleStatus === 'LOCKED') {
        await logAudit({
          action: AuditAction.UPDATE,
          entityType: 'PoliticalParty',
          entityId: existingParty.id,
          req,
          changes: {
            attemptedChanges: body,
            status: 'BLOCKED',
            reason: 'Party is published and immutable (LOCKED)',
          } as unknown as Prisma.InputJsonValue,
        });

        return reply.status(403).send({
          success: false,
          error: {
            code: 'PARTY_CONFIGURATION_LOCKED',
            message: 'Party configuration is published, locked and immutable. No modifications are permitted.',
          },
        });
      }

      const party = await prisma.politicalParty.update({
        where: { id: params.id },
        data: body,
      });

      await logAudit({
        action: AuditAction.UPDATE,
        entityType: 'PoliticalParty',
        entityId: party.id,
        req,
        changes: body as unknown as Prisma.InputJsonValue,
      });

      return reply.send(successResponse(party, 'Draft party replaced successfully'));
    },
  );

  // Delete Party (Transactional cascade cleanup)
  fastify.delete(
    '/parties/:id',
    {
      preHandler: [authenticate, requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN)],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const params = req.params as { id: string };

      const existingParty = await prisma.politicalParty.findUnique({
        where: { id: params.id },
      });

      if (!existingParty) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Party not found' },
        });
      }

      await prisma.$transaction(async (tx) => {
        // 1. Detach voters preferring this party
        await tx.voter.updateMany({
          where: { politicalPartyId: existingParty.id },
          data: { politicalPartyId: null },
        });

        // 2. Clean up branding and performance records
        await tx.partyBranding.deleteMany({
          where: { partyId: existingParty.id },
        });

        await tx.partyPerformance.deleteMany({
          where: { partyId: existingParty.id },
        });

        // 3. Delete the political party record
        await tx.politicalParty.delete({
          where: { id: existingParty.id },
        });
      });

      await logAudit({
        action: AuditAction.DELETE,
        entityType: 'PoliticalParty',
        entityId: existingParty.id,
        req,
        changes: { name: existingParty.name, code: existingParty.code } as unknown as Prisma.InputJsonValue,
      });

      return reply.send(successResponse({ id: params.id }, `Political party '${existingParty.name}' permanently deleted`));
    },
  );

  // --------------------------------------------------------------------------
  // 3. BRANDING & THEME CONFIGURATION
  // --------------------------------------------------------------------------
  fastify.get('/branding', async (_req: FastifyRequest, reply: FastifyReply) => {
    const bundle = await loadCmsBundle();
    return reply.send(successResponse(bundle.config));
  });

  fastify.put(
    '/branding',
    {
      preHandler: [authenticate, requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN)],
      preValidation: [validateBody(brandingSchema)],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = req.body as z.infer<typeof brandingSchema>;

      const config = await persistCmsConfig({
        organisationName: body.appName,
        headerTitle: body.headerTitle,
        slogan: body.slogan,
        logoUrl: body.logoUrl,
        faviconUrl: body.faviconUrl,
        primaryColor: body.primaryColor,
        secondaryColor: body.secondaryColor,
        accentColor: body.accentColor,
        activePartyCode: body.activePartyCode,
      });

      // Also update primary party color if specified
      if (body.activePartyCode) {
        await prisma.politicalParty.updateMany({
          where: { code: body.activePartyCode },
          data: {
            primaryColor: body.primaryColor,
            secondaryColor: body.secondaryColor,
            accentColor: body.accentColor,
            logoUrl: body.logoUrl,
          },
        });
      }

      await logAudit({
        action: AuditAction.UPDATE,
        entityType: 'Branding',
        entityId: config.id,
        req,
        changes: body as unknown as Prisma.InputJsonValue,
      });

      return reply.send(successResponse(body, 'Branding updated successfully'));
    },
  );

  // --------------------------------------------------------------------------
  // 4. HIERARCHY TREE & DEPENDENCY-SAFE DELETION
  // --------------------------------------------------------------------------
  fastify.get('/hierarchy-tree', { preHandler: [authenticate] }, async (_req: FastifyRequest, reply: FastifyReply) => {
    const states = await prisma.state.findMany({
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

    return reply.send(successResponse(states));
  });

  fastify.delete(
    '/hierarchy-node/:level/:id',
    {
      preHandler: [authenticate, requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND)],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { level, id } = req.params as { level: string; id: string };

      // Dependency Check Logic
      let dependentCount = 0;
      let dependentType = '';

      switch (level.toUpperCase()) {
        case 'MANDAL': {
          const villageCount = await prisma.village.count({ where: { mandalId: id } });
          const voterCount = await prisma.voter.count({ where: { mandalId: id } });
          if (villageCount > 0 || voterCount > 0) {
            dependentCount = villageCount + voterCount;
            dependentType = `${villageCount} Villages, ${voterCount} Voters`;
          }
          break;
        }
        case 'VILLAGE': {
          const boothCount = await prisma.booth.count({ where: { villageId: id } });
          const voterCount = await prisma.voter.count({ where: { villageId: id } });
          if (boothCount > 0 || voterCount > 0) {
            dependentCount = boothCount + voterCount;
            dependentType = `${boothCount} Booths, ${voterCount} Voters`;
          }
          break;
        }
        case 'BOOTH': {
          const voterCount = await prisma.voter.count({ where: { boothId: id } });
          const groupCount = await prisma.voterGroup.count({ where: { boothId: id } });
          if (voterCount > 0 || groupCount > 0) {
            dependentCount = voterCount + groupCount;
            dependentType = `${groupCount} Incharge Units, ${voterCount} Voters`;
          }
          break;
        }
        case 'VOTER_GROUP': {
          const voterCount = await prisma.voter.count({ where: { voterGroupId: id } });
          if (voterCount > 0) {
            dependentCount = voterCount;
            dependentType = `${voterCount} Voters assigned`;
          }
          break;
        }
      }

      if (dependentCount > 0) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'DEPENDENCY_EXISTS',
            message: `Cannot delete ${level} record: ${dependentType} are currently linked. Reassign or remove children first.`,
          },
        });
      }

      // Safe to delete
      switch (level.toUpperCase()) {
        case 'MANDAL':
          await prisma.mandal.delete({ where: { id } });
          break;
        case 'VILLAGE':
          await prisma.village.delete({ where: { id } });
          break;
        case 'BOOTH':
          await prisma.booth.delete({ where: { id } });
          break;
        case 'VOTER_GROUP':
          await prisma.voterGroup.delete({ where: { id } });
          break;
      }

      await logAudit({
        action: AuditAction.DELETE,
        entityType: `HierarchyNode_${level}`,
        entityId: id,
        req,
      });

      return reply.send(successResponse({ id, deleted: true }, `${level} node deleted safely`));
    },
  );

  // --------------------------------------------------------------------------
  // 5. FEATURE CONFIGURATION
  // --------------------------------------------------------------------------
  fastify.get('/features', { preHandler: [authenticate] }, async (_req: FastifyRequest, reply: FastifyReply) => {
    const config = (await prisma.cMSConfiguration.findUnique({
      where: { configKey: 'default' },
    })) || (await prisma.cMSConfiguration.findFirst({ orderBy: { updatedAt: 'desc' } }));
    return reply.send(successResponse(config?.featureToggles || {}));
  });

  fastify.put(
    '/features',
    {
      preHandler: [authenticate, requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN)],
      preValidation: [validateBody(featureTogglesSchema)],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = req.body as Record<string, boolean>;

      const config = await persistCmsConfig({ featureToggles: body });

      await logAudit({
        action: AuditAction.UPDATE,
        entityType: 'FeatureToggles',
        entityId: config.id,
        req,
        changes: body as unknown as Prisma.InputJsonValue,
      });

      return reply.send(successResponse(body, 'Feature toggles updated'));
    },
  );

  // --------------------------------------------------------------------------
  // 6. DASHBOARD CONFIGURATION (Per-role Card & Section Visibility)
  // --------------------------------------------------------------------------
  fastify.get('/dashboard-config', { preHandler: [authenticate] }, async (_req: FastifyRequest, reply: FastifyReply) => {
    const config = (await prisma.cMSConfiguration.findUnique({
      where: { configKey: 'default' },
    })) || (await prisma.cMSConfiguration.findFirst({ orderBy: { updatedAt: 'desc' } }));
    return reply.send(successResponse(config?.dashboardConfig || DEFAULT_DASHBOARD_CONFIG));
  });

  fastify.put(
    '/dashboard-config',
    {
      preHandler: [authenticate, requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN)],
      preValidation: [validateBody(dashboardConfigSchema)],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = req.body as Record<string, any>;

      const saved = await persistCmsConfig({ dashboardConfig: body });

      await logAudit({
        action: AuditAction.UPDATE,
        entityType: 'DashboardConfig',
        entityId: saved.id,
        req,
        changes: body as unknown as Prisma.InputJsonValue,
      });

      return reply.send(successResponse(body, 'Dashboard configuration updated'));
    },
  );

  // --------------------------------------------------------------------------
  // 7. TRAINING CMS
  // --------------------------------------------------------------------------
  fastify.get('/training', { preHandler: [authenticate] }, async (_req: FastifyRequest, reply: FastifyReply) => {
    const videos = await prisma.trainingVideo.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: {
        assignments: true,
        progress: { include: { user: true } },
      },
    });
    return reply.send(successResponse(videos));
  });

  // --------------------------------------------------------------------------
  // 8. TASK CMS & TEMPLATES
  // --------------------------------------------------------------------------
  fastify.get('/task-templates', { preHandler: [authenticate] }, async (_req: FastifyRequest, reply: FastifyReply) => {
    const templates = [
      {
        id: 'tpl-1',
        title: 'Complete Door-to-Door Voter Verification',
        category: 'VOTER_VERIFICATION',
        priority: 'HIGH',
        targetLevel: 'VOTER_GROUP',
        description: 'Verify phone number, resident status, and political preference for all assigned 100 voters.',
        instructions: '1. Visit household.\n2. Verify EPIC card.\n3. Mark local/migrated in app.',
      },
      {
        id: 'tpl-2',
        title: 'Deploy Migration Transport Helpline',
        category: 'CAMPAIGN',
        priority: 'HIGH',
        targetLevel: 'MANDAL',
        description: 'Coordinate buses and travel reimbursement for voters residing in Hyderabad/Bengaluru/Chennai.',
        instructions: 'Call each migrated voter 3 days before polling date.',
      },
      {
        id: 'tpl-3',
        title: 'Conduct Polling Agent Mock Drill',
        category: 'TRAINING',
        priority: 'URGENT',
        targetLevel: 'BOOTH',
        description: 'Train booth agents on Form 17C, EVM mock poll verification, and real-time app logging.',
        instructions: 'Assemble booth agents at Panchayat hall at 6:00 PM.',
      },
      {
        id: 'tpl-4',
        title: 'High-Command Turnout Blitz Directives',
        category: 'HIGH_COMMAND',
        priority: 'URGENT',
        targetLevel: 'CONSTITUENCY',
        description: 'Achieve 85%+ voter turnout in neutral-leaning and high-strength polling stations.',
        instructions: 'Monitor live vote pulse every 30 minutes on Election Day.',
      },
    ];
    return reply.send(successResponse(templates));
  });

  // --------------------------------------------------------------------------
  // 9. ANNOUNCEMENTS CMS
  // --------------------------------------------------------------------------
  fastify.get('/announcements', { preHandler: [authenticate] }, async (_req: FastifyRequest, reply: FastifyReply) => {
    const items = await prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return reply.send(successResponse(items));
  });

  fastify.post(
    '/announcements',
    {
      preHandler: [authenticate, requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN, RoleType.CONSTITUENCY_INCHARGE)],
      preValidation: [validateBody(announcementSchema)],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = req.body as z.infer<typeof announcementSchema>;

      const announcement = await prisma.announcement.create({
        data: {
          title: body.title,
          content: body.content,
          priority: body.priority,
          targetLevel: body.targetLevel,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
        },
      });

      await logAudit({
        action: AuditAction.CREATE,
        entityType: 'Announcement',
        entityId: announcement.id,
        req,
        changes: body as unknown as Prisma.InputJsonValue,
      });

      return reply.status(201).send(successResponse(announcement, 'Announcement published'));
    },
  );

  fastify.delete(
    '/announcements/:id',
    {
      preHandler: [authenticate, requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN)],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const params = req.params as { id: string };

      await prisma.announcement.delete({
        where: { id: params.id },
      });

      await logAudit({
        action: AuditAction.DELETE,
        entityType: 'Announcement',
        entityId: params.id,
        req,
      });

      return reply.send(successResponse({ id: params.id, deleted: true }, 'Announcement deleted'));
    },
  );

  // --------------------------------------------------------------------------
  // 10. POLITICAL ANALYTICS CONFIGURATION
  // --------------------------------------------------------------------------
  fastify.get(
    '/analytics-config',
    {
      preHandler: [authenticate, requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN)],
    },
    async (_req: FastifyRequest, reply: FastifyReply) => {
    const config = (await prisma.cMSConfiguration.findUnique({
      where: { configKey: 'default' },
    })) || (await prisma.cMSConfiguration.findFirst({ orderBy: { updatedAt: 'desc' } }));
    return reply.send(successResponse(config?.analyticsConfig || DEFAULT_ANALYTICS_CONFIG));
  });

  fastify.put(
    '/analytics-config',
    {
      preHandler: [authenticate, requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN)],
      preValidation: [validateBody(analyticsConfigSchema)],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = req.body as z.infer<typeof analyticsConfigSchema>;

      const saved = await persistCmsConfig({ analyticsConfig: body });

      await logAudit({
        action: AuditAction.UPDATE,
        entityType: 'AnalyticsConfig',
        entityId: saved.id,
        req,
        changes: body as unknown as Prisma.InputJsonValue,
      });

      return reply.send(successResponse(body, 'Analytics configuration updated'));
    },
  );

  // --------------------------------------------------------------------------
  // 11. INCHARGE ASSIGNMENT CMS
  // --------------------------------------------------------------------------
  fastify.get(
    '/incharges',
    {
      preHandler: [authenticate, requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN, RoleType.CONSTITUENCY_INCHARGE)],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as { constituencyId?: string };

    let constituency = query.constituencyId
      ? await prisma.constituency.findUnique({
          where: { id: query.constituencyId },
          include: {
            mandals: {
              include: {
                villages: {
                  include: {
                    booths: {
                      include: {
                        voterGroups: {
                          include: { assignedIncharge: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        })
      : await prisma.constituency.findFirst({
          include: {
            mandals: {
              include: {
                villages: {
                  include: {
                    booths: {
                      include: {
                        voterGroups: {
                          include: { assignedIncharge: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        });

    if (!constituency) {
      return reply.send(successResponse({ constituency: null, mandals: [] }));
    }

    // Fetch all active assignments
    const assignments = await prisma.userHierarchyAssignment.findMany({
      where: { isActive: true },
      include: {
        user: true,
      },
    });

    const userByUnitId = new Map<string, any>();
    for (const a of assignments) {
      if (a.voterGroupId) userByUnitId.set(`VOTER_GROUP:${a.voterGroupId}`, a.user);
      if (a.boothId) userByUnitId.set(`BOOTH:${a.boothId}`, a.user);
      if (a.villageId) userByUnitId.set(`VILLAGE:${a.villageId}`, a.user);
      if (a.mandalId) userByUnitId.set(`MANDAL:${a.mandalId}`, a.user);
      if (a.constituencyId) userByUnitId.set(`CONSTITUENCY:${a.constituencyId}`, a.user);
    }

    const formatUser = (user?: any) => {
      if (!user) return null;
      return {
        id: user.id,
        userName: user.name || 'Assigned Officer',
        mobileNumber: user.mobileNumber || 'N/A',
        role: user.role,
        accountStatus: user.accountStatus,
      };
    };

    const tree = {
      constituency: {
        id: constituency.id,
        name: constituency.name,
        code: constituency.code,
        incharge: formatUser(userByUnitId.get(`CONSTITUENCY:${constituency.id}`)),
      },
      mandals: constituency.mandals.map((m) => ({
        id: m.id,
        name: m.name,
        code: m.code,
        totalVoters: m.totalVoters,
        incharge: formatUser(userByUnitId.get(`MANDAL:${m.id}`)),
        villages: m.villages.map((v) => ({
          id: v.id,
          name: v.name,
          code: v.code,
          totalVoters: v.totalVoters,
          incharge: formatUser(userByUnitId.get(`VILLAGE:${v.id}`)),
          booths: v.booths.map((b) => ({
            id: b.id,
            boothNumber: b.boothNumber,
            name: b.name,
            totalVoters: b.totalVoters,
            incharge: formatUser(userByUnitId.get(`BOOTH:${b.id}`)),
            voterGroups: b.voterGroups.map((g) => ({
              id: g.id,
              name: g.name,
              totalVoters: g.totalVoters,
              incharge: formatUser(g.assignedIncharge || userByUnitId.get(`VOTER_GROUP:${g.id}`)),
            })),
          })),
        })),
      })),
    };

    return reply.send(successResponse(tree));
  });

  fastify.post(
    '/assign-incharge',
    {
      preHandler: [authenticate, requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN, RoleType.CONSTITUENCY_INCHARGE)],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = req.body as {
        unitLevel: 'STATE' | 'ZONE' | 'PARLIAMENT' | 'CONSTITUENCY' | 'MANDAL' | 'VILLAGE' | 'BOOTH' | 'VOTER_GROUP';
        unitId: string;
        role: RoleType;
        userName: string;
        mobileNumber: string;
        email?: string;
      };

      if (!body.unitId || !body.mobileNumber || !body.userName) {
        return reply.status(400).send({ error: { message: 'unitId, mobileNumber, and userName are required' } });
      }

      const cleanMobile = body.mobileNumber.replace(/\D/g, '').slice(-10);

      // 1. Find or create Organization
      let org = await prisma.organisation.findFirst();
      if (!org) {
        org = await prisma.organisation.create({
          data: { name: 'Telugu Desam Party', code: 'TDP-ORG' },
        });
      }

      // 2. Find or create User
      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { mobileNumber: cleanMobile },
            { mobileNumber: `+91${cleanMobile}` },
          ],
        },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            organisationId: org.id,
            userCode: `KDP-${cleanMobile.slice(-4)}-${Date.now().toString().slice(-4)}`,
            name: body.userName,
            mobileNumber: cleanMobile,
            role: body.role || RoleType.VOTER_100_INCHARGE,
            accountStatus: 'ACTIVE',
          },
        });
      } else {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            name: body.userName,
            role: body.role || user.role,
            accountStatus: 'ACTIVE',
          },
        });
      }

      // 3. Create or update UserHierarchyAssignment
      const assignmentData: Prisma.UserHierarchyAssignmentUncheckedCreateInput = {
        userId: user.id,
        roleType: body.role || user.role,
        isActive: true,
      };

      if (body.unitLevel === 'STATE') assignmentData.stateId = body.unitId;
      else if (body.unitLevel === 'ZONE') assignmentData.zoneId = body.unitId;
      else if (body.unitLevel === 'PARLIAMENT') assignmentData.parliamentId = body.unitId;
      else if (body.unitLevel === 'CONSTITUENCY') assignmentData.constituencyId = body.unitId;
      else if (body.unitLevel === 'MANDAL') assignmentData.mandalId = body.unitId;
      else if (body.unitLevel === 'VILLAGE') assignmentData.villageId = body.unitId;
      else if (body.unitLevel === 'BOOTH') assignmentData.boothId = body.unitId;
      else if (body.unitLevel === 'VOTER_GROUP') {
        assignmentData.voterGroupId = body.unitId;
        await prisma.voterGroup.update({
          where: { id: body.unitId },
          data: { assignedInchargeId: user.id },
        });
        await prisma.voter.updateMany({
          where: { voterGroupId: body.unitId },
          data: { assignedInchargeId: user.id },
        });
      }

      const existingAssignment = await prisma.userHierarchyAssignment.findFirst({
        where: {
          userId: user.id,
          ...(assignmentData.stateId ? { stateId: assignmentData.stateId } : {}),
          ...(assignmentData.zoneId ? { zoneId: assignmentData.zoneId } : {}),
          ...(assignmentData.parliamentId ? { parliamentId: assignmentData.parliamentId } : {}),
          ...(assignmentData.constituencyId ? { constituencyId: assignmentData.constituencyId } : {}),
          ...(assignmentData.mandalId ? { mandalId: assignmentData.mandalId } : {}),
          ...(assignmentData.villageId ? { villageId: assignmentData.villageId } : {}),
          ...(assignmentData.boothId ? { boothId: assignmentData.boothId } : {}),
          ...(assignmentData.voterGroupId ? { voterGroupId: assignmentData.voterGroupId } : {}),
        },
      });

      if (existingAssignment) {
        await prisma.userHierarchyAssignment.update({
          where: { id: existingAssignment.id },
          data: { isActive: true, roleType: body.role || user.role },
        });
      } else {
        await prisma.userHierarchyAssignment.create({
          data: assignmentData,
        });
      }

      // 4. Create/update Cadre entry for Cadre Network view
      const existingCadre = await prisma.cadre.findFirst({
        where: { userId: user.id },
      });

      if (!existingCadre) {
        await prisma.cadre.create({
          data: {
            userId: user.id,
            performanceScore: 92.5,
            totalAssignedVoters: 100,
          },
        });
      }

      await logAudit({
        action: AuditAction.UPDATE,
        entityType: 'InchargeAssignment',
        entityId: user.id,
        req,
        changes: body as unknown as Prisma.InputJsonValue,
      });

      return reply.send(
        successResponse(
          {
            user: {
              id: user.id,
              userName: user.name,
              mobileNumber: user.mobileNumber,
              role: user.role,
            },
            unitLevel: body.unitLevel,
            unitId: body.unitId,
          },
          `Successfully assigned ${user.name} as ${body.role} for ${body.unitLevel}`,
        ),
      );
    },
  );

  // --------------------------------------------------------------------------
  // INCHARGE BULK EXCEL IMPORT & VALIDATION (PHASE 3)
  // --------------------------------------------------------------------------
  fastify.post(
    '/incharges/bulk-import',
    {
      preHandler: [authenticate, populateHierarchyScope, requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN, RoleType.CONSTITUENCY_INCHARGE)],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = req.body as {
        applicationId?: string;
        constituencyId?: string;
        level: 'STATE' | 'ZONE' | 'PARLIAMENT' | 'CONSTITUENCY' | 'MANDAL' | 'VILLAGE' | 'BOOTH' | 'VOTER_GROUP';
        rows: any[];
        validateOnly?: boolean;
      };

      const level = body.level || 'CONSTITUENCY';
      const rows = Array.isArray(body.rows) ? body.rows : [];
      const validateOnly = Boolean(body.validateOnly);

      if (rows.length === 0) {
        return reply.status(400).send({
          success: false,
          error: { code: 'EMPTY_PAYLOAD', message: 'No incharge records provided for import.' },
        });
      }

      // 1. Resolve Target Constituency & Geography context
      const scope = (req as any).hierarchyScope;
      let targetConstituency = null;

      if (body.constituencyId) {
        const rawId = body.constituencyId.trim();
        const isTargetUuid = isUuid(rawId);

        targetConstituency = isTargetUuid
          ? await prisma.constituency.findUnique({
              where: { id: rawId },
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
            })
          : await prisma.constituency.findFirst({
              where: {
                OR: [
                  { code: { equals: rawId, mode: 'insensitive' } },
                  { name: { equals: rawId, mode: 'insensitive' } },
                ],
              },
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

        // Fail-closed on invalid constituency target (NEVER silently pick first constituency)
        if (!targetConstituency) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'CONSTITUENCY_NOT_FOUND',
              message: `Target constituency "${body.constituencyId}" does not exist.`,
            },
          });
        }
      } else {
        // No explicit constituencyId supplied
        if (scope && !scope.isGlobalScope) {
          if (scope.accessibleConstituencyIds && scope.accessibleConstituencyIds.size === 1) {
            const singleId = Array.from(scope.accessibleConstituencyIds as Set<string>)[0];
            targetConstituency = await prisma.constituency.findUnique({
              where: { id: singleId },
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
          } else {
            return reply.status(403).send({
              success: false,
              error: {
                code: 'FORBIDDEN_SCOPE',
                message: 'Target constituencyId is required and must be within your hierarchy scope.',
              },
            });
          }
        } else {
          // Global user with no constituencyId supplied - load first constituency for context
          targetConstituency = await prisma.constituency.findFirst({
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
        }
      }

      // Hierarchy Scope Enforcement: non-global users must have access to the target constituency
      if (scope && !scope.isGlobalScope && targetConstituency) {
        if (!scope.accessibleConstituencyIds?.has(targetConstituency.id)) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'FORBIDDEN_SCOPE',
              message: `Access denied: target constituency "${targetConstituency.name || targetConstituency.id}" is outside your authorized hierarchy scope.`,
            },
          });
        }
      }

      // Collect geography lookups
      const allMandals = targetConstituency?.mandals || [];
      const allVillages = allMandals.flatMap((m) => m.villages);
      const allBooths = allVillages.flatMap((v) => v.booths);
      const allVoterGroups = allBooths.flatMap((b) => b.voterGroups);

      const errors: { rowNumber: number; name?: string; mobile?: string; field: string; message: string; suggestion?: string }[] = [];
      const seenMobilesInFile = new Set<string>();
      let duplicateMobileCount = 0;
      let validRowCount = 0;
      const validProcessedRows: any[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 1;
        const name = String(row.name || row.inchargeName || row.fullName || row['Incharge Name'] || '').trim();
        const rawMobile = String(row.mobileNumber || row.mobile || row.phone || row['Mobile Number'] || '').replace(/\D/g, '');
        const cleanMobile = rawMobile.slice(-10);
        const designation = String(row.designation || row['Designation'] || `${level} Incharge`).trim();

        if (!name) {
          errors.push({
            rowNumber: rowNum,
            field: 'name',
            message: 'Incharge full name is missing',
            suggestion: 'Provide valid citizen/worker name',
          });
        }

        if (!cleanMobile || cleanMobile.length !== 10) {
          errors.push({
            rowNumber: rowNum,
            name,
            field: 'mobileNumber',
            message: `Invalid mobile number: "${rawMobile || 'empty'}" (must be 10 digits)`,
            suggestion: 'Ensure 10 digit Indian mobile number',
          });
        } else if (seenMobilesInFile.has(cleanMobile)) {
          duplicateMobileCount++;
          errors.push({
            rowNumber: rowNum,
            name,
            mobile: cleanMobile,
            field: 'mobileNumber',
            message: `Duplicate mobile number ${cleanMobile} found in same upload`,
            suggestion: 'Each incharge requires a unique mobile number',
          });
        } else {
          seenMobilesInFile.add(cleanMobile);
        }

        // Unit resolution based on level
        let resolvedUnitId: string | null = null;
        let resolvedUnitName = `${level} Unit`;

        if (level === 'CONSTITUENCY') {
          resolvedUnitId = targetConstituency?.id || 'constituency-default';
          resolvedUnitName = targetConstituency?.name || 'Assembly Constituency';
        } else if (level === 'MANDAL') {
          const mandalName = String(row.mandalName || row.mandal || row['Mandal Name'] || '').trim().toLowerCase();
          const match = allMandals.find((m) => m.name.toLowerCase().includes(mandalName) || mandalName.includes(m.name.toLowerCase()));
          if (match) {
            resolvedUnitId = match.id;
            resolvedUnitName = match.name;
          } else if (allMandals.length > 0) {
            resolvedUnitId = allMandals[i % allMandals.length].id;
            resolvedUnitName = allMandals[i % allMandals.length].name;
          }
        } else if (level === 'VILLAGE') {
          const villageName = String(row.villageName || row.village || row['Village Name'] || '').trim().toLowerCase();
          const match = allVillages.find((v) => v.name.toLowerCase().includes(villageName) || villageName.includes(v.name.toLowerCase()));
          if (match) {
            resolvedUnitId = match.id;
            resolvedUnitName = match.name;
          } else if (allVillages.length > 0) {
            resolvedUnitId = allVillages[i % allVillages.length].id;
            resolvedUnitName = allVillages[i % allVillages.length].name;
          }
        } else if (level === 'BOOTH') {
          const boothNum = String(row.boothNumber || row.booth || row['Booth / Part No'] || row['Booth Number'] || '').replace(/\D/g, '');
          const match = allBooths.find((b) => b.boothNumber === boothNum || b.name.includes(boothNum));
          if (match) {
            resolvedUnitId = match.id;
            resolvedUnitName = `Booth ${match.boothNumber} - ${match.name}`;
          } else if (allBooths.length > 0) {
            resolvedUnitId = allBooths[i % allBooths.length].id;
            resolvedUnitName = `Booth ${allBooths[i % allBooths.length].boothNumber} - ${allBooths[i % allBooths.length].name}`;
          }
        } else if (level === 'VOTER_GROUP') {
          const code = String(row.inchargeCode || row.groupCode || row['Incharge Code'] || '').trim();
          const match = allVoterGroups.find((g) => g.code === code || g.name.includes(code));
          if (match) {
            resolvedUnitId = match.id;
            resolvedUnitName = match.name;
          } else if (allVoterGroups.length > 0) {
            resolvedUnitId = allVoterGroups[i % allVoterGroups.length].id;
            resolvedUnitName = allVoterGroups[i % allVoterGroups.length].name;
          }
        } else {
          resolvedUnitId = targetConstituency?.id || 'state-apex-unit';
          resolvedUnitName = `${level} Apex Unit`;
        }

        const isRowValid = name.length > 0 && cleanMobile.length === 10 && !errors.some((e) => e.rowNumber === rowNum);

        if (isRowValid) {
          validRowCount++;
          validProcessedRows.push({
            rowNumber: rowNum,
            name,
            mobile: cleanMobile,
            designation,
            unitLevel: level,
            unitId: resolvedUnitId,
            unitName: resolvedUnitName,
            role:
              level === 'VOTER_GROUP'
                ? RoleType.VOTER_100_INCHARGE
                : level === 'BOOTH'
                ? RoleType.BOOTH_PRESIDENT
                : level === 'VILLAGE'
                ? RoleType.VILLAGE_INCHARGE
                : level === 'MANDAL'
                ? RoleType.MANDAL_INCHARGE
                : RoleType.CONSTITUENCY_INCHARGE,
          });
        }
      }

      if (validateOnly) {
        return reply.send(
          successResponse({
            isValid: errors.length === 0,
            totalRows: rows.length,
            validRows: validRowCount,
            invalidRows: rows.length - validRowCount,
            duplicateRows: duplicateMobileCount,
            errors,
            previewRows: validProcessedRows.slice(0, 10),
          }),
        );
      }

      // Execute Real Database Persistence
      let org = await prisma.organisation.findFirst();
      if (!org) {
        org = await prisma.organisation.create({
          data: { name: 'Telugu Desam Party', code: 'TDP-ORG' },
        });
      }

      const assignedUsers: any[] = [];
      let createdCount = 0;
      let updatedCount = 0;

      await prisma.$transaction(async (tx) => {
        for (const row of validProcessedRows) {
          // Find or create User
          let user = await tx.user.findFirst({
            where: {
              OR: [
                { mobileNumber: row.mobile },
                { mobileNumber: `+91${row.mobile}` },
              ],
            },
          });

          if (!user) {
            user = await tx.user.create({
              data: {
                organisationId: org.id,
                userCode: `INC-${row.unitLevel.slice(0, 3)}-${row.mobile.slice(-4)}-${Date.now().toString().slice(-4)}`,
                name: row.name,
                mobileNumber: row.mobile,
                role: row.role,
                accountStatus: 'ACTIVE',
              },
            });
            createdCount++;
          } else {
            user = await tx.user.update({
              where: { id: user.id },
              data: {
                name: row.name,
                role: row.role,
                accountStatus: 'ACTIVE',
              },
            });
            updatedCount++;
          }

          // Upsert UserHierarchyAssignment
          const assignmentData: Prisma.UserHierarchyAssignmentUncheckedCreateInput = {
            userId: user.id,
            roleType: row.role,
            isActive: true,
          };

          if (row.unitLevel === 'CONSTITUENCY') assignmentData.constituencyId = row.unitId;
          else if (row.unitLevel === 'MANDAL') assignmentData.mandalId = row.unitId;
          else if (row.unitLevel === 'VILLAGE') assignmentData.villageId = row.unitId;
          else if (row.unitLevel === 'BOOTH') assignmentData.boothId = row.unitId;
          else if (row.unitLevel === 'VOTER_GROUP') {
            assignmentData.voterGroupId = row.unitId;
            await tx.voterGroup.updateMany({
              where: { id: row.unitId },
              data: { assignedInchargeId: user.id },
            });
            await tx.voter.updateMany({
              where: { voterGroupId: row.unitId },
              data: { assignedInchargeId: user.id },
            });
          }

          const existingAssignment = await tx.userHierarchyAssignment.findFirst({
            where: {
              userId: user.id,
              isActive: true,
            },
          });

          if (existingAssignment) {
            await tx.userHierarchyAssignment.update({
              where: { id: existingAssignment.id },
              data: assignmentData,
            });
          } else {
            await tx.userHierarchyAssignment.create({
              data: assignmentData,
            });
          }

          // Upsert Cadre
          const existingCadre = await tx.cadre.findFirst({
            where: { userId: user.id },
          });

          if (!existingCadre) {
            await tx.cadre.create({
              data: {
                userId: user.id,
                performanceScore: 90.0,
                totalAssignedVoters: row.unitLevel === 'VOTER_GROUP' ? 100 : 500,
              },
            });
          }

          assignedUsers.push({
            id: user.id,
            name: user.name,
            mobile: user.mobileNumber,
            role: user.role,
            level: row.unitLevel,
            unitName: row.unitName,
            code: user.userCode,
            accountStatus: user.accountStatus,
          });
        }
      });

      await logAudit({
        action: AuditAction.CREATE,
        entityType: 'InchargeBulkImport',
        entityId: targetConstituency?.id || 'global-incharges',
        req,
        changes: {
          level,
          totalRows: rows.length,
          validRows: validRowCount,
          createdCount,
          updatedCount,
        } as unknown as Prisma.InputJsonValue,
      });

      return reply.status(200).send(
        successResponse({
          totalRows: rows.length,
          validRows: validRowCount,
          invalidRows: rows.length - validRowCount,
          duplicateRows: duplicateMobileCount,
          createdUsersCount: createdCount,
          updatedAssignmentsCount: updatedCount,
          errors,
          assignedUsers,
        }, `Successfully processed ${validRowCount} incharge assignments for ${level} level. WhatsApp OTP accounts provisioned!`),
      );
    },
  );

  // Incharge Dynamic Template Generator
  fastify.get(
    '/incharges/template',
    {
      preHandler: [authenticate, requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN, RoleType.CONSTITUENCY_INCHARGE)],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as { level?: string };
    const level = (query.level || 'CONSTITUENCY').toUpperCase();

    let columns: string[] = [];
    let sampleRows: Record<string, string>[] = [];

    if (level === 'VOTER_GROUP') {
      columns = ['Incharge Code', 'From Voter No', 'To Voter No', 'Incharge Name', 'Mobile Number', 'Designation'];
      sampleRows = [
        { 'Incharge Code': 'BT1-001', 'From Voter No': '1', 'To Voter No': '100', 'Incharge Name': 'M. Srinivas', 'Mobile Number': '9848010005', 'Designation': '100-Voter Cluster Incharge' },
        { 'Incharge Code': 'BT1-002', 'From Voter No': '101', 'To Voter No': '200', 'Incharge Name': 'K. Narayana', 'Mobile Number': '9848010006', 'Designation': '100-Voter Cluster Incharge' },
      ];
    } else if (level === 'BOOTH') {
      columns = ['Booth / Part No', 'Booth Name', 'Incharge Name', 'Mobile Number', 'Designation'];
      sampleRows = [
        { 'Booth / Part No': 'Booth 101', 'Booth Name': 'ZPHS High School', 'Incharge Name': 'T. Subrahmanyam', 'Mobile Number': '9848010004', 'Designation': 'Booth President' },
        { 'Booth / Part No': 'Booth 102', 'Booth Name': 'MPP Primary School', 'Incharge Name': 'V. Ramana', 'Mobile Number': '9848010007', 'Designation': 'Booth President' },
      ];
    } else if (level === 'VILLAGE') {
      columns = ['Village Name', 'Mandal Name', 'Incharge Name', 'Mobile Number', 'Designation'];
      sampleRows = [
        { 'Village Name': 'Ananthavaram Village', 'Mandal Name': 'Kondapi Mandal', 'Incharge Name': 'P. Ramanjaneyulu', 'Mobile Number': '9848010003', 'Designation': 'Village Incharge' },
        { 'Village Name': 'Kondapi Village', 'Mandal Name': 'Kondapi Mandal', 'Incharge Name': 'L. Venkatesh', 'Mobile Number': '9848010008', 'Designation': 'Village Incharge' },
      ];
    } else if (level === 'MANDAL') {
      columns = ['Mandal Name', 'Incharge Name', 'Mobile Number', 'Designation'];
      sampleRows = [
        { 'Mandal Name': 'Kondapi Mandal', 'Incharge Name': 'K. Venkateswarlu', 'Mobile Number': '9848010002', 'Designation': 'Mandal President' },
        { 'Mandal Name': 'Marripudi Mandal', 'Incharge Name': 'S. Prasad', 'Mobile Number': '9848010009', 'Designation': 'Mandal President' },
      ];
    } else if (level === 'PARLIAMENT') {
      columns = ['Parliament Name', 'Incharge Name', 'Mobile Number', 'Designation'];
      sampleRows = [
        { 'Parliament Name': 'Ongole Parliament', 'Incharge Name': 'Magunta Sreenivasulu Reddy', 'Mobile Number': '9848010000', 'Designation': 'Parliamentary Incharge' },
      ];
    } else if (level === 'ZONE') {
      columns = ['Zone Name', 'Incharge Name', 'Mobile Number', 'Designation'];
      sampleRows = [
        { 'Zone Name': 'Coastal Andhra Zone', 'Incharge Name': 'Zonal Coordinator A', 'Mobile Number': '9848010012', 'Designation': 'Zonal Coordinator' },
      ];
    } else if (level === 'STATE') {
      columns = ['State Name', 'Incharge Name', 'Mobile Number', 'Designation'];
      sampleRows = [
        { 'State Name': 'Andhra Pradesh', 'Incharge Name': 'State Apex Lead', 'Mobile Number': '9848010014', 'Designation': 'State Apex Observer' },
      ];
    } else {
      columns = ['Constituency Name', 'Incharge Name', 'Mobile Number', 'Designation'];
      sampleRows = [
        { 'Constituency Name': 'Kondapi AC', 'Incharge Name': 'Dr. Dola Sree Bala Veeranjaneya Swamy', 'Mobile Number': '9848010001', 'Designation': 'MLA Candidate' },
        { 'Constituency Name': 'Ongole AC', 'Incharge Name': 'Damacharla Janardhan Rao', 'Mobile Number': '9848010010', 'Designation': 'MLA Candidate' },
      ];
    }

    return reply.send(successResponse({ level, columns, sampleRows }));
  });

  // Incharge Deactivate Route
  fastify.post(
    '/incharges/deactivate',
    {
      preHandler: [authenticate, requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN, RoleType.CONSTITUENCY_INCHARGE)],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = req.body as { userId: string; reason?: string };
      if (!body.userId) {
        return reply.status(400).send({ error: { message: 'userId is required' } });
      }

      const user = await prisma.user.update({
        where: { id: body.userId },
        data: { accountStatus: 'SUSPENDED' },
      });

      await prisma.userHierarchyAssignment.updateMany({
        where: { userId: body.userId },
        data: { isActive: false },
      });

      await logAudit({
        action: AuditAction.UPDATE,
        entityType: 'InchargeDeactivation',
        entityId: body.userId,
        req,
        changes: { status: 'DEACTIVATED', reason: body.reason || 'Deactivated by administrator' } as unknown as Prisma.InputJsonValue,
      });

      return reply.send(successResponse({ userId: user.id, accountStatus: user.accountStatus }, 'Incharge deactivated successfully.'));
    },
  );

  // Incharge User Search for Existing User Assignment
  fastify.get(
    '/incharges/users/search',
    {
      preHandler: [authenticate, requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN, RoleType.CONSTITUENCY_INCHARGE)],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const query = req.query as { q?: string };
      const q = (query.q || '').trim();

      const users = await prisma.user.findMany({
        where: q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { mobileNumber: { contains: q } },
                { userCode: { contains: q, mode: 'insensitive' } },
              ],
            }
          : undefined,
        select: {
          id: true,
          name: true,
          mobileNumber: true,
          role: true,
          userCode: true,
          accountStatus: true,
        },
        take: 20,
        orderBy: { updatedAt: 'desc' },
      });

      return reply.send(successResponse(users));
    },
  );

  // Incharge Transfer Route (Move User from Jurisdiction A to Jurisdiction B)
  fastify.post(
    '/incharges/transfer',
    {
      preHandler: [authenticate, requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN, RoleType.CONSTITUENCY_INCHARGE)],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = req.body as {
        userId: string;
        fromUnitLevel?: string;
        fromUnitId?: string;
        toUnitLevel: 'STATE' | 'ZONE' | 'PARLIAMENT' | 'CONSTITUENCY' | 'MANDAL' | 'VILLAGE' | 'BOOTH' | 'VOTER_GROUP';
        toUnitId: string;
        reason?: string;
      };

      if (!body.userId || !body.toUnitId || !body.toUnitLevel) {
        return reply.status(400).send({ error: { message: 'userId, toUnitId, and toUnitLevel are required' } });
      }

      const user = await prisma.user.findUnique({
        where: { id: body.userId },
      });

      if (!user) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'User not found' } });
      }

      // Deactivate previous active assignment
      await prisma.userHierarchyAssignment.updateMany({
        where: { userId: body.userId, isActive: true },
        data: { isActive: false },
      });

      // Create new assignment
      const newAssignmentData: Prisma.UserHierarchyAssignmentUncheckedCreateInput = {
        userId: user.id,
        roleType: user.role,
        isActive: true,
      };

      if (body.toUnitLevel === 'STATE') newAssignmentData.stateId = body.toUnitId;
      else if (body.toUnitLevel === 'ZONE') newAssignmentData.zoneId = body.toUnitId;
      else if (body.toUnitLevel === 'PARLIAMENT') newAssignmentData.parliamentId = body.toUnitId;
      else if (body.toUnitLevel === 'CONSTITUENCY') newAssignmentData.constituencyId = body.toUnitId;
      else if (body.toUnitLevel === 'MANDAL') newAssignmentData.mandalId = body.toUnitId;
      else if (body.toUnitLevel === 'VILLAGE') newAssignmentData.villageId = body.toUnitId;
      else if (body.toUnitLevel === 'BOOTH') newAssignmentData.boothId = body.toUnitId;
      else if (body.toUnitLevel === 'VOTER_GROUP') {
        newAssignmentData.voterGroupId = body.toUnitId;
        await prisma.voterGroup.updateMany({
          where: { id: body.toUnitId },
          data: { assignedInchargeId: user.id },
        });
        await prisma.voter.updateMany({
          where: { voterGroupId: body.toUnitId },
          data: { assignedInchargeId: user.id },
        });
      }

      const createdAssignment = await prisma.userHierarchyAssignment.create({
        data: newAssignmentData,
      });

      await logAudit({
        action: AuditAction.UPDATE,
        entityType: 'InchargeTransfer',
        entityId: user.id,
        req,
        changes: {
          fromUnitLevel: body.fromUnitLevel,
          fromUnitId: body.fromUnitId,
          toUnitLevel: body.toUnitLevel,
          toUnitId: body.toUnitId,
          reason: body.reason || 'Cadre redeployment by administration',
        } as unknown as Prisma.InputJsonValue,
      });

      return reply.send(
        successResponse({
          user: { id: user.id, name: user.name, mobileNumber: user.mobileNumber },
          assignment: createdAssignment,
        }, `Incharge ${user.name} successfully transferred to ${body.toUnitLevel}`),
      );
    },
  );

  // Incharge Replacement Route (Replace User A with User B at Jurisdiction)
  fastify.post(
    '/incharges/replace',
    {
      preHandler: [authenticate, requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN, RoleType.CONSTITUENCY_INCHARGE)],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = req.body as {
        currentUserId?: string;
        unitLevel: 'STATE' | 'ZONE' | 'PARLIAMENT' | 'CONSTITUENCY' | 'MANDAL' | 'VILLAGE' | 'BOOTH' | 'VOTER_GROUP';
        unitId: string;
        newUserName: string;
        newMobileNumber: string;
        newUserId?: string;
        reason?: string;
      };

      if (!body.unitId || !body.unitLevel || !body.newUserName || !body.newMobileNumber) {
        return reply.status(400).send({ error: { message: 'unitId, unitLevel, newUserName, and newMobileNumber are required' } });
      }

      const cleanMobile = body.newMobileNumber.replace(/\D/g, '').slice(-10);

      // 1. Deactivate old user's assignment if provided
      if (body.currentUserId) {
        await prisma.userHierarchyAssignment.updateMany({
          where: { userId: body.currentUserId, isActive: true },
          data: { isActive: false },
        });
      }

      // 2. Find or create replacement user
      let org = await prisma.organisation.findFirst();
      let newUser = body.newUserId
        ? await prisma.user.findUnique({ where: { id: body.newUserId } })
        : await prisma.user.findFirst({
            where: {
              OR: [{ mobileNumber: cleanMobile }, { mobileNumber: `+91${cleanMobile}` }],
            },
          });

      const roleType =
        body.unitLevel === 'VOTER_GROUP'
          ? RoleType.VOTER_100_INCHARGE
          : body.unitLevel === 'BOOTH'
          ? RoleType.BOOTH_PRESIDENT
          : body.unitLevel === 'VILLAGE'
          ? RoleType.VILLAGE_INCHARGE
          : body.unitLevel === 'MANDAL'
          ? RoleType.MANDAL_INCHARGE
          : RoleType.CONSTITUENCY_INCHARGE;

      if (!newUser) {
        newUser = await prisma.user.create({
          data: {
            organisationId: org?.id,
            userCode: `INC-${body.unitLevel.slice(0, 3)}-${cleanMobile.slice(-4)}-${Date.now().toString().slice(-4)}`,
            name: body.newUserName,
            mobileNumber: cleanMobile,
            role: roleType,
            accountStatus: 'ACTIVE',
          },
        });
      } else {
        newUser = await prisma.user.update({
          where: { id: newUser.id },
          data: {
            name: body.newUserName,
            role: roleType,
            accountStatus: 'ACTIVE',
          },
        });
      }

      // 3. Create new assignment for replacement user
      const assignmentData: Prisma.UserHierarchyAssignmentUncheckedCreateInput = {
        userId: newUser.id,
        roleType,
        isActive: true,
      };

      if (body.unitLevel === 'STATE') assignmentData.stateId = body.unitId;
      else if (body.unitLevel === 'ZONE') assignmentData.zoneId = body.unitId;
      else if (body.unitLevel === 'PARLIAMENT') assignmentData.parliamentId = body.unitId;
      else if (body.unitLevel === 'CONSTITUENCY') assignmentData.constituencyId = body.unitId;
      else if (body.unitLevel === 'MANDAL') assignmentData.mandalId = body.unitId;
      else if (body.unitLevel === 'VILLAGE') assignmentData.villageId = body.unitId;
      else if (body.unitLevel === 'BOOTH') assignmentData.boothId = body.unitId;
      else if (body.unitLevel === 'VOTER_GROUP') {
        assignmentData.voterGroupId = body.unitId;
        await prisma.voterGroup.updateMany({
          where: { id: body.unitId },
          data: { assignedInchargeId: newUser.id },
        });
        await prisma.voter.updateMany({
          where: { voterGroupId: body.unitId },
          data: { assignedInchargeId: newUser.id },
        });
      }

      const createdAssignment = await prisma.userHierarchyAssignment.create({
        data: assignmentData,
      });

      await logAudit({
        action: AuditAction.UPDATE,
        entityType: 'InchargeReplacement',
        entityId: newUser.id,
        req,
        changes: {
          replacedUserId: body.currentUserId,
          replacementUserId: newUser.id,
          unitLevel: body.unitLevel,
          unitId: body.unitId,
          reason: body.reason || 'Cadre replaced by leadership',
        } as unknown as Prisma.InputJsonValue,
      });

      return reply.send(
        successResponse({
          newUser: { id: newUser.id, name: newUser.name, mobileNumber: newUser.mobileNumber, role: newUser.role },
          assignment: createdAssignment,
        }, `Incharge successfully replaced with ${newUser.name}`),
      );
    },
  );

  // Incharge Assignment History
  fastify.get(
    '/incharges/history',
    {
      preHandler: [authenticate, requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN, RoleType.CONSTITUENCY_INCHARGE)],
    },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      const logs = await prisma.auditLog.findMany({
        where: {
          entityType: {
            in: ['InchargeAssignment', 'InchargeBulkImport', 'InchargeDeactivation', 'InchargeTransfer', 'InchargeReplacement'],
          },
        },
        include: {
          user: {
            select: { id: true, name: true, role: true, mobileNumber: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      return reply.send(successResponse(logs));
    },
  );

  // --------------------------------------------------------------------------
  // 12. MULTI-APPLICATION CONFIGURATIONS LIST & SWITCH
  // --------------------------------------------------------------------------
  fastify.get('/applications', { preHandler: [authenticate] }, async (_req: FastifyRequest, reply: FastifyReply) => {
    const configs = await prisma.cMSConfiguration.findMany({
      include: { organisation: true },
      orderBy: { updatedAt: 'desc' },
    });

    const activeParties = await prisma.politicalParty.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    const constituenciesCount = await prisma.constituency.count();
    const votersCount = await prisma.voter.count();

    const formatted = configs.map((c) => {
      const activeParty = activeParties.find((p) => p.code === c.activePartyCode);
      const prioritizedParties = activeParty
        ? [
            { name: activeParty.name, code: activeParty.code, primaryColor: activeParty.primaryColor, isLocked: activeParty.isLocked, lifecycleStatus: activeParty.lifecycleStatus },
            ...activeParties.filter((p) => p.code !== activeParty.code).map((p) => ({
              name: p.name,
              code: p.code,
              primaryColor: p.primaryColor,
              isLocked: p.isLocked,
              lifecycleStatus: p.lifecycleStatus,
            })),
          ]
        : activeParties.map((p) => ({
            name: p.name,
            code: p.code,
            primaryColor: p.primaryColor,
            isLocked: p.isLocked,
            lifecycleStatus: p.lifecycleStatus,
          }));

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

    return reply.send(successResponse(formatted));
  });

  fastify.post(
    '/applications/switch/:configKey',
    {
      preHandler: [authenticate, requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN)],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { configKey } = req.params as { configKey: string };
      const targetConfig = await prisma.cMSConfiguration.findUnique({
        where: { configKey },
      });

      if (!targetConfig) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: `Application configuration '${configKey}' not found` },
        });
      }

      await logAudit({
        action: AuditAction.UPDATE,
        entityType: 'ApplicationSwitch',
        entityId: targetConfig.id,
        req,
        changes: { switchedTo: configKey, appName: targetConfig.organisationName } as unknown as Prisma.InputJsonValue,
      });

      return reply.send(successResponse(targetConfig, `Successfully switched active application to ${targetConfig.organisationName}`));
    },
  );

  // --------------------------------------------------------------------------
  // 13. CONFIGURATION VERSION HISTORY & SNAPSHOTS
  // --------------------------------------------------------------------------
  fastify.get(
    '/versions',
    {
      preHandler: [authenticate, requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND)],
    },
    async (_req: FastifyRequest, reply: FastifyReply) => {
    const logs = await prisma.auditLog.findMany({
      where: {
        entityType: {
          in: ['ApplicationBuilder', 'Branding', 'Organisation', 'PoliticalParty', 'FeatureToggles', 'HierarchyNode', 'InchargeAssignment'],
        },
      },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const versions = logs.map((log, index) => ({
      versionNumber: `v1.${logs.length - index}.0`,
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      author: log.user?.name || 'System Super Admin',
      timestamp: log.createdAt,
      changeSummary: `${log.action} performed on ${log.entityType}`,
      payload: log.changes,
    }));

    return reply.send(successResponse(versions));
  });

  fastify.post(
    '/versions',
    {
      preHandler: [authenticate, requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND)],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = req.body as { versionName: string; changeSummary: string };

      const currentConfig = (await prisma.cMSConfiguration.findUnique({
        where: { configKey: 'default' },
      })) || (await prisma.cMSConfiguration.findFirst({ orderBy: { updatedAt: 'desc' } }));

      const audit = await prisma.auditLog.create({
        data: {
          action: AuditAction.CREATE,
          entityType: 'ApplicationVersionSnapshot',
          entityId: currentConfig?.id || 'default',
          userId: req.user?.userId || (await prisma.user.findFirst())?.id || '00000000-0000-0000-0000-000000000000',
          changes: {
            versionName: body.versionName || `v1.${Date.now()}`,
            summary: body.changeSummary || 'Manual configuration checkpoint',
            snapshot: currentConfig,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      return reply.status(201).send(successResponse(audit, 'Configuration checkpoint snapshot saved successfully'));
    },
  );

  // --------------------------------------------------------------------------
  // 14. ROLES & PERMISSIONS MATRIX CONFIGURATION
  // --------------------------------------------------------------------------
  fastify.get('/roles-permissions', { preHandler: [authenticate] }, async (_req: FastifyRequest, reply: FastifyReply) => {
    const rolePermissionsMatrix = [
      {
        role: 'SUPER_ADMIN',
        displayName: 'Super Administrator',
        scope: 'GLOBAL',
        description: 'Full platform root privileges, CMS management, project provisioning and configuration lock',
        permissions: { read: true, create: true, update: true, delete: true, export: true },
        modules: ['ALL'],
      },
      {
        role: 'HIGH_COMMAND',
        displayName: 'High Command / State President',
        scope: 'STATE',
        description: 'Statewide command & control, political intelligence, cadre directives and strategic dashboards',
        permissions: { read: true, create: true, update: true, delete: false, export: true },
        modules: ['DASHBOARD', 'VOTERS', 'INCHARGES', 'CADRE', 'TASKS', 'POLLS', 'TRAINING', 'REPORTS', 'AI_INTELLIGENCE', 'AUDIT_LOGS'],
      },
      {
        role: 'STATE_ADMIN',
        displayName: 'State Administrator',
        scope: 'STATE',
        description: 'State operations, voter data administration, cadre coordination and broadcast management',
        permissions: { read: true, create: true, update: true, delete: false, export: true },
        modules: ['DASHBOARD', 'VOTERS', 'INCHARGES', 'CADRE', 'TASKS', 'POLLS', 'TRAINING', 'REPORTS', 'AI_INTELLIGENCE'],
      },
      {
        role: 'PARLIAMENT_INCHARGE',
        displayName: 'Parliament Incharge / MP Candidate',
        scope: 'PARLIAMENT',
        description: 'Parliamentary constituency jurisdiction, assembly segment oversight and MP-level metrics',
        permissions: { read: true, create: true, update: true, delete: false, export: true },
        modules: ['DASHBOARD', 'VOTERS', 'INCHARGES', 'CADRE', 'TASKS', 'REPORTS', 'AI_INTELLIGENCE'],
      },
      {
        role: 'CONSTITUENCY_INCHARGE',
        displayName: 'Constituency Incharge / MLA Candidate',
        scope: 'CONSTITUENCY',
        description: 'Assembly Constituency command, Mandal president monitoring, ground voter operations',
        permissions: { read: true, create: true, update: true, delete: false, export: true },
        modules: ['DASHBOARD', 'VOTERS', 'INCHARGES', 'GROUPS_100', 'CADRE', 'TASKS', 'POLLS', 'TRAINING', 'REPORTS'],
      },
      {
        role: 'MANDAL_INCHARGE',
        displayName: 'Mandal President',
        scope: 'MANDAL',
        description: 'Mandal level jurisdiction, Village incharge tracking, local event coordination',
        permissions: { read: true, create: true, update: true, delete: false, export: true },
        modules: ['DASHBOARD', 'VOTERS', 'INCHARGES', 'GROUPS_100', 'TASKS', 'TRAINING', 'REPORTS'],
      },
      {
        role: 'VILLAGE_INCHARGE',
        displayName: 'Village / Ward Incharge',
        scope: 'VILLAGE',
        description: 'Village ward jurisdiction, Booth president guidance, doorstep voter outreach',
        permissions: { read: true, create: true, update: true, delete: false, export: false },
        modules: ['DASHBOARD', 'VOTERS', 'GROUPS_100', 'TASKS', 'TRAINING'],
      },
      {
        role: 'BOOTH_PRESIDENT',
        displayName: 'Booth President',
        scope: 'BOOTH',
        description: 'Polling booth jurisdiction, 100-voter incharge supervision, turnout tracking',
        permissions: { read: true, create: true, update: true, delete: false, export: false },
        modules: ['DASHBOARD', 'VOTERS', 'GROUPS_100', 'TASKS', 'TRAINING'],
      },
      {
        role: 'VOTER_100_INCHARGE',
        displayName: '100-Voter Incharge (Ground Worker)',
        scope: 'VOTER_GROUP',
        description: 'Assigned 100 voter cluster, door-to-door verification, sentiment survey and polling day mobilization',
        permissions: { read: true, create: true, update: true, delete: false, export: false },
        modules: ['DASHBOARD', 'VOTERS', 'TASKS'],
      },
    ];

    return reply.send(successResponse(rolePermissionsMatrix));
  });

  // --------------------------------------------------------------------------
  // 15. GEOGRAPHY ENTITIES LIST & CREATE
  // --------------------------------------------------------------------------
  fastify.get('/geography', { preHandler: [authenticate] }, async (_req: FastifyRequest, reply: FastifyReply) => {
    const states = await prisma.state.findMany({
      include: {
        zones: {
          include: {
            parliaments: {
              include: {
                constituencies: {
                  include: {
                    mandals: {
                      include: {
                        _count: { select: { villages: true, voters: true } },
                      },
                    },
                    _count: { select: { mandals: true, voters: true } },
                  },
                },
                _count: { select: { constituencies: true } },
              },
            },
          },
        },
      },
    });

    return reply.send(successResponse(states));
  });

  fastify.post(
    '/geography/unit',
    {
      preHandler: [authenticate, requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN)],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = req.body as {
        level: 'STATE' | 'ZONE' | 'PARLIAMENT' | 'CONSTITUENCY' | 'MANDAL';
        name: string;
        code?: string;
        parentId?: string;
        totalVoters?: number;
      };

      if (!body.name) {
        return reply.status(400).send({ error: { message: 'Entity name is required' } });
      }

      let created: any;
      const cleanName = body.name.trim();
      const code = body.code?.trim() || `${body.level.slice(0, 3)}-${cleanName.slice(0, 4).toUpperCase()}`;

      if (body.level === 'CONSTITUENCY') {
        const parliamentId = body.parentId || (await prisma.parliament.findFirst())?.id;
        if (!parliamentId) throw new Error('No parent Parliament found to attach Constituency');
        created = await prisma.constituency.create({
          data: {
            name: cleanName,
            code,
            parliamentId,
            totalVoters: body.totalVoters || 220000,
          },
        });
      } else if (body.level === 'MANDAL') {
        const constituencyId = body.parentId || (await prisma.constituency.findFirst())?.id;
        if (!constituencyId) throw new Error('No parent Constituency found to attach Mandal');
        created = await prisma.mandal.create({
          data: {
            name: cleanName,
            code,
            constituencyId,
            totalVoters: body.totalVoters || 35000,
          },
        });
      } else if (body.level === 'PARLIAMENT') {
        const zoneId = body.parentId || (await prisma.zone.findFirst())?.id;
        if (!zoneId) throw new Error('No parent Zone found to attach Parliament');
        created = await prisma.parliament.create({
          data: {
            name: cleanName,
            code,
            zoneId,
            totalVoters: body.totalVoters || 1500000,
          },
        });
      } else if (body.level === 'ZONE') {
        const stateId = body.parentId || (await prisma.state.findFirst())?.id;
        if (!stateId) throw new Error('No parent State found to attach Zone');
        created = await prisma.zone.create({
          data: {
            name: cleanName,
            code,
            stateId,
            totalVoters: body.totalVoters || 10000000,
          },
        });
      } else if (body.level === 'STATE') {
        const org = await prisma.organisation.findFirst();
        created = await prisma.state.create({
          data: {
            name: cleanName,
            code,
            organisationId: org?.id,
            totalVoters: body.totalVoters || 40000000,
          },
        });
      } else {
        return reply.status(400).send({ error: { message: `Unsupported geography level: ${body.level}` } });
      }

      await logAudit({
        action: AuditAction.CREATE,
        entityType: `Geography_${body.level}`,
        entityId: created.id,
        req,
        changes: body as unknown as Prisma.InputJsonValue,
      });

      return reply.status(201).send(successResponse(created, `${body.level} '${cleanName}' created successfully`));
    },
  );

  // --------------------------------------------------------------------------
  // 16. EXCEL COLUMN MAPPING VALIDATOR
  // --------------------------------------------------------------------------
  fastify.post('/validate-excel-mapping', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as {
      columnMapping: Record<string, string>;
      sampleRows: any[];
    };

    const mapping = body.columnMapping || {};
    const rows = body.sampleRows || [];

    const requiredFields = ['epicNumber', 'name', 'gender', 'age'];
    const missingFields: string[] = [];

    for (const field of requiredFields) {
      if (!Object.values(mapping).includes(field)) {
        missingFields.push(field);
      }
    }

    const validationErrors: string[] = [];
    const validRowsPreview: any[] = [];

    rows.slice(0, 10).forEach((row, idx) => {
      const mappedRecord: Record<string, any> = {};
      Object.entries(mapping).forEach(([excelCol, targetField]) => {
        if (targetField && targetField !== 'ignore') {
          mappedRecord[targetField] = row[excelCol];
        }
      });

      if (!mappedRecord.epicNumber) {
        validationErrors.push(`Row ${idx + 1}: Missing EPIC / Voter ID number`);
      }
      if (!mappedRecord.name) {
        validationErrors.push(`Row ${idx + 1}: Missing voter full name`);
      }

      validRowsPreview.push(mappedRecord);
    });

    return reply.send(
      successResponse({
        isValid: missingFields.length === 0 && validationErrors.length === 0,
        missingRequiredFields: missingFields,
        validationErrors,
        sampleMappedPreview: validRowsPreview,
        totalSampleRowsTested: rows.length,
      }),
    );
  });
}
