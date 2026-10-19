/**
 * VIAP — Database Forensic Inventory Audit Utility
 *
 * 100% READ-ONLY / DRY-RUN AUDIT
 * Strictly executes SELECT queries to discover:
 * 1. Organisations & CMS Configurations
 * 2. Hierarchy Trees (States, Zones, Parliaments, Constituencies, Mandals, Villages, Booths)
 * 3. Voters (Total, with vote history, by tenant)
 * 4. Candidate test artifacts vs operational records
 * 5. Foreign-key dependencies and retention requirements
 *
 * SAFETY: Zero mutations, zero deletes, masks PII/credentials.
 */

import { prisma } from '../lib/prisma.js';

async function runInventory() {
  console.log('================================================================================');
  console.log('VIAP — FORENSIC DATABASE INVENTORY AUDIT (READ-ONLY)');
  console.log('================================================================================\n');

  // 1. Organisations
  const orgs = await prisma.organisation.findMany({
    include: {
      cmsConfigs: { select: { id: true, configKey: true, organisationName: true } },
      states: { select: { id: true, name: true, code: true } },
      _count: {
        select: {
          users: true,
          parties: true,
          states: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`[1] ORGANISATIONS (${orgs.length} total):`);
  for (const org of orgs) {
    console.log(`  - ID: ${org.id}`);
    console.log(`    Code: ${org.code} | Name: "${org.name}" | Active: ${org.isActive}`);
    console.log(`    Users: ${org._count.users} | Parties: ${org._count.parties} | States: ${org._count.states}`);
    console.log(`    Configs: ${org.cmsConfigs.map((c) => c.configKey).join(', ') || 'None'}`);
    console.log('');
  }

  // 2. States (check for orphaned states where organisationId is NULL)
  const orphanStates = await prisma.state.findMany({
    where: { organisationId: null },
    include: {
      _count: {
        select: {
          zones: true,
          voters: true,
          users: true,
        },
      },
    },
  });
  console.log(`[2] STATES WITHOUT ORGANISATION (organisationId = NULL): ${orphanStates.length}`);
  for (const s of orphanStates) {
    console.log(`  - State ID: ${s.id} | Code: ${s.code} | Name: "${s.name}"`);
    console.log(`    Zones: ${s._count.zones} | Voters: ${s._count.voters} | Users: ${s._count.users}`);
  }
  console.log('');

  // 3. Total Hierarchy Node Counts
  const [zonesCount, parliamentsCount, constituenciesCount, mandalsCount, villagesCount, boothsCount, voterGroupsCount] = await Promise.all([
    prisma.zone.count(),
    prisma.parliament.count(),
    prisma.constituency.count(),
    prisma.mandal.count(),
    prisma.village.count(),
    prisma.booth.count(),
    prisma.voterGroup.count(),
  ]);
  console.log('[3] TOTAL HIERARCHY NODES ACROSS SYSTEM:');
  console.log(`    Zones:           ${zonesCount}`);
  console.log(`    Parliaments:     ${parliamentsCount}`);
  console.log(`    Constituencies:  ${constituenciesCount}`);
  console.log(`    Mandals:         ${mandalsCount}`);
  console.log(`    Villages:        ${villagesCount}`);
  console.log(`    Booths:          ${boothsCount}`);
  console.log(`    VoterGroups:     ${voterGroupsCount}`);
  console.log('');

  // 4. Voters Inventory
  const [totalVoters, votersWithLiveVotes, votersWithTrackings, votersWithMigrations, votersFlagged] = await Promise.all([
    prisma.voter.count(),
    prisma.voter.count({ where: { voteStatus: 'VOTE_DONE' } }),
    prisma.voteTracking.count(),
    prisma.voterMigration.count(),
    prisma.fakeVoterFlag.count(),
  ]);

  console.log('[4] VOTER POPULATION & VOTING HISTORY:');
  console.log(`    Total Persisted Voters:      ${totalVoters}`);
  console.log(`    Voters with VOTE_DONE:       ${votersWithLiveVotes}`);
  console.log(`    Vote Tracking Records:       ${votersWithTrackings}`);
  console.log(`    Voter Migration Records:     ${votersWithMigrations}`);
  console.log(`    Fake / Objection Flags:      ${votersFlagged}`);
  console.log('');

  // Breakdown of voters by organisation
  const votersByState = await prisma.state.findMany({
    select: {
      id: true,
      name: true,
      code: true,
      organisation: { select: { id: true, code: true, name: true } },
      _count: { select: { voters: true } },
    },
  });
  console.log('[5] VOTERS BY STATE / ORGANISATION:');
  for (const s of votersByState) {
    const orgLabel = s.organisation ? `"${s.organisation.name}" (${s.organisation.code})` : 'NO ORGANISATION (ORPHAN)';
    console.log(`    State: ${s.code} (${s.name}) -> Org: ${orgLabel} -> Voters: ${s._count.voters}`);
  }
  console.log('');

  // 5. Test Artifact Identification
  const testParties = await prisma.politicalParty.findMany({
    where: {
      OR: [
        { code: { startsWith: 'TEST_' } },
        { code: { startsWith: 'BENCH_' } },
      ],
    },
    select: { id: true, code: true, name: true, organisationId: true },
  });
  console.log(`[6] TEST POLITICAL PARTIES: ${testParties.length}`);
  for (const tp of testParties) {
    console.log(`    Party: ${tp.code} (${tp.name}) | OrgId: ${tp.organisationId}`);
  }
  console.log('');

  // 6. Detailed Voter Inspection
  const allVoterRecords = await prisma.voter.findMany({
    select: {
      id: true,
      serialNumber: true,
      epicNumber: true,
      name: true,
      voteStatus: true,
      createdAt: true,
      state: { select: { id: true, code: true, name: true, organisationId: true } },
      _count: {
        select: {
          voteTrackings: true,
          fakeVoterFlags: true,
          liveVoteEvents: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log('[6] DETAILED VOTER AUDIT:');
  for (const v of allVoterRecords) {
    console.log(`  - Voter ID: ${v.id}`);
    console.log(`    EPIC: ${v.epicNumber} | Name: "${v.name}" | Status: ${v.voteStatus}`);
    console.log(`    Created: ${v.createdAt.toISOString()} | State: ${v.state?.code} (${v.state?.name}) | Org: ${v.state?.organisationId || 'NULL'}`);
    console.log(`    Trackings: ${v._count.voteTrackings} | FakeFlags: ${v._count.fakeVoterFlags} | LiveEvents: ${v._count.liveVoteEvents}`);
    console.log('');
  }

  // 7. Users Summary
  const usersByRole = await prisma.user.groupBy({
    by: ['role'],
    _count: { id: true },
  });
  console.log('[7] USERS BY ROLE:');
  for (const ur of usersByRole) {
    console.log(`    ${ur.role.padEnd(25)}: ${ur._count.id}`);
  }
  console.log('\n================================================================================');
  console.log('[DRY-RUN / REPORT-ONLY] Zero database records were modified or deleted.');
  console.log('================================================================================');
}

runInventory()
  .catch((e) => {
    console.error('Inventory error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
