import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { createAuthenticatedTestSession } from '../middleware/auth.js';
import { ImportJobStatus, RoleType } from '@prisma/client';

describe('P1-C Data Integrity, Scope Enforcement & Import Safety Suite (24 Invariants)', () => {
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
  let boothA: any;
  let appRecord: any;

  before(async () => {
    app = buildApp();
    await app.ready();

    // 1. Geography hierarchy
    stateRecord = await prisma.state.findFirst();
    if (!stateRecord) {
      stateRecord = await prisma.state.create({
        data: { name: 'P1C-Test-State', code: `P1CS-${Date.now()}` },
      });
    }

    zoneRecord = await prisma.zone.findFirst({ where: { stateId: stateRecord.id } });
    if (!zoneRecord) {
      zoneRecord = await prisma.zone.create({
        data: { name: 'P1C-Test-Zone', code: `P1CZ-${Date.now()}`, stateId: stateRecord.id },
      });
    }

    parliamentRecord = await prisma.parliament.findFirst({ where: { zoneId: zoneRecord.id } });
    if (!parliamentRecord) {
      parliamentRecord = await prisma.parliament.create({
        data: { name: 'P1C-Test-Parliament', code: `P1CP-${Date.now()}`, zoneId: zoneRecord.id },
      });
    }

    constituencyA = await prisma.constituency.create({
      data: { name: 'P1C-Constituency-A', code: `P1CA-${Date.now()}`, parliamentId: parliamentRecord.id },
    });

    constituencyB = await prisma.constituency.create({
      data: { name: 'P1C-Constituency-B', code: `P1CB-${Date.now()}`, parliamentId: parliamentRecord.id },
    });

    mandalA = await prisma.mandal.create({
      data: { name: 'P1C-Mandal-A', code: `P1CMA-${Date.now()}`, constituencyId: constituencyA.id },
    });
    mandalB = await prisma.mandal.create({
      data: { name: 'P1C-Mandal-B', code: `P1CMB-${Date.now()}`, constituencyId: constituencyB.id },
    });

    villageA = await prisma.village.create({
      data: { name: 'P1C-Village-A', code: `P1CVA-${Date.now()}`, mandalId: mandalA.id },
    });

    boothA = await prisma.booth.create({
      data: { code: `P1CBA-${Date.now()}`, boothNumber: '101', name: 'P1C-Booth-A', villageId: villageA.id },
    });

    appRecord = await prisma.cMSConfiguration.findFirst();
    if (!appRecord) {
      appRecord = await prisma.cMSConfiguration.create({
        data: {
          organisationName: 'P1C Test Org',
          stateName: 'Andhra Pradesh',
          hierarchyLabels: {},
          featureToggles: {},
        },
      });
    }

    // 2. Initial baseline voters in Constituency A
    for (let i = 1; i <= 5; i++) {
      await prisma.voter.create({
        data: {
          serialNumber: i,
          epicNumber: `P1C-BASELINE-A-${i}-${Date.now()}`,
          name: `Baseline Voter A ${i}`,
          fatherHusbandName: 'Parent',
          houseNumber: `${i}-10`,
          gender: 'MALE',
          age: 25 + i,
          constituencyId: constituencyA.id,
          mandalId: mandalA.id,
          villageId: villageA.id,
          boothId: boothA.id,
        },
      });
    }

    // 3. Initial baseline voters in Constituency B
    for (let i = 1; i <= 3; i++) {
      await prisma.voter.create({
        data: {
          serialNumber: i,
          epicNumber: `P1C-BASELINE-B-${i}-${Date.now()}`,
          name: `Baseline Voter B ${i}`,
          fatherHusbandName: 'Parent',
          houseNumber: `${i}-20`,
          gender: 'FEMALE',
          age: 30 + i,
          constituencyId: constituencyB.id,
          mandalId: mandalB.id,
        },
      });
    }

    // 4. Users
    superAdminUser = await prisma.user.findFirst({ where: { role: RoleType.SUPER_ADMIN } });
    if (!superAdminUser) {
      superAdminUser = await prisma.user.create({
        data: {
          userCode: `P1C-SA-${Date.now()}`,
          name: 'P1C Super Admin',
          mobileNumber: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
          role: RoleType.SUPER_ADMIN,
        },
      });
    }

    ciUserA = await prisma.user.create({
      data: {
        userCode: `P1C-CIA-${Date.now()}`,
        name: 'Incharge of Constituency A',
        mobileNumber: `97${Math.floor(10000000 + Math.random() * 90000000)}`,
        role: RoleType.CONSTITUENCY_INCHARGE,
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
        userCode: `P1C-CIB-${Date.now()}`,
        name: 'Incharge of Constituency B',
        mobileNumber: `96${Math.floor(10000000 + Math.random() * 90000000)}`,
        role: RoleType.CONSTITUENCY_INCHARGE,
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

    // Sessions
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
    // Clean up
    await prisma.voter.deleteMany({
      where: { constituencyId: { in: [constituencyA.id, constituencyB.id] } },
    });
    await prisma.booth.deleteMany({ where: { villageId: villageA.id } });
    await prisma.village.deleteMany({ where: { mandalId: mandalA.id } });
    await prisma.mandal.deleteMany({ where: { constituencyId: { in: [constituencyA.id, constituencyB.id] } } });
    await prisma.userHierarchyAssignment.deleteMany({
      where: { userId: { in: [ciUserA.id, ciUserB.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [ciUserA.id, ciUserB.id] } },
    });
    await prisma.constituency.deleteMany({
      where: { id: { in: [constituencyA.id, constituencyB.id] } },
    });
    await app.close();
  });

  // ==========================================================================
  // P1-C.1: CONSTITUENCY RESOLUTION (FAIL-CLOSED, NO SILENT FALLBACK)
  // ==========================================================================

  it('1. POST /api/voters/bulk-import with non-existent constituencyId returns 404', async () => {
    const fakeConstituencyId = '00000000-0000-0000-0000-000000000099';
    const res = await app.inject({
      method: 'POST',
      url: '/api/voters/bulk-import',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        constituencyId: fakeConstituencyId,
        mode: 'APPEND',
        data: [
          {
            epicNumber: `EPIC-FAKE-${Date.now()}`,
            name: 'Ghost Voter',
            fatherHusbandName: 'Ghost Father',
            gender: 'MALE',
            age: 30,
          },
        ],
      },
    });

    assert.equal(res.statusCode, 404);
    const json = JSON.parse(res.body);
    assert.equal(json.success, false);
    assert.equal(json.error?.code, 'CONSTITUENCY_NOT_FOUND');
  });

  it('2. Invalid constituency ID performs zero voter mutations', async () => {
    const fakeConstituencyId = 'non-existent-constituency-code';
    const countABefore = await prisma.voter.count({ where: { constituencyId: constituencyA.id } });
    const countBBefore = await prisma.voter.count({ where: { constituencyId: constituencyB.id } });

    const res = await app.inject({
      method: 'POST',
      url: '/api/voters/bulk-import',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        constituencyId: fakeConstituencyId,
        mode: 'APPEND',
        data: [
          {
            epicNumber: `EPIC-MUT-TEST-${Date.now()}`,
            name: 'No Mutation Voter',
            fatherHusbandName: 'Father',
            gender: 'MALE',
            age: 29,
          },
        ],
      },
    });

    assert.equal(res.statusCode, 404);

    const countAAfter = await prisma.voter.count({ where: { constituencyId: constituencyA.id } });
    const countBAfter = await prisma.voter.count({ where: { constituencyId: constituencyB.id } });

    assert.equal(countAAfter, countABefore, 'Constituency A voter count must not change');
    assert.equal(countBAfter, countBBefore, 'Constituency B voter count must not change');
  });

  it('3. Invalid constituency ID cannot trigger REPLACE deletion', async () => {
    const fakeConstituencyId = '00000000-0000-0000-0000-000000000099';
    const countABefore = await prisma.voter.count({ where: { constituencyId: constituencyA.id } });
    assert.ok(countABefore > 0, 'Constituency A has baseline voters');

    const res = await app.inject({
      method: 'POST',
      url: '/api/voters/bulk-import',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        constituencyId: fakeConstituencyId,
        mode: 'REPLACE',
        data: [
          {
            epicNumber: `EPIC-REPLACE-GHOST-${Date.now()}`,
            name: 'Ghost Replacement',
            fatherHusbandName: 'Father',
            gender: 'FEMALE',
            age: 22,
          },
        ],
      },
    });

    assert.equal(res.statusCode, 404);

    const countAAfter = await prisma.voter.count({ where: { constituencyId: constituencyA.id } });
    assert.equal(countAAfter, countABefore, 'Constituency A baseline voters must remain completely intact');
  });

  it('4. Explicit constituency ID resolves only that exact target', async () => {
    const targetEpic = `EPIC-EXACT-${Date.now()}`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/voters/bulk-import',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        constituencyId: constituencyA.id,
        mode: 'APPEND',
        data: [
          {
            epicNumber: targetEpic,
            name: 'Targeted Voter',
            fatherHusbandName: 'Father',
            gender: 'MALE',
            age: 33,
            mandalName: 'P1C-Mandal-A',
          },
        ],
      },
    });

    assert.equal(res.statusCode, 200);

    const voter = await prisma.voter.findFirst({ where: { epicNumber: targetEpic } });
    assert.ok(voter, 'Voter was inserted');
    assert.equal(voter.constituencyId, constituencyA.id, 'Voter belongs strictly to target constituency');
    assert.notEqual(voter.constituencyId, constituencyB.id, 'Voter does not belong to another constituency');
  });

  // ==========================================================================
  // P1-C.2: HIERARCHY SCOPE ENFORCEMENT ON MUTATION ENDPOINTS
  // ==========================================================================

  it('5. Constituency A incharge cannot import into Constituency B (403 FORBIDDEN_SCOPE)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/voters/bulk-import',
      headers: { authorization: `Bearer ${ciTokenA}` },
      payload: {
        constituencyId: constituencyB.id,
        mode: 'APPEND',
        data: [
          {
            epicNumber: `EPIC-CROSS-IMPORT-${Date.now()}`,
            name: 'Cross Jurisdiction Voter',
            fatherHusbandName: 'Father',
            gender: 'FEMALE',
            age: 24,
          },
        ],
      },
    });

    assert.equal(res.statusCode, 403);
    const json = JSON.parse(res.body);
    assert.equal(json.error?.code, 'FORBIDDEN_SCOPE');
  });

  it('6. Constituency A incharge cannot REPLACE Constituency B (403 and zero deletion)', async () => {
    const countBBefore = await prisma.voter.count({ where: { constituencyId: constituencyB.id } });
    assert.ok(countBBefore > 0, 'Constituency B has voters');

    const res = await app.inject({
      method: 'POST',
      url: '/api/voters/bulk-import',
      headers: { authorization: `Bearer ${ciTokenA}` },
      payload: {
        constituencyId: constituencyB.id,
        mode: 'REPLACE',
        data: [
          {
            epicNumber: `EPIC-UNAUTH-REPLACE-${Date.now()}`,
            name: 'Unauthorized Replacement',
            fatherHusbandName: 'Father',
            gender: 'MALE',
            age: 35,
          },
        ],
      },
    });

    assert.equal(res.statusCode, 403);

    const countBAfter = await prisma.voter.count({ where: { constituencyId: constituencyB.id } });
    assert.equal(countBAfter, countBBefore, 'Constituency B voters must be completely untouched');
  });

  it('7. Constituency A incharge cannot bulk-import incharges into Constituency B (403)', async () => {
    const mobileToAttempt = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/cms/incharges/bulk-import',
      headers: { authorization: `Bearer ${ciTokenA}` },
      payload: {
        constituencyId: constituencyB.id,
        level: 'CONSTITUENCY',
        rows: [
          {
            name: 'Intruder Incharge',
            mobile: mobileToAttempt,
            designation: 'Constituency Incharge',
          },
        ],
      },
    });

    assert.equal(res.statusCode, 403);
    const json = JSON.parse(res.body);
    assert.equal(json.error?.code, 'FORBIDDEN_SCOPE');

    // Confirm no user was created
    const createdUser = await prisma.user.findFirst({ where: { mobileNumber: mobileToAttempt } });
    assert.equal(createdUser, null, 'No user record must be created on 403');
  });

  it('8. Constituency A incharge cannot import via POST /api/applications/:appId/data/import into Constituency B', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/applications/${appRecord.id}/data/import`,
      headers: { authorization: `Bearer ${ciTokenA}` },
      payload: {
        targetConstituencyId: constituencyB.id,
        mode: 'APPEND',
        rows: [
          {
            epicNumber: `EPIC-APP-CROSS-${Date.now()}`,
            name: 'App Cross Voter',
            fatherHusbandName: 'Father',
            gender: 'MALE',
            age: 31,
          },
        ],
      },
    });

    assert.equal(res.statusCode, 403);
    const json = JSON.parse(res.body);
    assert.equal(json.error?.code, 'FORBIDDEN_SCOPE');
  });

  it('9. Global roles (SUPER_ADMIN) retain cross-constituency access', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/voters/bulk-import',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        constituencyId: constituencyB.id,
        mode: 'APPEND',
        data: [
          {
            epicNumber: `EPIC-GLOBAL-OK-${Date.now()}`,
            name: 'Global Permitted Voter',
            fatherHusbandName: 'Father',
            gender: 'FEMALE',
            age: 26,
            mandalName: 'P1C-Mandal-B',
          },
        ],
      },
    });

    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.success, true);
  });

  // ==========================================================================
  // P1-C.3 & P1-C.4: REPLACE PRE-FLIGHT VALIDATION & ATOMICITY
  // ==========================================================================

  it('10. Invalid row in REPLACE dataset causes zero deletion in DB', async () => {
    const countBefore = await prisma.voter.count({ where: { constituencyId: constituencyA.id } });
    assert.ok(countBefore > 0);

    const res = await app.inject({
      method: 'POST',
      url: '/api/voters/bulk-import',
      headers: { authorization: `Bearer ${ciTokenA}` },
      payload: {
        constituencyId: constituencyA.id,
        mode: 'REPLACE',
        data: [
          {
            epicNumber: `EPIC-VALID-${Date.now()}`,
            name: 'Valid Voter One',
            fatherHusbandName: 'Father',
            gender: 'MALE',
            age: 27,
          },
          {
            // Missing name (invalid required field)
            epicNumber: `EPIC-INVALID-${Date.now()}`,
            name: '',
            fatherHusbandName: 'Father',
            gender: 'MALE',
            age: 28,
          },
        ],
      },
    });

    assert.equal(res.statusCode, 400);

    const countAfter = await prisma.voter.count({ where: { constituencyId: constituencyA.id } });
    assert.equal(countAfter, countBefore, 'Database MUST be completely untouched: original voters remain intact');
  });

  it('11. Duplicate EPIC in REPLACE dataset causes zero deletion in DB', async () => {
    const countBefore = await prisma.voter.count({ where: { constituencyId: constituencyA.id } });
    const duplicateEpic = `EPIC-DUP-${Date.now()}`;

    const res = await app.inject({
      method: 'POST',
      url: '/api/voters/bulk-import',
      headers: { authorization: `Bearer ${ciTokenA}` },
      payload: {
        constituencyId: constituencyA.id,
        mode: 'REPLACE',
        data: [
          {
            epicNumber: duplicateEpic,
            name: 'First Duplicate',
            fatherHusbandName: 'Father',
            gender: 'MALE',
            age: 25,
          },
          {
            epicNumber: duplicateEpic, // DUPLICATE EPIC IN SAME FILE
            name: 'Second Duplicate',
            fatherHusbandName: 'Father',
            gender: 'FEMALE',
            age: 26,
          },
        ],
      },
    });

    assert.equal(res.statusCode, 400);
    const json = JSON.parse(res.body);
    assert.ok(json.error?.message?.toLowerCase().includes('duplicate') || json.error?.code === 'DUPLICATE_EPIC_IN_FILE');

    const countAfter = await prisma.voter.count({ where: { constituencyId: constituencyA.id } });
    assert.equal(countAfter, countBefore, 'Pre-flight duplicate check prevented destructive deletion');
  });

  it('12. Successful REPLACE replaces dataset atomically', async () => {
    const replacementEpic1 = `EPIC-ATOM-1-${Date.now()}`;
    const replacementEpic2 = `EPIC-ATOM-2-${Date.now()}`;

    const res = await app.inject({
      method: 'POST',
      url: '/api/voters/bulk-import',
      headers: { authorization: `Bearer ${ciTokenA}` },
      payload: {
        constituencyId: constituencyA.id,
        mode: 'REPLACE',
        data: [
          {
            epicNumber: replacementEpic1,
            name: 'Replacement Voter One',
            fatherHusbandName: 'Father One',
            gender: 'MALE',
            age: 29,
          },
          {
            epicNumber: replacementEpic2,
            name: 'Replacement Voter Two',
            fatherHusbandName: 'Father Two',
            gender: 'FEMALE',
            age: 32,
          },
        ],
      },
    });

    assert.equal(res.statusCode, 200);

    const countAfter = await prisma.voter.count({ where: { constituencyId: constituencyA.id } });
    assert.equal(countAfter, 2, 'Constituency A now has exactly the 2 replacement voters');

    const voters = await prisma.voter.findMany({ where: { constituencyId: constituencyA.id } });
    const epics = voters.map((v) => v.epicNumber);
    assert.ok(epics.includes(replacementEpic1));
    assert.ok(epics.includes(replacementEpic2));
  });

  // ==========================================================================
  // P1-C.5: FULL DATASET VALIDATION (NO TRUNCATION AT ROW 1,000)
  // ==========================================================================

  it('13. Duplicate EPIC at row > 1,000 is detected and rejects import before deletion', async () => {
    const countBefore = await prisma.voter.count({ where: { constituencyId: constituencyA.id } });
    const duplicateEpic = `EPIC-FAR-DUP-${Date.now()}`;

    // Build 1,050 rows where row 1 and row 1,020 have duplicate EPICs
    const largeRows = [];
    for (let i = 1; i <= 1050; i++) {
      const epic = (i === 1 || i === 1020) ? duplicateEpic : `EPIC-BULK-${i}-${Date.now()}`;
      largeRows.push({
        epicNumber: epic,
        name: `Voter ${i}`,
        fatherHusbandName: `Parent ${i}`,
        gender: i % 2 === 0 ? 'FEMALE' : 'MALE',
        age: 20 + (i % 50),
      });
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/voters/bulk-import',
      headers: { authorization: `Bearer ${ciTokenA}` },
      payload: {
        constituencyId: constituencyA.id,
        mode: 'REPLACE',
        data: largeRows,
      },
    });

    assert.equal(res.statusCode, 400);
    const countAfter = await prisma.voter.count({ where: { constituencyId: constituencyA.id } });
    assert.equal(countAfter, countBefore, 'Validation covered all 1050 rows; zero deletion occurred');
  });

  it('14. Invalid row at row 1,025 is detected without truncation', async () => {
    const countBefore = await prisma.voter.count({ where: { constituencyId: constituencyA.id } });

    const largeRows = [];
    for (let i = 1; i <= 1030; i++) {
      largeRows.push({
        epicNumber: `EPIC-CHECK-${i}-${Date.now()}`,
        name: i === 1025 ? '' : `Voter ${i}`, // row 1025 has missing name
        fatherHusbandName: `Parent ${i}`,
        gender: 'MALE',
        age: 30,
      });
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/voters/bulk-import',
      headers: { authorization: `Bearer ${ciTokenA}` },
      payload: {
        constituencyId: constituencyA.id,
        mode: 'REPLACE',
        data: largeRows,
      },
    });

    assert.equal(res.statusCode, 400);
    const countAfter = await prisma.voter.count({ where: { constituencyId: constituencyA.id } });
    assert.equal(countAfter, countBefore, 'Row 1025 invalidity detected; zero deletion occurred');
  });

  // ==========================================================================
  // P1-C.9: CONCURRENT IMPORT PROTECTION & DATABASE ADVISORY LOCKING
  // ==========================================================================

  it('15. Simultaneous concurrent imports for the SAME constituency: exactly one acquires lock, other receives 409', async () => {
    // Both requests are launched concurrently via Promise.all without waiting for the first to finish
    const p1 = app.inject({
      method: 'POST',
      url: '/api/voters/bulk-import',
      headers: { authorization: `Bearer ${ciTokenA}` },
      payload: {
        constituencyId: constituencyA.id,
        mode: 'APPEND',
        data: [
          {
            epicNumber: `EPIC-RACE-1-${Date.now()}`,
            name: 'Racer One',
            fatherHusbandName: 'Father One',
            gender: 'MALE',
            age: 30,
            mandalName: 'P1C-Mandal-A',
          },
        ],
      },
    });

    const p2 = app.inject({
      method: 'POST',
      url: '/api/voters/bulk-import',
      headers: { authorization: `Bearer ${ciTokenA}` },
      payload: {
        constituencyId: constituencyA.id,
        mode: 'APPEND',
        data: [
          {
            epicNumber: `EPIC-RACE-2-${Date.now()}`,
            name: 'Racer Two',
            fatherHusbandName: 'Father Two',
            gender: 'FEMALE',
            age: 31,
            mandalName: 'P1C-Mandal-A',
          },
        ],
      },
    });

    const [res1, res2] = await Promise.all([p1, p2]);
    const statuses = [res1.statusCode, res2.statusCode].sort((a: number, b: number) => a - b);

    // Exactly one acquired the lock and completed (200), the other was rejected with 409
    assert.deepEqual(statuses, [200, 409], 'Exactly one import must acquire lock (200), other must receive 409');

    const conflictRes = res1.statusCode === 409 ? res1 : res2;
    const json = JSON.parse(conflictRes.body);
    assert.equal(json.error?.code, 'CONCURRENT_IMPORT_CONFLICT');
  });

  it('16. Concurrent imports for DIFFERENT constituencies proceed independently without blocking', async () => {
    // Both requests are launched simultaneously via Promise.all for different constituencies
    const pA = app.inject({
      method: 'POST',
      url: '/api/voters/bulk-import',
      headers: { authorization: `Bearer ${ciTokenA}` },
      payload: {
        constituencyId: constituencyA.id,
        mode: 'APPEND',
        data: [
          {
            epicNumber: `EPIC-INDEP-A-${Date.now()}`,
            name: 'Independent A Voter',
            fatherHusbandName: 'Father A',
            gender: 'MALE',
            age: 28,
            mandalName: 'P1C-Mandal-A',
          },
        ],
      },
    });

    const pB = app.inject({
      method: 'POST',
      url: '/api/voters/bulk-import',
      headers: { authorization: `Bearer ${ciTokenB}` },
      payload: {
        constituencyId: constituencyB.id,
        mode: 'APPEND',
        data: [
          {
            epicNumber: `EPIC-INDEP-B-${Date.now()}`,
            name: 'Independent B Voter',
            fatherHusbandName: 'Father B',
            gender: 'FEMALE',
            age: 29,
            mandalName: 'P1C-Mandal-B',
          },
        ],
      },
    });

    const [resA, resB] = await Promise.all([pA, pB]);

    // Both succeed independently
    assert.equal(resA.statusCode, 200, 'Constituency A import must succeed');
    assert.equal(resB.statusCode, 200, 'Constituency B import must succeed');
  });

  it('17. Active import running > 5 minutes does NOT become unlocked by arbitrary timestamp heuristic', async () => {
    // Create an active PROCESSING import record created 10 minutes ago
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const activeImport = await prisma.dataImport.create({
      data: {
        applicationId: appRecord.id,
        fileName: 'long_running_import.csv',
        fileSize: 4096,
        targetConstituencyId: constituencyA.id,
        uploadedById: ciUserA.id,
        status: 'PROCESSING',
        totalRecords: 1000,
        startedAt: tenMinutesAgo,
        createdAt: tenMinutesAgo,
      },
    });

    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/voters/bulk-import',
        headers: { authorization: `Bearer ${ciTokenA}` },
        payload: {
          constituencyId: constituencyA.id,
          mode: 'APPEND',
          data: [
            {
              epicNumber: `EPIC-TIMEOUT-CHECK-${Date.now()}`,
              name: 'Timeout Check Voter',
              fatherHusbandName: 'Father',
              gender: 'MALE',
              age: 35,
            },
          ],
        },
      });

      // Must NOT be unlocked merely because startedAt > 5 minutes ago!
      assert.equal(res.statusCode, 409, 'Import running > 5 minutes must remain protected');
      const json = JSON.parse(res.body);
      assert.equal(json.error?.code, 'CONCURRENT_IMPORT_CONFLICT');
    } finally {
      await prisma.dataImport.delete({ where: { id: activeImport.id } });
    }
  });

  // ==========================================================================
  // P1-C APPEND: PREVENT CROSS-CONSTITUENCY EPIC REASSIGNMENT
  // ==========================================================================

  it('18. APPEND update on existing voter in TARGET constituency succeeds and preserves core attributes', async () => {
    const targetEpic = `EPIC-TARGET-UPDATE-${Date.now()}`;
    const initialVoter = await prisma.voter.create({
      data: {
        serialNumber: 101,
        epicNumber: targetEpic,
        name: 'Original Name',
        fatherHusbandName: 'Original Father',
        gender: 'MALE',
        age: 30,
        houseNumber: '1-1',
        mobileNumber: '9988776655',
        constituencyId: constituencyA.id,
        mandalId: mandalA.id,
        villageId: villageA.id,
        boothId: boothA.id,
        voterStatus: 'ACTIVE',
        surveyStatus: 'NOT_SURVEYED',
        voteStatus: 'NOT_VOTED',
        inchargeAssessment: 'FAVORABLE',
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/voters/bulk-import',
      headers: { authorization: `Bearer ${ciTokenA}` },
      payload: {
        constituencyId: constituencyA.id,
        mode: 'APPEND',
        data: [
          {
            epicNumber: targetEpic,
            name: 'Updated Name',
            fatherHusbandName: 'Updated Father',
            gender: 'MALE',
            age: 31,
            doorNo: '1-2/A',
            politicalPreference: 'TDP',
          },
        ],
      },
    });

    assert.equal(res.statusCode, 200);

    const updatedVoter = await prisma.voter.findUnique({ where: { id: initialVoter.id } });
    assert.ok(updatedVoter);
    assert.equal(updatedVoter.id, initialVoter.id, 'Voter ID must be preserved');
    assert.equal(updatedVoter.serialNumber, 101, 'Serial number must be preserved');
    assert.equal(updatedVoter.constituencyId, constituencyA.id, 'Constituency ID preserved');
    assert.equal(updatedVoter.name, 'Updated Name', 'Name updated');
    assert.equal(updatedVoter.fatherHusbandName, 'Updated Father', 'Relative updated');
    assert.equal(updatedVoter.voterStatus, 'ACTIVE', 'Voter status preserved');
    assert.equal(updatedVoter.voteStatus, 'NOT_VOTED', 'Vote status preserved');
  });

  it('19. APPEND containing existing EPIC from ANOTHER constituency fails with 409 and does NOT reassign constituency', async () => {
    // Seed voter in Constituency B
    const epicInB = `EPIC-OWNED-BY-B-${Date.now()}`;
    const voterInB = await prisma.voter.create({
      data: {
        serialNumber: 999,
        houseNumber: '1-99',
        epicNumber: epicInB,
        name: 'Voter Belonging to B',
        fatherHusbandName: 'Father B',
        gender: 'FEMALE',
        age: 26,
        constituencyId: constituencyB.id,
        mandalId: mandalB.id,
      },
    });

    // Constituency A incharge attempts to APPEND import containing EPIC from Constituency B
    const res = await app.inject({
      method: 'POST',
      url: '/api/voters/bulk-import',
      headers: { authorization: `Bearer ${ciTokenA}` },
      payload: {
        constituencyId: constituencyA.id,
        mode: 'APPEND',
        data: [
          {
            epicNumber: epicInB,
            name: 'Hijacked Name',
            fatherHusbandName: 'Hijacked Father',
            gender: 'FEMALE',
            age: 27,
          },
        ],
      },
    });

    assert.equal(res.statusCode, 409, 'Cross-constituency EPIC collision must return 409 conflict');
    const json = JSON.parse(res.body);
    assert.equal(json.error?.code, 'EPIC_CROSS_CONSTITUENCY_CONFLICT');

    // Prove voter in Constituency B remains completely unchanged
    const voterAfter = await prisma.voter.findUnique({ where: { id: voterInB.id } });
    assert.ok(voterAfter);
    assert.equal(voterAfter.constituencyId, constituencyB.id, 'ConstituencyId MUST remain Constituency B');
    assert.equal(voterAfter.name, 'Voter Belonging to B', 'Voter name must NOT be overwritten');
    assert.equal(voterAfter.fatherHusbandName, 'Father B', 'Relative name must NOT be overwritten');
  });

  it('20. Cross-constituency conflict is detected in preflight and prevents all mutations in uploaded batch', async () => {
    // Seed voter in Constituency B
    const conflictEpic = `EPIC-CONFLICT-B-${Date.now()}`;
    await prisma.voter.create({
      data: {
        serialNumber: 998,
        houseNumber: '1-98',
        epicNumber: conflictEpic,
        name: 'Voter In B',
        fatherHusbandName: 'Father B',
        gender: 'FEMALE',
        age: 28,
        constituencyId: constituencyB.id,
        mandalId: mandalB.id,
      },
    });

    const newEpic = `EPIC-SHOULD-NOT-INSERT-${Date.now()}`;

    // Upload contains one new valid EPIC and one conflicting EPIC from Constituency B
    const res = await app.inject({
      method: 'POST',
      url: '/api/voters/bulk-import',
      headers: { authorization: `Bearer ${ciTokenA}` },
      payload: {
        constituencyId: constituencyA.id,
        mode: 'APPEND',
        data: [
          {
            epicNumber: newEpic,
            name: 'New Candidate Voter',
            fatherHusbandName: 'Father',
            gender: 'MALE',
            age: 24,
          },
          {
            epicNumber: conflictEpic,
            name: 'Conflicting Voter',
            fatherHusbandName: 'Father',
            gender: 'MALE',
            age: 25,
          },
        ],
      },
    });

    assert.equal(res.statusCode, 409);

    // Assert that the new EPIC was NOT inserted (zero partial mutations)
    const newVoter = await prisma.voter.findFirst({ where: { epicNumber: newEpic } });
    assert.equal(newVoter, null, 'Preflight conflict check must prevent partial row insertion');
  });

  it('21. Duplicate EPICs inside same file during APPEND mode reject with 400 before mutation', async () => {
    const dupEpic = `EPIC-APPEND-DUP-${Date.now()}`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/voters/bulk-import',
      headers: { authorization: `Bearer ${ciTokenA}` },
      payload: {
        constituencyId: constituencyA.id,
        mode: 'APPEND',
        data: [
          {
            epicNumber: dupEpic,
            name: 'Duplicate Voter First',
            fatherHusbandName: 'Father',
            gender: 'MALE',
            age: 32,
          },
          {
            epicNumber: dupEpic, // Duplicate in file
            name: 'Duplicate Voter Second',
            fatherHusbandName: 'Father',
            gender: 'MALE',
            age: 33,
          },
        ],
      },
    });

    assert.equal(res.statusCode, 400);
    const json = JSON.parse(res.body);
    assert.equal(json.error?.code, 'DUPLICATE_EPIC_IN_FILE');

    const created = await prisma.voter.findFirst({ where: { epicNumber: dupEpic } });
    assert.equal(created, null, 'Zero voters created on duplicate in file');
  });

  // ==========================================================================
  // P1-C ATOMICITY: PROVE TRANSACTION ROLLBACK UNDER ACTUAL DATABASE FAILURE
  // ==========================================================================

  it('22. REPLACE import rolls back fully when a database error occurs mid-transaction after deleteMany', async () => {
    // 1. Seed original baseline voters in Constituency A
    const baselineEpic1 = `EPIC-BASE-1-${Date.now()}`;
    const baselineEpic2 = `EPIC-BASE-2-${Date.now()}`;

    const originalVoter1 = await prisma.voter.create({
      data: {
        serialNumber: 1,
        houseNumber: '1-1',
        epicNumber: baselineEpic1,
        name: 'Original Baseline Voter 1',
        fatherHusbandName: 'Original Father 1',
        gender: 'MALE',
        age: 40,
        constituencyId: constituencyA.id,
        mandalId: mandalA.id,
      },
    });

    const originalVoter2 = await prisma.voter.create({
      data: {
        serialNumber: 2,
        houseNumber: '1-2',
        epicNumber: baselineEpic2,
        name: 'Original Baseline Voter 2',
        fatherHusbandName: 'Original Father 2',
        gender: 'FEMALE',
        age: 38,
        constituencyId: constituencyA.id,
        mandalId: mandalA.id,
      },
    });

    const expectedCountBefore = await prisma.voter.count({ where: { constituencyId: constituencyA.id } });

    const replacementEpic = `EPIC-REPLACE-ABORT-${Date.now()}`;
    const { BulkUploadService } = await import('../modules/voters/bulk-upload.service.js');

    let errorThrown = false;
    try {
      await BulkUploadService.importVotersFromData(
        constituencyA.id,
        [
          {
            epicNumber: replacementEpic,
            name: 'Replacement Voter That Should Roll Back',
            fatherHusbandName: 'Father',
            gender: 'MALE',
            age: 25,
          },
        ],
        {
          importMode: 'REPLACE',
          actorId: ciUserA.id,
          // Test seam: executed INSIDE transaction AFTER deleteMany but BEFORE replacement commits
          _testHookAfterDelete: async (tx) => {
            // Verify existing rows were indeed deleted INSIDE this active transaction
            const insideTxCount = await tx.voter.count({ where: { constituencyId: constituencyA.id } });
            assert.equal(insideTxCount, 0, 'Existing rows must be deleted inside the active transaction');

            // Force an intentional PostgreSQL database failure (division by zero)
            await tx.$queryRawUnsafe('SELECT 1 / 0');
          },
        }
      );
    } catch (err: any) {
      errorThrown = true;
      assert.ok(err.message.includes('division by zero') || err.code === '22012' || err.message);
    }

    assert.ok(errorThrown, 'Transaction must throw and abort on deliberate database failure');

    // 2. Query database state OUTSIDE the transaction
    const survivingVoters = await prisma.voter.findMany({
      where: { constituencyId: constituencyA.id },
      orderBy: { serialNumber: 'asc' },
    });

    // 3. Prove original rows are completely restored by PostgreSQL rollback!
    assert.equal(survivingVoters.length, expectedCountBefore, 'All original voter rows must be restored by PostgreSQL rollback');
    const restoredV1 = survivingVoters.find((v) => v.id === originalVoter1.id);
    const restoredV2 = survivingVoters.find((v) => v.id === originalVoter2.id);
    assert.ok(restoredV1, 'Original voter 1 must be present');
    assert.equal(restoredV1.epicNumber, originalVoter1.epicNumber, 'Original voter 1 EPIC restored');
    assert.equal(restoredV1.name, originalVoter1.name, 'Original voter 1 name restored');
    assert.ok(restoredV2, 'Original voter 2 must be present');
    assert.equal(restoredV2.epicNumber, originalVoter2.epicNumber, 'Original voter 2 EPIC restored');

    // 4. Prove no partial replacement rows remain
    const orphanReplacement = await prisma.voter.findFirst({ where: { epicNumber: replacementEpic } });
    assert.equal(orphanReplacement, null, 'No replacement rows must exist in database after rollback');
  });

  // ==========================================================================
  // P1-C.11: INCHARGE BULK IMPORT SAFETY & ATOMICITY
  // ==========================================================================

  it('23. POST /api/cms/incharges/bulk-import with invalid constituencyId fails with 404', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/cms/incharges/bulk-import',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        constituencyId: '00000000-0000-0000-0000-000000000099',
        level: 'CONSTITUENCY',
        rows: [
          {
            name: 'Nonexistent Incharge',
            mobile: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
            designation: 'Incharge',
          },
        ],
      },
    });

    assert.equal(res.statusCode, 404);
    const json = JSON.parse(res.body);
    assert.equal(json.error?.code, 'CONSTITUENCY_NOT_FOUND');
  });

  it('24. POST /api/cms/incharges/bulk-import persists assignments atomically in transaction', async () => {
    const testMobile = `95${Math.floor(10000000 + Math.random() * 90000000)}`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/cms/incharges/bulk-import',
      headers: { authorization: `Bearer ${ciTokenA}` },
      payload: {
        constituencyId: constituencyA.id,
        level: 'CONSTITUENCY',
        rows: [
          {
            name: 'P1C Incharge Test',
            mobile: testMobile,
            designation: 'Constituency Incharge',
          },
        ],
      },
    });

    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.data?.validRows, 1);

    const createdUser = await prisma.user.findFirst({ where: { mobileNumber: testMobile } });
    assert.ok(createdUser, 'User was persisted in transaction');

    const assignment = await prisma.userHierarchyAssignment.findFirst({
      where: { userId: createdUser.id, constituencyId: constituencyA.id },
    });
    assert.ok(assignment, 'Hierarchy assignment was persisted in transaction');

    // Clean up created user & assignment
    await prisma.cadre.deleteMany({ where: { userId: createdUser.id } });
    await prisma.userHierarchyAssignment.deleteMany({ where: { userId: createdUser.id } });
    await prisma.user.delete({ where: { id: createdUser.id } });
  });
});
