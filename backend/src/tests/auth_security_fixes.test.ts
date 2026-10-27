import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { FastifyInstance } from 'fastify';
import { RoleType, AccountStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { hashOtp } from '../lib/crypto.js';
import { OtpService, isDevMockOtpAllowed } from '../modules/auth/services/otp.service.js';
import { envSchema } from '../config/env.js';
import { buildApp } from '../app.js';
import { generateToken, createAuthenticatedTestSession } from '../middleware/auth.js';
import { SmsProviderFactory } from '../lib/sms/factory.js';

describe('Security Fixes: Production Mock OTP Elimination & Secret Disclosure Prevention Suite', () => {
  let app: FastifyInstance;
  let mockDispatchCount = 0;
  let adminUser: any;
  let nonAdminUser: any;
  const createdSessionIds: string[] = [];

  const previousDemoNumbers = [
    '9848012345',
    '9848088888',
    '9848088887',
    '9848099998',
    '9848099999',
    '9848077777',
    '9848010001',
    '9848010002',
    '9848010003',
    '9848010004',
    '9848010005',
    '9998887777',
    '9736654406',
  ];

  const createdRecordIds: string[] = [];
  const originalNodeEnv = process.env.NODE_ENV;
  const originalEnableMock = process.env.ENABLE_MOCK_OTP;
  const originalEnableDevMock = process.env.ENABLE_DEV_MOCK_OTP;

  before(async () => {
    SmsProviderFactory.setProvider({
      name: 'mock-test-boundary',
      sendOtp: async () => {
        mockDispatchCount++;
        return { success: true, messageId: 'mock-msg-id', provider: 'mock', timestamp: new Date() };
      },
      sendTransactional: async () => {
        mockDispatchCount++;
        return { success: true, messageId: 'mock-tx-id', provider: 'mock', timestamp: new Date() };
      },
      getStatus: () => ({
        provider: 'mock-test-boundary',
        isConnected: false,
        hasQr: true,
        user: '919848012345:1@s.whatsapp.net',
        isOwner: true,
      }),
      getQrCode: () => '2@mock-qr-code-payload-string',
      requestPairingCode: async (_phone: string) => {
        return 'ABC12345';
      },
    } as any);

    app = buildApp();
    await app.ready();

    // Query seeded users for authenticated tests (read-only, no user mutations)
    adminUser = await prisma.user.findFirst({
      where: { role: RoleType.SUPER_ADMIN },
    });

    nonAdminUser = await prisma.user.findFirst({
      where: {
        role: RoleType.CONSTITUENCY_INCHARGE,
        accountStatus: AccountStatus.ACTIVE,
        organisation: {
          parties: { some: { isActive: true } },
        },
      },
    });

    if (!nonAdminUser) {
      const activeOrg = await prisma.organisation.findFirst({
        where: { parties: { some: { isActive: true } } },
      });
      if (activeOrg) {
        nonAdminUser = await prisma.user.upsert({
          where: { userCode: 'TEST-NONADMIN-CADRE' },
          update: {
            role: RoleType.CONSTITUENCY_INCHARGE,
            accountStatus: AccountStatus.ACTIVE,
            organisationId: activeOrg.id,
          },
          create: {
            name: 'Test NonAdmin Cadre',
            userCode: 'TEST-NONADMIN-CADRE',
            mobileNumber: '9109999999',
            role: RoleType.CONSTITUENCY_INCHARGE,
            accountStatus: AccountStatus.ACTIVE,
            organisationId: activeOrg.id,
          },
        });
      }
    }
  });

  after(async () => {
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
    if (originalEnableMock !== undefined) {
      process.env.ENABLE_MOCK_OTP = originalEnableMock;
    } else {
      delete process.env.ENABLE_MOCK_OTP;
    }
    if (originalEnableDevMock !== undefined) {
      process.env.ENABLE_DEV_MOCK_OTP = originalEnableDevMock;
    } else {
      delete process.env.ENABLE_DEV_MOCK_OTP;
    }

    // Clean up test OTP verification records
    if (createdRecordIds.length > 0) {
      await prisma.oTPVerification.deleteMany({
        where: { id: { in: createdRecordIds } },
      }).catch(() => {});
    }

    // Clean up test login sessions
    if (createdSessionIds.length > 0) {
      await prisma.loginSession.deleteMany({
        where: { id: { in: createdSessionIds } },
      }).catch(() => {});
    }

    await app?.close();
    SmsProviderFactory.reset();
  });

  // =========================================================================
  // TEST 1: Production Mode Rejects Static Demo OTP for All 13 Demo Numbers
  // =========================================================================
  it('1. In production mode, static demo OTP (123456) is rejected for every previously hardcoded demo number', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ENABLE_MOCK_OTP;
    delete process.env.ENABLE_DEV_MOCK_OTP;

    assert.equal(isDevMockOtpAllowed(), false, 'isDevMockOtpAllowed must return false in production');

    const legitimateSecretOtp = '765432';

    for (const mobile of previousDemoNumbers) {
      const hashedOtp = hashOtp(legitimateSecretOtp, mobile);
      const record = await prisma.oTPVerification.create({
        data: {
          mobileNumber: mobile,
          role: RoleType.BOOTH_INCHARGE,
          otpCode: hashedOtp,
          expiresAt: new Date(Date.now() + 300000),
          attempts: 0,
        },
      });
      createdRecordIds.push(record.id);

      // Attempt verification with static demo OTP '123456'
      await assert.rejects(
        async () => {
          await OtpService.validateOtpAttempt(record, '123456');
        },
        (err: any) => {
          assert.equal(err.code, 'INCORRECT_OTP', `Mobile ${mobile} must reject static OTP 123456 in production`);
          return true;
        }
      );
    }
  });

  // =========================================================================
  // TEST 2: Legitimate OTP Accepted Only Through Cryptographic Verification
  // =========================================================================
  it('2. Legitimate OTP is accepted only through the intended verification flow (cryptographic hash comparison)', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ENABLE_MOCK_OTP;
    delete process.env.ENABLE_DEV_MOCK_OTP;

    const testMobile = '9848012345';
    const legitimateOtp = '849201';
    const hashedOtp = hashOtp(legitimateOtp, testMobile);

    const record = await prisma.oTPVerification.create({
      data: {
        mobileNumber: testMobile,
        role: RoleType.CONSTITUENCY_INCHARGE,
        otpCode: hashedOtp,
        expiresAt: new Date(Date.now() + 300000),
        attempts: 0,
      },
    });
    createdRecordIds.push(record.id);

    // 1. Wrong OTP is rejected
    await assert.rejects(
      async () => {
        await OtpService.validateOtpAttempt(record, '111111');
      },
      (err: any) => {
        assert.equal(err.code, 'INCORRECT_OTP');
        return true;
      }
    );

    // 2. Legitimate OTP succeeds
    await OtpService.validateOtpAttempt(record, legitimateOtp);

    // 3. Atomically consumed: verifiedAt is set
    const updated = await prisma.oTPVerification.findUnique({ where: { id: record.id } });
    assert.ok(updated?.verifiedAt, 'Record must be marked verified upon legitimate verification');

    // 4. Replay rejected: Cannot be reused
    await assert.rejects(
      async () => {
        await OtpService.validateOtpAttempt(updated, legitimateOtp);
      },
      (err: any) => {
        assert.equal(err.code, 'OTP_ALREADY_USED');
        return true;
      }
    );
  });

  // =========================================================================
  // TEST 3: Development-Only OTP Works ONLY When Explicitly Allowed in Non-Prod
  // =========================================================================
  it('3. Development-only OTP behavior works only when explicitly allowed in a non-production environment', async () => {
    const testMobile = '9848010001';
    const legitimateOtp = '930182';
    const hashedOtp = hashOtp(legitimateOtp, testMobile);

    // Case A: development environment WITHOUT explicit flag -> Fails closed
    process.env.NODE_ENV = 'development';
    delete process.env.ENABLE_DEV_MOCK_OTP;
    delete process.env.ENABLE_MOCK_OTP;

    assert.equal(isDevMockOtpAllowed(), false, 'isDevMockOtpAllowed must fail closed in dev without explicit flag');

    const recordDevDefault = await prisma.oTPVerification.create({
      data: {
        mobileNumber: testMobile,
        role: RoleType.VILLAGE_INCHARGE,
        otpCode: hashedOtp,
        expiresAt: new Date(Date.now() + 300000),
        attempts: 0,
      },
    });
    createdRecordIds.push(recordDevDefault.id);

    await assert.rejects(
      async () => {
        await OtpService.validateOtpAttempt(recordDevDefault, '123456');
      },
      (err: any) => {
        assert.equal(err.code, 'INCORRECT_OTP');
        return true;
      }
    );

    // Case B: development environment WITH explicit ENABLE_DEV_MOCK_OTP=true -> Allowed
    process.env.NODE_ENV = 'development';
    process.env.ENABLE_DEV_MOCK_OTP = 'true';

    assert.equal(isDevMockOtpAllowed(), true, 'isDevMockOtpAllowed must return true when explicitly enabled in dev');

    const recordDevEnabled = await prisma.oTPVerification.create({
      data: {
        mobileNumber: testMobile,
        role: RoleType.VILLAGE_INCHARGE,
        otpCode: hashedOtp,
        expiresAt: new Date(Date.now() + 300000),
        attempts: 0,
      },
    });
    createdRecordIds.push(recordDevEnabled.id);

    await OtpService.validateOtpAttempt(recordDevEnabled, '123456');
    const consumedDev = await prisma.oTPVerification.findUnique({ where: { id: recordDevEnabled.id } });
    assert.ok(consumedDev?.verifiedAt, 'Must be successfully consumed under explicit dev opt-in');

    // Case C: production environment WITH ENABLE_DEV_MOCK_OTP=true -> PRODUCTION LOCKOUT OVERRIDES
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_DEV_MOCK_OTP = 'true';
    process.env.ENABLE_MOCK_OTP = 'true';

    assert.equal(isDevMockOtpAllowed(), false, 'Production lockout must strictly override dev mock flags');

    const recordProdAttempt = await prisma.oTPVerification.create({
      data: {
        mobileNumber: testMobile,
        role: RoleType.VILLAGE_INCHARGE,
        otpCode: hashedOtp,
        expiresAt: new Date(Date.now() + 300000),
        attempts: 0,
      },
    });
    createdRecordIds.push(recordProdAttempt.id);

    await assert.rejects(
      async () => {
        await OtpService.validateOtpAttempt(recordProdAttempt, '123456');
      },
      (err: any) => {
        assert.equal(err.code, 'INCORRECT_OTP');
        return true;
      }
    );
  });

  // =========================================================================
  // TEST 4: Production Mode Emits No OTP Values in Console Output
  // =========================================================================
  it('4. Production mode emits no OTP values in console output', () => {
    process.env.NODE_ENV = 'production';

    const logs: string[] = [];
    const origLog = console.log;
    const origWarn = console.warn;
    const origError = console.error;

    console.log = (...args: any[]) => logs.push(args.join(' '));
    console.warn = (...args: any[]) => logs.push(args.join(' '));
    console.error = (...args: any[]) => logs.push(args.join(' '));

    const secretOtpCode = '839201';
    const rawMobile = '9848012345';

    try {
      OtpService.printTerminalOtp({
        mobileNumber: rawMobile,
        rawOtp: secretOtpCode,
        role: 'BOOTH_INCHARGE',
        purpose: 'Real Account Login',
        channel: 'SMS',
      });

      const combinedOutput = logs.join('\n');

      // Crucial assertions: Plaintext OTP must NOT appear anywhere in output
      assert.equal(combinedOutput.includes(secretOtpCode), false, 'Plaintext OTP must NOT appear in console output');
      assert.equal(combinedOutput.includes('KEY:'), false, 'Key labels must not expose secrets');
      assert.equal(combinedOutput.includes('TERMINAL OTP DISPATCH'), false, 'Dev box must not appear in production');

      // Safe operational log must be present with masked target
      assert.ok(combinedOutput.includes('[OTP Dispatch]'), 'Safe operational log must be emitted');
      assert.ok(combinedOutput.includes('Target: +91 ******2345'), 'Target mobile must be masked');
      assert.ok(combinedOutput.includes('Purpose: Real Account Login'), 'Purpose must be present');
    } finally {
      console.log = origLog;
      console.warn = origWarn;
      console.error = origError;
    }
  });

  // =========================================================================
  // TEST 5: Missing or Invalid Environment Configuration Fails Closed
  // =========================================================================
  it('5. Missing or invalid environment configuration cannot enable the bypass', async () => {
    const testMobile = '9848012345';
    const hashedOtp = hashOtp('998877', testMobile);

    const testEnvCases = ['', 'staging', 'preview', 'uat', 'invalid_environment', 'DEVELOPMENT_TYPO'];

    for (const badEnv of testEnvCases) {
      process.env.NODE_ENV = badEnv;
      process.env.ENABLE_DEV_MOCK_OTP = 'true';
      process.env.ENABLE_MOCK_OTP = 'true';

      assert.equal(
        isDevMockOtpAllowed(),
        false,
        `Environment '${badEnv}' must fail closed even if ENABLE_MOCK_OTP=true`
      );

      const record = await prisma.oTPVerification.create({
        data: {
          mobileNumber: testMobile,
          role: RoleType.CONSTITUENCY_INCHARGE,
          otpCode: hashedOtp,
          expiresAt: new Date(Date.now() + 300000),
          attempts: 0,
        },
      });
      createdRecordIds.push(record.id);

      await assert.rejects(
        async () => {
          await OtpService.validateOtpAttempt(record, '123456');
        },
        (err: any) => {
          assert.equal(err.code, 'INCORRECT_OTP', `Environment '${badEnv}' must reject static OTP 123456`);
          return true;
        }
      );
    }

    // Configuration check: envSchema in env.ts rejects production with mock OTP flag
    const invalidProdConfig = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://localhost:5432/db',
      JWT_SECRET: 'a-cryptographically-random-string-at-least-32-chars-long',
      COOKIE_SECRET: 'another-secure-secret-key-at-least-32-chars-long',
      OTP_SECRET: 'production-super-secure-otp-secret-key-32-chars',
      ENABLE_MOCK_OTP: 'true',
    };

    const parseResult = envSchema.safeParse(invalidProdConfig);
    assert.equal(parseResult.success, false, 'envSchema must reject production config with ENABLE_MOCK_OTP=true');
    if (!parseResult.success) {
      const issues = parseResult.error.issues;
      const mockIssue = issues.find((i) => i.path.includes('ENABLE_MOCK_OTP'));
      assert.ok(mockIssue, 'Error issue must specifically identify ENABLE_MOCK_OTP violation');
      assert.ok(mockIssue.message.includes('Security Violation'));
    }
  });

  // =========================================================================
  // TEST 6: WhatsApp Test Endpoint - Unauthenticated requests are rejected (401)
  // =========================================================================
  it('6. WhatsApp test endpoint: Unauthenticated requests are rejected with 401 in non-prod', async () => {
    delete process.env.NODE_ENV;
    mockDispatchCount = 0;

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/whatsapp/test?phone=9848012345',
    });

    assert.equal(res.statusCode, 401, `Expected 401, got ${res.statusCode}: ${res.body}`);
    const json = JSON.parse(res.body);
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'UNAUTHORIZED');
    assert.equal(mockDispatchCount, 0, 'No outbound message must be triggered on unauthenticated request');
  });

  // =========================================================================
  // TEST 7: WhatsApp Test Endpoint - Authenticated non-administrators rejected (403)
  // =========================================================================
  it('7. WhatsApp test endpoint: Authenticated non-administrators are rejected with 403', async () => {
    delete process.env.NODE_ENV;
    mockDispatchCount = 0;

    assert.ok(nonAdminUser, 'Seeded non-admin user must exist in staging DB');
    const { token: nonAdminToken, sessionId } = await createAuthenticatedTestSession({
      userId: nonAdminUser.id,
      userCode: nonAdminUser.userCode,
      mobileNumber: nonAdminUser.mobileNumber,
      role: nonAdminUser.role,
      organisationId: nonAdminUser.organisationId,
      unitId: nonAdminUser.unitId,
    });
    createdSessionIds.push(sessionId);

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/whatsapp/test?phone=9848012345',
      headers: {
        authorization: `Bearer ${nonAdminToken}`,
      },
    });

    assert.equal(res.statusCode, 403, `Expected 403, got ${res.statusCode}: ${res.body}`);
    const json = JSON.parse(res.body);
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'FORBIDDEN_ROLE');
    assert.equal(mockDispatchCount, 0, 'No outbound message must be triggered for non-administrator');
  });

  // =========================================================================
  // TEST 8: WhatsApp Test Endpoint - Unavailable in production (404), even for admin
  // =========================================================================
  it('8. WhatsApp test endpoint: Unavailable in production (404), even if requester is an administrator', async () => {
    process.env.NODE_ENV = 'production';
    mockDispatchCount = 0;

    assert.ok(adminUser, 'Seeded SUPER_ADMIN must exist in staging DB');
    const { token: adminToken, sessionId } = await createAuthenticatedTestSession({
      userId: adminUser.id,
      userCode: adminUser.userCode,
      mobileNumber: adminUser.mobileNumber,
      role: adminUser.role,
      organisationId: adminUser.organisationId,
      unitId: adminUser.unitId,
    });
    createdSessionIds.push(sessionId);

    // 1. Admin caller in production -> 404
    const adminRes = await app.inject({
      method: 'GET',
      url: '/api/auth/whatsapp/test?phone=9848012345',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    assert.equal(adminRes.statusCode, 404, `Expected 404 in production, got ${adminRes.statusCode}`);
    const adminJson = JSON.parse(adminRes.body);
    assert.equal(adminJson.success, false);
    assert.equal(adminJson.error.code, 'NOT_FOUND');
    assert.equal(mockDispatchCount, 0, 'No outbound message must be sent in production');

    // 2. Unauthenticated caller in production -> 404 non-revealing
    const unauthRes = await app.inject({
      method: 'GET',
      url: '/api/auth/whatsapp/test?phone=9848012345',
    });
    assert.equal(unauthRes.statusCode, 404, `Expected 404 in production, got ${unauthRes.statusCode}`);
    assert.equal(mockDispatchCount, 0, 'No outbound message must be sent in production');
  });

  // =========================================================================
  // TEST 9: WhatsApp Test Endpoint - Authorized admin test in non-prod never exposes raw OTPs or secrets
  // =========================================================================
  it('9. WhatsApp test endpoint: Authorized admin test in non-prod never exposes raw OTPs or secrets', async () => {
    delete process.env.NODE_ENV;
    mockDispatchCount = 0;

    assert.ok(adminUser, 'Seeded SUPER_ADMIN must exist in staging DB');
    const { token: adminToken, sessionId } = await createAuthenticatedTestSession({
      userId: adminUser.id,
      userCode: adminUser.userCode,
      mobileNumber: adminUser.mobileNumber,
      role: adminUser.role,
      organisationId: adminUser.organisationId,
      unitId: adminUser.unitId,
    });
    createdSessionIds.push(sessionId);

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/whatsapp/test?phone=9848012345',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    assert.equal(res.statusCode, 200, `Expected 200, got ${res.statusCode}: ${res.body}`);
    const json = JSON.parse(res.body);
    assert.equal(json.success, true);
    assert.equal(json.data.delivered, true);
    assert.ok(json.data.recipient.includes('******'), 'Recipient must be masked');
    assert.equal(json.data.otp, undefined, 'Raw OTP must NEVER be returned in response');
    assert.equal(json.data.testOtp, undefined, 'testOtp must NEVER be returned in response');
    assert.equal(json.data.rawOtp, undefined, 'rawOtp must NEVER be returned in response');
    assert.equal(json.data.otpCode, undefined, 'otpCode must NEVER be returned in response');
    assert.equal(json.data.senderUser, undefined, 'senderUser credentials must NEVER be returned in response');
    assert.equal(res.body.includes('123456'), false, 'Hardcoded 123456 must NEVER be in response');

    // Verified mock provider was used (no real external network call)
    assert.equal(mockDispatchCount, 1, 'Mock provider safely intercepted test dispatch');
  });

  // =========================================================================
  // TEST 10: WhatsApp Test Endpoint - Invalid query parameters are rejected (400)
  // =========================================================================
  it('10. WhatsApp test endpoint: Invalid query phone format is rejected with 400', async () => {
    delete process.env.NODE_ENV;
    mockDispatchCount = 0;

    assert.ok(adminUser, 'Seeded SUPER_ADMIN must exist in staging DB');
    const { token: adminToken, sessionId } = await createAuthenticatedTestSession({
      userId: adminUser.id,
      userCode: adminUser.userCode,
      mobileNumber: adminUser.mobileNumber,
      role: adminUser.role,
      organisationId: adminUser.organisationId,
      unitId: adminUser.unitId,
    });
    createdSessionIds.push(sessionId);

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/whatsapp/test?phone=123',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    assert.equal(res.statusCode, 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'INVALID_PHONE_NUMBER');
    assert.equal(mockDispatchCount, 0, 'No outbound message must be sent on invalid input');
  });

  // =========================================================================
  // TEST 11: GET /api/auth/whatsapp/status requires platform administrator authorization
  // =========================================================================
  it('11. GET /api/auth/whatsapp/status: Rejects unauthenticated and non-admin requests, permits authorized admin with sanitized payload', async () => {
    delete process.env.NODE_ENV;

    // 1. Unauthenticated -> 401
    const unauthRes = await app.inject({
      method: 'GET',
      url: '/api/auth/whatsapp/status',
    });
    assert.equal(unauthRes.statusCode, 401, `Unauthenticated must return 401, got ${unauthRes.statusCode}`);
    const unauthJson = JSON.parse(unauthRes.body);
    assert.equal(unauthJson.success, false);
    assert.equal(unauthJson.error.code, 'UNAUTHORIZED');

    // 2. Authenticated non-admin -> 403
    assert.ok(nonAdminUser, 'Seeded non-admin user must exist');
    const { token: nonAdminToken, sessionId: nonAdminSid } = await createAuthenticatedTestSession({
      userId: nonAdminUser.id,
      userCode: nonAdminUser.userCode,
      mobileNumber: nonAdminUser.mobileNumber,
      role: nonAdminUser.role,
      organisationId: nonAdminUser.organisationId,
      unitId: nonAdminUser.unitId,
    });
    createdSessionIds.push(nonAdminSid);

    const nonAdminRes = await app.inject({
      method: 'GET',
      url: '/api/auth/whatsapp/status',
      headers: { authorization: `Bearer ${nonAdminToken}` },
    });
    assert.equal(nonAdminRes.statusCode, 403, `Non-admin must return 403, got ${nonAdminRes.statusCode}`);
    const nonAdminJson = JSON.parse(nonAdminRes.body);
    assert.equal(nonAdminJson.success, false);
    assert.equal(nonAdminJson.error.code, 'FORBIDDEN_ROLE');

    // 3. Authenticated administrator -> 200 with sanitized data
    assert.ok(adminUser, 'Seeded admin user must exist');
    const { token: adminToken, sessionId: adminSid } = await createAuthenticatedTestSession({
      userId: adminUser.id,
      userCode: adminUser.userCode,
      mobileNumber: adminUser.mobileNumber,
      role: adminUser.role,
      organisationId: adminUser.organisationId,
      unitId: adminUser.unitId,
    });
    createdSessionIds.push(adminSid);

    const adminRes = await app.inject({
      method: 'GET',
      url: '/api/auth/whatsapp/status',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminRes.statusCode, 200, `Admin must return 200, got ${adminRes.statusCode}`);
    const adminJson = JSON.parse(adminRes.body);
    assert.equal(adminJson.success, true);
    assert.equal(adminJson.data.provider, 'mock-test-boundary');
    // Ensure raw JID "919848012345:1@s.whatsapp.net" is NOT leaked, masked as +91 ******2345
    assert.equal(adminRes.body.includes('s.whatsapp.net'), false, 'Raw JID domain must not be leaked');
    assert.ok(adminJson.data.user.includes('******'), 'User identifier must be masked');
  });

  // =========================================================================
  // TEST 12: GET /api/auth/whatsapp/qr requires platform administrator authorization
  // =========================================================================
  it('12. GET /api/auth/whatsapp/qr: Rejects unauthenticated and non-admin requests, permits authorized admin', async () => {
    delete process.env.NODE_ENV;

    // 1. Unauthenticated -> 401
    const unauthRes = await app.inject({
      method: 'GET',
      url: '/api/auth/whatsapp/qr',
    });
    assert.equal(unauthRes.statusCode, 401, `Unauthenticated must return 401, got ${unauthRes.statusCode}`);

    // 2. Authenticated non-admin -> 403
    assert.ok(nonAdminUser);
    const { token: nonAdminToken, sessionId: nonAdminSid } = await createAuthenticatedTestSession({
      userId: nonAdminUser.id,
      userCode: nonAdminUser.userCode,
      mobileNumber: nonAdminUser.mobileNumber,
      role: nonAdminUser.role,
      organisationId: nonAdminUser.organisationId,
      unitId: nonAdminUser.unitId,
    });
    createdSessionIds.push(nonAdminSid);

    const nonAdminRes = await app.inject({
      method: 'GET',
      url: '/api/auth/whatsapp/qr',
      headers: { authorization: `Bearer ${nonAdminToken}` },
    });
    assert.equal(nonAdminRes.statusCode, 403, `Non-admin must return 403, got ${nonAdminRes.statusCode}`);

    // 3. Authenticated admin -> 200 HTML
    assert.ok(adminUser);
    const { token: adminToken, sessionId: adminSid } = await createAuthenticatedTestSession({
      userId: adminUser.id,
      userCode: adminUser.userCode,
      mobileNumber: adminUser.mobileNumber,
      role: adminUser.role,
      organisationId: adminUser.organisationId,
      unitId: adminUser.unitId,
    });
    createdSessionIds.push(adminSid);

    const adminRes = await app.inject({
      method: 'GET',
      url: '/api/auth/whatsapp/qr',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminRes.statusCode, 200, `Admin must return 200, got ${adminRes.statusCode}`);
    assert.ok(adminRes.headers['content-type']?.includes('text/html'), 'Must return HTML for admin dashboard');
    assert.ok(adminRes.body.includes('Link WhatsApp OTP Gateway'));
  });

  // =========================================================================
  // TEST 13: GET /api/auth/whatsapp/qr.png requires platform administrator authorization
  // =========================================================================
  it('13. GET /api/auth/whatsapp/qr.png: Rejects unauthenticated and non-admin requests, permits authorized admin with image buffer', async () => {
    delete process.env.NODE_ENV;

    // 1. Unauthenticated -> 401
    const unauthRes = await app.inject({
      method: 'GET',
      url: '/api/auth/whatsapp/qr.png',
    });
    assert.equal(unauthRes.statusCode, 401, `Unauthenticated must return 401, got ${unauthRes.statusCode}`);

    // 2. Authenticated non-admin -> 403
    assert.ok(nonAdminUser);
    const { token: nonAdminToken, sessionId: nonAdminSid } = await createAuthenticatedTestSession({
      userId: nonAdminUser.id,
      userCode: nonAdminUser.userCode,
      mobileNumber: nonAdminUser.mobileNumber,
      role: nonAdminUser.role,
      organisationId: nonAdminUser.organisationId,
      unitId: nonAdminUser.unitId,
    });
    createdSessionIds.push(nonAdminSid);

    const nonAdminRes = await app.inject({
      method: 'GET',
      url: '/api/auth/whatsapp/qr.png',
      headers: { authorization: `Bearer ${nonAdminToken}` },
    });
    assert.equal(nonAdminRes.statusCode, 403, `Non-admin must return 403, got ${nonAdminRes.statusCode}`);

    // 3. Authenticated admin -> 200 image/png
    assert.ok(adminUser);
    const { token: adminToken, sessionId: adminSid } = await createAuthenticatedTestSession({
      userId: adminUser.id,
      userCode: adminUser.userCode,
      mobileNumber: adminUser.mobileNumber,
      role: adminUser.role,
      organisationId: adminUser.organisationId,
      unitId: adminUser.unitId,
    });
    createdSessionIds.push(adminSid);

    const adminRes = await app.inject({
      method: 'GET',
      url: '/api/auth/whatsapp/qr.png',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminRes.statusCode, 200, `Admin must return 200, got ${adminRes.statusCode}`);
    assert.equal(adminRes.headers['content-type'], 'image/png', 'Must return image/png');
    assert.ok(adminRes.rawPayload.length > 0, 'Must return valid image buffer');
  });

  // =========================================================================
  // TEST 14: POST /api/auth/whatsapp/pair requires platform administrator authorization
  // =========================================================================
  it('14. POST /api/auth/whatsapp/pair: Rejects unauthenticated, non-admin, and invalid inputs; allows authorized admin', async () => {
    delete process.env.NODE_ENV;

    // 1. Unauthenticated -> 401
    const unauthRes = await app.inject({
      method: 'POST',
      url: '/api/auth/whatsapp/pair',
      payload: { phoneNumber: '9848012345' },
    });
    assert.equal(unauthRes.statusCode, 401, `Unauthenticated must return 401, got ${unauthRes.statusCode}`);

    // 2. Authenticated non-admin -> 403
    assert.ok(nonAdminUser);
    const { token: nonAdminToken, sessionId: nonAdminSid } = await createAuthenticatedTestSession({
      userId: nonAdminUser.id,
      userCode: nonAdminUser.userCode,
      mobileNumber: nonAdminUser.mobileNumber,
      role: nonAdminUser.role,
      organisationId: nonAdminUser.organisationId,
      unitId: nonAdminUser.unitId,
    });
    createdSessionIds.push(nonAdminSid);

    const nonAdminRes = await app.inject({
      method: 'POST',
      url: '/api/auth/whatsapp/pair',
      headers: { authorization: `Bearer ${nonAdminToken}` },
      payload: { phoneNumber: '9848012345' },
    });
    assert.equal(nonAdminRes.statusCode, 403, `Non-admin must return 403, got ${nonAdminRes.statusCode}`);

    // 3. Authenticated admin with invalid input format -> 400
    assert.ok(adminUser);
    const { token: adminToken, sessionId: adminSid } = await createAuthenticatedTestSession({
      userId: adminUser.id,
      userCode: adminUser.userCode,
      mobileNumber: adminUser.mobileNumber,
      role: adminUser.role,
      organisationId: adminUser.organisationId,
      unitId: adminUser.unitId,
    });
    createdSessionIds.push(adminSid);

    const badInputRes = await app.inject({
      method: 'POST',
      url: '/api/auth/whatsapp/pair',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { phoneNumber: '123' },
    });
    assert.equal(badInputRes.statusCode, 400, `Invalid phone input must return 400, got ${badInputRes.statusCode}`);
    const badInputJson = JSON.parse(badInputRes.body);
    assert.equal(badInputJson.error.code, 'INVALID_PHONE_NUMBER');

    // 4. Authenticated admin with valid input -> 200 with pairing code
    const validRes = await app.inject({
      method: 'POST',
      url: '/api/auth/whatsapp/pair',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { phoneNumber: '9848012345' },
    });
    assert.equal(validRes.statusCode, 200, `Valid admin pair must return 200, got ${validRes.statusCode}`);
    const validJson = JSON.parse(validRes.body);
    assert.equal(validJson.success, true);
    assert.equal(validJson.data.pairingCode, 'ABC12345');
  });

  // =========================================================================
  // TEST 15: Production environment enforces strict authorization across gateway management routes
  // =========================================================================
  it('15. Production environment enforces strict authentication/authorization on all gateway management routes', async () => {
    process.env.NODE_ENV = 'production';

    const routes = [
      { method: 'GET', url: '/api/auth/whatsapp/status' },
      { method: 'GET', url: '/api/auth/whatsapp/qr' },
      { method: 'GET', url: '/api/auth/whatsapp/qr.png' },
      { method: 'POST', url: '/api/auth/whatsapp/pair', payload: { phoneNumber: '9848012345' } },
    ];

    for (const r of routes) {
      // 1. Unauthenticated in production must be rejected (401)
      const unauth = await app.inject({
        method: r.method as any,
        url: r.url,
        payload: r.payload,
      });
      assert.equal(unauth.statusCode, 401, `Unauthenticated ${r.method} ${r.url} in production must return 401`);

      // 2. Non-admin in production must be rejected (403)
      assert.ok(nonAdminUser);
      const { token: nonAdminToken, sessionId: nonAdminSid } = await createAuthenticatedTestSession({
        userId: nonAdminUser.id,
        userCode: nonAdminUser.userCode,
        mobileNumber: nonAdminUser.mobileNumber,
        role: nonAdminUser.role,
        organisationId: nonAdminUser.organisationId,
        unitId: nonAdminUser.unitId,
      });
      createdSessionIds.push(nonAdminSid);

      const nonAdmin = await app.inject({
        method: r.method as any,
        url: r.url,
        headers: { authorization: `Bearer ${nonAdminToken}` },
        payload: r.payload,
      });
      assert.equal(nonAdmin.statusCode, 403, `Non-admin ${r.method} ${r.url} in production must return 403`);
    }
  });

  // =========================================================================
  // TEST 16: Cache-Control protection: sensitive API endpoints return no-store
  // =========================================================================
  it('16. All sensitive API responses enforce Cache-Control: no-store and cache prevention headers', async () => {
    assert.ok(adminUser);
    const { token: adminToken, sessionId: adminSid } = await createAuthenticatedTestSession({
      userId: adminUser.id,
      userCode: adminUser.userCode,
      mobileNumber: adminUser.mobileNumber,
      role: adminUser.role,
      organisationId: adminUser.organisationId,
      unitId: adminUser.unitId,
    });
    createdSessionIds.push(adminSid);

    const endpoints = [
      { method: 'GET', url: '/api/auth/me', headers: { authorization: `Bearer ${adminToken}` } },
      { method: 'GET', url: '/api/auth/whatsapp/status', headers: { authorization: `Bearer ${adminToken}` } },
      { method: 'GET', url: '/api/voters', headers: { authorization: `Bearer ${adminToken}` } },
      { method: 'POST', url: '/api/auth/request-otp', payload: { phoneNumber: '9848012345' } },
      { method: 'GET', url: '/health' },
    ];

    for (const ep of endpoints) {
      const res = await app.inject({
        method: ep.method as any,
        url: ep.url,
        headers: ep.headers,
        payload: (ep as any).payload,
      });

      const cacheControl = res.headers['cache-control'];
      const pragma = res.headers['pragma'];
      const expires = res.headers['expires'];
      const surrogate = res.headers['surrogate-control'];

      assert.ok(
        typeof cacheControl === 'string' && cacheControl.includes('no-store'),
        `Endpoint ${ep.method} ${ep.url} must return Cache-Control with 'no-store', got '${cacheControl}'`
      );
      assert.ok(
        typeof cacheControl === 'string' && cacheControl.includes('no-cache'),
        `Endpoint ${ep.method} ${ep.url} must return Cache-Control with 'no-cache', got '${cacheControl}'`
      );
      assert.equal(pragma, 'no-cache', `Endpoint ${ep.method} ${ep.url} must return Pragma: no-cache`);
      assert.equal(expires, '0', `Endpoint ${ep.method} ${ep.url} must return Expires: 0`);
      assert.equal(surrogate, 'no-store', `Endpoint ${ep.method} ${ep.url} must return Surrogate-Control: no-store`);
    }
  });

  // =========================================================================
  // TEST 17: Statutory 100-Active-Voter Group Limit Enforced on Voter Creation and Mutation
  // =========================================================================
  it('17. VotersService rejects adding an active voter to a voter group that already has 100 active voters', async () => {
    const { VotersService } = await import('../modules/voters/voters.service.js');

    // Find or pick a group with 100 or more active voters (e.g. Group 1 of Booth 9 or Booth 1)
    const saturatedGroup = await prisma.voterGroup.findFirst({
      where: {
        voters: {
          some: { voterStatus: 'ACTIVE' },
        },
      },
      include: {
        _count: {
          select: { voters: { where: { voterStatus: 'ACTIVE' } } },
        },
        booth: {
          include: {
            village: {
              include: {
                mandal: true,
              },
            },
          },
        },
      },
    });

    assert.ok(saturatedGroup, 'Must have at least one voter group in test database');

    // Only test capacity rejection if group has >= 100 active voters
    if (saturatedGroup._count.voters >= 100) {
      // Test 1: createVoter into saturated group must fail with VOTER_GROUP_CAPACITY_EXCEEDED
      await assert.rejects(
        async () => {
          await VotersService.createVoter(
            {
              epicNumber: 'TESTCAPACITY999',
              name: 'Test Capacity Elector',
              fatherHusbandName: 'Father Name',
              houseNumber: '1-100',
              relationType: 'FATHER' as any,
              gender: 'MALE' as any,
              age: 30,
              politicalPreference: 'NEUTRAL',
              voterStatus: 'ACTIVE' as any,
              surveyStatus: 'NOT_SURVEYED' as any,
              voterLocationStatus: 'LOCAL' as any,
              boothId: saturatedGroup.boothId,
              voterGroupId: saturatedGroup.id,
              constituencyId: saturatedGroup.booth.village.mandal.constituencyId,
            },
            adminUser.id
          );
        },
        (err: any) => {
          assert.equal(err.code, 'VOTER_GROUP_CAPACITY_EXCEEDED');
          assert.equal(err.statusCode, 400);
          return true;
        },
        'Creating voter in saturated group must throw VOTER_GROUP_CAPACITY_EXCEEDED'
      );
    }
  });
});

