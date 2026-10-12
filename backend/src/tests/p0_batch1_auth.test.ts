process.env.NODE_ENV = 'test';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { RoleType } from '@prisma/client';
import { SmsProviderFactory } from '../lib/sms/factory.js';
import { OtpService } from '../modules/auth/services/otp.service.js';

describe('P0 Security Hardening - Batch 1 Authentication Controls', () => {
  let app: any;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalEnableDemo = process.env.ENABLE_DEMO_LOGIN;

  let activeUser: any;

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
        messageId: 'mock-msg91-tx',
        provider: 'msg91',
        timestamp: new Date(),
      }),
    });

    app = buildApp();
    await app.ready();

    activeUser = await prisma.user.findFirst({
      where: {
        accountStatus: 'ACTIVE',
        role: { notIn: [RoleType.SUPER_ADMIN, RoleType.STATE_ADMIN] },
      },
    });
  });

  after(async () => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.ENABLE_DEMO_LOGIN = originalEnableDemo;
    await app.close();
  });

  it('1. demo-login is rejected (404) in production even if ENABLE_DEMO_LOGIN=true', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_DEMO_LOGIN = 'true';

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/demo-login',
      payload: { role: RoleType.SUPER_ADMIN },
    });

    assert.equal(res.statusCode, 404, 'Must return 404 in production');
    const json = JSON.parse(res.body);
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'NOT_FOUND');
    // Verify no auth cookies issued
    assert.equal(res.cookies.find((c: any) => c.name === 'access_token'), undefined);
    assert.equal(res.cookies.find((c: any) => c.name === 'refresh_token'), undefined);
  });

  it('2. demo-login is rejected (404) in production with ENABLE_DEMO_LOGIN unset', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ENABLE_DEMO_LOGIN;

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/demo-login',
      payload: { role: RoleType.SUPER_ADMIN },
    });

    assert.equal(res.statusCode, 404);
    assert.equal(res.cookies.find((c: any) => c.name === 'access_token'), undefined);
  });

  it('3. demo-login is rejected (404) when NODE_ENV is missing/undefined', async () => {
    delete process.env.NODE_ENV;
    process.env.ENABLE_DEMO_LOGIN = 'true';

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/demo-login',
      payload: { role: RoleType.SUPER_ADMIN },
    });

    assert.equal(res.statusCode, 404, 'Missing NODE_ENV must fail closed');
    assert.equal(res.cookies.find((c: any) => c.name === 'access_token'), undefined);
  });

  it('4. demo-login is rejected (404) in development when ENABLE_DEMO_LOGIN is not true', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ENABLE_DEMO_LOGIN;

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/demo-login',
      payload: { role: RoleType.SUPER_ADMIN },
    });

    assert.equal(res.statusCode, 404, 'Development without ENABLE_DEMO_LOGIN=true must return 404');
  });

  it('5. demo-login is permitted in development when ENABLE_DEMO_LOGIN=true', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ENABLE_DEMO_LOGIN = 'true';

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/demo-login',
      payload: { role: RoleType.SUPER_ADMIN },
    });

    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.success, true);
    assert.ok(json.data.token, 'Should return token when explicitly enabled in development');
  });

  it('6. demo-login is permitted in test environment', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.ENABLE_DEMO_LOGIN;

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/demo-login',
      payload: { role: RoleType.SUPER_ADMIN },
    });

    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.success, true);
    assert.ok(json.data.token);
  });

  it('7. Client passing devMode: true cannot bypass role eligibility', async () => {
    process.env.NODE_ENV = 'test';
    assert.ok(activeUser, 'An active non-admin user must exist in DB');
    const testMobile = activeUser.mobileNumber.replace(/\D/g, '').slice(-10);
    const mismatchedRole = activeUser.role === RoleType.BOOTH_PRESIDENT ? RoleType.VILLAGE_INCHARGE : RoleType.BOOTH_PRESIDENT;

    // Attempting to request OTP with mismatched role and devMode: true
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: {
        mobileNumber: testMobile,
        role: mismatchedRole,
        devMode: true,
      },
    });

    // In test environment, the backend rejects with 403 ROLE_MISMATCH because devMode no longer bypasses role check!
    assert.equal(res.statusCode, 403, 'Client devMode: true must not grant unauthorized role');
    const json = JSON.parse(res.body);
    assert.equal(json.error.code, 'ROLE_MISMATCH');
  });

  it('8. In production, un-enrolled mobile number returns uniform opaque response without leaking diagnostics', async () => {
    process.env.NODE_ENV = 'production';
    const fakeMobile = '9199999999';

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: {
        mobileNumber: fakeMobile,
        role: RoleType.BOOTH_PRESIDENT,
        devMode: true, // Attempted client bypass
      },
    });

    assert.equal(res.statusCode, 200, 'Production must return uniform 200 response to prevent enumeration');
    const json = JSON.parse(res.body);
    assert.equal(json.success, true);
    assert.equal(json.data.message, 'If an eligible account exists, an OTP has been dispatched.');
    assert.ok(json.data.requestId, 'Opaque requestId returned');
  });

  it('9. In production, eligible registered user receives identical uniform response schema and message', async () => {
    process.env.NODE_ENV = 'production';
    if (!activeUser) return;

    OtpService.clearCooldown(activeUser.mobileNumber);
    await prisma.oTPVerification.deleteMany({ where: { mobileNumber: activeUser.mobileNumber } });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: {
        mobileNumber: activeUser.mobileNumber,
        role: activeUser.role,
      },
    });

    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.success, true);
    assert.equal(json.data.message, 'If an eligible account exists, an OTP has been dispatched.');
    assert.ok(json.data.requestId);
    assert.ok(json.data.expiresAt);
    assert.equal(typeof json.data.cooldownSeconds, 'number');
  });

  it('10. In production, role-mismatched or tier-restricted direct request returns identical uniform response', async () => {
    process.env.NODE_ENV = 'production';
    if (!activeUser) return;

    OtpService.clearCooldown(activeUser.mobileNumber);
    await prisma.oTPVerification.deleteMany({ where: { mobileNumber: activeUser.mobileNumber } });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: {
        mobileNumber: activeUser.mobileNumber,
        role: RoleType.SUPER_ADMIN, // Mismatched role directly from API
      },
    });

    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.success, true);
    assert.equal(json.data.message, 'If an eligible account exists, an OTP has been dispatched.');
    assert.ok(json.data.requestId);
  });
});
