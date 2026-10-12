import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { FastifyInstance } from 'fastify';
import { RoleType } from '@prisma/client';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { hashOtp, generateSecureOtp } from '../lib/crypto.js';
import { SmsProviderFactory } from '../lib/sms/factory.js';
import { Msg91SmsProvider } from '../lib/sms/providers/msg91.provider.js';
import { OtpService } from '../modules/auth/services/otp.service.js';
import { TokenService } from '../modules/auth/services/token.service.js';

describe('P1-D Production Security & MSG91 Subsystem Validation Suite', () => {
  let app: FastifyInstance;
  let testUser: any;
  let inactiveUser: any;
  const testMobile = '9876540001';
  const inactiveMobile = '9876540002';
  const unknownMobile = '9876540099';

  before(async () => {
    // Mock MSG91 SMS boundary for automated test execution
    SmsProviderFactory.setProvider({
      name: 'msg91',
      sendOtp: async () => ({
        success: true,
        messageId: 'mock-msg91-p1d',
        provider: 'msg91',
        timestamp: new Date(),
      }),
      sendTransactional: async () => ({
        success: true,
        messageId: 'mock-msg91-p1d-tx',
        provider: 'msg91',
        timestamp: new Date(),
      }),
    });

    app = buildApp();
    await app.ready();

    // Clean any preexisting test OTPs
    await prisma.oTPVerification.deleteMany({
      where: { mobileNumber: { in: [testMobile, inactiveMobile, unknownMobile] } },
    });
    OtpService.clearCooldown(testMobile);
    OtpService.clearCooldown(inactiveMobile);
    OtpService.clearCooldown(unknownMobile);

    // Setup active test user
    testUser = await prisma.user.findFirst({
      where: { mobileNumber: testMobile },
      include: { organisation: true },
    });
    if (!testUser) {
      const org = await prisma.organisation.findFirst();
      testUser = await prisma.user.create({
        data: {
          userCode: `P1D-USR-${Date.now()}`,
          name: 'P1-D Test Incharge',
          mobileNumber: testMobile,
          role: RoleType.CONSTITUENCY_INCHARGE,
          accountStatus: 'ACTIVE',
          organisationId: org?.id,
        },
        include: { organisation: true },
      });
    }

    // Setup inactive test user
    inactiveUser = await prisma.user.findFirst({
      where: { mobileNumber: inactiveMobile },
    });
    if (!inactiveUser) {
      inactiveUser = await prisma.user.create({
        data: {
          userCode: `P1D-INACT-${Date.now()}`,
          name: 'P1-D Inactive User',
          mobileNumber: inactiveMobile,
          role: RoleType.CONSTITUENCY_INCHARGE,
          accountStatus: 'SUSPENDED',
        },
      });
    }
  });

  after(async () => {
    SmsProviderFactory.reset();
  });

  // =========================================================================
  // P1-D-01: ANTI-ENUMERATION & INDEPENDENT COOLDOWN
  // =========================================================================

  it('1. Anti-enumeration: Unknown mobile receives uniform 200 response without leaking existence', async () => {
    OtpService.clearCooldown(unknownMobile);
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: { mobileNumber: unknownMobile, role: RoleType.CONSTITUENCY_INCHARGE },
    });

    assert.equal(res.statusCode, 200);
    const json = res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.requestId);
    assert.equal(json.data.provider, 'msg91');
    assert.equal(json.data.cooldownSeconds, 60);
    assert.equal(json.data.userExists, undefined);
    assert.equal(json.data.eligible, undefined);
    assert.equal(json.data.notFound, undefined);
    assert.equal(json.data.role, undefined);

    // Verify NO database record created for unknown user
    const dbRecord = await prisma.oTPVerification.findFirst({
      where: { mobileNumber: unknownMobile },
    });
    assert.equal(dbRecord, null, 'No DB record must be created for unknown mobile');
  });

  it('2. Anti-enumeration: Unknown mobile triggers identical 429 cooldown on immediate repeat request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: { mobileNumber: unknownMobile, role: RoleType.CONSTITUENCY_INCHARGE },
    });

    assert.equal(res.statusCode, 429, 'Unknown mobile must trigger 429 cooldown just like registered mobile');
    const json = res.json();
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'OTP_COOLDOWN_ACTIVE');
    assert.ok(json.error.details.retryAfter > 0);
  });

  it('3. Anti-enumeration: Active registered mobile receives identical shape response and cooldown behavior', async () => {
    OtpService.clearCooldown(testMobile);
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: { mobileNumber: testMobile, role: RoleType.CONSTITUENCY_INCHARGE },
    });

    assert.equal(res.statusCode, 200);
    const json = res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.requestId);
    assert.equal(json.data.provider, 'msg91');
    assert.equal(json.data.cooldownSeconds, 60);

    // Immediate second request triggers identical 429
    const secondRes = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: { mobileNumber: testMobile, role: RoleType.CONSTITUENCY_INCHARGE },
    });
    assert.equal(secondRes.statusCode, 429);
    assert.equal(secondRes.json().error.code, 'OTP_COOLDOWN_ACTIVE');
  });

  it('4. Anti-enumeration: Inactive user receives identical shape response and cooldown behavior', async () => {
    OtpService.clearCooldown(inactiveMobile);
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: { mobileNumber: inactiveMobile, role: RoleType.CONSTITUENCY_INCHARGE },
    });

    assert.equal(res.statusCode, 200);
    const json = res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.userExists, undefined);
    assert.equal(json.data.accountStatus, undefined);

    const secondRes = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: { mobileNumber: inactiveMobile, role: RoleType.CONSTITUENCY_INCHARGE },
    });
    assert.equal(secondRes.statusCode, 429);
    assert.equal(secondRes.json().error.code, 'OTP_COOLDOWN_ACTIVE');
  });

  // =========================================================================
  // P1-D-02: TOKEN TYPE CONFUSION & REFRESH ENDPOINT HARDENING
  // =========================================================================

  it('5. Token Type: Access token passed as refresh token to /api/auth/refresh is strictly REJECTED (401)', async () => {
    const payload = {
      userId: testUser.id,
      userCode: testUser.userCode,
      mobileNumber: testUser.mobileNumber,
      role: testUser.role,
      organisationId: testUser.organisationId,
      unitId: testUser.unitId,
    };
    const { token: accessToken } = TokenService.generateTokens(payload);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: accessToken },
    });

    assert.equal(res.statusCode, 401);
    const json = res.json();
    assert.equal(json.error.code, 'INVALID_REFRESH_TOKEN');
  });

  it('6. Token Type: Refresh token with valid session is ACCEPTED by /api/auth/refresh', async () => {
    const payload = {
      userId: testUser.id,
      userCode: testUser.userCode,
      mobileNumber: testUser.mobileNumber,
      role: testUser.role,
      organisationId: testUser.organisationId,
      unitId: testUser.unitId,
    };
    const { token, refreshToken, sessionId } = TokenService.generateTokens(payload);
    await TokenService.recordLoginSession(testUser.id, testUser.mobileNumber, token, sessionId);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken },
    });

    assert.equal(res.statusCode, 200);
    const json = res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.token, 'Must return fresh access token');
  });

  it('7. Token Type: Revoked session refresh token is strictly REJECTED (401)', async () => {
    const payload = {
      userId: testUser.id,
      userCode: testUser.userCode,
      mobileNumber: testUser.mobileNumber,
      role: testUser.role,
      organisationId: testUser.organisationId,
      unitId: testUser.unitId,
    };
    const { token, refreshToken, sessionId } = TokenService.generateTokens(payload);
    await TokenService.recordLoginSession(testUser.id, testUser.mobileNumber, token, sessionId);

    // Revoke the session
    await TokenService.revokeSession(sessionId);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken },
    });

    assert.equal(res.statusCode, 401);
    const json = res.json();
    assert.equal(json.error.code, 'SESSION_REVOKED');
  });

  it('8. Token Type: Expired session refresh token is strictly REJECTED (401)', async () => {
    const payload = {
      userId: testUser.id,
      userCode: testUser.userCode,
      mobileNumber: testUser.mobileNumber,
      role: testUser.role,
      organisationId: testUser.organisationId,
      unitId: testUser.unitId,
    };
    const { token, refreshToken, sessionId } = TokenService.generateTokens(payload);
    const session = await TokenService.recordLoginSession(testUser.id, testUser.mobileNumber, token, sessionId);

    // Backdate expiration in DB
    await prisma.loginSession.update({
      where: { id: session.id },
      data: { expiresAt: new Date(Date.now() - 60000) },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken },
    });

    assert.equal(res.statusCode, 401);
    const json = res.json();
    assert.equal(json.error.code, 'SESSION_EXPIRED');
  });

  it('9. Token Type: Foreign session refresh token is strictly REJECTED (401)', async () => {
    const payload = {
      userId: testUser.id,
      userCode: testUser.userCode,
      mobileNumber: testUser.mobileNumber,
      role: testUser.role,
      organisationId: testUser.organisationId,
      unitId: testUser.unitId,
    };
    const { token, sessionId } = TokenService.generateTokens(payload);
    await TokenService.recordLoginSession(testUser.id, testUser.mobileNumber, token, sessionId);

    // Forge a refresh token for another user pointing to this sessionId
    const forgedRefreshToken = jwt.sign(
      { userId: 'different-foreign-user-id', sessionId, tokenType: 'refresh' },
      env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '7d' }
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: forgedRefreshToken },
    });

    assert.equal(res.statusCode, 401);
    const json = res.json();
    assert.equal(json.error.code, 'INVALID_SESSION_OWNER');
  });

  it('10. Token Type: Malformed or unverified token is strictly REJECTED (401)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: 'malformed.garbage.jwt' },
    });

    assert.equal(res.statusCode, 401);
    const json = res.json();
    assert.equal(json.error.code, 'INVALID_REFRESH_TOKEN');
  });

  // =========================================================================
  // P1-D-03: ATOMIC OTP CONSUMPTION & CONCURRENT RACE CONTROL
  // =========================================================================

  it('11. Atomic OTP Consumption: Concurrent identical verify requests result in exactly ONE 200 and ONE 400', async () => {
    await prisma.oTPVerification.deleteMany({ where: { mobileNumber: testMobile } });
    OtpService.clearCooldown(testMobile);
    const reqRes = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: { mobileNumber: testMobile, role: RoleType.CONSTITUENCY_INCHARGE },
    });
    const { requestId } = reqRes.json().data;

    // Set known OTP hash directly in DB
    const knownCode = '654321';
    await prisma.oTPVerification.update({
      where: { id: requestId },
      data: { otpCode: hashOtp(knownCode, testMobile) },
    });

    // Launch two simultaneous verification requests
    const v1 = app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: { requestId, otpCode: knownCode },
    });
    const v2 = app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: { requestId, otpCode: knownCode },
    });

    const [res1, res2] = await Promise.all([v1, v2]);
    const statuses = [res1.statusCode, res2.statusCode].sort((a: number, b: number) => a - b);

    // Exactly one must succeed (200), the other must be rejected (400 OTP_ALREADY_USED)
    assert.deepEqual(statuses, [200, 400], 'Concurrent OTP verification must yield exactly one 200 and one 400');

    const failRes = res1.statusCode === 400 ? res1 : res2;
    assert.equal(failRes.json().error.code, 'OTP_ALREADY_USED');
  });

  // =========================================================================
  // P1-D-04: ATOMIC OTP ATTEMPT COUNTER CONCURRENCY
  // =========================================================================

  it('12. Atomic Attempt Counter: Max attempts is enforced safely under concurrent invalid attempts', async () => {
    await prisma.oTPVerification.deleteMany({ where: { mobileNumber: testMobile } });
    OtpService.clearCooldown(testMobile);
    const reqRes = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: { mobileNumber: testMobile, role: RoleType.CONSTITUENCY_INCHARGE },
    });
    const { requestId } = reqRes.json().data;

    // Set attempts to 4 (1 remaining before max 5)
    await prisma.oTPVerification.update({
      where: { id: requestId },
      data: { attempts: 4 },
    });

    // Launch 3 simultaneous invalid verification attempts
    const attempts = await Promise.all([
      app.inject({ method: 'POST', url: '/api/auth/verify-otp', payload: { requestId, otpCode: '000001' } }),
      app.inject({ method: 'POST', url: '/api/auth/verify-otp', payload: { requestId, otpCode: '000002' } }),
      app.inject({ method: 'POST', url: '/api/auth/verify-otp', payload: { requestId, otpCode: '000003' } }),
    ]);

    // All should fail, and at least one must receive 429 OTP_MAX_ATTEMPTS_EXCEEDED
    const statusCodes = attempts.map((r) => r.statusCode);
    assert.ok(statusCodes.includes(429), 'Max attempts exceeded must return 429');

    // Subsequent valid OTP attempt must be strictly locked out
    const lockedRes = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: { requestId, otpCode: '654321' },
    });
    assert.equal(lockedRes.statusCode, 429);
    assert.equal(lockedRes.json().error.code, 'OTP_MAX_ATTEMPTS_EXCEEDED');
  });

  // =========================================================================
  // P1-D-05: MSG91 CONTRACT & SENSITIVE CREDENTIAL LEAKAGE PREVENTION
  // =========================================================================

  it('13. MSG91 Contract: AuthKey and OTP are NEVER placed in URL query parameters', async () => {
    let capturedUrl: string | null = null;
    let capturedHeaders: any = null;
    let capturedBody: any = null;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: any, init?: any) => {
      capturedUrl = String(input);
      capturedHeaders = init?.headers;
      capturedBody = JSON.parse(init?.body || '{}');
      return new Response(JSON.stringify({ type: 'success', message: 'OTP sent' }), { status: 200 });
    }) as any;

    try {
      const provider = new Msg91SmsProvider({
        authKey: 'SECRET_MSG91_AUTH_KEY_123',
        templateId: 'TEMPLATE_TEST_101',
      });

      await provider.sendOtp('9876543210', '849201');

      assert.ok(capturedUrl, 'Fetch must have been called');
      const parsedUrl = new URL(capturedUrl);

      // AuthKey MUST NOT be in URL
      assert.equal(parsedUrl.searchParams.get('authkey'), null, 'authkey MUST NOT be in URL query params');
      assert.equal(parsedUrl.searchParams.get('authKey'), null, 'authKey MUST NOT be in URL query params');

      // OTP MUST NOT be in URL
      assert.equal(parsedUrl.searchParams.get('otp'), null, 'otp MUST NOT be in URL query params');
      assert.equal(parsedUrl.searchParams.get('OTP'), null, 'OTP MUST NOT be in URL query params');

      // AuthKey MUST be in Headers
      assert.equal(capturedHeaders['authkey'], 'SECRET_MSG91_AUTH_KEY_123');

      // OTP MUST be in Body
      assert.equal(capturedBody['OTP'], '849201');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // =========================================================================
  // P1-D-06: REFRESH ENDPOINT CSRF ORIGIN VALIDATION
  // =========================================================================

  it('14. Refresh CSRF: Cookie-based refresh request with untrusted Origin is REJECTED (403 FORBIDDEN_CSRF)', async () => {
    const payload = {
      userId: testUser.id,
      userCode: testUser.userCode,
      mobileNumber: testUser.mobileNumber,
      role: testUser.role,
      organisationId: testUser.organisationId,
      unitId: testUser.unitId,
    };
    const { token, refreshToken, sessionId } = TokenService.generateTokens(payload);
    await TokenService.recordLoginSession(testUser.id, testUser.mobileNumber, token, sessionId);

    // Cookie-based refresh with unauthorized attacker origin
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      cookies: { refresh_token: refreshToken },
      headers: {
        origin: 'https://malicious-attacker.evil.com',
      },
    });

    assert.equal(res.statusCode, 403);
    const json = res.json();
    assert.equal(json.error.code, 'FORBIDDEN_CSRF');
  });

  it('15. Refresh CSRF: Body-based refresh request succeeds regardless of Origin header', async () => {
    const payload = {
      userId: testUser.id,
      userCode: testUser.userCode,
      mobileNumber: testUser.mobileNumber,
      role: testUser.role,
      organisationId: testUser.organisationId,
      unitId: testUser.unitId,
    };
    const { token, refreshToken, sessionId } = TokenService.generateTokens(payload);
    await TokenService.recordLoginSession(testUser.id, testUser.mobileNumber, token, sessionId);

    // Explicit body token flow (e.g. mobile app or server-to-server)
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken },
      headers: {
        origin: 'https://mobile-app.kondapi.com',
      },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().success, true);
  });

  // =========================================================================
  // P1-D-07: MSG91 FAILURE HANDLING & FAIL-CLOSED CLEANUP
  // =========================================================================

  it('16. MSG91 Failure: Definitive SMS dispatch failure removes pending OTP and clears cooldown', async () => {
    // Mock failing SMS provider
    SmsProviderFactory.setProvider({
      name: 'msg91',
      sendOtp: async () => ({
        success: false,
        error: 'MSG91 API Gateway 500 Internal Server Error',
        provider: 'msg91',
        timestamp: new Date(),
      }),
      sendTransactional: async () => ({ success: false, provider: 'msg91', timestamp: new Date() }),
    });

    await prisma.oTPVerification.deleteMany({ where: { mobileNumber: testMobile } });
    OtpService.clearCooldown(testMobile);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: { mobileNumber: testMobile, role: RoleType.CONSTITUENCY_INCHARGE },
    });

    assert.equal(res.statusCode, 502, 'SMS dispatch failure must fail closed with 502');
    const json = res.json();
    assert.equal(json.error.code, 'SMS_DISPATCH_FAILED');

    // Verify pending OTP was deleted from database
    const pendingOtps = await prisma.oTPVerification.findMany({
      where: { mobileNumber: testMobile },
    });
    assert.equal(pendingOtps.length, 0, 'Pending OTP must be deleted on definitive dispatch failure');

    // Restore working SMS provider mock
    SmsProviderFactory.setProvider({
      name: 'msg91',
      sendOtp: async () => ({
        success: true,
        messageId: 'mock-msg91-restored',
        provider: 'msg91',
        timestamp: new Date(),
      }),
      sendTransactional: async () => ({ success: true, provider: 'msg91', timestamp: new Date() }),
    });

    // Verify user is NOT locked out by cooldown: immediate subsequent request must succeed
    const retryRes = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: { mobileNumber: testMobile, role: RoleType.CONSTITUENCY_INCHARGE },
    });
    assert.equal(retryRes.statusCode, 200, 'User must be able to retry immediately after dispatch failure');
  });

  // =========================================================================
  // P1-D-08: MSG91 TIMEOUT BOUND
  // =========================================================================

  it('17. MSG91 Timeout: Outbound request terminates with timeout error within configured bound', async () => {
    const originalFetch = globalThis.fetch;
    // Simulate hanging fetch
    globalThis.fetch = ((input: any, init?: any) => {
      return new Promise((resolve, reject) => {
        if (init?.signal) {
          init.signal.addEventListener('abort', () => {
            const err: any = new Error('The operation was aborted');
            err.name = 'TimeoutError';
            reject(err);
          });
        }
      });
    }) as any;

    try {
      const provider = new Msg91SmsProvider({
        authKey: 'test-key',
        timeoutMs: 100, // Short timeout for test
      });

      const startTime = Date.now();
      const result = await provider.sendOtp('9876543210', '123456');
      const elapsed = Date.now() - startTime;

      assert.equal(result.success, false);
      assert.ok(result.error?.includes('timed out'));
      assert.ok(elapsed < 2000, `Request should abort promptly (~100ms), took ${elapsed}ms`);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // =========================================================================
  // P1-D-09: CRYPTOGRAPHIC SECRET SEPARATION
  // =========================================================================

  it('18. Secret Separation: OTP hash uses dedicated OTP_SECRET and differs from JWT_SECRET hash', () => {
    const otp = '928374';
    const mobile = '9876543210';

    const actualOtpHash = hashOtp(otp, mobile);

    // Hash generated using JWT_SECRET
    const hmacJwt = crypto.createHmac('sha256', env.JWT_SECRET);
    hmacJwt.update(`${otp}:${mobile}`);
    const jwtHash = hmacJwt.digest('hex');

    assert.notEqual(
      actualOtpHash,
      jwtHash,
      'OTP hash must use dedicated OTP_SECRET and not be reproducible with JWT_SECRET'
    );
  });
});
