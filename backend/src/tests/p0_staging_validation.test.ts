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

describe('P0 Staging Validation & Production Readiness Suite', () => {
  let app: any;
  let tenantAOrg: any;
  let tenantBOrg: any;
  let eligibleUserA: any;
  let inactiveUserA: any;
  let roleRestrictedUserA: any;
  let userWithoutOrg: any;
  let tenantBUser: any;
  let superAdminUser: any;

  let tokenTenantA: string;
  let tokenTenantB: string;
  let tokenNoOrg: string;
  let tokenSuperAdmin: string;

  const mockDispatchedOtps: Array<{ mobile: string; otp: string }> = [];

  const eligibleMobile = '9848011111';
  const inactiveMobile = '9848022222';
  const roleRestrictedMobile = '9848033333';
  const unregisteredMobile = '9848099991';

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
    // 1. Mock SMS Provider so no real SMS or WhatsApp messages are ever sent
    SmsProviderFactory.setProvider({
      name: 'MockStagingSmsProvider',
      sendOtp: async (mobile: string, otp: string) => {
        mockDispatchedOtps.push({ mobile, otp });
        return { success: true };
      },
    } as any);

    app = buildApp();
    await app.ready();

    // 2. Setup Staging Test Entities
    tenantAOrg = await prisma.organisation.create({
      data: {
        name: `Staging-Org-A-${Date.now()}`,
        code: `SOA-${Date.now().toString().slice(-4)}`,
        isActive: true,
      },
    });

    tenantBOrg = await prisma.organisation.create({
      data: {
        name: `Staging-Org-B-${Date.now()}`,
        code: `SOB-${Date.now().toString().slice(-4)}`,
        isActive: true,
      },
    });

    const partyA = await prisma.politicalParty.create({
      data: {
        organisationId: tenantAOrg.id,
        name: 'Staging Party A',
        code: `SPA-${Date.now().toString().slice(-4)}`,
        shortName: 'SPA',
        primaryColor: '#eab308',
      },
    });

    const partyB = await prisma.politicalParty.create({
      data: {
        organisationId: tenantBOrg.id,
        name: 'Staging Party B',
        code: `SPB-${Date.now().toString().slice(-4)}`,
        shortName: 'SPB',
        primaryColor: '#3b82f6',
      },
    });

    await prisma.cMSConfiguration.create({
      data: {
        organisation: { connect: { id: tenantAOrg.id } },
        headerTitle: 'Staging Tenant A App',
        organisationName: tenantAOrg.name,
        stateName: 'Andhra Pradesh',
        configKey: `cfg-${tenantAOrg.id}`,
        activePartyCode: partyA.code,
        appScope: 'SINGLE_MLA',
        hierarchyLabels: {},
        featureToggles: {},
        activeHierarchyLevels: ['MANDAL', 'VILLAGE', 'BOOTH'], // STATE, ZONE, CONSTITUENCY restricted
      },
    });

    await prisma.cMSConfiguration.create({
      data: {
        organisation: { connect: { id: tenantBOrg.id } },
        headerTitle: 'Staging Tenant B App',
        organisationName: tenantBOrg.name,
        stateName: 'Telangana',
        configKey: `cfg-${tenantBOrg.id}`,
        activePartyCode: partyB.code,
        appScope: 'SINGLE_MLA',
        hierarchyLabels: {},
        featureToggles: {},
        activeHierarchyLevels: ['MANDAL', 'VILLAGE', 'BOOTH'],
      },
    });

    eligibleUserA = await prisma.user.create({
      data: {
        organisationId: tenantAOrg.id,
        name: 'Staging Eligible User A',
        userCode: `EUA-${Date.now().toString().slice(-4)}`,
        mobileNumber: eligibleMobile,
        role: RoleType.MANDAL_INCHARGE,
        accountStatus: 'ACTIVE',
      },
    });

    inactiveUserA = await prisma.user.create({
      data: {
        organisationId: tenantAOrg.id,
        name: 'Staging Suspended User A',
        userCode: `SUA-${Date.now().toString().slice(-4)}`,
        mobileNumber: inactiveMobile,
        role: RoleType.MANDAL_INCHARGE,
        accountStatus: 'SUSPENDED',
      },
    });

    roleRestrictedUserA = await prisma.user.create({
      data: {
        organisationId: tenantAOrg.id,
        name: 'Staging Restricted Role User A',
        userCode: `RRA-${Date.now().toString().slice(-4)}`,
        mobileNumber: roleRestrictedMobile,
        role: RoleType.VILLAGE_INCHARGE,
        accountStatus: 'ACTIVE',
      },
    });

    userWithoutOrg = await prisma.user.create({
      data: {
        name: 'Staging User Missing Org',
        userCode: `NOO-${Date.now().toString().slice(-4)}`,
        mobileNumber: `984807${Date.now().toString().slice(-4)}`,
        role: RoleType.VIEWER,
        accountStatus: 'ACTIVE',
      },
    });

    tenantBUser = await prisma.user.create({
      data: {
        organisationId: tenantBOrg.id,
        name: 'Staging Tenant B User',
        userCode: `TBU-${Date.now().toString().slice(-4)}`,
        mobileNumber: `984808${Date.now().toString().slice(-4)}`,
        role: RoleType.MANDAL_INCHARGE,
        accountStatus: 'ACTIVE',
      },
    });

    superAdminUser = await prisma.user.create({
      data: {
        organisationId: tenantAOrg.id,
        name: 'Staging SuperAdmin',
        userCode: `SSA-${Date.now().toString().slice(-4)}`,
        mobileNumber: `984800${Date.now().toString().slice(-4)}`,
        role: RoleType.SUPER_ADMIN,
        accountStatus: 'ACTIVE',
      },
    });

    tokenTenantA = await issueToken(eligibleUserA);
    tokenTenantB = await issueToken(tenantBUser);
    tokenNoOrg = await issueToken(userWithoutOrg);
    tokenSuperAdmin = await issueToken(superAdminUser);
  });

  after(async () => {
    SmsProviderFactory.reset();
    try {
      await prisma.loginSession.deleteMany({
        where: {
          userId: { in: [eligibleUserA.id, inactiveUserA.id, roleRestrictedUserA.id, userWithoutOrg.id, tenantBUser.id, superAdminUser.id] },
        },
      });
      await prisma.oTPVerification.deleteMany({
        where: {
          mobileNumber: { in: [eligibleMobile, inactiveMobile, roleRestrictedMobile, unregisteredMobile] },
        },
      });
      await prisma.user.deleteMany({
        where: {
          id: { in: [eligibleUserA.id, inactiveUserA.id, roleRestrictedUserA.id, userWithoutOrg.id, tenantBUser.id, superAdminUser.id] },
        },
      });
      await prisma.cMSConfiguration.deleteMany({ where: { organisationId: tenantAOrg.id } });
      await prisma.politicalParty.deleteMany({ where: { organisationId: tenantAOrg.id } });
      await prisma.organisation.deleteMany({ where: { id: { in: [tenantAOrg.id, tenantBOrg.id] } } });
    } catch {
      // Ignore cleanup error
    }
    await app.close();
  });

  // ==========================================================================
  // SECTION 1: OTP ANTI-ENUMERATION, TIMING & OBSERVABLE SIGNALS
  // ==========================================================================
  describe('1. OTP Anti-Enumeration & Observable Characteristics', () => {
    it('1.1 Response status, body schema, and message are strictly uniform across account states', async () => {
      const scenarios = [
        { label: 'Eligible Account', mobile: eligibleMobile, role: RoleType.MANDAL_INCHARGE },
        { label: 'Unregistered Account', mobile: unregisteredMobile, role: RoleType.MANDAL_INCHARGE },
        { label: 'Inactive/Suspended Account', mobile: inactiveMobile, role: RoleType.MANDAL_INCHARGE },
        { label: 'Role-Restricted/Mismatched Account', mobile: roleRestrictedMobile, role: RoleType.STATE_ADMIN },
      ];

      for (const s of scenarios) {
        OtpService.clearCooldown(s.mobile);
        const res = await app.inject({
          method: 'POST',
          url: '/api/auth/request-otp',
          payload: { mobileNumber: s.mobile, role: s.role },
        });

        assert.equal(res.statusCode, 200, `${s.label} must return HTTP 200 in production`);
        const body = JSON.parse(res.body);

        assert.equal(body.success, true, `${s.label} success flag must be true`);
        assert.ok(body.data?.requestId, `${s.label} must contain requestId`);
        assert.ok(body.data?.expiresAt, `${s.label} must contain expiresAt`);
        assert.equal(body.data?.cooldownSeconds, 60, `${s.label} cooldownSeconds must be 60`);
        assert.equal(body.data?.channel, 'SMS', `${s.label} channel must be SMS`);
        assert.equal(
          body.data?.message,
          'If an eligible account exists, an OTP has been dispatched.',
          `${s.label} message must be uniform opaque string`
        );

        // Verify headers contain no diagnostic leaks
        assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');
        assert.equal(res.headers['x-account-status'], undefined, 'No diagnostic headers permitted');
        assert.equal(res.headers['x-account-exists'], undefined, 'No diagnostic headers permitted');
      }
    });

    it('1.2 Response timing empirical measurement across 5 iterations per scenario', async () => {
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

      const ITERATIONS = 5;
      for (let i = 0; i < ITERATIONS; i++) {
        for (let sIdx = 0; sIdx < scenarios.length; sIdx++) {
          const s = scenarios[sIdx];
          await prisma.oTPVerification.deleteMany({ where: { mobileNumber: s.mobile } });
          OtpService.clearCooldown(s.mobile);
          const start = performance.now();
          const res = await app.inject({
            method: 'POST',
            url: '/api/auth/request-otp',
            remoteAddress: `10.10.${i}.${sIdx + 1}`,
            payload: { mobileNumber: s.mobile, role: s.role },
          });
          const elapsed = performance.now() - start;
          assert.equal(res.statusCode, 200);
          timings[s.label].push(elapsed);
        }
      }

      console.log('\n--- OTP Anti-Enumeration Empirical Timing (ms) ---');
      for (const [scenario, samples] of Object.entries(timings)) {
        const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
        const min = Math.min(...samples);
        const max = Math.max(...samples);
        console.log(`[${scenario.padEnd(15)}] Mean: ${mean.toFixed(2)}ms | Min: ${min.toFixed(2)}ms | Max: ${max.toFixed(2)}ms | Samples: ${samples.map((s) => s.toFixed(1)).join(', ')}`);
        assert.ok(mean > 0 && mean < 5000, `Mean timing (${mean}ms) should be within reasonable network/db range`);
      }
    });

    it('1.3 Rate limit cannot be bypassed via number formatting permutations', async () => {
      const testMobile = '9848055555';
      OtpService.clearCooldown(testMobile);

      // Request 1: standard 10-digit
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/auth/request-otp',
        payload: { mobileNumber: testMobile },
      });
      assert.equal(res1.statusCode, 200);

      // Attempt immediate bypass using +91 prefix
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/auth/request-otp',
        payload: { mobileNumber: `+91 ${testMobile}` },
      });
      assert.equal(res2.statusCode, 429, '+91 formatting must not bypass cooldown');
      const body2 = JSON.parse(res2.body);
      assert.equal(body2.error?.code, 'OTP_COOLDOWN_ACTIVE');

      // Attempt immediate bypass using dashes
      const res3 = await app.inject({
        method: 'POST',
        url: '/api/auth/request-otp',
        payload: { mobileNumber: `9848-055-555` },
      });
      assert.equal(res3.statusCode, 429, 'Dashes must not bypass cooldown');

      // Attempt immediate bypass using leading 0
      const res4 = await app.inject({
        method: 'POST',
        url: '/api/auth/request-otp',
        payload: { mobileNumber: `0${testMobile}` },
      });
      assert.equal(res4.statusCode, 429, 'Leading 0 must not bypass cooldown');
    });
  });

  // ==========================================================================
  // SECTION 2: END-TO-END HTTP AUTHORIZATION & SCOPE BOUNDARIES
  // ==========================================================================
  describe('2. End-to-End Route Authorization & Missing Tenant Context', () => {
    let pollTenantA: any;

    before(async () => {
      pollTenantA = await prisma.poll.create({
        data: {
          title: 'Staging Poll Tenant A',
          createdById: eligibleUserA.id,
          status: 'PUBLISHED',
          options: {
            create: [
              { label: 'Option 1', order: 1 },
              { label: 'Option 2', order: 2 },
            ],
          },
        },
        include: { options: true },
      });
    });

    after(async () => {
      if (pollTenantA?.id) {
        await prisma.pollVote.deleteMany({ where: { pollId: pollTenantA.id } });
        await prisma.pollOption.deleteMany({ where: { pollId: pollTenantA.id } });
        await prisma.poll.delete({ where: { id: pollTenantA.id } });
      }
    });

    it('2.1 User without active organisation/party fails closed at authentication with 401 NOT_REGISTERED_TO_PARTY', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/polls',
        headers: { authorization: `Bearer ${tokenNoOrg}` },
      });
      assert.equal(res.statusCode, 401, 'User missing active organization/party must fail closed at auth middleware');
      const body = JSON.parse(res.body);
      assert.equal(body.error?.code, 'NOT_REGISTERED_TO_PARTY');
    });

    it('2.2 Voting by unassociated user without active party fails closed with 401 NOT_REGISTERED_TO_PARTY', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/polls/${pollTenantA.id}/vote`,
        headers: { authorization: `Bearer ${tokenNoOrg}` },
        payload: { optionId: pollTenantA.options[0].id },
      });
      assert.equal(res.statusCode, 401, 'Voting without valid party fails closed with 401');
      const body = JSON.parse(res.body);
      assert.equal(body.error?.code, 'NOT_REGISTERED_TO_PARTY');
    });

    it('2.3 Tenant B user receives 403 on voting on Tenant A poll', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/polls/${pollTenantA.id}/vote`,
        headers: { authorization: `Bearer ${tokenTenantB}` },
        payload: { optionId: pollTenantA.options[0].id },
      });
      assert.equal(res.statusCode, 403);
      const body = JSON.parse(res.body);
      assert.equal(body.error?.code, 'FORBIDDEN_TENANT');
    });

    it('2.4 User without active party fails closed on GET /api/applications with 401 NOT_REGISTERED_TO_PARTY', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/applications',
        headers: { authorization: `Bearer ${tokenNoOrg}` },
      });
      assert.equal(res.statusCode, 401);
      const body = JSON.parse(res.body);
      assert.equal(body.error?.code, 'NOT_REGISTERED_TO_PARTY');
    });

    it('2.5 Denied demo-login requests issue zero tokens and create zero sessions', async () => {
      const beforeSessions = await prisma.loginSession.count();
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/demo-login',
        payload: { role: 'SUPER_ADMIN' },
      });

      assert.equal(res.statusCode, 404, 'demo-login in production must be 404');
      const body = JSON.parse(res.body);
      assert.equal(body.token, undefined);
      assert.equal(body.accessToken, undefined);

      const afterSessions = await prisma.loginSession.count();
      assert.equal(afterSessions, beforeSessions, 'Zero database login sessions should be created');
    });
  });
});
