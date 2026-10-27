import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma.js';
import { ApplicationsService } from '../modules/applications/applications.service.js';
import {
  Gender,
  RelationType,
  RoleType,
  SurveyStatus,
  VoterLocationStatus,
  VoterStatus,
  VoteStatus,
} from '@prisma/client';

describe('Safe Revision-Aware UPSERT/REFRESH Strategy Test Suite', () => {
  let testConstituency: any;
  let otherConstituency: any;
  let testMandal: any;
  let testVillage: any;
  let testBooth: any;
  let testGroup: any;
  let testUser: any;

  let existingVoterA: any;
  let initialOtherConstituencyCount: number;

  before(async () => {
    // 1. Fetch existing parliament & create isolated test constituency
    const parliament = await prisma.parliament.findFirst();
    const org = await prisma.organisation.findFirst();

    testConstituency = await prisma.constituency.create({
      data: {
        name: `Safe Refresh Test AC ${Date.now()}`,
        code: `AC-REFRESH-${Date.now()}`,
        parliamentId: parliament!.id,
      },
    });

    otherConstituency = await prisma.constituency.findFirst({
      where: { id: { not: testConstituency.id } },
    });
    initialOtherConstituencyCount = await prisma.voter.count({
      where: { constituencyId: otherConstituency?.id },
    });

    // 2. Setup hierarchy
    testMandal = await prisma.mandal.create({
      data: {
        name: 'Refresh Mandal',
        code: `MDL-REF-${Date.now()}`,
        constituencyId: testConstituency.id,
      },
    });

    testVillage = await prisma.village.create({
      data: {
        name: 'Refresh Village',
        code: `VIL-REF-${Date.now()}`,
        mandalId: testMandal.id,
      },
    });

    testBooth = await prisma.booth.create({
      data: {
        name: 'Booth 101',
        boothNumber: '101',
        code: `BTH-REF-${Date.now()}`,
        villageId: testVillage.id,
      },
    });

    testGroup = await prisma.voterGroup.create({
      data: {
        name: 'Group 1',
        code: `GRP-REF-${Date.now()}`,
        boothId: testBooth.id,
      },
    });

    // 3. Create test user for assignments & audit
    testUser = await prisma.user.create({
      data: {
        name: 'Refresh Test User',
        userCode: `USR-REF-${Date.now()}`,
        mobileNumber: `9090${Math.floor(100000 + Math.random() * 900000)}`,
        role: RoleType.SUPER_ADMIN,
        organisationId: org?.id,
      },
    });

    // 4. Create existing voter with rich operational data
    existingVoterA = await prisma.voter.create({
      data: {
        serialNumber: 1,
        epicNumber: `EPIC-REFRESH-A-${Date.now()}`,
        name: 'Voter Alpha Original',
        fatherHusbandName: 'Relative Alpha',
        relationType: RelationType.FATHER,
        houseNumber: '1-10/A',
        age: 38,
        gender: Gender.MALE,
        mobileNumber: '9849012345',
        caste: 'BC-B',
        profession: 'Software Engineer',
        politicalPreference: 'TDP',
        voterStatus: VoterStatus.ACTIVE,
        surveyStatus: SurveyStatus.SURVEYED,
        voteStatus: VoteStatus.VOTE_DONE,
        voteDoneAt: new Date(),
        locationStatus: VoterLocationStatus.LOCAL,
        voterLocationStatus: VoterLocationStatus.LOCAL,
        constituencyId: testConstituency.id,
        mandalId: testMandal.id,
        villageId: testVillage.id,
        boothId: testBooth.id,
        voterGroupId: testGroup.id,
        assignedInchargeId: testUser.id,
      },
    });

    // Attach relational operational sub-records to Voter Alpha
    await prisma.voterAssignment.create({
      data: {
        voterId: existingVoterA.id,
        assignedUserId: testUser.id,
        notes: 'Priority field worker assignment',
      },
    });

    await prisma.voteTracking.create({
      data: {
        voterId: existingVoterA.id,
        status: VoteStatus.VOTE_DONE,
        markedById: testUser.id,
        notes: 'Verified at polling booth 101',
      },
    });

    await prisma.fakeVoterFlag.create({
      data: {
        voterId: existingVoterA.id,
        reason: 'Opposition objection filed',
        flaggedById: testUser.id,
      },
    });

    await prisma.voterMigration.create({
      data: {
        voterId: existingVoterA.id,
        destinationCity: 'Hyderabad',
        destinationState: 'Telangana',
      },
    });
  });

  after(async () => {
    // Clean up test records
    if (testConstituency?.id) {
      await prisma.voteTracking.deleteMany({ where: { voter: { constituencyId: testConstituency.id } } });
      await prisma.fakeVoterFlag.deleteMany({ where: { voter: { constituencyId: testConstituency.id } } });
      await prisma.voterMigration.deleteMany({ where: { voter: { constituencyId: testConstituency.id } } });
      await prisma.voterAssignment.deleteMany({ where: { voter: { constituencyId: testConstituency.id } } });
      await prisma.voter.deleteMany({ where: { constituencyId: testConstituency.id } });
      await prisma.voterGroup.deleteMany({ where: { booth: { village: { mandal: { constituencyId: testConstituency.id } } } } });
      await prisma.booth.deleteMany({ where: { village: { mandal: { constituencyId: testConstituency.id } } } });
      await prisma.village.deleteMany({ where: { mandal: { constituencyId: testConstituency.id } } });
      await prisma.mandal.deleteMany({ where: { constituencyId: testConstituency.id } });
      await prisma.constituency.deleteMany({ where: { id: testConstituency.id } });
    }
    if (testUser?.id) {
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    }
  });

  it('1. Existing voter retains the exact same ID after roll refresh', async () => {
    const refreshRows = [
      {
        'PART NO': '101',
        'NEW SERIAL NO': 5, // updated serial in new revision
        'EPIC ID NO': existingVoterA.epicNumber,
        'VOTER NAME': 'Voter Alpha Revised', // official spelling update
        'RELATION': 'FATHER',
        'RELATIVE NAME': 'Relative Alpha Revised',
        'AGE': 39, // incremented age
        'GENDER': 'MALE',
        'ACTIVE/DELETE': 'ACTIVE',
        'VILLAGE NAME': 'Refresh Village',
        'POLLING STATION NAME': 'Booth 101',
        'HOUSE NUMBER': '1-10/B', // updated house number
        'CONSTITUENCY': testConstituency.name,
        'MANDAL NAME': 'Refresh Mandal',
      },
    ];

    const result = await ApplicationsService.importData('default', 'VOTER', refreshRows, {
      importMode: 'REFRESH',
      targetConstituencyId: testConstituency.id,
      fileName: 'test_refresh.xlsx',
    });

    assert.equal(result.successCount, 1, 'Success count must be 1');
    assert.equal(result.updatedCount, 1, 'Updated count must be 1 for in-place refresh');
    assert.equal(result.errorCount, 0);

    const refreshedVoter = await prisma.voter.findUnique({
      where: { epicNumber: existingVoterA.epicNumber },
    });

    assert.ok(refreshedVoter);
    assert.equal(refreshedVoter.id, existingVoterA.id, 'Primary key UUID must remain identical');
    assert.equal(refreshedVoter.name, 'Voter Alpha Revised', 'Roll name must update');
    assert.equal(refreshedVoter.age, 39, 'Roll age must update');
    assert.equal(refreshedVoter.serialNumber, 5, 'Serial number must update');
    assert.equal(refreshedVoter.houseNumber, '1-10/B', 'House number must update');
  });

  it('2. Related assignments, vote tracking, and operational survey data survive refresh', async () => {
    // Verify child relational models
    const assignments = await prisma.voterAssignment.findMany({ where: { voterId: existingVoterA.id } });
    assert.equal(assignments.length, 1, 'VoterAssignment must survive roll refresh');

    const trackings = await prisma.voteTracking.findMany({ where: { voterId: existingVoterA.id } });
    assert.equal(trackings.length, 1, 'VoteTracking must survive roll refresh');
    assert.equal(trackings[0].status, VoteStatus.VOTE_DONE);

    const flags = await prisma.fakeVoterFlag.findMany({ where: { voterId: existingVoterA.id } });
    assert.equal(flags.length, 1, 'FakeVoterFlag must survive roll refresh');

    const migrations = await prisma.voterMigration.findMany({ where: { voterId: existingVoterA.id } });
    assert.equal(migrations.length, 1, 'VoterMigration must survive roll refresh');
    assert.equal(migrations[0].destinationCity, 'Hyderabad');

    // Verify in-record operational survey and live polling fields
    const voter = await prisma.voter.findUnique({ where: { id: existingVoterA.id } });
    assert.equal(voter!.surveyStatus, SurveyStatus.SURVEYED, 'surveyStatus must not be reset to NOT_SURVEYED');
    assert.equal(voter!.voteStatus, VoteStatus.VOTE_DONE, 'voteStatus must not be reset to NOT_VOTED');
    assert.equal(voter!.politicalPreference, 'TDP', 'Field survey politicalPreference must not be overwritten by NEUTRAL default');
    assert.equal(voter!.mobileNumber, '9849012345', 'Volunteer-collected mobile number must not be erased');
    assert.equal(voter!.caste, 'BC-B', 'Surveyed caste must not be erased');
    assert.equal(voter!.assignedInchargeId, testUser.id, 'assignedInchargeId must remain intact');
  });

  it('3. Genuinely new electors are inserted while existing electors are updated', async () => {
    const newEpic = `EPIC-REFRESH-NEW-${Date.now()}`;
    const mixedRows = [
      {
        'PART NO': '101',
        'NEW SERIAL NO': 5,
        'EPIC ID NO': existingVoterA.epicNumber,
        'VOTER NAME': 'Voter Alpha Revised',
        'RELATION': 'FATHER',
        'RELATIVE NAME': 'Relative Alpha',
        'AGE': 39,
        'GENDER': 'MALE',
        'ACTIVE/DELETE': 'ACTIVE',
        'VILLAGE NAME': 'Refresh Village',
        'POLLING STATION NAME': 'Booth 101',
        'HOUSE NUMBER': '1-10/B',
        'CONSTITUENCY': testConstituency.name,
        'MANDAL NAME': 'Refresh Mandal',
      },
      {
        'PART NO': '101',
        'NEW SERIAL NO': 6,
        'EPIC ID NO': newEpic,
        'VOTER NAME': 'Voter Beta Brand New',
        'RELATION': 'MOTHER',
        'RELATIVE NAME': 'Mother Beta',
        'AGE': 22,
        'GENDER': 'FEMALE',
        'ACTIVE/DELETE': 'ACTIVE',
        'VILLAGE NAME': 'Refresh Village',
        'POLLING STATION NAME': 'Booth 101',
        'HOUSE NUMBER': '2-20',
        'CONSTITUENCY': testConstituency.name,
        'MANDAL NAME': 'Refresh Mandal',
      },
    ];

    const result = await ApplicationsService.importData('default', 'VOTER', mixedRows, {
      importMode: 'UPSERT',
      targetConstituencyId: testConstituency.id,
    });

    assert.equal(result.successCount, 2, 'Success count must be 2');
    assert.equal(result.updatedCount, 1, '1 existing voter must be updated in-place');
    assert.equal(result.importedCount, 1, '1 genuinely new voter must be inserted');
    assert.equal(result.errorCount, 0);

    const newVoter = await prisma.voter.findUnique({ where: { epicNumber: newEpic } });
    assert.ok(newVoter, 'Genuinely new voter must be inserted');
    assert.equal(newVoter.name, 'Voter Beta Brand New');
    assert.equal(newVoter.constituencyId, testConstituency.id);

    // Existing voter still exists with same ID
    const existing = await prisma.voter.findUnique({ where: { epicNumber: existingVoterA.epicNumber } });
    assert.equal(existing!.id, existingVoterA.id);
  });

  it('4. Revision pairs and active/active conflicts are correctly differentiated and flagged', async () => {
    const revEpic = `REV-PAIR-${Date.now()}`;
    const conflictEpic = `CONFLICT-PAIR-${Date.now()}`;

    const conflictRows = [
      // 1. Revision pair (Active + Delete)
      {
        'PART NO': '101',
        'NEW SERIAL NO': 10,
        'EPIC ID NO': revEpic,
        'VOTER NAME': 'Migrated Elector Active',
        'RELATION': 'FATHER',
        'RELATIVE NAME': 'Father',
        'AGE': 30,
        'GENDER': 'MALE',
        'ACTIVE/DELETE': 'ACTIVE',
        'VILLAGE NAME': 'Refresh Village',
        'POLLING STATION NAME': 'Booth 101',
        'HOUSE NUMBER': '3-30',
        'CONSTITUENCY': testConstituency.name,
        'MANDAL NAME': 'Refresh Mandal',
      },
      {
        'PART NO': '101',
        'NEW SERIAL NO': 11,
        'EPIC ID NO': revEpic,
        'VOTER NAME': 'Migrated Elector Delete',
        'RELATION': 'FATHER',
        'RELATIVE NAME': 'Father',
        'AGE': 30,
        'GENDER': 'MALE',
        'ACTIVE/DELETE': 'DELETE',
        'VILLAGE NAME': 'Refresh Village',
        'POLLING STATION NAME': 'Booth 101',
        'HOUSE NUMBER': '3-30',
        'CONSTITUENCY': testConstituency.name,
        'MANDAL NAME': 'Refresh Mandal',
      },
      // 2. Dual-active conflict (Active + Active)
      {
        'PART NO': '101',
        'NEW SERIAL NO': 20,
        'EPIC ID NO': conflictEpic,
        'VOTER NAME': 'Conflict Elector Part 101',
        'RELATION': 'FATHER',
        'RELATIVE NAME': 'Father',
        'AGE': 45,
        'GENDER': 'MALE',
        'ACTIVE/DELETE': 'ACTIVE',
        'VILLAGE NAME': 'Refresh Village',
        'POLLING STATION NAME': 'Booth 101',
        'HOUSE NUMBER': '4-40',
        'CONSTITUENCY': testConstituency.name,
        'MANDAL NAME': 'Refresh Mandal',
      },
      {
        'PART NO': '101',
        'NEW SERIAL NO': 21,
        'EPIC ID NO': conflictEpic,
        'VOTER NAME': 'Conflict Elector Part 101 Copy',
        'RELATION': 'FATHER',
        'RELATIVE NAME': 'Father',
        'AGE': 45,
        'GENDER': 'MALE',
        'ACTIVE/DELETE': 'ACTIVE',
        'VILLAGE NAME': 'Refresh Village',
        'POLLING STATION NAME': 'Booth 101',
        'HOUSE NUMBER': '4-40',
        'CONSTITUENCY': testConstituency.name,
        'MANDAL NAME': 'Refresh Mandal',
      },
    ];

    const result = await ApplicationsService.importData('default', 'VOTER', conflictRows, {
      importMode: 'REFRESH',
      targetConstituencyId: testConstituency.id,
    });

    assert.equal(result.importedCount, 4);

    // Verify revision pair: active row has status ACTIVE, delete row has status SHIFTED and suffix
    const revActive = await prisma.voter.findUnique({ where: { epicNumber: revEpic } });
    assert.ok(revActive);
    assert.equal(revActive.voterStatus, VoterStatus.ACTIVE);

    const revDelete = await prisma.voter.findFirst({
      where: { constituencyId: testConstituency.id, epicNumber: { startsWith: `${revEpic}-DEL` } },
    });
    assert.ok(revDelete, 'Delete counterpart must be preserved with -DEL suffix');
    assert.equal(revDelete.voterStatus, VoterStatus.SHIFTED);
    assert.ok(revDelete.notes?.includes('ECI_DELETED_IN_REVISION'));

    // Verify dual active conflict: both rows preserved, second row flagged
    const active1 = await prisma.voter.findUnique({ where: { epicNumber: conflictEpic } });
    assert.ok(active1);
    assert.equal(active1.voterStatus, VoterStatus.ACTIVE);

    const active2 = await prisma.voter.findFirst({
      where: { constituencyId: testConstituency.id, epicNumber: { startsWith: `${conflictEpic}-DUP` } },
    });
    assert.ok(active2, 'Second active duplicate row must be preserved with -DUP suffix');
    assert.equal(active2.voterStatus, VoterStatus.ACTIVE);
    assert.ok(active2.notes?.includes('DUPLICATE_ACTIVE_CONFLICT'));
  });

  it('5. Re-importing the same workbook is completely idempotent (creates zero duplicates)', async () => {
    const votersBefore = await prisma.voter.count({ where: { constituencyId: testConstituency.id } });
    const boothsBefore = await prisma.booth.count({ where: { village: { mandal: { constituencyId: testConstituency.id } } } });
    const groupsBefore = await prisma.voterGroup.count({ where: { booth: { village: { mandal: { constituencyId: testConstituency.id } } } } });

    // Fetch all voters in constituency and construct identical row data
    const allVoters = await prisma.voter.findMany({
      where: { constituencyId: testConstituency.id },
      include: { booth: { include: { village: { include: { mandal: true } } } } },
    });

    const identicalRows = allVoters.map((v) => ({
      'PART NO': v.booth?.boothNumber || '101',
      'NEW SERIAL NO': v.serialNumber,
      'EPIC ID NO': v.epicNumber,
      'VOTER NAME': v.name,
      'RELATION': 'FATHER',
      'RELATIVE NAME': v.fatherHusbandName,
      'AGE': v.age,
      'GENDER': v.gender,
      'ACTIVE/DELETE': v.voterStatus === VoterStatus.SHIFTED ? 'DELETE' : 'ACTIVE',
      'VILLAGE NAME': 'Refresh Village',
      'POLLING STATION NAME': 'Booth 101',
      'HOUSE NUMBER': v.houseNumber,
      'CONSTITUENCY': testConstituency.name,
      'MANDAL NAME': 'Refresh Mandal',
    }));

    const result = await ApplicationsService.importData('default', 'VOTER', identicalRows, {
      importMode: 'REFRESH',
      targetConstituencyId: testConstituency.id,
    });

    assert.equal(result.successCount, identicalRows.length, 'All rows must succeed');
    assert.equal(result.updatedCount, identicalRows.length, 'All rows must be updated in-place');
    assert.equal(result.importedCount, 0, 'Zero new rows should be inserted on identical re-import');

    const votersAfter = await prisma.voter.count({ where: { constituencyId: testConstituency.id } });
    const boothsAfter = await prisma.booth.count({ where: { village: { mandal: { constituencyId: testConstituency.id } } } });
    const groupsAfter = await prisma.voterGroup.count({ where: { booth: { village: { mandal: { constituencyId: testConstituency.id } } } } });

    assert.equal(votersAfter, votersBefore, 'Zero duplicate voters must be created on re-import');
    assert.equal(boothsAfter, boothsBefore, 'Zero duplicate booths must be created on re-import');
    assert.equal(groupsAfter, groupsBefore, 'Zero duplicate groups must be created on re-import');
  });

  it('6. Failure midway through the import rolls back cleanly and leaves zero partial writes', async () => {
    const countBefore = await prisma.voter.count({ where: { constituencyId: testConstituency.id } });
    const abortEpic = `EPIC-ABORT-${Date.now()}`;

    const failingRows = [
      {
        'PART NO': '101',
        'NEW SERIAL NO': 999,
        'EPIC ID NO': abortEpic,
        'VOTER NAME': 'Aborted Elector',
        'RELATION': 'FATHER',
        'RELATIVE NAME': 'Relative',
        'AGE': 50,
        'GENDER': 'MALE',
        'ACTIVE/DELETE': 'ACTIVE',
        'VILLAGE NAME': 'Refresh Village',
        'POLLING STATION NAME': 'Booth 101',
        'HOUSE NUMBER': '9-99',
        'CONSTITUENCY': testConstituency.name,
        'MANDAL NAME': 'Refresh Mandal',
      },
    ];

    let errorThrown = false;
    try {
      await ApplicationsService.importData('default', 'VOTER', failingRows, {
        importMode: 'REFRESH',
        targetConstituencyId: testConstituency.id,
        _testHookDuringTransaction: async () => {
          throw new Error('SIMULATED_TRANSACTION_FAILURE_MIDWAY');
        },
      });
    } catch (err: any) {
      errorThrown = true;
      assert.ok(err.message.includes('SIMULATED_TRANSACTION_FAILURE_MIDWAY'));
    }

    assert.equal(errorThrown, true, 'Error must be propagated');

    // Verify rollback: aborted elector must not exist in DB
    const abortedVoter = await prisma.voter.findUnique({ where: { epicNumber: abortEpic } });
    assert.equal(abortedVoter, null, 'Aborted voter must not exist in database after rollback');

    const countAfter = await prisma.voter.count({ where: { constituencyId: testConstituency.id } });
    assert.equal(countAfter, countBefore, 'Database voter count must remain completely unchanged');
  });

  it('7. Other constituencies remain completely unchanged throughout all operations', async () => {
    if (otherConstituency?.id) {
      const currentOtherCount = await prisma.voter.count({ where: { constituencyId: otherConstituency.id } });
      assert.equal(currentOtherCount, initialOtherConstituencyCount, 'Other constituency count must remain unchanged');
    }
  });

  it('8. REPLACE mode is strictly blocked on constituencies with existing live operational records', async () => {
    let replaceBlocked = false;
    try {
      await ApplicationsService.importData(
        'default',
        'VOTER',
        [
          {
            'PART NO': '101',
            'NEW SERIAL NO': 1,
            'EPIC ID NO': existingVoterA.epicNumber,
            'VOTER NAME': 'Voter Replace Attempt',
            'RELATION': 'FATHER',
            'RELATIVE NAME': 'Father',
            'AGE': 35,
            'GENDER': 'MALE',
            'ACTIVE/DELETE': 'ACTIVE',
            'VILLAGE NAME': 'Refresh Village',
            'POLLING STATION NAME': 'Booth 101',
            'HOUSE NUMBER': '1-10',
            'CONSTITUENCY': testConstituency.name,
            'MANDAL NAME': 'Refresh Mandal',
          },
        ],
        {
          importMode: 'REPLACE', // Dangerous replace attempt
          targetConstituencyId: testConstituency.id,
        }
      );
    } catch (err: any) {
      replaceBlocked = true;
      assert.equal(err.code, 'REPLACE_MODE_FORBIDDEN_LIVE_OPERATIONAL_DATA');
      assert.ok(err.message.includes('REPLACE mode is forbidden'));
    }

    assert.equal(replaceBlocked, true, 'REPLACE mode must be blocked when live operational data exists');

    // Confirm existing operational records were NOT deleted
    const countCheck = await prisma.voteTracking.count({ where: { voterId: existingVoterA.id } });
    assert.equal(countCheck, 1, 'VoteTracking records must remain 100% safe and intact');
  });
});
