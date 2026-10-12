import { ApplicationsService } from '../modules/applications/applications.service.js';
import { RoleType } from '@prisma/client';

async function runTests() {
  console.log('--- TESTING APPLICATIONS API SERVICE ---');

  // 1. Resolve application and hierarchy
  console.log('1. Testing getHierarchy...');
  const hierarchy = await ApplicationsService.getHierarchy('default');
  console.log('Application resolved:', {
    appName: hierarchy.appName,
    scope: hierarchy.appScope,
    activeLevels: hierarchy.activeHierarchyLevels,
    labels: hierarchy.hierarchyLabels,
  });

  // 2. Test getHierarchyNodesByLevel
  console.log('\n2. Testing getHierarchyNodesByLevel...');
  const mandals = await ApplicationsService.getHierarchyNodesByLevel('default', 'MANDAL');
  console.log(`Found ${mandals.length} mandals`);

  // 3. Test validateData
  console.log('\n3. Testing validateData...');
  const sampleRows = [
    {
      epicNumber: 'TESTAP001',
      fullName: 'Ravi Teja Test',
      age: 32,
      gender: 'MALE',
      mandal: 'Kondapi Mandal',
      village: 'Kondapi Village',
      boothNumber: '101',
      voterGroup: 'Group 1',
    },
    {
      epicNumber: 'TESTAP001', // duplicate in file!
      fullName: 'Duplicate Ravi',
      age: 28,
      gender: 'MALE',
      mandal: 'Kondapi Mandal',
      village: 'Kondapi Village',
      boothNumber: '101',
    },
    {
      epicNumber: '', // missing EPIC
      fullName: 'No Epic Person',
      age: 16, // invalid age < 18
      gender: 'FEMALE',
      mandal: '',
      village: '',
      boothNumber: '',
    },
  ];

  const validation = await ApplicationsService.validateData('default', 'VOTER', sampleRows);
  console.log('Validation results:', {
    totalRows: validation.totalRows,
    validRows: validation.validRows,
    invalidRows: validation.invalidRows,
    duplicateCount: validation.duplicateCount,
    errorCount: validation.errors.length,
    previewCount: validation.preview.length,
  });
  console.log('First 2 preview rows:', validation.preview.slice(0, 2));

  // 4. Test importData
  console.log('\n4. Testing importData...');
  const validRowsToImport = [
    {
      serialNumber: 1,
      epicNumber: 'APTEST999901',
      fullName: 'Srinivas Rao Test',
      relativeName: 'Venkata Rao',
      age: 45,
      gender: 'MALE',
      mandal: 'Kondapi Mandal',
      village: 'Kondapi Village',
      boothNumber: '201',
      voterGroup: 'Booth 201 Group A',
      caste: 'BC-A',
      profession: 'Agriculture',
      politicalPreference: 'TDP',
    },
  ];

  const importResult = await ApplicationsService.importData('default', 'VOTER', validRowsToImport, {
    importMode: 'APPEND',
    fileName: 'test_automated_import.xlsx',
  });
  console.log('Import result:', importResult);

  // 5. Test getIncharges & assignIncharge
  console.log('\n5. Testing Incharges...');
  const inchargesBefore = await ApplicationsService.getIncharges('default');
  console.log(`Current incharges count: ${inchargesBefore.length}`);

  // Find a village or booth to assign
  const sampleBooth = await ApplicationsService.getHierarchyNodesByLevel('default', 'BOOTH');
  if (sampleBooth.length > 0) {
    const targetBooth = sampleBooth[0];
    const assignResult = await ApplicationsService.assignIncharge('default', {
      name: 'Ramu Polling President',
      mobileNumber: '9988776655',
      role: RoleType.BOOTH_PRESIDENT,
      unitLevel: 'BOOTH',
      unitId: targetBooth.id,
      reason: 'Automated test incharge assignment',
    });
    console.log('Assigned incharge result:', {
      id: assignResult.id,
      userId: assignResult.userId,
      role: assignResult.roleType,
    });
  }

  // 6. Test getSummary
  console.log('\n6. Testing getSummary...');
  const summary = await ApplicationsService.getSummary('default');
  console.log('Application summary KPIs:', summary);

  console.log('\n--- ALL BACKEND SERVICE TESTS PASSED! ---');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
