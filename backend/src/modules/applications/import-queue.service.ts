import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { FastifyRequest, FastifyReply } from 'fastify';
import csv from 'csv-parser';
import {
  AuditAction,
  Gender,
  ImportJobStatus,
  Prisma,
  RelationType,
  RoleType,
} from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { logAudit } from '../../middleware/audit.js';
import { getConstituencyLockKey } from '../../common/lock.js';
import { emitHierarchyEvent } from '../../lib/socket.js';
import { errorResponse, successResponse } from '../../common/response.js';
import { ApplicationsService } from './applications.service.js';

const BATCH_SIZE = 500;
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB max for bulk CSV file
const TEMP_DIR = path.join(os.tmpdir(), 'viap-imports');
const WORKER_NODE_ID = process.env.RENDER_INSTANCE_ID || process.env.INSTANCE_ID || crypto.randomUUID();

let isWorkerBusy = false;
let workerIntervalTimer: NodeJS.Timeout | null = null;
let isShuttingDown = false;

function ensureTempDir(): void {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
}

function parseGender(val?: string): Gender {
  const g = (val || '').trim().toUpperCase();
  if (g.startsWith('F') || g === 'FEMALE') return Gender.FEMALE;
  if (g.startsWith('M') || g === 'MALE') return Gender.MALE;
  return Gender.OTHER;
}

function parseRelation(val?: string): RelationType {
  const r = (val || '').trim().toUpperCase();
  if (r.includes('HUSBAND') || r === 'H') return RelationType.HUSBAND;
  if (r.includes('MOTHER') || r === 'M') return RelationType.MOTHER;
  return RelationType.FATHER;
}

export class ImportQueueService {
  /**
   * Initialize in-process queue worker and recover any stale jobs from prior crashes
   */
  static init(): void {
    ensureTempDir();
    this.recoverStaleJobsOnStartup().catch((err) => {
      console.warn('⚠️ [ImportQueue] Startup recovery notice:', err?.message || err);
    });

    if (!workerIntervalTimer) {
      workerIntervalTimer = setInterval(() => {
        if (!isShuttingDown && !isWorkerBusy) {
          ImportQueueService.processNextQueuedJob().catch((err) => {
            console.error('❌ [ImportQueue] Uncaught worker cycle error:', err);
          });
        }
      }, 3000);
    }
  }

  static stop(): void {
    isShuttingDown = true;
    if (workerIntervalTimer) {
      clearInterval(workerIntervalTimer);
      workerIntervalTimer = null;
    }
  }

