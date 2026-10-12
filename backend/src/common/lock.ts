import crypto from 'node:crypto';

/**
 * Derives a deterministic 64-bit signed BigInt from a constituency identifier.
 * Used for PostgreSQL transaction-level advisory locks (pg_try_advisory_xact_lock).
 */
export function getConstituencyLockKey(constituencyId: string): bigint {
  return crypto.createHash('sha256').update(constituencyId).digest().readBigInt64BE(0);
}
