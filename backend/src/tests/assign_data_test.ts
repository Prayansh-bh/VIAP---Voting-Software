import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';

async function runAssignDataTests() {
  console.log('🚀 Running Assign Data End-to-End Test Suite...\n');
  const app = buildApp();
  await app.ready();

  try {
    // 1. GET /api/applications
    console.log('Testing GET /api/applications...');
    const appsRes = await app.inject({
      method: 'GET',
      url: '/api/applications',
    });
    console.log('Status:', appsRes.statusCode);
    const apps = JSON.parse(appsRes.body).data;
    if (!Array.isArray(apps) || apps.length === 0) {
      throw new Error('No applications returned from /api/applications');
    }
    const targetApp = apps[0];
    const appId = targetApp.id || targetApp.configKey;
    console.log(`✅ 1. Applications listed. Target app: ${targetApp.appName} (${appId})\n`);

    // 2. GET /api/applications/:appId/configuration
    console.log(`Testing GET /api/applications/${appId}/configuration...`);
    const configRes = await app.inject({
      method: 'GET',
      url: `/api/applications/${appId}/configuration`,
    });
    const config = JSON.parse(configRes.body).data;
    if (!config || !config.appName) {
      throw new Error('Failed to fetch application configuration');
    }
    console.log(`✅ 2. Configuration fetched: scope=${config.appScope}, activeLevels=${config.activeHierarchyLevels?.length}\n`);

    // 3. GET /api/applications/:appId/hierarchy
    console.log(`Testing GET /api/applications/${appId}/hierarchy...`);
    const hierRes = await app.inject({
      method: 'GET',
      url: `/api/applications/${appId}/hierarchy`,
    });
    const hier = JSON.parse(hierRes.body).data;
    if (!hier || !hier.activeHierarchyLevels) {
      throw new Error('Failed to fetch hierarchy');
    }
    console.log(`✅ 3. Dynamic hierarchy tree loaded: ${hier.activeHierarchyLevels.join(' -> ')}\n`);

    // 4. GET /api/applications/:appId/constituencies
    console.log(`Testing GET /api/applications/${appId}/constituencies...`);
    const constRes = await app.inject({
      method: 'GET',
      url: `/api/applications/${appId}/constituencies`,
    });
    const constituencies = JSON.parse(constRes.body).data;
    if (!Array.isArray(constituencies) || constituencies.length === 0) {
      throw new Error('No constituencies returned');
    }
    const targetConstituency = constituencies[0];
    console.log(`✅ 4. Scoped constituencies fetched (${constituencies.length} ACs). Target: ${targetConstituency.name} (${targetConstituency.id})\n`);

    // 5. POST /api/applications/:appId/data/mapping
    console.log('Testing POST /api/applications/:appId/data/mapping...');
    const sampleHeaders = [
      'Voter ID',
      'Voter Name',
      'Father Name',
      'Age',
      'Gender',
      'Mobile Number',
      'Mandal Name',
      'Village Name',
      'Booth No',
      'Section / Group',
    ];
    const mapRes = await app.inject({
      method: 'POST',
      url: `/api/applications/${appId}/data/mapping`,
      payload: { headers: sampleHeaders },
    });
    const mappingData = JSON.parse(mapRes.body).data;
    if (!mappingData.suggestions || mappingData.suggestions['Voter ID'] !== 'epicNumber') {
      throw new Error('Column auto-mapping failed to match Voter ID -> epicNumber');
    }
    console.log(`✅ 5. Column auto-mapping successfully suggested: ${JSON.stringify(mappingData.suggestions)}\n`);

    // 6. POST /api/applications/:appId/data/validate (Validate-Only mode)
    console.log('Testing POST /api/applications/:appId/data/validate (Validate Only)...');
    const testEpic1 = `TEST${Date.now()}A`;
    const testEpic2 = `TEST${Date.now()}B`;
    const sampleRows = [
      {
        'Voter ID': testEpic1,
        'Voter Name': 'Anil Sharma',
        'Father Name': 'Ram Sharma',
        Age: '32',
        Gender: 'MALE',
        'Mobile Number': '9876543210',
        'Mandal Name': 'Central Mandal',
        'Village Name': 'Ward 1',
        'Booth No': '101',
        'Section / Group': 'Group 1',
      },
      {
        'Voter ID': testEpic2,
        'Voter Name': 'Sunita Sharma',
        'Father Name': 'Anil Sharma',
        Age: '29',
        Gender: 'FEMALE',
        'Mobile Number': '9876543211',
        'Mandal Name': 'Central Mandal',
        'Village Name': 'Ward 1',
        'Booth No': '101',
        'Section / Group': 'Group 1',
      },
      {
        'Voter ID': '', // invalid row
        'Voter Name': 'Invalid Person',
        Age: '14', // underage
        Gender: 'OTHER',
        'Mandal Name': '',
        'Village Name': '',
        'Booth No': '',
      },
    ];

    const valRes = await app.inject({
      method: 'POST',
      url: `/api/applications/${appId}/data/validate`,
      payload: {
        level: 'VOTER',
        rows: sampleRows,
        columnMapping: mappingData.suggestions,
        targetConstituencyId: targetConstituency.id,
      },
    });
    const valReport = JSON.parse(valRes.body).data;
    if (valReport.totalRows !== 3 || valReport.validRows !== 2 || valReport.invalidRows !== 1) {
      throw new Error(`Validation counts unexpected: total=${valReport.totalRows}, valid=${valReport.validRows}, invalid=${valReport.invalidRows}`);
    }
    console.log(`✅ 6. Validate-only mode verified: total=3, valid=2, invalid=1, detected underage/missing fields\n`);

    // 7. POST /api/applications/:appId/data/import (APPEND Mode)
    console.log('Testing POST /api/applications/:appId/data/import (APPEND Mode)...');
    const impRes = await app.inject({
      method: 'POST',
      url: `/api/applications/${appId}/data/import`,
      payload: {
        level: 'VOTER',
        rows: sampleRows.slice(0, 2), // only valid rows
        columnMapping: mappingData.suggestions,
        targetConstituencyId: targetConstituency.id,
        importMode: 'APPEND',
        fileName: 'test_sample_voters.xlsx',
      },
    });
    const impSummary = JSON.parse(impRes.body).data;
    if (!impSummary.importId || impSummary.importedCount !== 2) {
      throw new Error(`Import failed: ${JSON.stringify(impSummary)}`);
    }
    console.log(`✅ 7. Append Import succeeded: importId=${impSummary.importId}, status=${impSummary.status}, imported=${impSummary.importedCount}, booths=${impSummary.boothsCount}, groups=${impSummary.voterGroupsCount}\n`);

    // Verify in PostgreSQL DB
    const dbVoter1 = await prisma.voter.findUnique({ where: { epicNumber: testEpic1 } });
    const dbVoter2 = await prisma.voter.findUnique({ where: { epicNumber: testEpic2 } });
    if (!dbVoter1 || !dbVoter2) {
      throw new Error('Voters were not persisted in PostgreSQL database');
    }
    console.log(`✅ 8. Database verification passed: voter 1 (${dbVoter1.name}, boothId=${dbVoter1.boothId}) and voter 2 exist in PostgreSQL\n`);

    // 9. GET /api/applications/:appId/data/imports (History)
    console.log(`Testing GET /api/applications/${appId}/data/imports...`);
    const histRes = await app.inject({
      method: 'GET',
      url: `/api/applications/${appId}/data/imports`,
    });
    const history = JSON.parse(histRes.body).data;
    if (!history.items || history.items.length === 0) {
      throw new Error('Import history empty');
    }
    console.log(`✅ 9. Import history loaded (${history.items.length} records). Latest status: ${history.items[0].status}\n`);

    // 10. GET error report CSV
    console.log(`Testing GET /api/applications/${appId}/data/imports/${impSummary.importId}/error-report...`);
    const csvRes = await app.inject({
      method: 'GET',
      url: `/api/applications/${appId}/data/imports/${impSummary.importId}/error-report`,
    });
    if (!csvRes.headers['content-type']?.includes('text/csv')) {
      throw new Error('Error report did not return text/csv header');
    }
    console.log(`✅ 10. Downloadable Error Report CSV generated.\n`);

    // 11. Verify AuditLog
    const auditRecord = await prisma.auditLog.findFirst({
      where: { entityType: 'DataImport', entityId: impSummary.importId },
    });
    if (!auditRecord) {
      throw new Error('Audit log for DataImport was not created');
    }
    console.log(`✅ 11. AuditLog verified: action=${auditRecord.action}, entityId=${auditRecord.entityId}\n`);

    console.log('🎉 ALL ASSIGN DATA BACKEND INTEGRATION TESTS PASSED 100%!');
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
}

runAssignDataTests().catch((err) => {
  console.error('❌ Assign Data test failed:', err);
  process.exit(1);
});
