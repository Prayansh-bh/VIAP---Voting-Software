process.env.NODE_ENV = 'test';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { RoleType } from '@prisma/client';
import { TokenService } from '../modules/auth/services/token.service.js';
import { PollsService } from '../modules/polls/polls.service.js';
import { VotersService } from '../modules/voters/voters.service.js';
import { ApplicationsService } from '../modules/applications/applications.service.js';

describe('P0 Security Hardening - Batch 2 Tenant Isolation Controls', () => {
  let app: any;
  let tenantAOrg: any;
  let tenantBOrg: any;
  let partyA: any;
  let partyB: any;
  let tenantAUser: any;
  let tenantBUser: any;
  let superAdminUser: any;
  let tokenTenantA: string;
  let tokenTenantB: string;
  let tokenSuperAdmin: string;
  let pollTenantA: any;
  let pollOptionA1: any;
  let pollOptionA2: any;
  let expiredPollA: any;
  let expiredOptionA1: any;
  let cadreUserA: any;
  let cadreRecordA: any;

  async function issueValidToken(user: any) {
    const payload = {
      userId: user.id,
      userCode: user.userCode,
      mobileNumber: user.mobileNumber,
      role: user.role,
      organisationId: user.organisationId,
    };
    const { token, sessionId } = TokenService.generateTokens(payload);
    await TokenService.recordLoginSession(user.id, user.mobileNumber, token, sessionId);
    return token;
  }

  before(async () => {
    app = buildApp();
    await app.ready();

    // 1. Create Tenant A and Tenant B isolated test organizations
    tenantAOrg = await prisma.organisation.create({
      data: {
        name: `P0-Test-Org-A-${Date.now()}`,
        code: `TESTA-${Date.now().toString().slice(-4)}`,
        isActive: true,
      },
    });

    tenantBOrg = await prisma.organisation.create({
      data: {
        name: `P0-Test-Org-B-${Date.now()}`,
        code: `TESTB-${Date.now().toString().slice(-4)}`,
        isActive: true,
      },
    });

    // 2. Create Active Political Parties attached to both organizations
    partyA = await prisma.politicalParty.create({
      data: {
        code: `TPA-${Date.now().toString().slice(-4)}`,
        name: 'Tenant Party A',
        shortName: 'TPA',
        organisationId: tenantAOrg.id,
        isActive: true,
      },
    });

    partyB = await prisma.politicalParty.create({
      data: {
        code: `TPB-${Date.now().toString().slice(-4)}`,
        name: 'Tenant Party B',
        shortName: 'TPB',
        organisationId: tenantBOrg.id,
        isActive: true,
      },
    });

    // 3. Create State for Tenant A and Tenant B (links voters to org)
    const stateA = await prisma.state.create({
      data: {
        name: `State A ${Date.now()}`,
        code: `STA-${Date.now().toString().slice(-4)}`,
        organisationId: tenantAOrg.id,
      },
    });

    const stateB = await prisma.state.create({
      data: {
        name: `State B ${Date.now()}`,
        code: `STB-${Date.now().toString().slice(-4)}`,
        organisationId: tenantBOrg.id,
      },
    });

    // 4. Create CMS Configurations for both tenants
    await prisma.cMSConfiguration.create({
      data: {
        organisationId: tenantAOrg.id,
        organisationName: tenantAOrg.name,
        stateName: 'State A',
        configKey: `cfg-${tenantAOrg.id}`,
        activePartyCode: partyA.code,
        hierarchyLabels: {},
        featureToggles: {},
      },
    });

    await prisma.cMSConfiguration.create({
      data: {
        organisationId: tenantBOrg.id,
        organisationName: tenantBOrg.name,
        stateName: 'State B',
        configKey: `cfg-${tenantBOrg.id}`,
        activePartyCode: partyB.code,
        hierarchyLabels: {},
        featureToggles: {},
      },
    });

    // 5. Create Users for Tenant A, Tenant B, SuperAdmin
    tenantAUser = await prisma.user.create({
      data: {
        organisationId: tenantAOrg.id,
        userCode: `USR-A-${Date.now().toString().slice(-4)}`,
        name: 'Leader Tenant A',
        mobileNumber: `+9199000${Math.floor(10000 + Math.random() * 90000)}`,
        role: RoleType.CONSTITUENCY_INCHARGE,
        accountStatus: 'ACTIVE',
      },
    });

    tenantBUser = await prisma.user.create({
      data: {
        organisationId: tenantBOrg.id,
        userCode: `USR-B-${Date.now().toString().slice(-4)}`,
        name: 'Leader Tenant B',
        mobileNumber: `+9199001${Math.floor(10000 + Math.random() * 90000)}`,
        role: RoleType.CONSTITUENCY_INCHARGE,
        accountStatus: 'ACTIVE',
      },
    });

    superAdminUser = await prisma.user.findFirst({
      where: { role: RoleType.SUPER_ADMIN, accountStatus: 'ACTIVE' },
    });
    if (!superAdminUser) {
      superAdminUser = await prisma.user.create({
        data: {
          userCode: `SUP-${Date.now().toString().slice(-4)}`,
          name: 'P0 SuperAdmin',
          mobileNumber: `+9199002${Math.floor(10000 + Math.random() * 90000)}`,
          role: RoleType.SUPER_ADMIN,
          accountStatus: 'ACTIVE',
        },
      });
    }

    tokenTenantA = await issueValidToken(tenantAUser);
    tokenTenantB = await issueValidToken(tenantBUser);
    tokenSuperAdmin = await issueValidToken(superAdminUser);

    // 6. Create Polls in Tenant A
    pollTenantA = await prisma.poll.create({
      data: {
        title: 'Active Poll Tenant A',
        createdById: tenantAUser.id,
        status: 'PUBLISHED',
        options: {
          create: [
            { label: 'Option Alpha', order: 1 },
            { label: 'Option Beta', order: 2 },
          ],
        },
      },
      include: { options: true },
    });
    pollOptionA1 = pollTenantA.options[0];
    pollOptionA2 = pollTenantA.options[1];

    expiredPollA = await prisma.poll.create({
      data: {
        title: 'Expired Poll Tenant A',
        createdById: tenantAUser.id,
        status: 'PUBLISHED',
        expiresAt: new Date(Date.now() - 3600000), // Expired 1 hour ago
        options: {
          create: [{ label: 'Expired Option', order: 1 }],
        },
      },
      include: { options: true },
    });
    expiredOptionA1 = expiredPollA.options[0];

    // 7. Create Cadre record for Tenant A user
    cadreUserA = await prisma.user.create({
      data: {
        organisationId: tenantAOrg.id,
        userCode: `CAD-A-${Date.now().toString().slice(-4)}`,
        name: 'Cadre Worker A',
        mobileNumber: `+9199003${Math.floor(10000 + Math.random() * 90000)}`,
        role: RoleType.BOOTH_PRESIDENT,
        accountStatus: 'ACTIVE',
      },
    });

    cadreRecordA = await prisma.cadre.create({
      data: {
        userId: cadreUserA.id,
        skills: ['Door to Door'],
        badges: ['Bronze'],
        performanceScore: 75.0,
      },
    });

    // 8. Create sample voters for Tenant A and Tenant B
    await prisma.voter.create({
      data: {
        serialNumber: 101,
        epicNumber: `EPICA${Date.now()}`,
        name: 'Voter Alpha from Tenant A',
        fatherHusbandName: 'Father Alpha',
        houseNumber: '1-100',
        age: 30,
        stateId: stateA.id,
      },
    });

    await prisma.voter.create({
      data: {
        serialNumber: 201,
        epicNumber: `EPICB${Date.now()}`,
        name: 'Voter Beta from Tenant B',
        fatherHusbandName: 'Father Beta',
        houseNumber: '2-200',
        age: 35,
        stateId: stateB.id,
      },
    });
  });

  after(async () => {
    try {
      if (pollTenantA?.id) {
        await prisma.pollVote.deleteMany({ where: { pollId: pollTenantA.id } });
        await prisma.pollOption.deleteMany({ where: { pollId: pollTenantA.id } });
        await prisma.poll.delete({ where: { id: pollTenantA.id } });
      }
      if (expiredPollA?.id) {
        await prisma.pollOption.deleteMany({ where: { pollId: expiredPollA.id } });
        await prisma.poll.delete({ where: { id: expiredPollA.id } });
      }
      if (cadreRecordA?.id) {
        await prisma.cadre.delete({ where: { id: cadreRecordA.id } });
      }
      if (cadreUserA?.id) await prisma.user.delete({ where: { id: cadreUserA.id } });
      if (tenantAUser?.id) await prisma.user.delete({ where: { id: tenantAUser.id } });
      if (tenantBUser?.id) await prisma.user.delete({ where: { id: tenantBUser.id } });
      if (tenantAOrg?.id) {
        await prisma.voter.deleteMany({ where: { state: { organisationId: tenantAOrg.id } } });
        await prisma.state.deleteMany({ where: { organisationId: tenantAOrg.id } });
        await prisma.cMSConfiguration.deleteMany({ where: { organisationId: tenantAOrg.id } });
        await prisma.politicalParty.deleteMany({ where: { organisationId: tenantAOrg.id } });
        await prisma.organisation.delete({ where: { id: tenantAOrg.id } });
      }
      if (tenantBOrg?.id) {
        await prisma.voter.deleteMany({ where: { state: { organisationId: tenantBOrg.id } } });
        await prisma.state.deleteMany({ where: { organisationId: tenantBOrg.id } });
        await prisma.cMSConfiguration.deleteMany({ where: { organisationId: tenantBOrg.id } });
        await prisma.politicalParty.deleteMany({ where: { organisationId: tenantBOrg.id } });
        await prisma.organisation.delete({ where: { id: tenantBOrg.id } });
      }
    } catch (e) {
      // Ignore cleanup error
    }
    await app.close();
  });

  // --------------------------------------------------------------------------
  // C. POLL LISTING AND VOTING TESTS
  // --------------------------------------------------------------------------
  it('C1. Tenant A user can view Tenant A polls, but Tenant B user cannot view Tenant A polls', async () => {
    // Tenant A view
    const resA = await app.inject({
      method: 'GET',
      url: '/api/polls',
      headers: { authorization: `Bearer ${tokenTenantA}` },
    });
    assert.equal(resA.statusCode, 200);
    const jsonA = JSON.parse(resA.body);
    assert.ok(jsonA.data.some((p: any) => p.id === pollTenantA.id));

    // Tenant B view
    const resB = await app.inject({
      method: 'GET',
      url: '/api/polls',
      headers: { authorization: `Bearer ${tokenTenantB}` },
    });
    assert.equal(resB.statusCode, 200);
    const jsonB = JSON.parse(resB.body);
    assert.equal(jsonB.data.some((p: any) => p.id === pollTenantA.id), false, 'Tenant B must NOT see Tenant A polls');
  });

  it('C2. User missing tenant context fails closed on poll listing service query', async () => {
    const unauthenticatedUserPayload: any = {
      userId: 'test-user-no-tenant',
      userCode: 'TST',
      mobileNumber: '9999999999',
      role: RoleType.CONSTITUENCY_INCHARGE,
      organisationId: null,
    };
    const polls = await PollsService.listPolls(unauthenticatedUserPayload);
    assert.deepEqual(polls, [], 'User without tenant context must receive empty array');
  });

  it('C3. SuperAdmin can view polls across organizations', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/polls',
      headers: { authorization: `Bearer ${tokenSuperAdmin}` },
    });
    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.ok(json.data.some((p: any) => p.id === pollTenantA.id));
  });

  it('C4. Tenant A user votes successfully on Tenant A poll', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/polls/${pollTenantA.id}/vote`,
      headers: { authorization: `Bearer ${tokenTenantA}` },
      payload: { optionId: pollOptionA1.id },
    });
    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.success, true);
    assert.equal(json.data.pollId, pollTenantA.id);
  });

  it('C5. Duplicate voting on same poll is rejected with 409 conflict', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/polls/${pollTenantA.id}/vote`,
      headers: { authorization: `Bearer ${tokenTenantA}` },
      payload: { optionId: pollOptionA2.id },
    });
    assert.equal(res.statusCode, 409, 'Duplicate vote must return 409');
  });

  it('C6. Cross-tenant vote attempt by Tenant B on Tenant A poll is rejected with 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/polls/${pollTenantA.id}/vote`,
      headers: { authorization: `Bearer ${tokenTenantB}` },
      payload: { optionId: pollOptionA1.id },
    });
    assert.equal(res.statusCode, 403, 'Cross-tenant vote must return 403');
    const json = JSON.parse(res.body);
    assert.equal(json.error.code, 'FORBIDDEN_TENANT');
  });

  it('C7. Voting on expired poll is rejected with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/polls/${expiredPollA.id}/vote`,
      headers: { authorization: `Bearer ${tokenTenantA}` },
      payload: { optionId: expiredOptionA1.id },
    });
    assert.equal(res.statusCode, 400, 'Expired poll vote must return 400');
    const json = JSON.parse(res.body);
    assert.equal(json.error.code, 'POLL_EXPIRED');
  });

  it('C8. Voting with invalid option ID is rejected with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/polls/${pollTenantA.id}/vote`,
      headers: { authorization: `Bearer ${tokenTenantA}` },
      payload: { optionId: '00000000-0000-0000-0000-000000000000' },
    });
    assert.equal(res.statusCode, 400, 'Invalid option must return 400');
  });

  // --------------------------------------------------------------------------
  // D. VOTER SEARCH AND LISTING TESTS
  // --------------------------------------------------------------------------
  it('D1. Voter search retains organization isolation and does not return cross-tenant voters', async () => {
    const resA = await app.inject({
      method: 'GET',
      url: '/api/voters?search=Voter',
      headers: { authorization: `Bearer ${tokenTenantA}` },
    });
    assert.equal(resA.statusCode, 200);
    const jsonA = JSON.parse(resA.body);
    assert.ok(Array.isArray(jsonA.data), 'data should be an array of voters');
    assert.ok(jsonA.data.every((v: any) => !v.name.includes('Tenant B')), 'Tenant A search must NOT return Tenant B voters');
  });

  it('D2. Voter search without tenant context fails closed with 0 items', async () => {
    const query: any = { page: 1, limit: 20, search: 'Voter' };
    const scopeWithoutTenant: any = {
      isGlobalScope: false,
      organisationId: null,
      role: RoleType.CONSTITUENCY_INCHARGE,
      accessibleConstituencyIds: new Set(),
    };
    const result = await VotersService.listVoters(query, scopeWithoutTenant);
    assert.equal(result.total, 0);
    assert.deepEqual(result.items, []);
  });

  // --------------------------------------------------------------------------
  // E. APPLICATIONS DIRECTORY TESTS
  // --------------------------------------------------------------------------
  it('E1. SuperAdmin can access global applications directory', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/applications',
      headers: { authorization: `Bearer ${tokenSuperAdmin}` },
    });
    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.ok(json.data.length >= 2, 'SuperAdmin should see all applications');
    assert.ok(json.data.some((a: any) => a.activePartyCode === partyA.code));
    assert.ok(json.data.some((a: any) => a.activePartyCode === partyB.code));
  });

  it('E2. Non-SuperAdmin only sees their own organization application', async () => {
    const resA = await app.inject({
      method: 'GET',
      url: '/api/applications',
      headers: { authorization: `Bearer ${tokenTenantA}` },
    });
    assert.equal(resA.statusCode, 200);
    const jsonA = JSON.parse(resA.body);
    assert.equal(jsonA.data.length, 1);
    assert.equal(jsonA.data[0].activePartyCode, partyA.code);

    const resB = await app.inject({
      method: 'GET',
      url: '/api/applications',
      headers: { authorization: `Bearer ${tokenTenantB}` },
    });
    assert.equal(resB.statusCode, 200);
    const jsonB = JSON.parse(resB.body);
    assert.equal(jsonB.data.length, 1);
    assert.equal(jsonB.data[0].activePartyCode, partyB.code);
  });

  it('E3. Non-SuperAdmin without tenant context receives empty applications list from service', async () => {
    const apps = await ApplicationsService.getApplications('non-existent-tenant-id');
    assert.deepEqual(apps, []);
  });

  // --------------------------------------------------------------------------
  // F. CADRE UPDATES TESTS
  // --------------------------------------------------------------------------
  it('F1. Tenant B user cannot update Cadre profile belonging to Tenant A user (403)', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/cadre/${cadreRecordA.id}`,
      headers: { authorization: `Bearer ${tokenTenantB}` },
      payload: { performanceScore: 99 },
    });
    assert.equal(res.statusCode, 403, 'Cross-tenant cadre update must return 403');
    const json = JSON.parse(res.body);
    assert.equal(json.error.code, 'CROSS_ORG_ACCESS_FORBIDDEN');
  });

  it('F2. Cadre update filters out protected identity fields (userId cannot be reassigned)', async () => {
    const fakeUserId = '11111111-1111-1111-1111-111111111111';
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/cadre/${cadreRecordA.id}`,
      headers: { authorization: `Bearer ${tokenSuperAdmin}` },
      payload: {
        performanceScore: 95,
        userId: fakeUserId, // Attempted reassignment
      },
    });

    assert.equal(res.statusCode, 200);
    const dbCadre = await prisma.cadre.findUnique({ where: { id: cadreRecordA.id } });
    assert.equal(dbCadre?.userId, cadreUserA.id, 'userId must remain untouched');
    assert.equal(dbCadre?.performanceScore, 95);
  });
});
