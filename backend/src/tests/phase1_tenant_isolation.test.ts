process.env.NODE_ENV = 'test';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { io as ioClient, Socket } from 'socket.io-client';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { RoleType, GroundReportType, TaskPriority, TaskStatus } from '@prisma/client';
import { TokenService } from '../modules/auth/services/token.service.js';
import { TasksService } from '../modules/tasks/tasks.service.js';
import { VotersService } from '../modules/voters/voters.service.js';
import { PollsService } from '../modules/polls/polls.service.js';
import { TrainingService } from '../modules/training/training.service.js';
import { initSocketServer } from '../lib/socket.js';

describe('PHASE 1 — Comprehensive Tenant Isolation Regression Suite', () => {
  let app: any;
  let serverPort: number;

  // Tenant A Fixtures
  let tenantAOrg: any;
  let partyA: any;
  let stateA: any;
  let zoneA: any;
  let parliamentA: any;
  let constituencyA: any;
  let mandalA: any;
  let villageA: any;
  let boothA: any;
  let unitA: any;
  let userA: any;
  let tokenA: string;
  let taskA: any;
  let pollA: any;
  let pollOptionA1: any;
  let voterA: any;
  let cadreRecordA: any;
  let groundReportA: any;
  let pollingReportA: any;
  let trainingVideoA: any;

  // Tenant B Fixtures
  let tenantBOrg: any;
  let partyB: any;
  let stateB: any;
  let zoneB: any;
  let parliamentB: any;
  let constituencyB: any;
  let mandalB: any;
  let villageB: any;
  let boothB: any;
  let unitB: any;
  let userB: any;
  let tokenB: string;
  let taskB: any;
  let pollB: any;
  let pollOptionB1: any;
  let voterB: any;
  let cadreRecordB: any;
  let groundReportB: any;
  let pollingReportB: any;
  let trainingVideoB: any;

  // Platform Fixtures
  let superAdminUser: any;
  let tokenSuperAdmin: string;

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
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    serverPort = Number(address.split(':').pop());
    initSocketServer(app.server, '*');

    const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    // 1. Create Tenant A and Tenant B
    tenantAOrg = await prisma.organisation.create({
      data: {
        name: `Phase1-Org-A-${suffix}`,
        code: `P1A-${suffix.slice(-4)}`,
        isActive: true,
      },
    });

    tenantBOrg = await prisma.organisation.create({
      data: {
        name: `Phase1-Org-B-${suffix}`,
        code: `P1B-${suffix.slice(-4)}`,
        isActive: true,
      },
    });

    // 2. Create Political Parties
    partyA = await prisma.politicalParty.create({
      data: {
        code: `PTA-${suffix.slice(-4)}`,
        name: `Party A ${suffix}`,
        shortName: 'PTA',
        organisationId: tenantAOrg.id,
        isActive: true,
      },
    });

    partyB = await prisma.politicalParty.create({
      data: {
        code: `PTB-${suffix.slice(-4)}`,
        name: `Party B ${suffix}`,
        shortName: 'PTB',
        organisationId: tenantBOrg.id,
        isActive: true,
      },
    });

    // 3. Create CMS Configurations
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

    // 4. Create Hierarchy Trees
    stateA = await prisma.state.create({
      data: { name: `State A ${suffix}`, code: `STA-${suffix.slice(-4)}`, organisationId: tenantAOrg.id },
    });
    zoneA = await prisma.zone.create({
      data: { name: `Zone A ${suffix}`, code: `ZNA-${suffix.slice(-4)}`, stateId: stateA.id },
    });
    parliamentA = await prisma.parliament.create({
      data: { name: `Parliament A ${suffix}`, code: `PRA-${suffix.slice(-4)}`, zoneId: zoneA.id },
    });
    constituencyA = await prisma.constituency.create({
      data: { name: `Constituency A ${suffix}`, code: `CNA-${suffix.slice(-4)}`, parliamentId: parliamentA.id },
    });
    mandalA = await prisma.mandal.create({
      data: { name: `Mandal A ${suffix}`, code: `MDA-${suffix.slice(-4)}`, constituencyId: constituencyA.id },
    });
    villageA = await prisma.village.create({
      data: { name: `Village A ${suffix}`, code: `VLA-${suffix.slice(-4)}`, mandalId: mandalA.id },
    });
    boothA = await prisma.booth.create({
      data: { boothNumber: '101', code: `BTHA-${suffix.slice(-4)}`, name: `Booth A ${suffix}`, villageId: villageA.id },
    });

    stateB = await prisma.state.create({
      data: { name: `State B ${suffix}`, code: `STB-${suffix.slice(-4)}`, organisationId: tenantBOrg.id },
    });
    zoneB = await prisma.zone.create({
      data: { name: `Zone B ${suffix}`, code: `ZNB-${suffix.slice(-4)}`, stateId: stateB.id },
    });
    parliamentB = await prisma.parliament.create({
      data: { name: `Parliament B ${suffix}`, code: `PRB-${suffix.slice(-4)}`, zoneId: zoneB.id },
    });
    constituencyB = await prisma.constituency.create({
      data: { name: `Constituency B ${suffix}`, code: `CNB-${suffix.slice(-4)}`, parliamentId: parliamentB.id },
    });
    mandalB = await prisma.mandal.create({
      data: { name: `Mandal B ${suffix}`, code: `MDB-${suffix.slice(-4)}`, constituencyId: constituencyB.id },
    });
    villageB = await prisma.village.create({
      data: { name: `Village B ${suffix}`, code: `VLB-${suffix.slice(-4)}`, mandalId: mandalB.id },
    });
    boothB = await prisma.booth.create({
      data: { boothNumber: '201', code: `BTHB-${suffix.slice(-4)}`, name: `Booth B ${suffix}`, villageId: villageB.id },
    });

    // 5. Create Organization Units matching constituency codes
    unitA = await prisma.organizationUnit.create({
      data: {
        name: `Unit A ${suffix}`,
        level: 'CONSTITUENCY',
        code: constituencyA.code,
      },
    });

    unitB = await prisma.organizationUnit.create({
      data: {
        name: `Unit B ${suffix}`,
        level: 'CONSTITUENCY',
        code: constituencyB.code,
      },
    });

    // 6. Create Users
    userA = await prisma.user.create({
      data: {
        organisationId: tenantAOrg.id,
        userCode: `USR-A-${suffix.slice(-4)}`,
        name: `Leader A ${suffix}`,
        mobileNumber: `+9199881${Math.floor(10000 + Math.random() * 90000)}`,
        role: RoleType.CONSTITUENCY_INCHARGE,
        unitId: unitA.id,
        accountStatus: 'ACTIVE',
      },
    });

    userB = await prisma.user.create({
      data: {
        organisationId: tenantBOrg.id,
        userCode: `USR-B-${suffix.slice(-4)}`,
        name: `Leader B ${suffix}`,
        mobileNumber: `+9199882${Math.floor(10000 + Math.random() * 90000)}`,
        role: RoleType.CONSTITUENCY_INCHARGE,
        unitId: unitB.id,
        accountStatus: 'ACTIVE',
      },
    });

    superAdminUser = await prisma.user.findFirst({
      where: { role: RoleType.SUPER_ADMIN, accountStatus: 'ACTIVE' },
    });
    if (!superAdminUser) {
      superAdminUser = await prisma.user.create({
        data: {
          userCode: `SUP-${suffix.slice(-4)}`,
          name: 'Phase 1 SuperAdmin',
          mobileNumber: `+9199883${Math.floor(10000 + Math.random() * 90000)}`,
          role: RoleType.SUPER_ADMIN,
          accountStatus: 'ACTIVE',
        },
      });
    }

    // 7. Hierarchy assignments
    await prisma.userHierarchyAssignment.create({
      data: {
        userId: userA.id,
        roleType: RoleType.CONSTITUENCY_INCHARGE,
        constituencyId: constituencyA.id,
        isActive: true,
      },
    });

    await prisma.userHierarchyAssignment.create({
      data: {
        userId: userB.id,
        roleType: RoleType.CONSTITUENCY_INCHARGE,
        constituencyId: constituencyB.id,
        isActive: true,
      },
    });

    tokenA = await issueToken(userA);
    tokenB = await issueToken(userB);
    tokenSuperAdmin = await issueToken(superAdminUser);

    // 8. Create Records in Tenant A
    taskA = await prisma.task.create({
      data: {
        title: `Task Alpha ${suffix}`,
        description: 'Tenant A task',
        priority: TaskPriority.HIGH,
        createdById: userA.id,
        constituencyId: constituencyA.id,
        unitId: unitA.id,
        status: TaskStatus.PENDING,
      },
    });

    pollA = await prisma.poll.create({
      data: {
        title: `Poll Alpha ${suffix}`,
        createdById: userA.id,
        status: 'PUBLISHED',
        options: {
          create: [{ label: 'Option A1', order: 1 }, { label: 'Option A2', order: 2 }],
        },
      },
      include: { options: true },
    });
    pollOptionA1 = pollA.options[0];

    voterA = await prisma.voter.create({
      data: {
        serialNumber: 1,
        epicNumber: `EPICA${suffix.replace(/[^a-zA-Z0-9]/g, '').slice(-8)}`,
        name: `Voter Alpha ${suffix}`,
        fatherHusbandName: 'Father Alpha',
        houseNumber: 'A-1',
        age: 28,
        stateId: stateA.id,
        constituencyId: constituencyA.id,
      },
    });

    cadreRecordA = await prisma.cadre.create({
      data: {
        userId: userA.id,
        skills: ['Campaigning'],
        badges: ['Gold'],
        performanceScore: 88.0,
      },
    });

    groundReportA = await prisma.groundReport.create({
      data: {
        reportType: GroundReportType.GENERAL_UPDATE,
        priority: TaskPriority.MEDIUM,
        description: `Ground Report A ${suffix}`,
        createdById: userA.id,
        constituencyId: constituencyA.id,
        unitId: unitA.id,
      },
    });

    pollingReportA = await prisma.pollingReport.create({
      data: {
        mandalName: 'Mandal A',
        boothLabel: 'Booth 101',
        reporterName: 'Reporter Alpha',
        tdpVotes: 10,
        ysrcpVotes: 5,
        createdById: userA.id,
        boothId: boothA.id,
        unitId: unitA.id,
      },
    });

    trainingVideoA = await prisma.trainingVideo.create({
      data: {
        title: `Video Alpha ${suffix}`,
        description: 'Training video for Org A',
        category: 'GENERAL',
        duration: '5 mins',
        videoUrl: 'https://cdn.example.com/videoA.mp4',
        sortOrder: 1,
        organisationId: tenantAOrg.id,
        isActive: true,
      },
    });

    // 9. Create Records in Tenant B
    taskB = await prisma.task.create({
      data: {
        title: `Task Beta ${suffix}`,
        description: 'Tenant B task',
        priority: TaskPriority.MEDIUM,
        createdById: userB.id,
        constituencyId: constituencyB.id,
        unitId: unitB.id,
        status: TaskStatus.PENDING,
      },
    });

    pollB = await prisma.poll.create({
      data: {
        title: `Poll Beta ${suffix}`,
        createdById: userB.id,
        status: 'PUBLISHED',
        options: {
          create: [{ label: 'Option B1', order: 1 }, { label: 'Option B2', order: 2 }],
        },
      },
      include: { options: true },
    });
    pollOptionB1 = pollB.options[0];

    voterB = await prisma.voter.create({
      data: {
        serialNumber: 2,
        epicNumber: `EPICB${suffix.replace(/[^a-zA-Z0-9]/g, '').slice(-8)}`,
        name: `Voter Beta ${suffix}`,
        fatherHusbandName: 'Father Beta',
        houseNumber: 'B-1',
        age: 32,
        stateId: stateB.id,
        constituencyId: constituencyB.id,
      },
    });

    cadreRecordB = await prisma.cadre.create({
      data: {
        userId: userB.id,
        skills: ['Booth Management'],
        badges: ['Silver'],
        performanceScore: 72.0,
      },
    });

    groundReportB = await prisma.groundReport.create({
      data: {
        reportType: GroundReportType.COMPLAINT_ISSUE,
        priority: TaskPriority.HIGH,
        description: `Ground Report B ${suffix}`,
        createdById: userB.id,
        constituencyId: constituencyB.id,
        unitId: unitB.id,
      },
    });

    pollingReportB = await prisma.pollingReport.create({
      data: {
        mandalName: 'Mandal B',
        boothLabel: 'Booth 201',
        reporterName: 'Reporter Beta',
        tdpVotes: 15,
        ysrcpVotes: 20,
        createdById: userB.id,
        boothId: boothB.id,
        unitId: unitB.id,
      },
    });

    trainingVideoB = await prisma.trainingVideo.create({
      data: {
        title: `Video Beta ${suffix}`,
        description: 'Training video for Org B',
        category: 'GENERAL',
        duration: '7 mins',
        videoUrl: 'https://cdn.example.com/videoB.mp4',
        sortOrder: 2,
        organisationId: tenantBOrg.id,
        isActive: true,
      },
    });
  });

  after(async () => {
    try {
      if (groundReportA?.id) await prisma.groundReport.delete({ where: { id: groundReportA.id } });
      if (groundReportB?.id) await prisma.groundReport.delete({ where: { id: groundReportB.id } });
      if (pollingReportA?.id) await prisma.pollingReport.delete({ where: { id: pollingReportA.id } });
      if (pollingReportB?.id) await prisma.pollingReport.delete({ where: { id: pollingReportB.id } });
      if (taskA?.id) await prisma.task.delete({ where: { id: taskA.id } });
      if (taskB?.id) await prisma.task.delete({ where: { id: taskB.id } });
      if (pollA?.id) {
        await prisma.pollVote.deleteMany({ where: { pollId: pollA.id } });
        await prisma.pollOption.deleteMany({ where: { pollId: pollA.id } });
        await prisma.poll.delete({ where: { id: pollA.id } });
      }
      if (pollB?.id) {
        await prisma.pollVote.deleteMany({ where: { pollId: pollB.id } });
        await prisma.pollOption.deleteMany({ where: { pollId: pollB.id } });
        await prisma.poll.delete({ where: { id: pollB.id } });
      }
      if (trainingVideoA?.id) await prisma.trainingVideo.delete({ where: { id: trainingVideoA.id } });
      if (trainingVideoB?.id) await prisma.trainingVideo.delete({ where: { id: trainingVideoB.id } });
      if (cadreRecordA?.id) await prisma.cadre.delete({ where: { id: cadreRecordA.id } });
      if (cadreRecordB?.id) await prisma.cadre.delete({ where: { id: cadreRecordB.id } });
      if (voterA?.id) await prisma.voter.delete({ where: { id: voterA.id } });
      if (voterB?.id) await prisma.voter.delete({ where: { id: voterB.id } });
      if (userA?.id) {
        await prisma.userHierarchyAssignment.deleteMany({ where: { userId: userA.id } });
        await prisma.user.delete({ where: { id: userA.id } });
      }
      if (userB?.id) {
        await prisma.userHierarchyAssignment.deleteMany({ where: { userId: userB.id } });
        await prisma.user.delete({ where: { id: userB.id } });
      }
      if (boothA?.id) await prisma.booth.delete({ where: { id: boothA.id } });
      if (boothB?.id) await prisma.booth.delete({ where: { id: boothB.id } });
      if (villageA?.id) await prisma.village.delete({ where: { id: villageA.id } });
      if (villageB?.id) await prisma.village.delete({ where: { id: villageB.id } });
      if (mandalA?.id) await prisma.mandal.delete({ where: { id: mandalA.id } });
      if (mandalB?.id) await prisma.mandal.delete({ where: { id: mandalB.id } });
      if (constituencyA?.id) await prisma.constituency.delete({ where: { id: constituencyA.id } });
      if (constituencyB?.id) await prisma.constituency.delete({ where: { id: constituencyB.id } });
      if (parliamentA?.id) await prisma.parliament.delete({ where: { id: parliamentA.id } });
      if (parliamentB?.id) await prisma.parliament.delete({ where: { id: parliamentB.id } });
      if (zoneA?.id) await prisma.zone.delete({ where: { id: zoneA.id } });
      if (zoneB?.id) await prisma.zone.delete({ where: { id: zoneB.id } });
      if (stateA?.id) await prisma.state.delete({ where: { id: stateA.id } });
      if (stateB?.id) await prisma.state.delete({ where: { id: stateB.id } });
      if (unitA?.id) await prisma.organizationUnit.delete({ where: { id: unitA.id } });
      if (unitB?.id) await prisma.organizationUnit.delete({ where: { id: unitB.id } });
      if (tenantAOrg?.id) {
        await prisma.cMSConfiguration.deleteMany({ where: { organisationId: tenantAOrg.id } });
        await prisma.politicalParty.deleteMany({ where: { organisationId: tenantAOrg.id } });
        await prisma.organisation.delete({ where: { id: tenantAOrg.id } });
      }
      if (tenantBOrg?.id) {
        await prisma.cMSConfiguration.deleteMany({ where: { organisationId: tenantBOrg.id } });
        await prisma.politicalParty.deleteMany({ where: { organisationId: tenantBOrg.id } });
        await prisma.organisation.delete({ where: { id: tenantBOrg.id } });
      }
    } catch (e) {
      // Ignore cleanup error
    }
    await app.close();
  });

  // =========================================================================
  // Requirement 1: Party A cannot list or retrieve Party B's records
  // =========================================================================
  describe('1. Party A cannot list or retrieve Party B records', () => {
    it('1.1. User A lists polls: receives Poll A but NEVER Poll B', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/polls',
        headers: { authorization: `Bearer ${tokenA}` },
      });
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.ok(json.data.some((p: any) => p.id === pollA.id), 'Tenant A poll must be visible to User A');
      assert.equal(json.data.some((p: any) => p.id === pollB.id), false, 'Tenant B poll must NOT be visible to User A');
    });

    it('1.2. User A lists tasks: receives Task A but NEVER Task B', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/tasks',
        headers: { authorization: `Bearer ${tokenA}` },
      });
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.ok(json.data.some((t: any) => t.id === taskA.id), 'Tenant A task must be visible to User A');
      assert.equal(json.data.some((t: any) => t.id === taskB.id), false, 'Tenant B task must NOT be visible to User A');
    });

    it('1.3. User A directly retrieves Task B: rejected with 403 or 404', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/tasks/${taskB.id}`,
        headers: { authorization: `Bearer ${tokenA}` },
      });
      assert.ok([403, 404].includes(res.statusCode), `Direct fetch of foreign task must return 403 or 404, got ${res.statusCode}`);
    });

    it('1.4. User A lists training videos: receives Video A but NEVER Video B', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/training/videos',
        headers: { authorization: `Bearer ${tokenA}` },
      });
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.ok(json.data.some((v: any) => v.id === trainingVideoA.id));
      assert.equal(json.data.some((v: any) => v.id === trainingVideoB.id), false);
    });

    it('1.5. User A lists ground reports: receives Report A but NEVER Report B', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/reports/ground',
        headers: { authorization: `Bearer ${tokenA}` },
      });
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.ok(json.data.some((r: any) => r.id === groundReportA.id));
      assert.equal(json.data.some((r: any) => r.id === groundReportB.id), false);
    });

    it('1.6. User A lists voters: receives Voter A but NEVER Voter B', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/voters',
        headers: { authorization: `Bearer ${tokenA}` },
      });
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.ok(json.data.some((v: any) => v.id === voterA.id));
      assert.equal(json.data.some((v: any) => v.id === voterB.id), false);
    });

    it('1.7. User A directly fetches Voter B: rejected with 403 or 404', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/voters/${voterB.id}`,
        headers: { authorization: `Bearer ${tokenA}` },
      });
      assert.ok([403, 404].includes(res.statusCode), `Direct fetch of foreign voter must fail, got ${res.statusCode}`);
    });
  });

  // =========================================================================
  // Requirement 2: Party A cannot update, archive or delete Party B records
  // =========================================================================
  describe('2. Party A cannot update, archive or delete Party B records', () => {
    it('2.1. User A cannot update Task B (403 FORBIDDEN_SCOPE)', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/tasks/${taskB.id}`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { title: 'Hacked by Tenant A' },
      });
      assert.ok([403, 404].includes(res.statusCode));
      const dbTask = await prisma.task.findUnique({ where: { id: taskB.id } });
      assert.notEqual(dbTask?.title, 'Hacked by Tenant A');
    });

    it('2.2. User A cannot update Task B status (403 FORBIDDEN_SCOPE)', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/tasks/${taskB.id}/status`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { status: TaskStatus.COMPLETED, comments: 'Malicious completion' },
      });
      assert.ok([403, 404].includes(res.statusCode));
      const dbTask = await prisma.task.findUnique({ where: { id: taskB.id } });
      assert.notEqual(dbTask?.status, TaskStatus.COMPLETED);
    });

    it('2.3. User A cannot vote on Poll B (403 FORBIDDEN_TENANT)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/polls/${pollB.id}/vote`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { optionId: pollOptionB1.id },
      });
      assert.equal(res.statusCode, 403);
      const json = JSON.parse(res.body);
      assert.equal(json.error.code, 'FORBIDDEN_TENANT');
    });

    it('2.4. User A cannot update Cadre B record (403 CROSS_ORG_ACCESS_FORBIDDEN)', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/cadre/${cadreRecordB.id}`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { performanceScore: 99.9 },
      });
      assert.equal(res.statusCode, 403);
      const json = JSON.parse(res.body);
      assert.equal(json.error.code, 'CROSS_ORG_ACCESS_FORBIDDEN');
    });

    it('2.5. User A cannot update Training Video B (404/403 Training video not found)', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/training/videos/${trainingVideoB.id}`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { title: 'Compromised Title' },
      });
      assert.ok([403, 404].includes(res.statusCode));
      const dbVideo = await prisma.trainingVideo.findUnique({ where: { id: trainingVideoB.id } });
      assert.notEqual(dbVideo?.title, 'Compromised Title');
    });

    it('2.6. User A cannot delete Training Video B (404/403 Training video not found)', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/training/videos/${trainingVideoB.id}`,
        headers: { authorization: `Bearer ${tokenA}` },
      });
      assert.ok([403, 404].includes(res.statusCode));
      const dbVideo = await prisma.trainingVideo.findUnique({ where: { id: trainingVideoB.id } });
      assert.ok(dbVideo, 'Video B must not be deleted');
    });

    it('2.7. User A cannot modify or delete Party B (403 FORBIDDEN_TENANT)', async () => {
      const resPatch = await app.inject({
        method: 'PATCH',
        url: `/api/cms/parties/${partyB.id}`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { name: 'Compromised Party' },
      });
      assert.equal(resPatch.statusCode, 403);

      const resDel = await app.inject({
        method: 'DELETE',
        url: `/api/cms/parties/${partyB.id}`,
        headers: { authorization: `Bearer ${tokenA}` },
      });
      assert.equal(resDel.statusCode, 403);
    });
  });

  // =========================================================================
  // Requirement 3: Party A cannot access Party B hierarchy, users & analytics
  // =========================================================================
  describe('3. Cross-tenant hierarchy, users and analytics isolation', () => {
    it('3.1. GET /api/states returns only State A, never State B', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/states',
        headers: { authorization: `Bearer ${tokenA}` },
      });
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.ok(json.data.some((s: any) => s.id === stateA.id));
      assert.equal(json.data.some((s: any) => s.id === stateB.id), false);
    });

    it('3.2. GET /api/constituencies returns only Constituency A, never Constituency B', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/constituencies',
        headers: { authorization: `Bearer ${tokenA}` },
      });
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.ok(json.data.some((c: any) => c.id === constituencyA.id));
      assert.equal(json.data.some((c: any) => c.id === constituencyB.id), false);
    });

    it('3.3. GET /api/users returns only Tenant A users, never Tenant B', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/users',
        headers: { authorization: `Bearer ${tokenA}` },
      });
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.ok(json.data.some((u: any) => u.id === userA.id));
      assert.equal(json.data.some((u: any) => u.id === userB.id), false);
    });

    it('3.4. GET /api/users/:userBId returns 403 CROSS_ORG_ACCESS_FORBIDDEN', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/users/${userB.id}`,
        headers: { authorization: `Bearer ${tokenA}` },
      });
      assert.equal(res.statusCode, 403);
      const json = JSON.parse(res.body);
      assert.equal(json.error.code, 'CROSS_ORG_ACCESS_FORBIDDEN');
    });

    it('3.5. GET /api/analytics/state/:stateBId is rejected with 404 or 403', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/analytics/state/${stateB.id}`,
        headers: { authorization: `Bearer ${tokenA}` },
      });
      assert.ok([403, 404].includes(res.statusCode));
    });

    it('3.6. GET /api/analytics/constituency/:constituencyBId is rejected with 403 or 404', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/analytics/constituency/${constituencyB.id}`,
        headers: { authorization: `Bearer ${tokenA}` },
      });
      assert.ok([403, 404].includes(res.statusCode));
    });
  });

  // =========================================================================
  // Requirement 4: Forged tenant and hierarchy identifiers are rejected
  // =========================================================================
  describe('4. Forged tenant and hierarchy identifiers are rejected', () => {
    it('4.1. Creating a Mandal under Constituency B using User A token returns 403 FORBIDDEN_TENANT', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/mandals',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          name: 'Forged Mandal',
          code: `FM-${Date.now().toString().slice(-4)}`,
          constituencyId: constituencyB.id, // Forged parent hierarchy ID belonging to Tenant B
        },
      });
      assert.equal(res.statusCode, 403);
      const json = JSON.parse(res.body);
      assert.equal(json.error.code, 'FORBIDDEN_TENANT');
    });

    it('4.2. Ground report with foreign unitId returns 403 FORBIDDEN_SCOPE', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/reports/ground',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          description: 'Forged ground report',
          unitId: unitB.id, // Belongs to Tenant B
        },
      });
      assert.equal(res.statusCode, 403);
    });

    it('4.3. Bulk voter upload targeting foreign constituency returns 403 forbidden', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/voters/bulk-import',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          constituencyId: constituencyB.id, // Foreign constituency
          rows: [
            {
              epicNumber: `EPICF${Date.now()}`,
              fullName: 'Forged Voter',
              relativeName: 'Unknown',
              gender: 'MALE',
              age: 30,
              mandalName: 'Mandal B',
              villageName: 'Village B',
              boothNumber: '201',
            },
          ],
        },
      });
      assert.equal(res.statusCode, 403);
      const json = JSON.parse(res.body);
      assert.ok(['FORBIDDEN_TENANT', 'CROSS_ORG_ACCESS_FORBIDDEN'].includes(json.error.code));
    });
  });

  // =========================================================================
  // Requirement 5: Unauthenticated requests cannot bypass tenant checks
  // =========================================================================
  describe('5. Unauthenticated requests are rejected', () => {
    const protectedEndpoints = [
      { method: 'GET', url: '/api/voters' },
      { method: 'GET', url: '/api/tasks' },
      { method: 'GET', url: '/api/polls' },
      { method: 'GET', url: '/api/states' },
      { method: 'GET', url: '/api/reports/ground' },
      { method: 'GET', url: '/api/training/videos' },
      { method: 'GET', url: '/api/users' },
      { method: 'GET', url: '/api/audit' },
    ];

    for (const ep of protectedEndpoints) {
      it(`5.${ep.url} unauthenticated returns 401 UNAUTHORIZED`, async () => {
        const res = await app.inject({
          method: ep.method as any,
          url: ep.url,
        });
        assert.equal(res.statusCode, 401);
        const json = JSON.parse(res.body);
        assert.equal(json.error.code, 'UNAUTHORIZED');
      });
    }
  });

  // =========================================================================
  // Requirement 6: Missing tenant context fails closed
  // =========================================================================
  describe('6. Missing tenant context fails closed', () => {
    it('6.1. TasksService.listTasks without scope returns empty array', async () => {
      const result = await TasksService.listTasks({}, undefined);
      assert.deepEqual(result, []);
    });

    it('6.2. TasksService.listTasks with scope missing organisationId returns empty array', async () => {
      const scopeWithoutOrg: any = {
        userId: 'no-org-user',
        isGlobalScope: false,
        organisationId: null,
        role: RoleType.CONSTITUENCY_INCHARGE,
        accessibleUnitIds: new Set(),
      };
      const result = await TasksService.listTasks({}, scopeWithoutOrg);
      assert.deepEqual(result, []);
    });

    it('6.3. VotersService.listVoters without scope returns 0 items', async () => {
      const result = await VotersService.listVoters({ page: 1, limit: 10, sortBy: 'name', sortOrder: 'asc' }, undefined);
      assert.equal(result.total, 0);
      assert.deepEqual(result.items, []);
    });

    it('6.4. PollsService.listPolls without tenant context returns empty array', async () => {
      const userPayload: any = {
        userId: 'no-org-user',
        organisationId: null,
        role: RoleType.CONSTITUENCY_INCHARGE,
      };
      const result = await PollsService.listPolls(userPayload);
      assert.deepEqual(result, []);
    });

    it('6.5. TrainingService.listVideos without tenant context returns empty array', async () => {
      const result = await TrainingService.listVideos(null, false);
      assert.deepEqual(result, []);
    });

    it('6.6. TrainingService.createVideo without tenant context throws', async () => {
      await assert.rejects(
        () => TrainingService.createVideo({ title: 'No Tenant Video', description: 'Test', category: 'GENERAL', duration: '5 mins' }, 'user-id', null, false),
        /Tenant context required/
      );
    });
  });

  // =========================================================================
  // Requirement 7: SuperAdmin explicit platform authority
  // =========================================================================
  describe('7. SuperAdmin performs only explicitly authorized platform operations', () => {
    it('7.1. SuperAdmin can view all configured applications across tenants', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/applications',
        headers: { authorization: `Bearer ${tokenSuperAdmin}` },
      });
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.ok(json.data.length >= 2, 'SuperAdmin sees all applications');
      assert.ok(json.data.some((a: any) => a.activePartyCode === partyA.code));
      assert.ok(json.data.some((a: any) => a.activePartyCode === partyB.code));
    });

    it('7.2. SuperAdmin cannot delete a locked political party (immutability)', async () => {
      // First publish party A to lock it
      await app.inject({
        method: 'POST',
        url: `/api/cms/parties/${partyA.id}/publish`,
        headers: { authorization: `Bearer ${tokenSuperAdmin}` },
      });

      // Now attempt DELETE on locked party
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/cms/parties/${partyA.id}`,
        headers: { authorization: `Bearer ${tokenSuperAdmin}` },
      });
      assert.equal(res.statusCode, 403);
      const json = JSON.parse(res.body);
      assert.equal(json.error.code, 'PARTY_CONFIGURATION_LOCKED');
    });

    it('7.3. SuperAdmin actions are recorded in immutable audit log', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/audit',
        headers: { authorization: `Bearer ${tokenSuperAdmin}` },
      });
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.ok(Array.isArray(json.data));
      assert.ok(json.data.length > 0, 'Audit trail must contain recorded actions');
    });
  });

  // =========================================================================
  // Requirement 8: Bulk operations and WebSocket rooms enforce tenant isolation
  // =========================================================================
  describe('8. Exports, bulk operations and WebSocket isolation', () => {
    it('8.1. Bulk voter import fails closed if scope is missing organisationId', async () => {
      const { BulkUploadService } = await import('../modules/voters/bulk-upload.service.js');
      await assert.rejects(
        () =>
          BulkUploadService.importVotersFromData(constituencyA.id, [{ epicNumber: 'EPIC-DUMMY' }], {
            scope: { isGlobalScope: false, organisationId: null } as any,
          }),
        (err: any) => err.statusCode === 403 && ['FORBIDDEN', 'FORBIDDEN_TENANT'].includes(err.code)
      );
    });

    it('8.2. Unauthenticated Socket.IO connection is rejected', async () => {
      const socket: Socket = ioClient(`http://127.0.0.1:${serverPort}`, {
        transports: ['websocket'],
        autoConnect: false,
        reconnection: false,
      });

      const errorMsg = await new Promise<string>((resolve) => {
        socket.on('connect_error', (err) => resolve(err.message));
        socket.on('connect', () => resolve('CONNECTED_UNEXPECTEDLY'));
        socket.connect();
      });

      socket.disconnect();
      assert.equal(errorMsg, 'Authentication required');
    });

    it('8.3. Authenticated User A cannot join unauthorized Unit B room', async () => {
      const socket: Socket = ioClient(`http://127.0.0.1:${serverPort}`, {
        transports: ['websocket'],
        auth: { token: tokenA },
        autoConnect: false,
        reconnection: false,
      });

      await new Promise<void>((resolve, reject) => {
        socket.on('connect', () => resolve());
        socket.on('connect_error', (err) => reject(err));
        socket.connect();
      });

      const joinResult = await new Promise<{ success: boolean; error?: string }>((resolve) => {
        socket.emit('join:unit', unitB.id, (res: { success: boolean; error?: string }) => {
          resolve(res);
        });
      });

      socket.disconnect();
      assert.equal(joinResult.success, false);
      assert.equal(joinResult.error, 'Unauthorized');
    });

    it('8.4. Authenticated User A CAN join authorized Unit A room', async () => {
      const socket: Socket = ioClient(`http://127.0.0.1:${serverPort}`, {
        transports: ['websocket'],
        auth: { token: tokenA },
        autoConnect: false,
        reconnection: false,
      });

      await new Promise<void>((resolve, reject) => {
        socket.on('connect', () => resolve());
        socket.on('connect_error', (err) => reject(err));
        socket.connect();
      });

      const joinResult = await new Promise<{ success: boolean; error?: string }>((resolve) => {
        socket.emit('join:unit', unitA.id, (res: { success: boolean; error?: string }) => {
          resolve(res);
        });
      });

      socket.disconnect();
      assert.equal(joinResult.success, true);
    });
  });

  // =========================================================================
  // Requirement 9: Existing valid same-tenant workflows continue to work
  // =========================================================================
  describe('9. Valid same-tenant workflows work normally', () => {
    it('9.1. User A can list and fetch Task A', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/tasks/${taskA.id}`,
        headers: { authorization: `Bearer ${tokenA}` },
      });
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.equal(json.data.id, taskA.id);
    });

    it('9.2. User A can update status of Task A', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/tasks/${taskA.id}/status`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { status: TaskStatus.IN_PROGRESS, comments: 'Starting task' },
      });
      assert.equal(res.statusCode, 200);
      const dbTask = await prisma.task.findUnique({ where: { id: taskA.id } });
      assert.equal(dbTask?.status, TaskStatus.IN_PROGRESS);
    });

    it('9.3. User A can vote on Poll A', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/polls/${pollA.id}/vote`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { optionId: pollOptionA1.id },
      });
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.equal(json.data.pollId, pollA.id);
    });

    it('9.4. User A can submit ground report for Constituency A', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/reports/ground',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          description: 'Valid ground update for Constituency A',
          constituencyId: constituencyA.id,
          unitId: unitA.id,
        },
      });
      assert.equal(res.statusCode, 201);
      const json = JSON.parse(res.body);
      assert.equal(json.success, true);
      // Clean up newly created report
      if (json.data?.id) {
        await prisma.groundReport.delete({ where: { id: json.data.id } });
      }
    });

    it('9.5. User A can view Constituency A analytics', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/analytics/constituency/${constituencyA.id}`,
        headers: { authorization: `Bearer ${tokenA}` },
      });
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.equal(json.success, true);
    });
  });
});
