import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { createAuthenticatedTestSession } from '../middleware/auth.js';
import {
  AuditAction,
  GroundReportType,
  ImportJobStatus,
  OrgHierarchyLevel,
  RoleType,
  TaskPriority,
  TaskStatus,
} from '@prisma/client';

describe('P1-A Production Security Authorization Remediation Suite (16 Requirements)', () => {
  let app: any;
  let superAdminUser: any;
  let superAdminToken: string;

  let ciUserA: any;
  let ciTokenA: string;

  let ciUserB: any;
  let ciTokenB: string;

  let stateRecord: any;
  let zoneRecord: any;
  let parliamentRecord: any;
  let constituencyA: any;
  let constituencyB: any;
  let mandalA: any;
  let mandalB: any;
  let villageA: any;
  let villageB: any;
  let boothA: any;
  let boothB: any;
  let voterA: any;
  let voterB: any;

  let orgUnitA: any;
  let orgUnitB: any;

  let appRecord: any;

  let assignmentB: any;
  let subUserB: any;
  let taskA: any;
  let taskB: any;
  let cadreUserB: any;
  let cadreB: any;
  let pollB: any;
  let importB: any;

  before(async () => {
    app = buildApp();
    await app.ready();

    // 1. Resolve or create geographic hierarchy nodes for clean isolation
    stateRecord = await prisma.state.findFirst();
    if (!stateRecord) {
      stateRecord = await prisma.state.create({
        data: { name: 'P1-Test-State', code: 'P1TS' },
      });
    }

    zoneRecord = await prisma.zone.findFirst({ where: { stateId: stateRecord.id } });
    if (!zoneRecord) {
      zoneRecord = await prisma.zone.create({
        data: { name: 'P1-Test-Zone', code: 'P1TZ', stateId: stateRecord.id },
      });
    }

    parliamentRecord = await prisma.parliament.findFirst({ where: { zoneId: zoneRecord.id } });
    if (!parliamentRecord) {
      parliamentRecord = await prisma.parliament.create({
        data: { name: 'P1-Test-Parliament', code: 'P1TP', zoneId: zoneRecord.id },
      });
    }

    constituencyA = await prisma.constituency.create({
      data: { name: 'P1-Constituency-A', code: `P1CA-${Date.now()}`, parliamentId: parliamentRecord.id },
    });

    constituencyB = await prisma.constituency.create({
      data: { name: 'P1-Constituency-B', code: `P1CB-${Date.now()}`, parliamentId: parliamentRecord.id },
    });

    mandalA = await prisma.mandal.create({
      data: { name: 'P1-Mandal-A', code: `P1MA-${Date.now()}`, constituencyId: constituencyA.id },
    });
    mandalB = await prisma.mandal.create({
      data: { name: 'P1-Mandal-B', code: `P1MB-${Date.now()}`, constituencyId: constituencyB.id },
    });

    villageA = await prisma.village.create({
      data: { name: 'P1-Village-A', code: `P1VA-${Date.now()}`, mandalId: mandalA.id },
    });
    villageB = await prisma.village.create({
      data: { name: 'P1-Village-B', code: `P1VB-${Date.now()}`, mandalId: mandalB.id },
    });

    boothA = await prisma.booth.create({
      data: { code: `P1BA-${Date.now()}`, boothNumber: '991', name: 'P1-Booth-A', villageId: villageA.id },
    });
    boothB = await prisma.booth.create({
      data: { code: `P1BB-${Date.now()}`, boothNumber: '992', name: 'P1-Booth-B', villageId: villageB.id },
    });

    orgUnitA = await prisma.organizationUnit.create({
      data: { name: 'P1-OrgUnit-A', level: OrgHierarchyLevel.CONSTITUENCY },
    });
    orgUnitB = await prisma.organizationUnit.create({
      data: { name: 'P1-OrgUnit-B', level: OrgHierarchyLevel.CONSTITUENCY },
    });

    appRecord = await prisma.cMSConfiguration.findFirst();
    if (!appRecord) {
      appRecord = await prisma.cMSConfiguration.create({
        data: {
          organisationName: 'P1 Test Org',
          stateName: 'Andhra Pradesh',
          hierarchyLabels: {},
          featureToggles: {},
        },
      });
    }

    // 2. Create Voters
    voterA = await prisma.voter.create({
      data: {
        serialNumber: 1,
        epicNumber: `P1-EPIC-A-${Date.now()}`,
        name: 'Voter A In Constituency A',
        fatherHusbandName: 'Father A',
        houseNumber: '1-100',
        gender: 'MALE',
        age: 30,
        constituencyId: constituencyA.id,
        mandalId: mandalA.id,
        villageId: villageA.id,
        boothId: boothA.id,
      },
    });

    voterB = await prisma.voter.create({
      data: {
        serialNumber: 2,
        epicNumber: `P1-EPIC-B-${Date.now()}`,
        name: 'Voter B In Constituency B',
        fatherHusbandName: 'Father B',
        houseNumber: '2-200',
        gender: 'FEMALE',
        age: 28,
        constituencyId: constituencyB.id,
        mandalId: mandalB.id,
        villageId: villageB.id,
        boothId: boothB.id,
      },
    });

    // 3. Create Users
    superAdminUser = await prisma.user.findFirst({ where: { role: RoleType.SUPER_ADMIN } });
    if (!superAdminUser) {
      superAdminUser = await prisma.user.create({
        data: {
          userCode: `P1-SA-${Date.now()}`,
          name: 'P1 Super Administrator',
          mobileNumber: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
          role: RoleType.SUPER_ADMIN,
        },
      });
    }

    ciUserA = await prisma.user.create({
      data: {
        userCode: `P1-CIA-${Date.now()}`,
        name: 'Constituency Incharge A',
        mobileNumber: `97${Math.floor(10000000 + Math.random() * 90000000)}`,
        role: RoleType.CONSTITUENCY_INCHARGE,
        unitId: orgUnitA.id,
      },
    });

    await prisma.userHierarchyAssignment.create({
      data: {
        userId: ciUserA.id,
        roleType: RoleType.CONSTITUENCY_INCHARGE,
        constituencyId: constituencyA.id,
        isActive: true,
      },
    });

    ciUserB = await prisma.user.create({
      data: {
        userCode: `P1-CIB-${Date.now()}`,
        name: 'Constituency Incharge B',
        mobileNumber: `96${Math.floor(10000000 + Math.random() * 90000000)}`,
        role: RoleType.CONSTITUENCY_INCHARGE,
        unitId: orgUnitB.id,
      },
    });

    await prisma.userHierarchyAssignment.create({
      data: {
        userId: ciUserB.id,
        roleType: RoleType.CONSTITUENCY_INCHARGE,
        constituencyId: constituencyB.id,
        isActive: true,
      },
    });

    // Subordinate incharge in Constituency B to test cross-jurisdiction delete
    subUserB = await prisma.user.create({
      data: {
        userCode: `P1-BOOTH-B-${Date.now()}`,
        name: 'Booth Incharge B',
        mobileNumber: `95${Math.floor(10000000 + Math.random() * 90000000)}`,
        role: RoleType.BOOTH_INCHARGE,
      },
    });

    assignmentB = await prisma.userHierarchyAssignment.create({
      data: {
        userId: subUserB.id,
        roleType: RoleType.BOOTH_INCHARGE,
        constituencyId: constituencyB.id,
        boothId: boothB.id,
        isActive: true,
      },
    });

    // 4. Tasks for A and B
    taskA = await prisma.task.create({
      data: {
        title: 'Task in Constituency A',
        description: 'Authorized task for A',
        priority: TaskPriority.MEDIUM,
        constituencyId: constituencyA.id,
        unitId: orgUnitA.id,
        createdById: ciUserA.id,
      },
    });

    taskB = await prisma.task.create({
      data: {
        title: 'Task in Constituency B',
        description: 'Unauthorized task for A',
        priority: TaskPriority.HIGH,
        constituencyId: constituencyB.id,
        unitId: orgUnitB.id,
        createdById: ciUserB.id,
      },
    });

    // 5. Cadre in Constituency B
    cadreUserB = await prisma.user.create({
      data: {
        userCode: `P1-CADRE-B-${Date.now()}`,
        name: 'Cadre Worker B',
        mobileNumber: `94${Math.floor(10000000 + Math.random() * 90000000)}`,
        role: RoleType.VOLUNTEER,
        unitId: orgUnitB.id,
      },
    });

    cadreB = await prisma.cadre.create({
      data: {
        userId: cadreUserB.id,
        performanceScore: 50,
      },
    });

    // 6. Poll in B
    pollB = await prisma.poll.create({
      data: {
        title: 'Poll in Constituency B',
        unitId: orgUnitB.id,
        createdById: ciUserB.id,
        status: 'PUBLISHED',
      },
    });

    // 7. Data import in B
    importB = await prisma.dataImport.create({
      data: {
        applicationId: appRecord.id,
        fileName: 'constituency_b_voters.csv',
        fileSize: 1024,
        targetConstituencyId: constituencyB.id,
        uploadedById: ciUserB.id,
        status: ImportJobStatus.COMPLETED,
        totalRecords: 100,
        validRecords: 100,
      },
    });

    // 8. Generate JWTs
    const saSession = await createAuthenticatedTestSession({
      userId: superAdminUser.id,
      userCode: superAdminUser.userCode,
      role: superAdminUser.role,
      mobileNumber: superAdminUser.mobileNumber,
    });
    superAdminToken = saSession.token;

    const ciSessionA = await createAuthenticatedTestSession({
      userId: ciUserA.id,
      userCode: ciUserA.userCode,
      role: ciUserA.role,
      mobileNumber: ciUserA.mobileNumber,
    });
    ciTokenA = ciSessionA.token;

    const ciSessionB = await createAuthenticatedTestSession({
      userId: ciUserB.id,
      userCode: ciUserB.userCode,
      role: ciUserB.role,
      mobileNumber: ciUserB.mobileNumber,
    });
    ciTokenB = ciSessionB.token;
  });

  after(async () => {
    await app.close();
  });

  // =========================================================================
  // Requirement 1: Constituency incharge cannot delete another constituency's incharge assignment
  // =========================================================================
  it("1. Constituency incharge cannot delete another constituency's incharge assignment", async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/applications/${appRecord.id}/incharges/${assignmentB.id}`,
      headers: { authorization: `Bearer ${ciTokenA}` },
    });

    assert.equal(res.statusCode, 403, 'Must return 403 Forbidden for cross-constituency assignment delete');
    const body = res.json();
    assert.equal(body.success, false);

    // Verify assignment still exists
    const check = await prisma.userHierarchyAssignment.findUnique({
      where: { id: assignmentB.id },
    });
    assert.ok(check, 'Assignment must not be deleted');
  });

  // =========================================================================
  // Requirement 2: Constituency incharge cannot assign SUPER_ADMIN
  // =========================================================================
  it('2. Constituency incharge cannot assign SUPER_ADMIN', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/applications/${appRecord.id}/incharges`,
      headers: { authorization: `Bearer ${ciTokenA}` },
      payload: {
        role: 'SUPER_ADMIN',
        unitLevel: 'CONSTITUENCY',
        unitId: constituencyA.id,
        name: 'Escalated Super Admin',
        mobileNumber: '9123456780',
      },
    });

    assert.equal(res.statusCode, 403, 'Must return 403 when trying to assign SUPER_ADMIN');
    const body = res.json();
    assert.equal(body.success, false);
  });

  // =========================================================================
  // Requirement 3: Constituency incharge cannot assign STATE_ADMIN
  // =========================================================================
  it('3. Constituency incharge cannot assign STATE_ADMIN', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/applications/${appRecord.id}/incharges`,
      headers: { authorization: `Bearer ${ciTokenA}` },
      payload: {
        role: 'STATE_ADMIN',
        unitLevel: 'CONSTITUENCY',
        unitId: constituencyA.id,
        name: 'Escalated State Admin',
        mobileNumber: '9123456781',
      },
    });

    assert.equal(res.statusCode, 403, 'Must return 403 when trying to assign STATE_ADMIN');
    const body = res.json();
    assert.equal(body.success, false);
  });

  // =========================================================================
  // Requirement 4: Constituency incharge cannot assign an incharge outside its hierarchy
  // =========================================================================
  it('4. Constituency incharge cannot assign an incharge outside its hierarchy', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/applications/${appRecord.id}/incharges`,
      headers: { authorization: `Bearer ${ciTokenA}` },
      payload: {
        role: 'BOOTH_INCHARGE',
        unitLevel: 'CONSTITUENCY',
        unitId: constituencyB.id, // Outside constituency A
        name: 'Cross Jurisdiction Incharge',
        mobileNumber: '9123456782',
      },
    });

    assert.equal(res.statusCode, 403, 'Must return 403 when assigning incharge to an unauthorized jurisdiction');
    const body = res.json();
    assert.equal(body.success, false);
  });

  // =========================================================================
  // Requirement 5: Unauthorized unitId cannot bypass report scope
  // =========================================================================
  it('5. Unauthorized unitId cannot bypass report scope', async () => {
    // 5a. GET with unauthorized unitId
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/reports/ground?unitId=${orgUnitB.id}`,
      headers: { authorization: `Bearer ${ciTokenA}` },
    });
    assert.equal(getRes.statusCode, 403, 'GET /reports/ground with unauthorized unitId must return 403');

    // 5b. POST with unauthorized unitId
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/reports/ground',
      headers: { authorization: `Bearer ${ciTokenA}` },
      payload: {
        reportType: GroundReportType.COMPLAINT_ISSUE,
        priority: TaskPriority.HIGH,
        description: 'Unauthorized Ground Report Injection',
        unitId: orgUnitB.id,
      },
    });
    assert.equal(postRes.statusCode, 403, 'POST /reports/ground with unauthorized unitId must return 403');
  });

  // =========================================================================
  // Requirement 6: Unauthorized boothId cannot bypass voter scope
  // =========================================================================
  it('6. Unauthorized boothId cannot bypass voter scope', async () => {
    // Application voters endpoint
    const appVotersRes = await app.inject({
      method: 'GET',
      url: `/api/applications/${appRecord.id}/voters?boothId=${boothB.id}`,
      headers: { authorization: `Bearer ${ciTokenA}` },
    });
    assert.equal(appVotersRes.statusCode, 200);
    const appVoters = Array.isArray(appVotersRes.json().data) ? appVotersRes.json().data : (appVotersRes.json().data?.items ?? []);
    assert.equal(appVoters.length, 0, 'Unauthorized boothId must return 0 voters from other constituency');

    // Main voters endpoint
    const votersRes = await app.inject({
      method: 'GET',
      url: `/api/voters?boothId=${boothB.id}`,
      headers: { authorization: `Bearer ${ciTokenA}` },
    });
    assert.equal(votersRes.statusCode, 200);
    const voters = Array.isArray(votersRes.json().data) ? votersRes.json().data : (votersRes.json().data?.items ?? []);
    assert.equal(voters.length, 0, 'Unauthorized boothId on /api/voters must return 0 voters');
  });

  // =========================================================================
  // Requirement 7: Unauthorized mandalId cannot bypass voter scope
  // =========================================================================
  it('7. Unauthorized mandalId cannot bypass voter scope', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/applications/${appRecord.id}/voters?mandalId=${mandalB.id}`,
      headers: { authorization: `Bearer ${ciTokenA}` },
    });
    assert.equal(res.statusCode, 200);
    const appVoters = Array.isArray(res.json().data) ? res.json().data : (res.json().data?.items ?? []);
    assert.equal(appVoters.length, 0, 'Must not return voters from unauthorized mandal');

    const votersRes = await app.inject({
      method: 'GET',
      url: `/api/voters?mandalId=${mandalB.id}`,
      headers: { authorization: `Bearer ${ciTokenA}` },
    });
    assert.equal(votersRes.statusCode, 200);
    const voters = Array.isArray(votersRes.json().data) ? votersRes.json().data : (votersRes.json().data?.items ?? []);
    assert.equal(voters.length, 0, 'Must not return voters from unauthorized mandal on /api/voters');
  });

  // =========================================================================
  // Requirement 8: Unauthorized villageId cannot bypass voter scope
  // =========================================================================
  it('8. Unauthorized villageId cannot bypass voter scope', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/applications/${appRecord.id}/voters?villageId=${villageB.id}`,
      headers: { authorization: `Bearer ${ciTokenA}` },
    });
    assert.equal(res.statusCode, 200);
    const appVoters = Array.isArray(res.json().data) ? res.json().data : (res.json().data?.items ?? []);
    assert.equal(appVoters.length, 0, 'Must not return voters from unauthorized village');

    const votersRes = await app.inject({
      method: 'GET',
      url: `/api/voters?villageId=${villageB.id}`,
      headers: { authorization: `Bearer ${ciTokenA}` },
    });
    assert.equal(votersRes.statusCode, 200);
    const voters = Array.isArray(votersRes.json().data) ? votersRes.json().data : (votersRes.json().data?.items ?? []);
    assert.equal(voters.length, 0, 'Must not return voters from unauthorized village on /api/voters');
  });

  // =========================================================================
  // Requirement 9: Unauthorized task cannot be read
  // =========================================================================
  it('9. Unauthorized task cannot be read', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/tasks/${taskB.id}`,
      headers: { authorization: `Bearer ${ciTokenA}` },
    });
    assert.equal(res.statusCode, 403, 'Must return 403 when reading a task outside actor hierarchy');
  });

  // =========================================================================
  // Requirement 10: Unauthorized task cannot be modified
  // =========================================================================
  it('10. Unauthorized task cannot be modified', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${taskB.id}`,
      headers: { authorization: `Bearer ${ciTokenA}` },
      payload: {
        title: 'Tampered Title Outside Jurisdiction',
      },
    });
    assert.equal(res.statusCode, 403, 'Must return 403 when updating a task outside actor hierarchy');

    const check = await prisma.task.findUnique({ where: { id: taskB.id } });
    assert.equal(check?.title, 'Task in Constituency B', 'Task title must remain unchanged');
  });

  // =========================================================================
  // Requirement 11: Unauthorized task cannot be reassigned/completed
  // =========================================================================
  it('11. Unauthorized task cannot be reassigned or completed', async () => {
    // 11a. Assign
    const assignRes = await app.inject({
      method: 'POST',
      url: `/api/tasks/${taskB.id}/assign`,
      headers: { authorization: `Bearer ${ciTokenA}` },
      payload: {
        userIds: [ciUserA.id],
      },
    });
    assert.equal(assignRes.statusCode, 403, 'Must return 403 on reassigning unauthorized task');

    // 11b. Complete
    const completeRes = await app.inject({
      method: 'POST',
      url: `/api/tasks/${taskB.id}/complete`,
      headers: { authorization: `Bearer ${ciTokenA}` },
    });
    assert.equal(completeRes.statusCode, 403, 'Must return 403 on completing unauthorized task');

    const check = await prisma.task.findUnique({ where: { id: taskB.id } });
    assert.notEqual(check?.status, TaskStatus.COMPLETED, 'Task must not be completed');
  });

  // =========================================================================
  // Requirement 12: Unauthorized cadre cannot be modified
  // =========================================================================
  it('12. Unauthorized cadre cannot be modified', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/cadre/${cadreB.id}`,
      headers: { authorization: `Bearer ${ciTokenA}` },
      payload: {
        performanceScore: 99,
      },
    });
    assert.equal(res.statusCode, 403, 'Must return 403 when updating cadre from another jurisdiction');

    const check = await prisma.cadre.findUnique({ where: { id: cadreB.id } });
    assert.equal(check?.performanceScore, 50, 'Cadre performance score must remain unchanged');
  });

  // =========================================================================
  // Requirement 13: Unauthorized poll cannot be closed
  // =========================================================================
  it('13. Unauthorized poll cannot be closed', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/polls/${pollB.id}/close`,
      headers: { authorization: `Bearer ${ciTokenA}` },
    });
    assert.equal(res.statusCode, 403, 'Must return 403 when attempting to close poll outside actor jurisdiction');

    const check = await prisma.poll.findUnique({ where: { id: pollB.id } });
    assert.equal(check?.status, 'PUBLISHED', 'Poll status must remain PUBLISHED');
  });

  // =========================================================================
  // Requirement 14: Unauthorized import cannot be inspected/downloaded
  // =========================================================================
  it('14. Unauthorized import cannot be inspected or downloaded', async () => {
    // 14a. Get import details
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/applications/${appRecord.id}/data/imports/${importB.id}`,
      headers: { authorization: `Bearer ${ciTokenA}` },
    });
    assert.equal(getRes.statusCode, 403, 'Must return 403 when inspecting another constituency import');

    // 14b. Get import errors
    const errRes = await app.inject({
      method: 'GET',
      url: `/api/applications/${appRecord.id}/data/imports/${importB.id}/errors`,
      headers: { authorization: `Bearer ${ciTokenA}` },
    });
    assert.equal(errRes.statusCode, 403, 'Must return 403 when inspecting another constituency import errors');

    // 14c. Download error report
    const dlRes = await app.inject({
      method: 'GET',
      url: `/api/applications/${appRecord.id}/data/imports/${importB.id}/error-report`,
      headers: { authorization: `Bearer ${ciTokenA}` },
    });
    assert.equal(dlRes.statusCode, 403, 'Must return 403 when downloading another constituency error report');
  });

  // =========================================================================
  // Requirement 15: Lower-level users cannot read unrelated audit logs
  // =========================================================================
  it('15. Lower-level users cannot read unrelated audit logs', async () => {
    // Create an audit log for Unit B
    await prisma.auditLog.create({
      data: {
        action: AuditAction.UPDATE,
        entityType: 'TestEntityB',
        entityId: 'test-entity-b-id',
        userId: ciUserB.id,
        unitId: orgUnitB.id,
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/audit',
      headers: { authorization: `Bearer ${ciTokenA}` },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    const items = Array.isArray(body.data) ? body.data : (body.data?.items ?? []);

    // Verify none of the items belong to unit B
    for (const item of items) {
      assert.notEqual(item.unitId, orgUnitB.id, 'Must not return audit logs for unit B to CI of unit A');
      if (item.user) {
        assert.equal(item.user.passwordHash, undefined, 'User passwordHash must not be exposed');
        assert.equal(item.user.mobileNumber, undefined, 'User mobileNumber must not be exposed in audit logs');
        assert.equal(item.user.email, undefined, 'User email must not be exposed in audit logs');
      }
    }
  });

  // =========================================================================
  // Requirement 16: Authorized/global roles retain their existing legitimate behavior
  // =========================================================================
  it('16. Authorized and global roles retain existing legitimate behavior', async () => {
    // 16a. CI user can read their own task
    const ownTaskRes = await app.inject({
      method: 'GET',
      url: `/api/tasks/${taskA.id}`,
      headers: { authorization: `Bearer ${ciTokenA}` },
    });
    assert.equal(ownTaskRes.statusCode, 200, 'CI user must be able to read their own task');

    // 16b. CI user can complete their own task
    const completeOwnTaskRes = await app.inject({
      method: 'POST',
      url: `/api/tasks/${taskA.id}/complete`,
      headers: { authorization: `Bearer ${ciTokenA}` },
    });
    assert.equal(completeOwnTaskRes.statusCode, 200, 'CI user must be able to complete their own task');

    // 16c. SuperAdmin can access task in B
    const saTaskRes = await app.inject({
      method: 'GET',
      url: `/api/tasks/${taskB.id}`,
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(saTaskRes.statusCode, 200, 'SuperAdmin must be able to read any task');

    // 16d. SuperAdmin can close poll in B
    const saPollRes = await app.inject({
      method: 'PATCH',
      url: `/api/polls/${pollB.id}/close`,
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(saPollRes.statusCode, 200, 'SuperAdmin must be able to close any poll');

    // 16e. SuperAdmin can inspect import in B
    const saImportRes = await app.inject({
      method: 'GET',
      url: `/api/applications/${appRecord.id}/data/imports/${importB.id}`,
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(saImportRes.statusCode, 200, 'SuperAdmin must be able to inspect any import');

    // 16f. SuperAdmin has global audit log visibility
    const saAuditRes = await app.inject({
      method: 'GET',
      url: '/api/audit',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(saAuditRes.statusCode, 200, 'SuperAdmin must be able to view global audit logs');
  });

  after(async () => {
    try {
      if (taskA?.id || taskB?.id) {
        const ids = [taskA?.id, taskB?.id].filter(Boolean);
        await prisma.taskStatusHistory.deleteMany({ where: { taskId: { in: ids } } });
        await prisma.taskAssignment.deleteMany({ where: { taskId: { in: ids } } });
        await prisma.task.deleteMany({ where: { id: { in: ids } } });
      }
      if (pollB?.id) {
        await prisma.pollVote.deleteMany({ where: { pollId: pollB.id } });
        await prisma.pollOption.deleteMany({ where: { pollId: pollB.id } });
        await prisma.poll.deleteMany({ where: { id: pollB.id } });
      }
      if (importB?.id) await prisma.dataImport.deleteMany({ where: { id: importB.id } });
      if (cadreB?.id) await prisma.cadre.deleteMany({ where: { id: cadreB.id } });
      if (cadreUserB?.id) await prisma.user.deleteMany({ where: { id: cadreUserB.id } });
      if (subUserB?.id) {
        await prisma.userHierarchyAssignment.deleteMany({ where: { userId: subUserB.id } });
        await prisma.user.deleteMany({ where: { id: subUserB.id } });
      }
      if (ciUserA?.id || ciUserB?.id) {
        const ciIds = [ciUserA?.id, ciUserB?.id].filter(Boolean);
        await prisma.userHierarchyAssignment.deleteMany({ where: { userId: { in: ciIds } } });
        await prisma.user.deleteMany({ where: { id: { in: ciIds } } });
      }
      if (voterA?.id || voterB?.id) {
        const vIds = [voterA?.id, voterB?.id].filter(Boolean);
        await prisma.voter.deleteMany({ where: { id: { in: vIds } } });
      }
      if (boothA?.id || boothB?.id) {
        const bIds = [boothA?.id, boothB?.id].filter(Boolean);
        await prisma.booth.deleteMany({ where: { id: { in: bIds } } });
      }
      if (villageA?.id || villageB?.id) {
        const vilIds = [villageA?.id, villageB?.id].filter(Boolean);
        await prisma.village.deleteMany({ where: { id: { in: vilIds } } });
      }
      if (mandalA?.id || mandalB?.id) {
        const mIds = [mandalA?.id, mandalB?.id].filter(Boolean);
        await prisma.mandal.deleteMany({ where: { id: { in: mIds } } });
      }
      if (orgUnitA?.id || orgUnitB?.id) {
        const uIds = [orgUnitA?.id, orgUnitB?.id].filter(Boolean);
        await prisma.organizationUnit.deleteMany({ where: { id: { in: uIds } } });
      }
      if (constituencyA?.id || constituencyB?.id) {
        const cIds = [constituencyA?.id, constituencyB?.id].filter(Boolean);
        await prisma.constituency.deleteMany({ where: { id: { in: cIds } } });
      }
    } catch {
      // ignore errors during cleanup
    } finally {
      if (app) await app.close();
    }
  });
});
