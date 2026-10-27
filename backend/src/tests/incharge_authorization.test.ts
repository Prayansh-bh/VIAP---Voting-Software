import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { generateToken } from '../middleware/auth.js';
import { RoleType } from '@prisma/client';

describe('STEP 5 — Incharge Authorization & Fail-Closed Scoping Verification', () => {
  let app: any;
  let constituency: any;
  let mandal: any;
  let village: any;
  let booth1: any;
  let booth2: any;
  let group1: any;
  let group2: any;

  let voterInBooth1: any;
  let voterInBooth2: any;
  let voterWithNullBooth: any;

  let tokenBooth1Incharge: string;
  let tokenGroup1Incharge: string;
  let tokenViewer: string;
  let tokenUnauthorized: string;

  before(async () => {
    app = buildApp();
    await app.ready();

    // 1. Resolve Kondapi constituency hierarchy
    const c = await prisma.constituency.findFirst({
      where: { constituencyNumber: 110 },
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

    if (!c) throw new Error('Constituency 110 not found');
    constituency = c;

    // Pick first mandal, village, and two booths
    mandal = c.mandals[0];
    village = mandal.villages[0];
    booth1 = village.booths[0];
    booth2 = village.booths[1] || c.mandals[0].villages[1]?.booths[0];
    group1 = booth1.voterGroups[0];
    group2 = booth2?.voterGroups[0];

    // Find actual voters in booth 1 and booth 2
    voterInBooth1 = await prisma.voter.findFirst({
      where: { boothId: booth1.id, voterStatus: 'ACTIVE' },
    });
    voterInBooth2 = await prisma.voter.findFirst({
      where: { boothId: booth2.id, voterStatus: 'ACTIVE' },
    });

    // Create a temporary test voter with NULL boothId in Kondapi to test null hierarchy fail-closed behavior
    voterWithNullBooth = await prisma.voter.create({
      data: {
        serialNumber: 99999,
        epicNumber: `TEST-NULL-BOOTH-${Date.now()}`,
        name: 'Null Booth Test Voter',
        fatherHusbandName: 'Father',
        houseNumber: '0-0',
        age: 30,
        constituencyId: constituency.id,
        boothId: null,
      },
    });

    // Create test users & assignments
    const org = await prisma.organisation.findFirst();
    const orgId = org?.id || 'default-org';

    // Ensure the constituency state is linked to the test organization to satisfy strict fail-closed tenant validation
    const stateRecord = await prisma.state.findFirst({
      where: { zones: { some: { parliaments: { some: { constituencies: { some: { id: constituency.id } } } } } } },
    });
    if (stateRecord && !stateRecord.organisationId) {
      await prisma.state.update({
        where: { id: stateRecord.id },
        data: { organisationId: orgId },
      });
    }

    // 1. Booth 1 Incharge
    const userB1 = await prisma.user.create({
      data: {
        userCode: `USR-B1-${Date.now()}`,
        name: 'Booth 1 Incharge',
        mobileNumber: `9100${Math.floor(100000 + Math.random() * 900000)}`,
        role: RoleType.BOOTH_PRESIDENT,
        organisationId: orgId,
      },
    });
    await prisma.userHierarchyAssignment.create({
      data: {
        userId: userB1.id,
        roleType: RoleType.BOOTH_PRESIDENT,
        boothId: booth1.id,
      },
    });
    tokenBooth1Incharge = generateToken({
      userId: userB1.id,
      userCode: userB1.userCode,
      mobileNumber: userB1.mobileNumber,
      role: RoleType.BOOTH_PRESIDENT,
      organisationId: orgId,
    });

    // 2. 100-Voter Incharge (Group 1)
    const userG1 = await prisma.user.create({
      data: {
        userCode: `USR-G1-${Date.now()}`,
        name: 'Group 1 Incharge',
        mobileNumber: `9200${Math.floor(100000 + Math.random() * 900000)}`,
        role: RoleType.VOTER_100_INCHARGE,
        organisationId: orgId,
      },
    });
    await prisma.userHierarchyAssignment.create({
      data: {
        userId: userG1.id,
        roleType: RoleType.VOTER_100_INCHARGE,
        voterGroupId: group1?.id,
        boothId: booth1.id,
      },
    });
    tokenGroup1Incharge = generateToken({
      userId: userG1.id,
      userCode: userG1.userCode,
      mobileNumber: userG1.mobileNumber,
      role: RoleType.VOTER_100_INCHARGE,
      organisationId: orgId,
    });

    // 3. Viewer
    const userV = await prisma.user.create({
      data: {
        userCode: `USR-VIEW-${Date.now()}`,
        name: 'Viewer Incharge',
        mobileNumber: `9300${Math.floor(100000 + Math.random() * 900000)}`,
        role: RoleType.VIEWER,
        organisationId: orgId,
      },
    });
    await prisma.userHierarchyAssignment.create({
      data: {
        userId: userV.id,
        roleType: RoleType.VIEWER,
        constituencyId: constituency.id,
      },
    });
    tokenViewer = generateToken({
      userId: userV.id,
      userCode: userV.userCode,
      mobileNumber: userV.mobileNumber,
      role: RoleType.VIEWER,
      organisationId: orgId,
    });

    // 4. Incharge with no hierarchy assignment (orphaned/unassigned)
    const userUnassigned = await prisma.user.create({
      data: {
        userCode: `USR-UNASSIGNED-${Date.now()}`,
        name: 'Unassigned User',
        mobileNumber: `9400${Math.floor(100000 + Math.random() * 900000)}`,
        role: RoleType.BOOTH_PRESIDENT,
        organisationId: orgId,
      },
    });
    tokenUnauthorized = generateToken({
      userId: userUnassigned.id,
      userCode: userUnassigned.userCode,
      mobileNumber: userUnassigned.mobileNumber,
      role: RoleType.BOOTH_PRESIDENT,
      organisationId: orgId,
    });
  });

  after(async () => {
    // Clean up temporary voter
    if (voterWithNullBooth?.id) {
      await prisma.voter.delete({ where: { id: voterWithNullBooth.id } }).catch(() => {});
    }
  });

  // TEST 1: NULL HIERARCHY FIELDS FAIL CLOSED
  it('1. Null hierarchy fields fail closed: Voter with NULL boothId cannot be accessed by Booth Incharge', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/voters/${voterWithNullBooth.id}`,
      headers: { Authorization: `Bearer ${tokenBooth1Incharge}` },
    });
    assert.equal(res.statusCode, 403, 'Must return 403 Forbidden for voter with null boothId');
    const json = JSON.parse(res.body);
    assert.equal(json.success, false);
  });

  // TEST 2: CROSS-BOOTH ACCESS BLOCKED
  it('2. Cross-booth access fails closed: Booth 1 Incharge cannot access voter in Booth 2', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/voters/${voterInBooth2.id}`,
      headers: { Authorization: `Bearer ${tokenBooth1Incharge}` },
    });
    assert.equal(res.statusCode, 403, 'Cross-booth detail access must fail closed with 403 Forbidden');
  });

  // TEST 3: DETAIL ENDPOINT ACCESSIBLE WITHIN ASSIGNED SCOPE
  it('3. Detail endpoint: Booth 1 Incharge can access voter in Booth 1', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/voters/${voterInBooth1.id}`,
      headers: { Authorization: `Bearer ${tokenBooth1Incharge}` },
    });
    assert.equal(res.statusCode, 200, 'Must return 200 OK for voter within assigned booth');
    const json = JSON.parse(res.body);
    assert.equal(json.data.id, voterInBooth1.id);
  });

  // TEST 4: LIST ENDPOINTS PROPERLY SCOPED
  it('4. List endpoint: Unauthorized unit query fails closed with 403', async () => {
    // Booth 1 Incharge attempting to list voters for Booth 2
    const res = await app.inject({
      method: 'GET',
      url: `/api/voters?unitId=${booth2.id}`,
      headers: { Authorization: `Bearer ${tokenBooth1Incharge}` },
    });
    assert.equal(res.statusCode, 403, 'Querying outside authorized unit must return 403');
  });

  // TEST 5: EDITS BLOCKED OUTSIDE SCOPE
  it('5. Edits fail closed: Booth 1 Incharge cannot update voter in Booth 2', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/voters/${voterInBooth2.id}`,
      headers: { Authorization: `Bearer ${tokenBooth1Incharge}` },
      payload: { mobileNumber: '9999999999' },
    });
    assert.equal(res.statusCode, 403, 'Cross-booth edit must return 403 Forbidden');
  });

  // TEST 6: IMMUTABLE ELECTORAL IDENTITY PROTECTION
  it('6. Identity protection: 100-Voter Incharge cannot modify immutable official roll fields', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/voters/${voterInBooth1.id}`,
      headers: { Authorization: `Bearer ${tokenGroup1Incharge}` },
      payload: { epicNumber: 'MODIFIED-EPIC-123' },
    });
    assert.equal(res.statusCode, 403, 'Attempting to modify official EPIC must return 403 Forbidden');
  });

  // TEST 7: BULK IMPORT & MUTATION RESTRICTIONS
  it('7. Bulk import restricted: Booth Incharge and 100-Voter Incharge cannot trigger bulk imports', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/voters/bulk-import',
      headers: { Authorization: `Bearer ${tokenBooth1Incharge}` },
      payload: { voters: [] },
    });
    assert.equal(res.statusCode, 403, 'Bulk import by Booth Incharge must return 403 Forbidden');
  });

  // TEST 8: UNASSIGNED/ORPHANED USER ACCESS FAILS CLOSED
  it('8. Unassigned user fails closed: Incharge with no hierarchy nodes has zero access', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/voters/${voterInBooth1.id}`,
      headers: { Authorization: `Bearer ${tokenUnauthorized}` },
    });
    assert.equal(res.statusCode, 403, 'Unassigned incharge must fail closed with 403 Forbidden');
  });
});
