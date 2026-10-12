import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { generateToken } from '../middleware/auth.js';
import { OrgHierarchyLevel, RoleType } from '@prisma/client';

describe('Strict Role-Based & Hierarchy-Based Authorization Suite', () => {
  let app: any;

  // Organisations
  let orgA: any;
  let orgB: any;

  // Hierarchy Nodes
  let stateNode: any;
  let zoneNode: any;
  let parliamentNode: any;
  let constituencyKondapi: any;
  let mandalKondapi: any;
  let mandalZarugumalli: any;
  let villageKondapi: any;
  let villageZarugumalli: any;
  let booth101: any;
  let booth102: any;
  let voterGroup1: any;
  let voterGroup2: any;

  // Voters
  let voterCluster1: any;
  let voterCluster2: any;
  let voterInOtherMandal: any;

  // Test Users & Tokens for every Role
  let userSuperAdmin: any;
  let tokenSuperAdmin: string;

  let userStateAdmin: any;
  let tokenStateAdmin: string;

  let userConstituencyIncharge: any;
  let tokenConstituencyIncharge: string;

  let userMandalIncharge: any;
  let tokenMandalIncharge: string;

  let userVillageIncharge: any;
  let tokenVillageIncharge: string;

  let userBoothIncharge: any;
  let tokenBoothIncharge: string;

  let user100VoterIncharge: any;
  let token100VoterIncharge: string;

  let userViewer: any;
  let tokenViewer: string;

  let userOrgB: any;
  let tokenOrgB: string;

  before(async () => {
    app = buildApp();
    await app.ready();

    // 1. Fetch Organisations
    orgA = await prisma.organisation.findFirst();
    if (!orgA) {
      orgA = await prisma.organisation.create({
        data: {
          code: 'TDP-MAIN',
          name: 'Telugu Desam Party Central Command',
          isActive: true,
        },
      });
    }

    orgB = await prisma.organisation.findFirst({ where: { code: 'OTHER-ORG' } });
    if (!orgB) {
      orgB = await prisma.organisation.create({
        data: {
          code: 'OTHER-ORG',
          name: 'Independent External Organisation',
          isActive: true,
        },
      });
    }

    // 2. Fetch Hierarchy Nodes Dynamically
    stateNode = await prisma.state.findFirst();
    zoneNode = await prisma.zone.findFirst();
    parliamentNode = await prisma.parliament.findFirst();
    constituencyKondapi = await prisma.constituency.findFirst();
    mandalKondapi = await prisma.mandal.findFirst({ where: { constituencyId: constituencyKondapi?.id } });
    mandalZarugumalli = await prisma.mandal.findFirst({ where: { id: { not: mandalKondapi?.id } } });
    villageKondapi = await prisma.village.findFirst({ where: { mandalId: mandalKondapi?.id } });
    villageZarugumalli = await prisma.village.findFirst({ where: { mandalId: mandalZarugumalli?.id } });
    booth101 = await prisma.booth.findFirst({ where: { villageId: villageKondapi?.id } });
    booth102 = await prisma.booth.findFirst({ where: { id: { not: booth101?.id } } });
    voterGroup1 = await prisma.voterGroup.findFirst({ where: { boothId: booth101?.id } });
    voterGroup2 = await prisma.voterGroup.findFirst({ where: { id: { not: voterGroup1?.id } } });

    assert.ok(stateNode && constituencyKondapi && mandalKondapi && villageKondapi && booth101 && voterGroup1, 'Hierarchy nodes must exist');

    // 3. Create or Fetch Users for Every Role
    // A. SUPER_ADMIN
    userSuperAdmin = await prisma.user.upsert({
      where: { userCode: 'TEST-SUPER-ADMIN' },
      update: {},
      create: {
        userCode: 'TEST-SUPER-ADMIN',
        name: 'Super Admin User',
        mobileNumber: '9000000001',
        role: RoleType.SUPER_ADMIN,
        organisationId: orgA.id,
      },
    });

    // B. STATE_ADMIN
    userStateAdmin = await prisma.user.upsert({
      where: { userCode: 'TEST-STATE-ADMIN' },
      update: {},
      create: {
        userCode: 'TEST-STATE-ADMIN',
        name: 'State Admin User',
        mobileNumber: '9000000002',
        role: RoleType.STATE_ADMIN,
        organisationId: orgA.id,
      },
    });

    // C. CONSTITUENCY_INCHARGE
    userConstituencyIncharge = await prisma.user.upsert({
      where: { userCode: 'TEST-CONSTITUENCY-INC' },
      update: {},
      create: {
        userCode: 'TEST-CONSTITUENCY-INC',
        name: 'Constituency Incharge User',
        mobileNumber: '9000000003',
        role: RoleType.CONSTITUENCY_INCHARGE,
        organisationId: orgA.id,
      },
    });

    // D. MANDAL_INCHARGE
    userMandalIncharge = await prisma.user.upsert({
      where: { userCode: 'TEST-MANDAL-INC' },
      update: {},
      create: {
        userCode: 'TEST-MANDAL-INC',
        name: 'Mandal Incharge User',
        mobileNumber: '9000000004',
        role: RoleType.MANDAL_INCHARGE,
        organisationId: orgA.id,
      },
    });

    // E. VILLAGE_INCHARGE
    userVillageIncharge = await prisma.user.upsert({
      where: { userCode: 'TEST-VILLAGE-INC' },
      update: {},
      create: {
        userCode: 'TEST-VILLAGE-INC',
        name: 'Village Incharge User',
        mobileNumber: '9000000005',
        role: RoleType.VILLAGE_INCHARGE,
        organisationId: orgA.id,
      },
    });

    // F. BOOTH_INCHARGE / BOOTH_PRESIDENT
    userBoothIncharge = await prisma.user.upsert({
      where: { userCode: 'TEST-BOOTH-INC' },
      update: {},
      create: {
        userCode: 'TEST-BOOTH-INC',
        name: 'Booth Incharge User',
        mobileNumber: '9000000006',
        role: RoleType.BOOTH_PRESIDENT,
        organisationId: orgA.id,
      },
    });

    // G. VOTER_100_INCHARGE
    user100VoterIncharge = await prisma.user.upsert({
      where: { userCode: 'TEST-100-INC' },
      update: {},
      create: {
        userCode: 'TEST-100-INC',
        name: '100 Voter Incharge User',
        mobileNumber: '9000000007',
        role: RoleType.VOTER_100_INCHARGE,
        organisationId: orgA.id,
      },
    });

    // H. VIEWER
    userViewer = await prisma.user.upsert({
      where: { userCode: 'TEST-VIEWER' },
      update: {},
      create: {
        userCode: 'TEST-VIEWER',
        name: 'Observer / Viewer',
        mobileNumber: '9000000008',
        role: RoleType.VIEWER,
        organisationId: orgA.id,
      },
    });

    // I. User from External Organisation B
    userOrgB = await prisma.user.upsert({
      where: { userCode: 'TEST-ORGB-USER' },
      update: {},
      create: {
        userCode: 'TEST-ORGB-USER',
        name: 'External Org User',
        mobileNumber: '9000000009',
        role: RoleType.CONSTITUENCY_INCHARGE,
        organisationId: orgB.id,
      },
    });

    // Clean old assignments for test users
    await prisma.userHierarchyAssignment.deleteMany({
      where: {
        userId: {
          in: [
            userStateAdmin.id,
            userConstituencyIncharge.id,
            userMandalIncharge.id,
            userVillageIncharge.id,
            userBoothIncharge.id,
            user100VoterIncharge.id,
            userViewer.id,
          ],
        },
      },
    });

    // Create assignments
    await prisma.userHierarchyAssignment.create({
      data: {
        userId: userStateAdmin.id,
        roleType: RoleType.STATE_ADMIN,
        stateId: stateNode.id,
      },
    });
    tokenStateAdmin = generateToken({
      userId: userStateAdmin.id,
      userCode: userStateAdmin.userCode,
      mobileNumber: userStateAdmin.mobileNumber,
      role: RoleType.STATE_ADMIN,
      organisationId: orgA.id,
    });

    tokenSuperAdmin = generateToken({
      userId: userSuperAdmin.id,
      userCode: userSuperAdmin.userCode,
      mobileNumber: userSuperAdmin.mobileNumber,
      role: RoleType.SUPER_ADMIN,
      organisationId: orgA.id,
    });

    await prisma.userHierarchyAssignment.create({
      data: {
        userId: userConstituencyIncharge.id,
        roleType: RoleType.CONSTITUENCY_INCHARGE,
        constituencyId: constituencyKondapi.id,
      },
    });
    tokenConstituencyIncharge = generateToken({
      userId: userConstituencyIncharge.id,
      userCode: userConstituencyIncharge.userCode,
      mobileNumber: userConstituencyIncharge.mobileNumber,
      role: RoleType.CONSTITUENCY_INCHARGE,
      organisationId: orgA.id,
    });

    await prisma.userHierarchyAssignment.create({
      data: {
        userId: userMandalIncharge.id,
        roleType: RoleType.MANDAL_INCHARGE,
        mandalId: mandalKondapi.id,
      },
    });
    tokenMandalIncharge = generateToken({
      userId: userMandalIncharge.id,
      userCode: userMandalIncharge.userCode,
      mobileNumber: userMandalIncharge.mobileNumber,
      role: RoleType.MANDAL_INCHARGE,
      organisationId: orgA.id,
    });

    await prisma.userHierarchyAssignment.create({
      data: {
        userId: userVillageIncharge.id,
        roleType: RoleType.VILLAGE_INCHARGE,
        villageId: villageKondapi.id,
      },
    });
    tokenVillageIncharge = generateToken({
      userId: userVillageIncharge.id,
      userCode: userVillageIncharge.userCode,
      mobileNumber: userVillageIncharge.mobileNumber,
      role: RoleType.VILLAGE_INCHARGE,
      organisationId: orgA.id,
    });

    await prisma.userHierarchyAssignment.create({
      data: {
        userId: userBoothIncharge.id,
        roleType: RoleType.BOOTH_PRESIDENT,
        boothId: booth101.id,
      },
    });
    tokenBoothIncharge = generateToken({
      userId: userBoothIncharge.id,
      userCode: userBoothIncharge.userCode,
      mobileNumber: userBoothIncharge.mobileNumber,
      role: RoleType.BOOTH_PRESIDENT,
      organisationId: orgA.id,
    });

    await prisma.userHierarchyAssignment.create({
      data: {
        userId: user100VoterIncharge.id,
        roleType: RoleType.VOTER_100_INCHARGE,
        voterGroupId: voterGroup1.id,
        boothId: booth101.id,
      },
    });
    token100VoterIncharge = generateToken({
      userId: user100VoterIncharge.id,
      userCode: user100VoterIncharge.userCode,
      mobileNumber: user100VoterIncharge.mobileNumber,
      role: RoleType.VOTER_100_INCHARGE,
      organisationId: orgA.id,
    });

    await prisma.userHierarchyAssignment.create({
      data: {
        userId: userViewer.id,
        roleType: RoleType.VIEWER,
        constituencyId: constituencyKondapi.id,
      },
    });
    tokenViewer = generateToken({
      userId: userViewer.id,
      userCode: userViewer.userCode,
      mobileNumber: userViewer.mobileNumber,
      role: RoleType.VIEWER,
      organisationId: orgA.id,
    });

    tokenOrgB = generateToken({
      userId: userOrgB.id,
      userCode: userOrgB.userCode,
      mobileNumber: userOrgB.mobileNumber,
      role: RoleType.CONSTITUENCY_INCHARGE,
      organisationId: orgB.id,
    });

    // Fetch or create sample test voters
    voterCluster1 = await prisma.voter.findFirst({
      where: { voterGroupId: voterGroup1.id },
    });
    if (!voterCluster1) {
      voterCluster1 = await prisma.voter.create({
        data: {
          name: 'Cluster 1 Test Voter',
          fatherHusbandName: 'Father Name',
          epicNumber: 'TEST-VG1-001',
          serialNumber: 1,
          gender: 'MALE',
          age: 35,
          houseNumber: '1-10',
          voterGroupId: voterGroup1.id,
          boothId: booth101.id,
          villageId: villageKondapi.id,
          mandalId: mandalKondapi.id,
          constituencyId: constituencyKondapi.id,
          assignedInchargeId: user100VoterIncharge.id,
        },
      });
    }

    voterCluster2 = await prisma.voter.findFirst({
      where: { voterGroupId: voterGroup2.id },
    });
    if (!voterCluster2) {
      voterCluster2 = await prisma.voter.create({
        data: {
          name: 'Cluster 2 Test Voter',
          fatherHusbandName: 'Father Name',
          epicNumber: 'TEST-VG2-002',
          serialNumber: 2,
          gender: 'FEMALE',
          age: 32,
          houseNumber: '1-12',
          voterGroupId: voterGroup2.id,
          boothId: booth102.id,
          villageId: villageKondapi.id,
          mandalId: mandalKondapi.id,
          constituencyId: constituencyKondapi.id,
        },
      });
    }

    voterInOtherMandal = await prisma.voter.findFirst({
      where: { mandalId: mandalZarugumalli?.id },
    });
    if (!voterInOtherMandal && mandalZarugumalli) {
      voterInOtherMandal = await prisma.voter.create({
        data: {
          name: 'Other Mandal Test Voter',
          fatherHusbandName: 'Father Name',
          epicNumber: 'TEST-OTHER-003',
          serialNumber: 3,
          gender: 'MALE',
          age: 40,
          houseNumber: '2-15',
          mandalId: mandalZarugumalli.id,
          villageId: villageZarugumalli?.id,
          constituencyId: constituencyKondapi.id,
        },
      });
    }

    assert.ok(voterCluster1 && voterCluster2 && voterInOtherMandal, 'Voters across clusters must exist');
  });

  // --------------------------------------------------------------------------
  // 1. SUPER_ADMIN TESTS
  // --------------------------------------------------------------------------
  it('1. SUPER_ADMIN can access CMS, manage organisations, and view cross-constituency data', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/organisations',
      headers: { Authorization: `Bearer ${tokenSuperAdmin}` },
    });
    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.ok(json.data.length >= 2);
  });

  // --------------------------------------------------------------------------
  // 2. CONSTITUENCY_INCHARGE TESTS
  // --------------------------------------------------------------------------
  it('2. CONSTITUENCY_INCHARGE can access voters in own constituency but is rejected from modifying external CMS', async () => {
    // List voters in own AC (succeeds)
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/voters',
      headers: { Authorization: `Bearer ${tokenConstituencyIncharge}` },
    });
    assert.equal(listRes.statusCode, 200);

    // Attempt to modify CMS organisation (rejected 403)
    const cmsRes = await app.inject({
      method: 'PUT',
      url: '/api/cms/organisation',
      headers: { Authorization: `Bearer ${tokenConstituencyIncharge}` },
      payload: { name: 'Hacked Org Name', code: 'HACK' },
    });
    assert.equal(cmsRes.statusCode, 403);
  });

  // --------------------------------------------------------------------------
  // 3. MANDAL_INCHARGE TESTS & HORIZONTAL ESCALATION PREVENTION
  // --------------------------------------------------------------------------
  it('3. MANDAL_INCHARGE can access own mandal voters, but is blocked from neighboring mandal (Horizontal Escalation)', async () => {
    // Access voter in own mandal (succeeds)
    const ownRes = await app.inject({
      method: 'GET',
      url: `/api/voters/${voterCluster1.id}`,
      headers: { Authorization: `Bearer ${tokenMandalIncharge}` },
    });
    assert.equal(ownRes.statusCode, 200);

    // Access voter in other mandal (blocked 403)
    const otherRes = await app.inject({
      method: 'GET',
      url: `/api/voters/${voterInOtherMandal.id}`,
      headers: { Authorization: `Bearer ${tokenMandalIncharge}` },
    });
    assert.equal(otherRes.statusCode, 403);
    const json = JSON.parse(otherRes.body);
    assert.equal(json.error.code, 'FORBIDDEN_VOTER_SCOPE');
  });

  // --------------------------------------------------------------------------
  // 4. VILLAGE_INCHARGE TESTS
  // --------------------------------------------------------------------------
  it('4. VILLAGE_INCHARGE can access own village voters but is blocked from other villages', async () => {
    const ownRes = await app.inject({
      method: 'GET',
      url: `/api/voters/${voterCluster1.id}`,
      headers: { Authorization: `Bearer ${tokenVillageIncharge}` },
    });
    assert.equal(ownRes.statusCode, 200);

    const otherRes = await app.inject({
      method: 'GET',
      url: `/api/voters/${voterInOtherMandal.id}`,
      headers: { Authorization: `Bearer ${tokenVillageIncharge}` },
    });
    assert.equal(otherRes.statusCode, 403);
  });

  // --------------------------------------------------------------------------
  // 5. BOOTH_INCHARGE TESTS
  // --------------------------------------------------------------------------
  it('5. BOOTH_INCHARGE can access voters in own booth and all child voter groups', async () => {
    // Voter in Booth 101 Group 1 (succeeds)
    const res1 = await app.inject({
      method: 'GET',
      url: `/api/voters/${voterCluster1.id}`,
      headers: { Authorization: `Bearer ${tokenBoothIncharge}` },
    });
    assert.equal(res1.statusCode, 200);

    // Voter in Booth 101 Group 2 (succeeds)
    const res2 = await app.inject({
      method: 'GET',
      url: `/api/voters/${voterCluster2.id}`,
      headers: { Authorization: `Bearer ${tokenBoothIncharge}` },
    });
    assert.equal(res2.statusCode, 200);
  });

  // --------------------------------------------------------------------------
  // 6. 100-VOTER IN-CHARGE TESTS
  // --------------------------------------------------------------------------
  it('6A. 100-VOTER IN-CHARGE can only access assigned voter cluster (blocked on Cluster 2)', async () => {
    // Assigned Cluster 1 (succeeds)
    const res1 = await app.inject({
      method: 'GET',
      url: `/api/voters/${voterCluster1.id}`,
      headers: { Authorization: `Bearer ${token100VoterIncharge}` },
    });
    assert.equal(res1.statusCode, 200);

    // Unassigned Cluster 2 (blocked 403)
    const res2 = await app.inject({
      method: 'GET',
      url: `/api/voters/${voterCluster2.id}`,
      headers: { Authorization: `Bearer ${token100VoterIncharge}` },
    });
    assert.equal(res2.statusCode, 403);
    const json = JSON.parse(res2.body);
    assert.equal(json.error.code, 'FORBIDDEN_VOTER_SCOPE');
  });

  it('6B. 100-VOTER IN-CHARGE can update permitted survey & location fields', async () => {
    const updateRes = await app.inject({
      method: 'PATCH',
      url: `/api/voters/${voterCluster1.id}`,
      headers: { Authorization: `Bearer ${token100VoterIncharge}` },
      payload: {
        politicalPreference: 'TDP',
        surveyStatus: 'SURVEYED',
        notes: 'Verified TDP supporter during door-to-door survey',
      },
    });
    assert.equal(updateRes.statusCode, 200, `Expected 200, got ${updateRes.statusCode}: ${updateRes.body}`);
  });

  it('6C. 100-VOTER IN-CHARGE is blocked from modifying immutable electoral identity fields', async () => {
    const forbiddenRes = await app.inject({
      method: 'PATCH',
      url: `/api/voters/${voterCluster1.id}`,
      headers: { Authorization: `Bearer ${token100VoterIncharge}` },
      payload: {
        name: 'Malicious Modified Name',
        epicNumber: 'HACK999999',
      },
    });
    assert.equal(forbiddenRes.statusCode, 403);
    const json = JSON.parse(forbiddenRes.body);
    assert.equal(json.error.code, 'FORBIDDEN_FIELD_MUTATION');
  });

  it('6D. 100-VOTER IN-CHARGE can flag fake voter, update migration, and mark vote done', async () => {
    // 1. Mark Vote Done
    const voteRes = await app.inject({
      method: 'POST',
      url: `/api/voters/${voterCluster1.id}/mark-vote-done`,
      headers: { Authorization: `Bearer ${token100VoterIncharge}` },
    });
    assert.equal(voteRes.statusCode, 200);

    // 2. Update Migration
    const migRes = await app.inject({
      method: 'PATCH',
      url: `/api/voters/${voterCluster1.id}/migration`,
      headers: { Authorization: `Bearer ${token100VoterIncharge}` },
      payload: {
        status: 'MIGRATED',
        destinationCity: 'Hyderabad',
        destinationState: 'Telangana',
        travelRequired: true,
      },
    });
    assert.equal(migRes.statusCode, 200, `Expected 200, got ${migRes.statusCode}: ${migRes.body}`);

    // 3. Flag Fake Voter
    const flagRes = await app.inject({
      method: 'POST',
      url: `/api/voters/${voterCluster1.id}/flag-fake`,
      headers: { Authorization: `Bearer ${token100VoterIncharge}` },
      payload: {
        reason: 'DOOR_LOCKED_MOVED',
      },
    });
    assert.equal(flagRes.statusCode, 201, `Expected 201, got ${flagRes.statusCode}: ${flagRes.body}`);
  });

  // --------------------------------------------------------------------------
  // 7. VIEWER ROLE TESTS
  // --------------------------------------------------------------------------
  it('7. VIEWER can read within scope, but is blocked from mutating records', async () => {
    // Read (succeeds)
    const readRes = await app.inject({
      method: 'GET',
      url: `/api/voters/${voterCluster1.id}`,
      headers: { Authorization: `Bearer ${tokenViewer}` },
    });
    assert.equal(readRes.statusCode, 200);

    // Create Voter (blocked 403)
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/voters',
      headers: { Authorization: `Bearer ${tokenViewer}` },
      payload: {
        name: 'Unauthorized Voter',
        epicNumber: 'NEW1234567',
        fatherHusbandName: 'Father Name',
        houseNumber: '1-10',
        gender: 'MALE',
        age: 30,
        constituencyId: constituencyKondapi.id,
      },
    });
    assert.equal(createRes.statusCode, 403);
    const json = JSON.parse(createRes.body);
    assert.equal(json.error.code, 'FORBIDDEN_ROLE');
  });

  // --------------------------------------------------------------------------
  // 8. VERTICAL PRIVILEGE ESCALATION PREVENTION
  // --------------------------------------------------------------------------
  it('8. Non-superadmin cannot create or elevate a user to a higher role rank (Vertical Escalation)', async () => {
    // Mandal Incharge attempts to create a State Admin or Super Admin
    const escalateRes = await app.inject({
      method: 'POST',
      url: '/api/users',
      headers: { Authorization: `Bearer ${tokenConstituencyIncharge}` },
      payload: {
        userCode: 'ILLEGAL-ADMIN',
        name: 'Illegal Admin',
        mobileNumber: '9111111111',
        role: RoleType.SUPER_ADMIN, // higher rank than CONSTITUENCY_INCHARGE
      },
    });
    assert.equal(escalateRes.statusCode, 403);
    const json = JSON.parse(escalateRes.body);
    assert.equal(json.error.code, 'VERTICAL_PRIVILEGE_VIOLATION');
  });

  // --------------------------------------------------------------------------
  // 9. CROSS-ORGANISATION ISOLATION
  // --------------------------------------------------------------------------
  it('9. User from Organisation B cannot manage or modify users from Organisation A (Multi-Tenancy Guard)', async () => {
    const crossOrgRes = await app.inject({
      method: 'PATCH',
      url: `/api/users/${userConstituencyIncharge.id}`,
      headers: { Authorization: `Bearer ${tokenOrgB}` },
      payload: {
        name: 'Cross Org Hijacked Name',
      },
    });
    assert.equal(crossOrgRes.statusCode, 403);
    const json = JSON.parse(crossOrgRes.body);
    assert.equal(json.error.code, 'CROSS_ORG_ACCESS_FORBIDDEN');
  });
});
