import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ApplicationsService } from '../modules/applications/applications.service.js';
import { InchargeProvisioningService } from '../modules/cadre/incharge-provisioning.service.js';
import { VotersService } from '../modules/voters/voters.service.js';
import { prisma } from '../lib/prisma.js';
import { RoleType, VoterStatus, VoteStatus, SurveyStatus, VoterLocationStatus, AuditAction } from '@prisma/client';
import { assertVoterScope } from '../middleware/rbac.js';

describe('Task 4: Full Staging Workflow End-to-End Verification Suite', () => {
  let parliament: any;
  let testAc: any;
  let testMandal: any;
  let testVillage: any;
  let testUser: any;
  const runId = Date.now().toString().slice(-6);

  before(async () => {
    parliament = await prisma.parliament.findFirst();
    if (!parliament) throw new Error('Reference parliament required in staging DB');

    testUser = await prisma.user.findFirst();
    if (!testUser) throw new Error('Reference user required in staging DB');

    // 1. Setup isolated test constituency
    testAc = await prisma.constituency.create({
      data: {
        name: `Staging AC ${runId}`,
        code: `STG-AC-${runId}`,
        parliamentId: parliament.id,
      },
    });

    testMandal = await prisma.mandal.create({
      data: {
        name: `Staging Mandal ${runId}`,
        code: `STG-MAN-${runId}`,
        constituencyId: testAc.id,
      },
    });

    testVillage = await prisma.village.create({
      data: {
        name: `Staging Village ${runId}`,
        code: `STG-VIL-${runId}`,
        mandalId: testMandal.id,
      },
    });
  });

  after(async () => {
    if (testAc?.id) {
      const testVoters = await prisma.voter.findMany({ where: { constituencyId: testAc.id }, select: { id: true } });
      const voterIds = testVoters.map((v) => v.id);
      if (voterIds.length > 0) {
        await prisma.auditLog.deleteMany({ where: { entityId: { in: voterIds } } });
        await prisma.voterStatusHistory.deleteMany({ where: { voterId: { in: voterIds } } });
        await prisma.voteTracking.deleteMany({ where: { voterId: { in: voterIds } } });
        await prisma.voterAssignment.deleteMany({ where: { voterId: { in: voterIds } } });
      }
      await prisma.voter.deleteMany({ where: { constituencyId: testAc.id } });
      await prisma.dataImportError.deleteMany({ where: { import: { targetConstituencyId: testAc.id } } });
      await prisma.dataImport.deleteMany({ where: { targetConstituencyId: testAc.id } });
      await prisma.voterGroup.deleteMany({ where: { booth: { village: { mandal: { constituencyId: testAc.id } } } } });
      await prisma.booth.deleteMany({ where: { village: { mandal: { constituencyId: testAc.id } } } });
      await prisma.village.deleteMany({ where: { mandal: { constituencyId: testAc.id } } });
      await prisma.mandal.deleteMany({ where: { constituencyId: testAc.id } });
      await prisma.constituency.deleteMany({ where: { id: testAc.id } });
    }
  });

  it('1 & 3: Import, reconciliation, voter counts and source status', async () => {
    const rawRows = [
      {
        'PART NO': '1',
        'NEW SERIAL NO': '1',
        'EPIC ID NO': `STG-EPIC-1-${runId}`,
        'VOTER NAME': 'Active Elector One',
        'RELATION': 'FATHER',
        'RELATIVE NAME': 'Father One',
        'AGE': '32',
        'GENDER': 'MALE',
        'ACTIVE/DELETE': 'ACTIVE',
        'VILLAGE NAME': testVillage.name,
        'POLLING STATION NAME': 'Station Alpha',
        'HOUSE NUMBER': '10-1',
        'CONSTITUENCY': testAc.name,
        'MANDAL NAME': testMandal.name,
      },
      {
        'PART NO': '1',
        'NEW SERIAL NO': '2',
        'EPIC ID NO': `STG-EPIC-2-${runId}`,
        'VOTER NAME': 'Deleted Elector Two',
        'RELATION': 'FATHER',
        'RELATIVE NAME': 'Father Two',
        'AGE': '45',
        'GENDER': 'FEMALE',
        'ACTIVE/DELETE': 'DELETE',
        'VILLAGE NAME': testVillage.name,
        'POLLING STATION NAME': 'Station Alpha',
        'HOUSE NUMBER': '10-2',
        'CONSTITUENCY': testAc.name,
        'MANDAL NAME': testMandal.name,
      },
      {
        'PART NO': '2',
        'NEW SERIAL NO': '1',
        'EPIC ID NO': `STG-EPIC-3-${runId}`,
        'VOTER NAME': 'Booth Two Elector',
        'RELATION': 'HUSBAND',
        'RELATIVE NAME': 'Spouse Three',
        'AGE': '28',
        'GENDER': 'FEMALE',
        'ACTIVE/DELETE': 'ACTIVE',
        'VILLAGE NAME': testVillage.name,
        'POLLING STATION NAME': 'Station Beta',
        'HOUSE NUMBER': '20-1',
        'CONSTITUENCY': testAc.name,
        'MANDAL NAME': testMandal.name,
      },
    ];

    const res = await ApplicationsService.importData('default', 'VOTER', rawRows, {
      targetConstituencyId: testAc.id,
      importMode: 'REFRESH',
    });

    assert.equal(res.status, 'SUCCESS');
    assert.equal(res.totalRows, 3);
    assert.equal(res.importedCount, 3);
    assert.equal(res.reconciliationReport.statusTotals.active, 2);
    assert.equal(res.reconciliationReport.statusTotals.deleted, 1);
    assert.equal(res.reconciliationReport.boothSummary.distinctBoothsCount, 2);

    const activeVoter = await prisma.voter.findUnique({ where: { epicNumber: `STG-EPIC-1-${runId}` } });
    const deletedVoter = await prisma.voter.findUnique({ where: { epicNumber: `STG-EPIC-2-${runId}` } });

    assert.equal(activeVoter!.voterStatus, VoterStatus.ACTIVE);
    assert.equal(deletedVoter!.voterStatus, VoterStatus.SHIFTED);
  });

  it('2: Safe re-import creates 0 duplicates and preserves voter IDs', async () => {
    const voter1Before = await prisma.voter.findUnique({ where: { epicNumber: `STG-EPIC-1-${runId}` } });
    assert.ok(voter1Before);

    const reimportRows = [
      {
        'PART NO': '1',
        'NEW SERIAL NO': '1',
        'EPIC ID NO': `STG-EPIC-1-${runId}`,
        'VOTER NAME': 'Active Elector One (Updated)',
        'RELATION': 'FATHER',
        'RELATIVE NAME': 'Father One',
        'AGE': '33', // Updated age
        'GENDER': 'MALE',
        'ACTIVE/DELETE': 'ACTIVE',
        'VILLAGE NAME': testVillage.name,
        'POLLING STATION NAME': 'Station Alpha',
        'HOUSE NUMBER': '10-1',
        'CONSTITUENCY': testAc.name,
        'MANDAL NAME': testMandal.name,
      },
    ];

    const res = await ApplicationsService.importData('default', 'VOTER', reimportRows, {
      targetConstituencyId: testAc.id,
      importMode: 'REFRESH',
    });

    assert.equal(res.updatedCount, 1);
    assert.equal(res.importedCount, 0, 'Zero new duplicate records created');

    const voter1After = await prisma.voter.findUnique({ where: { epicNumber: `STG-EPIC-1-${runId}` } });
    assert.equal(voter1After!.id, voter1Before.id, 'UUID must remain identical');
    assert.equal(voter1After!.name, 'Active Elector One (Updated)');
    assert.equal(voter1After!.age, 33);
  });

  it('4: Dynamic 100-voter group creation and membership', async () => {
    const booth1 = await prisma.booth.findFirst({
      where: { boothNumber: '1', village: { mandalId: testMandal.id } },
      include: { voterGroups: { include: { voters: true } } },
    });
    assert.ok(booth1);

    // Booth 1 had 1 active elector and 1 deleted elector
    // Expect 1 active group (Group 1) and 1 Deleted Electors group
    const activeGroup = booth1.voterGroups.find((g) => g.name === 'Group 1');
    const deletedGroup = booth1.voterGroups.find((g) => g.name === 'Deleted Electors');

    assert.ok(activeGroup, 'Active Group 1 must exist');
    assert.ok(deletedGroup, 'Deleted Electors group must exist');
    assert.equal(activeGroup.voters.length, 1);
    assert.equal(deletedGroup.voters.length, 1);
  });

  it('5 & 6: Voter list scoping for Booth Incharge and cross-booth/cross-tenant access denial', async () => {
    const booth1 = await prisma.booth.findFirst({ where: { boothNumber: '1', village: { mandalId: testMandal.id } } });
    const booth2 = await prisma.booth.findFirst({ where: { boothNumber: '2', village: { mandalId: testMandal.id } } });
    assert.ok(booth1);
    assert.ok(booth2);

    // Booth Incharge assigned to Booth 1 only
    const booth1Scope = {
      role: RoleType.BOOTH_INCHARGE,
      isGlobalScope: false,
      organisationId: null,
      accessibleConstituencyIds: new Set([testAc.id]),
      accessibleMandalIds: new Set([testMandal.id]),
      accessibleVillageIds: new Set([testVillage.id]),
      accessibleBoothIds: new Set([booth1.id]),
      accessibleVoterGroupIds: new Set(),
    };

    // Query voters scoped to Booth 1
    const listRes = await VotersService.listVoters(
      { page: 1, limit: 10, constituencyId: testAc.id } as any,
      booth1Scope as any
    );

    // Should only see voters in Booth 1 (2 voters: 1 active, 1 deleted)
    for (const v of listRes.items) {
      assert.equal(v.boothId, booth1.id, 'Booth incharge must only see their assigned booth');
    }

    // Direct access to Booth 2 voter must fail-closed
    const booth2Voter = await prisma.voter.findFirst({ where: { boothId: booth2.id } });
    assert.ok(booth2Voter);

    let replyStatus = 0;
    const mockReply: any = {
      status(s: number) {
        replyStatus = s;
        return this;
      },
      send() {
        return this;
      },
    };

    const mockReq: any = {
      user: { userId: 'incharge-1' },
      hierarchyScope: booth1Scope,
    };

    const authorized = await assertVoterScope(mockReq, mockReply, booth2Voter.id);
    assert.equal(authorized, false, 'Access to cross-booth voter must be denied');
    assert.equal(replyStatus, 403, 'Must return HTTP 403 Forbidden');
  });

  it('7: Voter edit, location update, operational status, and audit-note persistence', async () => {
    const voter = await prisma.voter.findUnique({ where: { epicNumber: `STG-EPIC-1-${runId}` } });
    assert.ok(voter);

    // Update operational verification status, location status, currentLocation, and notes
    const updated = await VotersService.updateVoter(
      voter.id,
      {
        voterStatus: VoterStatus.DOUBTFUL, // Operational verification status
        voterLocationStatus: VoterLocationStatus.MIGRATED, // Location status
        currentLocation: 'Hyderabad, Kondapur Sector 2', // Current location text
        notes: 'Operational check: elector migrated for IT work; marked Doubtful for verification',
      },
      testUser.id
    );

    assert.equal(updated.voterStatus, VoterStatus.DOUBTFUL);
    assert.equal(updated.voterLocationStatus, VoterLocationStatus.MIGRATED);
    assert.equal(updated.currentLocation, 'Hyderabad, Kondapur Sector 2');
    assert.ok(updated.notes?.includes('Operational check'));

    // Verify audit log entry was created
    const audit = await prisma.auditLog.findFirst({
      where: { entityType: 'Voter', entityId: voter.id, action: AuditAction.UPDATE },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(audit, 'Immutable AuditLog entry must be recorded');
    assert.equal(audit.userId, testUser.id);

    // Verify status history was created
    const statusHistory = await prisma.voterStatusHistory.findFirst({
      where: { voterId: voter.id, newStatus: VoterStatus.DOUBTFUL },
    });
    assert.ok(statusHistory, 'VoterStatusHistory transition record must be stored');
    assert.equal(statusHistory.previousStatus, VoterStatus.ACTIVE);
  });

  it('8: Roster preview correctness', async () => {
    const preview = await InchargeProvisioningService.generateRosterPreview(testAc.id);

    assert.equal(preview.summary.dryRunMode, true);
    assert.equal(preview.summary.mandalsCount, 1);
    assert.equal(preview.summary.boothsCount, 2);
    // Station Alpha and Station Beta
    assert.equal(preview.summary.pollingStationsCount, 2);
    // 2 booths, each with 1 active group = 2 active groups
    assert.equal(preview.summary.groupsCount, 2);

    assert.equal(preview.summary.requiredRosterCounts.mandalIncharges.required, 1);
    assert.equal(preview.summary.requiredRosterCounts.villageIncharges.required, 2);
    assert.equal(preview.summary.requiredRosterCounts.boothIncharges.required, 2);
    assert.equal(preview.summary.requiredRosterCounts.groupIncharges.required, 2);
    assert.equal(preview.summary.requiredRosterCounts.totalRequired, 7);
  });
});
