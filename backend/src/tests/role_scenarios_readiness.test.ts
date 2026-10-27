import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma.js';
import { RoleType, VoterStatus, VoterLocationStatus, AuditAction, AccountStatus } from '@prisma/client';
import { TokenService } from '../modules/auth/services/token.service.js';
import { VotersService } from '../modules/voters/voters.service.js';
import { assertVoterScope } from '../middleware/rbac.js';

describe('Task 4: Role-Wise Hierarchy Scenarios & API Readiness Suite', () => {
  let orgA: any;
  let orgB: any;
  let acA: any;
  let acB: any;
  let mandalA1: any;
  let mandalA2: any;
  let psA1: any;
  let psA2: any;
  let boothA1: any;
  let boothA2: any;
  let boothA3: any;
  let voterBooth1: any;
  let voterBooth2: any;
  let voterBooth3: any;
  let voterTenantB: any;

  let boothInchargeUser: any;
  let psInchargeUser: any;
  let mandalInchargeUser: any;
  let tenantBUser: any;

  const runId = Date.now().toString().slice(-6);

  before(async () => {
    // 1. Create two isolated tenants
    orgA = await prisma.organisation.create({
      data: {
        code: `ORG-A-${runId}`,
        name: `Party Org A ${runId}`,
        isActive: true,
      },
    });

    orgB = await prisma.organisation.create({
      data: {
        code: `ORG-B-${runId}`,
        name: `Party Org B ${runId}`,
        isActive: true,
      },
    });

    const stateA = await prisma.state.create({
      data: { name: 'State A', code: `ST-A-${runId}`, organisationId: orgA.id },
    });
    const zoneA = await prisma.zone.create({
      data: { name: 'Zone A', code: `ZN-A-${runId}`, stateId: stateA.id },
    });
    const parlA = await prisma.parliament.create({
      data: { name: 'Parl A', code: `PR-A-${runId}`, zoneId: zoneA.id },
    });
    acA = await prisma.constituency.create({
      data: { name: 'Constituency A', code: `AC-A-${runId}`, parliamentId: parlA.id },
    });

    const stateB = await prisma.state.create({
      data: { name: 'State B', code: `ST-B-${runId}`, organisationId: orgB.id },
    });
    const zoneB = await prisma.zone.create({
      data: { name: 'Zone B', code: `ZN-B-${runId}`, stateId: stateB.id },
    });
    const parlB = await prisma.parliament.create({
      data: { name: 'Parl B', code: `PR-B-${runId}`, zoneId: zoneB.id },
    });
    acB = await prisma.constituency.create({
      data: { name: 'Constituency B', code: `AC-B-${runId}`, parliamentId: parlB.id },
    });

    // 2. Setup Mandals, PollingStations, Booths, and Voters in Org A
    mandalA1 = await prisma.mandal.create({
      data: { name: 'Mandal A1', code: `MD-A1-${runId}`, constituencyId: acA.id },
    });
    mandalA2 = await prisma.mandal.create({
      data: { name: 'Mandal A2', code: `MD-A2-${runId}`, constituencyId: acA.id },
    });

    const vilA1 = await prisma.village.create({
      data: { name: 'Village A1', code: `VL-A1-${runId}`, mandalId: mandalA1.id },
    });
    const vilA2 = await prisma.village.create({
      data: { name: 'Village A2', code: `VL-A2-${runId}`, mandalId: mandalA2.id },
    });

    psA1 = await prisma.pollingStation.create({
      data: {
        name: 'Station A1 (Serves Booth 1 & 2)',
        code: `PS-A1-${runId}`,
        constituencyId: acA.id,
        mandalId: mandalA1.id,
      },
    });

    psA2 = await prisma.pollingStation.create({
      data: {
        name: 'Station A2 (Serves Booth 3 in Mandal A2)',
        code: `PS-A2-${runId}`,
        constituencyId: acA.id,
        mandalId: mandalA2.id,
      },
    });

    // Booth 1 and Booth 2 share PollingStation A1
    boothA1 = await prisma.booth.create({
      data: {
        boothNumber: '101',
        name: 'Booth 101',
        code: `BT-101-${runId}`,
        villageId: vilA1.id,
        pollingStationId: psA1.id,
      },
    });
    boothA2 = await prisma.booth.create({
      data: {
        boothNumber: '102',
        name: 'Booth 102',
        code: `BT-102-${runId}`,
        villageId: vilA1.id,
        pollingStationId: psA1.id,
      },
    });

    // Booth 3 is in Mandal A2 and PollingStation A2
    boothA3 = await prisma.booth.create({
      data: {
        boothNumber: '103',
        name: 'Booth 103',
        code: `BT-103-${runId}`,
        villageId: vilA2.id,
        pollingStationId: psA2.id,
      },
    });

    // 3. Create test voters
    voterBooth1 = await prisma.voter.create({
      data: {
        serialNumber: 1,
        epicNumber: `EPIC-B1-${runId}`,
        name: 'Voter in Booth 1',
        fatherHusbandName: 'Parent B1',
        houseNumber: '1-10',
        age: 30,
        gender: 'MALE',
        constituencyId: acA.id,
        mandalId: mandalA1.id,
        villageId: vilA1.id,
        boothId: boothA1.id,
        voterStatus: VoterStatus.ACTIVE,
      },
    });

    voterBooth2 = await prisma.voter.create({
      data: {
        serialNumber: 1,
        epicNumber: `EPIC-B2-${runId}`,
        name: 'Voter in Booth 2',
        fatherHusbandName: 'Parent B2',
        houseNumber: '2-20',
        age: 35,
        gender: 'FEMALE',
        constituencyId: acA.id,
        mandalId: mandalA1.id,
        villageId: vilA1.id,
        boothId: boothA2.id,
        voterStatus: VoterStatus.ACTIVE,
      },
    });

    voterBooth3 = await prisma.voter.create({
      data: {
        serialNumber: 1,
        epicNumber: `EPIC-B3-${runId}`,
        name: 'Voter in Booth 3 (Mandal A2)',
        fatherHusbandName: 'Parent B3',
        houseNumber: '3-30',
        age: 40,
        gender: 'MALE',
        constituencyId: acA.id,
        mandalId: mandalA2.id,
        villageId: vilA2.id,
        boothId: boothA3.id,
        voterStatus: VoterStatus.ACTIVE,
      },
    });

    // Tenant B voter
    const mandalB = await prisma.mandal.create({
      data: { name: 'Mandal B', code: `MD-B-${runId}`, constituencyId: acB.id },
    });
    const vilB = await prisma.village.create({
      data: { name: 'Village B', code: `VL-B-${runId}`, mandalId: mandalB.id },
    });
    const boothB = await prisma.booth.create({
      data: { boothNumber: '201', name: 'Booth 201', code: `BT-201-${runId}`, villageId: vilB.id },
    });
    voterTenantB = await prisma.voter.create({
      data: {
        serialNumber: 1,
        epicNumber: `EPIC-TB-${runId}`,
        name: 'Tenant B Citizen',
        fatherHusbandName: 'Parent TB',
        houseNumber: '4-40',
        age: 45,
        gender: 'FEMALE',
        constituencyId: acB.id,
        mandalId: mandalB.id,
        villageId: vilB.id,
        boothId: boothB.id,
        voterStatus: VoterStatus.ACTIVE,
      },
    });

    // 4. Create representative incharge users
    boothInchargeUser = await prisma.user.create({
      data: {
        userCode: `USR-BIC-${runId}`,
        name: 'Booth Incharge User',
        mobileNumber: `919000${runId.slice(0, 4)}01`,
        role: RoleType.BOOTH_INCHARGE,
        accountStatus: AccountStatus.ACTIVE,
        organisationId: orgA.id,
      },
    });
    await prisma.userHierarchyAssignment.create({
      data: {
        userId: boothInchargeUser.id,
        roleType: RoleType.BOOTH_INCHARGE,
        constituencyId: acA.id,
        mandalId: mandalA1.id,
        villageId: vilA1.id,
        boothId: boothA1.id,
        isActive: true,
      },
    });

    psInchargeUser = await prisma.user.create({
      data: {
        userCode: `USR-PSIC-${runId}`,
        name: 'Polling Station Incharge User',
        mobileNumber: `919000${runId.slice(0, 4)}02`,
        role: RoleType.VILLAGE_INCHARGE,
        accountStatus: AccountStatus.ACTIVE,
        organisationId: orgA.id,
      },
    });
    await prisma.userHierarchyAssignment.create({
      data: {
        userId: psInchargeUser.id,
        roleType: RoleType.VILLAGE_INCHARGE,
        constituencyId: acA.id,
        mandalId: mandalA1.id,
        pollingStationId: psA1.id,
        isActive: true,
      },
    });

    mandalInchargeUser = await prisma.user.create({
      data: {
        userCode: `USR-MIC-${runId}`,
        name: 'Mandal Incharge User',
        mobileNumber: `919000${runId.slice(0, 4)}03`,
        role: RoleType.MANDAL_INCHARGE,
        accountStatus: AccountStatus.ACTIVE,
        organisationId: orgA.id,
      },
    });
    await prisma.userHierarchyAssignment.create({
      data: {
        userId: mandalInchargeUser.id,
        roleType: RoleType.MANDAL_INCHARGE,
        constituencyId: acA.id,
        mandalId: mandalA1.id,
        isActive: true,
      },
    });

    tenantBUser = await prisma.user.create({
      data: {
        userCode: `USR-TB-${runId}`,
        name: 'Tenant B User',
        mobileNumber: `919000${runId.slice(0, 4)}04`,
        role: RoleType.CONSTITUENCY_INCHARGE,
        accountStatus: AccountStatus.ACTIVE,
        organisationId: orgB.id,
      },
    });
    await prisma.userHierarchyAssignment.create({
      data: {
        userId: tenantBUser.id,
        roleType: RoleType.CONSTITUENCY_INCHARGE,
        constituencyId: acB.id,
        isActive: true,
      },
    });
  });

  after(async () => {
    for (const ac of [acA, acB]) {
      if (ac?.id) {
        const vList = await prisma.voter.findMany({ where: { constituencyId: ac.id }, select: { id: true } });
        const vIds = vList.map((v) => v.id);
        if (vIds.length > 0) {
          await prisma.auditLog.deleteMany({ where: { entityId: { in: vIds } } }).catch(() => {});
          await prisma.voterStatusHistory.deleteMany({ where: { voterId: { in: vIds } } }).catch(() => {});
        }
        await prisma.voter.deleteMany({ where: { constituencyId: ac.id } });
        await prisma.booth.deleteMany({ where: { village: { mandal: { constituencyId: ac.id } } } });
        await prisma.pollingStation.deleteMany({ where: { constituencyId: ac.id } });
        await prisma.village.deleteMany({ where: { mandal: { constituencyId: ac.id } } });
        await prisma.mandal.deleteMany({ where: { constituencyId: ac.id } });
        await prisma.constituency.deleteMany({ where: { id: ac.id } });
      }
    }
    for (const u of [boothInchargeUser, psInchargeUser, mandalInchargeUser, tenantBUser]) {
      if (u?.id) {
        await prisma.userHierarchyAssignment.deleteMany({ where: { userId: u.id } });
        await prisma.loginSession.deleteMany({ where: { userId: u.id } });
        await prisma.user.deleteMany({ where: { id: u.id } });
      }
    }
    for (const org of [orgA, orgB]) {
      if (org?.id) {
        await prisma.state.deleteMany({ where: { organisationId: org.id } }).catch(() => {});
        await prisma.organisation.deleteMany({ where: { id: org.id } }).catch(() => {});
      }
    }
  });

  it('1. Booth Incharge sees ONLY assigned booth and cannot access other booths', async () => {
    const scope = {
      role: RoleType.BOOTH_INCHARGE,
      isGlobalScope: false,
      organisationId: orgA.id,
      accessibleConstituencyIds: new Set([acA.id]),
      accessibleMandalIds: new Set([mandalA1.id]),
      accessibleVillageIds: new Set(),
      accessibleBoothIds: new Set([boothA1.id]),
      accessibleVoterGroupIds: new Set(),
    };

    const listRes = await VotersService.listVoters(
      { page: 1, limit: 10, constituencyId: acA.id } as any,
      scope as any
    );

    // Must see Voter in Booth 1 only
    assert.equal(listRes.items.length, 1);
    assert.equal(listRes.items[0].id, voterBooth1.id);

    // Cross-booth access to Booth 2 voter must fail-closed
    let statusCode = 0;
    const mockReply: any = {
      status(code: number) { statusCode = code; return this; },
      send() { return this; }
    };
    const mockReq: any = { user: { userId: boothInchargeUser.id }, hierarchyScope: scope };

    const authorized = await assertVoterScope(mockReq, mockReply, voterBooth2.id);
    assert.equal(authorized, false);
    assert.equal(statusCode, 403);
  });

  it('2. Polling Station (Village Incharge) sees booths served by their Polling Station', async () => {
    // PollingStation A1 serves both Booth 1 and Booth 2
    const psBooths = await prisma.booth.findMany({
      where: { pollingStationId: psA1.id },
      select: { id: true },
    });
    const boothIds = new Set(psBooths.map((b) => b.id));

    const scope = {
      role: RoleType.VILLAGE_INCHARGE,
      isGlobalScope: false,
      organisationId: orgA.id,
      accessibleConstituencyIds: new Set([acA.id]),
      accessibleMandalIds: new Set([mandalA1.id]),
      accessibleVillageIds: new Set(),
      accessibleBoothIds: boothIds,
      accessibleVoterGroupIds: new Set(),
    };

    const listRes = await VotersService.listVoters(
      { page: 1, limit: 10, constituencyId: acA.id } as any,
      scope as any
    );

    // Must see both Voter 1 and Voter 2 (both booths in PS A1), but NOT Voter 3 (in PS A2)
    assert.equal(listRes.items.length, 2);
    const seenIds = new Set(listRes.items.map((v) => v.id));
    assert.ok(seenIds.has(voterBooth1.id));
    assert.ok(seenIds.has(voterBooth2.id));
    assert.ok(!seenIds.has(voterBooth3.id));

    // Access to Voter 3 in PS A2 must return 403
    let statusCode = 0;
    const mockReply: any = {
      status(c: number) { statusCode = c; return this; },
      send() { return this; }
    };
    const mockReq: any = { user: { userId: psInchargeUser.id }, hierarchyScope: scope };

    const authorized = await assertVoterScope(mockReq, mockReply, voterBooth3.id);
    assert.equal(authorized, false);
    assert.equal(statusCode, 403);
  });

  it('3. Mandal Incharge sees authorized mandal and cannot access another mandal', async () => {
    // Mandal A1 includes Booth 1 and Booth 2, but NOT Booth 3 (which is in Mandal A2)
    const mandalBooths = await prisma.booth.findMany({
      where: { village: { mandalId: mandalA1.id } },
      select: { id: true },
    });
    const mandalBoothIds = new Set(mandalBooths.map((b) => b.id));

    const scope = {
      role: RoleType.MANDAL_INCHARGE,
      isGlobalScope: false,
      organisationId: orgA.id,
      accessibleConstituencyIds: new Set([acA.id]),
      accessibleMandalIds: new Set([mandalA1.id]),
      accessibleVillageIds: new Set(),
      accessibleBoothIds: mandalBoothIds,
      accessibleVoterGroupIds: new Set(),
    };

    const listRes = await VotersService.listVoters(
      { page: 1, limit: 10, constituencyId: acA.id } as any,
      scope as any
    );

    assert.equal(listRes.items.length, 2);
    const seenIds = new Set(listRes.items.map((v) => v.id));
    assert.ok(seenIds.has(voterBooth1.id));
    assert.ok(seenIds.has(voterBooth2.id));
    assert.ok(!seenIds.has(voterBooth3.id)); // Voter in Mandal A2 is blocked

    // Direct access to Voter 3 must return 403
    let statusCode = 0;
    const mockReply: any = {
      status(c: number) { statusCode = c; return this; },
      send() { return this; }
    };
    const mockReq: any = { user: { userId: mandalInchargeUser.id }, hierarchyScope: scope };

    const authorized = await assertVoterScope(mockReq, mockReply, voterBooth3.id);
    assert.equal(authorized, false);
    assert.equal(statusCode, 403);
  });

  it('4. Cross-tenant isolation blocks access across different organizations', async () => {
    const tenantBScope = {
      role: RoleType.CONSTITUENCY_INCHARGE,
      isGlobalScope: false,
      organisationId: orgB.id,
      accessibleConstituencyIds: new Set([acB.id]),
      accessibleMandalIds: new Set(),
      accessibleVillageIds: new Set(),
      accessibleBoothIds: new Set(),
      accessibleVoterGroupIds: new Set(),
    };

    let statusCode = 0;
    const mockReply: any = {
      status(c: number) { statusCode = c; return this; },
      send() { return this; }
    };
    const mockReq: any = { user: { userId: tenantBUser.id }, hierarchyScope: tenantBScope };

    // Tenant B user attempts to access Tenant A voter
    const authorized = await assertVoterScope(mockReq, mockReply, voterBooth1.id);
    assert.equal(authorized, false);
    assert.equal(statusCode, 403, 'Cross-tenant access must be rejected with 403');
  });

  it('5. Voter edit operations preserve official EPIC & serial number and record audit history', async () => {
    const originalEpic = voterBooth1.epicNumber;
    const originalSerial = voterBooth1.serialNumber;

    // Perform operational edit
    const updated = await VotersService.updateVoter(
      voterBooth1.id,
      {
        voterStatus: VoterStatus.DOUBTFUL, // Operational verification status
        voterLocationStatus: VoterLocationStatus.MIGRATED, // Location status
        currentLocation: 'Bangalore Whitefield',
        notes: 'Operational check: Voter migrated for employment; flagged doubtful for verification',
      },
      boothInchargeUser.id
    );

    assert.equal(updated.epicNumber, originalEpic, 'Official EPIC must be preserved');
    assert.equal(updated.serialNumber, originalSerial, 'Official serial number must be preserved');
    assert.equal(updated.voterStatus, VoterStatus.DOUBTFUL);
    assert.equal(updated.voterLocationStatus, VoterLocationStatus.MIGRATED);
    assert.equal(updated.currentLocation, 'Bangalore Whitefield');

    // Verify audit log
    const audit = await prisma.auditLog.findFirst({
      where: { entityType: 'Voter', entityId: voterBooth1.id, action: AuditAction.UPDATE },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(audit, 'Audit log must be created');
    assert.equal(audit.userId, boothInchargeUser.id);
  });
});
