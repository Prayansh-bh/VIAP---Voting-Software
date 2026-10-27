process.env.NODE_ENV = 'test';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { RoleType, ImportJobStatus } from '@prisma/client';
import { TokenService } from '../modules/auth/services/token.service.js';
import { ApplicationsService } from '../modules/applications/applications.service.js';
import {
  getTenantUploadDir,
  getSecureJobFilePath,
} from '../modules/applications/import-queue.service.js';

describe('PHASE 1 — Comprehensive Security Hotfixes Verification Suite', () => {
  let app: any;

  // Tenant A Fixtures
  let tenantAOrg: any;
  let appAConfig: any;
  let stateA: any;
  let zoneA: any;
  let parliamentA: any;
  let constituencyA: any;
  let mandalA: any;
  let villageA: any;
  let boothA: any;
  let voterGroupA: any;
  let voterA: any;
  let userA: any;
  let tokenA: string;
  let importJobA: any;

  // Tenant B Fixtures
  let tenantBOrg: any;
  let appBConfig: any;
  let stateB: any;
  let zoneB: any;
  let parliamentB: any;
  let constituencyB: any;
  let mandalB: any;
  let villageB: any;
  let boothB: any;
  let voterGroupB: any;
  let voterB: any;
  let userB: any;
  let tokenB: string;
  let importJobB: any;

  // Missing/Inconsistent Fixtures
  let voterOrphanedOrg: any;
  let voterInconsistentOrg: any;

  async function issueToken(user: any) {
    const payload = {
      userId: user.id,
      userCode: user.userCode,
      mobileNumber: user.mobileNumber,
      role: user.role,
      organisationId: user.organisationId,
      unitId: user.unitId ?? undefined,
    };
    const { token, sessionId } = TokenService.generateTokens(payload);
    await TokenService.recordLoginSession(user.id, user.mobileNumber, token, sessionId);
    return token;
  }

  before(async () => {
    app = buildApp();
    await app.ready();

    const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    // 1. Create Tenant A
    tenantAOrg = await prisma.organisation.create({
      data: {
        name: `SecHotfix-Org-A-${suffix}`,
        code: `SHA-${suffix.slice(-4)}`,
        isActive: true,
      },
    });

    stateA = await prisma.state.create({
      data: {
        name: `State-A-${suffix}`,
        code: `STA-${suffix.slice(-4)}`,
        organisationId: tenantAOrg.id,
      },
    });

    zoneA = await prisma.zone.create({
      data: {
        name: `Zone-A-${suffix}`,
        code: `ZNA-${suffix.slice(-4)}`,
        stateId: stateA.id,
      },
    });

    parliamentA = await prisma.parliament.create({
      data: {
        name: `Parliament-A-${suffix}`,
        code: `PLA-${suffix.slice(-4)}`,
        zoneId: zoneA.id,
      },
    });

    constituencyA = await prisma.constituency.create({
      data: {
        name: `Constituency-A-${suffix}`,
        code: `CSA-${suffix.slice(-4)}`,
        constituencyNumber: Math.floor(1000 + Math.random() * 8000),
        parliamentId: parliamentA.id,
        totalVoters: 5000,
      },
    });

    mandalA = await prisma.mandal.create({
      data: {
        name: `Mandal-A-${suffix}`,
        code: `MDA-${suffix.slice(-4)}`,
        constituencyId: constituencyA.id,
      },
    });

    villageA = await prisma.village.create({
      data: {
        name: `Village-A-${suffix}`,
        code: `VLA-${suffix.slice(-4)}`,
        mandalId: mandalA.id,
      },
    });

    boothA = await prisma.booth.create({
      data: {
        name: `Booth-A-${suffix}`,
        code: `BTA-${suffix.slice(-4)}`,
        boothNumber: '101',
        villageId: villageA.id,
        pollingStation: `PS-A-${suffix}`,
      },
    });

    voterGroupA = await prisma.voterGroup.create({
      data: {
        name: `VoterGroup-A-${suffix}`,
        code: `VGA-${suffix.slice(-4)}`,
        boothId: boothA.id,
      },
    });

    const partyA = await prisma.politicalParty.create({
      data: {
        code: `PTA-${suffix.slice(-4)}`,
        name: `Party A ${suffix}`,
        shortName: 'PTA',
        organisationId: tenantAOrg.id,
        isActive: true,
      },
    });

    appAConfig = await prisma.cMSConfiguration.create({
      data: {
        configKey: `app-a-${suffix}`,
        organisationId: tenantAOrg.id,
        organisationName: tenantAOrg.name,
        stateName: stateA.name,
        parliamentName: parliamentA.name,
        appScope: 'SINGLE_MLA',
        activePartyCode: partyA.code,
        hierarchyLabels: {},
        featureToggles: {},
      },
    });

    voterA = await prisma.voter.create({
      data: {
        serialNumber: 1,
        epicNumber: `EPIC-A-${suffix}`,
        name: `Elector A ${suffix}`,
        fatherHusbandName: 'Father A',
        houseNumber: '1-A',
        age: 35,
        stateId: stateA.id,
        zoneId: zoneA.id,
        parliamentId: parliamentA.id,
        constituencyId: constituencyA.id,
        mandalId: mandalA.id,
        villageId: villageA.id,
        boothId: boothA.id,
        voterGroupId: voterGroupA.id,
      },
    });

    userA = await prisma.user.create({
      data: {
        userCode: `USR-A-${suffix}`,
        name: `Incharge A ${suffix}`,
        mobileNumber: `901${Math.floor(1000000 + Math.random() * 9000000)}`,
        role: RoleType.CONSTITUENCY_INCHARGE,
        organisationId: tenantAOrg.id,
      },
    });

    await prisma.userHierarchyAssignment.create({
      data: {
        userId: userA.id,
        roleType: RoleType.CONSTITUENCY_INCHARGE,
        constituencyId: constituencyA.id,
      },
    });

    tokenA = await issueToken(userA);

    importJobA = await prisma.dataImport.create({
      data: {
        applicationId: appAConfig.id,
        uploadedById: userA.id,
        fileName: 'import-a.csv',
        fileSize: 1024,
        targetConstituencyId: constituencyA.id,
        mode: 'APPEND',
        status: 'QUEUED',
      },
    });

    // 2. Create Tenant B
    tenantBOrg = await prisma.organisation.create({
      data: {
        name: `SecHotfix-Org-B-${suffix}`,
        code: `SHB-${suffix.slice(-4)}`,
        isActive: true,
      },
    });

    stateB = await prisma.state.create({
      data: {
        name: `State-B-${suffix}`,
        code: `STB-${suffix.slice(-4)}`,
        organisationId: tenantBOrg.id,
      },
    });

    zoneB = await prisma.zone.create({
      data: {
        name: `Zone-B-${suffix}`,
        code: `ZNB-${suffix.slice(-4)}`,
        stateId: stateB.id,
      },
    });

    parliamentB = await prisma.parliament.create({
      data: {
        name: `Parliament-B-${suffix}`,
        code: `PLB-${suffix.slice(-4)}`,
        zoneId: zoneB.id,
      },
    });

    constituencyB = await prisma.constituency.create({
      data: {
        name: `Constituency-B-${suffix}`,
        code: `CSB-${suffix.slice(-4)}`,
        constituencyNumber: Math.floor(1000 + Math.random() * 8000),
        parliamentId: parliamentB.id,
        totalVoters: 6000,
      },
    });

    mandalB = await prisma.mandal.create({
      data: {
        name: `Mandal-B-${suffix}`,
        code: `MDB-${suffix.slice(-4)}`,
        constituencyId: constituencyB.id,
      },
    });

    villageB = await prisma.village.create({
      data: {
        name: `Village-B-${suffix}`,
        code: `VLB-${suffix.slice(-4)}`,
        mandalId: mandalB.id,
      },
    });

    boothB = await prisma.booth.create({
      data: {
        name: `Booth-B-${suffix}`,
        code: `BTB-${suffix.slice(-4)}`,
        boothNumber: '202',
        villageId: villageB.id,
        pollingStation: `PS-B-${suffix}`,
      },
    });

    voterGroupB = await prisma.voterGroup.create({
      data: {
        name: `VoterGroup-B-${suffix}`,
        code: `VGB-${suffix.slice(-4)}`,
        boothId: boothB.id,
      },
    });

    const partyB = await prisma.politicalParty.create({
      data: {
        code: `PTB-${suffix.slice(-4)}`,
        name: `Party B ${suffix}`,
        shortName: 'PTB',
        organisationId: tenantBOrg.id,
        isActive: true,
      },
    });

    appBConfig = await prisma.cMSConfiguration.create({
      data: {
        configKey: `app-b-${suffix}`,
        organisationId: tenantBOrg.id,
        organisationName: tenantBOrg.name,
        stateName: stateB.name,
        parliamentName: parliamentB.name,
        appScope: 'SINGLE_MLA',
        activePartyCode: partyB.code,
        hierarchyLabels: {},
        featureToggles: {},
      },
    });

    voterB = await prisma.voter.create({
      data: {
        serialNumber: 1,
        epicNumber: `EPIC-B-${suffix}`,
        name: `Elector B ${suffix}`,
        fatherHusbandName: 'Father B',
        houseNumber: '2-B',
        age: 40,
        stateId: stateB.id,
        zoneId: zoneB.id,
        parliamentId: parliamentB.id,
        constituencyId: constituencyB.id,
        mandalId: mandalB.id,
        villageId: villageB.id,
        boothId: boothB.id,
        voterGroupId: voterGroupB.id,
      },
    });

    userB = await prisma.user.create({
      data: {
        userCode: `USR-B-${suffix}`,
        name: `Incharge B ${suffix}`,
        mobileNumber: `902${Math.floor(1000000 + Math.random() * 9000000)}`,
        role: RoleType.CONSTITUENCY_INCHARGE,
        organisationId: tenantBOrg.id,
      },
    });

    await prisma.userHierarchyAssignment.create({
      data: {
        userId: userB.id,
        roleType: RoleType.CONSTITUENCY_INCHARGE,
        constituencyId: constituencyB.id,
      },
    });

    tokenB = await issueToken(userB);

    importJobB = await prisma.dataImport.create({
      data: {
        applicationId: appBConfig.id,
        uploadedById: userB.id,
        fileName: 'import-b.csv',
        fileSize: 2048,
        targetConstituencyId: constituencyB.id,
        mode: 'APPEND',
        status: 'QUEUED',
      },
    });

    // 3. Create Orphaned Voter (Missing state/organisation link)
    voterOrphanedOrg = await prisma.voter.create({
      data: {
        serialNumber: 999,
        epicNumber: `EPIC-ORPHAN-${suffix}`,
        name: `Orphan Elector ${suffix}`,
        fatherHusbandName: 'Unknown',
        houseNumber: '00',
        age: 28,
        stateId: null,
        constituencyId: null,
        boothId: null,
      },
    });

    // 4. Create Inconsistent Voter (State belongs to Tenant B, but constituencyId points to Tenant A)
    voterInconsistentOrg = await prisma.voter.create({
      data: {
        serialNumber: 998,
        epicNumber: `EPIC-INCONSISTENT-${suffix}`,
        name: `Inconsistent Elector ${suffix}`,
        fatherHusbandName: 'Split',
        houseNumber: '99',
        age: 33,
        stateId: stateB.id, // Org B
        constituencyId: constituencyA.id, // Org A
      },
    });
  });

  after(async () => {
    // Clean up temporary files
    try {
      const dirA = getTenantUploadDir(tenantAOrg.id);
      await fs.promises.rm(dirA, { recursive: true, force: true }).catch(() => {});
      const dirB = getTenantUploadDir(tenantBOrg.id);
      await fs.promises.rm(dirB, { recursive: true, force: true }).catch(() => {});
    } catch {}

    // Clean up test data
    try {
      const orgIds = [tenantAOrg?.id, tenantBOrg?.id].filter(Boolean) as string[];
      await prisma.dataImport.deleteMany({ where: { applicationId: { in: [appAConfig?.id, appBConfig?.id].filter(Boolean) as string[] } } }).catch(() => {});
      await prisma.voter.deleteMany({ where: { id: { in: [voterA?.id, voterB?.id, voterOrphanedOrg?.id, voterInconsistentOrg?.id].filter(Boolean) as string[] } } }).catch(() => {});
      await prisma.userHierarchyAssignment.deleteMany({ where: { userId: { in: [userA?.id, userB?.id].filter(Boolean) as string[] } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { organisationId: { in: orgIds } } }).catch(() => {});
      await prisma.cMSConfiguration.deleteMany({ where: { organisationId: { in: orgIds } } }).catch(() => {});
      await prisma.politicalParty.deleteMany({ where: { organisationId: { in: orgIds } } }).catch(() => {});
      await prisma.voterGroup.deleteMany({ where: { id: { in: [voterGroupA?.id, voterGroupB?.id].filter(Boolean) as string[] } } }).catch(() => {});
      await prisma.booth.deleteMany({ where: { id: { in: [boothA?.id, boothB?.id].filter(Boolean) as string[] } } }).catch(() => {});
      await prisma.village.deleteMany({ where: { id: { in: [villageA?.id, villageB?.id].filter(Boolean) as string[] } } }).catch(() => {});
      await prisma.mandal.deleteMany({ where: { id: { in: [mandalA?.id, mandalB?.id].filter(Boolean) as string[] } } }).catch(() => {});
      await prisma.constituency.deleteMany({ where: { id: { in: [constituencyA?.id, constituencyB?.id].filter(Boolean) as string[] } } }).catch(() => {});
      await prisma.parliament.deleteMany({ where: { id: { in: [parliamentA?.id, parliamentB?.id].filter(Boolean) as string[] } } }).catch(() => {});
      await prisma.zone.deleteMany({ where: { id: { in: [zoneA?.id, zoneB?.id].filter(Boolean) as string[] } } }).catch(() => {});
      await prisma.state.deleteMany({ where: { organisationId: { in: orgIds } } }).catch(() => {});
      await prisma.organisation.deleteMany({ where: { id: { in: orgIds } } }).catch(() => {});
    } catch {}

    await app?.close();
  });

  // ==========================================================================
  // SECTION 1 — Hierarchy Endpoint Isolation
  // ==========================================================================
  describe('1. Hierarchy Endpoint Isolation', () => {
    it('1.1. Modifying applicationId to target another tenant is rejected with 403', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/applications/${appBConfig.id}/hierarchy`,
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(res.statusCode, 403, 'Cross-tenant application hierarchy must return 403');
      const body = JSON.parse(res.body);
      assert.equal(body.error?.code, 'FORBIDDEN_TENANT');
    });

    it('1.2. Application hierarchy returns only the caller tenant nodes', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/applications/${appAConfig.id}/hierarchy`,
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.equal(json.success, true);
      const constIds = json.data.constituencies.map((c: any) => c.id);
      assert.ok(constIds.includes(constituencyA.id), 'Must include Constituency A');
      assert.ok(!constIds.includes(constituencyB.id), 'Must NOT leak Constituency B');
    });

    it('1.3. Omitting parentId on BOOTH level does not leak Tenant B booths', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/applications/${appAConfig.id}/hierarchy/BOOTH`,
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      const boothIds = json.data.map((b: any) => b.id);
      assert.ok(boothIds.includes(boothA.id), 'Must include Booth A');
      assert.ok(!boothIds.includes(boothB.id), 'Must NEVER include Booth B when parentId omitted');
    });

    it('1.4. Passing Tenant B parentId returns empty array and leaks zero booths', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/applications/${appAConfig.id}/hierarchy/BOOTH?parentId=${villageB.id}`,
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.equal(json.data.length, 0, 'Cannot query booths under another tenant parent village');
    });

    it('1.5. Omitting parentId on VILLAGE level scopes strictly to Tenant A', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/applications/${appAConfig.id}/hierarchy/VILLAGE`,
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      const villageIds = json.data.map((v: any) => v.id);
      assert.ok(villageIds.includes(villageA.id));
      assert.ok(!villageIds.includes(villageB.id));
    });

    it('1.6. Omitting parentId on MANDAL level scopes strictly to Tenant A', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/applications/${appAConfig.id}/hierarchy/MANDAL`,
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      const mandalIds = json.data.map((m: any) => m.id);
      assert.ok(mandalIds.includes(mandalA.id));
      assert.ok(!mandalIds.includes(mandalB.id));
    });

    it('1.7. Omitting parentId on CONSTITUENCY level scopes strictly to Tenant A', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/applications/${appAConfig.id}/hierarchy/CONSTITUENCY`,
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      const constIds = json.data.map((c: any) => c.id);
      assert.ok(constIds.includes(constituencyA.id));
      assert.ok(!constIds.includes(constituencyB.id));
    });

    it('1.8. Omitting parentId on VOTER_GROUP level scopes strictly to Tenant A', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/applications/${appAConfig.id}/hierarchy/VOTER_GROUP`,
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      const groupIds = json.data.map((g: any) => g.id);
      assert.ok(groupIds.includes(voterGroupA.id));
      assert.ok(!groupIds.includes(voterGroupB.id));
    });

    it('1.9. /:applicationId/booths endpoint returns only Tenant A booths', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/applications/${appAConfig.id}/booths`,
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      const boothIds = json.data.map((b: any) => b.id);
      assert.ok(boothIds.includes(boothA.id));
      assert.ok(!boothIds.includes(boothB.id));
    });

    it('1.10. /:applicationId/100-voter-groups endpoint returns only Tenant A voter groups', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/applications/${appAConfig.id}/100-voter-groups`,
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      const groupIds = json.data.map((g: any) => g.id);
      assert.ok(groupIds.includes(voterGroupA.id));
      assert.ok(!groupIds.includes(voterGroupB.id));
    });
  });

  // ==========================================================================
  // SECTION 2 — Constituency Resolution & Fallback Removal
  // ==========================================================================
  describe('2. Constituency Resolution & Fallback Removal', () => {
    it('2.1. resolveConstituencyForApp throws 400 TARGET_CONSTITUENCY_REQUIRED when target cannot be safely resolved', async () => {
      const dummyConfig = {
        id: 'dummy-app',
        organisationId: tenantAOrg.id,
        organisationName: 'NonExistentXYZOrg',
        headerTitle: 'NonExistentHeader',
      };
      await assert.rejects(
        async () => {
          await ApplicationsService.resolveConstituencyForApp(dummyConfig, undefined);
        },
        (err: any) => {
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, 'TARGET_CONSTITUENCY_REQUIRED');
          return true;
        }
      );
    });

    it('2.2. resolveConstituencyForApp rejects another tenant constituency with 403', async () => {
      await assert.rejects(
        async () => {
          await ApplicationsService.resolveConstituencyForApp(appAConfig, constituencyB.id);
        },
        (err: any) => {
          assert.equal(err.statusCode, 403);
          assert.equal(err.code, 'FORBIDDEN_TENANT_CONSTITUENCY');
          return true;
        }
      );
    });

    it('2.3. /:applicationId/constituencies returns only Tenant A constituencies and zero cross-tenant fallback', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/applications/${appAConfig.id}/constituencies`,
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      const constIds = json.data.map((c: any) => c.id);
      assert.ok(constIds.includes(constituencyA.id));
      assert.ok(!constIds.includes(constituencyB.id));
    });

    it('2.4. /:applicationId/constituencies/:id with Tenant B constituency returns 403', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/applications/${appAConfig.id}/constituencies/${constituencyB.id}`,
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(res.statusCode, 403);
      const json = JSON.parse(res.body);
      assert.equal(json.error?.code, 'FORBIDDEN_TENANT');
    });
  });

  // ==========================================================================
  // SECTION 3 — Voter Authorization & Fail-Closed Checks
  // ==========================================================================
  describe('3. Voter Authorization & Fail Closed', () => {
    it('3.1. User A cannot read Tenant B voter details (403 FORBIDDEN_TENANT)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/voters/${voterB.id}`,
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(res.statusCode, 403);
      const json = JSON.parse(res.body);
      assert.equal(json.error?.code, 'FORBIDDEN_TENANT');
    });

    it('3.2. User A cannot update Tenant B voter (403 FORBIDDEN_TENANT)', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/voters/${voterB.id}`,
        headers: { Authorization: `Bearer ${tokenA}` },
        payload: { mobileNumber: '9999999999' },
      });
      assert.equal(res.statusCode, 403);
      const json = JSON.parse(res.body);
      assert.equal(json.error?.code, 'FORBIDDEN_TENANT');
    });

    it('3.3. User A cannot delete Tenant B voter (403 FORBIDDEN_TENANT)', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/voters/${voterB.id}`,
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(res.statusCode, 403);
      const json = JSON.parse(res.body);
      assert.equal(json.error?.code, 'FORBIDDEN_TENANT');
    });

    it('3.4. User A listing voters with Tenant B constituency returns 0 records', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/voters?constituencyId=${constituencyB.id}`,
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.equal(json.meta?.total ?? 0, 0);
      assert.equal(json.data?.length ?? 0, 0);
    });

    it('3.5. User A creating voter with Tenant B constituency is rejected with 403', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/voters',
        headers: { Authorization: `Bearer ${tokenA}` },
        payload: {
          serialNumber: 99,
          epicNumber: `EPIC-CROSS-${Date.now()}`,
          name: 'Cross Tenant Voter',
          fatherHusbandName: 'Father',
          houseNumber: '1-1',
          age: 30,
          gender: 'MALE',
          constituencyId: constituencyB.id,
        },
      });
      assert.equal(res.statusCode, 403);
      const json = JSON.parse(res.body);
      assert.equal(json.error?.code, 'FORBIDDEN_TENANT');
    });

    it('3.6. Missing ownership on voter fails closed (403 FORBIDDEN_TENANT)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/voters/${voterOrphanedOrg.id}`,
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(res.statusCode, 403);
      const json = JSON.parse(res.body);
      assert.equal(json.error?.code, 'FORBIDDEN_TENANT');
    });

    it('3.7. Inconsistent ownership on voter fails closed (403 FORBIDDEN_TENANT)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/voters/${voterInconsistentOrg.id}`,
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(res.statusCode, 403);
      const json = JSON.parse(res.body);
      assert.equal(json.error?.code, 'FORBIDDEN_TENANT');
    });
  });

  // ==========================================================================
  // SECTION 4 — Temporary Upload Isolation & Storage Security
  // ==========================================================================
  describe('4. Temporary Upload Isolation', () => {
    it('4.1. Temporary upload storage is isolated into separate per-tenant directories', () => {
      const dirA = getTenantUploadDir(tenantAOrg.id);
      const dirB = getTenantUploadDir(tenantBOrg.id);
      assert.notEqual(dirA, dirB);
      assert.ok(dirA.endsWith(tenantAOrg.id));
      assert.ok(dirB.endsWith(tenantBOrg.id));
      assert.ok(fs.existsSync(dirA));
      assert.ok(fs.existsSync(dirB));
    });

    it('4.2. Path traversal attack in tenantId is blocked', () => {
      assert.throws(
        () => {
          getTenantUploadDir('../../etc');
        },
        /Invalid tenant identifier|Path traversal attempt/
      );
    });

    it('4.3. Path traversal attack in jobId is blocked', () => {
      assert.throws(
        () => {
          getSecureJobFilePath(tenantAOrg.id, '../../etc/passwd');
        },
        /Invalid job identifier|Path traversal attempt/
      );
    });

    it('4.4. User A cannot access Tenant B import job details (403 FORBIDDEN_TENANT)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/applications/${appAConfig.id}/data/imports/${importJobB.id}`,
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(res.statusCode, 403);
      const json = JSON.parse(res.body);
      assert.equal(json.error?.code, 'FORBIDDEN_TENANT');
    });

    it('4.5. User A cannot access Tenant B import error records (403 FORBIDDEN_TENANT)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/applications/${appAConfig.id}/data/imports/${importJobB.id}/errors`,
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(res.statusCode, 403);
      const json = JSON.parse(res.body);
      assert.equal(json.error?.code, 'FORBIDDEN_TENANT');
    });
  });

  // ==========================================================================
  // SECTION 5 — Authorized Same-Tenant Workflows Continue to Work
  // ==========================================================================
  describe('5. Authorized Same-Tenant Workflows', () => {
    it('5.1. User A can retrieve configuration for Application A', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/applications/${appAConfig.id}/configuration`,
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.equal(json.data.id, appAConfig.id);
    });

    it('5.2. User A can retrieve single constituency detail for Constituency A', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/applications/${appAConfig.id}/constituencies/${constituencyA.id}`,
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.equal(json.data.id, constituencyA.id);
    });

    it('5.3. User A can retrieve own voter detail for Voter A', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/voters/${voterA.id}`,
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.equal(json.data.id, voterA.id);
    });

    it('5.4. User A can list own voters within Constituency A', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/voters?constituencyId=${constituencyA.id}`,
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.ok((json.meta?.total ?? 0) >= 1);
      const voterIds = (json.data ?? []).map((v: any) => v.id);
      assert.ok(voterIds.includes(voterA.id));
    });

    it('5.5. User A can retrieve own import job record', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/applications/${appAConfig.id}/data/imports/${importJobA.id}`,
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.equal(json.data.id, importJobA.id);
    });
  });
});
