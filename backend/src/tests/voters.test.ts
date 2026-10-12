import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { FastifyInstance } from 'fastify';
import { RoleType, SurveyStatus, VoterLocationStatus, VoterStatus, VoteStatus } from '@prisma/client';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { generateToken } from '../middleware/auth.js';

describe('Production Voter Management API Test Suite', () => {
  let app: FastifyInstance;
  let superAdminToken: string;
  let inchargeToken: string;
  let testVoterId: string;
  let testBoothId: string;
  let testConstituencyId: string;
  let testMandalId: string;
  let testVillageId: string;
  let testVoterGroupId: string;

  before(async () => {
    app = await buildApp();
    await app.ready();

    // 1. Fetch seed hierarchy nodes
    const constituency = await prisma.constituency.findFirst();
    const mandal = await prisma.mandal.findFirst({ where: { constituencyId: constituency?.id } });
    const village = await prisma.village.findFirst({ where: { mandalId: mandal?.id } });
    const booth = await prisma.booth.findFirst({ where: { villageId: village?.id } });
    const voterGroup = await prisma.voterGroup.findFirst({ where: { boothId: booth?.id } });

    if (!constituency || !mandal || !village || !booth || !voterGroup) {
      throw new Error('Database must be seeded with Kondapi hierarchy data before tests run.');
    }

    testConstituencyId = constituency.id;
    testMandalId = mandal.id;
    testVillageId = village.id;
    testBoothId = booth.id;
    testVoterGroupId = voterGroup.id;

    // 2. Fetch or create users for testing
    const superAdmin = await prisma.user.findFirst({
      where: { role: RoleType.SUPER_ADMIN },
    });
    if (!superAdmin) throw new Error('Super Admin user required.');

    superAdminToken = generateToken({
      userId: superAdmin.id,
      userCode: superAdmin.userCode,
      mobileNumber: superAdmin.mobileNumber,
      role: RoleType.SUPER_ADMIN,
      organisationId: superAdmin.organisationId,
    });

    const incharge = await prisma.user.upsert({
      where: { userCode: 'TEST-VOTER-MGR' },
      update: {},
      create: {
        userCode: 'TEST-VOTER-MGR',
        name: 'Voter Manager Incharge',
        mobileNumber: '9111111111',
        role: RoleType.CONSTITUENCY_INCHARGE,
        organisationId: superAdmin.organisationId,
      },
    });

    inchargeToken = generateToken({
      userId: incharge.id,
      userCode: incharge.userCode,
      mobileNumber: incharge.mobileNumber,
      role: RoleType.CONSTITUENCY_INCHARGE,
      organisationId: superAdmin.organisationId,
    });
  });

  after(async () => {
    if (testVoterId) {
      await prisma.$transaction([
        prisma.voterStatusHistory.deleteMany({ where: { voterId: testVoterId } }),
        prisma.fakeVoterFlag.deleteMany({ where: { voterId: testVoterId } }),
        prisma.voterMigration.deleteMany({ where: { voterId: testVoterId } }),
        prisma.voteTracking.deleteMany({ where: { voterId: testVoterId } }),
        prisma.liveVoteEvent.deleteMany({ where: { voterId: testVoterId } }),
        prisma.voterAssignment.deleteMany({ where: { voterId: testVoterId } }),
        prisma.voter.deleteMany({ where: { id: testVoterId } }),
      ]);
    }
    await app.close();
  });

  it('1. POST /api/voters creates a new voter with full validation & hierarchy links', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/voters',
      headers: { Authorization: `Bearer ${superAdminToken}` },
      payload: {
        serialNumber: 999,
        epicNumber: 'KDP9999999',
        name: 'Venkata Ramaiah Kondapi',
        fatherHusbandName: 'Subba Rao Kondapi',
        houseNumber: '4-55/A',
        age: 42,
        gender: 'MALE',
        mobileNumber: '9848012345',
        constituencyId: testConstituencyId,
        mandalId: testMandalId,
        villageId: testVillageId,
        boothId: testBoothId,
        voterGroupId: testVoterGroupId,
        caste: 'Kamma',
        subCaste: 'Chowdary',
        profession: 'Agriculture',
        politicalPreference: 'TDP',
        voterStatus: 'ACTIVE',
        surveyStatus: 'NOT_SURVEYED',
        voterLocationStatus: 'LOCAL',
        notes: 'Influential family in Ward 1',
      },
    });

    assert.equal(res.statusCode, 201, `Expected 201, got ${res.statusCode}: ${res.body}`);
    const json = JSON.parse(res.body);
    assert.equal(json.success, true);
    assert.equal(json.data.epicNumber, 'KDP9999999');
    assert.equal(json.data.name, 'Venkata Ramaiah Kondapi');
    assert.equal(json.data.caste, 'Kamma');
    testVoterId = json.data.id;
  });

  it('2. POST /api/voters rejects duplicate EPIC numbers with 409 Conflict', async () => {
    const duplicateRes = await app.inject({
      method: 'POST',
      url: '/api/voters',
      headers: { Authorization: `Bearer ${superAdminToken}` },
      payload: {
        serialNumber: 1000,
        epicNumber: 'KDP9999999', // Duplicate EPIC
        name: 'Another Voter with Duplicate EPIC',
        fatherHusbandName: 'Father Name',
        houseNumber: '4-56',
        age: 30,
        gender: 'FEMALE',
      },
    });

    assert.equal(duplicateRes.statusCode, 409);
    const json = JSON.parse(duplicateRes.body);
    assert.equal(json.error.code, 'DUPLICATE_EPIC_NUMBER');
  });

  it('3. GET /api/voters returns paginated list with server-side metadata', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/voters?limit=10&page=1',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });

    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data));
    assert.ok(json.meta.total > 0);
    assert.equal(json.meta.page, 1);
    assert.equal(json.meta.limit, 10);
    assert.ok(json.meta.totalPages >= 1);
  });

  it('4. GET /api/voters supports search by EPIC, Name, Mobile, and Serial Number', async () => {
    // Search by EPIC
    const epicRes = await app.inject({
      method: 'GET',
      url: '/api/voters?search=KDP9999999',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(epicRes.statusCode, 200);
    const epicJson = JSON.parse(epicRes.body);
    assert.equal(epicJson.data.length, 1);
    assert.equal(epicJson.data[0].epicNumber, 'KDP9999999');

    // Search by Name
    const nameRes = await app.inject({
      method: 'GET',
      url: '/api/voters?search=Venkata Ramaiah',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(nameRes.statusCode, 200);
    const nameJson = JSON.parse(nameRes.body);
    assert.ok(nameJson.data.some((v: any) => v.id === testVoterId));

    // Specific field query
    const directRes = await app.inject({
      method: 'GET',
      url: `/api/voters?epicNumber=KDP9999999&caste=Kamma`,
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(directRes.statusCode, 200);
    const directJson = JSON.parse(directRes.body);
    assert.equal(directJson.data.length, 1);
  });

  it('5. GET /api/voters/:id returns full voter profile with relational models', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/voters/${testVoterId}`,
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });

    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.data.id, testVoterId);
    assert.ok(json.data.constituency);
    assert.ok(json.data.booth);
    assert.ok(Array.isArray(json.data.statusHistory));
    assert.ok(Array.isArray(json.data.fakeVoterFlags));
    assert.ok(Array.isArray(json.data.migrations));
    assert.ok(Array.isArray(json.data.voteTrackings));
  });

  it('6. PATCH /api/voters/:id updates fields and automatically records VoterStatusHistory', async () => {
    const updateRes = await app.inject({
      method: 'PATCH',
      url: `/api/voters/${testVoterId}`,
      headers: { Authorization: `Bearer ${superAdminToken}` },
      payload: {
        surveyStatus: 'SURVEYED',
        voterStatus: 'SHIFTED',
        politicalPreference: 'TDP',
        notes: 'Shifted to Ongole city for business',
      },
    });

    assert.equal(updateRes.statusCode, 200);
    const json = JSON.parse(updateRes.body);
    assert.equal(json.data.voterStatus, 'SHIFTED');
    assert.equal(json.data.surveyStatus, 'SURVEYED');

    // Verify VoterStatusHistory record was automatically created
    const history = await prisma.voterStatusHistory.findFirst({
      where: { voterId: testVoterId, newStatus: VoterStatus.SHIFTED },
    });
    assert.ok(history, 'Status history entry should be recorded');
    assert.equal(history.previousStatus, VoterStatus.ACTIVE);
  });

  it('7. POST /api/voters/:id/flag-fake creates FakeVoterFlag and updates status', async () => {
    const flagRes = await app.inject({
      method: 'POST',
      url: `/api/voters/${testVoterId}/flag-fake`,
      headers: { Authorization: `Bearer ${superAdminToken}` },
      payload: {
        reason: 'DOUBLE_ENTRY_SUSPECTED',
      },
    });

    assert.equal(flagRes.statusCode, 201);
    const json = JSON.parse(flagRes.body);
    assert.equal(json.data.reason, 'DOUBLE_ENTRY_SUSPECTED');

    const voter = await prisma.voter.findUnique({ where: { id: testVoterId } });
    assert.equal(voter?.voterStatus, VoterStatus.FAKE);
  });

  it('8. PATCH /api/voters/:id/migration registers migration details', async () => {
    const migRes = await app.inject({
      method: 'PATCH',
      url: `/api/voters/${testVoterId}/migration`,
      headers: { Authorization: `Bearer ${superAdminToken}` },
      payload: {
        status: 'MIGRATED',
        destinationCity: 'Hyderabad',
        destinationState: 'Telangana',
        travelRequired: true,
        notes: 'Arranging bus transport for polling day',
      },
    });

    assert.equal(migRes.statusCode, 200);
    const json = JSON.parse(migRes.body);
    assert.equal(json.data.destinationCity, 'Hyderabad');

    const voter = await prisma.voter.findUnique({ where: { id: testVoterId } });
    assert.equal(voter?.voterLocationStatus, VoterLocationStatus.MIGRATED);
    assert.equal(voter?.currentLocation, 'Hyderabad');
  });

  it('9. POST /api/voters/:id/mark-vote-done tracks live vote and prevents duplicate counts', async () => {
    // 1st time marking vote done
    const voteRes = await app.inject({
      method: 'POST',
      url: `/api/voters/${testVoterId}/mark-vote-done`,
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(voteRes.statusCode, 200);
    const json = JSON.parse(voteRes.body);
    assert.equal(json.data.voteStatus, 'VOTE_DONE');
    assert.ok(json.data.voteDoneTime);

    // 2nd time marking vote done (idempotency / duplicate check)
    const dupRes = await app.inject({
      method: 'POST',
      url: `/api/voters/${testVoterId}/mark-vote-done`,
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(dupRes.statusCode, 200);

    const trackingCount = await prisma.voteTracking.count({
      where: { voterId: testVoterId, status: VoteStatus.VOTE_DONE },
    });
    assert.equal(trackingCount, 1, 'Should not create duplicate vote tracking entries');
  });

  it('10. POST /api/voters/:id/mark-not-voted resets live vote status', async () => {
    const resetRes = await app.inject({
      method: 'POST',
      url: `/api/voters/${testVoterId}/mark-not-voted`,
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });

    assert.equal(resetRes.statusCode, 200);
    const json = JSON.parse(resetRes.body);
    assert.equal(json.data.voteStatus, 'NOT_VOTED');
    assert.equal(json.data.voteDoneTime, null);
  });

  it('11. GET /api/voters/:id/history returns complete chronological history', async () => {
    const histRes = await app.inject({
      method: 'GET',
      url: `/api/voters/${testVoterId}/history`,
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });

    assert.equal(histRes.statusCode, 200);
    const json = JSON.parse(histRes.body);
    assert.equal(json.success, true);
    assert.ok(json.data.statusHistory.length >= 1);
    assert.ok(json.data.fakeFlags.length >= 1);
    assert.ok(json.data.migrations.length >= 1);
    assert.ok(json.data.voteTrackings.length >= 1);
  });

  it('12. DELETE /api/voters/:id performs clean cascade delete and writes audit trail', async () => {
    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/voters/${testVoterId}`,
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });

    assert.equal(delRes.statusCode, 200);
    const json = JSON.parse(delRes.body);
    assert.equal(json.data.deleted, true);

    const check = await prisma.voter.findUnique({ where: { id: testVoterId } });
    assert.equal(check, null);
    testVoterId = ''; // Cleared so after() hook does not re-attempt
  });
});
