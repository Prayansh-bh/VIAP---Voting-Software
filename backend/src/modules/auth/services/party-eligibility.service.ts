import { prisma } from '../../../lib/prisma.js';

export interface PreloadedOrganisation {
  isActive?: boolean;
  parties?: Array<{ isActive: boolean }>;
  cmsConfigs?: Array<{ activePartyCode?: string | null }>;
}

export class PartyEligibilityService {
  /**
   * Authoritatively checks whether an organisation is active and associated with at least one active political party.
   * Supports:
   * 1. Direct 1-to-many organisation.parties (where p.isActive === true)
   * 2. Tenant CMSConfiguration specifying an activePartyCode that matches an active PoliticalParty
   * 3. Fallback database lookup if preloaded data is absent or incomplete
   */
  static async hasActiveParty(
    organisationId?: string | null,
    preloadedOrg?: PreloadedOrganisation | null
  ): Promise<boolean> {
    if (!organisationId) return false;

    // If preloaded organization indicates it is inactive, reject immediately
    if (preloadedOrg && preloadedOrg.isActive === false) return false;

    // Check 1: Active parties directly linked in organisation.parties
    if (preloadedOrg?.parties && preloadedOrg.parties.length > 0) {
      if (preloadedOrg.parties.some((p) => p.isActive)) {
        return true;
      }
    }

    // Check 2: Preloaded CMS configurations with activePartyCode
    if (preloadedOrg?.cmsConfigs && preloadedOrg.cmsConfigs.length > 0) {
      const partyCodes = preloadedOrg.cmsConfigs
        .map((c) => c.activePartyCode?.trim().toUpperCase())
        .filter((code): code is string => Boolean(code));

      if (partyCodes.length > 0) {
        const activeParty = await prisma.politicalParty.findFirst({
          where: {
            code: { in: partyCodes },
            isActive: true,
          },
          select: { id: true },
        });
        if (activeParty) return true;
      }
    }

    // Check 3: Authoritative fallback database query
    const org = await prisma.organisation.findUnique({
      where: { id: organisationId },
      include: {
        parties: { where: { isActive: true }, select: { id: true } },
        cmsConfigs: { select: { activePartyCode: true } },
      },
    });

    if (!org || !org.isActive) return false;

    if (org.parties && org.parties.length > 0) {
      return true;
    }

    const orgPartyCodes = (org.cmsConfigs || [])
      .map((c) => c.activePartyCode?.trim().toUpperCase())
      .filter((code): code is string => Boolean(code));

    if (orgPartyCodes.length > 0) {
      const activeParty = await prisma.politicalParty.findFirst({
        where: {
          code: { in: orgPartyCodes },
          isActive: true,
        },
        select: { id: true },
      });
      if (activeParty) return true;
    }

    return false;
  }
}