  /**
   * On startup, inspect jobs that were left in 'PROCESSING' state when the container died
   */
  static async recoverStaleJobsOnStartup(): Promise<void> {
    try {
      const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);
      const interruptedJobs = await prisma.dataImport.findMany({
        where: {
          status: 'PROCESSING',
          OR: [
            { updatedAt: { lt: staleThreshold } },
            { metadata: { path: ['workerNodeId'], equals: WORKER_NODE_ID } },
          ],
        },
      });

      for (const job of interruptedJobs) {
        const meta = (job.metadata as Record<string, any>) || {};
        const filePath = meta.tempFilePath as string | undefined;

        // If another worker node is actively processing this job with fresh heartbeat, DO NOT touch it!
        if (job.updatedAt && job.updatedAt > staleThreshold && meta.workerNodeId !== WORKER_NODE_ID) {
          continue;
        }

        if (!filePath || !fs.existsSync(filePath)) {
          // File was in ephemeral /tmp and was wiped by container restart
          await prisma.dataImport.update({
            where: { id: job.id },
            data: {
              status: 'FAILED',
              completedAt: new Date(),
              metadata: {
                ...meta,
                failureReason:
                  'SOURCE_FILE_LOST_REUPLOAD_REQUIRED: The server restarted and ephemeral storage was reset. Please re-upload your CSV file.',
              },
            },
          });

          await prisma.importJob.updateMany({
            where: { id: job.id },
            data: {
              status: ImportJobStatus.FAILED,
              completedAt: new Date(),
              errors: [
                {
                  code: 'SOURCE_FILE_LOST_REUPLOAD_REQUIRED',
                  message: 'The server restarted and ephemeral storage was reset. Please re-upload your CSV file.',
                },
              ] as unknown as Prisma.InputJsonValue,
            },
          });
        } else {
          // File is still on disk; reset to QUEUED so worker can pick it up safely
          await prisma.dataImport.update({
            where: { id: job.id },
            data: { status: 'QUEUED', startedAt: null },
          });
        }
      }
    } catch (err: any) {
      console.warn('⚠️ [ImportQueue] Stale job inspection notice:', err?.message);
    }
  }

  /**
   * Streaming upload handler: pipes incoming multipart stream directly to disk in /tmp
   */
  static async handleStreamingUpload(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { applicationId } = req.params as { applicationId: string };
    const actor = req.user;

    if (!actor || !actor.userId) {
      return reply.status(401).send(
        errorResponse('Valid authenticated user identity is required to perform data import.', 'UNAUTHORIZED')
      );
    }

    const config = await ApplicationsService.resolveApplication(applicationId);
    ensureTempDir();

    let part: any;
    try {
      part = await req.file();
    } catch (err: any) {
      return reply.status(400).send(errorResponse(err.message || 'Failed to read multipart stream', 'BAD_REQUEST'));
    }

    if (!part) {
      return reply.status(400).send(
        errorResponse('No CSV file detected in multipart form upload.', 'NO_FILE_UPLOADED')
      );
    }

    // Extract non-file fields sent with the multipart form
    const fields = part.fields as Record<string, any>;
    const targetConstituencyId = fields?.targetConstituencyId?.value as string | undefined;
    const importMode = (fields?.importMode?.value as string | undefined) || 'APPEND';
    const rawMapping = fields?.columnMapping?.value as string | undefined;
    let columnMapping: Record<string, string> | undefined;
    if (rawMapping) {
      try {
        columnMapping = JSON.parse(rawMapping);
      } catch {}
    }
    const voterGroupSize = parseInt(fields?.voterGroupSize?.value || '100', 10);

    // 1. Strict REPLACE Mode Prohibition in Bulk Imports (Section 2.C invariant)
    if (importMode === 'REPLACE') {
      part.file.resume(); // Discard stream
      return reply.status(400).send(
        errorResponse(
          'Bulk REPLACE mode is disabled to protect historical voting records, live vote events, and field in-charge assignments. Please use APPEND mode, which safely updates existing voters in-place and inserts new voters.',
          'BULK_REPLACE_DISABLED'
        )
      );
    }

    // 2. Resolve Target Constituency & Validate Hierarchy Scope
    let constituency: any;
    try {
      constituency = await ApplicationsService.resolveConstituencyForApp(config, targetConstituencyId);
    } catch (err: any) {
      part.file.resume();
      return reply.status(err.statusCode || 400).send(errorResponse(err.message, err.code || 'BAD_REQUEST'));
    }

    const scope = req.hierarchyScope;
    if (scope && !scope.isGlobalScope) {
      if (!scope.accessibleConstituencyIds.has(constituency.id)) {
        part.file.resume();
        return reply.status(403).send(
          errorResponse(`Access denied: You do not have authority over constituency '${constituency.name}'.`, 'FORBIDDEN_SCOPE')
        );
      }
    }

    // 3. File Extension & MIME Type Check
    const originalFilename = part.filename || 'voter_data.csv';
    const isCsv = originalFilename.toLowerCase().endsWith('.csv') || part.mimetype?.includes('csv') || part.mimetype === 'text/plain';
    if (!isCsv) {
      part.file.resume();
      return reply.status(400).send(
        errorResponse(
          'Unsupported file type for streaming import. Only standard CSV files (.csv) are supported for large-scale streaming.',
          'INVALID_FILE_TYPE'
        )
      );
    }

    // 4. Stream to unique temp file while computing SHA-256 hash
    const importJobId = crypto.randomUUID();
    const tempFilePath = path.join(TEMP_DIR, `import-${importJobId}.csv`);
    const writeStream = fs.createWriteStream(tempFilePath);
    const hash = crypto.createHash('sha256');

    let bytesWritten = 0;
    try {
      for await (const chunk of part.file) {
        bytesWritten += chunk.length;
        if (bytesWritten > MAX_UPLOAD_BYTES) {
          writeStream.destroy();
          await fs.promises.unlink(tempFilePath).catch(() => {});
          return reply.status(413).send(
            errorResponse(`Upload exceeds maximum permitted limit of ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB.`, 'PAYLOAD_TOO_LARGE')
          );
        }
        writeStream.write(chunk);
        hash.update(chunk);
      }
      writeStream.end();
      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', () => resolve());
        writeStream.on('error', (err) => reject(err));
      });
    } catch (err: any) {
      await fs.promises.unlink(tempFilePath).catch(() => {});
      return reply.status(500).send(errorResponse(`Streaming upload failed: ${err.message}`, 'UPLOAD_STREAM_ERROR'));
    }

    const sha256 = hash.digest('hex');
    const idempotencyKey = crypto.createHash('sha256').update(`${constituency.id}:${sha256}`).digest('hex');

    // 5. Rapid CSV Header Pre-validation: ensure essential columns exist
    let headerValidated = false;
    let headerColumns: string[] = [];
    try {
      const headerStream = fs.createReadStream(tempFilePath, { highWaterMark: 4096 });
      const parser = headerStream.pipe(csv());
      for await (const row of parser) {
        headerColumns = Object.keys(row).map((k) => k.trim());
        headerValidated = true;
        headerStream.destroy();
        break;
      }
    } catch {}

    if (!headerValidated || headerColumns.length === 0) {
      await fs.promises.unlink(tempFilePath).catch(() => {});
      return reply.status(400).send(
        errorResponse('Malformed or empty CSV file. Could not read header row.', 'MALFORMED_CSV')
      );
    }

    // 6. Concurrency-Safe Idempotency Guard & Database Persistence
    let dataImport: any;
    let existingDuplicate: any = null;

    await prisma.$transaction(async (tx) => {
      // Serialize concurrent uploads for this constituency using PostgreSQL advisory lock
      const lockKey = getConstituencyLockKey(constituency.id);
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`;

      existingDuplicate = await tx.dataImport.findFirst({
        where: {
          targetConstituencyId: constituency.id,
          status: { in: ['QUEUED', 'PROCESSING'] },
          metadata: { path: ['idempotencyKey'], equals: idempotencyKey },
        },
      });

      if (existingDuplicate) {
        return;
      }

      dataImport = await tx.dataImport.create({
        data: {
          id: importJobId,
          applicationId: config.id,
          uploadedById: actor.userId,
          fileName: originalFilename,
          fileSize: bytesWritten,
          targetHierarchyId: constituency.parliamentId,
          targetConstituencyId: constituency.id,
          mode: 'APPEND',
          status: 'QUEUED',
          metadata: {
            workerNodeId: WORKER_NODE_ID,
            tempFilePath,
            idempotencyKey,
            sha256,
            headerColumns,
            columnMapping: columnMapping || null,
            voterGroupSize,
            uploadedAt: new Date().toISOString(),
            attemptCount: 0,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      await tx.importJob.create({
        data: {
          id: importJobId,
          fileName: originalFilename,
          status: ImportJobStatus.PENDING,
          totalRows: 0,
          createdById: actor.userId,
          payload: {
            dataImportId: importJobId,
            applicationId: config.id,
            targetConstituencyId: constituency.id,
            mode: 'APPEND',
          } as unknown as Prisma.InputJsonValue,
        },
      });

      if (columnMapping) {
        for (const [excelCol, sysField] of Object.entries(columnMapping)) {
          await tx.dataImportMapping.create({
            data: {
              importId: importJobId,
              excelColumn: excelCol,
              systemField: sysField,
            },
          }).catch(() => {});
        }
      }
    });

    if (existingDuplicate) {
      await fs.promises.unlink(tempFilePath).catch(() => {});
      return reply.status(200).send(
        successResponse(
          { jobId: existingDuplicate.id, status: existingDuplicate.status, isDuplicate: true },
          'An identical import job for this constituency is already queued or processing.'
        )
      );
    }

    // Trigger in-process queue runner immediately
    setImmediate(() => {
      ImportQueueService.processNextQueuedJob().catch(() => {});
    });

    return reply.status(202).send(
      successResponse(
        {
          jobId: dataImport.id,
          status: 'QUEUED',
          fileName: originalFilename,
          fileSize: bytesWritten,
          constituencyName: constituency.name,
        },
        'Voter roll CSV accepted and queued for asynchronous ingestion.'
      )
    );
  }

  /**
   * Single-instance concurrency-safe worker claiming and processing one queued import
   */
  static async processNextQueuedJob(): Promise<void> {
    if (isWorkerBusy || isShuttingDown) return;
    isWorkerBusy = true;

    let activeJobId: string | null = null;
    let tempFilePath: string | null = null;

    try {
      // 1. Atomically claim oldest QUEUED job belonging to this node (or unassigned)
      let candidate: any = null;
      try {
        const [claimed] = await prisma.$queryRaw<Array<{ id: string }>>`
          UPDATE "DataImport"
          SET "status" = 'PROCESSING', "startedAt" = NOW()
          WHERE id = (
            SELECT id FROM "DataImport"
            WHERE "status" = 'QUEUED'
              AND ("metadata"->>'workerNodeId' = ${WORKER_NODE_ID} OR "metadata"->>'workerNodeId' IS NULL)
            ORDER BY "createdAt" ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
          )
          RETURNING id
        `;
        if (claimed && claimed.id) {
          candidate = await prisma.dataImport.findUnique({ where: { id: claimed.id } });
        }
      } catch (rawErr) {
        // Fallback to updateMany claim if raw query is not supported in current environment
        const queuedCandidate = await prisma.dataImport.findFirst({
          where: {
            status: 'QUEUED',
            metadata: { path: ['workerNodeId'], equals: WORKER_NODE_ID },
          },
          orderBy: { createdAt: 'asc' },
        });
        if (queuedCandidate) {
          const res = await prisma.dataImport.updateMany({
            where: { id: queuedCandidate.id, status: 'QUEUED' },
            data: { status: 'PROCESSING', startedAt: new Date() },
          });
          if (res.count > 0) {
            candidate = queuedCandidate;
          }
        }
      }

      if (!candidate) {
        isWorkerBusy = false;
        return;
      }

      activeJobId = candidate.id;
      const meta = (candidate.metadata as Record<string, any>) || {};
      tempFilePath = meta.tempFilePath as string | null;

      await prisma.importJob.updateMany({
        where: { id: candidate.id },
        data: { status: ImportJobStatus.PROCESSING, startedAt: new Date() },
      });

      // 2. Ephemeral Storage Check: ensure file still exists on disk
      if (!tempFilePath || !fs.existsSync(tempFilePath)) {
        await prisma.dataImport.update({
          where: { id: candidate.id },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            metadata: {
              ...meta,
              failureReason:
                'SOURCE_FILE_LOST_REUPLOAD_REQUIRED: The server restarted or ephemeral disk was reset. Please re-upload.',
            },
          },
        });
        await prisma.importJob.updateMany({
          where: { id: candidate.id },
          data: {
            status: ImportJobStatus.FAILED,
            completedAt: new Date(),
            errors: [{ code: 'SOURCE_FILE_LOST_REUPLOAD_REQUIRED', message: 'Temporary file lost on server restart.' }] as unknown as Prisma.InputJsonValue,
          },
        });
        isWorkerBusy = false;
        return;
      }

      // 3. Revalidate Actor Identity, Active Account Status & Role
      const actorId = candidate.uploadedById;
      if (!actorId) {
        throw new Error('Import rejected: Missing authoritative actor identity.');
      }
      const user = await prisma.user.findUnique({
        where: { id: actorId },
        select: { id: true, role: true, accountStatus: true },
      });
      if (!user || user.accountStatus !== 'ACTIVE') {
        throw new Error('Import rejected: Initiating actor account is no longer active.');
      }
      const ALLOWED_IMPORT_ROLES: RoleType[] = [
        RoleType.SUPER_ADMIN,
        RoleType.HIGH_COMMAND,
        RoleType.STATE_ADMIN,
        RoleType.CONSTITUENCY_INCHARGE,
      ];
      if (!ALLOWED_IMPORT_ROLES.includes(user.role)) {
        throw new Error(`Import rejected: User role '${user.role}' is not authorized to import voter data.`);
      }

      const constituencyId = candidate.targetConstituencyId;
      if (!constituencyId) {
        throw new Error('Import rejected: Target constituency is missing.');
      }
      const constituency = await prisma.constituency.findUnique({
        where: { id: constituencyId },
        include: { parliament: { include: { zone: { include: { state: true } } } } },
      });
      if (!constituency) {
        throw new Error(`Target constituency '${constituencyId}' no longer exists.`);
      }

      const resolvedParliamentId = constituency.parliamentId || constituency.parliament?.id || null;
      const resolvedZoneId = constituency.parliament?.zoneId || constituency.parliament?.zone?.id || null;
      const resolvedStateId = constituency.parliament?.zone?.stateId || constituency.parliament?.zone?.state?.id || null;

      // 4. Pre-load hierarchy caches scoped to target constituency
      const existingMandals = await prisma.mandal.findMany({ where: { constituencyId: constituency.id } });
      const mandalMap = new Map<string, string>(existingMandals.map((m) => [m.name.trim().toLowerCase(), m.id]));

      const existingVillages = await prisma.village.findMany({
        where: { mandal: { constituencyId: constituency.id } },
      });
      const villageMap = new Map<string, string>(
        existingVillages.map((v) => [`${v.mandalId}:${v.name.trim().toLowerCase()}`, v.id]),
      );

      const existingBooths = await prisma.booth.findMany({
        where: { village: { mandal: { constituencyId: constituency.id } } },
      });
      const boothMap = new Map<string, string>(
        existingBooths.map((b) => [`${b.villageId}:${String(b.boothNumber).trim().toLowerCase()}`, b.id]),
      );

      const existingGroups = await prisma.voterGroup.findMany({
        where: { booth: { village: { mandal: { constituencyId: constituency.id } } } },
      });
      const groupMap = new Map<string, string>(
        existingGroups.map((g) => [`${g.boothId}:${g.name.trim().toLowerCase()}`, g.id]),
      );

      const mapping = meta.columnMapping as Record<string, string> | undefined;
      const getVal = (row: any, key: string): string => {
        if (mapping && mapping[key] && row[mapping[key]] !== undefined) {
          return String(row[mapping[key]] ?? '').trim();
        }
        return String(row[key] ?? row[key.toLowerCase()] ?? '').trim();
      };

      // 5. Stream CSV file in bounded chunks of BATCH_SIZE (500 rows)
      let totalRowsRead = 0;
      let totalImported = 0;
      let totalUpdated = 0;
      let totalSkipped = 0;
      let totalErrors = 0;
      let batchBuffer: any[] = [];
      const errorRecords: Array<{ rowNumber: number; field: string; value?: string; errorMessage: string }> = [];

      const stream = fs.createReadStream(tempFilePath).pipe(csv());

      for await (const rawRow of stream) {
        if (isShuttingDown) {
          throw new Error('Worker received shutdown signal. Aborting gracefully.');
        }

        totalRowsRead++;
        batchBuffer.push(rawRow);

        if (batchBuffer.length >= BATCH_SIZE) {
          const result = await ImportQueueService.processBatch(
            batchBuffer,
            totalRowsRead - batchBuffer.length + 1,
            constituency,
            resolvedStateId,
            resolvedZoneId,
            resolvedParliamentId,
            actorId,
            mandalMap,
            villageMap,
            boothMap,
            groupMap,
            getVal,
            candidate.id
          );

          totalImported += result.imported;
          totalUpdated += result.updated;
          totalSkipped += result.skipped;
          totalErrors += result.errors.length;
          errorRecords.push(...result.errors.slice(0, 50));
          batchBuffer = [];

          // Update progress in database incrementally
          await prisma.dataImport.update({
            where: { id: candidate.id },
            data: {
              validRecords: totalImported + totalUpdated,
              importedRecords: totalImported,
              updatedRecords: totalUpdated,
              failedRecords: totalErrors,
              totalRecords: totalRowsRead,
            },
          });

          // Emit live progress over Socket.IO
          emitHierarchyEvent(constituency.id, 'import:progress', {
            jobId: candidate.id,
            totalRowsRead,
            imported: totalImported,
            updated: totalUpdated,
            errors: totalErrors,
            constituencyId: constituency.id,
          }).catch(() => {});

          // Yield execution to event loop so HTTP requests and health checks stay fast
          await new Promise((resolve) => setImmediate(resolve));
        }
      }

      // Process any trailing rows in the final batch
      if (batchBuffer.length > 0) {
        const result = await ImportQueueService.processBatch(
          batchBuffer,
          totalRowsRead - batchBuffer.length + 1,
          constituency,
          resolvedStateId,
          resolvedZoneId,
          resolvedParliamentId,
          actorId,
          mandalMap,
          villageMap,
          boothMap,
          groupMap,
          getVal,
          candidate.id
        );

        totalImported += result.imported;
        totalUpdated += result.updated;
        totalSkipped += result.skipped;
        totalErrors += result.errors.length;
        errorRecords.push(...result.errors.slice(0, 50));
        batchBuffer = [];
      }

      // Update total constituency voter count
      const totalVotersInAC = await prisma.voter.count({
        where: { constituencyId: constituency.id },
      });
      await prisma.constituency.update({
        where: { id: constituency.id },
        data: { totalVoters: totalVotersInAC },
      });

      // Record error entries in database if any
      if (errorRecords.length > 0) {
        for (const err of errorRecords.slice(0, 500)) {
          await prisma.dataImportError.create({
            data: {
              importId: candidate.id,
              rowNumber: err.rowNumber,
              field: err.field,
              value: err.value ? String(err.value).slice(0, 255) : null,
              errorMessage: err.errorMessage.slice(0, 500),
              severity: 'ERROR',
            },
          }).catch(() => {});
        }
      }

      const finalStatus =
        totalErrors === 0 && (totalImported > 0 || totalUpdated > 0)
          ? 'SUCCESS'
          : totalImported > 0 || totalUpdated > 0
          ? 'PARTIAL_SUCCESS'
          : 'FAILED';

      await prisma.dataImport.update({
        where: { id: candidate.id },
        data: {
          status: finalStatus,
          totalRecords: totalRowsRead,
          validRecords: totalImported + totalUpdated,
          importedRecords: totalImported,
          updatedRecords: totalUpdated,
          skippedRecords: totalSkipped,
          failedRecords: totalErrors,
          completedAt: new Date(),
        },
      });

      await prisma.importJob.updateMany({
        where: { id: candidate.id },
        data: {
          status: finalStatus === 'SUCCESS' ? ImportJobStatus.COMPLETED : ImportJobStatus.FAILED,
          totalRows: totalRowsRead,
          successCount: totalImported + totalUpdated,
          errorCount: totalErrors,
          completedAt: new Date(),
          errors: errorRecords.slice(0, 100) as unknown as Prisma.InputJsonValue,
        },
      });

      await logAudit({
        action: AuditAction.BULK_IMPORT,
        entityType: 'DataImport',
        entityId: candidate.id,
        userId: actorId,
        changes: {
          applicationId: candidate.applicationId,
          targetConstituencyId: constituency.id,
          totalRowsRead,
          imported: totalImported,
          updated: totalUpdated,
          status: finalStatus,
        } as unknown as Prisma.InputJsonValue,
      });

      // Safely delete temporary file after completion
      await fs.promises.unlink(tempFilePath).catch(() => {});
    } catch (err: any) {
      console.error('❌ [ImportQueue] Worker batch failure:', err?.message || err);
      if (activeJobId) {
        await prisma.dataImport.updateMany({
          where: { id: activeJobId },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            metadata: {
              failureReason: err?.message || 'Processing aborted due to unexpected error',
            },
          },
        }).catch(() => {});
      }
      if (tempFilePath) {
        await fs.promises.unlink(tempFilePath).catch(() => {});
      }
    } finally {
      isWorkerBusy = false;
    }
  }

  /**
   * Process a single 500-row batch inside a discrete, bounded database transaction
   */
  private static async processBatch(
    rows: any[],
    startRowIndex: number,
    constituency: any,
    resolvedStateId: string | null,
    resolvedZoneId: string | null,
    resolvedParliamentId: string | null,
    actorId: string,
    mandalMap: Map<string, string>,
    villageMap: Map<string, string>,
    boothMap: Map<string, string>,
    groupMap: Map<string, string>,
    getVal: (row: any, key: string) => string,
    dataImportId: string
  ): Promise<{
    imported: number;
    updated: number;
    skipped: number;
    errors: Array<{ rowNumber: number; field: string; value?: string; errorMessage: string }>;
  }> {
    const errors: Array<{ rowNumber: number; field: string; value?: string; errorMessage: string }> = [];
    const validBatchItems: any[] = [];
    let skipped = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = startRowIndex + i;

      const epic = getVal(row, 'epicNumber') || getVal(row, 'epic') || getVal(row, 'voterId');
      const name = getVal(row, 'fullName') || getVal(row, 'name');

      if (!epic || !name) {
        skipped++;
        errors.push({
          rowNumber: rowNum,
          field: !epic ? 'epicNumber' : 'name',
          value: !epic ? 'empty' : 'empty',
          errorMessage: 'Missing required EPIC Number or Voter Full Name',
        });
        continue;
      }

      validBatchItems.push({
        rowNum,
        epic: epic.trim().toUpperCase(),
        name: name.trim(),
        relativeName: getVal(row, 'relativeName') || getVal(row, 'fatherHusbandName') || 'Relative',
        relation: parseRelation(getVal(row, 'relationType')),
        age: Math.min(125, Math.max(18, parseInt(getVal(row, 'age') || '30', 10) || 30)),
        gender: parseGender(getVal(row, 'gender')),
        houseNumber: getVal(row, 'houseNumber') || getVal(row, 'doorNo') || '1-1',
        mobileNumber: getVal(row, 'mobileNumber') || getVal(row, 'phone') || null,
        caste: getVal(row, 'caste') || null,
        profession: getVal(row, 'profession') || null,
        politicalPreference: getVal(row, 'politicalPreference') || 'NEUTRAL',
        mandalName: getVal(row, 'mandal') || getVal(row, 'mandalName') || `${constituency.name} Mandal`,
        villageName: getVal(row, 'village') || getVal(row, 'villageName') || 'Central Village',
        boothRaw: getVal(row, 'boothNumber') || getVal(row, 'booth') || '101',
        groupRaw: getVal(row, 'voterGroup') || 'General Group',
      });
    }

    if (validBatchItems.length === 0) {
      return { imported: 0, updated: 0, skipped, errors };
    }

    // Pre-fetch existing voters matching EPICs in this batch
    const epics = validBatchItems.map((item) => item.epic);
    const existingMatches = await prisma.voter.findMany({
      where: { epicNumber: { in: epics } },
      select: { id: true, epicNumber: true, constituencyId: true },
    });
    const existingByEpic = new Map(existingMatches.map((v) => [v.epicNumber, v]));

    // Check cross-constituency EPIC conflicts (Section 2.C invariant)
    const filteredItems: any[] = [];
    for (const item of validBatchItems) {
      const match = existingByEpic.get(item.epic);
      if (match && match.constituencyId && match.constituencyId !== constituency.id) {
        skipped++;
        errors.push({
          rowNumber: item.rowNum,
          field: 'epicNumber',
          value: item.epic,
          errorMessage: 'Cross-constituency conflict: EPIC already belongs to a different constituency.',
        });
      } else {
        filteredItems.push(item);
      }
    }

    let batchImported = 0;
    let batchUpdated = 0;

    // Execute batch writes within a bounded transaction (<1.5 seconds)
    await prisma.$transaction(
      async (tx) => {
        // Enforce advisory lock during write batch
        const lockKey = getConstituencyLockKey(constituency.id);
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`;

        for (const item of filteredItems) {
          // Resolve Mandal
          let mandalId = mandalMap.get(item.mandalName.toLowerCase());
          if (!mandalId) {
            const mandalCode = `MDL-${constituency.id.slice(0, 8)}-${item.mandalName.replace(/\W/g, '').toUpperCase().slice(0, 8)}`;
            const m = await tx.mandal.upsert({
              where: { code: mandalCode },
              update: { name: item.mandalName },
              create: {
                constituencyId: constituency.id,
                name: item.mandalName,
                code: mandalCode,
                totalVoters: 25000,
              },
            });
            mandalId = m.id;
            mandalMap.set(item.mandalName.toLowerCase(), mandalId);
          }

          // Resolve Village
          const vKey = `${mandalId}:${item.villageName.toLowerCase()}`;
          let villageId = villageMap.get(vKey);
          if (!villageId) {
            const villageCode = `VIL-${mandalId.slice(0, 8)}-${item.villageName.replace(/\W/g, '').toUpperCase().slice(0, 8)}`;
            const v = await tx.village.upsert({
              where: { code: villageCode },
              update: { name: item.villageName },
              create: {
                mandalId,
                name: item.villageName,
                code: villageCode,
                totalVoters: 3000,
              },
            });
            villageId = v.id;
            villageMap.set(vKey, villageId);
          }

          // Resolve Booth
          const bKey = `${villageId}:${item.boothRaw.toLowerCase()}`;
          let boothId = boothMap.get(bKey);
          if (!boothId) {
            const boothCode = `BTH-${villageId.slice(0, 8)}-${item.boothRaw.replace(/\W/g, '').toUpperCase().slice(0, 8)}`;
            const b = await tx.booth.upsert({
              where: { code: boothCode },
              update: { boothNumber: item.boothRaw },
              create: {
                villageId,
                boothNumber: item.boothRaw,
                code: boothCode,
                name: `Booth ${item.boothRaw}`,
                totalVoters: 1000,
              },
            });
            boothId = b.id;
            boothMap.set(bKey, boothId);
          }

          // Resolve Voter Group
          const gKey = `${boothId}:${item.groupRaw.toLowerCase()}`;
          let groupId = groupMap.get(gKey);
          if (!groupId) {
            const groupCode = `VG-${boothId.slice(0, 8)}-${item.groupRaw.replace(/\W/g, '').toUpperCase().slice(0, 8)}`;
            const g = await tx.voterGroup.upsert({
              where: { code: groupCode },
              update: { name: item.groupRaw },
              create: {
                boothId,
                name: item.groupRaw,
                code: groupCode,
                totalVoters: 100,
              },
            });
            groupId = g.id;
            groupMap.set(gKey, groupId);
          }

          const existingMatch = existingByEpic.get(item.epic);

          if (existingMatch) {
            // In-place update preserving voter primary key and existing foreign-key relations
            await tx.voter.update({
              where: { id: existingMatch.id },
              data: {
                name: item.name,
                fatherHusbandName: item.relativeName,
                relationType: item.relation,
                age: item.age,
                gender: item.gender,
                mobileNumber: item.mobileNumber,
                houseNumber: item.houseNumber,
                caste: item.caste,
                profession: item.profession,
                politicalPreference: item.politicalPreference,
                stateId: resolvedStateId,
                zoneId: resolvedZoneId,
                parliamentId: resolvedParliamentId,
                constituencyId: constituency.id,
                mandalId,
                villageId,
                boothId,
                voterGroupId: groupId,
                updatedById: actorId,
              },
            });
            batchUpdated++;
          } else {
            // New voter insert
            const created = await tx.voter.create({
              data: {
                serialNumber: item.rowNum,
                epicNumber: item.epic,
                name: item.name,
                fatherHusbandName: item.relativeName,
                relationType: item.relation,
                age: item.age,
                gender: item.gender,
                mobileNumber: item.mobileNumber,
                houseNumber: item.houseNumber,
                caste: item.caste,
                profession: item.profession,
                politicalPreference: item.politicalPreference,
                stateId: resolvedStateId,
                zoneId: resolvedZoneId,
                parliamentId: resolvedParliamentId,
                constituencyId: constituency.id,
                mandalId,
                villageId,
                boothId,
                voterGroupId: groupId,
                updatedById: actorId,
              },
            });
            existingByEpic.set(item.epic, { id: created.id, epicNumber: item.epic, constituencyId: constituency.id });
            batchImported++;
          }
        }
      },
      { timeout: 15000 }
    );

    return { imported: batchImported, updated: batchUpdated, skipped, errors };
  }
}
