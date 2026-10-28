import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma.js';
import { RoleType, AccountStatus, VoterStatus } from '@prisma/client';
import { InchargeProvisioningService } from '../modules/cadre/incharge-provisioning.service.js';
import { AuthService } from '../modules/auth/auth.service.js';
import { SmsProviderFactory } from '../lib/sms/factory.js';
import xlsx from 'xlsx';

describe('Cadre Real Numbers Provisioning & 100-Voter Hierarchy Suite', () => {
  let testConstituencyId: string;
  let testMandalId: string;
  let testVillageId: string;
  let booth1Id: string; // 173 voters
  let booth2Id: string; // 300 voters
  let testOrgId: string;

  before(async () => {
    process.env.ENABLE_DEV_MOCK_OTP = 'true';
    process.env.ENABLE_MOCK_OTP = 'true';
    SmsProviderFactory.setProvider({
      name: 'TestMockProvider',
      sendOtp: async () => ({ success: true, provider: 'TestMockProvider', timestamp: new Date() }),
      sendTransactional: async () => ({ success: true, provider: 'TestMockProvider', timestamp: new Date() }),
    });

    // 1. Create dedicated isolated test tenant and constituency
    const org = await prisma.organisation.create({
      data: {
        code: `CADRE_TEST_ORG_${Date.now()}`,
        name: 'Cadre Real Incharge Test Org',
      },
    });
    testOrgId = org.id;

    const party = await prisma.politicalParty.create({
      data: {
        organisationId: org.id,
        code: `TP_${Date.now()}`,
        name: 'Test Cadre Party',
        shortName: 'TCP',
      },
    });

    const state = await prisma.state.create({
      data: {
        name: `Test State ${Date.now()}`,
        code: `TS_${Date.now()}`,
        organisationId: org.id,
      },
    });

    const zone = await prisma.zone.create({
      data: {
        name: `Test Zone ${Date.now()}`,
        code: `TZ_${Date.now()}`,
        stateId: state.id,
      },
    });

    const parliament = await prisma.parliament.create({
      data: {
        name: `Test Parliament ${Date.now()}`,
        code: `TPARL_${Date.now()}`,
        zoneId: zone.id,
      },
    });

    const constituency = await prisma.constituency.create({
      data: {
        name: `Test Cadre Assembly ${Date.now()}`,
        code: `TCONST_${Date.now()}`,
        parliamentId: parliament.id,
      },
    });
    testConstituencyId = constituency.id;

    const mandal = await prisma.mandal.create({
      data: {
        name: 'Kondapi Mandal',
        code: `KNDP_${Date.now()}`,
        constituencyId: constituency.id,
        totalVoters: 473,
      },
    });
    testMandalId = mandal.id;

    const village = await prisma.village.create({
      data: {
        name: 'Kondapi Village',
        code: `KVIL_${Date.now()}`,
        mandalId: mandal.id,
        totalVoters: 473,
      },
    });
    testVillageId = village.id;

    // Polling Station
    await prisma.pollingStation.create({
      data: {
        name: 'ZPHS School Room 1',
        code: `PS_${Date.now()}`,
        constituencyId: constituency.id,
        mandalId: mandal.id,
        totalVoters: 473,
      },
    });

    // Booth 1: 173 voters
    const b1 = await prisma.booth.create({
      data: {
        name: 'Booth 1',
        boothNumber: '1',
        code: `BTH_1_${Date.now()}`,
        villageId: village.id,
        totalVoters: 173,
      },
    });
    booth1Id = b1.id;

    // Create 173 voters for Booth 1
    const b1VotersData = [];
    for (let i = 1; i <= 173; i++) {
      b1VotersData.push({
        epicNumber: `B1_EPIC_${Date.now()}_${i}`,
        serialNumber: i,
        name: `B1 Voter ${i}`,
        fatherHusbandName: `Guardian ${i}`,
        houseNumber: `${i}/A`,
        age: 30,
        boothId: b1.id,
        villageId: village.id,
        mandalId: mandal.id,
        constituencyId: constituency.id,
        voterStatus: VoterStatus.ACTIVE,
      });
    }
    await prisma.voter.createMany({ data: b1VotersData });

    // Booth 2: 300 voters
    const b2 = await prisma.booth.create({
      data: {
        name: 'Booth 2',
        boothNumber: '2',
        code: `BTH_2_${Date.now()}`,
        villageId: village.id,
        totalVoters: 300,
      },
    });
    booth2Id = b2.id;

    // Create 300 voters for Booth 2
    const b2VotersData = [];
    for (let i = 1; i <= 300; i++) {
      b2VotersData.push({
        epicNumber: `B2_EPIC_${Date.now()}_${i}`,
        serialNumber: i,
        name: `B2 Voter ${i}`,
        fatherHusbandName: `Guardian ${i}`,
        houseNumber: `${i}/B`,
        age: 35,
        boothId: b2.id,
        villageId: village.id,
        mandalId: mandal.id,
        constituencyId: constituency.id,
        voterStatus: VoterStatus.ACTIVE,
      });
    }
    await prisma.voter.createMany({ data: b2VotersData });
  });

  after(async () => {
    // Cleanup test data
    if (testConstituencyId) {
      await prisma.voter.deleteMany({ where: { constituencyId: testConstituencyId } });
      await prisma.userHierarchyAssignment.deleteMany({ where: { constituencyId: testConstituencyId } });
      await prisma.user.deleteMany({ where: { organisationId: testOrgId } });
      await prisma.voterGroup.deleteMany({ where: { booth: { village: { mandal: { constituencyId: testConstituencyId } } } } });
      await prisma.booth.deleteMany({ where: { village: { mandal: { constituencyId: testConstituencyId } } } });
      await prisma.pollingStation.deleteMany({ where: { constituencyId: testConstituencyId } });
      await prisma.village.deleteMany({ where: { mandal: { constituencyId: testConstituencyId } } });
      await prisma.mandal.deleteMany({ where: { constituencyId: testConstituencyId } });
      await prisma.constituency.deleteMany({ where: { id: testConstituencyId } });
    }
    if (testOrgId) {
      await prisma.politicalParty.deleteMany({ where: { organisationId: testOrgId } });
      await prisma.zone.deleteMany({ where: { state: { organisationId: testOrgId } } });
      await prisma.state.deleteMany({ where: { organisationId: testOrgId } });
      await prisma.organisation.deleteMany({ where: { id: testOrgId } });
    }
    SmsProviderFactory.reset();
  });

  it('1. Exact 100-Voter Segmentation: B1 (173 voters) -> B1-V1 & B1-V2; B2 (300 voters) -> B2-V1, B2-V2, B2-V3', async () => {
    const slotsResp = await InchargeProvisioningService.getRequiredRosterSlots(testConstituencyId);

    // Filter 100-voter groups
    const b1Groups = slotsResp.sections.groups.filter((g) => g.boothId === booth1Id);
    const b2Groups = slotsResp.sections.groups.filter((g) => g.boothId === booth2Id);

    // Booth 1 has 173 voters -> must have exactly 2 groups
    assert.equal(b1Groups.length, 2, 'Booth 1 (173 voters) must have exactly 2 groups');
    assert.equal(b1Groups[0].canonicalCode, 'B1-V1');
    assert.equal(b1Groups[0].voterRange, '1 - 100');
    assert.equal(b1Groups[0].voterCount, 100);

    assert.equal(b1Groups[1].canonicalCode, 'B1-V2');
    assert.equal(b1Groups[1].voterRange, '101 - 173');
    assert.equal(b1Groups[1].voterCount, 73);

    // Booth 2 has 300 voters -> must have exactly 3 groups
    assert.equal(b2Groups.length, 3, 'Booth 2 (300 voters) must have exactly 3 groups');
    assert.equal(b2Groups[0].canonicalCode, 'B2-V1');
    assert.equal(b2Groups[0].voterRange, '1 - 100');
    assert.equal(b2Groups[0].voterCount, 100);

    assert.equal(b2Groups[1].canonicalCode, 'B2-V2');
    assert.equal(b2Groups[1].voterRange, '101 - 200');
    assert.equal(b2Groups[1].voterCount, 100);

    assert.equal(b2Groups[2].canonicalCode, 'B2-V3');
    assert.equal(b2Groups[2].voterRange, '201 - 300');
    assert.equal(b2Groups[2].voterCount, 100);

    // Mandals and Booth counts
    assert.equal(slotsResp.sections.mandals.length, 1);
    assert.equal(slotsResp.sections.booths.length, 2);
    assert.equal(slotsResp.sections.pollingStations.length, 1);
  });

  it('2. Anti-Mock / Dummy Number Rejection: strictly prohibits synthetic 9101-9104 & invalid numbers', () => {
    // 9101 dummy prefix
    assert.throws(
      () => InchargeProvisioningService.validateAndNormalizeMobileNumber('9101000001', 'MDL-1'),
      (err: any) => {
        assert.equal(err.code, 'MOCK_NUMBER_PROHIBITED');
        return true;
      }
    );

    // 9104 dummy prefix
    assert.throws(
      () => InchargeProvisioningService.validateAndNormalizeMobileNumber('9104000123', 'B1-V1'),
      (err: any) => {
        assert.equal(err.code, 'MOCK_NUMBER_PROHIBITED');
        return true;
      }
    );

    // Repetitive placeholder
    assert.throws(
      () => InchargeProvisioningService.validateAndNormalizeMobileNumber('9999999999', 'B1-V2'),
      (err: any) => {
        assert.equal(err.code, 'PLACEHOLDER_NUMBER_PROHIBITED');
        return true;
      }
    );

    // Invalid length
    assert.throws(
      () => InchargeProvisioningService.validateAndNormalizeMobileNumber('98480123', 'B2-V1'),
      (err: any) => {
        assert.equal(err.code, 'INVALID_MOBILE_LENGTH');
        return true;
      }
    );

    // Valid 10-digit Indian mobile number
    const normalized = InchargeProvisioningService.validateAndNormalizeMobileNumber('+91 98480 12345', 'B1-V1');
    assert.equal(normalized, '9848012345');
  });

  it('3. Download Roster Template & Parse Uploaded Spreadsheet', async () => {
    // Generate XLSX template buffer
    const xlsxBuffer = (await InchargeProvisioningService.generateRosterTemplate(
      testConstituencyId,
      'xlsx'
    )) as Buffer;
    assert.ok(xlsxBuffer instanceof Buffer);
    assert.ok(xlsxBuffer.length > 0);

    // Parse it back - initially has no mobile numbers
    const emptyEntries = InchargeProvisioningService.parseRosterSpreadsheet(xlsxBuffer);
    assert.equal(emptyEntries.length, 0, 'Blank template should have 0 filled entries');

    // Simulate user editing the template in Excel
    const wb = xlsx.read(xlsxBuffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = xlsx.utils.sheet_to_json(ws, { defval: '' });

    // Fill real mobile numbers for B1-V1 and B1-V2
    for (const r of rows) {
      if (r['Slot Code'] === 'B1-V1') {
        r['Incharge Name'] = 'Srikanth Reddy';
        r['Mobile Number (10 Digits)'] = '9848011111';
      }
      if (r['Slot Code'] === 'B1-V2') {
        r['Incharge Name'] = 'Venkata Rao';
        r['Mobile Number (10 Digits)'] = '9848022222';
      }
    }

    const modifiedWs = xlsx.utils.json_to_sheet(rows);
    const modifiedWb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(modifiedWb, modifiedWs, 'Cadre Incharge Allocation');
    const modifiedBuffer = xlsx.write(modifiedWb, { type: 'buffer', bookType: 'xlsx' });

    // Parse the modified spreadsheet
    const parsedEntries = InchargeProvisioningService.parseRosterSpreadsheet(modifiedBuffer);
    assert.equal(parsedEntries.length, 2);
    assert.equal(parsedEntries[0].slotCode, 'B1-V1');
    assert.equal(parsedEntries[0].mobileNumber, '9848011111');
    assert.equal(parsedEntries[1].slotCode, 'B1-V2');
    assert.equal(parsedEntries[1].mobileNumber, '9848022222');
  });

  it('4. Real Numbers Provisioning: registers into DB with User, Hierarchy Assignment, & links voters', async () => {
    const result = await InchargeProvisioningService.provisionRosterWithRealNumbers({
      constituencyId: testConstituencyId,
      organisationId: testOrgId,
      partyCode: 'TCP',
      defaultPasscode: '123456',
      entries: [
        { slotCode: 'B1-V1', inchargeName: 'Srikanth Reddy', mobileNumber: '9848011111' },
        { slotCode: 'B1-V2', inchargeName: 'Venkata Rao', mobileNumber: '9848022222' },
        { slotCode: 'BTH-001', inchargeName: 'Nageswara Rao', mobileNumber: '9848033333' },
        { slotCode: 'MDL-KONDAPI', inchargeName: 'Mandal Leader Rama', mobileNumber: '9848044444' },
      ],
    });

    assert.equal(result.success, true);
    assert.equal(result.summary.groupsProvisioned, 2);
    assert.equal(result.summary.boothsProvisioned, 1);
    assert.equal(result.summary.mandalsProvisioned, 1);
    assert.equal(result.summary.totalUsersProvisioned, 4);

    // Verify User records exist in DB
    const user1 = await prisma.user.findUnique({
      where: { mobileNumber: '9848011111' },
      include: { hierarchyAssignments: true },
    });
    assert.ok(user1, 'B1-V1 Incharge User must be created in DB');
    assert.equal(user1.name, 'Srikanth Reddy');
    assert.equal(user1.role, RoleType.VOTER_100_INCHARGE);
    assert.equal(user1.accountStatus, AccountStatus.ACTIVE);
    assert.equal(user1.hierarchyAssignments.length, 1);
    assert.ok(user1.hierarchyAssignments[0].voterGroupId);

    // Verify VoterGroup and Voters are linked
    const grp1 = await prisma.voterGroup.findUnique({
      where: { id: user1.hierarchyAssignments[0].voterGroupId! },
      include: { voters: true },
    });
    assert.ok(grp1);
    assert.equal(grp1.assignedInchargeId, user1.id);

    // Verify active voters in group 1 have assignedInchargeId set
    const group1Voters = await prisma.voter.findMany({
      where: { voterGroupId: grp1.id },
    });
    assert.equal(group1Voters.length, 100);
    assert.ok(group1Voters.every((v) => v.assignedInchargeId === user1.id));

    // Verify User 2 (B1-V2)
    const user2 = await prisma.user.findUnique({
      where: { mobileNumber: '9848022222' },
      include: { hierarchyAssignments: true },
    });
    assert.ok(user2);
    assert.equal(user2.name, 'Venkata Rao');
    assert.equal(user2.role, RoleType.VOTER_100_INCHARGE);

    const group2Voters = await prisma.voter.findMany({
      where: { voterGroupId: user2.hierarchyAssignments[0].voterGroupId! },
    });
    assert.equal(group2Voters.length, 73);
    assert.ok(group2Voters.every((v) => v.assignedInchargeId === user2.id));
  });

  it('5. Duplicate Mobile Detection: rejects provisioning if same number assigned to multiple slots', async () => {
    await assert.rejects(
      async () => {
        await InchargeProvisioningService.provisionRosterWithRealNumbers({
          constituencyId: testConstituencyId,
          organisationId: testOrgId,
          entries: [
            { slotCode: 'B2-V1', inchargeName: 'Incharge A', mobileNumber: '9848099999' },
            { slotCode: 'B2-V2', inchargeName: 'Incharge B', mobileNumber: '9848099999' },
          ],
        });
      },
      (err: any) => {
        assert.equal(err.code, 'DUPLICATE_MOBILE_IN_BATCH');
        return true;
      }
    );
  });

  it('6. Mobile OTP Authentication: provisioned real cadre user can request OTP and authenticate directly', async () => {
    // 1. Request OTP for provisioned mobile number 9848011111 with devMode
    const otpRes = await AuthService.requestOtp({
      mobileNumber: '9848011111',
      channel: 'SMS',
      role: RoleType.VOTER_100_INCHARGE,
      devMode: true,
    });
    assert.ok(otpRes);
    assert.ok(otpRes.requestId);

    // 2. Locate generated OTP verification record in database
    const otpRecord = await prisma.oTPVerification.findUnique({
      where: { id: otpRes.requestId },
    });
    assert.ok(otpRecord, 'OTP record must be created in DB for authentic incharge mobile');
    assert.equal(otpRecord.mobileNumber, '9848011111');

    // 3. Verify OTP and authenticate user
    const verifyRes = await AuthService.verifyOtp({
      requestId: otpRes.requestId,
      otpCode: '123456',
      deviceId: 'test-device-incharge-001',
      deviceName: 'Redmi Note 12 Incharge Device',
    });

    assert.ok(verifyRes.token, 'Must return JWT token upon OTP verification');
    assert.equal(verifyRes.user.mobileNumber, '9848011111');
    assert.equal(verifyRes.user.role, RoleType.VOTER_100_INCHARGE);
    assert.equal(verifyRes.user.name, 'Srikanth Reddy');
  });
});
