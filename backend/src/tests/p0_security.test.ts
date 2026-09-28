import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { io as ioClient, Socket } from 'socket.io-client';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { hashOtp } from '../lib/crypto.js';
import { generateToken, createAuthenticatedTestSession } from '../middleware/auth.js';
import { RoleType } from '@prisma/client';
import { initSocketServer } from '../lib/socket.js';
import { TokenService } from '../modules/auth/services/token.service.js';
import { SmsProviderFactory } from '../lib/sms/factory.js';
import { OtpService } from '../modules/auth/services/otp.service.js';

describe('P0 Production Security Remediation Suite (16 Requirements)', () => {
  let app: any;
  let serverPort: number;
  let mlaUser: any;
  let normalUserMobile = '9000012347';
  let adminUser: any;
  let testAppRecord: any;

  before(async () => {
    SmsProviderFactory.setProvider({
      name: 'msg91',
      sendOtp: async () => ({
        success: true,
        messageId: 'mock-msg91-p0',
        provider: 'msg91',
        timestamp: new Date(),
      }),
      sendTransactional: async () => ({
        success: true,
        messageId: 'mock-msg91-p0-tx',
        provider: 'msg91',
        timestamp: new Date(),
      }),
    });

    app = buildApp();
    
    // Bind to random port for Socket.IO testing
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    const port = Number(address.split(':').pop());
    serverPort = port;

    initSocketServer(app.server, '*');

    // Get seeded normal user (CONSTITUENCY_INCHARGE)
    mlaUser = await prisma.user.findFirst({
      where: { role: RoleType.CONSTITUENCY_INCHARGE },
    });
    if (mlaUser) {
      normalUserMobile = mlaUser.mobileNumber;
    }
    assert.ok(mlaUser, 'Seeded CONSTITUENCY_INCHARGE user must exist');

    // Clean old OTPs and in-memory cooldown
    await prisma.oTPVerification.deleteMany({
      where: { mobileNumber: normalUserMobile },
    });
    OtpService.clearCooldown(normalUserMobile);

    // Ensure an admin user exists for scoped tests
    adminUser = await prisma.user.findFirst({
      where: { role: RoleType.SUPER_ADMIN },
    });
    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          userCode: 'P0-SUPER-ADMIN',
          name: 'P0 Super Administrator',
          mobileNumber: '9998887777',
          role: RoleType.SUPER_ADMIN,
        },
      });
    }

    testAppRecord = await prisma.cMSConfiguration.findFirst();
  });

  after(async () => {
    await app.close();
  });

  // =========================================================================
  // Requirement 1: Existing normal user cannot request SUPER_ADMIN role.
  // =========================================================================
  it('1. Existing normal user cannot request SUPER_ADMIN role (uniform response, cannot authenticate as SUPER_ADMIN)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: {
        mobileNumber: normalUserMobile,
        role: RoleType.SUPER_ADMIN, // Escalation attempt
      },
    });

    // Uniform response prevents role disclosure
    assert.equal(res.statusCode, 200, `Expected 200 uniform response, got ${res.statusCode}: ${res.body}`);
    const json = JSON.parse(res.body);
    assert.equal(json.success, true);
    assert.ok(json.data.requestId, 'Opaque requestId must be returned');

    // Crucial security property: attempting to verify with the opaque requestId cannot create a session or issue a token
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: {
        requestId: json.data.requestId,
        otpCode: '123456',
      },
    });
    assert.equal(verifyRes.statusCode, 400);
    const verifyJson = JSON.parse(verifyRes.body);
    assert.equal(verifyJson.success, false);
    assert.equal(verifyJson.error.code, 'INVALID_OTP_REQUEST');
  });

  // =========================================================================
  // Requirement 2: Existing user's role is unchanged by requestOtp.
  // =========================================================================
  it('2. Existing user role is unchanged by requestOtp', async () => {
    const userBefore = await prisma.user.findUnique({ where: { id: mlaUser.id } });
    assert.equal(userBefore?.role, RoleType.CONSTITUENCY_INCHARGE);

    // Attempt request with different role
    await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: {
        mobileNumber: normalUserMobile,
        role: RoleType.SUPER_ADMIN,
      },
    });

    const userAfter = await prisma.user.findUnique({ where: { id: mlaUser.id } });
    assert.equal(userAfter?.role, RoleType.CONSTITUENCY_INCHARGE, 'Database user role must remain unchanged');
  });

  // =========================================================================
  // Requirement 3: Unknown mobile number cannot create an account through requestOtp.
  // =========================================================================
  it('3. Unknown mobile number cannot create an account through requestOtp (uniform response, cannot authenticate)', async () => {
    const unknownMobile = '9199990001';
    await prisma.user.deleteMany({ where: { mobileNumber: { endsWith: '99990001' } } });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: {
        mobileNumber: unknownMobile,
        role: RoleType.CONSTITUENCY_INCHARGE,
      },
    });

    // Uniform response prevents account existence disclosure
    assert.equal(res.statusCode, 200, `Expected 200 uniform response, got ${res.statusCode}: ${res.body}`);
    const json = JSON.parse(res.body);
    assert.equal(json.success, true);
    assert.ok(json.data.requestId, 'Opaque requestId must be returned');

    // Confirm no user was created in the database
    const createdUser = await prisma.user.findFirst({
      where: { mobileNumber: { endsWith: '99990001' } },
    });
    assert.equal(createdUser, null, 'No user record should be auto-created in requestOtp');

    // Crucial security property: attempting to verify cannot authenticate
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: {
        requestId: json.data.requestId,
        otpCode: '123456',
      },
    });
    assert.equal(verifyRes.statusCode, 400);
    const verifyJson = JSON.parse(verifyRes.body);
    assert.equal(verifyJson.success, false);
    assert.equal(verifyJson.error.code, 'INVALID_OTP_REQUEST');
  });

  // =========================================================================
  // Requirement 4: OTP response contains no plaintext OTP.
  // =========================================================================
  it('4. OTP response contains no plaintext OTP', async () => {
    await prisma.oTPVerification.deleteMany({ where: { mobileNumber: normalUserMobile } });
    OtpService.clearCooldown(normalUserMobile);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: {
        mobileNumber: normalUserMobile,
        role: RoleType.CONSTITUENCY_INCHARGE,
      },
    });

    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.success, true);
    assert.ok(json.data.requestId);
    assert.equal(json.data.devOtp, undefined, 'devOtp must NOT be present in response');
    assert.equal(json.data.rawOtp, undefined, 'rawOtp must NOT be present in response');
    assert.equal(json.data.otpCode, undefined, 'otpCode must NOT be present in response');
  });

  // =========================================================================
  // Requirement 5: Unauthenticated voter endpoint returns 401.
  // =========================================================================
  it('5. Unauthenticated voter endpoint returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/voters',
    });
    assert.equal(res.statusCode, 401);
    const json = JSON.parse(res.body);
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'UNAUTHORIZED');

    const appVotersRes = await app.inject({
      method: 'GET',
      url: `/api/applications/${testAppRecord?.id || 'default'}/voters`,
    });
    assert.equal(appVotersRes.statusCode, 401);
  });

  // =========================================================================
  // Requirement 6: Unauthenticated voter import returns 401.
  // =========================================================================
  it('6. Unauthenticated voter import returns 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/applications/${testAppRecord?.id || 'default'}/data/import`,
      payload: {
        rows: [{ name: 'Test Voter' }],
      },
    });
    assert.equal(res.statusCode, 401);
    const json = JSON.parse(res.body);
    assert.equal(json.success, false);
  });

  // =========================================================================
  // Requirement 7: Unauthenticated incharge mutation returns 401.
  // =========================================================================
  it('7. Unauthenticated incharge mutation returns 401', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: `/api/applications/${testAppRecord?.id || 'default'}/incharges`,
      payload: {
        userId: mlaUser.id,
        level: 'CONSTITUENCY',
        jurisdictionId: 'test-jurisdiction',
      },
    });
    assert.equal(postRes.statusCode, 401);

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/applications/${testAppRecord?.id || 'default'}/incharges/fake-id`,
    });
    assert.equal(deleteRes.statusCode, 401);
  });

  // =========================================================================
  // Requirement 8: Unauthenticated CMS config mutation returns 401.
  // =========================================================================
  it('8. Unauthenticated CMS config mutation returns 401', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/cms/config',
      payload: {
        appName: 'Hacked Party Name',
      },
    });
    assert.equal(res.statusCode, 401);
    const json = JSON.parse(res.body);
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'UNAUTHORIZED');
  });

  // =========================================================================
  // Requirement 9: Unauthenticated application builder returns 401.
  // =========================================================================
  it('9. Unauthenticated application builder returns 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/cms/build-application',
      payload: {
        appName: 'Malicious App Takeover',
        organisationName: 'Malicious Org',
        stateName: 'Andhra Pradesh',
      },
    });
    assert.equal(res.statusCode, 401);
    const json = JSON.parse(res.body);
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'UNAUTHORIZED');
  });

  // =========================================================================
  // Requirement 10: Unauthenticated Socket.IO connection is rejected.
  // =========================================================================
  it('10. Unauthenticated Socket.IO connection is rejected', async () => {
    const socket: Socket = ioClient(`http://127.0.0.1:${serverPort}`, {
      transports: ['websocket'],
      autoConnect: false,
      reconnection: false,
    });

    const errorPromise = new Promise<string>((resolve) => {
      socket.on('connect_error', (err) => {
        resolve(err.message);
      });
      socket.on('connect', () => {
        resolve('CONNECTED_UNEXPECTEDLY');
      });
    });

    socket.connect();
    const result = await errorPromise;
    socket.disconnect();

    assert.equal(result, 'Authentication required');
  });

  // =========================================================================
  // Requirement 11: Authenticated user cannot join unauthorized unit.
  // =========================================================================
  it('11. Authenticated user cannot join unauthorized unit', async () => {
    const session = await createAuthenticatedTestSession({
      userId: mlaUser.id,
      userCode: mlaUser.userCode,
      mobileNumber: mlaUser.mobileNumber,
      role: RoleType.CONSTITUENCY_INCHARGE,
      organisationId: mlaUser.organisationId,
      unitId: mlaUser.unitId,
    });

    const socket: Socket = ioClient(`http://127.0.0.1:${serverPort}`, {
      transports: ['websocket'],
      auth: { token: session.token },
      autoConnect: false,
      reconnection: false,
    });

    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => resolve());
      socket.on('connect_error', (err) => reject(err));
      socket.connect();
    });

    // Attempt to join an unauthorized unit outside the user's hierarchy
    const unauthorizedUnitId = '00000000-0000-0000-0000-000000009999';

    const joinResult = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      socket.emit('join:unit', unauthorizedUnitId, (res: { success: boolean; error?: string }) => {
        resolve(res);
      });
    });

    socket.disconnect();

    assert.equal(joinResult.success, false);
    assert.equal(joinResult.error, 'Unauthorized');
  });

  // =========================================================================
  // Requirement 12: Logout invalidates the access token.
  // =========================================================================
  it('12. Logout invalidates the access token', async () => {
    // 1. Create a session & token
    const { token } = await createAuthenticatedTestSession({
      userId: mlaUser.id,
      userCode: mlaUser.userCode,
      mobileNumber: mlaUser.mobileNumber,
      role: RoleType.CONSTITUENCY_INCHARGE,
      organisationId: mlaUser.organisationId,
    });

    // 2. Verify token is active
    const meBefore = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(meBefore.statusCode, 200);

    // 3. Logout
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(logoutRes.statusCode, 200);

    // 4. Accessing protected endpoint with logged out token must return 401
    const meAfter = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(meAfter.statusCode, 401);
  });

  // =========================================================================
  // Requirement 13: Revoked LoginSession causes 401.
  // =========================================================================
  it('13. Revoked LoginSession causes 401', async () => {
    const { token, sessionId } = await createAuthenticatedTestSession({
      userId: mlaUser.id,
      userCode: mlaUser.userCode,
      mobileNumber: mlaUser.mobileNumber,
      role: RoleType.CONSTITUENCY_INCHARGE,
      organisationId: mlaUser.organisationId,
    });

    // Directly revoke session in database
    await prisma.loginSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(res.statusCode, 401);
    const json = JSON.parse(res.body);
    assert.equal(json.error.code, 'SESSION_REVOKED');
  });

  // =========================================================================
  // Requirement 14: Expired LoginSession causes 401.
  // =========================================================================
  it('14. Expired LoginSession causes 401', async () => {
    const { token, sessionId } = await createAuthenticatedTestSession({
      userId: mlaUser.id,
      userCode: mlaUser.userCode,
      mobileNumber: mlaUser.mobileNumber,
      role: RoleType.CONSTITUENCY_INCHARGE,
      organisationId: mlaUser.organisationId,
    });

    // Directly set expired time on database session
    await prisma.loginSession.update({
      where: { id: sessionId },
      data: { expiresAt: new Date(Date.now() - 60000) },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(res.statusCode, 401);
    const json = JSON.parse(res.body);
    assert.equal(json.error.code, 'SESSION_EXPIRED');
  });

  // =========================================================================
  // Requirement 15: Frontend cannot create a session merely by navigating to /#/super-admin.
  // =========================================================================
  it('15. Frontend cannot create a session merely by navigating to /#/super-admin', async () => {
    // 1. Verify App.tsx source code no longer contains auto-login or getMockSessionForRole
    const appTsxPath = path.resolve(process.cwd(), '../frontend/src/App.tsx');
    const appTsxContent = fs.readFileSync(appTsxPath, 'utf-8');
    assert.equal(
      appTsxContent.includes('getMockSessionForRole'),
      false,
      'App.tsx must not reference getMockSessionForRole'
    );
    assert.equal(
      appTsxContent.includes('mockSuperAdminToken'),
      false,
      'App.tsx must not reference mockSuperAdminToken'
    );

    // 2. Verify auth.api module does not export mock session generators
    const authApiPath = path.resolve(process.cwd(), '../frontend/src/lib/api/auth.api.ts');
    const authModuleUrl = pathToFileURL(authApiPath).href;
    const authModule = await import(authModuleUrl);
    assert.equal(
      (authModule as any).getMockSessionForRole,
      undefined,
      'getMockSessionForRole must be completely removed from frontend'
    );
  });

  // =========================================================================
  // Requirement 16: Frontend API failure never creates a mock token/session.
  // =========================================================================
  it('16. Frontend API failure never creates a mock token/session', async () => {
    const authApiPath = path.resolve(process.cwd(), '../frontend/src/lib/api/auth.api.ts');
    const authModuleUrl = pathToFileURL(authApiPath).href;
    const { requestOtp, verifyOtp } = await import(authModuleUrl);

    // Passing invalid request must throw rather than returning a demo fallback token
    await assert.rejects(
      async () => {
        await requestOtp('', RoleType.SUPER_ADMIN);
      },
      (err: any) => {
        // Must be an actual rejection, not a fallback object with demo-req-
        return err !== undefined;
      },
      'requestOtp must re-throw error and not return a fallback demo token'
    );

    await assert.rejects(
      async () => {
        await verifyOtp('invalid-req-id', '000000');
      },
      (err: any) => {
        return err !== undefined;
      },
      'verifyOtp must re-throw error and not return a fallback demo session'
    );
  });

  after(() => {
    SmsProviderFactory.reset();
  });
});
