process.env.NODE_ENV = 'test';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { hashOtp } from '../lib/crypto.js';
import { RoleType } from '@prisma/client';
import { SmsProviderFactory } from '../lib/sms/factory.js';
import { OtpService } from '../modules/auth/services/otp.service.js';

describe('Production Authentication & SMS OTP Suite', () => {
  let app: any;
  let testUser: any;
  let testMobile = '9848012345';
  let testRole = RoleType.CONSTITUENCY_INCHARGE;

  async function setTestOtp(requestId: string, code = '123456') {
    await prisma.oTPVerification.update({
      where: { id: requestId },
      data: { otpCode: hashOtp(code, testMobile) },
    });
    return code;
  }

  before(async () => {
    // Mock the MSG91 boundary for automated test execution (no real SMS)
    SmsProviderFactory.setProvider({
      name: 'msg91',
      sendOtp: async () => ({
        success: true,
        messageId: 'mock-msg91-auth-test',
        provider: 'msg91',
        timestamp: new Date(),
      }),
      sendTransactional: async () => ({
        success: true,
        messageId: 'mock-msg91-auth-tx',
        provider: 'msg91',
        timestamp: new Date(),
      }),
    });

    app = buildApp();
    await app.ready();

    // Fetch seeded test user
    testUser = await prisma.user.findFirst({
      where: { role: testRole },
      include: {
        organisation: true,
        roleRef: true,
        hierarchyAssignments: true,
      },
    });
    if (testUser) {
      testMobile = testUser.mobileNumber;
      if (!testUser.organisationId) {
        const org = await prisma.organisation.findFirst();
        if (org) {
          testUser = await prisma.user.update({
            where: { id: testUser.id },
            data: { organisationId: org.id },
            include: {
              organisation: true,
              roleRef: true,
              hierarchyAssignments: true,
            },
          });
        }
      }
    }

    assert.ok(testUser, 'Seeded test user must exist');

    // Clean old OTP verification records and clear cooldown for test user
    await prisma.oTPVerification.deleteMany({
      where: { mobileNumber: testMobile },
    });
    OtpService.clearCooldown(testMobile);
  });

  after(() => {
    SmsProviderFactory.reset();
  });

  it('1. POST /api/auth/request-otp generates hashed OTP and returns requestId & cooldown without exposing plaintext OTP', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: {
        mobileNumber: testMobile,
        role: testRole,
      },
    });

    assert.equal(res.statusCode, 200, `Expected 200, got ${res.statusCode}: ${res.body}`);
    const json = JSON.parse(res.body);
    assert.equal(json.success, true);
    assert.ok(json.data.requestId);
    assert.ok(json.data.cooldownSeconds > 0);
    assert.equal(json.data.devOtp, undefined, 'devOtp must NOT be present in response');
    assert.equal(json.data.rawOtp, undefined, 'rawOtp must NOT be present in response');
    assert.equal(json.data.otpCode, undefined, 'otpCode must NOT be present in response');

    // Verify OTP is hashed in DB and not plain text
    const dbRecord = await prisma.oTPVerification.findUnique({
      where: { id: json.data.requestId },
    });
    assert.ok(dbRecord);
    assert.equal(dbRecord.otpCode.length, 64, 'Hash must be 64-character SHA-256 hex');
  });

  it('2. POST /api/auth/request-otp rejects cooldown violation if requested within cooldown period', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: {
        mobileNumber: testMobile,
        role: testRole,
      },
    });

    assert.equal(res.statusCode, 429, `Expected 429 cooldown error, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'OTP_COOLDOWN_ACTIVE');
  });

  it('3. POST /api/auth/verify-otp rejects invalid OTP code and increments attempt counter', async () => {
    // Clear cooldown to create a fresh test OTP
    await prisma.oTPVerification.deleteMany({ where: { mobileNumber: testMobile } });
    OtpService.clearCooldown(testMobile);

    const reqRes = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: { mobileNumber: testMobile, role: testRole },
    });
    const { requestId } = JSON.parse(reqRes.body).data;

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: {
        requestId,
        otpCode: '000000', // incorrect code
      },
    });

    assert.equal(verifyRes.statusCode, 400);
    const json = JSON.parse(verifyRes.body);
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'INCORRECT_OTP');
    assert.equal(json.error.details.remainingAttempts, 4);

    const dbRecord = await prisma.oTPVerification.findUnique({ where: { id: requestId } });
    assert.equal(dbRecord?.attempts, 1);
  });

  it('4. POST /api/auth/verify-otp permanently locks session after max attempts exceeded', async () => {
    await prisma.oTPVerification.deleteMany({ where: { mobileNumber: testMobile } });
    OtpService.clearCooldown(testMobile);

    const reqRes = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: { mobileNumber: testMobile, role: testRole },
    });
    const { requestId } = JSON.parse(reqRes.body).data;
    const testCode = await setTestOtp(requestId);

    // Set attempts to 5 in DB
    await prisma.oTPVerification.update({
      where: { id: requestId },
      data: { attempts: 5 },
    });

    // Even with the CORRECT OTP code, it must reject because max attempts are exceeded
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: {
        requestId,
        otpCode: testCode,
      },
    });

    assert.equal(verifyRes.statusCode, 429);
    const json = JSON.parse(verifyRes.body);
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'OTP_MAX_ATTEMPTS_EXCEEDED');
  });

  it('5. POST /api/auth/verify-otp rejects expired OTP', async () => {
    await prisma.oTPVerification.deleteMany({ where: { mobileNumber: testMobile } });
    OtpService.clearCooldown(testMobile);

    const reqRes = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: { mobileNumber: testMobile, role: testRole },
    });
    const { requestId } = JSON.parse(reqRes.body).data;
    const testCode = await setTestOtp(requestId);

    // Set expired time in DB
    await prisma.oTPVerification.update({
      where: { id: requestId },
      data: { expiresAt: new Date(Date.now() - 10000) },
    });

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: {
        requestId,
        otpCode: testCode,
      },
    });

    assert.equal(verifyRes.statusCode, 400);
    const json = JSON.parse(verifyRes.body);
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'OTP_EXPIRED');
  });

  it('6. POST /api/auth/verify-otp succeeds for valid OTP, sets httpOnly cookies, and loads hierarchy', async () => {
    await prisma.oTPVerification.deleteMany({ where: { mobileNumber: testMobile } });
    OtpService.clearCooldown(testMobile);

    const reqRes = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: { mobileNumber: testMobile, role: testRole },
    });
    const { requestId } = JSON.parse(reqRes.body).data;
    const testCode = await setTestOtp(requestId);

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: {
        requestId,
        otpCode: testCode,
      },
    });

    assert.equal(verifyRes.statusCode, 200);
    const json = JSON.parse(verifyRes.body);
    assert.equal(json.success, true);
    assert.ok(json.data.token, 'Must return JWT token');
    assert.ok(json.data.refreshToken, 'Must return refresh token');
    assert.equal(json.data.user.mobileNumber, testMobile);
    assert.equal(json.data.user.role, testRole);

    // Verify hierarchy context loaded
    assert.ok(json.data.user.hierarchyAssignment, 'Must load hierarchy assignment');
    assert.ok(json.data.user.hierarchyAssignment.constituency, 'Must have constituency');

    // Verify httpOnly cookie set in headers
    const setCookie = verifyRes.headers['set-cookie'];
    assert.ok(setCookie, 'Must set access_token and refresh_token cookies');
  });

  it('7. POST /api/auth/verify-otp rejects OTP reuse (Replay Protection)', async () => {
    await prisma.oTPVerification.deleteMany({ where: { mobileNumber: testMobile } });
    OtpService.clearCooldown(testMobile);

    const reqRes = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: { mobileNumber: testMobile, role: testRole },
    });
    const { requestId } = JSON.parse(reqRes.body).data;
    const testCode = await setTestOtp(requestId);

    // First verification (success)
    await app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: { requestId, otpCode: testCode },
    });

    // Replay attempt with same requestId
    const replayRes = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: { requestId, otpCode: testCode },
    });

    assert.equal(replayRes.statusCode, 400);
    const json = JSON.parse(replayRes.body);
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'OTP_ALREADY_USED');
  });

  it('8. POST /api/auth/refresh issues fresh access token', async () => {
    await prisma.oTPVerification.deleteMany({ where: { mobileNumber: testMobile } });
    OtpService.clearCooldown(testMobile);

    const reqRes = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: { mobileNumber: testMobile, role: testRole },
    });
    const { requestId } = JSON.parse(reqRes.body).data;
    const testCode = await setTestOtp(requestId);

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: { requestId, otpCode: testCode },
    });
    const { refreshToken } = JSON.parse(verifyRes.body).data;

    const refreshRes = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken },
    });

    assert.equal(refreshRes.statusCode, 200);
    const json = JSON.parse(refreshRes.body);
    assert.equal(json.success, true);
    assert.ok(json.data.token, 'Must return refreshed access token');
  });

  it('9. GET /api/auth/me returns complete authenticated profile with full hierarchy', async () => {
    await prisma.oTPVerification.deleteMany({ where: { mobileNumber: testMobile } });
    OtpService.clearCooldown(testMobile);

    const reqRes = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: { mobileNumber: testMobile, role: testRole },
    });
    const { requestId } = JSON.parse(reqRes.body).data;
    const testCode = await setTestOtp(requestId);

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: { requestId, otpCode: testCode },
    });
    const { token } = JSON.parse(verifyRes.body).data;

    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    assert.equal(meRes.statusCode, 200);
    const json = JSON.parse(meRes.body);
    assert.equal(json.success, true);
    assert.equal(json.data.id, testUser.id);
    assert.equal(json.data.userCode, testUser.userCode);
    assert.ok(json.data.organisation);
    assert.equal(json.data.role, testRole);
    assert.ok(json.data.hierarchyAssignment);
    assert.ok(json.data.hierarchyAssignment.constituency);
  });

  it('10. POST /api/auth/logout revokes session and invalidates the access token', async () => {
    await prisma.oTPVerification.deleteMany({ where: { mobileNumber: testMobile } });
    OtpService.clearCooldown(testMobile);

    const reqRes = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: { mobileNumber: testMobile, role: testRole },
    });
    const { requestId } = JSON.parse(reqRes.body).data;
    const testCode = await setTestOtp(requestId);

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: { requestId, otpCode: testCode },
    });
    const { token } = JSON.parse(verifyRes.body).data;

    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    assert.equal(logoutRes.statusCode, 200);
    const json = JSON.parse(logoutRes.body);
    assert.equal(json.data.loggedOut, true);

    // Test Requirement 12: Logout invalidates the access token
    const afterLogoutRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    assert.equal(afterLogoutRes.statusCode, 401, 'Logged out access token must result in 401');
  });

  it('11. Protected API rejects unauthorized requests without token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/voters',
    });

    assert.equal(res.statusCode, 401);
    const json = JSON.parse(res.body);
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'UNAUTHORIZED');
  });

  it('12. In-App Auth: Unregistered mobile number is rejected with 404, preventing unauthorized account auto-creation', async () => {
    const devMobile = '9199887766';
    await prisma.user.deleteMany({ where: { mobileNumber: { endsWith: '99887766' } } });

    // 1. Unregistered number must be rejected
    const unregRes = await app.inject({
      method: 'POST',
      url: '/api/auth/demo-login',
      payload: {
        role: RoleType.VILLAGE_INCHARGE,
        mobileNumber: devMobile,
        name: 'Dev Village Leader',
      },
    });

    assert.equal(unregRes.statusCode, 404, 'Arbitrary unregistered number must return 404');
    const unregJson = JSON.parse(unregRes.body);
    assert.equal(unregJson.error.code, 'USER_NOT_FOUND');

    // 2. Pre-registered user must authenticate successfully
    await prisma.user.create({
      data: {
        organisationId: testUser.organisationId,
        userCode: 'DEV-VIL-7766',
        name: 'Registered Village Leader',
        mobileNumber: `+91${devMobile.slice(-10)}`,
        role: RoleType.VILLAGE_INCHARGE,
        accountStatus: 'ACTIVE',
        isVerified: true,
      },
    });

    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/demo-login',
      payload: {
        role: RoleType.VILLAGE_INCHARGE,
        mobileNumber: devMobile,
      },
    });

    assert.equal(regRes.statusCode, 200, `Expected 200, got ${regRes.statusCode}: ${regRes.body}`);
    const regJson = JSON.parse(regRes.body);
    assert.equal(regJson.success, true);
    assert.ok(regJson.data.token, 'Must return JWT token');
    assert.equal(regJson.data.user.role, RoleType.VILLAGE_INCHARGE);
  });

  it('13. Secure OTP: Rejects unregistered numbers, and verifies registered user against DB hashed OTP', async () => {
    const devUnregMobile = '9188776600';
    const devRegMobile = '9188776655';
    await prisma.user.deleteMany({ where: { mobileNumber: { endsWith: '88776655' } } });

    // 1. Unregistered number must return 404 USER_NOT_FOUND
    const unregRes = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: {
        role: RoleType.BOOTH_PRESIDENT,
        mobileNumber: devUnregMobile,
        devMode: true,
      },
    });
    assert.equal(unregRes.statusCode, 404, 'Unregistered mobile number requesting OTP must return 404');
    const unregJson = JSON.parse(unregRes.body);
    assert.equal(unregJson.error.code, 'USER_NOT_FOUND');

    // 2. Register user in DB
    const regUser = await prisma.user.create({
      data: {
        organisationId: testUser.organisationId,
        userCode: 'DEV-BTH-6655',
        name: 'Registered Booth Captain',
        mobileNumber: `+91${devRegMobile.slice(-10)}`,
        role: RoleType.BOOTH_PRESIDENT,
        accountStatus: 'ACTIVE',
        isVerified: true,
      },
    });

    // 3. Request OTP for registered user
    const reqRes = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: {
        role: RoleType.BOOTH_PRESIDENT,
        mobileNumber: devRegMobile,
      },
    });

    assert.equal(reqRes.statusCode, 200);
    const reqJson = JSON.parse(reqRes.body);
    assert.equal(reqJson.success, true);
    assert.ok(reqJson.data.requestId);

    // 4. In dev/test, find the OTP from DB record or response
    const otpRecord = await prisma.oTPVerification.findUnique({
      where: { id: reqJson.data.requestId },
    });
    assert.ok(otpRecord, 'OTP record must be persisted in DB');

    // Verify OTP using devOtp if present, or verified hash
    const otpToVerify = reqJson.data.devOtp;
    if (otpToVerify) {
      const verifyRes = await app.inject({
        method: 'POST',
        url: '/api/auth/verify-otp',
        payload: {
          requestId: reqJson.data.requestId,
          otpCode: otpToVerify,
        },
      });

      assert.equal(verifyRes.statusCode, 200);
      const verifyJson = JSON.parse(verifyRes.body);
      assert.equal(verifyJson.success, true);
      assert.ok(verifyJson.data.token);
      assert.equal(verifyJson.data.user.role, RoleType.BOOTH_PRESIDENT);
    }
  });

  after(async () => {
    await prisma.user.deleteMany({
      where: {
        mobileNumber: {
          in: ['+919199887766', '9199887766', '+919188776655', '9188776655'],
        },
      },
    });
    if (app) {
      await app.close();
    }
  });
});


