import fs from 'fs';
import { prisma } from '../lib/prisma.js';

async function verifyStaging() {
  console.log('=== VERIFYING REAL STAGING DATABASE (kondapi_connect) ===');

  const constituency = await prisma.constituency.findFirst({
    where: { constituencyNumber: 110 },
  });
  if (!constituency) {
    throw new Error('Target Constituency 110 Kondapi not found');
  }

  const kId = constituency.id;

  // 1. Total Voter Counts
  const totalVoters = await prisma.voter.count({ where: { constituencyId: kId } });
  const activeVoters = await prisma.voter.count({ where: { constituencyId: kId, voterStatus: 'ACTIVE' } });
  const shiftedVoters = await prisma.voter.count({ where: { constituencyId: kId, voterStatus: 'SHIFTED' } });
  
  // Specific breakdowns
  const blankEpicOverseas = await prisma.voter.count({
    where: {
      constituencyId: kId,
      notes: { contains: 'OVERSEAS_ELECTOR_NO_DOMESTIC_EPIC' },
    },
  });
  const doubleActiveConflicts = await prisma.voter.count({
    where: {
      constituencyId: kId,
      notes: { contains: 'DUPLICATE_ACTIVE_CONFLICT' },
    },
  });
  const revisionDeleted = await prisma.voter.count({
    where: {
      constituencyId: kId,
      notes: { contains: 'ECI_DELETED_IN_REVISION' },
    },
  });
  const missingSerials = await prisma.voter.count({
    where: {
      constituencyId: kId,
      OR: [{ serialNumber: 0 }, { serialNumber: { lt: 0 } }],
    },
  });

  // 2. Hierarchy Node Counts
  const mandals = await prisma.mandal.findMany({
    where: { constituencyId: kId },
    select: { id: true, name: true, code: true },
  });
  
  const booths = await prisma.booth.findMany({
    where: { village: { mandal: { constituencyId: kId } } },
    select: { id: true, boothNumber: true, name: true, pollingStation: true, village: { select: { name: true, mandal: { select: { name: true } } } } },
  });

  // Check booth uniqueness: Is any part number duplicated?
  const boothPartNumbers = booths.map((b) => b.boothNumber);
  const uniqueBoothPartNumbers = new Set(boothPartNumbers);
  const distinctPollingStations = new Set(booths.map((b) => b.pollingStation).filter(Boolean));

  // 3. Voter Groups Verification
  const voterGroups = await prisma.voterGroup.findMany({
    where: { booth: { village: { mandal: { constituencyId: kId } } } },
    select: {
      id: true,
      name: true,
      boothId: true,
      _count: {
        select: {
          voters: {
            where: { voterStatus: 'ACTIVE' },
          },
        },
      },
    },
  });

  let maxGroupSize = 0;
  let groupsOver100 = 0;
  let groupsWithZeroActive = 0;
  const activeGroupSizes: number[] = [];

  for (const vg of voterGroups) {
    const size = vg._count.voters;
    if (size > maxGroupSize) maxGroupSize = size;
    if (size > 100) groupsOver100++;
    if (size === 0) groupsWithZeroActive++;
    if (size > 0) activeGroupSizes.push(size);
  }

  // Check unassigned active voters (voters with voterGroupId = null)
  const unassignedActiveVoters = await prisma.voter.count({
    where: {
      constituencyId: kId,
      voterStatus: 'ACTIVE',
      voterGroupId: null,
    },
  });

  // 4. Double Active Conflict Inspection (RLY0252437)
  const rlyConflict = await prisma.voter.findMany({
    where: {
      constituencyId: kId,
      epicNumber: { startsWith: 'RLY0252437' },
    },
    select: {
      id: true,
      epicNumber: true,
      name: true,
      serialNumber: true,
      voterStatus: true,
      notes: true,
      booth: { select: { boothNumber: true, pollingStation: true } },
    },
  });

  // 5. Sample Overseas Electors
  const sampleOverseas = await prisma.voter.findMany({
    where: {
      constituencyId: kId,
      notes: { contains: 'OVERSEAS_ELECTOR' },
    },
    take: 3,
    select: {
      id: true,
      epicNumber: true,
      name: true,
      serialNumber: true,
      voterStatus: true,
      notes: true,
      booth: { select: { boothNumber: true } },
    },
  });

  // 6. Sample Revision Deleted Pairs
  const sampleDeleted = await prisma.voter.findMany({
    where: {
      constituencyId: kId,
      notes: { contains: 'ECI_DELETED_IN_REVISION' },
    },
    take: 3,
    select: {
      id: true,
      epicNumber: true,
      name: true,
      serialNumber: true,
      voterStatus: true,
      notes: true,
      booth: { select: { boothNumber: true } },
    },
  });

  // 7. Verify Other Constituencies Were NOT Affected
  const otherConstituencyVoters = await prisma.voter.count({
    where: { constituencyId: { not: kId } },
  });

  // 8. Serial Order Determinism Check
  // Check that inside booths, voters are grouped in contiguous ascending serial number blocks
  const sampleBooth = booths.find((b) => b.boothNumber === '1');
  let booth1SerialContiguityPassed = true;
  if (sampleBooth) {
    const b1Groups = await prisma.voterGroup.findMany({
      where: { boothId: sampleBooth.id, name: { startsWith: 'Group' } },
      include: {
        voters: {
          where: { voterStatus: 'ACTIVE' },
          orderBy: { serialNumber: 'asc' },
          select: { serialNumber: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    for (let i = 0; i < b1Groups.length - 1; i++) {
      const lastSerial = b1Groups[i].voters[b1Groups[i].voters.length - 1]?.serialNumber;
      const nextFirstSerial = b1Groups[i + 1].voters[0]?.serialNumber;
      if (lastSerial && nextFirstSerial && nextFirstSerial <= lastSerial) {
        booth1SerialContiguityPassed = false;
      }
    }
  }

  const results = {
    stagingDatabase: 'kondapi_connect (PostgreSQL 18.4 local, schema public)',
    targetConstituency: `${constituency.name} (${constituency.code}, ID: ${constituency.id})`,
    sourceVersusDbCounts: {
      expectedSourceTotal: 240017,
      actualDbTotal: totalVoters,
      discrepancy: 240017 - totalVoters,
      breakdown: {
        activeVoters: { expected: 239248, actual: activeVoters, matched: activeVoters === 239248 },
        shiftedDeletedVoters: { expected: 769, actual: shiftedVoters, matched: shiftedVoters === 769 },
        blankEpicOverseas: { expected: 40, actual: blankEpicOverseas, matched: blankEpicOverseas === 40 },
        doubleActiveConflicts: { expected: 1, actual: doubleActiveConflicts, matched: doubleActiveConflicts === 1 },
        revisionDeletedRecords: { expected: 314, actual: revisionDeleted, matched: revisionDeleted === 314 },
        missingOrInvalidSerials: { expected: 0, actual: missingSerials, matched: missingSerials === 0 },
      },
    },
    hierarchyVerification: {
      mandalsCount: { expected: 6, actual: mandals.length, matched: mandals.length === 6, mandalNames: mandals.map((m) => m.name) },
      boothsCount: { expected: 283, actual: booths.length, matched: booths.length === 283 },
      uniqueBoothNumbers: { expected: 283, actual: uniqueBoothPartNumbers.size, matched: uniqueBoothPartNumbers.size === 283 },
      boothsDuplicatedByVillages: booths.length - uniqueBoothPartNumbers.size,
      pollingStationNamesCount: distinctPollingStations.size,
    },
    groupVerification: {
      totalGroups: voterGroups.length,
      activeGroups: activeGroupSizes.length,
      maxGroupSize: { maxAllowed: 100, actual: maxGroupSize, matched: maxGroupSize <= 100 },
      groupsOver100,
      unassignedActiveVoters: { expected: 0, actual: unassignedActiveVoters, matched: unassignedActiveVoters === 0 },
      booth1SerialContiguityPassed,
    },
    conflictVerificationRLY0252437: {
      bothRowsPreserved: rlyConflict.length === 2,
      records: rlyConflict,
    },
    sampleOverseasElectors: sampleOverseas,
    sampleRevisionDeletedElectors: sampleDeleted,
    dataIsolationCheck: {
      otherConstituencyVotersPreserved: otherConstituencyVoters > 0,
      otherConstituencyVotersCount: otherConstituencyVoters,
    },
    status: (
      totalVoters === 240017 &&
      activeVoters === 239248 &&
      shiftedVoters === 769 &&
      booths.length === 283 &&
      uniqueBoothPartNumbers.size === 283 &&
      mandals.length === 6 &&
      maxGroupSize <= 100 &&
      groupsOver100 === 0 &&
      unassignedActiveVoters === 0 &&
      rlyConflict.length === 2
    ) ? 'PASS' : 'FAIL',
  };

  console.log('=== VERIFICATION SUMMARY ===');
  console.log(JSON.stringify(results, null, 2));

  fs.writeFileSync(
    'C:\\Users\\priya\\.gemini\\antigravity-ide\\brain\\d00a4cc0-587b-43c0-9000-3effac83ef11\\scratch\\final_staging_verification.json',
    JSON.stringify(results, null, 2)
  );
  console.log('Results written to scratch/final_staging_verification.json');
}

verifyStaging()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
