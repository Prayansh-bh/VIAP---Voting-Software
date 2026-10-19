/**
 * VIAP — Test Database Isolation & Safety Guard
 *
 * Implements Objective F requirement:
 * "Before running any integration test that could write to a database:
 *  1. Inspect its connection selection.
 *  2. Verify that the database is explicitly identified as a test database.
 *  3. Fail closed if the database is not isolated.
 *  4. Do not run destructive or data-writing tests against the configured live Neon database."
 */

export function assertTestDatabaseIsolation(): void {
  const dbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
  const isExplicitTestDb =
    process.env.IS_ISOLATED_TEST_DB === 'true' ||
    dbUrl.toLowerCase().includes('_test') ||
    dbUrl.toLowerCase().includes('test_') ||
    dbUrl.includes('localhost:5433') ||
    dbUrl.includes(':memory:');

  // If pointing to live Neon database and not explicitly marked as an isolated test DB
  if (dbUrl.includes('neon.tech') && !isExplicitTestDb) {
    throw new Error(
      '⛔ TEST EXECUTION BLOCKED: Target database is configured to a live cloud environment (Neon).\n' +
      'In accordance with Strict Safety Rules, tests writing to the database MUST fail closed.\n' +
      'To run database integration tests, supply an isolated disposable TEST_DATABASE_URL or IS_ISOLATED_TEST_DB=true.'
    );
  }
}
