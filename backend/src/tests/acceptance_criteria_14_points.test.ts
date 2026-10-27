import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ApplicationsService } from '../modules/applications/applications.service.js';
import { prisma } from '../lib/prisma.js';
import { RoleType, VoterStatus, VoteStatus, SurveyStatus } from '@prisma/client';
import { assertVoterScope } from '../middleware/rbac.js';

describe('Section I: 14 Acceptance Criteria End-to-End Verification Suite', () => {
  let parliament: any;
  let acAlpha: any;
  let acBeta: any;
  let mandalAlpha: any;
  let villageAlpha: any;
  const runId = Date.now().toString().slice(-6);

  before(async () => {
    parliament = await prisma.parliament.findFirst();
    if (!parliament) throw new Error('Reference parliament required');

    // Create 2 independent test constituencies
    acAlpha = await prisma.constituency.create({
      data: {
        name: `AC Alpha ${runId}`,
        code: `AC-A-${runId}`,
        parliamentId: parliament.id,
      },
    });

    acBeta = await prisma.constituency.create({
      data: {
        name: `AC Beta ${runId}`,
        code: `AC-B-${runId}`,
        parliamentId: parliament.id,
      },
    });

    mandalAlpha = await prisma.mandal.create({
      data: {
        name: `Mandal Alpha ${runId}`,
        code: `MAN-A-${runId}`,
        constituencyId: acAlpha.id,
      },
    });

    villageAlpha = await prisma.village.create({
      data: {
        name: `Village Alpha ${runId}`,
        code: `VIL-A-${runId}`,
        mandalId: mandalAlpha.id,
      },
    });
  });

  after(async () => {
    for (const ac of [acAlpha, acBeta]) {
      if (ac?.id) {
        await prisma.voteTracking.deleteMany({ where: { voter: { constituencyId: ac.id } } });
        await prisma.voterAssignment.deleteMany({ where: { voter: { constituencyId: ac.id } } });
        await prisma.fakeVoterFlag.deleteMany({ where: { voter: { constituencyId: ac.id } } });
        await prisma.voterMigration.deleteMany({ where: { voter: { constituencyId: ac.id } } });
        await prisma.voter.deleteMany({ where: { constituencyId: ac.id } });
        await prisma.dataImportError.deleteMany({ where: { import: { targetConstituencyId: ac.id } } });
        await prisma.dataImport.deleteMany({ where: { targetConstituencyId: ac.id } });
        await prisma.voterGroup.deleteMany({ where: { booth: { village: { mandal: { constituencyId: ac.id } } } } });
        await prisma.booth.deleteMany({ where: { village: { mandal: { constituencyId: ac.id } } } });
        await prisma.village.deleteMany({ where: { mandal: { constituencyId: ac.id } } });
        await prisma.mandal.deleteMany({ where: { constituencyId: ac.id } });
        await prisma.constituency.deleteMany({ where: { id: ac.id } });
      }
    }
  });

  it('Criteria 1 & 13: Two constituencies can be imported independently and leave each other unchanged', async () => {
    const alphaRows = [
      {
        'PART NO': '101',
        'NEW SERIAL NO': '1',
        'EPIC ID NO': `ALPHA-1-${runId}`,
        'VOTER NAME': 'Alpha Voter 1',
        'RELATION': 'FATHER',
        'RELATIVE NAME': 'Father Alpha',
        'AGE': '30',
        'GENDER': 'MALE',
        'ACTIVE/DELETE': 'ACTIVE',
        'VILLAGE NAME': villageAlpha.name,
        'POLLING STATION NAME': 'Alpha PS 101',
        'HOUSE NUMBER': '1-1',
        'CONSTITUENCY': acAlpha.name,
        'MANDAL NAME': mandalAlpha.name,
      },
    ];

    const betaRows = [
      {
        'PART NO': '201',
        'NEW SERIAL NO': '1',
        'EPIC ID NO': `BETA-1-${runId}`,
        'VOTER NAME': 'Beta Voter 1',
        'RELATION': 'FATHER',
        'RELATIVE NAME': 'Father Beta',
        'AGE': '40',
        'GENDER': 'FEMALE',
        'ACTIVE/DELETE': 'ACTIVE',
        'VILLAGE NAME': `Village Beta ${runId}`,
        'POLLING STATION NAME': 'Beta PS 201',
        'HOUSE NUMBER': '2-2',
        'CONSTITUENCY': acBeta.name,
        'MANDAL NAME': `Mandal Beta ${runId}`,
      },
    ];

    // Import into AC Alpha
    await ApplicationsService.importData('default', 'VOTER', alphaRows, {
      targetConstituencyId: acAlpha.id,
      importMode: 'REFRESH',
    });

    const betaCountBefore = await prisma.voter.count({ where: { constituencyId: acBeta.id } });
    assert.equal(betaCountBefore, 0, 'Beta constituency must remain untouched (0 voters)');

    // Import into AC Beta
    await ApplicationsService.importData('default', 'VOTER', betaRows, {
      targetConstituencyId: acBeta.id,
      importMode: 'REFRESH',
    });

    const alphaCountAfter = await prisma.voter.count({ where: { constituencyId: acAlpha.id } });
    const betaCountAfter = await prisma.voter.count({ where: { constituencyId: acBeta.id } });
    assert.equal(alphaCountAfter, 1, 'Alpha constituency voter count must remain exactly 1');
    assert.equal(betaCountAfter, 1, 'Beta constituency voter count must remain exactly 1');
  });

  it('Criteria 2: Different workbook sizes and dynamic hierarchies work without code changes', async () => {
    // Test a dynamic batch of 105 voters across 2 distinct booths
    const dynamicRows = [];
    for (let i = 1; i <= 105; i++) {
      dynamicRows.push({
        'PART NO': i <= 100 ? '102' : '103',
        'NEW SERIAL NO': String(i),
        'EPIC ID NO': `DYN-${i}-${runId}`,
        'VOTER NAME': `Dynamic Elector ${i}`,
        'RELATION': 'FATHER',
        'RELATIVE NAME': `Relative ${i}`,
        'AGE': String(20 + (i % 50)),
        'GENDER': i % 2 === 0 ? 'FEMALE' : 'MALE',
        'ACTIVE/DELETE': 'ACTIVE',
        'VILLAGE NAME': villageAlpha.name,
        'POLLING STATION NAME': 'Dynamic Station',
        'HOUSE NUMBER': `H-${i}`,
        'CONSTITUENCY': acAlpha.name,
        'MANDAL NAME': mandalAlpha.name,
      });
    }

    const res = await ApplicationsService.importData('default', 'VOTER', dynamicRows, {
      targetConstituencyId: acAlpha.id,
      importMode: 'REFRESH',
    });

    assert.equal(res.status, 'SUCCESS');
    assert.equal(res.importedCount, 105);
  });

  it('Criteria 3 & 4 & 14: Reimporting preserves voter IDs, operational history, and creates 0 duplicates', async () => {
    // Create an initial voter with rich operational data
    const origEpic = `PERSIST-${runId}`;
    await ApplicationsService.importData(
      'default',
      'VOTER',
      [
        {
          'PART NO': '104',
          'NEW SERIAL NO': '1',
          'EPIC ID NO': origEpic,
          'VOTER NAME': 'Original Name',
          'RELATION': 'FATHER',
          'RELATIVE NAME': 'Original Father',
          'AGE': '28',
          'GENDER': 'MALE',
          'ACTIVE/DELETE': 'ACTIVE',
          'VILLAGE NAME': villageAlpha.name,
          'POLLING STATION NAME': 'PS 104',
          'HOUSE NUMBER': '10-20',
          'CONSTITUENCY': acAlpha.name,
          'MANDAL NAME': mandalAlpha.name,
        },
      ],
      { targetConstituencyId: acAlpha.id, importMode: 'REFRESH' }
    );

    const voterBefore = await prisma.voter.findUnique({ where: { epicNumber: origEpic } });
    assert.ok(voterBefore);

    // Attach operational sub-records (VoteTracking & VoterAssignment)
    const adminUser = await prisma.user.findFirst();
    if (adminUser) {
      await prisma.voteTracking.create({
        data: {
          voterId: voterBefore.id,
          status: VoteStatus.VOTE_DONE,
          markedById: adminUser.id,
          notes: 'Ground check verified',
        },
      });
      await prisma.voterAssignment.create({
        data: {
          voterId: voterBefore.id,
          assignedUserId: adminUser.id,
          notes: 'Cadre lead assignment',
        },
      });
    }

    // Reimport with updated roll data (revised age & serial)
    const reimportRes = await ApplicationsService.importData(
      'default',
      'VOTER',
      [
        {
          'PART NO': '104',
          'NEW SERIAL NO': '2', // updated serial
          'EPIC ID NO': origEpic,
          'VOTER NAME': 'Revised Name',
          'RELATION': 'FATHER',
          'RELATIVE NAME': 'Original Father',
          'AGE': '29', // updated age
          'GENDER': 'MALE',
          'ACTIVE/DELETE': 'ACTIVE',
          'VILLAGE NAME': villageAlpha.name,
          'POLLING STATION NAME': 'PS 104',
          'HOUSE NUMBER': '10-20',
          'CONSTITUENCY': acAlpha.name,
          'MANDAL NAME': mandalAlpha.name,
        },
      ],
      { targetConstituencyId: acAlpha.id, importMode: 'REFRESH' }
    );

    assert.equal(reimportRes.updatedCount, 1);
    assert.equal(reimportRes.importedCount, 0, 'Zero duplicate voters created on reimport');

    const voterAfter = await prisma.voter.findUnique({ where: { epicNumber: origEpic } });
    assert.equal(voterAfter!.id, voterBefore.id, 'Primary key UUID must remain identical');
    assert.equal(voterAfter!.name, 'Revised Name');
    assert.equal(voterAfter!.age, 29);
    assert.equal(voterAfter!.serialNumber, 2);

    // Verify operational history survived intact
    const trackingCount = await prisma.voteTracking.count({ where: { voterId: voterBefore.id } });
    const assignmentCount = await prisma.voterAssignment.count({ where: { voterId: voterBefore.id } });
    assert.equal(trackingCount, adminUser ? 1 : 0);
    assert.equal(assignmentCount, adminUser ? 1 : 0);
  });

  it('Criteria 5: Missing optional data is left blank/null and NOT fabricated', async () => {
    const rawEpic = `CLEAN-OPT-${runId}`;
    await ApplicationsService.importData(
      'default',
      'VOTER',
      [
        {
          'PART NO': '105',
          'NEW SERIAL NO': '1',
          'EPIC ID NO': rawEpic,
          'VOTER NAME': 'Clean Citizen',
          'RELATION': 'FATHER',
          'RELATIVE NAME': '', // blank relative
          'AGE': '25',
          'GENDER': 'FEMALE',
          'ACTIVE/DELETE': 'ACTIVE',
          'VILLAGE NAME': villageAlpha.name,
          'POLLING STATION NAME': 'PS 105',
          'HOUSE NUMBER': '', // blank house
          'MOBILE NUMBER': '', // blank mobile
          'CASTE': '', // blank caste
          'PROFESSION': '', // blank profession
          'CONSTITUENCY': acAlpha.name,
          'MANDAL NAME': mandalAlpha.name,
        },
      ],
      { targetConstituencyId: acAlpha.id, importMode: 'REFRESH' }
    );

    const voter = await prisma.voter.findUnique({ where: { epicNumber: rawEpic } });
    assert.ok(voter);
    assert.equal(voter.mobileNumber, null, 'Mobile number must remain null when missing in source');
    assert.equal(voter.caste, null, 'Caste must remain null when missing in source');
    assert.equal(voter.profession, null, 'Profession must remain null when missing in source');
    assert.equal(voter.houseNumber, '', 'House number must be empty string, NOT synthetic 1-1 or similar');
    assert.equal(voter.fatherHusbandName, '', 'Relative name must be empty string, NOT synthetic Relative');
    assert.equal(voter.surveyStatus, SurveyStatus.NOT_SURVEYED, 'surveyStatus must remain NOT_SURVEYED');
  });

  it('Criteria 6 & 7: Invalid records are quarantined with explicit reasons and reconcile with source totals', async () => {
    const rows = [
      {
        'PART NO': '106',
        'NEW SERIAL NO': '1',
        'EPIC ID NO': `VALID-RECON-${runId}`,
        'VOTER NAME': 'Valid Record',
        'AGE': '30',
        'GENDER': 'MALE',
        'ACTIVE/DELETE': 'ACTIVE',
        'VILLAGE NAME': villageAlpha.name,
        'POLLING STATION NAME': 'PS 106',
        'CONSTITUENCY': acAlpha.name,
        'MANDAL NAME': mandalAlpha.name,
      },
      {
        'PART NO': '', // Missing required Booth Number
        'NEW SERIAL NO': '2',
        'EPIC ID NO': `INVALID-BOOTH-${runId}`,
        'VOTER NAME': 'Invalid Booth Voter',
        'AGE': '30',
        'GENDER': 'MALE',
        'ACTIVE/DELETE': 'ACTIVE',
        'VILLAGE NAME': villageAlpha.name,
        'POLLING STATION NAME': 'PS 106',
        'CONSTITUENCY': acAlpha.name,
        'MANDAL NAME': mandalAlpha.name,
      },
      {
        'PART NO': '106',
        'NEW SERIAL NO': '3',
        'EPIC ID NO': `INVALID-NAME-${runId}`,
        'VOTER NAME': '', // Missing required Full Name
        'AGE': '30',
        'GENDER': 'MALE',
        'ACTIVE/DELETE': 'ACTIVE',
        'VILLAGE NAME': villageAlpha.name,
        'POLLING STATION NAME': 'PS 106',
        'CONSTITUENCY': acAlpha.name,
        'MANDAL NAME': mandalAlpha.name,
      },
    ];

    const res = await ApplicationsService.importData('default', 'VOTER', rows, {
      targetConstituencyId: acAlpha.id,
      importMode: 'REFRESH',
    });

    assert.equal(res.totalRows, 3);
    assert.equal(res.importedCount, 1);
    assert.equal(res.errorCount, 2);
    assert.equal(res.skippedCount, 2);

    // Source reconciliation equation: totalRows === imported + updated + skipped
    assert.equal(res.totalRows, res.importedCount + res.updatedCount + res.skippedCount);

    // Verify explicit quarantine errors
    const boothError = res.errors.find((e: any) => e.field === 'boothNumber');
    const nameError = res.errors.find((e: any) => e.field === 'fullName');
    assert.ok(boothError, 'Missing boothNumber must be explicitly recorded');
    assert.ok(nameError, 'Missing fullName must be explicitly recorded');
  });

  it('Criteria 8: Active and inactive/deleted source records reconcile separately', async () => {
    const rows = [
      {
        'PART NO': '107',
        'NEW SERIAL NO': '1',
        'EPIC ID NO': `ACT-SEP-${runId}`,
        'VOTER NAME': 'Active Elector',
        'AGE': '30',
        'GENDER': 'MALE',
        'ACTIVE/DELETE': 'ACTIVE',
        'VILLAGE NAME': villageAlpha.name,
        'POLLING STATION NAME': 'PS 107',
        'CONSTITUENCY': acAlpha.name,
        'MANDAL NAME': mandalAlpha.name,
      },
      {
        'PART NO': '107',
        'NEW SERIAL NO': '2',
        'EPIC ID NO': `DEL-SEP-${runId}`,
        'VOTER NAME': 'Deleted Elector',
        'AGE': '30',
        'GENDER': 'MALE',
        'ACTIVE/DELETE': 'DELETE',
        'VILLAGE NAME': villageAlpha.name,
        'POLLING STATION NAME': 'PS 107',
        'CONSTITUENCY': acAlpha.name,
        'MANDAL NAME': mandalAlpha.name,
      },
    ];

    const res = await ApplicationsService.importData('default', 'VOTER', rows, {
      targetConstituencyId: acAlpha.id,
      importMode: 'REFRESH',
    });

    assert.equal(res.reconciliationReport.statusTotals.active, 1);
    assert.equal(res.reconciliationReport.statusTotals.deleted, 1);

    const actVoter = await prisma.voter.findUnique({ where: { epicNumber: `ACT-SEP-${runId}` } });
    const delVoter = await prisma.voter.findUnique({ where: { epicNumber: `DEL-SEP-${runId}` } });
    assert.equal(actVoter!.voterStatus, VoterStatus.ACTIVE);
    assert.equal(delVoter!.voterStatus, VoterStatus.SHIFTED);
  });

  it('Criteria 9: Group membership is correct and every eligible voter belongs to exactly 1 group', async () => {
    const booth = await prisma.booth.findFirst({ where: { boothNumber: '102', village: { mandalId: mandalAlpha.id } } });
    assert.ok(booth);

    const unassignedVoters = await prisma.voter.count({
      where: { boothId: booth.id, voterGroupId: null },
    });
    assert.equal(unassignedVoters, 0, 'Zero eligible voters can be left unassigned');
  });

  it('Criteria 10 & 11: Scope authorization fails closed on unauthorized hierarchy access', async () => {
    let statusCode = 0;
    const mockReply: any = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      send() {
        return this;
      },
    };

    // User assigned ONLY to Booth 101 in AC Alpha
    const mockReq: any = {
      user: { userId: 'booth-incharge-1' },
      hierarchyScope: {
        role: RoleType.BOOTH_INCHARGE,
        isGlobalScope: false,
        accessibleBoothIds: new Set(['booth-alpha-101']),
        accessibleVillageIds: new Set(),
        accessibleMandalIds: new Set(),
        accessibleConstituencyIds: new Set([acAlpha.id]),
      },
    };

    // Create voter in AC Beta (unauthorized tenant)
    const betaVoter = await prisma.voter.findFirst({ where: { constituencyId: acBeta.id } });
    assert.ok(betaVoter);

    const isAuthorized = await assertVoterScope(mockReq, mockReply, betaVoter.id);
    assert.equal(isAuthorized, false, 'assertVoterScope must return false for unauthorized constituency');
    assert.equal(statusCode, 403, 'Forbidden 403 status code must be returned');
  });

  it('Criteria 12: Import failures roll back safely leaving zero partial writes', async () => {
    const rows = [
      {
        'PART NO': '108',
        'NEW SERIAL NO': '1',
        'EPIC ID NO': `ROLLBACK-1-${runId}`,
        'VOTER NAME': 'Rollback Voter 1',
        'AGE': '30',
        'GENDER': 'MALE',
        'ACTIVE/DELETE': 'ACTIVE',
        'VILLAGE NAME': villageAlpha.name,
        'POLLING STATION NAME': 'PS 108',
        'CONSTITUENCY': acAlpha.name,
        'MANDAL NAME': mandalAlpha.name,
      },
    ];

    // Inject an intentional mid-transaction error
    await assert.rejects(
      async () => {
        await ApplicationsService.importData(
          'default',
          'VOTER',
          rows,
          {
            targetConstituencyId: acAlpha.id,
            importMode: 'REFRESH',
            _testHookDuringTransaction: async () => {
              throw new Error('Simulated database deadlock / network failure midway');
            },
          }
        );
      },
      /Simulated database deadlock/
    );

    // Verify voter was rolled back and does not exist in DB
    const leakedVoter = await prisma.voter.findUnique({ where: { epicNumber: `ROLLBACK-1-${runId}` } });
    assert.equal(leakedVoter, null, 'Zero partial writes must remain after transaction failure');
  });
});
