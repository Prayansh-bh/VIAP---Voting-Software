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

  it('12. In-App Dev Mode: 1-click instant login provisions new user and authenticates successfully', async () => {
    const devMobile = '9199887766';
    await prisma.user.deleteMany({ where: { mobileNumber: { endsWith: '99887766' } } });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/demo-login',
      payload: {
        role: RoleType.VILLAGE_INCHARGE,
        mobileNumber: devMobile,
        name: 'Dev Village Leader',
      },
    });

    assert.equal(res.statusCode, 200, `Expected 200, got ${res.statusCode}: ${res.body}`);
    const json = JSON.parse(res.body);
    assert.equal(json.success, true);
    assert.ok(json.data.token, 'Must return JWT token');
    assert.equal(json.data.user.role, RoleType.VILLAGE_INCHARGE);
    assert.equal(json.data.user.mobileNumber, '9199887766');

    // Confirm user was created in the database and active
    const dbUser = await prisma.user.findFirst({
      where: { mobileNumber: { endsWith: '99887766' } },
    });
    assert.ok(dbUser);
    assert.equal(dbUser.accountStatus, 'ACTIVE');
  });

  it('13. In-App Dev Mode: OTP request auto-provisions new user and returns devOtp for instant verification', async () => {
    const devMobile = '9188776655';
    await prisma.user.deleteMany({ where: { mobileNumber: { endsWith: '88776655' } } });

    const reqRes = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: {
        role: RoleType.BOOTH_PRESIDENT,
        mobileNumber: devMobile,
        devMode: true,
        name: 'Dev Booth Captain',
      },
    });

    assert.equal(reqRes.statusCode, 200);
    const reqJson = JSON.parse(reqRes.body);
    assert.equal(reqJson.success, true);
    assert.ok(reqJson.data.devOtp, 'In-App Dev Mode must return devOtp');
    assert.ok(reqJson.data.requestId);

    // Verify OTP using the returned devOtp
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: {
        requestId: reqJson.data.requestId,
        otpCode: reqJson.data.devOtp,
      },
    });

    assert.equal(verifyRes.statusCode, 200);
    const verifyJson = JSON.parse(verifyRes.body);
    assert.equal(verifyJson.success, true);
    assert.ok(verifyJson.data.token);
    assert.equal(verifyJson.data.user.role, RoleType.BOOTH_PRESIDENT);
  });
});

