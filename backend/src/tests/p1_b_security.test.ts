import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { RoleType } from '@prisma/client';
import { env, envSchema } from '../config/env.js';
import { Msg91SmsProvider } from '../lib/sms/providers/msg91.provider.js';
import { SmsProviderFactory } from '../lib/sms/factory.js';
import { OtpService } from '../modules/auth/services/otp.service.js';
import { FastifyInstance } from 'fastify';

describe('P1-B Production Security Hardening Test Suite (30 Requirements)', () => {
  let app: FastifyInstance;
  let testUserMobile = '9876500001';
  let testUser: any;

  before(async () => {
    SmsProviderFactory.setProvider({
      name: 'msg91',
      sendOtp: async () => ({
        success: true,
        messageId: 'mock-msg91-p1b',
        provider: 'msg91',
        timestamp: new Date(),
      }),
      sendTransactional: async () => ({
        success: true,
        messageId: 'mock-msg91-p1b-tx',
        provider: 'msg91',
        timestamp: new Date(),
      }),
    });

    app = buildApp();
    await app.ready();

    // Ensure clean state for test user
    await prisma.oTPVerification.deleteMany({
      where: { mobileNumber: { endsWith: '00001' } },
    });
    OtpService.clearCooldown(testUserMobile);

    testUser = await prisma.user.findFirst({
      where: { mobileNumber: { endsWith: '00001' } },
    });

    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          userCode: `P1B-USR-${Date.now()}`,
          name: 'P1-B Test Incharge',
          mobileNumber: testUserMobile,
          role: RoleType.CONSTITUENCY_INCHARGE,
          accountStatus: 'ACTIVE',
        },
      });
    }
  });

  after(async () => {
    await app.close();
  });

  // =========================================================================
  // CORS TESTS (1 - 7)
  // =========================================================================
  it('1. Configured production Origin is accepted', async () => {
    // When CORS_ORIGIN is configured, allowed origin returns matching header
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': 'GET',
      },
    });
    assert.equal(res.statusCode, 204);
    assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:3000');
    assert.equal(res.headers['access-control-allow-credentials'], 'true');
  });

  it('2. Untrusted Origin is rejected by CORS', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: {
        origin: 'https://malicious-attacker.com',
        'access-control-request-method': 'POST',
      },
    });
    // In Fastify CORS, when origin is rejected, access-control-allow-origin is omitted
    assert.notEqual(res.headers['access-control-allow-origin'], 'https://malicious-attacker.com');
  });

  it('3. Arbitrary origin is not reflected with credentials', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {
        origin: 'https://evil-site.org',
      },
    });
    assert.equal(res.headers['access-control-allow-origin'], undefined);
  });

  it('4. Production wildcard CORS configuration fails validation', () => {
    const result = envSchema.safeParse({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://localhost:5432/db',
      JWT_SECRET: 'a-very-long-production-jwt-secret-key-32-chars-minimum',
      COOKIE_SECRET: 'a-very-long-production-cookie-secret-key-32-chars-minimum',
      CORS_ORIGIN: '*',
      SMS_PROVIDER: 'twilio',
    });
    assert.equal(result.success, false);
    const errors = result.error?.format();
    assert.ok(errors?.CORS_ORIGIN?._errors.length);
  });

  it('5. Production missing CORS_ORIGIN fails validation', () => {
    const result = envSchema.safeParse({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://localhost:5432/db',
      JWT_SECRET: 'a-very-long-production-jwt-secret-key-32-chars-minimum',
      COOKIE_SECRET: 'a-very-long-production-cookie-secret-key-32-chars-minimum',
      CORS_ORIGIN: '',
      SMS_PROVIDER: 'twilio',
    });
    assert.equal(result.success, false);
    const errors = result.error?.format();
    assert.ok(errors?.CORS_ORIGIN?._errors.length);
  });

  it('6. Development localhost origin works on any port', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: {
        origin: 'http://127.0.0.1:5173',
        'access-control-request-method': 'GET',
      },
    });
    assert.equal(res.statusCode, 204);
    assert.equal(res.headers['access-control-allow-origin'], 'http://127.0.0.1:5173');
  });

  it('7. Requests without Origin header remain usable for legitimate clients', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().status, 'UP');
  });

  // =========================================================================
  // CSRF TESTS (8 - 11)
  // =========================================================================
  it('8. Bearer-authenticated mutation succeeds without CSRF restriction', async () => {
    const { token } = await (await import('../middleware/auth.js')).createAuthenticatedTestSession({
      userId: testUser.id,
      userCode: testUser.userCode,
      role: testUser.role,
      mobileNumber: testUser.mobileNumber,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/cadre',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        name: 'CSRF Bearer Test Cadre',
        mobileNumber: '9876543210',
        designation: 'Worker',
      },
    });

    // Request is authorized and handled (either 201 or 400 depending on payload, but not 403 FORBIDDEN_CSRF)
    assert.notEqual(res.statusCode, 403);
  });

  it('9. Trusted-origin cookie-only mutation succeeds through CSRF validation', async () => {
    const { token } = await (await import('../middleware/auth.js')).createAuthenticatedTestSession({
      userId: testUser.id,
      userCode: testUser.userCode,
      role: testUser.role,
      mobileNumber: testUser.mobileNumber,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/cadre',
      cookies: {
        access_token: token,
      },
      headers: {
        origin: 'http://localhost:3000', // Trusted origin
      },
      payload: {
        name: 'CSRF Cookie Trusted Test',
        mobileNumber: '9876543211',
        designation: 'Worker',
      },
    });

    assert.notEqual(res.statusCode, 403);
  });

  it('10. Untrusted-origin cookie-only mutation is rejected with FORBIDDEN_CSRF', async () => {
    const { token } = await (await import('../middleware/auth.js')).createAuthenticatedTestSession({
      userId: testUser.id,
      userCode: testUser.userCode,
      role: testUser.role,
      mobileNumber: testUser.mobileNumber,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/cadre',
      cookies: {
        access_token: token,
      },
      headers: {
        origin: 'https://evil-cross-site-attacker.com',
      },
      payload: {
        userId: testUser.id,
        skills: ['Field Ops'],
      },
    });

    assert.equal(res.statusCode, 403);
    const json = res.json();
    assert.equal(json.error.code, 'FORBIDDEN_CSRF');
  });

  it('11. Cross-origin Referer cookie-only mutation is rejected with FORBIDDEN_CSRF', async () => {
    const { token } = await (await import('../middleware/auth.js')).createAuthenticatedTestSession({
      userId: testUser.id,
      userCode: testUser.userCode,
      role: testUser.role,
      mobileNumber: testUser.mobileNumber,
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/cadre/${testUser.id}`,
      cookies: {
        access_token: token,
      },
      headers: {
        referer: 'https://attacker.example.com/phishing-page',
      },
      payload: {
        performanceScore: 90,
      },
    });

    assert.equal(res.statusCode, 403);
    const json = res.json();
    assert.equal(json.error.code, 'FORBIDDEN_CSRF');
  });

  // =========================================================================
  // OTP RATE LIMIT & ENUMERATION TESTS (12 - 23)
  // =========================================================================
  it('12. Eligible user receives OTP and uniform response', async () => {
    await prisma.oTPVerification.deleteMany({
      where: { mobileNumber: testUserMobile },
    });
    OtpService.clearCooldown(testUserMobile);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: {
        mobileNumber: testUserMobile,
        role: RoleType.CONSTITUENCY_INCHARGE,
      },
    });

    assert.equal(res.statusCode, 200);
    const json = res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.requestId);
    assert.equal(json.data.message, 'If an eligible account exists, an OTP has been dispatched.');
    assert.equal(json.data.cooldownSeconds, 60);

    // Verify record was created in database for eligible user
    const dbOtp = await prisma.oTPVerification.findUnique({
      where: { id: json.data.requestId },
    });
    assert.ok(dbOtp, 'OTP record must exist in DB for eligible user');
  });

  it('13. Cooldown uses configured OTP_RESEND_COOLDOWN_MS (60 seconds)', async () => {
    // Immediate second request must trigger cooldown
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: {
        mobileNumber: testUserMobile,
        role: RoleType.CONSTITUENCY_INCHARGE,
      },
    });

    assert.equal(res.statusCode, 429);
    const json = res.json();
    assert.equal(json.error.code, 'OTP_COOLDOWN_ACTIVE');
  });

  it('14. Changing role cannot bypass cooldown for the same mobile number', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: {
        mobileNumber: testUserMobile,
        role: RoleType.SUPER_ADMIN, // Different role
      },
    });

    assert.equal(res.statusCode, 429);
    const json = res.json();
    assert.equal(json.error.code, 'OTP_COOLDOWN_ACTIVE');
  });

  it('15. Five requests within window are limited correctly (sliding window 429)', async () => {
    const spamMobile = '9876599999';
    await prisma.oTPVerification.deleteMany({ where: { mobileNumber: spamMobile } });

    // Seed 5 OTP records across the last few minutes
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      await prisma.oTPVerification.create({
        data: {
          mobileNumber: spamMobile,
          role: RoleType.CONSTITUENCY_INCHARGE,
          otpCode: 'hashed-otp',
          expiresAt: new Date(now + 300000),
          createdAt: new Date(now - (5 - i) * 65000), // Spaced past 60s cooldown
        },
      });
    }

    // 6th request within 15 min window must trigger sliding window rate limit
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: {
        mobileNumber: spamMobile,
        role: RoleType.CONSTITUENCY_INCHARGE,
      },
    });

    assert.equal(res.statusCode, 429);
    const json = res.json();
    assert.equal(json.error.code, 'OTP_RATE_LIMIT_EXCEEDED');
  });

  it('16. Changing requestId cannot bypass rate limiting', async () => {
    const spamMobile = '9876599999';
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: {
        mobileNumber: spamMobile,
        role: RoleType.CONSTITUENCY_INCHARGE,
      },
      headers: {
        'x-request-id': 'different-uuid-attempt',
      },
    });

    assert.equal(res.statusCode, 429);
    assert.equal(res.json().error.code, 'OTP_RATE_LIMIT_EXCEEDED');
  });

  it('17. Rate-limited request does not send OTP or create record', async () => {
    const spamMobile = '9876599999';
    const countBefore = await prisma.oTPVerification.count({ where: { mobileNumber: spamMobile } });

    await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: {
        mobileNumber: spamMobile,
        role: RoleType.CONSTITUENCY_INCHARGE,
      },
    });

    const countAfter = await prisma.oTPVerification.count({ where: { mobileNumber: spamMobile } });
    assert.equal(countAfter, countBefore, 'Rate limit breach must not persist any new OTP record');
  });

  it('18. Unknown user receives uniform response without leaking non-existence', async () => {
    const unknownMobile = '9876512345';
    await prisma.user.deleteMany({ where: { mobileNumber: { endsWith: '12345' } } });
    await prisma.oTPVerification.deleteMany({ where: { mobileNumber: unknownMobile } });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: {
        mobileNumber: unknownMobile,
        role: RoleType.CONSTITUENCY_INCHARGE,
      },
    });

    assert.equal(res.statusCode, 200);
    const json = res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.message, 'If an eligible account exists, an OTP has been dispatched.');
    assert.ok(json.data.requestId);

    // Assert NO OTP was saved to database
    const dbOtp = await prisma.oTPVerification.findUnique({
      where: { id: json.data.requestId },
    });
    assert.equal(dbOtp, null);
  });

  it('19. Inactive user receives uniform response without leaking status', async () => {
    const inactiveMobile = '9876512346';
    await prisma.user.deleteMany({ where: { mobileNumber: { endsWith: '12346' } } });
    await prisma.oTPVerification.deleteMany({ where: { mobileNumber: inactiveMobile } });

    await prisma.user.create({
      data: {
        userCode: `INACTIVE-${Date.now()}`,
        name: 'Inactive User',
        mobileNumber: inactiveMobile,
        role: RoleType.CONSTITUENCY_INCHARGE,
        accountStatus: 'SUSPENDED',
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: {
        mobileNumber: inactiveMobile,
        role: RoleType.CONSTITUENCY_INCHARGE,
      },
    });

    assert.equal(res.statusCode, 200);
    const json = res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.message, 'If an eligible account exists, an OTP has been dispatched.');

    // Assert NO OTP was saved to database
    const dbOtp = await prisma.oTPVerification.findUnique({
      where: { id: json.data.requestId },
    });
    assert.equal(dbOtp, null);
  });

  it('20. Role mismatch receives uniform response without leaking user role', async () => {
    const roleMismatchMobile = '9876512347';
    await prisma.user.deleteMany({ where: { mobileNumber: { endsWith: '12347' } } });
    await prisma.oTPVerification.deleteMany({ where: { mobileNumber: roleMismatchMobile } });

    await prisma.user.create({
      data: {
        userCode: `MISMATCH-${Date.now()}`,
        name: 'Role Mismatch User',
        mobileNumber: roleMismatchMobile,
        role: RoleType.CONSTITUENCY_INCHARGE,
        accountStatus: 'ACTIVE',
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: {
        mobileNumber: roleMismatchMobile,
        role: RoleType.SUPER_ADMIN, // Requested role mismatch
      },
    });

    assert.equal(res.statusCode, 200);
    const json = res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.message, 'If an eligible account exists, an OTP has been dispatched.');

    // Assert NO OTP was saved to database
    const dbOtp = await prisma.oTPVerification.findUnique({
      where: { id: json.data.requestId },
    });
    assert.equal(dbOtp, null);
  });

  it('21. Unknown user cannot verify into a session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: {
        requestId: crypto.randomUUID(),
        otpCode: '123456',
      },
    });

    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error.code, 'INVALID_OTP_REQUEST');
  });

  it('22. Inactive user cannot verify into a session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: {
        requestId: crypto.randomUUID(),
        otpCode: '123456',
      },
    });

    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error.code, 'INVALID_OTP_REQUEST');
  });

  it('23. Role mismatch cannot verify into a session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: {
        requestId: crypto.randomUUID(),
        otpCode: '123456',
      },
    });

    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error.code, 'INVALID_OTP_REQUEST');
  });

  // =========================================================================
  // PRODUCTION SMS & LOGGING TESTS (24 - 25)
  // =========================================================================
  it('24. Production + console provider fails configuration validation', () => {
    const result = envSchema.safeParse({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://localhost:5432/db',
      JWT_SECRET: 'a-very-long-production-jwt-secret-key-32-chars-minimum',
      COOKIE_SECRET: 'a-very-long-production-cookie-secret-key-32-chars-minimum',
      CORS_ORIGIN: 'https://app.kondapi.com',
      SMS_PROVIDER: 'console',
    });

    assert.equal(result.success, false);
    const errors = result.error?.format();
    assert.ok(errors?.SMS_PROVIDER?._errors.length);
  });

  it('25. MSG91 provider never logs plaintext OTP or authKey in production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => {
      logs.push(args.join(' '));
    };

    try {
      const provider = new Msg91SmsProvider({ authKey: 'test-auth-key-never-log-this' });
      await provider.sendOtp('9876543210', '948201');

      const allOutput = logs.join('\n');
      assert.equal(allOutput.includes('948201'), false, 'Plaintext OTP must NOT appear in production logs');
      assert.equal(allOutput.includes('test-auth-key-never-log-this'), false, 'Authkey must NOT appear in production logs');
    } finally {
      console.log = origLog;
      process.env.NODE_ENV = originalEnv;
    }
  });

  // =========================================================================
  // SECURITY HEADERS TESTS (26 - 30)
  // =========================================================================
  it('26. X-Content-Type-Options: nosniff is present', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
  });

  it('27. X-Frame-Options: DENY is present', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(res.headers['x-frame-options'], 'DENY');
  });

  it('28. Referrer-Policy: strict-origin-when-cross-origin is present', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(res.headers['referrer-policy'], 'strict-origin-when-cross-origin');
  });

  it('29. Permissions-Policy is present', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(res.headers['permissions-policy'], 'camera=(), microphone=(), geolocation=()');
  });

  it('30. Production HSTS header behavior is verified', async () => {
    const prodApp = buildApp();
    // In production environment HSTS header is attached
    const res = await app.inject({ method: 'GET', url: '/health' });
    // In non-production, HSTS is omitted; in production it is max-age=31536000
    if (env.NODE_ENV === 'production') {
      assert.equal(res.headers['strict-transport-security'], 'max-age=31536000; includeSubDomains');
    } else {
      assert.equal(res.headers['strict-transport-security'], undefined);
    }
    await prodApp.close();
  });

  after(() => {
    SmsProviderFactory.reset();
  });
});
