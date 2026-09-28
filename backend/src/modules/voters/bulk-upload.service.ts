import {
  Gender,
  OrgHierarchyLevel,
  Prisma,
  RelationType,
  SurveyStatus,
  VoterLocationStatus,
  VoterStatus,
  VoteStatus,
} from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { UserHierarchyScope } from '../../common/types.js';
import { getConstituencyLockKey } from '../../common/lock.js';

export interface RawVoterRow {
  serialNumber?: number | string;
  epicNumber?: string;
  epic?: string;
  name?: string;
  fullName?: string;
  fatherHusbandName?: string;
  relativeName?: string;
  relationType?: string;
  gender?: string;
  age?: number | string;
  houseNumber?: string;
  doorNo?: string;
  mobileNumber?: string;
  phone?: string;
  mandal?: string;
  mandalName?: string;
  village?: string;
  villageName?: string;
  panchayat?: string;
  boothNumber?: string | number;
  booth?: string | number;
  pollingStation?: string;
  voterGroup?: string;
  cluster?: string;
  team?: string;
  caste?: string;
  subCaste?: string;
  profession?: string;
  occupation?: string;
  politicalPreference?: string;
  voterStatus?: string;
  voterLocationStatus?: string;
  locationStatus?: string;
  currentLocation?: string;
  migrationCity?: string;
  notes?: string;
  remarks?: string;
}

export interface VoterValidationReport {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateEpicsCount: number;
  missingRequiredCount: number;
  errors: {
    rowNumber: number;
    epicNumber?: string;
    field: string;
    message: string;
    suggestion: string;
  }[];
  sampleValidRows: any[];
}

export interface BulkImportOptions {
  validateOnly?: boolean;
  importMode?: 'APPEND' | 'REPLACE';
  voterGroupSize?: number;
  actorId?: string;
  scope?: UserHierarchyScope;
  _testHookAfterDelete?: (tx: Prisma.TransactionClient) => Promise<void>;
}

// Concurrency guard: tracks active bulk import operations per constituency to prevent race conditions
const activeConstituencyImports = new Set<string>();

export class BulkUploadService {
  static async validateVotersOnly(rows: RawVoterRow[]): Promise<VoterValidationReport> {
    const errors: { rowNumber: number; epicNumber?: string; field: string; message: string; suggestion: string }[] = [];
    const seenEpicsInFile = new Set<string>();
    let duplicateEpicsCount = 0;
    let missingRequiredCount = 0;
    let validRows = 0;
    const sampleValidRows: any[] = [];

    const existingEpics = new Set<string>();
    if (rows.length > 0) {
      const epicsToCheck = rows.map((r) => String(r.epicNumber || r.epic || '').trim().toUpperCase()).filter(Boolean);
      const chunkSize = 2000;
      for (let i = 0; i < epicsToCheck.length; i += chunkSize) {
        const slice = epicsToCheck.slice(i, i + chunkSize);
        const foundInDb = await prisma.voter.findMany({
          where: { epicNumber: { in: slice } },
          select: { epicNumber: true },
        });
        foundInDb.forEach((v) => existingEpics.add(v.epicNumber));
      }
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;
      const epic = String(row.epicNumber || row.epic || '').trim().toUpperCase();
      const rawName = String(row.name || row.fullName || '').trim();
      const ageNum = parseInt(String(row.age || '0'), 10);
      let isRowValid = true;

      if (!epic) {
        errors.push({
          rowNumber: rowNum,
          field: 'epicNumber',
          message: 'Voter ID / EPIC number is missing',
          suggestion: 'Provide unique EPIC Number, e.g., AP01009823',
        });
        missingRequiredCount++;
        isRowValid = false;
      } else {
        if (seenEpicsInFile.has(epic)) {
          errors.push({
            rowNumber: rowNum,
            epicNumber: epic,
            field: 'epicNumber',
            message: `Duplicate EPIC '${epic}' found inside uploaded file`,
            suggestion: 'Remove or resolve duplicate EPIC row in spreadsheet',
          });
          duplicateEpicsCount++;
          isRowValid = false;
        } else {
          seenEpicsInFile.add(epic);
        }
      }

      if (!rawName) {
        errors.push({
          rowNumber: rowNum,
          epicNumber: epic || undefined,
          field: 'fullName',
          message: 'Voter full name is missing',
          suggestion: 'Provide citizen full name in row',
        });
        missingRequiredCount++;
        isRowValid = false;
      }

      if (isNaN(ageNum) || ageNum < 18 || ageNum > 120) {
        errors.push({
          rowNumber: rowNum,
          epicNumber: epic || undefined,
          field: 'age',
          message: `Invalid voter age '${row.age || 'blank'}'. Must be between 18 and 120`,
          suggestion: 'Enter a valid legal voter age (>= 18)',
        });
        isRowValid = false;
      }

      if (isRowValid) {
        validRows++;
        if (sampleValidRows.length < 5) {
          sampleValidRows.push({
            serialNumber: row.serialNumber || rowNum,
            epicNumber: epic,
            fullName: rawName,
            age: ageNum,
            gender: row.gender || 'MALE',
            mandalName: row.mandal || row.mandalName || 'Mandal 1',
            villageName: row.village || row.villageName || 'Village 1',
            boothNumber: row.boothNumber || row.booth || '101',
          });
        }
      }
    }

    return {
      totalRows: rows.length,
      validRows,
      invalidRows: rows.length - validRows,
      duplicateEpicsCount,
      missingRequiredCount,
      errors: errors.slice(0, 500),
      sampleValidRows,
    };
  }

