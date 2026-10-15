process.env.NODE_ENV = 'test';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { RoleType, AccountStatus, TaskPriority, TaskStatus, VoterStatus, VoteStatus } from '@prisma/client';
import { TokenService } from '../modules/auth/services/token.service.js';

describe('Phase 4 — Safe CRUD: Tenant Scoping, Cross-Tenant Isolation & Soft-Archival Suite', () => {
  let app: any;
  let tenantAOrg: any;
  let tenantBOrg: any;
  let tenantAAdmin: any;
  let tenantBAdmin: any;
  let tenantAToken: string;
  let tenantBToken: string;

  let tenantAState: any;
  let tenantBState: any;
  let tenantAConstituency: any;
  let tenantBConstituency: any;
  let tenantABooth: any;
  let tenantBBooth: any;

  const createdOrgIds: string[] = [];

  async function issueToken(user: any) {
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
    app = await buildApp();

    const timestamp = Date.now();

    // 1. Create Tenant A & Tenant B
    tenantAOrg = await prisma.organisation.create({
      data: {
        name: `Safe CRUD Org A ${timestamp}`,
        code: `SC_A_${timestamp}`,
        description: 'Tenant A for Safe CRUD Testing',
      },
    });
    createdOrgIds.push(tenantAOrg.id);

    tenantBOrg = await prisma.organisation.create({
      data: {
        name: `Safe CRUD Org B ${timestamp}`,
        code: `SC_B_${timestamp}`,
        description: 'Tenant B for Safe CRUD Testing',
      },
    });
    createdOrgIds.push(tenantBOrg.id);

    // Create active PoliticalParty for both tenants to satisfy PartyEligibilityService
    await prisma.politicalParty.create({
      data: {
        name: `Party A ${timestamp}`,
        code: `PA_${timestamp}`,
        shortName: `PA_${timestamp}`,
        organisationId: tenantAOrg.id,
      },
    });
    await prisma.politicalParty.create({
      data: {
        name: `Party B ${timestamp}`,
        code: `PB_${timestamp}`,
        shortName: `PB_${timestamp}`,
        organisationId: tenantBOrg.id,
      },
    });

    // 2. Setup Hierarchy for Tenant A
    tenantAState = await prisma.state.create({
      data: { name: `State A ${timestamp}`, code: `STA_${timestamp}`, organisationId: tenantAOrg.id },
    });
    const zoneA = await prisma.zone.create({
      data: { name: `Zone A ${timestamp}`, code: `ZA_${timestamp}`, stateId: tenantAState.id },
    });
    const parlA = await prisma.parliament.create({
      data: { name: `Parl A ${timestamp}`, code: `P_A_${timestamp}`, zoneId: zoneA.id },
    });
    tenantAConstituency = await prisma.constituency.create({
      data: { name: `Const A ${timestamp}`, code: `CA_${timestamp}`, parliamentId: parlA.id },
    });
    const mandalA = await prisma.mandal.create({
      data: { name: `Mandal A ${timestamp}`, code: `MA_${timestamp}`, constituencyId: tenantAConstituency.id },
    });
    const villageA = await prisma.village.create({
      data: { name: `Village A ${timestamp}`, code: `VA_${timestamp}`, mandalId: mandalA.id },
    });
    tenantABooth = await prisma.booth.create({
      data: { code: `BA101_${timestamp}`, boothNumber: `B101_${timestamp}`, name: `Booth A101 ${timestamp}`, villageId: villageA.id },
    });

    // 3. Setup Hierarchy for Tenant B
    tenantBState = await prisma.state.create({
      data: { name: `State B ${timestamp}`, code: `STB_${timestamp}`, organisationId: tenantBOrg.id },
    });
    const zoneB = await prisma.zone.create({
      data: { name: `Zone B ${timestamp}`, code: `ZB_${timestamp}`, stateId: tenantBState.id },
    });
    const parlB = await prisma.parliament.create({
      data: { name: `Parl B ${timestamp}`, code: `P_B_${timestamp}`, zoneId: zoneB.id },
    });
    tenantBConstituency = await prisma.constituency.create({
      data: { name: `Const B ${timestamp}`, code: `CB_${timestamp}`, parliamentId: parlB.id },
    });
    const mandalB = await prisma.mandal.create({
      data: { name: `Mandal B ${timestamp}`, code: `MB_${timestamp}`, constituencyId: tenantBConstituency.id },
    });
    const villageB = await prisma.village.create({
      data: { name: `Village B ${timestamp}`, code: `VB_${timestamp}`, mandalId: mandalB.id },
    });
    tenantBBooth = await prisma.booth.create({
      data: { code: `BB201_${timestamp}`, boothNumber: `B201_${timestamp}`, name: `Booth B201 ${timestamp}`, villageId: villageB.id },
    });

    // 4. Create Admins for both tenants
    tenantAAdmin = await prisma.user.create({
      data: {
        userCode: `ADMIN_A_${timestamp}`,
        name: `Admin Org A ${timestamp}`,
        mobileNumber: `888${String(timestamp).slice(-7)}`,
        role: RoleType.STATE_ADMIN,
        accountStatus: AccountStatus.ACTIVE,
        organisationId: tenantAOrg.id,
      },
    });

    tenantBAdmin = await prisma.user.create({
      data: {
        userCode: `ADMIN_B_${timestamp}`,
        name: `Admin Org B ${timestamp}`,
        mobileNumber: `777${String(timestamp).slice(-7)}`,
        role: RoleType.STATE_ADMIN,
        accountStatus: AccountStatus.ACTIVE,
        organisationId: tenantBOrg.id,
      },
    });

    tenantAToken = await issueToken(tenantAAdmin);
    tenantBToken = await issueToken(tenantBAdmin);
  });

  after(async () => {
    for (const orgId of createdOrgIds) {
      await prisma.loginSession.deleteMany({ where: { user: { organisationId: orgId } } }).catch(() => {});
      await prisma.auditLog.deleteMany({ where: { user: { organisationId: orgId } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { organisationId: orgId } }).catch(() => {});
      await prisma.politicalParty.deleteMany({ where: { organisationId: orgId } }).catch(() => {});
      await prisma.organisation.delete({ where: { id: orgId } }).catch(() => {});
    }
    if (app) await app.close();
  });

  it('1. Cross-Tenant Isolation: User CRUD rejects cross-tenant read, update, and delete', async () => {
    const timestamp = Date.now();
    const userB = await prisma.user.create({
      data: {
        userCode: `SUB_B_${timestamp}`,
        name: `Cadre B ${timestamp}`,
        mobileNumber: `666${String(timestamp).slice(-7)}`,
        role: RoleType.VILLAGE_INCHARGE,
        accountStatus: AccountStatus.ACTIVE,
        organisationId: tenantBOrg.id,
      },
    });

    // Tenant A tries to read Tenant B user -> Must be 403 / 404
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/users/${userB.id}`,
      headers: { authorization: `Bearer ${tenantAToken}` },
    });
    assert.ok(getRes.statusCode === 403 || getRes.statusCode === 404, `Expected 403/404, got ${getRes.statusCode}`);

    // Tenant A tries to update Tenant B user -> Must be 403
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/users/${userB.id}`,
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: { name: 'Hacked Name' },
    });
    assert.equal(patchRes.statusCode, 403);

    // Tenant A tries to delete Tenant B user -> Must be 403
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/users/${userB.id}`,
      headers: { authorization: `Bearer ${tenantAToken}` },
    });
    assert.equal(deleteRes.statusCode, 403);

    // Verify userB is unmodified
    const freshUserB = await prisma.user.findUnique({ where: { id: userB.id } });
    assert.equal(freshUserB?.name, `Cadre B ${timestamp}`);
  });

  it('2. Cross-Tenant Isolation: Voter CRUD rejects cross-tenant operations', async () => {
    const timestamp = Date.now();
    const voterB = await prisma.voter.create({
      data: {
        serialNumber: 1,
        epicNumber: `EPIC_B_${timestamp}`,
        name: `Voter B ${timestamp}`,
        fatherHusbandName: 'Father B',
        houseNumber: '1-1',
        age: 30,
        stateId: tenantBState.id,
        constituencyId: tenantBConstituency.id,
        boothId: tenantBBooth.id,
      },
    });

    // Tenant A tries to read Tenant B voter
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/voters/${voterB.id}`,
      headers: { authorization: `Bearer ${tenantAToken}` },
    });
    assert.equal(getRes.statusCode, 403);

    // Tenant A tries to update Tenant B voter
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/voters/${voterB.id}`,
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: { mobileNumber: '9999999999' },
    });
    assert.equal(patchRes.statusCode, 403);

    // Tenant A tries to delete Tenant B voter
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/voters/${voterB.id}`,
      headers: { authorization: `Bearer ${tenantAToken}` },
    });
    assert.equal(deleteRes.statusCode, 403);
  });

  it('3. Cross-Tenant Isolation: Cadre, Tasks, Polls, and Announcements reject cross-tenant mutations', async () => {
    const timestamp = Date.now();

    // Setup Tenant B Cadre
    const cadreUserB = await prisma.user.create({
      data: {
        userCode: `CADRE_U_B_${timestamp}`,
        name: `Cadre Target B ${timestamp}`,
        mobileNumber: `555${String(timestamp).slice(-7)}`,
        role: RoleType.VOLUNTEER,
        accountStatus: AccountStatus.ACTIVE,
        organisationId: tenantBOrg.id,
      },
    });
    const cadreB = await prisma.cadre.create({
      data: { userId: cadreUserB.id, performanceScore: 90 },
    });

    // Setup Tenant B Task
    const taskB = await prisma.task.create({
      data: {
        title: `Task B ${timestamp}`,
        createdById: tenantBAdmin.id,
        constituencyId: tenantBConstituency.id,
      },
    });

    // Setup Tenant B Poll
    const pollB = await prisma.poll.create({
      data: {
        title: `Poll B ${timestamp}`,
        createdById: tenantBAdmin.id,
        options: { create: [{ label: 'Option 1', order: 0 }, { label: 'Option 2', order: 1 }] },
      },
    });

    // Setup Tenant B Announcement
    const annB = await prisma.announcement.create({
      data: {
        title: `Announcement B ${timestamp}`,
        content: 'Content B',
        organisationId: tenantBOrg.id,
      },
    });

    // 1. Cadre mutation by Tenant A -> 403
    const cadrePatch = await app.inject({
      method: 'PATCH',
      url: `/api/cadre/${cadreB.id}`,
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: { performanceScore: 10 },
    });
    assert.equal(cadrePatch.statusCode, 403);

    const cadreDel = await app.inject({
      method: 'DELETE',
      url: `/api/cadre/${cadreB.id}`,
      headers: { authorization: `Bearer ${tenantAToken}` },
    });
    assert.equal(cadreDel.statusCode, 403);

    // 2. Task mutation by Tenant A -> 403
    const taskDel = await app.inject({
      method: 'DELETE',
      url: `/api/tasks/${taskB.id}`,
      headers: { authorization: `Bearer ${tenantAToken}` },
    });
    assert.equal(taskDel.statusCode, 403);

    // 3. Poll mutation by Tenant A -> 403
    const pollDel = await app.inject({
      method: 'DELETE',
      url: `/api/polls/${pollB.id}`,
      headers: { authorization: `Bearer ${tenantAToken}` },
    });
    assert.equal(pollDel.statusCode, 403);

    // 4. Announcement mutation by Tenant A -> 403
    const annPatch = await app.inject({
      method: 'PATCH',
      url: `/api/cms/announcements/${annB.id}`,
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: { title: 'Compromised' },
    });
    assert.equal(annPatch.statusCode, 403);

    const annDel = await app.inject({
      method: 'DELETE',
      url: `/api/cms/announcements/${annB.id}`,
      headers: { authorization: `Bearer ${tenantAToken}` },
    });
    assert.equal(annDel.statusCode, 403);
  });

  it('4. Soft-Archival: Voter with cast vote history is soft-archived, preserving vote events', async () => {
    const timestamp = Date.now();
    const voterWithVotes = await prisma.voter.create({
      data: {
        serialNumber: 10,
        epicNumber: `EPIC_VOTE_${timestamp}`,
        name: `Voted Citizen ${timestamp}`,
        fatherHusbandName: 'Father',
        houseNumber: '2-2',
        age: 45,
        stateId: tenantAState.id,
        constituencyId: tenantAConstituency.id,
        boothId: tenantABooth.id,
        voteStatus: VoteStatus.VOTE_DONE,
        voteDoneAt: new Date(),
      },
    });

    // Record a LiveVoteEvent and VoteTracking
    await prisma.liveVoteEvent.create({
      data: {
        voterId: voterWithVotes.id,
        inchargeId: tenantAAdmin.id,
        previousStatus: VoteStatus.NOT_VOTED,
        nextStatus: VoteStatus.VOTE_DONE,
        changedAt: new Date(),
      },
    });
    await prisma.voteTracking.create({
      data: {
        voterId: voterWithVotes.id,
        markedById: tenantAAdmin.id,
        status: VoteStatus.VOTE_DONE,
        markedAt: new Date(),
      },
    });

    // Attempt deletion
    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/voters/${voterWithVotes.id}`,
      headers: { authorization: `Bearer ${tenantAToken}` },
    });
    assert.equal(delRes.statusCode, 200);
    const body = JSON.parse(delRes.body);
    assert.equal(body.data.softArchived, true);
    assert.equal(body.data.deleted, false);

    // Verify voter record still exists in DB with voterStatus UNKNOWN
    const freshVoter = await prisma.voter.findUnique({ where: { id: voterWithVotes.id } });
    assert.ok(freshVoter, 'Voter record MUST NOT be deleted from DB');
    assert.equal(freshVoter.voterStatus, VoterStatus.UNKNOWN);

    // Verify liveVoteEvents and voteTrackings are preserved intact
    const events = await prisma.liveVoteEvent.findMany({ where: { voterId: voterWithVotes.id } });
    assert.equal(events.length, 1, 'Election LiveVoteEvent MUST be preserved');

    const trackings = await prisma.voteTracking.findMany({ where: { voterId: voterWithVotes.id } });
    assert.equal(trackings.length, 1, 'Election VoteTracking MUST be preserved');
  });

  it('5. Clean Deletion: Voter without any election voting history is cleanly removed', async () => {
    const timestamp = Date.now();
    const cleanVoter = await prisma.voter.create({
      data: {
        serialNumber: 11,
        epicNumber: `EPIC_CLEAN_${timestamp}`,
        name: `Clean Citizen ${timestamp}`,
        fatherHusbandName: 'Father',
        houseNumber: '3-3',
        age: 25,
        stateId: tenantAState.id,
        constituencyId: tenantAConstituency.id,
        boothId: tenantABooth.id,
        voteStatus: VoteStatus.NOT_VOTED,
      },
    });

    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/voters/${cleanVoter.id}`,
      headers: { authorization: `Bearer ${tenantAToken}` },
    });
    assert.equal(delRes.statusCode, 200);
    const body = JSON.parse(delRes.body);
    assert.equal(body.data.deleted, true);
    assert.equal(body.data.softArchived, false);

    // Verify voter is completely gone
    const freshVoter = await prisma.voter.findUnique({ where: { id: cleanVoter.id } });
    assert.equal(freshVoter, null);
  });

  it('6. Soft-Archival: User with dependent audit/report records is deactivated, preserving election integrity', async () => {
    const timestamp = Date.now();
    const activeOfficial = await prisma.user.create({
      data: {
        userCode: `OFFICIAL_${timestamp}`,
        name: `Field Official ${timestamp}`,
        mobileNumber: `444${String(timestamp).slice(-7)}`,
        role: RoleType.BOOTH_PRESIDENT,
        accountStatus: AccountStatus.ACTIVE,
        organisationId: tenantAOrg.id,
      },
    });

    // Official logged ground reports and audit events
    await prisma.groundReport.create({
      data: {
        description: 'Polling underway smoothly',
        createdById: activeOfficial.id,
      },
    });

    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/users/${activeOfficial.id}`,
      headers: { authorization: `Bearer ${tenantAToken}` },
    });
    assert.equal(delRes.statusCode, 200);
    const body = JSON.parse(delRes.body);
    assert.equal(body.data.softArchived, true);
    assert.equal(body.data.accountStatus, 'DEACTIVATED');

    // Verify user is preserved in DB with DEACTIVATED status
    const freshUser = await prisma.user.findUnique({ where: { id: activeOfficial.id } });
    assert.ok(freshUser, 'User record MUST NOT be hard-deleted');
    assert.equal(freshUser.accountStatus, AccountStatus.DEACTIVATED);

    // Verify reports are intact
    const reports = await prisma.groundReport.findMany({ where: { createdById: activeOfficial.id } });
    assert.equal(reports.length, 1, 'Election ground reports MUST be preserved');
  });

  it('7. Soft-Archival: Poll with votes and Task with history are soft-archived on delete', async () => {
    const timestamp = Date.now();

    // 1. Task with Status History
    const taskA = await prisma.task.create({
      data: {
        title: `Tracked Task ${timestamp}`,
        createdById: tenantAAdmin.id,
        status: TaskStatus.IN_PROGRESS,
        statusHistory: {
          create: {
            previousStatus: TaskStatus.PENDING,
            newStatus: TaskStatus.IN_PROGRESS,
            changedById: tenantAAdmin.id,
          },
        },
      },
    });

    const taskDel = await app.inject({
      method: 'DELETE',
      url: `/api/tasks/${taskA.id}`,
      headers: { authorization: `Bearer ${tenantAToken}` },
    });
    assert.equal(taskDel.statusCode, 200);
    const taskBody = JSON.parse(taskDel.body);
    assert.equal(taskBody.data.softArchived, true);
    assert.equal(taskBody.data.status, 'CANCELLED');

    const freshTask = await prisma.task.findUnique({ where: { id: taskA.id } });
    assert.ok(freshTask);
    assert.equal(freshTask.status, TaskStatus.CANCELLED);

    // 2. Poll with Cast Votes
    const pollA = await prisma.poll.create({
      data: {
        title: `Voted Poll ${timestamp}`,
        createdById: tenantAAdmin.id,
        options: {
          create: [{ label: 'Option A', order: 0 }, { label: 'Option B', order: 1 }],
        },
      },
      include: { options: true },
    });

    // Cast a vote
    await prisma.pollVote.create({
      data: {
        pollId: pollA.id,
        optionId: pollA.options[0].id,
        userId: tenantAAdmin.id,
      },
    });

    const pollDel = await app.inject({
      method: 'DELETE',
      url: `/api/polls/${pollA.id}`,
      headers: { authorization: `Bearer ${tenantAToken}` },
    });
    assert.equal(pollDel.statusCode, 200);
    const pollBody = JSON.parse(pollDel.body);
    assert.equal(pollBody.data.softArchived, true);
    assert.equal(pollBody.data.status, 'CLOSED');

    const freshPoll = await prisma.poll.findUnique({ where: { id: pollA.id } });
    assert.ok(freshPoll);
    assert.equal(freshPoll.status, 'CLOSED');

    const votes = await prisma.pollVote.findMany({ where: { pollId: pollA.id } });
    assert.equal(votes.length, 1, 'Poll votes MUST NOT be wiped on delete');
  });
});
