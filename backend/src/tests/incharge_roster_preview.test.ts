import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InchargeProvisioningService } from '../modules/cadre/incharge-provisioning.service.js';
import { prisma } from '../lib/prisma.js';
import { RoleType } from '@prisma/client';

describe('Section G: Dynamic Incharge Roster Preview Verification Suite', () => {
  it('1. Generates accurate dynamic roster preview without mutating database', async () => {
    // Locate Kondapi constituency in staging database
    const kondapi = await prisma.constituency.findFirst({
      where: { name: { contains: 'Kondapi', mode: 'insensitive' } },
    });

    if (!kondapi) {
      console.log('Skipping test 1: Kondapi constituency not found in database');
      return;
    }

    // Capture DB baseline counts
    const usersBefore = await prisma.user.count();
    const assignmentsBefore = await prisma.userHierarchyAssignment.count();

    const result = await InchargeProvisioningService.generateRosterPreview(kondapi.id);

    // Verify DB baseline counts are completely untouched (zero mutations)
    const usersAfter = await prisma.user.count();
    const assignmentsAfter = await prisma.userHierarchyAssignment.count();
    assert.equal(usersAfter, usersBefore, 'Roster preview must NEVER create user accounts');
    assert.equal(assignmentsAfter, assignmentsBefore, 'Roster preview must NEVER alter hierarchy assignments');

    // Verify summary
    assert.equal(result.summary.dryRunMode, true);
    assert.ok(result.summary.safetyNotice.includes('DRY RUN ONLY'));
    assert.equal(result.summary.mandalsCount, 6, 'Kondapi has exactly 6 mandals');
    assert.equal(result.summary.boothsCount, 283, 'Kondapi has exactly 283 booths/parts');
    assert.equal(result.summary.pollingStationsCount, 151, 'Kondapi has exactly 151 distinct polling station locations');
    assert.equal(result.summary.groupsCount, 2527, 'Kondapi has exactly 2,527 active 100-voter groups');

    // Verify roster breakdown
    const mandalEntries = result.roster.filter((r) => r.level === 'MANDAL');
    const psEntries = result.roster.filter((r) => r.level === 'POLLING_STATION');
    const boothEntries = result.roster.filter((r) => r.level === 'BOOTH');
    const groupEntries = result.roster.filter((r) => r.level === '100_VOTER_GROUP');

    assert.equal(mandalEntries.length, 6);
    assert.equal(psEntries.length, 151);
    assert.equal(boothEntries.length, 283);
    assert.equal(groupEntries.length, 2527);

    // Verify every group belongs to BOOTH and has role VOTER_100_INCHARGE
    for (const g of groupEntries) {
      assert.equal(g.roleRequired, RoleType.VOTER_100_INCHARGE);
      assert.ok(g.boothId);
      assert.ok(g.voterCount <= 100);
    }
  });

  it('2. Missing constituency throws 404', async () => {
    await assert.rejects(
      async () => {
        await InchargeProvisioningService.generateRosterPreview('00000000-0000-0000-0000-000000000000');
      },
      (err: any) => {
        assert.equal(err.statusCode, 404);
        return true;
      }
    );
  });
});
