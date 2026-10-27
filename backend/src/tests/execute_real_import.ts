import fs from 'fs';
import xlsx from 'xlsx';
import { ApplicationsService } from '../modules/applications/applications.service.js';
import { prisma } from '../lib/prisma.js';

async function runStagingImport() {
  const filePath = 'C:\\Users\\priya\\Downloads\\VOTER_DATA_FINAL.xlsx';
  console.log('=== STARTING REAL WORKBOOK STAGING IMPORT ===');
  console.log('Loading workbook from:', filePath);
  
  const readStart = Date.now();
  const workbook = xlsx.readFile(filePath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(worksheet, { defval: '' });
  console.log(`Loaded ${rows.length} rows in ${((Date.now() - readStart) / 1000).toFixed(2)}s`);

  // Target Constituency: Kondapi Assembly (110)
  const constituency = await prisma.constituency.findFirst({
    where: { constituencyNumber: 110 },
  });
  if (!constituency) {
    throw new Error('Target Constituency with constituencyNumber 110 not found in database.');
  }
  console.log(`Target Constituency: ${constituency.name} (${constituency.code}, ID: ${constituency.id})`);

  // Auto-detect column mapping
  const headers = Object.keys(rows[0] as object);
  const mappingResult = ApplicationsService.suggestColumnMapping(headers);
  console.log('Column mapping suggestions:', mappingResult.suggestions);

  // Before Counts
  const beforeVoters = await prisma.voter.count({ where: { constituencyId: constituency.id } });
  const beforeBooths = await prisma.booth.count({ where: { village: { mandal: { constituencyId: constituency.id } } } });
  const beforeGroups = await prisma.voterGroup.count({ where: { booth: { village: { mandal: { constituencyId: constituency.id } } } } });
  const beforeMandals = await prisma.mandal.count({ where: { constituencyId: constituency.id } });
  console.log('Before Import Counts (Kondapi):', {
    voters: beforeVoters,
    booths: beforeBooths,
    groups: beforeGroups,
    mandals: beforeMandals,
  });

  // Execute real application import
  console.log('Executing ApplicationsService.importData in REPLACE mode...');
  const importStart = Date.now();
  const result = await ApplicationsService.importData(
    'default',
    'VOTER',
    rows as any[],
    {
      targetConstituencyId: constituency.id,
      columnMapping: mappingResult.suggestions,
      importMode: 'REPLACE',
      voterGroupSize: 100,
      fileName: 'VOTER_DATA_FINAL.xlsx',
      fileSize: 18755954,
    }
  );
  const importDuration = ((Date.now() - importStart) / 1000).toFixed(2);
  console.log(`ApplicationsService.importData finished in ${importDuration}s:`, result);

  // After Counts
  const afterVoters = await prisma.voter.count({ where: { constituencyId: constituency.id } });
  const afterBooths = await prisma.booth.count({ where: { village: { mandal: { constituencyId: constituency.id } } } });
  const afterGroups = await prisma.voterGroup.count({ where: { booth: { village: { mandal: { constituencyId: constituency.id } } } } });
  const afterMandals = await prisma.mandal.count({ where: { constituencyId: constituency.id } });
  
  // Specific category counts
  const activeVoters = await prisma.voter.count({
    where: { constituencyId: constituency.id, voterStatus: 'ACTIVE' },
  });
  const shiftedVoters = await prisma.voter.count({
    where: { constituencyId: constituency.id, voterStatus: 'SHIFTED' },
  });
  const blankEpicVoters = await prisma.voter.count({
    where: {
      constituencyId: constituency.id,
      notes: { contains: 'OVERSEAS_ELECTOR_NO_DOMESTIC_EPIC' },
    },
  });
  const conflictVoters = await prisma.voter.count({
    where: {
      constituencyId: constituency.id,
      notes: { contains: 'DUPLICATE_ACTIVE_CONFLICT' },
    },
  });
  const revisionPairsDeleted = await prisma.voter.count({
    where: {
      constituencyId: constituency.id,
      notes: { contains: 'ECI_DELETED_IN_REVISION' },
    },
  });

  // Verify group sizes
  const groupSizes = await prisma.$queryRaw<Array<{ id: string; name: string; member_count: bigint }>>`
    SELECT vg.id, vg.name, COUNT(v.id) as member_count
    FROM voter_groups vg
    JOIN booths b ON vg.booth_id = b.id
    JOIN villages vil ON b.village_id = vil.id
    JOIN mandals m ON vil.mandal_id = m.id
    LEFT JOIN voters v ON v.voter_group_id = vg.id AND v.voter_status = 'ACTIVE'
    WHERE m.constituency_id = ${constituency.id}::uuid
    GROUP BY vg.id, vg.name
  `;

  let maxGroupSize = 0;
  let groupsOver100 = 0;
  for (const g of groupSizes) {
    const sz = Number(g.member_count);
    if (sz > maxGroupSize) maxGroupSize = sz;
    if (sz > 100) groupsOver100++;
  }

  // Double active conflict check for RLY0252437
  const conflictRecords = await prisma.voter.findMany({
    where: {
      constituencyId: constituency.id,
      epicNumber: { startsWith: 'RLY0252437' },
    },
    select: {
      id: true,
      epicNumber: true,
      serialNumber: true,
      voterStatus: true,
      notes: true,
      booth: { select: { boothNumber: true } },
    },
  });

  const reconciliationReport = {
    stagingDatabase: 'kondapi_connect (PostgreSQL 18.4 local)',
    constituency: `${constituency.name} (${constituency.code})`,
    importMode: 'REPLACE',
    sourceRowsTotal: rows.length,
    dbVotersTotal: afterVoters,
    breakdown: {
      activeVoters,
      shiftedVoters,
      blankEpicOverseasVoters: blankEpicVoters,
      activeActiveConflictVoters: conflictVoters,
      revisionPairsDeleted,
    },
    hierarchy: {
      mandals: afterMandals,
      booths: afterBooths,
      voterGroups: afterGroups,
    },
    groupVerification: {
      totalGroups: groupSizes.length,
      maxGroupSize,
      groupsOver100,
    },
    conflictVerificationRLY0252437: conflictRecords,
    discrepancyCount: rows.length - afterVoters,
    importDurationSeconds: importDuration,
  };

  console.log('=== RECONCILIATION REPORT ===');
  console.log(JSON.stringify(reconciliationReport, null, 2));

  fs.writeFileSync(
    'C:\\Users\\priya\\.gemini\\antigravity-ide\\brain\\d00a4cc0-587b-43c0-9000-3effac83ef11\\scratch\\staging_reconciliation_report.json',
    JSON.stringify(reconciliationReport, null, 2)
  );
  console.log('Reconciliation report saved to scratch/staging_reconciliation_report.json');
}

runStagingImport()
  .catch((err) => {
    console.error('STAGING IMPORT ERROR:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
