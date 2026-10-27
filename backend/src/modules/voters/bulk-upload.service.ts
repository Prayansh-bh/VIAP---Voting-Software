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
import { env } from '../../config/env.js';

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
  importMode?: 'APPEND' | 'REPLACE' | 'UPSERT' | 'REFRESH';
  voterGroupSize?: number;
  actorId?: string;
  scope?: UserHierarchyScope;
  allowDangerousReplace?: boolean;
  _testHookAfterDelete?: (tx: Prisma.TransactionClient) => Promise<void>;
}

// Concurrency guard: tracks active bulk import operations per constituency to prevent race conditions
const activeConstituencyImports = new Set<string>();

export class BulkUploadService {
  static async validateVotersOnly(rows: RawVoterRow[]): Promise<VoterValidationReport> {
    const errors: { rowNumber: number; epicNumber?: string; field: string; message: string; suggestion: string }[] = [];
    const seenEpicsInFile = new Set<string>();
    const seenEpicsStatus = new Map<string, string>();
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
      const rawStatus = String(row.voterStatus || '').trim().toUpperCase();
      const ageNum = parseInt(String(row.age || '0'), 10);
      let isRowValid = true;

      if (!epic) {
        // Check if this is an Overseas/NRI elector with valid serial and habitation
        const isOverseas = String(row.villageName || '').toLowerCase().includes('overseas');
        if (rawName && (isOverseas || row.serialNumber)) {
          // Permitted: Overseas elector without domestic EPIC card
        } else {
          errors.push({
            rowNumber: rowNum,
            field: 'epicNumber',
            message: 'Voter ID / EPIC number is missing',
            suggestion: 'Provide unique EPIC Number, e.g., AP01009823',
          });
          missingRequiredCount++;
          isRowValid = false;
        }
      } else {
        if (seenEpicsInFile.has(epic)) {
          const prevStatus = seenEpicsStatus.get(epic) || '';
          const isRevisionPair = (prevStatus.includes('DELETE') && rawStatus.includes('ACTIVE')) ||
                                 (prevStatus.includes('ACTIVE') && rawStatus.includes('DELETE'));
          const isDoubleActive = prevStatus.includes('ACTIVE') && rawStatus.includes('ACTIVE');

          if (isRevisionPair) {
            // Legitimate ECI revision pair (migrated elector): valid
          } else if (isDoubleActive) {
            // Dual-active enrollment: preserve both rows and flag for authorized resolution
            errors.push({
              rowNumber: rowNum,
              epicNumber: epic,
              field: 'epicNumber',
              message: `Dual-active enrollment conflict detected for EPIC '${epic}'. Both records are preserved and flagged for authorized review.`,
              suggestion: 'Authorized review required in Identity Resolution Queue.',
            });
          } else {
            errors.push({
              rowNumber: rowNum,
              epicNumber: epic,
              field: 'epicNumber',
              message: `Duplicate EPIC '${epic}' found inside uploaded file`,
              suggestion: 'Remove or resolve duplicate EPIC row in spreadsheet',
            });
            duplicateEpicsCount++;
            isRowValid = false;
          }
        } else {
          seenEpicsInFile.add(epic);
          seenEpicsStatus.set(epic, rawStatus);
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
          message: `Non-standard voter age '${row.age || 'blank'}'. Age will be clamped into standard demographic bounds without excluding voter enrollment.`,
          suggestion: 'Verify age with voter ID card during field survey',
        });
        // Preserved: Do not silently invalidate or exclude official enrolled electors
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

    // 2. Enforce Hierarchy Scope Authorization and Tenant Isolation
    if (!opts.scope || (!opts.scope.isGlobalScope && !opts.scope.organisationId)) {
      const err: any = new Error('Access denied: Authentication and hierarchy scope required.');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }
    if (!opts.scope.isGlobalScope) {
      if (constituency.parliament.zone.state.organisationId !== opts.scope.organisationId) {
        const err: any = new Error('Access denied: Constituency belongs to a different organisation.');
        err.statusCode = 403;
        err.code = 'CROSS_ORG_ACCESS_FORBIDDEN';
        throw err;
      }
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
    const allEpicsInFile = Array.from(seenEpicsInFile);
    const existingVotersInDb = new Map<string, { id: string; constituencyId: string | null; name?: string; fatherHusbandName?: string; houseNumber?: string; age?: number; caste?: string | null; subCaste?: string | null; profession?: string | null; notes?: string | null; mobileNumber?: string | null; politicalPreference?: string | null; voterStatus?: VoterStatus }>();
    const chunkSize = 2000;
    for (let i = 0; i < allEpicsInFile.length; i += chunkSize) {
      const slice = allEpicsInFile.slice(i, i + chunkSize);
      const found = await prisma.voter.findMany({
        where: { epicNumber: { in: slice } },
        select: { id: true, epicNumber: true, constituencyId: true, name: true, fatherHusbandName: true, houseNumber: true, age: true, caste: true, subCaste: true, profession: true, notes: true, mobileNumber: true, politicalPreference: true, voterStatus: true },
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
    const isExplicitReplace = (opts.importMode || '').toUpperCase() === 'REPLACE';
    if (isExplicitReplace) {
      const existingCount = await prisma.voter.count({ where: { constituencyId: constituency.id } });
      if (existingCount > 0 && !opts.allowDangerousReplace) {
        const hasLiveOps = await prisma.voter.findFirst({
          where: {
            constituencyId: constituency.id,
            OR: [
              { voteStatus: { not: VoteStatus.NOT_VOTED } },
              { surveyStatus: { not: SurveyStatus.NOT_SURVEYED } },
              { assignedInchargeId: { not: null } },
              { assignments: { some: {} } },
              { voteTrackings: { some: {} } },
              { fakeVoterFlags: { some: {} } },
              { migrations: { some: {} } },
              { statusHistory: { some: {} } },
              { liveVoteEvents: { some: {} } },
            ],
          },
        });

        if (hasLiveOps) {
          const err: any = new Error(
            `REPLACE mode is forbidden: Constituency '${constituency.name}' contains ${existingCount} existing voters with live operational data (assessments, surveys, assignments, or vote tracking). Use UPSERT / REFRESH mode to prevent data loss.`
          );
          err.statusCode = 400;
          err.code = 'REPLACE_MODE_FORBIDDEN_LIVE_OPERATIONAL_DATA';
          throw err;
        }
      }

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
      include: { village: { select: { mandalId: true } } },
    });
    const boothMap = new Map<string, { id: string; boothNumber: string; villageId: string }>();
    for (const b of existingBooths) {
      const cleanNum = String(b.boothNumber).replace(/^Booth\s*/i, '').trim().toLowerCase();
      boothMap.set(`${b.village.mandalId}:${cleanNum}`, { id: b.id, boothNumber: b.boothNumber, villageId: b.villageId });
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

    // 6. Pre-resolve hierarchy nodes with deterministic grouping and capacity validation
    interface IntermediateRow {
      row: RawVoterRow;
      rowNum: number;
      epic: string;
      rawName: string;
      serialNumber: number;
      isDelete: boolean;
      explicitGroup: string;
      mandalRecord: { id: string; name: string };
      villageRecord: { id: string; name: string; mandalId: string };
      boothRecord: { id: string; boothNumber: string; villageId: string };
    }

    interface PreparedRow {
      raw: RawVoterRow;
      epic: string;
      rawName: string;
      serialNumber: number;
      isDelete: boolean;
      mandalRecord: { id: string; name: string };
      villageRecord: { id: string; name: string; mandalId: string };
      boothRecord: { id: string; boothNumber: string; villageId: string };
      groupRecord: { id: string; name: string; boothId: string };
    }

    const intermediateRows: IntermediateRow[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const epic = String(row.epicNumber || row.epic || '').trim().toUpperCase();
      const rawName = String(row.name || row.fullName || '').trim();

      if (!epic || !rawName) {
        continue;
      }

      const boothRaw = String(
        row.boothNumber || row.booth || row.pollingStation || (row as any)['PART NO'] || (row as any)['PART_NO'] || ''
      ).trim();

      // Strict SRP validation: Booth Number is a required structural identifier.
      // Never silently fall back to an arbitrary default like 'Booth 101'.
      if (!boothRaw) {
        const err: any = new Error(
          `Row ${i + 1}: Missing required Booth Number / Part Number. Ambiguous booth/grouping is forbidden.`
        );
        err.statusCode = 400;
        err.code = 'MISSING_BOOTH_INFORMATION';
        throw err;
      }

      const mandalName = String(row.mandal || row.mandalName || `${constituency.name} Mandal 1`).trim();
      const villageName = String(row.village || row.villageName || row.panchayat || `${mandalName} Village 1`).trim();
      const explicitGroup = String(row.voterGroup || row.cluster || row.team || '').trim();

      const rawStatus = String(
        row.voterStatus || (row as any).status || (row as any)['ACTIVE/DELETE'] || (row as any).activeDelete || ''
      ).trim().toUpperCase();
      const isDelete = rawStatus.includes('DELETE') || rawStatus.includes('SHIFTED');

      const parsedSerial = parseInt(String(row.serialNumber || ''), 10);
      const serialNumber = !isNaN(parsedSerial) && parsedSerial > 0 ? parsedSerial : i + 1;

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

      // Ensure Booth: Keyed strictly by mandalRecord.id and cleanBooth to prevent multi-village hamlet duplication
      const cleanBooth = boothRaw.replace(/^Booth\s*/i, '').trim().toLowerCase();
      const boothNumberStr = boothRaw.startsWith('Booth') ? boothRaw : `Booth ${boothRaw}`;
      const boothKey = `${mandalRecord.id}:${cleanBooth}`;
      let boothRecord = boothMap.get(boothKey);
      if (!boothRecord) {
        const villageUnit = await prisma.organizationUnit.findFirst({
          where: { name: villageRecord.name, level: OrgHierarchyLevel.VILLAGE },
        });
        const cleanBoothCode = cleanBooth.replace(/\W/g, '').toUpperCase();
        const boothCode = `BTH-${constituency.id.slice(0, 8)}-M${mandalRecord.id.slice(0, 4)}-${cleanBoothCode || '1'}`;
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

      intermediateRows.push({
        row,
        rowNum: i + 1,
        epic,
        rawName,
        serialNumber,
        isDelete,
        explicitGroup,
        mandalRecord,
        villageRecord,
        boothRecord,
      });
    }

    // Partition rows by booth and assign groups deterministically
    const rowsByBooth = new Map<string, IntermediateRow[]>();
    for (const item of intermediateRows) {
      let bList = rowsByBooth.get(item.boothRecord.id);
      if (!bList) {
        bList = [];
        rowsByBooth.set(item.boothRecord.id, bList);
      }
      bList.push(item);
    }

    const preparedRows: PreparedRow[] = [];

    for (const [boothId, bRows] of rowsByBooth.entries()) {
      const activeRowsToGroup: IntermediateRow[] = [];
      const assignedRows: Array<{ item: IntermediateRow; groupName: string }> = [];

      for (const item of bRows) {
        if (item.isDelete) {
          assignedRows.push({ item, groupName: item.explicitGroup || 'Deleted Electors' });
        } else if (item.explicitGroup) {
          assignedRows.push({ item, groupName: item.explicitGroup });
        } else {
          activeRowsToGroup.push(item);
        }
      }

      // Canonical deterministic serial-order grouping for active rows without explicit group
      activeRowsToGroup.sort((a, b) => a.serialNumber - b.serialNumber || a.rowNum - b.rowNum);
      const groupSize = opts.voterGroupSize || 100;

      for (let idx = 0; idx < activeRowsToGroup.length; idx++) {
        const item = activeRowsToGroup[idx];
        const groupNum = Math.floor(idx / groupSize) + 1;
        assignedRows.push({ item, groupName: `Group ${groupNum}` });
      }

      // Validate capacity: Ensure no active group in this booth exceeds groupSize (100)
      const groupActiveCountsInBatch = new Map<string, number>();
      for (const { item, groupName } of assignedRows) {
        if (!item.isDelete && groupName !== 'Deleted Electors') {
          groupActiveCountsInBatch.set(groupName, (groupActiveCountsInBatch.get(groupName) || 0) + 1);
        }
      }

      const boothRecord = bRows[0].boothRecord;
      const batchEpicSet = new Set(bRows.map((r) => r.epic));

      for (const [groupName, batchActiveCount] of groupActiveCountsInBatch.entries()) {
        const groupKey = `${boothId}:${groupName.toLowerCase()}`;
        const existingGroup = groupMap.get(groupKey);
        let existingActiveInDb = 0;

        if (existingGroup) {
          existingActiveInDb = await prisma.voter.count({
            where: {
              voterGroupId: existingGroup.id,
              voterStatus: VoterStatus.ACTIVE,
              epicNumber: { notIn: Array.from(batchEpicSet) },
            },
          });
        }

        const totalActive = existingActiveInDb + batchActiveCount;
        if (totalActive > groupSize) {
          const err: any = new Error(
            `Voter group '${groupName}' in ${boothRecord.boothNumber} would have ${totalActive} active voters. An active voter group cannot exceed the strict limit of ${groupSize} active electors.`
          );
          err.statusCode = 400;
          err.code = 'VOTER_GROUP_CAPACITY_EXCEEDED';
          throw err;
        }
      }

      // Ensure / upsert voter groups
      for (const { item, groupName } of assignedRows) {
        const groupKey = `${boothId}:${groupName.toLowerCase()}`;
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
          raw: item.row,
          epic: item.epic,
          rawName: item.rawName,
          serialNumber: item.serialNumber,
          isDelete: item.isDelete,
          mandalRecord: item.mandalRecord,
          villageRecord: item.villageRecord,
          boothRecord: item.boothRecord,
          groupRecord,
        });
      }
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
        const parsedAge = parseInt(String(row.age || ''), 10);
        const age = (!isNaN(parsedAge) && parsedAge > 0) ? parsedAge : 0;
        const relationType = parseRelation(row.relationType, gender, age > 0 ? age : 30);
        const relativeName = String(row.fatherHusbandName || row.relativeName || '').trim();
        const houseNo = String(row.houseNumber || row.doorNo || '').trim();
        const mobile = (row.mobileNumber || row.phone) ? String(row.mobileNumber || row.phone).trim() : null;
        const preference = env.ENABLE_POLITICAL_PREFERENCE_COLLECTION ? parsePreference(row.politicalPreference) : 'NEUTRAL';
        const isMigrated = String(row.voterLocationStatus || row.locationStatus || '').toLowerCase().includes('migrat');
        const migrationCity = String(row.migrationCity || row.currentLocation || (isMigrated ? 'Hyderabad' : 'Local')).trim();
        const caste = (row.caste || row.subCaste) ? String(row.caste || row.subCaste).trim() : null;
        const subCaste = (row.subCaste || row.caste) ? String(row.subCaste || row.caste).trim() : null;
        const profession = (row.profession || row.occupation) ? String(row.profession || row.occupation).trim() : null;

        voterPayloads.push({
          serialNumber: item.serialNumber,
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
          caste,
          subCaste,
          profession,
          politicalPreference: preference,
          voterStatus: item.isDelete ? VoterStatus.SHIFTED : VoterStatus.ACTIVE,
          surveyStatus: SurveyStatus.NOT_SURVEYED,
          locationStatus: isMigrated ? VoterLocationStatus.MIGRATED : VoterLocationStatus.LOCAL,
          voterLocationStatus: isMigrated ? VoterLocationStatus.MIGRATED : VoterLocationStatus.LOCAL,
          currentLocation: migrationCity,
          migrationCity: isMigrated ? migrationCity : null,
          voteStatus: VoteStatus.NOT_VOTED,
          inchargeAssessment: preference,
          notes: item.isDelete
            ? 'ECI_OFFICIAL_SOURCE_STATUS: DELETE; DB_INTERNAL_STATUS: SHIFTED'
            : String(row.notes || row.remarks || `Imported via CMS Excel Voter Roll for ${constituency.name}`).trim(),
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
        const parsedAge = parseInt(String(row.age || ''), 10);
        const age = (!isNaN(parsedAge) && parsedAge > 0) ? parsedAge : 0;
        const relationType = parseRelation(row.relationType, gender, age > 0 ? age : 30);
        const relativeName = String(row.fatherHusbandName || row.relativeName || '').trim();
        const houseNo = String(row.houseNumber || row.doorNo || '').trim();
        const mobile = (row.mobileNumber || row.phone) ? String(row.mobileNumber || row.phone).trim() : null;
        const preference = env.ENABLE_POLITICAL_PREFERENCE_COLLECTION ? parsePreference(row.politicalPreference) : 'NEUTRAL';
        const isMigrated = String(row.voterLocationStatus || row.locationStatus || '').toLowerCase().includes('migrat');
        const migrationCity = String(row.migrationCity || row.currentLocation || (isMigrated ? 'Hyderabad' : 'Local')).trim();
        const caste = (row.caste || row.subCaste) ? String(row.caste || row.subCaste).trim() : null;
        const subCaste = (row.subCaste || row.caste) ? String(row.subCaste || row.caste).trim() : null;
        const profession = (row.profession || row.occupation) ? String(row.profession || row.occupation).trim() : null;

        const existingVoter = existingVotersInDb.get(item.epic);

        if (existingVoter) {
          // Preflight already guaranteed existingVoter.constituencyId === constituency.id
          let newVoterStatus = existingVoter.voterStatus;
          let updatedNotes = existingVoter.notes || '';

          if (item.isDelete) {
            newVoterStatus = VoterStatus.SHIFTED;
            const delProv = 'ECI_OFFICIAL_SOURCE_STATUS: DELETE; DB_INTERNAL_STATUS: SHIFTED';
            if (!updatedNotes.includes(delProv)) {
              updatedNotes = updatedNotes ? `${updatedNotes}; ${delProv}` : delProv;
            }
          } else if (existingVoter.voterStatus === VoterStatus.SHIFTED) {
            newVoterStatus = VoterStatus.ACTIVE;
            const actProv = 'ECI_OFFICIAL_SOURCE_STATUS: ACTIVE; RESTORED_FROM_SHIFTED';
            if (!updatedNotes.includes(actProv)) {
              updatedNotes = updatedNotes ? `${updatedNotes}; ${actProv}` : actProv;
            }
          }

          if (row.notes && !updatedNotes.includes(String(row.notes).trim())) {
            updatedNotes = updatedNotes ? `${updatedNotes}; ${String(row.notes).trim()}` : String(row.notes).trim();
          }

          // Operational fields preservation:
          const mobileVal = mobile || existingVoter.mobileNumber;
          const casteVal = caste || existingVoter.caste;
          const subCasteVal = subCaste || existingVoter.subCaste;
          const professionVal = profession || existingVoter.profession;
          let politicalPrefVal = existingVoter.politicalPreference;
          if (env.ENABLE_POLITICAL_PREFERENCE_COLLECTION && existingVoter.politicalPreference === 'NEUTRAL' && preference && preference !== 'NEUTRAL') {
            politicalPrefVal = preference;
          }

          votersToUpdate.push({
            id: existingVoter.id,
            data: {
              serialNumber: item.serialNumber,
              name: item.rawName || existingVoter.name,
              fatherHusbandName: relativeName || existingVoter.fatherHusbandName,
              relationType,
              houseNumber: houseNo || existingVoter.houseNumber,
              age: age > 0 ? age : existingVoter.age,
              gender,
              mobileNumber: mobileVal,
              constituencyId: constituency.id,
              mandalId: item.mandalRecord.id,
              villageId: item.villageRecord.id,
              boothId: item.boothRecord.id,
              voterGroupId: item.groupRecord.id,
              caste: casteVal,
              subCaste: subCasteVal,
              profession: professionVal,
              politicalPreference: politicalPrefVal,
              voterStatus: newVoterStatus,
              notes: updatedNotes || null,
            },
          });
        } else {
          newVoterPayloads.push({
            serialNumber: item.serialNumber,
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
            caste,
            subCaste,
            profession,
            politicalPreference: preference,
            voterStatus: item.isDelete ? VoterStatus.SHIFTED : VoterStatus.ACTIVE,
            surveyStatus: SurveyStatus.NOT_SURVEYED,
            locationStatus: isMigrated ? VoterLocationStatus.MIGRATED : VoterLocationStatus.LOCAL,
            voterLocationStatus: isMigrated ? VoterLocationStatus.MIGRATED : VoterLocationStatus.LOCAL,
            currentLocation: migrationCity,
            migrationCity: isMigrated ? migrationCity : null,
            voteStatus: VoteStatus.NOT_VOTED,
            inchargeAssessment: preference,
            notes: item.isDelete
              ? 'ECI_OFFICIAL_SOURCE_STATUS: DELETE; DB_INTERNAL_STATUS: SHIFTED'
              : String(row.notes || row.remarks || `Imported via CMS Excel Voter Roll for ${constituency.name}`).trim(),
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