  static async importVotersFromData(constituencyId: string, rows: RawVoterRow[], options?: BulkImportOptions | string) {
    if (!Array.isArray(rows) || rows.length === 0) {
      const err: any = new Error('No voter data rows provided in upload.');
      err.statusCode = 400;
      throw err;
    }

    const opts: BulkImportOptions = typeof options === 'string' ? { actorId: options } : (options || {});

    if (opts.validateOnly) {
      return await this.validateVotersOnly(rows);
    }

    // 1. Resolve Target Constituency strictly & deterministically
    if (!constituencyId || typeof constituencyId !== 'string' || !constituencyId.trim()) {
      const err: any = new Error('Constituency identifier is required.');
      err.statusCode = 400;
      throw err;
    }

    const targetId = constituencyId.trim();
    let constituency: any = null;

    // 1a. Try finding by exact ID / UUID
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)) {
      try {
        constituency = await prisma.constituency.findUnique({
          where: { id: targetId },
          include: {
            parliament: {
              include: {
                zone: {
                  include: { state: true },
                },
              },
            },
          },
        });
      } catch {
        // Not found by ID
      }
    }

    // 1b. Try finding by unique code
    if (!constituency) {
      constituency = await prisma.constituency.findUnique({
        where: { code: targetId },
        include: {
          parliament: {
            include: {
              zone: {
                include: { state: true },
              },
            },
          },
        },
      });
    }

    // 1c. Try finding by exact name
    if (!constituency) {
      const cleanName = targetId.replace(/\s*\(AC.*?\)\s*/gi, '').trim();
      const nameMatches = await prisma.constituency.findMany({
        where: { name: { equals: cleanName, mode: 'insensitive' } },
        include: {
          parliament: {
            include: {
              zone: {
                include: { state: true },
              },
            },
          },
        },
      });

      if (nameMatches.length === 1) {
        constituency = nameMatches[0];
      } else if (nameMatches.length > 1) {
        const err: any = new Error(`Ambiguous constituency identifier '${constituencyId}'. Multiple constituencies matched.`);
        err.statusCode = 400;
        throw err;
      }
    }

    // Fail closed: Never silently fall back to findFirst() or auto-provision!
    if (!constituency) {
      const err: any = new Error(`Target constituency '${constituencyId}' not found.`);
      err.statusCode = 404;
      err.code = 'CONSTITUENCY_NOT_FOUND';
      throw err;
    }

    // 2. Enforce Hierarchy Scope Authorization (P1-A reuse)
    if (opts.scope && !opts.scope.isGlobalScope) {
      if (!opts.scope.accessibleConstituencyIds.has(constituency.id)) {
        const err: any = new Error(`Access denied: You do not have authority over constituency '${constituency.name}'.`);
        err.statusCode = 403;
        err.code = 'FORBIDDEN_SCOPE';
        throw err;
      }
    }

    // 3. Concurrency Protection (Prevent simultaneous active imports on same constituency)
    if (activeConstituencyImports.has(constituency.id)) {
      const err: any = new Error(
        `An import is already actively processing for constituency '${constituency.name}'. Simultaneous imports are forbidden to protect data integrity.`
      );
      err.statusCode = 409;
      err.code = 'CONCURRENT_IMPORT_CONFLICT';
      throw err;
    }

    // Query active imports without artificial 5-minute timeout window
    const activeImport = await prisma.dataImport.findFirst({
      where: {
        targetConstituencyId: constituency.id,
        status: 'PROCESSING',
      },
    });
    if (activeImport) {
      const err: any = new Error(
        `An import is already actively processing for constituency '${constituency.name}'. Simultaneous imports are forbidden to protect data integrity.`
      );
      err.statusCode = 409;
      err.code = 'CONCURRENT_IMPORT_CONFLICT';
      throw err;
    }

    activeConstituencyImports.add(constituency.id);
    let dataImportRecord: any = null;
    try {

    // 4. Pre-Flight In-File Duplicate EPIC Validation (Applies to both REPLACE and APPEND)
    const seenEpicsInFile = new Set<string>();
    for (let i = 0; i < rows.length; i++) {
      const epic = String(rows[i].epicNumber || rows[i].epic || '').trim().toUpperCase();
      if (!epic) continue;
      if (seenEpicsInFile.has(epic)) {
        const err: any = new Error(
          `Duplicate EPIC '${epic}' found inside uploaded file at row ${i + 1}. Each EPIC must be unique within the uploaded dataset.`
        );
        err.statusCode = 400;
        err.code = 'DUPLICATE_EPIC_IN_FILE';
        throw err;
      }
      seenEpicsInFile.add(epic);
    }

    // 5. Pre-Flight Cross-Constituency EPIC Ownership Conflict Check
    // Query existing voters for all EPICs in upload. If any existing voter belongs to a different constituency,
    // abort immediately before any mutation to prevent unauthorized cross-constituency reassignment.
    const allEpicsInFile = Array.from(seenEpicsInFile);
    const existingVotersInDb = new Map<string, { id: string; constituencyId: string | null; caste?: string | null; subCaste?: string | null; profession?: string | null; notes?: string | null }>();
    const chunkSize = 2000;
    for (let i = 0; i < allEpicsInFile.length; i += chunkSize) {
      const slice = allEpicsInFile.slice(i, i + chunkSize);
      const found = await prisma.voter.findMany({
        where: { epicNumber: { in: slice } },
        select: { id: true, epicNumber: true, constituencyId: true, caste: true, subCaste: true, profession: true, notes: true },
      });
      found.forEach((v) => existingVotersInDb.set(v.epicNumber, v));
    }

    const crossConstituencyConflicts: string[] = [];
    for (const [epic, v] of existingVotersInDb.entries()) {
      if (v.constituencyId !== constituency.id) {
        crossConstituencyConflicts.push(epic);
      }
    }
    if (crossConstituencyConflicts.length > 0) {
      const err: any = new Error(
        `Cross-constituency conflict: ${crossConstituencyConflicts.length} voter(s) (${crossConstituencyConflicts.slice(0, 3).join(', ')}) already belong to a different constituency. Cross-constituency voter reassignment is strictly forbidden.`
      );
      err.statusCode = 409;
      err.code = 'EPIC_CROSS_CONSTITUENCY_CONFLICT';
      throw err;
    }

    // 6. Pre-Flight Validation for REPLACE Mode (ZERO deletion before complete validation)
    if (opts.importMode === 'REPLACE') {
      const preflight = await this.validateVotersOnly(rows);
      if (preflight.invalidRows > 0 || preflight.duplicateEpicsCount > 0) {
        const err: any = new Error(
          `Pre-flight validation failed: ${preflight.invalidRows} invalid row(s) and ${preflight.duplicateEpicsCount} duplicate EPIC(s) detected. Aborting REPLACE import to protect data integrity.`
        );
        err.statusCode = 400;
        err.validationReport = preflight;
        throw err;
      }
    }

    // 7. Track active DataImport audit record
    dataImportRecord = await prisma.dataImport.create({
      data: {
        uploadedById: opts.actorId || undefined,
        fileName: `bulk-upload-${constituency.id.slice(0, 8)}-${Date.now()}.csv`,
        targetConstituencyId: constituency.id,
        mode: opts.importMode || 'APPEND',
        status: 'PROCESSING',
        totalRecords: rows.length,
        startedAt: new Date(),
      },
    });

    const stateId = constituency.parliament?.zone?.state?.id || (await prisma.state.findFirst())?.id || '';
    const zoneId = constituency.parliament?.zone?.id || (await prisma.zone.findFirst())?.id || '';
    const parliamentId = constituency.parliament?.id || (await prisma.parliament.findFirst())?.id || '';

    // Find or create constituency organization unit
    let constUnit = await prisma.organizationUnit.findFirst({
      where: { name: constituency.name, level: OrgHierarchyLevel.CONSTITUENCY },
    });

    if (!constUnit) {
      constUnit = await prisma.organizationUnit.create({
        data: {
          name: constituency.name,
          code: constituency.code,
          level: OrgHierarchyLevel.CONSTITUENCY,
          totalVoters: 228000,
        },
      });
    }

    // 5. Pre-load hierarchy caches for efficient batch resolution
    const existingMandals = await prisma.mandal.findMany({
      where: { constituencyId: constituency.id },
    });
    const mandalMap = new Map<string, { id: string; name: string }>();
    for (const m of existingMandals) {
      mandalMap.set(m.name.trim().toLowerCase(), { id: m.id, name: m.name });
    }

    const existingVillages = await prisma.village.findMany({
      where: { mandal: { constituencyId: constituency.id } },
    });
    const villageMap = new Map<string, { id: string; name: string; mandalId: string }>();
    for (const v of existingVillages) {
      villageMap.set(`${v.mandalId}:${v.name.trim().toLowerCase()}`, { id: v.id, name: v.name, mandalId: v.mandalId });
    }

    const existingBooths = await prisma.booth.findMany({
      where: { village: { mandal: { constituencyId: constituency.id } } },
    });
    const boothMap = new Map<string, { id: string; boothNumber: string; villageId: string }>();
    for (const b of existingBooths) {
      boothMap.set(`${b.villageId}:${String(b.boothNumber).trim().toLowerCase()}`, { id: b.id, boothNumber: b.boothNumber, villageId: b.villageId });
    }

    const existingGroups = await prisma.voterGroup.findMany({
      where: { booth: { village: { mandal: { constituencyId: constituency.id } } } },
    });
    const groupMap = new Map<string, { id: string; name: string; boothId: string }>();
    for (const g of existingGroups) {
      groupMap.set(`${g.boothId}:${g.name.trim().toLowerCase()}`, { id: g.id, name: g.name, boothId: g.boothId });
    }

    let mandalsCreated = 0;
    let villagesCreated = 0;
    let boothsCreated = 0;
    let voterGroupsCreated = 0;
    let newVotersAdded = 0;
    let votersUpdated = 0;

    // Normalization Helpers
    const parseGender = (val?: string): Gender => {
      const g = (val || '').trim().toUpperCase();
      if (g.startsWith('F') || g === 'FEMALE') return Gender.FEMALE;
      if (g.startsWith('M') || g === 'MALE') return Gender.MALE;
      return Gender.OTHER;
    };

    const parseRelation = (val?: string, gender?: Gender, age?: number): RelationType => {
      const r = (val || '').trim().toUpperCase();
      if (r.includes('HUSBAND') || r === 'H') return RelationType.HUSBAND;
      if (r.includes('MOTHER') || r === 'M') return RelationType.MOTHER;
      if (r.includes('FATHER') || r === 'F') return RelationType.FATHER;
      if (gender === Gender.FEMALE && (age || 0) > 23) return RelationType.HUSBAND;
      return RelationType.FATHER;
    };

    const parsePreference = (val?: string): string => {
      const p = (val || '').trim().toUpperCase();
      if (p.includes('TDP')) return 'TDP';
      if (p.includes('YSR')) return 'YSRCP';
      if (p.includes('JSP') || p.includes('JANASENA')) return 'JSP';
      if (p.includes('BJP')) return 'BJP';
      if (p.includes('INC') || p.includes('CONG')) return 'INC';
      return 'NEUTRAL';
    };

    // 6. Pre-resolve and create hierarchy safely with deterministic codes
    interface PreparedRow {
      raw: RawVoterRow;
      epic: string;
      rawName: string;
      mandalRecord: { id: string; name: string };
      villageRecord: { id: string; name: string; mandalId: string };
      boothRecord: { id: string; boothNumber: string; villageId: string };
      groupRecord: { id: string; name: string; boothId: string };
    }

    const preparedRows: PreparedRow[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const epic = String(row.epicNumber || row.epic || '').trim().toUpperCase();
      const rawName = String(row.name || row.fullName || '').trim();

      if (!epic || !rawName) {
        continue;
      }

      const mandalName = String(row.mandal || row.mandalName || `${constituency.name} Mandal 1`).trim();
      const villageName = String(row.village || row.villageName || row.panchayat || `${mandalName} Village 1`).trim();
      const boothRaw = String(row.boothNumber || row.booth || row.pollingStation || 'Booth 101').trim();
      const groupName = String(row.voterGroup || row.cluster || row.team || '100-Voter Group 1').trim();

      // Ensure Mandal
      const mandalKey = mandalName.toLowerCase();
      let mandalRecord = mandalMap.get(mandalKey);
      if (!mandalRecord) {
        const mandalCode = `MDL-${constituency.id.slice(0, 8)}-${mandalName.replace(/\W/g, '').toUpperCase().slice(0, 8)}`;
        const createdMandal = await prisma.mandal.upsert({
          where: { code: mandalCode },
          update: { name: mandalName },
          create: {
            constituencyId: constituency.id,
            name: mandalName,
            code: mandalCode,
            totalVoters: 38000,
          },
        });
        await prisma.organizationUnit.create({
          data: {
            name: mandalName,
            code: mandalCode,
            level: OrgHierarchyLevel.MANDAL,
            parentId: constUnit.id,
          },
        }).catch(() => {});
        mandalRecord = { id: createdMandal.id, name: createdMandal.name };
        mandalMap.set(mandalKey, mandalRecord);
        mandalsCreated++;
      }

      // Ensure Village
      const villageKey = `${mandalRecord.id}:${villageName.toLowerCase()}`;
      let villageRecord = villageMap.get(villageKey);
      if (!villageRecord) {
        const mandalUnit = await prisma.organizationUnit.findFirst({
          where: { name: mandalRecord.name, level: OrgHierarchyLevel.MANDAL },
        });
        const villageCode = `VIL-${mandalRecord.id.slice(0, 8)}-${villageName.replace(/\W/g, '').toUpperCase().slice(0, 8)}`;
        const createdVillage = await prisma.village.upsert({
          where: { code: villageCode },
          update: { name: villageName },
          create: {
            mandalId: mandalRecord.id,
            name: villageName,
            code: villageCode,
            totalVoters: 3500,
          },
        });
        await prisma.organizationUnit.create({
          data: {
            name: villageName,
            code: villageCode,
            level: OrgHierarchyLevel.VILLAGE,
            parentId: mandalUnit?.id || constUnit.id,
          },
        }).catch(() => {});
        villageRecord = { id: createdVillage.id, name: createdVillage.name, mandalId: mandalRecord.id };
        villageMap.set(villageKey, villageRecord);
        villagesCreated++;
      }

      // Ensure Booth
      const boothNumberStr = boothRaw.startsWith('Booth') ? boothRaw : `Booth ${boothRaw}`;
      const boothKey = `${villageRecord.id}:${boothNumberStr.toLowerCase()}`;
      let boothRecord = boothMap.get(boothKey);
      if (!boothRecord) {
        const villageUnit = await prisma.organizationUnit.findFirst({
          where: { name: villageRecord.name, level: OrgHierarchyLevel.VILLAGE },
        });
        const boothCode = `BTH-${villageRecord.id.slice(0, 8)}-${boothNumberStr.replace(/\W/g, '').toUpperCase().slice(0, 8)}`;
        const createdBooth = await prisma.booth.upsert({
          where: { code: boothCode },
          update: { boothNumber: boothNumberStr },
          create: {
            villageId: villageRecord.id,
            boothNumber: boothNumberStr,
            name: boothNumberStr,
            code: boothCode,
            pollingStation: boothNumberStr,
            totalVoters: 1000,
          },
        });
        await prisma.organizationUnit.create({
          data: {
            name: boothNumberStr,
            code: boothCode,
            level: OrgHierarchyLevel.BOOTH,
            parentId: villageUnit?.id || constUnit.id,
          },
        }).catch(() => {});
        boothRecord = { id: createdBooth.id, boothNumber: createdBooth.boothNumber, villageId: villageRecord.id };
        boothMap.set(boothKey, boothRecord);
        boothsCreated++;
      }

      // Ensure Voter Group
      const groupKey = `${boothRecord.id}:${groupName.toLowerCase()}`;
      let groupRecord = groupMap.get(groupKey);
      if (!groupRecord) {
        const boothUnit = await prisma.organizationUnit.findFirst({
          where: { name: boothRecord.boothNumber, level: OrgHierarchyLevel.BOOTH },
        });
        const groupCode = `VG-${boothRecord.id.slice(0, 8)}-${groupName.replace(/\W/g, '').toUpperCase().slice(0, 8)}`;
        const createdGroup = await prisma.voterGroup.upsert({
          where: { code: groupCode },
          update: { name: groupName },
          create: {
            boothId: boothRecord.id,
            name: groupName,
            code: groupCode,
            totalVoters: 100,
          },
        });
        await prisma.organizationUnit.create({
          data: {
            name: `${boothRecord.boothNumber} - ${groupName}`,
            code: groupCode,
            level: OrgHierarchyLevel.VOTER_GROUP,
            parentId: boothUnit?.id || constUnit.id,
          },
        }).catch(() => {});
        groupRecord = { id: createdGroup.id, name: createdGroup.name, boothId: boothRecord.id };
        groupMap.set(groupKey, groupRecord);
        voterGroupsCreated++;
      }

      preparedRows.push({
        raw: row,
        epic,
        rawName,
        mandalRecord,
        villageRecord,
        boothRecord,
        groupRecord,
      });
    }

    // ==========================================================================
    // HIERARCHY MASTER DATA BOUNDARY DOCUMENTATION:
    // Mandal, Village, Booth, and VoterGroup records represent persistent geographic
    // and administrative master data entities that exist independently of specific voter rolls.
    // They are intentionally created/resolved OUTSIDE the atomic voter transaction using
    // deterministic unique codes (MDL-*, VIL-*, BTH-*, VG-*) and upsert operations.
    // Rationale:
    // 1. If a voter transaction subsequently fails or rolls back, retaining these master
    //    hierarchy records is safe and avoids unnecessary primary key churn.
    // 2. Foreign keys point from Voter -> Hierarchy (not Hierarchy -> Voter).
    //    Therefore, a rolled-back voter transaction leaves zero dangling references.
    // 3. Subsequent import attempts will match and reuse these deterministic records
    //    via in-memory maps and database unique constraints.
    // ==========================================================================

    // 7. Execution: REPLACE Mode (Atomic via Prisma Transaction) vs APPEND Mode
    const lockKey = getConstituencyLockKey(constituency.id);

    if (opts.importMode === 'REPLACE') {
      const voterPayloads: Prisma.VoterCreateManyInput[] = [];

      for (let i = 0; i < preparedRows.length; i++) {
        const item = preparedRows[i];
        const row = item.raw;
        const gender = parseGender(String(row.gender || 'M'));
        const age = Math.max(18, Math.min(115, parseInt(String(row.age || '35'), 10) || 35));
        const relationType = parseRelation(row.relationType, gender, age);
        const relativeName = String(row.fatherHusbandName || row.relativeName || `${item.rawName.split(' ')[0]} Relative`).trim();
        const houseNo = String(row.houseNumber || row.doorNo || `${(i % 20) + 1}-${10 + (i % 50)}`).trim();
        const mobile = String(row.mobileNumber || row.phone || `9848${String(100000 + (i * 13) % 899999)}`).trim();
        const preference = parsePreference(row.politicalPreference);
        const isMigrated = String(row.voterLocationStatus || row.locationStatus || '').toLowerCase().includes('migrat');
        const migrationCity = String(row.migrationCity || row.currentLocation || (isMigrated ? 'Hyderabad' : 'Local')).trim();

        voterPayloads.push({
          serialNumber: parseInt(String(row.serialNumber || i + 1), 10) || i + 1,
          epicNumber: item.epic,
          name: item.rawName,
          fatherHusbandName: relativeName,
          relationType,
          houseNumber: houseNo,
          age,
          gender,
          mobileNumber: mobile,
          stateId,
          zoneId,
          parliamentId,
          constituencyId: constituency.id,
          mandalId: item.mandalRecord.id,
          villageId: item.villageRecord.id,
          boothId: item.boothRecord.id,
          voterGroupId: item.groupRecord.id,
          caste: String(row.caste || row.subCaste || 'General').trim(),
          subCaste: String(row.subCaste || row.caste || 'General').trim(),
          profession: String(row.profession || row.occupation || 'Agriculture').trim(),
          politicalPreference: preference,
          voterStatus: VoterStatus.ACTIVE,
          surveyStatus: SurveyStatus.SURVEYED,
          locationStatus: isMigrated ? VoterLocationStatus.MIGRATED : VoterLocationStatus.LOCAL,
          voterLocationStatus: isMigrated ? VoterLocationStatus.MIGRATED : VoterLocationStatus.LOCAL,
          currentLocation: migrationCity,
          migrationCity: isMigrated ? migrationCity : null,
          voteStatus: VoteStatus.NOT_VOTED,
          inchargeAssessment: preference,
          notes: String(row.notes || row.remarks || `Imported via CMS Excel Voter Roll for ${constituency.name}`).trim(),
        });
      }

      // Execute REPLACE inside an atomic transaction guarded by transaction-level advisory lock
      await prisma.$transaction(
        async (tx) => {
          // Acquire PostgreSQL transaction-level advisory lock
          // Serializes concurrent imports for the same constituency at the DB engine level
          const lockRes = await tx.$queryRaw<{ pg_try_advisory_xact_lock: boolean }[]>`
            SELECT pg_try_advisory_xact_lock(${lockKey}::bigint) as pg_try_advisory_xact_lock
          `;
          if (!lockRes[0]?.pg_try_advisory_xact_lock) {
            const err: any = new Error(
              `An import is already actively processing for constituency '${constituency.name}'. Simultaneous imports are forbidden to protect data integrity.`
            );
            err.statusCode = 409;
            err.code = 'CONCURRENT_IMPORT_CONFLICT';
            throw err;
          }

          // Delete existing voters in this constituency ONLY
          await tx.voter.deleteMany({
            where: { constituencyId: constituency.id },
          });

          // Test seam for deterministic rollback verification testing
          if (opts._testHookAfterDelete) {
            await opts._testHookAfterDelete(tx);
          }

          // Insert replacement voters in batches of 1,000 (no skipDuplicates to strictly enforce data integrity)
          for (let i = 0; i < voterPayloads.length; i += 1000) {
            const chunk = voterPayloads.slice(i, i + 1000);
            await tx.voter.createMany({
              data: chunk,
            });
          }
        },
        { timeout: 60000 }
      );

      newVotersAdded = voterPayloads.length;
    } else {
      // APPEND Mode: Reuses existingVotersInDb from preflight check (zero extra queries)
      const votersToUpdate: { id: string; data: any }[] = [];
      const newVoterPayloads: Prisma.VoterCreateManyInput[] = [];

      for (let i = 0; i < preparedRows.length; i++) {
        const item = preparedRows[i];
        const row = item.raw;
        const gender = parseGender(String(row.gender || 'M'));
        const age = Math.max(18, Math.min(115, parseInt(String(row.age || '35'), 10) || 35));
        const relationType = parseRelation(row.relationType, gender, age);
        const relativeName = String(row.fatherHusbandName || row.relativeName || `${item.rawName.split(' ')[0]} Relative`).trim();
        const houseNo = String(row.houseNumber || row.doorNo || `${(i % 20) + 1}-${10 + (i % 50)}`).trim();
        const mobile = String(row.mobileNumber || row.phone || `9848${String(100000 + (i * 13) % 899999)}`).trim();
        const preference = parsePreference(row.politicalPreference);
        const isMigrated = String(row.voterLocationStatus || row.locationStatus || '').toLowerCase().includes('migrat');
        const migrationCity = String(row.migrationCity || row.currentLocation || (isMigrated ? 'Hyderabad' : 'Local')).trim();

        const existingVoter = existingVotersInDb.get(item.epic);

        if (existingVoter) {
          // Preflight already guaranteed existingVoter.constituencyId === constituency.id
          votersToUpdate.push({
            id: existingVoter.id,
            data: {
              name: item.rawName,
              fatherHusbandName: relativeName,
              relationType,
              houseNumber: houseNo,
              age,
              gender,
              mobileNumber: mobile,
              constituencyId: constituency.id,
              mandalId: item.mandalRecord.id,
              villageId: item.villageRecord.id,
              boothId: item.boothRecord.id,
              voterGroupId: item.groupRecord.id,
              caste: String(row.caste || row.subCaste || existingVoter.caste || 'General').trim(),
              subCaste: String(row.subCaste || row.caste || existingVoter.subCaste || 'General').trim(),
              profession: String(row.profession || row.occupation || existingVoter.profession || 'Agriculture').trim(),
              politicalPreference: preference,
              locationStatus: isMigrated ? VoterLocationStatus.MIGRATED : VoterLocationStatus.LOCAL,
              voterLocationStatus: isMigrated ? VoterLocationStatus.MIGRATED : VoterLocationStatus.LOCAL,
              currentLocation: migrationCity,
              migrationCity: isMigrated ? migrationCity : null,
              notes: String(row.notes || row.remarks || existingVoter.notes || '').trim(),
            },
          });
        } else {
          newVoterPayloads.push({
            serialNumber: parseInt(String(row.serialNumber || i + 1), 10) || i + 1,
            epicNumber: item.epic,
            name: item.rawName,
            fatherHusbandName: relativeName,
            relationType,
            houseNumber: houseNo,
            age,
            gender,
            mobileNumber: mobile,
            stateId,
            zoneId,
            parliamentId,
            constituencyId: constituency.id,
            mandalId: item.mandalRecord.id,
            villageId: item.villageRecord.id,
            boothId: item.boothRecord.id,
            voterGroupId: item.groupRecord.id,
            caste: String(row.caste || row.subCaste || 'General').trim(),
            subCaste: String(row.subCaste || row.caste || 'General').trim(),
            profession: String(row.profession || row.occupation || 'Agriculture').trim(),
            politicalPreference: preference,
            voterStatus: VoterStatus.ACTIVE,
            surveyStatus: SurveyStatus.SURVEYED,
            locationStatus: isMigrated ? VoterLocationStatus.MIGRATED : VoterLocationStatus.LOCAL,
            voterLocationStatus: isMigrated ? VoterLocationStatus.MIGRATED : VoterLocationStatus.LOCAL,
            currentLocation: migrationCity,
            migrationCity: isMigrated ? migrationCity : null,
            voteStatus: VoteStatus.NOT_VOTED,
            inchargeAssessment: preference,
            notes: String(row.notes || row.remarks || `Imported via CMS Excel Voter Roll for ${constituency.name}`).trim(),
          });
        }
      }

      // Execute APPEND mutations inside atomic transaction guarded by advisory lock
      await prisma.$transaction(
        async (tx) => {
          // Acquire PostgreSQL transaction-level advisory lock
          const lockRes = await tx.$queryRaw<{ pg_try_advisory_xact_lock: boolean }[]>`
            SELECT pg_try_advisory_xact_lock(${lockKey}::bigint) as pg_try_advisory_xact_lock
          `;
          if (!lockRes[0]?.pg_try_advisory_xact_lock) {
            const err: any = new Error(
              `An import is already actively processing for constituency '${constituency.name}'. Simultaneous imports are forbidden to protect data integrity.`
            );
            err.statusCode = 409;
            err.code = 'CONCURRENT_IMPORT_CONFLICT';
            throw err;
          }

          for (const u of votersToUpdate) {
            await tx.voter.update({
              where: { id: u.id },
              data: u.data,
            });
          }

          if (newVoterPayloads.length > 0) {
            for (let i = 0; i < newVoterPayloads.length; i += 1000) {
              const chunk = newVoterPayloads.slice(i, i + 1000);
              await tx.voter.createMany({
                data: chunk,
                skipDuplicates: true,
              });
            }
          }
        },
        { timeout: 60000 }
      );

      votersUpdated = votersToUpdate.length;
      newVotersAdded = newVoterPayloads.length;
    }

    // Update total voters count on Constituency record
    const totalVotersInAC = await prisma.voter.count({
      where: { constituencyId: constituency.id },
    });
    await prisma.constituency.update({
      where: { id: constituency.id },
      data: { totalVoters: totalVotersInAC },
    });

    // Mark DataImport as SUCCESS
    await prisma.dataImport.update({
      where: { id: dataImportRecord.id },
      data: {
        status: 'SUCCESS',
        validRecords: rows.length,
        importedRecords: newVotersAdded,
        updatedRecords: votersUpdated,
        completedAt: new Date(),
      },
    });

    return {
      success: true,
      constituencyId: constituency.id,
      constituencyName: constituency.name,
      totalProcessed: rows.length,
      newVotersAdded,
      votersUpdated,
      mandalsCreated,
      villagesCreated,
      boothsCreated,
      voterGroupsCreated,
    };
  } catch (err: any) {
    if (dataImportRecord) {
      await prisma.dataImport.update({
        where: { id: dataImportRecord.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
        },
      }).catch(() => {});
    }
    throw err;
  } finally {
    activeConstituencyImports.delete(constituency.id);
  }
}
}
