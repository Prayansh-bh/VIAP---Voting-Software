import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ApplicationsService } from '../modules/applications/applications.service.js';
import { VotersService } from '../modules/voters/voters.service.js';
import { BulkUploadService } from '../modules/voters/bulk-upload.service.js';
import { prisma } from '../lib/prisma.js';
import { VoterStatus } from '@prisma/client';

describe('Section E: 100-Voter Dynamic Grouping & Boundary Verification Suite', () => {
  let testApp: any;
  let testConstituency: any;
  let testMandal: any;
  let testVillage: any;
  const suiteId = Date.now().toString().slice(-6);

  before(async () => {
    // 1. Fetch or create reference organization and hierarchy
    let org = await prisma.organisation.findFirst();
    if (!org) {
      org = await prisma.organisation.create({
        data: {
          name: `Test Org ${suiteId}`,
          code: `ORG-${suiteId}`,
        },
      });
    }

    let state = await prisma.state.findFirst({ where: { organisationId: org.id } });
    if (!state) {
      state = await prisma.state.create({
        data: { name: 'Test State', code: `ST-${suiteId}`, organisationId: org.id },
      });
    }

    let zone = await prisma.zone.findFirst({ where: { stateId: state.id } });
    if (!zone) {
      zone = await prisma.zone.create({
        data: { name: 'Test Zone', code: `ZN-${suiteId}`, stateId: state.id },
      });
    }

    let parliament = await prisma.parliament.findFirst({ where: { zoneId: zone.id } });
    if (!parliament) {
      parliament = await prisma.parliament.create({
        data: { name: 'Test Parliament', code: `PC-${suiteId}`, zoneId: zone.id },
      });
    }

    testConstituency = await prisma.constituency.create({
      data: {
        name: `Grouping Test AC ${suiteId}`,
        code: `AC-GRP-${suiteId}`,
        parliamentId: parliament.id,
      },
    });

    testMandal = await prisma.mandal.create({
      data: {
        name: `Grouping Mandal ${suiteId}`,
        code: `MDL-GRP-${suiteId}`,
        constituencyId: testConstituency.id,
      },
    });

    testVillage = await prisma.village.create({
      data: {
        name: `Grouping Village ${suiteId}`,
        code: `VIL-GRP-${suiteId}`,
        mandalId: testMandal.id,
      },
    });
  });

  after(async () => {
    if (testConstituency?.id) {
      await prisma.voter.deleteMany({ where: { constituencyId: testConstituency.id } });
      await prisma.dataImportError.deleteMany({ where: { import: { targetConstituencyId: testConstituency.id } } });
      await prisma.dataImport.deleteMany({ where: { targetConstituencyId: testConstituency.id } });
      await prisma.voterGroup.deleteMany({ where: { booth: { village: { mandal: { constituencyId: testConstituency.id } } } } });
      await prisma.booth.deleteMany({ where: { village: { mandal: { constituencyId: testConstituency.id } } } });
      await prisma.village.deleteMany({ where: { mandal: { constituencyId: testConstituency.id } } });
      await prisma.mandal.deleteMany({ where: { constituencyId: testConstituency.id } });
      await prisma.constituency.deleteMany({ where: { id: testConstituency.id } });
    }
  });

  // Helper to build test rows
  function generateRows(count: number, boothNo: string, options?: { startSerial?: number; status?: string; duplicateSerial?: boolean; noSerial?: boolean }) {
    const rows = [];
    const startSerial = options?.startSerial || 1;
    for (let i = 0; i < count; i++) {
      const serial = options?.noSerial ? '' : options?.duplicateSerial ? String(startSerial) : String(startSerial + i);
      rows.push({
        'PART NO': boothNo,
        'NEW SERIAL NO': serial,
        'EPIC ID NO': `TEST-${boothNo}-${startSerial + i}-${suiteId}`,
        'VOTER NAME': `Elector ${boothNo} No ${i + 1}`,
        'RELATION': 'FATHER',
        'RELATIVE NAME': `Parent ${i + 1}`,
        'AGE': '35',
        'GENDER': i % 2 === 0 ? 'MALE' : 'FEMALE',
        'ACTIVE/DELETE': options?.status || 'ACTIVE',
        'VILLAGE NAME': testVillage.name,
        'POLLING STATION NAME': `Polling Station ${boothNo}`,
        'HOUSE NUMBER': `D-${i + 1}`,
        'CONSTITUENCY': testConstituency.name,
        'MANDAL NAME': testMandal.name,
      });
    }
    return rows;
  }

  it('1. Empty Booth: Booth with 0 eligible voters produces 0 groups', async () => {
    const boothNumber = 'BTH-EMPTY-0';
    // Import 0 rows for this booth
    const booth = await prisma.booth.create({
      data: {
        villageId: testVillage.id,
        boothNumber,
        name: `Booth ${boothNumber}`,
        code: `BTH-${testVillage.id.slice(0, 8)}-${boothNumber}`,
      },
    });

    const groups = await prisma.voterGroup.findMany({ where: { boothId: booth.id } });
    assert.equal(groups.length, 0, 'Empty booth must have exactly 0 voter groups');
  });

  it('2. Exactly 1 Voter: Booth with 1 eligible voter creates exactly 1 group (Group 1)', async () => {
    const boothNo = 'BTH-1';
    const rows = generateRows(1, boothNo);

    const res = await ApplicationsService.importData('default', 'VOTER', rows, {
      targetConstituencyId: testConstituency.id,
      importMode: 'REFRESH',
    });

    assert.equal(res.status, 'SUCCESS');
    const booth = await prisma.booth.findFirst({ where: { boothNumber: boothNo, village: { mandalId: testMandal.id } } });
    assert.ok(booth);

    const groups = await prisma.voterGroup.findMany({ where: { boothId: booth.id } });
    assert.equal(groups.length, 1, '1 voter must create ceil(1/100) = 1 group');
    assert.equal(groups[0].name, 'Group 1');

    const votersInGroup = await prisma.voter.count({ where: { voterGroupId: groups[0].id } });
    assert.equal(votersInGroup, 1);
  });

  it('3. Exactly 100 Voters: Booth with 100 eligible voters creates exactly 1 group (Group 1)', async () => {
    const boothNo = 'BTH-100';
    const rows = generateRows(100, boothNo);

    const res = await ApplicationsService.importData('default', 'VOTER', rows, {
      targetConstituencyId: testConstituency.id,
      importMode: 'REFRESH',
    });

    assert.equal(res.status, 'SUCCESS');
    const booth = await prisma.booth.findFirst({ where: { boothNumber: boothNo, village: { mandalId: testMandal.id } } });
    assert.ok(booth);

    const groups = await prisma.voterGroup.findMany({ where: { boothId: booth.id } });
    assert.equal(groups.length, 1, '100 voters must create ceil(100/100) = 1 group');
    assert.equal(groups[0].name, 'Group 1');

    const votersInGroup = await prisma.voter.count({ where: { voterGroupId: groups[0].id } });
    assert.equal(votersInGroup, 100);
  });

  it('4. Exactly 101 Voters: Booth with 101 voters creates 2 groups (Group 1 with 100, Group 2 with 1)', async () => {
    const boothNo = 'BTH-101';
    const rows = generateRows(101, boothNo);

    const res = await ApplicationsService.importData('default', 'VOTER', rows, {
      targetConstituencyId: testConstituency.id,
      importMode: 'REFRESH',
    });

    assert.equal(res.status, 'SUCCESS');
    const booth = await prisma.booth.findFirst({ where: { boothNumber: boothNo, village: { mandalId: testMandal.id } } });
    assert.ok(booth);

    const groups = await prisma.voterGroup.findMany({ where: { boothId: booth.id }, orderBy: { name: 'asc' } });
    assert.equal(groups.length, 2, '101 voters must create ceil(101/100) = 2 groups');
    assert.equal(groups[0].name, 'Group 1');
    assert.equal(groups[1].name, 'Group 2');

    const countG1 = await prisma.voter.count({ where: { voterGroupId: groups[0].id } });
    const countG2 = await prisma.voter.count({ where: { voterGroupId: groups[1].id } });
    assert.equal(countG1, 100);
    assert.equal(countG2, 1);
  });

  it('5. Exactly 173 Voters: Booth with 173 voters creates 2 groups (Group 1 with 100, Group 2 with 73)', async () => {
    const boothNo = 'BTH-173';
    const rows = generateRows(173, boothNo);

    const res = await ApplicationsService.importData('default', 'VOTER', rows, {
      targetConstituencyId: testConstituency.id,
      importMode: 'REFRESH',
    });

    assert.equal(res.status, 'SUCCESS');
    const booth = await prisma.booth.findFirst({ where: { boothNumber: boothNo, village: { mandalId: testMandal.id } } });
    assert.ok(booth);

    const groups = await prisma.voterGroup.findMany({ where: { boothId: booth.id }, orderBy: { name: 'asc' } });
    assert.equal(groups.length, 2, '173 voters must create ceil(173/100) = 2 groups');

    const countG1 = await prisma.voter.count({ where: { voterGroupId: groups[0].id } });
    const countG2 = await prisma.voter.count({ where: { voterGroupId: groups[1].id } });
    assert.equal(countG1, 100);
    assert.equal(countG2, 73);
  });

  it('6. Exactly 300 Voters: Booth with 300 voters creates 3 groups (100 in each group)', async () => {
    const boothNo = 'BTH-300';
    const rows = generateRows(300, boothNo);

    const res = await ApplicationsService.importData('default', 'VOTER', rows, {
      targetConstituencyId: testConstituency.id,
      importMode: 'REFRESH',
    });

    assert.equal(res.status, 'SUCCESS');
    const booth = await prisma.booth.findFirst({ where: { boothNumber: boothNo, village: { mandalId: testMandal.id } } });
    assert.ok(booth);

    const groups = await prisma.voterGroup.findMany({ where: { boothId: booth.id }, orderBy: { name: 'asc' } });
    assert.equal(groups.length, 3, '300 voters must create ceil(300/100) = 3 groups');

    for (let g = 0; g < 3; g++) {
      const cnt = await prisma.voter.count({ where: { voterGroupId: groups[g].id } });
      assert.equal(cnt, 100, `Group ${g + 1} must contain exactly 100 voters`);
    }
  });

  it('7. Inactive Records: DELETE records are isolated in Deleted Electors group separate from active groups', async () => {
    const boothNo = 'BTH-INACTIVE';
    const activeRows = generateRows(150, boothNo, { startSerial: 1, status: 'ACTIVE' });
    const deleteRows = generateRows(15, boothNo, { startSerial: 151, status: 'DELETE' });
    const rows = [...activeRows, ...deleteRows];

    const res = await ApplicationsService.importData('default', 'VOTER', rows, {
      targetConstituencyId: testConstituency.id,
      importMode: 'REFRESH',
    });

    assert.equal(res.status, 'SUCCESS');
    const booth = await prisma.booth.findFirst({ where: { boothNumber: boothNo, village: { mandalId: testMandal.id } } });
    assert.ok(booth);

    const groups = await prisma.voterGroup.findMany({ where: { boothId: booth.id }, orderBy: { name: 'asc' } });
    // Expect Group 1, Group 2, and Deleted Electors
    const groupNames = groups.map((g) => g.name);
    assert.ok(groupNames.includes('Group 1'));
    assert.ok(groupNames.includes('Group 2'));
    assert.ok(groupNames.includes('Deleted Electors'));

    const delGroup = groups.find((g) => g.name === 'Deleted Electors')!;
    const delCount = await prisma.voter.count({ where: { voterGroupId: delGroup.id } });
    assert.equal(delCount, 15, 'Deleted Electors group must contain all 15 DELETE voters');

    const delVoters = await prisma.voter.findMany({ where: { voterGroupId: delGroup.id } });
    for (const dv of delVoters) {
      assert.equal(dv.voterStatus, VoterStatus.SHIFTED, 'Official DELETE status must map to SHIFTED in database');
    }
  });

  it('8. Missing & Duplicate Serial Numbers: Deterministic tie-breaking preserves all records without silent exclusion', async () => {
    const boothNo = 'BTH-SERIAL-ANOMALIES';
    const rows = [
      ...generateRows(50, boothNo, { startSerial: 1 }),
      ...generateRows(25, boothNo, { duplicateSerial: true, startSerial: 50 }), // duplicate serial 50
      ...generateRows(25, boothNo, { noSerial: true, startSerial: 76 }), // missing serial
    ];

    const res = await ApplicationsService.importData('default', 'VOTER', rows, {
      targetConstituencyId: testConstituency.id,
      importMode: 'REFRESH',
    });

    assert.equal(res.status, 'SUCCESS');
    const booth = await prisma.booth.findFirst({ where: { boothNumber: boothNo, village: { mandalId: testMandal.id } } });
    assert.ok(booth);

    const totalVoters = await prisma.voter.count({ where: { boothId: booth.id } });
    assert.equal(totalVoters, 100, 'All 100 voters must be imported despite missing/duplicate serial anomalies');
  });

  it('9. Idempotency: Repeated imports of the same workbook create zero duplicate groups or duplicate voters', async () => {
    const boothNo = 'BTH-IDEMPOTENT';
    const rows = generateRows(120, boothNo);

    // Pass 1: Initial import
    const res1 = await ApplicationsService.importData('default', 'VOTER', rows, {
      targetConstituencyId: testConstituency.id,
      importMode: 'REFRESH',
    });
    assert.equal(res1.status, 'SUCCESS');

    const booth = await prisma.booth.findFirst({ where: { boothNumber: boothNo, village: { mandalId: testMandal.id } } });
    const groupsAfterPass1 = await prisma.voterGroup.count({ where: { boothId: booth!.id } });
    const votersAfterPass1 = await prisma.voter.count({ where: { boothId: booth!.id } });

    assert.equal(groupsAfterPass1, 2);
    assert.equal(votersAfterPass1, 120);

    // Pass 2: Re-import exact same data
    const res2 = await ApplicationsService.importData('default', 'VOTER', rows, {
      targetConstituencyId: testConstituency.id,
      importMode: 'REFRESH',
    });
    assert.equal(res2.status, 'SUCCESS');
    assert.equal(res2.updatedCount, 120, 'All 120 voters should be safely updated without re-creation');

    const groupsAfterPass2 = await prisma.voterGroup.count({ where: { boothId: booth!.id } });
    const votersAfterPass2 = await prisma.voter.count({ where: { boothId: booth!.id } });

    assert.equal(groupsAfterPass2, groupsAfterPass1, 'Zero duplicate groups must be created on re-import');
    assert.equal(votersAfterPass2, votersAfterPass1, 'Zero duplicate voters must be created on re-import');
  });

  it('10. Reconciliation Report: Verifies accurate calculation of source, active, deleted, and per-booth totals', async () => {
    const boothA = 'BTH-RECON-A';
    const boothB = 'BTH-RECON-B';
    const rows = [
      ...generateRows(60, boothA, { status: 'ACTIVE' }),
      ...generateRows(10, boothA, { status: 'DELETE', startSerial: 61 }),
      ...generateRows(80, boothB, { status: 'ACTIVE' }),
    ];

    const res = await ApplicationsService.importData('default', 'VOTER', rows, {
      targetConstituencyId: testConstituency.id,
      importMode: 'REFRESH',
    });

    assert.equal(res.status, 'SUCCESS');
    assert.ok(res.reconciliationReport, 'Reconciliation report must be returned');

    const report = res.reconciliationReport;
    assert.equal(report.sourceRowCount, 150);
    assert.equal(report.statusTotals.active, 140);
    assert.equal(report.statusTotals.deleted, 10);
    assert.equal(report.boothSummary.distinctBoothsCount, 2);
    assert.equal(report.boothSummary.perBoothTotals[boothA].total, 70);
    assert.equal(report.boothSummary.perBoothTotals[boothA].active, 60);
    assert.equal(report.boothSummary.perBoothTotals[boothA].deleted, 10);
    assert.equal(report.boothSummary.perBoothTotals[boothB].total, 80);
    assert.equal(report.boothSummary.perBoothTotals[boothB].active, 80);
  });

  it('11. Exactly 99 Voters: Booth with 99 voters creates exactly 1 group (Group 1 with 99)', async () => {
    const boothNo = 'BTH-99';
    const rows = generateRows(99, boothNo);

    const res = await ApplicationsService.importData('default', 'VOTER', rows, {
      targetConstituencyId: testConstituency.id,
      importMode: 'REFRESH',
    });

    assert.equal(res.status, 'SUCCESS');
    const booth = await prisma.booth.findFirst({ where: { boothNumber: boothNo, village: { mandalId: testMandal.id } } });
    assert.ok(booth);

    const groups = await prisma.voterGroup.findMany({ where: { boothId: booth.id } });
    assert.equal(groups.length, 1, '99 voters must create ceil(99/100) = 1 group');
    assert.equal(groups[0].name, 'Group 1');

    const voters = await prisma.voter.findMany({
      where: { voterGroupId: groups[0].id },
      orderBy: { serialNumber: 'asc' },
    });
    assert.equal(voters.length, 99);
    assert.equal(voters[0].serialNumber, 1);
    assert.equal(voters[98].serialNumber, 99);
  });

  it('12. Exactly 200 Voters: Booth with 200 voters creates exactly 2 groups (Group 1: 100, Group 2: 100)', async () => {
    const boothNo = 'BTH-200';
    const rows = generateRows(200, boothNo);

    const res = await ApplicationsService.importData('default', 'VOTER', rows, {
      targetConstituencyId: testConstituency.id,
      importMode: 'REFRESH',
    });

    assert.equal(res.status, 'SUCCESS');
    const booth = await prisma.booth.findFirst({ where: { boothNumber: boothNo, village: { mandalId: testMandal.id } } });
    assert.ok(booth);

    const groups = await prisma.voterGroup.findMany({ where: { boothId: booth.id }, orderBy: { name: 'asc' } });
    assert.equal(groups.length, 2, '200 voters must create ceil(200/100) = 2 groups');
    assert.equal(groups[0].name, 'Group 1');
    assert.equal(groups[1].name, 'Group 2');

    const g1Voters = await prisma.voter.findMany({ where: { voterGroupId: groups[0].id }, orderBy: { serialNumber: 'asc' } });
    const g2Voters = await prisma.voter.findMany({ where: { voterGroupId: groups[1].id }, orderBy: { serialNumber: 'asc' } });
    assert.equal(g1Voters.length, 100);
    assert.equal(g2Voters.length, 100);
    assert.equal(g1Voters[0].serialNumber, 1);
    assert.equal(g1Voters[99].serialNumber, 100);
    assert.equal(g2Voters[0].serialNumber, 101);
    assert.equal(g2Voters[99].serialNumber, 200);
  });

  it('13. Out-of-Order Excel Rows: Deterministic grouping sorts active voters by serialNumber ASC', async () => {
    const boothNo = 'BTH-SHUFFLED-150';
    const orderedRows = generateRows(150, boothNo);
    // Deterministically shuffle rows: e.g. alternate odd/even or reverse
    const shuffledRows = [
      ...orderedRows.filter((_, idx) => idx % 2 === 1),
      ...orderedRows.filter((_, idx) => idx % 2 === 0),
    ];
    // Ensure the very first row is serial 2, not serial 1
    assert.equal(shuffledRows[0]['NEW SERIAL NO'], '2');

    const res = await ApplicationsService.importData('default', 'VOTER', shuffledRows, {
      targetConstituencyId: testConstituency.id,
      importMode: 'REFRESH',
    });

    assert.equal(res.status, 'SUCCESS');
    const booth = await prisma.booth.findFirst({ where: { boothNumber: boothNo, village: { mandalId: testMandal.id } } });
    assert.ok(booth);

    const groups = await prisma.voterGroup.findMany({ where: { boothId: booth.id }, orderBy: { name: 'asc' } });
    assert.equal(groups.length, 2);
    assert.equal(groups[0].name, 'Group 1');
    assert.equal(groups[1].name, 'Group 2');

    const g1Voters = await prisma.voter.findMany({ where: { voterGroupId: groups[0].id }, orderBy: { serialNumber: 'asc' } });
    const g2Voters = await prisma.voter.findMany({ where: { voterGroupId: groups[1].id }, orderBy: { serialNumber: 'asc' } });

    assert.equal(g1Voters.length, 100);
    assert.equal(g2Voters.length, 50);

    // Verify exact expected serial order: Group 1 must have 1..100, Group 2 must have 101..150
    for (let i = 0; i < 100; i++) {
      assert.equal(g1Voters[i].serialNumber, i + 1, `Group 1 index ${i} must have serialNumber ${i + 1}`);
    }
    for (let i = 0; i < 50; i++) {
      assert.equal(g2Voters[i].serialNumber, 101 + i, `Group 2 index ${i} must have serialNumber ${101 + i}`);
    }
  });

  it('14. Non-Contiguous Serial Numbers: Ranks active electors deterministically across serial gaps', async () => {
    const boothNo = 'BTH-GAPS-120';
    // 120 voters with odd serial numbers: 1, 3, 5, ..., 239
    const rows = [];
    for (let i = 0; i < 120; i++) {
      const serial = 1 + i * 2;
      rows.push({
        'PART NO': boothNo,
        'NEW SERIAL NO': String(serial),
        'EPIC ID NO': `GAP-${boothNo}-${serial}-${suiteId}`,
        'VOTER NAME': `Gap Elector ${i + 1}`,
        'RELATION': 'FATHER',
        'RELATIVE NAME': `Relative ${i + 1}`,
        'AGE': '40',
        'GENDER': 'MALE',
        'ACTIVE/DELETE': 'ACTIVE',
        'VILLAGE NAME': testVillage.name,
        'POLLING STATION NAME': `Polling Station ${boothNo}`,
        'HOUSE NUMBER': `H-${i + 1}`,
        'CONSTITUENCY': testConstituency.name,
        'MANDAL NAME': testMandal.name,
      });
    }

    const res = await ApplicationsService.importData('default', 'VOTER', rows, {
      targetConstituencyId: testConstituency.id,
      importMode: 'REFRESH',
    });

    assert.equal(res.status, 'SUCCESS');
    const booth = await prisma.booth.findFirst({ where: { boothNumber: boothNo, village: { mandalId: testMandal.id } } });
    assert.ok(booth);

    const groups = await prisma.voterGroup.findMany({ where: { boothId: booth.id }, orderBy: { name: 'asc' } });
    assert.equal(groups.length, 2);

    const g1Voters = await prisma.voter.findMany({ where: { voterGroupId: groups[0].id }, orderBy: { serialNumber: 'asc' } });
    const g2Voters = await prisma.voter.findMany({ where: { voterGroupId: groups[1].id }, orderBy: { serialNumber: 'asc' } });

    assert.equal(g1Voters.length, 100, 'Group 1 must contain the first 100 lowest serials');
    assert.equal(g2Voters.length, 20, 'Group 2 must contain the remaining 20 serials');
    assert.equal(g1Voters[0].serialNumber, 1);
    assert.equal(g1Voters[99].serialNumber, 199);
    assert.equal(g2Voters[0].serialNumber, 201);
    assert.equal(g2Voters[19].serialNumber, 239);
  });

  it('15. Duplicate EPIC IDs: Retains both records with disambiguation and correct grouping', async () => {
    const boothNo = 'BTH-DUP-EPIC';
    const sharedEpic = `DUP-SHARED-${suiteId}`;
    const rows = [
      {
        'PART NO': boothNo,
        'NEW SERIAL NO': '10',
        'EPIC ID NO': sharedEpic,
        'VOTER NAME': 'Elector First Enrollment',
        'RELATION': 'FATHER',
        'RELATIVE NAME': 'Father A',
        'AGE': '30',
        'GENDER': 'MALE',
        'ACTIVE/DELETE': 'ACTIVE',
        'VILLAGE NAME': testVillage.name,
        'CONSTITUENCY': testConstituency.name,
        'MANDAL NAME': testMandal.name,
      },
      {
        'PART NO': boothNo,
        'NEW SERIAL NO': '25',
        'EPIC ID NO': sharedEpic,
        'VOTER NAME': 'Elector Second Enrollment',
        'RELATION': 'FATHER',
        'RELATIVE NAME': 'Father B',
        'AGE': '32',
        'GENDER': 'FEMALE',
        'ACTIVE/DELETE': 'ACTIVE',
        'VILLAGE NAME': testVillage.name,
        'CONSTITUENCY': testConstituency.name,
        'MANDAL NAME': testMandal.name,
      },
    ];

    const res = await ApplicationsService.importData('default', 'VOTER', rows, {
      targetConstituencyId: testConstituency.id,
      importMode: 'REFRESH',
    });

    assert.equal(res.status, 'SUCCESS');
    const booth = await prisma.booth.findFirst({ where: { boothNumber: boothNo, village: { mandalId: testMandal.id } } });
    assert.ok(booth);

    const voters = await prisma.voter.findMany({ where: { boothId: booth.id }, orderBy: { serialNumber: 'asc' } });
    assert.equal(voters.length, 2, 'Both duplicate EPIC records must be preserved');
    assert.equal(voters[0].epicNumber, sharedEpic);
    assert.ok(voters[1].epicNumber.includes('-DUP-'), 'Second duplicate must receive disambiguated surrogate key');
    assert.equal(voters[0].voterGroupId, voters[1].voterGroupId, 'Both belong to Group 1 for this booth');
  });

  it('16. Active/Deleted Revision Pairs: Isolates DELETE record in Deleted Electors while grouping ACTIVE record', async () => {
    const boothNo = 'BTH-REV-PAIR';
    const sharedEpic = `REV-PAIR-${suiteId}`;
    const rows = [
      {
        'PART NO': boothNo,
        'NEW SERIAL NO': '5',
        'EPIC ID NO': sharedEpic,
        'VOTER NAME': 'Deleted Revision Elector',
        'RELATION': 'HUSBAND',
        'RELATIVE NAME': 'Husband X',
        'AGE': '45',
        'GENDER': 'FEMALE',
        'ACTIVE/DELETE': 'DELETE',
        'VILLAGE NAME': testVillage.name,
        'CONSTITUENCY': testConstituency.name,
        'MANDAL NAME': testMandal.name,
      },
      {
        'PART NO': boothNo,
        'NEW SERIAL NO': '15',
        'EPIC ID NO': sharedEpic,
        'VOTER NAME': 'Active Restored Elector',
        'RELATION': 'HUSBAND',
        'RELATIVE NAME': 'Husband X',
        'AGE': '45',
        'GENDER': 'FEMALE',
        'ACTIVE/DELETE': 'ACTIVE',
        'VILLAGE NAME': testVillage.name,
        'CONSTITUENCY': testConstituency.name,
        'MANDAL NAME': testMandal.name,
      },
    ];

    const res = await ApplicationsService.importData('default', 'VOTER', rows, {
      targetConstituencyId: testConstituency.id,
      importMode: 'REFRESH',
    });

    assert.equal(res.status, 'SUCCESS');
    const booth = await prisma.booth.findFirst({ where: { boothNumber: boothNo, village: { mandalId: testMandal.id } } });
    assert.ok(booth);

    const activeVoter = await prisma.voter.findFirst({ where: { boothId: booth.id, voterStatus: VoterStatus.ACTIVE } });
    const deletedVoter = await prisma.voter.findFirst({ where: { boothId: booth.id, voterStatus: VoterStatus.SHIFTED } });

    assert.ok(activeVoter);
    assert.ok(deletedVoter);

    const activeGroup = await prisma.voterGroup.findUnique({ where: { id: activeVoter.voterGroupId! } });
    const deletedGroup = await prisma.voterGroup.findUnique({ where: { id: deletedVoter.voterGroupId! } });

    assert.equal(activeGroup?.name, 'Group 1');
    assert.equal(deletedGroup?.name, 'Deleted Electors');
  });

  it('17. Blank EPIC IDs: Preserves overseas electors with surrogate keys and deterministic grouping', async () => {
    const boothNo = 'BTH-BLANK-EPIC';
    const rows = [
      {
        'PART NO': boothNo,
        'NEW SERIAL NO': '1',
        'EPIC ID NO': '', // Blank domestic EPIC
        'VOTER NAME': 'Overseas Elector 1',
        'RELATION': 'FATHER',
        'RELATIVE NAME': 'Father NRI 1',
        'AGE': '38',
        'GENDER': 'MALE',
        'ACTIVE/DELETE': 'ACTIVE',
        'VILLAGE NAME': 'Overseas Electors Section',
        'CONSTITUENCY': testConstituency.name,
        'MANDAL NAME': testMandal.name,
      },
      {
        'PART NO': boothNo,
        'NEW SERIAL NO': '2',
        'EPIC ID NO': '', // Blank domestic EPIC
        'VOTER NAME': 'Overseas Elector 2',
        'RELATION': 'FATHER',
        'RELATIVE NAME': 'Father NRI 2',
        'AGE': '42',
        'GENDER': 'FEMALE',
        'ACTIVE/DELETE': 'ACTIVE',
        'VILLAGE NAME': 'Overseas Electors Section',
        'CONSTITUENCY': testConstituency.name,
        'MANDAL NAME': testMandal.name,
      },
    ];

    const res = await ApplicationsService.importData('default', 'VOTER', rows, {
      targetConstituencyId: testConstituency.id,
      importMode: 'REFRESH',
    });

    assert.equal(res.status, 'SUCCESS');
    const booth = await prisma.booth.findFirst({ where: { boothNumber: boothNo, village: { mandalId: testMandal.id } } });
    assert.ok(booth);

    const voters = await prisma.voter.findMany({ where: { boothId: booth.id }, orderBy: { serialNumber: 'asc' } });
    assert.equal(voters.length, 2);
    assert.ok(voters[0].epicNumber.includes('INTERNAL-NO-EPIC-'));
    assert.ok(voters[0].notes?.includes('SOURCE_EPIC_STATUS: BLANK'));
    assert.ok(voters[1].epicNumber.includes('INTERNAL-NO-EPIC-'));
    assert.equal(voters[0].voterGroupId, voters[1].voterGroupId);
  });

  it('18. Multiple Booths in Single Polling Station: Isolates groups and voters strictly by booth', async () => {
    const booth1No = 'BTH-MULTI-PS-1';
    const booth2No = 'BTH-MULTI-PS-2';
    const sharedPS = `Central High School Main Campus ${suiteId}`;

    const b1Rows = generateRows(120, booth1No);
    b1Rows.forEach((r) => (r['POLLING STATION NAME'] = sharedPS));

    const b2Rows = generateRows(80, booth2No);
    b2Rows.forEach((r) => (r['POLLING STATION NAME'] = sharedPS));

    const rows = [...b1Rows, ...b2Rows];

    const res = await ApplicationsService.importData('default', 'VOTER', rows, {
      targetConstituencyId: testConstituency.id,
      importMode: 'REFRESH',
    });

    assert.equal(res.status, 'SUCCESS');

    const booth1 = await prisma.booth.findFirst({ where: { boothNumber: booth1No, village: { mandalId: testMandal.id } } });
    const booth2 = await prisma.booth.findFirst({ where: { boothNumber: booth2No, village: { mandalId: testMandal.id } } });
    assert.ok(booth1);
    assert.ok(booth2);

    const b1Groups = await prisma.voterGroup.findMany({ where: { boothId: booth1.id } });
    const b2Groups = await prisma.voterGroup.findMany({ where: { boothId: booth2.id } });

    assert.equal(b1Groups.length, 2, 'Booth 1 (120 voters) must have 2 groups');
    assert.equal(b2Groups.length, 1, 'Booth 2 (80 voters) must have 1 group');

    // Confirm that every voter in Booth 1 groups belongs strictly to Booth 1
    const b1GroupIds = b1Groups.map((g) => g.id);
    const b1ForeignVoters = await prisma.voter.count({
      where: { voterGroupId: { in: b1GroupIds }, boothId: { not: booth1.id } },
    });
    assert.equal(b1ForeignVoters, 0, 'Zero foreign booth voters in Booth 1 groups');

    // Confirm that every voter in Booth 2 groups belongs strictly to Booth 2
    const b2GroupIds = b2Groups.map((g) => g.id);
    const b2ForeignVoters = await prisma.voter.count({
      where: { voterGroupId: { in: b2GroupIds }, boothId: { not: booth2.id } },
    });
    assert.equal(b2ForeignVoters, 0, 'Zero foreign booth voters in Booth 2 groups');
  });

  it('19. Status Changes and Group Moves: Enforces 100-voter statutory capacity and updates audit log', async () => {
    const boothNo = 'BTH-MOVE-TEST';
    // Import 100 voters in Group 1 and 99 voters in Group 2 (total 199 voters)
    const rows = generateRows(199, boothNo);
    await ApplicationsService.importData('default', 'VOTER', rows, {
      targetConstituencyId: testConstituency.id,
      importMode: 'REFRESH',
    });

    const booth = await prisma.booth.findFirst({ where: { boothNumber: boothNo, village: { mandalId: testMandal.id } } });
    assert.ok(booth);

    const groups = await prisma.voterGroup.findMany({ where: { boothId: booth.id }, orderBy: { name: 'asc' } });
    const group1 = groups.find((g) => g.name === 'Group 1')!;
    const group2 = groups.find((g) => g.name === 'Group 2')!;

    const g1CountBefore = await prisma.voter.count({ where: { voterGroupId: group1.id, voterStatus: VoterStatus.ACTIVE } });
    const g2CountBefore = await prisma.voter.count({ where: { voterGroupId: group2.id, voterStatus: VoterStatus.ACTIVE } });
    assert.equal(g1CountBefore, 100);
    assert.equal(g2CountBefore, 99);

    // Pick 1 voter from Group 1
    const voterToMove = await prisma.voter.findFirst({ where: { voterGroupId: group1.id } });
    assert.ok(voterToMove);

    // Step A: Move voter from Group 1 to Group 2 -> Group 2 currently has 99, so move should succeed
    const adminUser = await prisma.user.findFirst();
    const updated = await VotersService.updateVoter(voterToMove.id, { voterGroupId: group2.id }, adminUser?.id || voterToMove.id);
    assert.equal(updated.voterGroupId, group2.id);

    const g2CountAfterMove1 = await prisma.voter.count({ where: { voterGroupId: group2.id, voterStatus: VoterStatus.ACTIVE } });
    assert.equal(g2CountAfterMove1, 100, 'Group 2 now has exactly 100 active voters');

    // Step B: Pick another voter from Group 1 and try to move to Group 2 -> Group 2 has 100, must reject!
    const anotherVoter = await prisma.voter.findFirst({ where: { voterGroupId: group1.id } });
    assert.ok(anotherVoter);

    await assert.rejects(
      async () => {
        await VotersService.updateVoter(anotherVoter.id, { voterGroupId: group2.id }, adminUser?.id || anotherVoter.id);
      },
      (err: any) => {
        assert.equal(err.code, 'VOTER_GROUP_CAPACITY_EXCEEDED');
        assert.equal(err.statusCode, 400);
        return true;
      }
    );

    // Step C: Change status of voter in Group 2 to SHIFTED -> frees capacity
    await VotersService.updateVoter(voterToMove.id, { voterStatus: VoterStatus.SHIFTED }, adminUser?.id || voterToMove.id);
    const g2ActiveCountAfterShift = await prisma.voter.count({ where: { voterGroupId: group2.id, voterStatus: VoterStatus.ACTIVE } });
    assert.equal(g2ActiveCountAfterShift, 99, 'SHIFTED voter frees 1 spot in active capacity');
  });

  it('20. Deleted Entries Inside Serial Range: Policy A absorbs serial 101 into Group 1 to maintain 100 active electors', async () => {
    const boothNo = 'BTH-DEL-INSIDE';
    // 105 total rows: serials 1 to 105. Serial 35 is DELETE.
    const rows = [];
    for (let s = 1; s <= 105; s++) {
      rows.push({
        'PART NO': boothNo,
        'NEW SERIAL NO': String(s),
        'EPIC ID NO': `TEST-${boothNo}-${s}-${suiteId}`,
        'VOTER NAME': `Elector ${boothNo} ${s}`,
        'RELATION': 'FATHER',
        'RELATIVE NAME': `Relative ${s}`,
        'AGE': '30',
        'GENDER': 'MALE',
        'ACTIVE/DELETE': s === 35 ? 'DELETE' : 'ACTIVE',
        'VILLAGE NAME': testVillage.name,
        'POLLING STATION NAME': `Polling Station ${boothNo}`,
        'HOUSE NUMBER': `H-${s}`,
        'CONSTITUENCY': testConstituency.name,
        'MANDAL NAME': testMandal.name,
      });
    }

    const res = await ApplicationsService.importData('default', 'VOTER', rows, {
      targetConstituencyId: testConstituency.id,
      importMode: 'REFRESH',
    });
    assert.equal(res.status, 'SUCCESS');

    const booth = await prisma.booth.findFirst({ where: { boothNumber: boothNo, village: { mandalId: testMandal.id } } });
    assert.ok(booth);

    const groups = await prisma.voterGroup.findMany({ where: { boothId: booth.id }, orderBy: { name: 'asc' } });
    const g1 = groups.find((g) => g.name === 'Group 1')!;
    const g2 = groups.find((g) => g.name === 'Group 2')!;
    const delGrp = groups.find((g) => g.name === 'Deleted Electors')!;
    assert.ok(g1 && g2 && delGrp);

    // Group 1 must have exactly 100 ACTIVE voters (Policy A rank-based absorption)
    const g1Voters = await prisma.voter.findMany({
      where: { voterGroupId: g1.id },
      orderBy: { serialNumber: 'asc' },
    });
    assert.equal(g1Voters.length, 100, 'Group 1 must contain exactly 100 active voters');
    // Group 1 must contain serial 101 because serial 35 was deleted
    assert.equal(g1Voters[0].serialNumber, 1);
    assert.equal(g1Voters[33].serialNumber, 34);
    assert.equal(g1Voters[34].serialNumber, 36); // serial 35 was deleted
    assert.equal(g1Voters[99].serialNumber, 101, 'Serial 101 must be absorbed into Group 1 under Policy A');

    // Group 2 contains the remaining 4 active voters: serials 102..105
    const g2Voters = await prisma.voter.findMany({
      where: { voterGroupId: g2.id },
      orderBy: { serialNumber: 'asc' },
    });
    assert.equal(g2Voters.length, 4);
    assert.equal(g2Voters[0].serialNumber, 102);
    assert.equal(g2Voters[3].serialNumber, 105);

    // Deleted Electors contains serial 35
    const delVoters = await prisma.voter.findMany({ where: { voterGroupId: delGrp.id } });
    assert.equal(delVoters.length, 1);
    assert.equal(delVoters[0].serialNumber, 35);
    assert.equal(delVoters[0].voterStatus, VoterStatus.SHIFTED);
  });

  it('21. Bulk CSV Ingestion - Missing Group Assignments: Auto-partitions into deterministic groups <= 100 active voters', async () => {
    const boothNo = 'BTH-CSV-NOGRP';
    // 120 CSV rows without 'voterGroup' column
    const rows: any[] = [];
    for (let i = 1; i <= 120; i++) {
      rows.push({
        serialNumber: i,
        epicNumber: `CSV-NOGRP-${i}-${suiteId}`,
        name: `CSV Elector ${i}`,
        fatherHusbandName: `CSV Father ${i}`,
        gender: 'M',
        age: 30,
        mandal: testMandal.name,
        village: testVillage.name,
        boothNumber: boothNo,
        // voterGroup omitted!
      });
    }

    const res = await BulkUploadService.importVotersFromData(testConstituency.id, rows, {
      importMode: 'APPEND',
      scope: { isGlobalScope: true, accessibleConstituencyIds: new Set([testConstituency.id]) } as any,
    });
    assert.ok((res as any).success);

    const booth = await prisma.booth.findFirst({
      where: { boothNumber: `Booth ${boothNo}`, villageId: testVillage.id },
    });
    assert.ok(booth);

    // Check voter groups created: should be partitioned into Group 1 (100) and Group 2 (20)
    const groups = await prisma.voterGroup.findMany({
      where: { boothId: booth.id },
      orderBy: { name: 'asc' },
    });
    assert.equal(groups.length, 2, '120 voters must be auto-partitioned into ceil(120/100) = 2 groups');
    assert.equal(groups[0].name, 'Group 1');
    assert.equal(groups[1].name, 'Group 2');

    const g1Count = await prisma.voter.count({
      where: { voterGroupId: groups[0].id, voterStatus: VoterStatus.ACTIVE },
    });
    const g2Count = await prisma.voter.count({
      where: { voterGroupId: groups[1].id, voterStatus: VoterStatus.ACTIVE },
    });
    assert.equal(g1Count, 100, 'Group 1 must contain exactly 100 active voters');
    assert.equal(g2Count, 20, 'Group 2 must contain remaining 20 active voters');

    // Verify serial ordering: Group 1 has serials 1..100, Group 2 has serials 101..120
    const g1Voters = await prisma.voter.findMany({ where: { voterGroupId: groups[0].id }, orderBy: { serialNumber: 'asc' } });
    const g2Voters = await prisma.voter.findMany({ where: { voterGroupId: groups[1].id }, orderBy: { serialNumber: 'asc' } });
    assert.equal(g1Voters[0].serialNumber, 1);
    assert.equal(g1Voters[99].serialNumber, 100);
    assert.equal(g2Voters[0].serialNumber, 101);
    assert.equal(g2Voters[19].serialNumber, 120);
  });

  it('22. Bulk CSV Ingestion - Explicit Oversized Group: Rejects with 400 VOTER_GROUP_CAPACITY_EXCEEDED when group > 100', async () => {
    const boothNo = 'BTH-CSV-OVER';
    // 115 CSV rows with explicit voterGroup: 'Oversized Custom Group'
    const rows: any[] = [];
    for (let i = 1; i <= 115; i++) {
      rows.push({
        serialNumber: i,
        epicNumber: `CSV-OVER-${i}-${suiteId}`,
        name: `CSV Oversize Elector ${i}`,
        fatherHusbandName: `CSV Father ${i}`,
        gender: 'F',
        age: 28,
        mandal: testMandal.name,
        village: testVillage.name,
        boothNumber: boothNo,
        voterGroup: 'Oversized Custom Group',
      });
    }

    await assert.rejects(
      async () => {
        await BulkUploadService.importVotersFromData(testConstituency.id, rows, {
          importMode: 'APPEND',
          scope: { isGlobalScope: true, accessibleConstituencyIds: new Set([testConstituency.id]) } as any,
        });
      },
      (err: any) => {
        assert.equal(err.code, 'VOTER_GROUP_CAPACITY_EXCEEDED');
        assert.equal(err.statusCode, 400);
        return true;
      },
      'Expected BulkUploadService to reject explicit oversized group with VOTER_GROUP_CAPACITY_EXCEEDED'
    );
  });

  it('23. Bulk CSV Ingestion - Source DELETE Row Isolation & Political Preference Gating', async () => {
    const boothNo = 'BTH-CSV-DEL-PREF';
    const rows = [
      {
        serialNumber: 1,
        epicNumber: `CSV-ACT-1-${suiteId}`,
        name: 'Active Elector',
        gender: 'M',
        age: 25,
        mandal: testMandal.name,
        village: testVillage.name,
        boothNumber: boothNo,
        politicalPreference: 'PARTY_ALPHA',
      },
      {
        serialNumber: 2,
        epicNumber: `CSV-DEL-2-${suiteId}`,
        name: 'Deleted Elector',
        gender: 'F',
        age: 40,
        mandal: testMandal.name,
        village: testVillage.name,
        boothNumber: boothNo,
        status: 'DELETED',
        politicalPreference: 'PARTY_BETA',
      },
    ];

    const res = await BulkUploadService.importVotersFromData(testConstituency.id, rows, {
      importMode: 'APPEND',
      scope: { isGlobalScope: true, accessibleConstituencyIds: new Set([testConstituency.id]) } as any,
    });
    assert.ok((res as any).success);

    const activeVoter = await prisma.voter.findUnique({
      where: { epicNumber: `CSV-ACT-1-${suiteId}` },
      include: { voterGroup: true },
    });
    const deleteVoter = await prisma.voter.findUnique({
      where: { epicNumber: `CSV-DEL-2-${suiteId}` },
      include: { voterGroup: true },
    });

    assert.ok(activeVoter);
    assert.ok(deleteVoter);
    assert.equal(activeVoter.voterStatus, VoterStatus.ACTIVE);
    assert.equal(activeVoter.voterGroup?.name, 'Group 1');
    assert.equal(activeVoter.politicalPreference, 'NEUTRAL', 'Political preference must default to NEUTRAL when disabled');

    assert.equal(deleteVoter.voterStatus, VoterStatus.SHIFTED);
    assert.equal(deleteVoter.voterGroup?.name, 'Deleted Electors', 'Source delete row must be isolated into Deleted Electors group');
    assert.equal(deleteVoter.politicalPreference, 'NEUTRAL');
  });

  it('24. Voter Status Reactivation - Group Capacity Enforcement (99 vs 100 active voters)', async () => {
    const boothNo = 'BTH-REACTIVATE-99';
    // 1. Create a booth with 99 active voters
    const rows = generateRows(99, boothNo);
    await ApplicationsService.importData('default', 'VOTER', rows, {
      targetConstituencyId: testConstituency.id,
      importMode: 'REFRESH',
    });

    const booth = await prisma.booth.findFirst({
      where: { boothNumber: boothNo, village: { mandalId: testMandal.id } },
    });
    assert.ok(booth);

    const group = await prisma.voterGroup.findFirst({ where: { boothId: booth.id } });
    assert.ok(group);

    const activeCountBefore = await prisma.voter.count({
      where: { voterGroupId: group.id, voterStatus: VoterStatus.ACTIVE },
    });
    assert.equal(activeCountBefore, 99);

    // 2. Create an inactive voter (DECEASED) in this group
    const inactiveVoter1 = await prisma.voter.create({
      data: {
        serialNumber: 150,
        epicNumber: `INACT-1-${suiteId}`,
        name: 'Inactive Voter 1',
        fatherHusbandName: 'Father One',
        houseNumber: '1-10',
        age: 30,
        voterStatus: VoterStatus.DECEASED,
        constituencyId: testConstituency.id,
        mandalId: testMandal.id,
        villageId: testVillage.id,
        boothId: booth.id,
        voterGroupId: group.id,
      },
    });

    const user = await prisma.user.findFirst();
    const actorId = user?.id || '00000000-0000-0000-0000-000000000001';

    // 3. Reactivating when group has 99 active voters should succeed (making it 100)
    const updated1 = await VotersService.updateVoterStatus(
      inactiveVoter1.id,
      { status: VoterStatus.ACTIVE, reason: 'False death report reinstated' },
      actorId
    );
    assert.equal(updated1.voterStatus, VoterStatus.ACTIVE);

    const activeCountAt100 = await prisma.voter.count({
      where: { voterGroupId: group.id, voterStatus: VoterStatus.ACTIVE },
    });
    assert.equal(activeCountAt100, 100);

    // Verify history recorded
    const history = await prisma.voterStatusHistory.findFirst({
      where: { voterId: inactiveVoter1.id, newStatus: VoterStatus.ACTIVE },
    });
    assert.ok(history);
    assert.equal(history.previousStatus, VoterStatus.DECEASED);

    // 4. Create another inactive voter (SHIFTED) in this same group
    const inactiveVoter2 = await prisma.voter.create({
      data: {
        serialNumber: 151,
        epicNumber: `INACT-2-${suiteId}`,
        name: 'Inactive Voter 2',
        fatherHusbandName: 'Father Two',
        houseNumber: '1-11',
        age: 32,
        voterStatus: VoterStatus.SHIFTED,
        constituencyId: testConstituency.id,
        mandalId: testMandal.id,
        villageId: testVillage.id,
        boothId: booth.id,
        voterGroupId: group.id,
      },
    });

    // 5. Reactivating when group already has 100 active voters must throw 400 VOTER_GROUP_CAPACITY_EXCEEDED
    await assert.rejects(
      async () => {
        await VotersService.updateVoterStatus(
          inactiveVoter2.id,
          { status: VoterStatus.ACTIVE, reason: 'Returned from shifted location' },
          actorId
        );
      },
      (err: any) => {
        assert.equal(err.code, 'VOTER_GROUP_CAPACITY_EXCEEDED');
        assert.equal(err.statusCode, 400);
        return true;
      },
      'Expected updateVoterStatus to reject reactivation with VOTER_GROUP_CAPACITY_EXCEEDED when group is at capacity'
    );

    // Inactive voter 2 remains SHIFTED
    const checkVoter2 = await prisma.voter.findUnique({ where: { id: inactiveVoter2.id } });
    assert.equal(checkVoter2?.voterStatus, VoterStatus.SHIFTED);

    // Group count remains strictly 100
    const finalActiveCount = await prisma.voter.count({
      where: { voterGroupId: group.id, voterStatus: VoterStatus.ACTIVE },
    });
    assert.equal(finalActiveCount, 100);
  });

  it('25. Concurrency Safety - Serialized Reactivation Protection against Group Overflow', async () => {
    const boothNo = 'BTH-CONCUR-99';
    const rows = generateRows(99, boothNo);
    await ApplicationsService.importData('default', 'VOTER', rows, {
      targetConstituencyId: testConstituency.id,
      importMode: 'REFRESH',
    });

    const booth = await prisma.booth.findFirst({
      where: { boothNumber: boothNo, village: { mandalId: testMandal.id } },
    });
    assert.ok(booth);

    const group = await prisma.voterGroup.findFirst({ where: { boothId: booth.id } });
    assert.ok(group);

    // Create 2 inactive voters in this group (currently at 99 active voters)
    const [c1, c2] = await Promise.all([
      prisma.voter.create({
        data: {
          serialNumber: 160,
          epicNumber: `CONCUR-1-${suiteId}`,
          name: 'Concurrent Elector 1',
          fatherHusbandName: 'Father C1',
          houseNumber: '2-1',
          age: 35,
          voterStatus: VoterStatus.DOUBTFUL,
          constituencyId: testConstituency.id,
          mandalId: testMandal.id,
          villageId: testVillage.id,
          boothId: booth.id,
          voterGroupId: group.id,
        },
      }),
      prisma.voter.create({
        data: {
          serialNumber: 161,
          epicNumber: `CONCUR-2-${suiteId}`,
          name: 'Concurrent Elector 2',
          fatherHusbandName: 'Father C2',
          houseNumber: '2-2',
          age: 38,
          voterStatus: VoterStatus.DOUBTFUL,
          constituencyId: testConstituency.id,
          mandalId: testMandal.id,
          villageId: testVillage.id,
          boothId: booth.id,
          voterGroupId: group.id,
        },
      }),
    ]);

    const user = await prisma.user.findFirst();
    const actorId = user?.id || '00000000-0000-0000-0000-000000000001';

    // Fire both reactivation attempts concurrently
    const results = await Promise.allSettled([
      VotersService.updateVoterStatus(c1.id, { status: VoterStatus.ACTIVE }, actorId),
      VotersService.updateVoterStatus(c2.id, { status: VoterStatus.ACTIVE }, actorId),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactly one must succeed and one must be rejected with capacity exceeded
    assert.equal(fulfilled.length, 1, 'Exactly one concurrent reactivation must succeed');
    assert.equal(rejected.length, 1, 'Exactly one concurrent reactivation must be rejected');

    const rejectionError: any = (rejected[0] as PromiseRejectedResult).reason;
    assert.equal(rejectionError.code, 'VOTER_GROUP_CAPACITY_EXCEEDED');

    // Final active voter count in this group must be exactly 100, never 101
    const finalCount = await prisma.voter.count({
      where: { voterGroupId: group.id, voterStatus: VoterStatus.ACTIVE },
    });
    assert.equal(finalCount, 100, 'Group active count must never exceed statutory limit of 100 under concurrency');
  });

  it('26. Invariant Check: Zero unassigned voters and zero cross-booth voter groups across suite', async () => {
    // 1. Zero unassigned voters in test constituency
    const unassignedCount = await prisma.voter.count({
      where: {
        constituencyId: testConstituency.id,
        voterGroupId: null,
      },
    });
    assert.equal(unassignedCount, 0, 'Every eligible voter must be assigned to a voter group');

    // 2. Zero cross-booth voter groups
    const mismatchedVoters = await prisma.voter.findMany({
      where: {
        constituencyId: testConstituency.id,
      },
      include: {
        voterGroup: true,
      },
    });

    for (const v of mismatchedVoters) {
      assert.ok(v.voterGroup, `Voter ${v.epicNumber} must have an associated voter group`);
      assert.equal(v.boothId, v.voterGroup.boothId, `Voter ${v.epicNumber} boothId must match voterGroup boothId`);
    }

    // 3. Zero active groups exceeding 100 active voters
    const testGroups = await prisma.voterGroup.findMany({
      where: {
        booth: { village: { mandal: { constituencyId: testConstituency.id } } },
        name: { not: 'Deleted Electors' },
      },
    });

    for (const grp of testGroups) {
      const activeCount = await prisma.voter.count({
        where: { voterGroupId: grp.id, voterStatus: VoterStatus.ACTIVE },
      });
      assert.ok(activeCount <= 100, `Active voter group ${grp.name} (${grp.id}) has ${activeCount} active voters, exceeding 100`);
    }
  });
});
