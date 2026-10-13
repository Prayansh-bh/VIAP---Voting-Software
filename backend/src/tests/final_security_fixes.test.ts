process.env.NODE_ENV = 'production';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { RoleType } from '@prisma/client';
import { TokenService } from '../modules/auth/services/token.service.js';
import { SmsProviderFactory } from '../lib/sms/factory.js';
import { OtpService } from '../modules/auth/services/otp.service.js';

describe('Final Security Fixes Verification: OTP Timing Floor & Organisation Name Uniqueness', () => {
  let app: any;
  let testOrg: any;
  let adminOrg: any;
  let eligibleUser: any;
  let inactiveUser: any;
  let roleRestrictedUser: any;
  let superAdminUser: any;
  let adminToken: string;

  const eligibleMobile = '9848011991';
  const inactiveMobile = '9848011992';
  const roleRestrictedMobile = '9848011993';
  const unregisteredMobile = '9848011994';

  const mockDispatched: Array<{ mobile: string; otp: string }> = [];

  async function issueToken(user: any) {
    const payload = {
      userId: user.id,
      userCode: user.userCode,
      mobileNumber: user.mobileNumber,
      role: user.role,
      organisationId: user.organisationId,
    };
    const { token, sessionId } = TokenService.generateTokens(payload);
    await TokenService.recordLoginSession(user.id, user.mobileNumber, token, sessionId);
    return token;
  }

  before(async () => {
    // 1. Mock SMS Provider to track dispatches without external network calls
    SmsProviderFactory.setProvider({
      name: 'MockFinalSecuritySmsProvider',
      sendOtp: async (mobile: string, otp: string) => {
        mockDispatched.push({ mobile, otp });
        return {
          success: true,
          messageId: `msg-${Date.now()}`,
          provider: 'MockFinalSecuritySmsProvider',
          timestamp: new Date(),
        };
      },
      sendTransactional: async () => ({
        success: true,
        messageId: `tx-${Date.now()}`,
        provider: 'MockFinalSecuritySmsProvider',
        timestamp: new Date(),
      }),
    });

    app = buildApp();
    await app.ready();

    // 2. Setup test organisations and users
    testOrg = await prisma.organisation.create({
      data: {
        name: `Final-Fixes-Org-${Date.now()}`,
        code: `FFO-${Date.now().toString().slice(-4)}`,
        isActive: true,
      },
    });

    const party = await prisma.politicalParty.create({
      data: {
        organisationId: testOrg.id,
        name: 'Final Fixes Party',
        code: `FFP-${Date.now().toString().slice(-4)}`,
        shortName: 'FFP',
        primaryColor: '#eab308',
      },
    });

    await prisma.cMSConfiguration.create({
      data: {
        organisation: { connect: { id: testOrg.id } },
        headerTitle: 'Final Fixes App',
        organisationName: testOrg.name,
        stateName: 'Andhra Pradesh',
        configKey: `cfg-${testOrg.id}`,
        activePartyCode: party.code,
        appScope: 'SINGLE_MLA',
        hierarchyLabels: {},
        featureToggles: {},
        activeHierarchyLevels: ['MANDAL', 'VILLAGE', 'BOOTH'],
      },
    });

    eligibleUser = await prisma.user.create({
      data: {
        organisationId: testOrg.id,
        name: 'Eligible Mandal Incharge',
        userCode: `EMI-${Date.now().toString().slice(-4)}`,
        mobileNumber: eligibleMobile,
        role: RoleType.MANDAL_INCHARGE,
        accountStatus: 'ACTIVE',
      },
    });

    inactiveUser = await prisma.user.create({
      data: {
        organisationId: testOrg.id,
        name: 'Suspended Incharge',
        userCode: `SI-${Date.now().toString().slice(-4)}`,
        mobileNumber: inactiveMobile,
        role: RoleType.MANDAL_INCHARGE,
        accountStatus: 'SUSPENDED',
      },
    });

    roleRestrictedUser = await prisma.user.create({
      data: {
        organisationId: testOrg.id,
        name: 'Restricted Tier User',
        userCode: `RTU-${Date.now().toString().slice(-4)}`,
        mobileNumber: roleRestrictedMobile,
        role: RoleType.VILLAGE_INCHARGE,
        accountStatus: 'ACTIVE',
      },
    });

    adminOrg = await prisma.organisation.create({
      data: {
        name: `Admin-Org-${Date.now()}`,
        code: `AOR-${Date.now().toString().slice(-4)}`,
        isActive: true,
      },
    });

    superAdminUser = await prisma.user.create({
      data: {
        organisationId: adminOrg.id,
        name: 'Super Admin User',
        userCode: `SA-${Date.now().toString().slice(-4)}`,
        mobileNumber: `984809${Date.now().toString().slice(-4)}`,
        role: RoleType.SUPER_ADMIN,
        accountStatus: 'ACTIVE',
      },
    });

    adminToken = await issueToken(superAdminUser);
  });

  after(async () => {
    // Cleanup
    const testMobiles = [eligibleMobile, inactiveMobile, roleRestrictedMobile, unregisteredMobile];
    await prisma.oTPVerification.deleteMany({ where: { mobileNumber: { in: testMobiles } } });
    await prisma.user.deleteMany({ where: { id: { in: [eligibleUser?.id, inactiveUser?.id, roleRestrictedUser?.id, superAdminUser?.id].filter(Boolean) } } });
    await prisma.cMSConfiguration.deleteMany({ where: { organisationId: { in: [testOrg?.id, adminOrg?.id].filter(Boolean) } } });
    await prisma.politicalParty.deleteMany({ where: { organisationId: { in: [testOrg?.id, adminOrg?.id].filter(Boolean) } } });
    await prisma.organisation.deleteMany({ where: { id: { in: [testOrg?.id, adminOrg?.id].filter(Boolean) } } });
    await app.close();
  });

  // ==========================================================================
  // SECTION 1: FIX 1 - OTP ACCOUNT-ENUMERATION TIMING
  // ==========================================================================
  describe('Fix 1: OTP Account-Enumeration Timing & Hardening', () => {
    it('1.1 Uniform 200 response shape and headers across all account states (Eligible, Unregistered, Inactive, Role-Restricted)', async () => {
      const scenarios = [
        { label: 'Eligible', mobile: eligibleMobile, role: RoleType.MANDAL_INCHARGE },
        { label: 'Unregistered', mobile: unregisteredMobile, role: RoleType.MANDAL_INCHARGE },
        { label: 'Inactive', mobile: inactiveMobile, role: RoleType.MANDAL_INCHARGE },
        { label: 'RoleRestricted', mobile: roleRestrictedMobile, role: RoleType.STATE_ADMIN },
      ];

      for (const s of scenarios) {
        OtpService.clearCooldown(s.mobile);
        await prisma.oTPVerification.deleteMany({ where: { mobileNumber: s.mobile } });

        const res = await app.inject({
          method: 'POST',
          url: '/api/auth/request-otp',
          payload: { mobileNumber: s.mobile, role: s.role },
        });

        assert.equal(res.statusCode, 200, `${s.label} must return HTTP 200 uniform response`);
        const body = JSON.parse(res.body);
        assert.equal(body.success, true, `${s.label} success flag must be true`);
        assert.ok(body.data?.requestId, `${s.label} must return opaque requestId`);
        assert.ok(body.data?.expiresAt, `${s.label} must return expiresAt`);
        assert.equal(body.data?.cooldownSeconds, 60, `${s.label} cooldownSeconds must be 60`);
        assert.equal(body.data?.channel, 'SMS', `${s.label} channel must be SMS`);
        assert.equal(
          body.data?.message,
          'If an eligible account exists, an OTP has been dispatched.',
          `${s.label} message must be uniform opaque string`
        );

        // Verify zero diagnostic headers
        assert.equal(res.headers['x-account-status'], undefined, 'Must not leak account status header');
        assert.equal(res.headers['x-account-exists'], undefined, 'Must not leak account exists header');
      }
    });

    it('1.2 Ineligible accounts never receive OTP dispatch and never save OTP to database', async () => {
      mockDispatched.length = 0;

      const ineligibleScenarios = [
        { label: 'Unregistered', mobile: unregisteredMobile, role: RoleType.MANDAL_INCHARGE },
        { label: 'Inactive', mobile: inactiveMobile, role: RoleType.MANDAL_INCHARGE },
        { label: 'RoleRestricted', mobile: roleRestrictedMobile, role: RoleType.STATE_ADMIN },
      ];

      for (const s of ineligibleScenarios) {
        OtpService.clearCooldown(s.mobile);
        await prisma.oTPVerification.deleteMany({ where: { mobileNumber: s.mobile } });

        const res = await app.inject({
          method: 'POST',
          url: '/api/auth/request-otp',
          payload: { mobileNumber: s.mobile, role: s.role },
        });
        assert.equal(res.statusCode, 200);

        // Verify no OTP was dispatched via SMS provider
        const dispatched = mockDispatched.find((d) => d.mobile === s.mobile);
        assert.equal(dispatched, undefined, `No SMS must be dispatched for ineligible scenario: ${s.label}`);

        // Verify no OTPVerification record exists in database
        const dbRecords = await prisma.oTPVerification.findMany({ where: { mobileNumber: s.mobile } });
        assert.equal(dbRecords.length, 0, `No OTP record in DB for ineligible scenario: ${s.label}`);
      }

      // Conversely, verify eligible account DOES receive dispatch and persists hashed OTP
      OtpService.clearCooldown(eligibleMobile);
      await prisma.oTPVerification.deleteMany({ where: { mobileNumber: eligibleMobile } });

      const elRes = await app.inject({
        method: 'POST',
        url: '/api/auth/request-otp',
        payload: { mobileNumber: eligibleMobile, role: RoleType.MANDAL_INCHARGE },
      });
      assert.equal(elRes.statusCode, 200);

      const elDispatched = mockDispatched.find((d) => d.mobile === eligibleMobile);
      assert.ok(elDispatched, 'Eligible user must receive real SMS dispatch');

      const elDbRecords = await prisma.oTPVerification.findMany({ where: { mobileNumber: eligibleMobile } });
      assert.equal(elDbRecords.length, 1, 'Eligible user must have exactly 1 OTPVerification record in DB');
    });

    it('1.3 Rate limiting and cooldown are strictly enforced and return 429 immediately without being delayed by timing floor', async () => {
      const testMobile = '9848011998';
      OtpService.clearCooldown(testMobile);

      // Request 1: Valid initial request
      const start1 = performance.now();
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/auth/request-otp',
        payload: { mobileNumber: testMobile },
      });
      const dur1 = performance.now() - start1;
      assert.equal(res1.statusCode, 200);
      assert.ok(dur1 >= 950, `Initial 200 request must observe timing floor (took ${dur1.toFixed(1)}ms)`);

      // Request 2: Immediate duplicate request during cooldown
      const start2 = performance.now();
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/auth/request-otp',
        payload: { mobileNumber: testMobile },
      });
      const dur2 = performance.now() - start2;
      assert.equal(res2.statusCode, 429, 'Immediate duplicate request must trigger 429 cooldown');
      const body2 = JSON.parse(res2.body);
      assert.equal(body2.error?.code, 'OTP_COOLDOWN_ACTIVE');
      // Cooldown 429 should return quickly without waiting for timing floor
      assert.ok(dur2 < 500, `Cooldown 429 must return promptly without floor delay (took ${dur2.toFixed(1)}ms)`);
    });

    it('1.4 Monotonic timing floor is strictly enforced across repeated requests for all account states', async () => {
      const scenarios = [
        { label: 'Eligible', mobile: eligibleMobile, role: RoleType.MANDAL_INCHARGE },
        { label: 'Unregistered', mobile: unregisteredMobile, role: RoleType.MANDAL_INCHARGE },
        { label: 'Inactive', mobile: inactiveMobile, role: RoleType.MANDAL_INCHARGE },
        { label: 'RoleRestricted', mobile: roleRestrictedMobile, role: RoleType.STATE_ADMIN },
      ];

      const timings: Record<string, number[]> = {
        Eligible: [],
        Unregistered: [],
        Inactive: [],
        RoleRestricted: [],
      };

      const ITERATIONS = 3;
      for (let i = 0; i < ITERATIONS; i++) {
        for (const s of scenarios) {
          OtpService.clearCooldown(s.mobile);
          await prisma.oTPVerification.deleteMany({ where: { mobileNumber: s.mobile } });

          const start = performance.now();
          const res = await app.inject({
            method: 'POST',
            url: '/api/auth/request-otp',
            remoteAddress: `10.20.${i}.${s.label.length}`,
            payload: { mobileNumber: s.mobile, role: s.role },
          });
          const elapsed = performance.now() - start;
          assert.equal(res.statusCode, 200);
          timings[s.label].push(elapsed);
        }
      }

      console.log('\n--- Final Fixes Verification: Empirical Response Durations (ms) ---');
      for (const [scenario, samples] of Object.entries(timings)) {
        const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
        const min = Math.min(...samples);
        const max = Math.max(...samples);
        console.log(`[${scenario.padEnd(15)}] Mean: ${mean.toFixed(2)}ms | Min: ${min.toFixed(2)}ms | Max: ${max.toFixed(2)}ms | Samples: ${samples.map((s) => s.toFixed(1)).join(', ')}`);
        assert.ok(min >= 950, `${scenario} minimum duration must be >= 950ms (got ${min.toFixed(1)}ms)`);
      }
    });

    it('1.5 Configurable timing floor respects custom OTP_TIMING_FLOOR_MS setting', async () => {
      const testMobile = '9848011999';
      OtpService.clearCooldown(testMobile);

      // Dynamically test a custom 250ms floor
      process.env.OTP_TIMING_FLOOR_MS = '250';
      try {
        const start = performance.now();
        const res = await app.inject({
          method: 'POST',
          url: '/api/auth/request-otp',
          remoteAddress: '10.30.1.5',
          payload: { mobileNumber: testMobile },
        });
        const elapsed = performance.now() - start;
        assert.equal(res.statusCode, 200);
        assert.ok(elapsed >= 240 && elapsed < 800, `Duration with 250ms floor should be ~250ms (got ${elapsed.toFixed(1)}ms)`);
      } finally {
        delete process.env.OTP_TIMING_FLOOR_MS; // restore default
      }
    });

    it('1.6 Genuine infrastructure failure returns 502 SMS_DISPATCH_FAILED and is not suppressed', async () => {
      // Temporarily inject failing SMS provider
      SmsProviderFactory.setProvider({
        name: 'FailingSmsProvider',
        sendOtp: async () => ({
          success: false,
          error: 'Gateway connection timed out / Network socket hangup',
          provider: 'FailingSmsProvider',
          timestamp: new Date(),
        }),
        sendTransactional: async () => ({
          success: false,
          error: 'Failed',
          provider: 'FailingSmsProvider',
          timestamp: new Date(),
        }),
      });

      try {
        OtpService.clearCooldown(eligibleMobile);
        await prisma.oTPVerification.deleteMany({ where: { mobileNumber: eligibleMobile } });

        const res = await app.inject({
          method: 'POST',
          url: '/api/auth/request-otp',
          remoteAddress: '10.30.1.6',
          payload: { mobileNumber: eligibleMobile, role: RoleType.MANDAL_INCHARGE },
        });

        assert.equal(res.statusCode, 502, 'Infrastructure outage must return HTTP 502');
        const body = JSON.parse(res.body);
        assert.equal(body.error?.code, 'SMS_DISPATCH_FAILED');
      } finally {
        // Restore working mock provider
        SmsProviderFactory.setProvider({
          name: 'MockFinalSecuritySmsProvider',
          sendOtp: async () => ({ success: true, messageId: 'm', provider: 'mock', timestamp: new Date() }),
          sendTransactional: async () => ({ success: true, messageId: 'tx', provider: 'mock', timestamp: new Date() }),
        });
      }
    });
  });

  // ==========================================================================
  // SECTION 2: FIX 2 - DATABASE-ENFORCED ORGANISATION NAME UNIQUENESS
  // ==========================================================================
  describe('Fix 2: Database-Enforced Organisation Name Uniqueness', () => {
    const disposableTableName = 'Disposable_Organisation_Test';

    before(async () => {
      // Create disposable test table mimicking Organisation
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${disposableTableName}" (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          code TEXT NOT NULL,
          name TEXT NOT NULL,
          "isActive" BOOLEAN NOT NULL DEFAULT true
        );
      `);
    });

    after(async () => {
      // Drop disposable test table
      try {
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${disposableTableName}" CASCADE;`);
      } catch {}
    });

    it('2.1 Migration SQL applies successfully creating unique index on LOWER(name)', async () => {
      // Test applying the formal migration SQL to the disposable table
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX "${disposableTableName}_lower_name_key"
        ON "${disposableTableName}"(LOWER("name"));
      `);

      // Verify the index exists in pg_indexes
      const indexes: any = await prisma.$queryRaw`
        SELECT indexname FROM pg_indexes
        WHERE tablename = ${disposableTableName} AND indexname = ${`${disposableTableName}_lower_name_key`};
      `;
      assert.equal(indexes.length, 1, 'Unique index on LOWER(name) must exist in PostgreSQL metadata');
    });

    it('2.2 Existing duplicate names cause a safe migration failure rather than silent data deletion', async () => {
      const dupTableName = 'Dup_Failure_Safe_Test';
      await prisma.$executeRawUnsafe(`
        CREATE TABLE "${dupTableName}" (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL
        );
      `);
      await prisma.$executeRawUnsafe(`
        INSERT INTO "${dupTableName}" (name) VALUES ('Congress Party'), ('congress party');
      `);

      try {
        let threw = false;
        try {
          // Attempting to create the unique index on duplicate data must fail
          await prisma.$executeRawUnsafe(`
            CREATE UNIQUE INDEX "${dupTableName}_lower_name_key" ON "${dupTableName}"(LOWER("name"));
          `);
        } catch (err: any) {
          threw = true;
          assert.ok(err.message.includes('duplicate key') || err.message.includes('23505'), 'Must fail with duplicate key violation');
        }
        assert.equal(threw, true, 'Creating unique index over duplicate names must fail');

        // Verify zero silent data deletion: both rows are preserved intact
        const rows: any = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM "${dupTableName}";`);
        assert.equal(rows[0].count, 2, 'Existing records must NOT be silently deleted or altered');
      } finally {
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${dupTableName}" CASCADE;`);
      }
    });

    it('2.3 Names differing only by case cannot both be inserted into database', async () => {
      // Insert initial name
      await prisma.$executeRawUnsafe(`
        INSERT INTO "${disposableTableName}" (code, name) VALUES ('TEST-01', 'Telugu Desam Party');
      `);

      // Attempt inserting uppercase duplicate
      let threwUpper = false;
      try {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "${disposableTableName}" (code, name) VALUES ('TEST-02', 'TELUGU DESAM PARTY');
        `);
      } catch (err: any) {
        threwUpper = true;
        assert.ok(err.message.includes('duplicate key') || err.message.includes('23505'));
      }
      assert.equal(threwUpper, true, 'Uppercase duplicate must be rejected by PostgreSQL unique index');

      // Attempt inserting lowercase duplicate
      let threwLower = false;
      try {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "${disposableTableName}" (code, name) VALUES ('TEST-03', 'telugu desam party');
        `);
      } catch (err: any) {
        threwLower = true;
        assert.ok(err.message.includes('duplicate key') || err.message.includes('23505'));
      }
      assert.equal(threwLower, true, 'Lowercase duplicate must be rejected by PostgreSQL unique index');

      // Verify only 1 record exists in table
      const countRes: any = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::int as count FROM "${disposableTableName}" WHERE LOWER("name") = 'telugu desam party';
      `);
      assert.equal(countRes[0].count, 1, 'Database must contain strictly 1 record');
    });

    it('2.4 Concurrent provisioning requests with the same name result in exactly one success (201) and one conflict (409)', async () => {
      const timestamp = Date.now().toString().slice(-4);
      const orgName = `Atomic Uniq Org ${timestamp}`;

      const [res1, res2] = await Promise.all([
        app.inject({
          method: 'POST',
          url: '/api/cms/build-application',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: {
            appName: orgName,
            organisationName: orgName,
            tenantCode: `AU1-${timestamp}`,
            appScope: 'SINGLE_MLA',
          },
        }),
        app.inject({
          method: 'POST',
          url: '/api/cms/build-application',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: {
            appName: orgName.toLowerCase(), // case-insensitive duplicate!
            organisationName: orgName.toLowerCase(),
            tenantCode: `AU2-${timestamp}`,
            appScope: 'SINGLE_MLA',
          },
        }),
      ]);

      const statusCodes = [res1.statusCode, res2.statusCode].sort();
      assert.deepEqual(statusCodes, [201, 409], 'Exactly one request must succeed (201) and the other must return conflict (409)');

      const conflictRes = res1.statusCode === 409 ? res1 : res2;
      const conflictBody = JSON.parse(conflictRes.body);
      assert.equal(conflictBody.error?.code, 'TENANT_ALREADY_EXISTS');

      const successRes = res1.statusCode === 201 ? res1 : res2;
      const successBody = JSON.parse(successRes.body);
      const createdOrgId = successBody.data.application.organisationId;

      // Verify only 1 record was created in the database
      const orgs = await prisma.organisation.findMany({
        where: { name: { equals: orgName, mode: 'insensitive' } },
      });
      assert.equal(orgs.length, 1, 'Database must have strictly 1 organisation for this name');

      // Cleanup
      await prisma.cMSConfiguration.deleteMany({ where: { organisationId: createdOrgId } });
      await prisma.politicalParty.deleteMany({ where: { organisationId: createdOrgId } });
      await prisma.organisation.delete({ where: { id: createdOrgId } });
    });
  });
});
