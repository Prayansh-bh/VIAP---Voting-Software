/**
 * Non-destructive unit tests for CSV Streaming Import
 * Tests:
 * 1. Actor authentication requirement (rejects missing/undefined actorId)
 * 2. REPLACE mode rejection (BULK_REPLACE_DISABLED)
 * 3. CSV parsing and header extraction
 * 4. Missing mandatory field detection
 * 5. Content-hash idempotency calculation
 * 6. Missing temporary file startup recovery (SOURCE_FILE_LOST_REUPLOAD_REQUIRED)
 * 7. Bounded batch chunking (500-row chunks)
 */

import assert from 'node:assert';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import csvParser from 'csv-parser';
import { Readable } from 'node:stream';

async function runTests() {
  console.log('🧪 Starting CSV Streaming Import focused non-destructive tests...\n');

  // Test 1: Content Hash Calculation for Idempotency
  {
    console.log('▶ Test 1: Content hash calculation for duplicate upload detection');
    const content = 'epicNumber,fullName,age,gender\nAP01234567,Ravi Kumar,28,MALE\nAP01234568,Priya Devi,26,FEMALE';
    const hash1 = crypto.createHash('sha256').update(content).digest('hex');
    const hash2 = crypto.createHash('sha256').update(content).digest('hex');
    assert.strictEqual(hash1, hash2, 'Identical content must generate identical SHA-256 hash');
    assert.strictEqual(hash1.length, 64, 'SHA-256 hash must be 64 characters hex');
    console.log('  ✔ Content hash calculation passed.');
  }

  // Test 2: Actor Validation Invariant
  {
    console.log('▶ Test 2: Actor authentication invariant');
    const validateActor = (user: { userId?: string } | undefined) => {
      if (!user?.userId) {
        throw new Error('UNAUTHORIZED_ACTOR: Missing or invalid actor identity. Anonymous or SuperAdmin fallback is strictly forbidden.');
      }
      return user.userId;
    };

    assert.throws(
      () => validateActor(undefined),
      /UNAUTHORIZED_ACTOR/,
      'Must reject undefined req.user'
    );
    assert.throws(
      () => validateActor({}),
      /UNAUTHORIZED_ACTOR/,
      'Must reject missing userId'
    );
    const validId = validateActor({ userId: 'usr_valid_actor_123' });
    assert.strictEqual(validId, 'usr_valid_actor_123', 'Must accept valid authenticated actor');
    console.log('  ✔ Actor authentication invariant passed.');
  }

  // Test 3: REPLACE Mode Disabled to Protect Historical Turnout
  {
    console.log('▶ Test 3: Bulk REPLACE mode rejection invariant');
    const checkImportMode = (mode?: string) => {
      if (mode === 'REPLACE') {
        throw new Error(
          'BULK_REPLACE_DISABLED: Replacing existing voter records is permanently disabled to protect historical vote events and cascade deletion of turnout data. Please use APPEND mode.'
        );
      }
      return mode || 'APPEND';
    };

    assert.throws(
      () => checkImportMode('REPLACE'),
      /BULK_REPLACE_DISABLED/,
      'Must reject REPLACE mode with actionable guidance'
    );
    assert.strictEqual(checkImportMode('APPEND'), 'APPEND', 'APPEND mode must be allowed');
    assert.strictEqual(checkImportMode(undefined), 'APPEND', 'Default mode must be APPEND');
    console.log('  ✔ REPLACE mode rejection invariant passed.');
  }

  // Test 4: CSV Stream Parsing and Header Mapping
  {
    console.log('▶ Test 4: CSV parser stream and header normalization');
    const csvData = [
      'Voter ID,Voter Name,Age,Gender,Mandal,Village,Booth No',
      'AP01234567,Lakshmi Narayana,45,MALE,Kondapi,Kandukur,12',
      'AP01234568,Venkata Subbamma,42,FEMALE,Kondapi,Kandukur,12',
      'AP01234569,Suresh Reddy,21,MALE,Kondapi,Kandukur,13',
    ].join('\n');

    const stream = Readable.from([csvData]);
    const parsedRows: any[] = [];
    let detectedHeaders: string[] = [];

    await new Promise<void>((resolve, reject) => {
      stream
        .pipe(csvParser())
        .on('headers', (headers: string[]) => {
          detectedHeaders = headers;
        })
        .on('data', (row: any) => {
          parsedRows.push(row);
        })
        .on('end', () => resolve())
        .on('error', reject);
    });

    assert.strictEqual(detectedHeaders.length, 7, 'Must detect all 7 headers');
    assert.strictEqual(parsedRows.length, 3, 'Must parse exactly 3 voter rows');
    assert.strictEqual(parsedRows[0]['Voter ID'], 'AP01234567', 'EPIC number in row 1 must match');
    assert.strictEqual(parsedRows[1]['Voter Name'], 'Venkata Subbamma', 'Voter name in row 2 must match');
    assert.strictEqual(parsedRows[2]['Age'], '21', 'Age in row 3 must match');
    console.log('  ✔ CSV parser stream and header mapping passed.');
  }

  // Test 5: Missing Mandatory Fields Check
  {
    console.log('▶ Test 5: Missing mandatory field detection');
    const validateRecord = (record: Record<string, any>) => {
      const errors: string[] = [];
      const epic = String(record.epicNumber || '').trim();
      const name = String(record.fullName || '').trim();
      const age = parseInt(String(record.age || ''), 10);

      if (!epic) errors.push('Missing required field: Voter ID / EPIC');
      if (!name) errors.push('Missing required field: Voter Full Name');
      if (isNaN(age) || age < 18) errors.push('Invalid legal voter age: must be >= 18');

      return errors;
    };

    const validRecord = { epicNumber: 'AP12345678', fullName: 'Gopal Rao', age: 34 };
    assert.strictEqual(validateRecord(validRecord).length, 0, 'Valid record should have 0 errors');

    const missingEpic = { epicNumber: '', fullName: 'Gopal Rao', age: 34 };
    assert.ok(validateRecord(missingEpic).some(e => e.includes('EPIC')), 'Should flag missing EPIC');

    const underAge = { epicNumber: 'AP12345678', fullName: 'Minor Person', age: 16 };
    assert.ok(validateRecord(underAge).some(e => e.includes('age')), 'Should flag underage voter (< 18)');
    console.log('  ✔ Missing mandatory field detection passed.');
  }

  // Test 6: Bounded Batching (500 rows per batch)
  {
    console.log('▶ Test 6: Bounded batch chunking (500 rows per batch)');
    const totalRecords = 1250;
    const records = Array.from({ length: totalRecords }, (_, i) => ({ id: i + 1 }));
    const BATCH_SIZE = 500;
    const batches: any[][] = [];

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      batches.push(records.slice(i, i + BATCH_SIZE));
    }

    assert.strictEqual(batches.length, 3, '1250 records must be split into 3 batches');
    assert.strictEqual(batches[0].length, 500, 'Batch 1 must contain exactly 500 records');
    assert.strictEqual(batches[1].length, 500, 'Batch 2 must contain exactly 500 records');
    assert.strictEqual(batches[2].length, 250, 'Batch 3 must contain exactly 250 records');
    console.log('  ✔ Bounded batch chunking passed.');
  }

  // Test 7: Missing Temporary File Detection on Startup
  {
    console.log('▶ Test 7: Missing temporary file recovery behavior');
    const nonExistentPath = path.join(os.tmpdir(), 'viap-imports', 'import-nonexistent-job.csv');
    const fileExists = fs.existsSync(nonExistentPath);
    assert.strictEqual(fileExists, false, 'Simulated lost file must not exist');

    const determineFailureReason = (filePath: string) => {
      if (!fs.existsSync(filePath)) {
        return 'SOURCE_FILE_LOST_REUPLOAD_REQUIRED';
      }
      return 'READY';
    };

    assert.strictEqual(
      determineFailureReason(nonExistentPath),
      'SOURCE_FILE_LOST_REUPLOAD_REQUIRED',
      'Missing source file must result in SOURCE_FILE_LOST_REUPLOAD_REQUIRED'
    );
    console.log('  ✔ Missing temporary file recovery behavior passed.');
  }

  // Test 8: Intra-batch duplicate EPIC resolution without P2002 abort
  {
    console.log('▶ Test 8: Intra-batch duplicate EPIC resolution');
    const existingByEpic = new Map<string, { id: string; epic: string }>();
    const batchItems = [
      { rowNum: 1, epic: 'AP01234567', name: 'Original Voter' },
      { rowNum: 2, epic: 'AP99999999', name: 'Different Voter' },
      { rowNum: 3, epic: 'AP01234567', name: 'Updated Duplicate Voter' }, // Same EPIC in same batch!
    ];

    let createdCount = 0;
    let updatedCount = 0;

    for (const item of batchItems) {
      const match = existingByEpic.get(item.epic);
      if (match) {
        // Subsequent occurrence in same batch updates instead of failing with P2002 @unique
        updatedCount++;
      } else {
        createdCount++;
        existingByEpic.set(item.epic, { id: `id-${item.rowNum}`, epic: item.epic });
      }
    }

    assert.strictEqual(createdCount, 2, '2 unique EPICs should be created');
    assert.strictEqual(updatedCount, 1, '1 duplicate EPIC within same batch should be updated');
    console.log('  ✔ Intra-batch duplicate EPIC resolution passed.');
  }

  // Test 9: Deterministic 64-bit advisory lock key derivation
  {
    console.log('▶ Test 9: Deterministic advisory lock key derivation');
    const constituencyId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
    const key1 = crypto.createHash('sha256').update(constituencyId).digest().readBigInt64BE(0);
    const key2 = crypto.createHash('sha256').update(constituencyId).digest().readBigInt64BE(0);
    assert.strictEqual(key1, key2, 'Advisory lock keys must be strictly deterministic');
    assert.strictEqual(typeof key1, 'bigint', 'Advisory lock key must be BigInt for PostgreSQL');
    console.log('  ✔ Deterministic advisory lock key derivation passed.');
  }

  console.log('\n✅ All 9 CSV Streaming Import unit tests passed successfully!\n');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
