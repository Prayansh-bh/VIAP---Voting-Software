import { FastifyRequest } from 'fastify';
import { AuditAction, Prisma, RoleType } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { logAudit } from '../../middleware/audit.js';

export interface PurgePartyResult {
  deletedPartyId: string;
  partyName: string;
  partyCode: string;
  deletedVotersCount: number;
  deletedImportsCount: number;
  purgedOrganisation: boolean;
}

/**
 * Permanently deletes a political party and all its related data,
 * including Excel-extracted voter rolls, DataImport records, mappings,
 * errors, and voter operational child records.
 */
export async function purgePoliticalParty(
  partyId: string,
  req: FastifyRequest,
  options: { permanent?: boolean; force?: boolean } = {},
): Promise<PurgePartyResult> {
  const isSuperAdmin = req.user?.role === RoleType.SUPER_ADMIN;
  const isForce = options.permanent === true || options.force === true;

  const existingParty = await prisma.politicalParty.findUnique({
    where: { id: partyId },
    include: {
      organisation: true,
      brandings: true,
      performances: true,
    },
  });

  if (!existingParty) {
    const err: any = new Error('Party not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  // TENANT ISOLATION CHECK
  if (!isSuperAdmin && existingParty.organisationId && existingParty.organisationId !== req.user?.organisationId) {
    const err: any = new Error('Access denied: Party belongs to another organization');
    err.statusCode = 403;
    err.code = 'FORBIDDEN_TENANT';
    throw err;
  }

  // STRICT IMMUTABILITY CHECK (unless permanent/force is requested)
  if ((existingParty.isLocked || existingParty.lifecycleStatus === 'LOCKED') && !isForce) {
    await logAudit({
      action: AuditAction.DELETE,
      entityType: 'PoliticalParty',
      entityId: existingParty.id,
      req,
      changes: {
        status: 'BLOCKED',
        reason: 'Party is published and immutable (LOCKED)',
      } as unknown as Prisma.InputJsonValue,
    });

    const err: any = new Error('Party configuration is published, locked and immutable. Deletion is not permitted.');
    err.statusCode = 403;
    err.code = 'PARTY_CONFIGURATION_LOCKED';
    throw err;
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const partyOrgId = existingParty.organisationId;

      // 1. Check if any other political parties share this organisation
      const otherPartiesCount = partyOrgId
        ? await tx.politicalParty.count({
            where: {
              organisationId: partyOrgId,
              id: { not: existingParty.id },
            },
          })
        : 0;

      const isSolePartyForOrg = Boolean(partyOrgId && otherPartiesCount === 0);

      // 2. Discover associated CMS configurations
      const associatedConfigs = await tx.cMSConfiguration.findMany({
        where: {
          OR: [
            { activePartyCode: existingParty.code },
            ...(partyOrgId ? [{ organisationId: partyOrgId }] : []),
          ],
        },
        select: { id: true, organisationId: true, activePartyCode: true },
      });
      const configIds = associatedConfigs.map((c) => c.id);

      // 3. Discover hierarchy nodes (if sole party for organisation)
      const constituencyIds: string[] = [];
      const stateIds: string[] = [];
      const zoneIds: string[] = [];
      const parliamentIds: string[] = [];
      const mandalIds: string[] = [];
      const villageIds: string[] = [];
      const boothIds: string[] = [];
      const voterGroupIds: string[] = [];
      const allUnitCodes: string[] = [];

      if (isSolePartyForOrg && partyOrgId) {
        const states = await tx.state.findMany({
          where: { organisationId: partyOrgId },
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
                                      select: { id: true, code: true },
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
      }

      const orgUnits = allUnitCodes.length > 0
        ? await tx.organizationUnit.findMany({
            where: { code: { in: allUnitCodes } },
            select: { id: true },
          })
        : [];
      const orgUnitIds = orgUnits.map((u) => u.id);

      // 4. PURGE EXCEL EXTRACTED DATA & DATA IMPORTS
      // Find all DataImport records associated with this party (via application, constituency, or uploaded files)
      const importsToDelete = await tx.dataImport.findMany({
        where: {
          OR: [
            ...(configIds.length > 0 ? [{ applicationId: { in: configIds } }] : []),
            ...(constituencyIds.length > 0 ? [{ targetConstituencyId: { in: constituencyIds } }] : []),
          ],
        },
        select: { id: true },
      });
      const importIds = importsToDelete.map((i) => i.id);

      if (importIds.length > 0) {
        await tx.dataImportError.deleteMany({ where: { importId: { in: importIds } } });
        await tx.dataImportMapping.deleteMany({ where: { importId: { in: importIds } } });
        await tx.dataImport.deleteMany({ where: { id: { in: importIds } } });
      }

      // Purge ImportJobs related to this party's units or tenant users
      if (orgUnitIds.length > 0 || partyOrgId) {
        await tx.importJob.deleteMany({
          where: {
            OR: [
              ...(orgUnitIds.length > 0 ? [{ unitId: { in: orgUnitIds } }] : []),
              ...(partyOrgId ? [{ createdBy: { organisationId: partyOrgId } }] : []),
            ],
          },
        });
      }

      // 5. PURGE VOTERS (The Excel Extracted Ones & Party-Linked Ones)
      // Any voter linked to this party via politicalPartyId MUST be deleted.
      // If this was the sole party for the organisation, all voters in its hierarchy must also be deleted.
      const voterFilter: any = {
        OR: [
          { politicalPartyId: existingParty.id },
          ...(isSolePartyForOrg && constituencyIds.length > 0 ? [{ constituencyId: { in: constituencyIds } }] : []),
          ...(isSolePartyForOrg && boothIds.length > 0 ? [{ boothId: { in: boothIds } }] : []),
          ...(isSolePartyForOrg && stateIds.length > 0 ? [{ stateId: { in: stateIds } }] : []),
          ...(partyOrgId ? [
            {
              AND: [
                { state: { organisationId: partyOrgId } },
                { politicalPreference: { in: [existingParty.code, existingParty.shortName, existingParty.name], mode: 'insensitive' } },
              ],
            },
          ] : []),
        ],
      };

      const votersToDelete = await tx.voter.findMany({
        where: voterFilter,
        select: { id: true },
      });
      const voterIdsToDelete = votersToDelete.map((v) => v.id);

      let deletedVotersCount = 0;
      if (voterIdsToDelete.length > 0) {
        const chunkSize = 1000;
        for (let i = 0; i < voterIdsToDelete.length; i += chunkSize) {
          const chunk = voterIdsToDelete.slice(i, i + chunkSize);
          await Promise.all([
            tx.voterAssignment.deleteMany({ where: { voterId: { in: chunk } } }),
            tx.voterStatusHistory.deleteMany({ where: { voterId: { in: chunk } } }),
            tx.fakeVoterFlag.deleteMany({ where: { voterId: { in: chunk } } }),
            tx.voterMigration.deleteMany({ where: { voterId: { in: chunk } } }),
            tx.voteTracking.deleteMany({ where: { voterId: { in: chunk } } }),
            tx.liveVoteEvent.deleteMany({ where: { voterId: { in: chunk } } }),
          ]);
          const delRes = await tx.voter.deleteMany({ where: { id: { in: chunk } } });
          deletedVotersCount += delRes.count;
        }
      }

      // If other parties still exist on this organisation, detach any remaining voters that were only preferring this party
      if (!isSolePartyForOrg) {
        await tx.voter.updateMany({
          where: { politicalPartyId: existingParty.id },
          data: { politicalPartyId: null },
        });
      }

      // 6. IF SOLE PARTY FOR ORG: PURGE OPERATIONAL CHILDREN & HIERARCHY
      if (isSolePartyForOrg && partyOrgId) {
        if (boothIds.length > 0 || orgUnitIds.length > 0) {
          await Promise.all([
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
          ]);
        }

        if (constituencyIds.length > 0 || boothIds.length > 0 || orgUnitIds.length > 0) {
          await Promise.all([
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
          ]);
        }

        // Hierarchy nodes
        if (orgUnitIds.length > 0) {
          await tx.organizationUnit.updateMany({ where: { id: { in: orgUnitIds } }, data: { parentId: null } });
          await tx.organizationUnit.deleteMany({ where: { id: { in: orgUnitIds } } });
        }

        if (stateIds.length > 0) {
          await tx.state.deleteMany({ where: { id: { in: stateIds } } });
        }

        // Clean up CMS configurations
        if (configIds.length > 0) {
          await tx.cMSConfiguration.deleteMany({ where: { id: { in: configIds } } });
        }

        // Announcements & Videos
        await Promise.all([
          tx.announcement.deleteMany({ where: { organisationId: partyOrgId } }),
          tx.trainingVideo.deleteMany({ where: { organisationId: partyOrgId } }),
        ]);

        // Tenant users
        await tx.user.updateMany({
          where: { organisationId: partyOrgId, role: RoleType.SUPER_ADMIN },
          data: { organisationId: null, unitId: null },
        });

        const tenantUsers = await tx.user.findMany({
          where: { organisationId: partyOrgId, role: { not: RoleType.SUPER_ADMIN } },
          select: { id: true, mobileNumber: true },
        });
        const tenantUserIds = tenantUsers.map((u) => u.id);
        const tenantMobiles = tenantUsers.map((u) => u.mobileNumber).filter((m): m is string => Boolean(m));

        if (tenantUserIds.length > 0) {
          await tx.oTPVerification.deleteMany({
            where: {
              OR: [
                { userId: { in: tenantUserIds } },
                ...(tenantMobiles.length > 0 ? [{ mobileNumber: { in: tenantMobiles } }] : []),
              ],
            },
          });
          await tx.user.deleteMany({ where: { id: { in: tenantUserIds } } });
        }

        // Custom roles & organisation
        await tx.role.deleteMany({ where: { organisationId: partyOrgId } });
        await tx.organisation.delete({ where: { id: partyOrgId } });
      }

      // 7. PURGE BRANDING, PERFORMANCE & POLITICAL PARTY RECORD
      await tx.partyBranding.deleteMany({ where: { partyId: existingParty.id } });
      await tx.partyPerformance.deleteMany({ where: { partyId: existingParty.id } });
      await tx.politicalParty.delete({ where: { id: existingParty.id } });

      return {
        deletedPartyId: existingParty.id,
        partyName: existingParty.name,
        partyCode: existingParty.code,
        deletedVotersCount,
        deletedImportsCount: importIds.length,
        purgedOrganisation: isSolePartyForOrg,
      };
    },
    { timeout: 30000, maxWait: 10000 },
  );

  await logAudit({
    action: AuditAction.DELETE,
    entityType: 'PoliticalParty',
    entityId: result.deletedPartyId,
    req,
    changes: {
      name: result.partyName,
      code: result.partyCode,
      deletedVotersCount: result.deletedVotersCount,
      deletedImportsCount: result.deletedImportsCount,
      purgedOrganisation: result.purgedOrganisation,
      permanent: true,
    } as unknown as Prisma.InputJsonValue,
  });

  return result;
}
