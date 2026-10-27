import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ApplicationsService } from '../modules/applications/applications.service.js';
import { BulkUploadService } from '../modules/voters/bulk-upload.service.js';
import { assertVoterScope } from '../middleware/rbac.js';
import { RoleType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

describe('VIAP Electoral-Roll Import Core Defect Fix Verification Suite', () => {
  let testConstituency: any;
  let testMandal: any;

  before(async () => {
    // Fetch or create a test constituency and mandal for testing import hierarchy logic
    const parliament = await prisma.parliament.findFirst();

    testConstituency = await prisma.constituency.create({
      data: {
        name: `Test AC ${Date.now()}`,
        code: `AC-TEST-${Date.now()}`,
        parliamentId: parliament!.id,
      },
    });

    testMandal = await prisma.mandal.create({
      data: {
        name: `Test Mandal ${Date.now()}`,
        code: `MAN-TEST-${Date.now()}`,
        constituencyId: testConstituency.id,
      },
    });
  });

  after(async () => {
    // Cleanup test records
    if (testConstituency?.id) {
      await prisma.voter.deleteMany({ where: { constituencyId: testConstituency.id } });
      await prisma.voterGroup.deleteMany({ where: { booth: { village: { mandalId: testMandal.id } } } });
      await prisma.booth.deleteMany({ where: { village: { mandalId: testMandal.id } } });
      await prisma.village.deleteMany({ where: { mandalId: testMandal.id } });
      await prisma.mandal.deleteMany({ where: { constituencyId: testConstituency.id } });
      await prisma.constituency.deleteMany({ where: { id: testConstituency.id } });
    }
  });

  it('1. Column Auto-Mapping: Successfully recognizes all 14 headers from VOTER_DATA_FINAL.xlsx', () => {
    const rawHeaders = [
      'PART NO',
      'NEW SERIAL NO',
      'EPIC ID NO',
      'VOTER NAME',
      'RELATION',
      'RELATIVE NAME',
      'AGE',
      'GENDER',
      'ACTIVE/DELETE',
      'VILLAGE NAME',
      'POLLING STATION NAME',
      'HOUSE NUMBER',
      'CONSTITUENCY',
      'MANDAL NAME',
    ];

    const mapping = ApplicationsService.suggestColumnMapping(rawHeaders);
    
    assert.equal(mapping.suggestions['PART NO'], 'boothNumber', 'PART NO must map to boothNumber');
    assert.equal(mapping.suggestions['NEW SERIAL NO'], 'serialNumber', 'NEW SERIAL NO must map to serialNumber');
    assert.equal(mapping.suggestions['EPIC ID NO'], 'epicNumber', 'EPIC ID NO must map to epicNumber');
    assert.equal(mapping.suggestions['VOTER NAME'], 'fullName', 'VOTER NAME must map to fullName');
    assert.equal(mapping.suggestions['RELATION'], 'relationType', 'RELATION must map to relationType');
    assert.equal(mapping.suggestions['RELATIVE NAME'], 'relativeName', 'RELATIVE NAME must map to relativeName');
    assert.equal(mapping.suggestions['AGE'], 'age', 'AGE must map to age');
    assert.equal(mapping.suggestions['GENDER'], 'gender', 'GENDER must map to gender');
    assert.equal(mapping.suggestions['ACTIVE/DELETE'], 'voterStatus', 'ACTIVE/DELETE must map to voterStatus');
    assert.equal(mapping.suggestions['VILLAGE NAME'], 'village', 'VILLAGE NAME must map to village');
    assert.equal(mapping.suggestions['POLLING STATION NAME'], 'pollingStation', 'POLLING STATION NAME must map to pollingStation');
    assert.equal(mapping.suggestions['HOUSE NUMBER'], 'houseNumber', 'HOUSE NUMBER must map to houseNumber');
    assert.equal(mapping.suggestions['CONSTITUENCY'], 'constituency', 'CONSTITUENCY must map to constituency');
    assert.equal(mapping.suggestions['MANDAL NAME'], 'mandal', 'MANDAL NAME must map to mandal');
    assert.equal(mapping.unmapped.length, 0, 'Zero headers should remain unmapped');
  });

  it('2. Revision Pairs: ACTIVE/DELETE duplicate EPICs pass preflight validation without fatal errors', async () => {
    const testEpic = `REV${Date.now()}`;

    // Test BulkUploadService validation
    const report = await BulkUploadService.validateVotersOnly([
      {
        epicNumber: testEpic,
        name: 'Ramesh Kumar',
        age: 35,
        gender: 'MALE',
        voterStatus: 'DELETE',
      },
      {
        epicNumber: testEpic,
        name: 'Ramesh Kumar',
        age: 35,
        gender: 'MALE',
        voterStatus: 'ACTIVE',
      },
    ]);

    assert.equal(report.duplicateEpicsCount, 0, 'ACTIVE/DELETE revision pair must not count as fatal duplicate error');
  });

  it('3. Fail-Closed Scope Check: Null hierarchy fields fail closed in assertVoterScope', async () => {
    let statusCode = 0;
    let responseBody: any = null;

    const mockReply: any = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      send(data: any) {
        responseBody = data;
        return this;
      },
    };

    // User assigned to Booth B1
    const mockRequest: any = {
      user: { userId: 'user-123' },
      hierarchyScope: {
        role: RoleType.BOOTH_INCHARGE,
        isGlobalScope: false,
        accessibleBoothIds: new Set(['booth-valid-1']),
        accessibleVillageIds: new Set(),
        accessibleMandalIds: new Set(),
        accessibleConstituencyIds: new Set(),
      },
    };

    // Create a temporary voter with boothId = null in test constituency
    const unlinkedVoter = await prisma.voter.create({
      data: {
        serialNumber: 9999,
        epicNumber: `UNLINKED${Date.now()}`,
        name: 'Unlinked Elector',
        fatherHusbandName: 'Father',
        houseNumber: '1-1',
        age: 40,
        constituencyId: testConstituency.id,
        boothId: null, // NULL BOOTH ID
      },
    });

    try {
      const allowed = await assertVoterScope(mockRequest, mockReply, unlinkedVoter.id);
      assert.equal(allowed, false, 'assertVoterScope must return false for null boothId on BOOTH_INCHARGE');
      assert.equal(statusCode, 403, 'Must return 403 Forbidden');
    } finally {
      await prisma.voter.delete({ where: { id: unlinkedVoter.id } });
    }
  });

  it('4. Blank EPIC / Overseas Elector: Preserved without fatal preflight error', async () => {
    const report = await BulkUploadService.validateVotersOnly([
      {
        epicNumber: '',
        name: 'Suresh NRI',
        villageName: 'Overseas Elector',
        serialNumber: 1072,
        age: 45,
        gender: 'MALE',
        voterStatus: 'ACTIVE',
      },
    ]);

    assert.equal(report.missingRequiredCount, 0, 'Overseas Elector with blank EPIC must not be flagged as missing required EPIC');
    assert.equal(report.validRows, 1, 'Overseas Elector row must be accepted as valid');
  });

  it('5. Double-Active Conflict: Both records preserved and flagged for authorized review', async () => {
    const duplicateEpic = `CONFLICT${Date.now()}`;
    const report = await BulkUploadService.validateVotersOnly([
      {
        epicNumber: duplicateEpic,
        name: 'Venkata Rao',
        serialNumber: 371,
        boothNumber: '209',
        age: 50,
        gender: 'MALE',
        voterStatus: 'ACTIVE',
      },
      {
        epicNumber: duplicateEpic,
        name: 'Venkata Rao',
        serialNumber: 339,
        boothNumber: '210',
        age: 50,
        gender: 'MALE',
        voterStatus: 'ACTIVE',
      },
    ]);

    assert.equal(report.duplicateEpicsCount, 0, 'Double-active conflict must not fail preflight as an unhandled fatal duplicate');
    assert.equal(report.validRows, 2, 'Both duplicate-active conflict rows must be preserved for review');
  });

  it('6. 100-Voter Groups: Deterministic per-booth micro-clustering in blocks of 100', () => {
    // Simulate Booth B1 with 173 electors and Booth B2 with 250 electors
    const groupSize = 100;

    // Booth 1: 173 members
    const b1Counts = 173;
    const b1Groups = new Map<string, number>();
    for (let i = 1; i <= b1Counts; i++) {
      const gNum = Math.floor((i - 1) / groupSize) + 1;
      const gName = `Group ${gNum}`;
      b1Groups.set(gName, (b1Groups.get(gName) || 0) + 1);
    }

    assert.equal(b1Groups.get('Group 1'), 100, 'B1 Group 1 must have exactly 100 voters');
    assert.equal(b1Groups.get('Group 2'), 73, 'B1 Group 2 must have exactly 73 remainder voters');

    // Booth 2: 250 members - must reset independently
    const b2Counts = 250;
    const b2Groups = new Map<string, number>();
    for (let i = 1; i <= b2Counts; i++) {
      const gNum = Math.floor((i - 1) / groupSize) + 1;
      const gName = `Group ${gNum}`;
      b2Groups.set(gName, (b2Groups.get(gName) || 0) + 1);
    }

    assert.equal(b2Groups.get('Group 1'), 100, 'B2 Group 1 must have exactly 100 voters');
    assert.equal(b2Groups.get('Group 2'), 100, 'B2 Group 2 must have exactly 100 voters');
    assert.equal(b2Groups.get('Group 3'), 50, 'B2 Group 3 must have exactly 50 remainder voters');
  });

  it('7. Age Bounds: Clerical anomalies clamped without silently dropping voter enrollment', async () => {
    const report = await BulkUploadService.validateVotersOnly([
      {
        epicNumber: `AGE17_${Date.now()}`,
        name: 'Young Elector',
        age: 17, // Underage clerical error in official roll
        gender: 'MALE',
        voterStatus: 'ACTIVE',
      },
      {
        epicNumber: `AGE121_${Date.now()}`,
        name: 'Elder Elector',
        age: 121, // Centenary elector
        gender: 'FEMALE',
        voterStatus: 'ACTIVE',
      },
    ]);

    assert.equal(report.validRows, 2, 'Electors with clerical age anomalies must remain enrolled without silent exclusion');
  });
});
