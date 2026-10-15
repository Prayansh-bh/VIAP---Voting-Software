process.env.NODE_ENV = 'test';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { RoleType, OrgHierarchyLevel, AccountStatus } from '@prisma/client';
import { hashOtp } from '../lib/crypto.js';
import { SmsProviderFactory } from '../lib/sms/factory.js';
import { OtpService } from '../modules/auth/services/otp.service.js';
import { TokenService } from '../modules/auth/services/token.service.js';

describe('Phase 2 — Multi-tier Phone Registration and Direct OTP Login Suite', () => {
  let app: any;
  let adminOrg: any;
  let superAdminUser: any;
  let adminToken: string;
  const createdOrgIds: string[] = [];
  const testMobilesToCleanup: string[] = [];

  async function issueValidToken(user: any) {
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

  async function setTestOtp(requestId: string, mobile: string, code = '123456') {
    await prisma.oTPVerification.update({
      where: { id: requestId },
      data: { otpCode: hashOtp(code, mobile) },
    });
    return code;
  }

  before(async () => {
    // Mock SMS provider
    SmsProviderFactory.setProvider({
      name: 'msg91',
      sendOtp: async () => ({
        success: true,
        messageId: 'mock-phase2-otp',
        provider: 'msg91',
        timestamp: new Date(),
      }),
      sendTransactional: async () => ({
        success: true,
        messageId: 'mock-phase2-tx',
        provider: 'msg91',
        timestamp: new Date(),
      }),
    });

    app = buildApp();
    await app.ready();

    // Create Admin Organisation & SuperAdmin
    const timestamp = Date.now().toString().slice(-5);
    adminOrg = await prisma.organisation.create({
      data: {
        name: `Phase2 Admin Org ${timestamp}`,
        code: `P2A-${timestamp}`,
        isActive: true,
      },
    });
    createdOrgIds.push(adminOrg.id);

    await prisma.politicalParty.create({
      data: {
        organisationId: adminOrg.id,
        name: 'Phase 2 Admin Party',
        code: `P2P-${timestamp}`,
        shortName: 'P2P',
        primaryColor: '#eab308',
      },
    });

    superAdminUser = await prisma.user.create({
      data: {
        organisationId: adminOrg.id,
        name: 'Phase 2 SuperAdmin',
        userCode: `SU-P2-${timestamp}`,
        mobileNumber: `9844${timestamp.padStart(6, '0')}`,
        role: RoleType.SUPER_ADMIN,
        accountStatus: AccountStatus.ACTIVE,
        isVerified: true,
      },
    });
    testMobilesToCleanup.push(superAdminUser.mobileNumber);

    adminToken = await issueValidToken(superAdminUser);
  });

  after(async () => {
    // Cleanup OTP verifications
    for (const mobile of testMobilesToCleanup) {
      try {
        await prisma.oTPVerification.deleteMany({ where: { mobileNumber: mobile } });
        OtpService.clearCooldown(mobile);
      } catch {}
    }

    // Cleanup organizations and child entities
    for (const orgId of createdOrgIds) {
      try {
        await prisma.userHierarchyAssignment.deleteMany({
          where: { user: { organisationId: orgId } },
        });
      } catch {}
      try {
        await prisma.user.deleteMany({
          where: { organisationId: orgId },
        });
      } catch {}
      try {
        await prisma.cMSConfiguration.deleteMany({
          where: { organisationId: orgId },
        });
      } catch {}
      try {
        await prisma.politicalParty.deleteMany({
          where: { organisationId: orgId },
        });
      } catch {}
      try {
        await prisma.voterGroup.deleteMany({
          where: { booth: { village: { mandal: { constituency: { parliament: { zone: { state: { organisationId: orgId } } } } } } } },
        });
      } catch {}
      try {
        await prisma.booth.deleteMany({
          where: { village: { mandal: { constituency: { parliament: { zone: { state: { organisationId: orgId } } } } } } },
        });
      } catch {}
      try {
        await prisma.village.deleteMany({
          where: { mandal: { constituency: { parliament: { zone: { state: { organisationId: orgId } } } } } },
        });
      } catch {}
      try {
        await prisma.mandal.deleteMany({
          where: { constituency: { parliament: { zone: { state: { organisationId: orgId } } } } },
        });
      } catch {}
      try {
        await prisma.constituency.deleteMany({
          where: { parliament: { zone: { state: { organisationId: orgId } } } },
        });
      } catch {}
      try {
        await prisma.parliament.deleteMany({
          where: { zone: { state: { organisationId: orgId } } },
        });
      } catch {}
      try {
        await prisma.zone.deleteMany({
          where: { state: { organisationId: orgId } },
        });
      } catch {}
      try {
        await prisma.state.deleteMany({
          where: { organisationId: orgId },
        });
      } catch {}
      try {
        await prisma.organisation.deleteMany({
          where: { id: orgId },
        });
      } catch {}
    }
    await app.close();
  });

  // =========================================================================
  // 1. CMS MULTI-TIER REGISTRATION
  // =========================================================================

  it('1. CMS Registration: Successfully provisions multi-tier incharges dynamically (4-tier configuration)', async () => {
    const ts = Date.now().toString().slice(-5);
    const tenantCode = `MT4-${ts}`;
    const mConstituency = `9811${ts.padStart(6, '1')}`;
    const mMandal = `9812${ts.padStart(6, '2')}`;
    const mVillage = `9813${ts.padStart(6, '3')}`;
    const mBooth = `9814${ts.padStart(6, '4')}`;

    testMobilesToCleanup.push(mConstituency, mMandal, mVillage, mBooth);

    const res = await app.inject({
      method: 'POST',
      url: '/api/cms/build-application',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        appName: `MultiTier Party ${ts}`,
        organisationName: `MultiTier Party ${ts}`,
        tenantCode,
        activePartyCode: `MT4-${ts}`,
        appScope: 'SINGLE_MLA',
        stateName: 'Andhra Pradesh',
        activeHierarchyLevels: ['CONSTITUENCY', 'MANDAL', 'VILLAGE', 'BOOTH'],
        tierIncharges: [
          {
            tierLevel: 'CONSTITUENCY',
            role: 'CONSTITUENCY_INCHARGE',
            name: 'Kondapi MLA Incharge',
            mobileNumber: mConstituency,
            unitName: 'Kondapi AC',
          },
          {
            tierLevel: 'MANDAL',
            role: 'MANDAL_INCHARGE',
            name: 'Kondapi Mandal President',
            mobileNumber: mMandal,
            unitName: 'Kondapi Mandal',
          },
          {
            tierLevel: 'VILLAGE',
            role: 'VILLAGE_INCHARGE',
            name: 'Kondapi Village Incharge',
            mobileNumber: mVillage,
            unitName: 'Kondapi Village',
          },
          {
            tierLevel: 'BOOTH',
            role: 'BOOTH_PRESIDENT',
            name: 'Booth 101 President',
            mobileNumber: mBooth,
            unitName: 'Booth 101 Station',
          },
        ],
      },
    });

    assert.equal(res.statusCode, 201, 'Should provision 4-tier application');
    const json = JSON.parse(res.body);
    assert.equal(json.success, true);
    assert.ok(json.data.credentials.tierIncharges, 'Should return provisioned tier incharges');
    assert.equal(json.data.credentials.tierIncharges.length, 4);

    const newOrgId = json.data.application.organisationId;
    createdOrgIds.push(newOrgId);

    // Verify all 4 users exist in database with correct roles, tenant ID, and hierarchy assignments
    const users = await prisma.user.findMany({
      where: { organisationId: newOrgId },
      include: { hierarchyAssignments: true },
    });
    assert.equal(users.length, 4, 'Exactly 4 users must be provisioned');

    const constUser = users.find((u) => u.mobileNumber === mConstituency);
    assert.ok(constUser);
    assert.equal(constUser.role, RoleType.CONSTITUENCY_INCHARGE);
    assert.equal(constUser.hierarchyAssignments.length, 1);
    assert.equal(constUser.hierarchyAssignments[0].roleType, RoleType.CONSTITUENCY_INCHARGE);

    const mandalUser = users.find((u) => u.mobileNumber === mMandal);
    assert.ok(mandalUser);
    assert.equal(mandalUser.role, RoleType.MANDAL_INCHARGE);
    assert.equal(mandalUser.hierarchyAssignments[0].roleType, RoleType.MANDAL_INCHARGE);

    const villageUser = users.find((u) => u.mobileNumber === mVillage);
    assert.ok(villageUser);
    assert.equal(villageUser.role, RoleType.VILLAGE_INCHARGE);

    const boothUser = users.find((u) => u.mobileNumber === mBooth);
    assert.ok(boothUser);
    assert.equal(boothUser.role, RoleType.BOOTH_PRESIDENT);
  });

  it('2. CMS Registration: Successfully provisions 3-tier configuration dynamically', async () => {
    const ts = Date.now().toString().slice(-5);
    const tenantCode = `MT3-${ts}`;
    const mState = `9821${ts.padStart(6, '1')}`;
    const mZone = `9822${ts.padStart(6, '2')}`;
    const mParliament = `9823${ts.padStart(6, '3')}`;

    testMobilesToCleanup.push(mState, mZone, mParliament);

    const res = await app.inject({
      method: 'POST',
      url: '/api/cms/build-application',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        appName: `Three Tier Org ${ts}`,
        organisationName: `Three Tier Org ${ts}`,
        tenantCode,
        activePartyCode: `T3P-${ts}`,
        appScope: 'ZONE',
        stateName: 'Andhra Pradesh',
        activeHierarchyLevels: ['STATE', 'ZONE', 'PARLIAMENT'],
        tierIncharges: [
          {
            tierLevel: 'STATE',
            role: 'STATE_ADMIN',
            name: 'Apex State Incharge',
            mobileNumber: mState,
            unitName: 'AP State HQ',
          },
          {
            tierLevel: 'ZONE',
            role: 'ZONE_INCHARGE',
            name: 'Rayalaseema Zone Incharge',
            mobileNumber: mZone,
            unitName: 'Rayalaseema Zone',
          },
          {
            tierLevel: 'PARLIAMENT',
            role: 'PARLIAMENT_INCHARGE',
            name: 'Kadapa Parliament Incharge',
            mobileNumber: mParliament,
            unitName: 'Kadapa Lok Sabha',
          },
        ],
      },
    });

    assert.equal(res.statusCode, 201);
    const json = JSON.parse(res.body);
    assert.equal(json.data.credentials.tierIncharges.length, 3);

    const newOrgId = json.data.application.organisationId;
    createdOrgIds.push(newOrgId);

    const users = await prisma.user.findMany({
      where: { organisationId: newOrgId },
    });
    assert.equal(users.length, 3);
  });

  it('3. Validation: Rejects duplicate phone numbers within the registration request (400 DUPLICATE_PHONE_NUMBER)', async () => {
    const ts = Date.now().toString().slice(-5);
    const sharedMobile = `9831${ts.padStart(6, '0')}`;

    const res = await app.inject({
      method: 'POST',
      url: '/api/cms/build-application',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        appName: `Duplicate Phone Party ${ts}`,
        organisationName: `Duplicate Phone Party ${ts}`,
        tenantCode: `DUP-${ts}`,
        activePartyCode: `DUP-${ts}`,
        appScope: 'SINGLE_MLA',
        stateName: 'Andhra Pradesh',
        activeHierarchyLevels: ['CONSTITUENCY', 'MANDAL'],
        tierIncharges: [
          {
            tierLevel: 'CONSTITUENCY',
            role: 'CONSTITUENCY_INCHARGE',
            name: 'Leader One',
            mobileNumber: sharedMobile,
          },
          {
            tierLevel: 'MANDAL',
            role: 'MANDAL_INCHARGE',
            name: 'Leader Two',
            mobileNumber: sharedMobile, // Duplicate!
          },
        ],
      },
    });

    assert.equal(res.statusCode, 400);
    const json = JSON.parse(res.body);
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'DUPLICATE_PHONE_NUMBER');
  });

  it('4. Validation: Rejects phone numbers that already belong to existing accounts (409 EXISTING_ACCOUNT_CONFLICT)', async () => {
    const ts = Date.now().toString().slice(-5);
    // Use superAdmin's mobile which already exists in DB
    const existingMobile = superAdminUser.mobileNumber;

    const res = await app.inject({
      method: 'POST',
      url: '/api/cms/build-application',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        appName: `Conflict Party ${ts}`,
        organisationName: `Conflict Party ${ts}`,
        tenantCode: `CNF-${ts}`,
        activePartyCode: `CNF-${ts}`,
        appScope: 'SINGLE_MLA',
        stateName: 'Andhra Pradesh',
        activeHierarchyLevels: ['CONSTITUENCY'],
        tierIncharges: [
          {
            tierLevel: 'CONSTITUENCY',
            role: 'CONSTITUENCY_INCHARGE',
            name: 'Conflict Candidate',
            mobileNumber: existingMobile,
          },
        ],
      },
    });

    assert.equal(res.statusCode, 409);
    const json = JSON.parse(res.body);
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'EXISTING_ACCOUNT_CONFLICT');
  });

  it('5. Validation: Rejects invalid or forged role values (400 INVALID_ROLE)', async () => {
    const ts = Date.now().toString().slice(-5);

    const res = await app.inject({
      method: 'POST',
      url: '/api/cms/build-application',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        appName: `Invalid Role Party ${ts}`,
        organisationName: `Invalid Role Party ${ts}`,
        tenantCode: `INV-${ts}`,
        activePartyCode: `INV-${ts}`,
        appScope: 'SINGLE_MLA',
        stateName: 'Andhra Pradesh',
        activeHierarchyLevels: ['CONSTITUENCY'],
        tierIncharges: [
          {
            tierLevel: 'CONSTITUENCY',
            role: 'SUPER_ADMIN' as any, // Disallowed in tier incharges
            name: 'Hacker',
            mobileNumber: `9835${ts.padStart(6, '9')}`,
          },
        ],
      },
    });

    assert.equal(res.statusCode, 400);
  });

  it('6. Validation: Rejects cross-tenant unit ID forgery (403 FORBIDDEN_TENANT)', async () => {
    const ts = Date.now().toString().slice(-5);
    // Create an arbitrary organizationUnit belonging to another tenant
    const foreignUnit = await prisma.organizationUnit.create({
      data: {
        name: `Foreign Unit ${ts}`,
        level: OrgHierarchyLevel.CONSTITUENCY,
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/cms/build-application',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        appName: `Forged Unit Party ${ts}`,
        organisationName: `Forged Unit Party ${ts}`,
        tenantCode: `FRG-${ts}`,
        activePartyCode: `FRG-${ts}`,
        appScope: 'SINGLE_MLA',
        stateName: 'Andhra Pradesh',
        activeHierarchyLevels: ['CONSTITUENCY'],
        tierIncharges: [
          {
            tierLevel: 'CONSTITUENCY',
            role: 'CONSTITUENCY_INCHARGE',
            name: 'Unit Spoofer',
            mobileNumber: `9836${ts.padStart(6, '8')}`,
            unitId: foreignUnit.id, // Foreign unit not belonging to this new organisation
          },
        ],
      },
    });

    assert.equal(res.statusCode, 403);
    const json = JSON.parse(res.body);
    assert.equal(json.error.code, 'FORBIDDEN_TENANT');
  });

  // =========================================================================
  // 2. DIRECT MOBILE OTP LOGIN & AUTOMATIC ROLE ROUTING
  // =========================================================================

  let tierUsers: {
    constituency: any;
    mandal: any;
    village: any;
    booth: any;
    orgId: string;
  };

  it('7. Setup test tenant with incharges across all tiers for direct OTP login testing', async () => {
    const ts = Date.now().toString().slice(-5);
    const tenantCode = `LGN-${ts}`;
    const mConst = `9951${ts.padStart(6, '1')}`;
    const mMandal = `9952${ts.padStart(6, '2')}`;
    const mVillage = `9953${ts.padStart(6, '3')}`;
    const mBooth = `9954${ts.padStart(6, '4')}`;

    testMobilesToCleanup.push(mConst, mMandal, mVillage, mBooth);

    const res = await app.inject({
      method: 'POST',
      url: '/api/cms/build-application',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        appName: `Login Test Party ${ts}`,
        organisationName: `Login Test Party ${ts}`,
        tenantCode,
        activePartyCode: `LGN-${ts}`,
        appScope: 'SINGLE_MLA',
        stateName: 'Andhra Pradesh',
        activeHierarchyLevels: ['CONSTITUENCY', 'MANDAL', 'VILLAGE', 'BOOTH'],
        tierIncharges: [
          { tierLevel: 'CONSTITUENCY', role: 'CONSTITUENCY_INCHARGE', name: 'Direct MLA Incharge', mobileNumber: mConst },
          { tierLevel: 'MANDAL', role: 'MANDAL_INCHARGE', name: 'Direct Mandal President', mobileNumber: mMandal },
          { tierLevel: 'VILLAGE', role: 'VILLAGE_INCHARGE', name: 'Direct Village Incharge', mobileNumber: mVillage },
          { tierLevel: 'BOOTH', role: 'BOOTH_PRESIDENT', name: 'Direct Booth President', mobileNumber: mBooth },
        ],
      },
    });

    assert.equal(res.statusCode, 201);
    const json = JSON.parse(res.body);
    const orgId = json.data.application.organisationId;
    createdOrgIds.push(orgId);

    const allUsers = await prisma.user.findMany({ where: { organisationId: orgId } });
    tierUsers = {
      constituency: allUsers.find((u) => u.mobileNumber === mConst),
      mandal: allUsers.find((u) => u.mobileNumber === mMandal),
      village: allUsers.find((u) => u.mobileNumber === mVillage),
      booth: allUsers.find((u) => u.mobileNumber === mBooth),
      orgId,
    };
    assert.ok(tierUsers.constituency);
    assert.ok(tierUsers.mandal);
    assert.ok(tierUsers.village);
    assert.ok(tierUsers.booth);
  });

  it('8. Direct Login: Constituency Incharge requests OTP without manual role selection & verifies successfully', async () => {
    const mobile = tierUsers.constituency.mobileNumber;
    OtpService.clearCooldown(mobile);

    // Step 1: Request OTP without role parameter
    const reqRes = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: {
        mobileNumber: mobile,
        // role is omitted intentionally to test direct login
      },
    });

    assert.equal(reqRes.statusCode, 200, 'Direct OTP request without role must succeed');
    const reqJson = JSON.parse(reqRes.body);
    assert.ok(reqJson.data.requestId);

    const requestId = reqJson.data.requestId;
    await setTestOtp(requestId, mobile, '123456');

    // Step 2: Verify OTP
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: {
        requestId,
        otpCode: '123456',
      },
    });

    assert.equal(verifyRes.statusCode, 200);
    const verifyJson = JSON.parse(verifyRes.body);
    assert.equal(verifyJson.success, true);
    assert.equal(verifyJson.data.user.role, RoleType.CONSTITUENCY_INCHARGE, 'Server must resolve CONSTITUENCY_INCHARGE role');
    assert.equal(verifyJson.data.user.mobileNumber, mobile);
    assert.equal(verifyJson.data.user.organisation.id, tierUsers.orgId);
  });

  it('9. Direct Login: Mandal Incharge requests OTP without role & server automatically resolves MANDAL_INCHARGE', async () => {
    const mobile = tierUsers.mandal.mobileNumber;
    OtpService.clearCooldown(mobile);

    const reqRes = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: { mobileNumber: mobile },
    });

    assert.equal(reqRes.statusCode, 200);
    const reqJson = JSON.parse(reqRes.body);
    const requestId = reqJson.data.requestId;
    await setTestOtp(requestId, mobile, '123456');

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: { requestId, otpCode: '123456' },
    });

    assert.equal(verifyRes.statusCode, 200);
    const verifyJson = JSON.parse(verifyRes.body);
    assert.equal(verifyJson.data.user.role, RoleType.MANDAL_INCHARGE, 'Must resolve MANDAL_INCHARGE role');
    assert.equal(verifyJson.data.user.organisation.id, tierUsers.orgId);
  });

  it('10. Direct Login: Booth President requests OTP without role & server automatically resolves BOOTH_PRESIDENT', async () => {
    const mobile = tierUsers.booth.mobileNumber;
    OtpService.clearCooldown(mobile);

    const reqRes = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: { mobileNumber: mobile },
    });

    assert.equal(reqRes.statusCode, 200);
    const reqJson = JSON.parse(reqRes.body);
    const requestId = reqJson.data.requestId;
    await setTestOtp(requestId, mobile, '123456');

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: { requestId, otpCode: '123456' },
    });

    assert.equal(verifyRes.statusCode, 200);
    const verifyJson = JSON.parse(verifyRes.body);
    assert.equal(verifyJson.data.user.role, RoleType.BOOTH_PRESIDENT, 'Must resolve BOOTH_PRESIDENT role');
  });

  // =========================================================================
  // 3. SECURITY & EDGE CASES: INCORRECT OTP, EXPIRED OTP, RATE LIMITING
  // =========================================================================

  it('11. Security: Incorrect OTP code is rejected (400 INVALID_OTP_ATTEMPT)', async () => {
    const mobile = tierUsers.constituency.mobileNumber;
    OtpService.clearCooldown(mobile);
    await prisma.oTPVerification.deleteMany({ where: { mobileNumber: mobile } });

    const reqRes = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: { mobileNumber: mobile },
    });

    const requestId = JSON.parse(reqRes.body).data.requestId;
    await setTestOtp(requestId, mobile, '123456');

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: {
        requestId,
        otpCode: '999999', // Incorrect OTP
      },
    });

    assert.equal(verifyRes.statusCode, 400);
    const json = JSON.parse(verifyRes.body);
    assert.equal(json.success, false);
  });

  it('12. Security: Expired OTP session is rejected (400 OTP_EXPIRED)', async () => {
    const mobile = tierUsers.constituency.mobileNumber;
    OtpService.clearCooldown(mobile);
    await prisma.oTPVerification.deleteMany({ where: { mobileNumber: mobile } });

    const reqRes = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: { mobileNumber: mobile },
    });

    const requestId = JSON.parse(reqRes.body).data.requestId;
    await setTestOtp(requestId, mobile, '123456');

    // Force expire record
    await prisma.oTPVerification.update({
      where: { id: requestId },
      data: { expiresAt: new Date(Date.now() - 60000) },
    });

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: {
        requestId,
        otpCode: '123456',
      },
    });

    assert.equal(verifyRes.statusCode, 400);
    const json = JSON.parse(verifyRes.body);
    assert.equal(json.error.code, 'OTP_EXPIRED');
  });

  it('13. Security: Rapid successive OTP requests trigger cooldown rate limiting (429)', async () => {
    const mobile = tierUsers.village.mobileNumber;
    OtpService.clearCooldown(mobile);
    await prisma.oTPVerification.deleteMany({ where: { mobileNumber: mobile } });

    // First request succeeds
    const firstRes = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: { mobileNumber: mobile },
    });
    assert.equal(firstRes.statusCode, 200);

    // Immediate second request within cooldown triggers 429
    const secondRes = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: { mobileNumber: mobile },
    });

    assert.equal(secondRes.statusCode, 429);
    const json = JSON.parse(secondRes.body);
    assert.equal(json.error.code, 'OTP_COOLDOWN_ACTIVE');
  });

  // =========================================================================
  // 4. INACTIVE USERS, DISABLED ORGANISATIONS & UNKNOWN NUMBERS
  // =========================================================================

  it('14. Security: Inactive user accounts are rejected (403 ACCOUNT_INACTIVE)', async () => {
    const ts = Date.now().toString().slice(-5);
    const inactMobile = `9961${ts.padStart(6, '9')}`;
    testMobilesToCleanup.push(inactMobile);

    const inactUser = await prisma.user.create({
      data: {
        organisationId: tierUsers.orgId,
        name: 'Inactive User',
        userCode: `INACT-${ts}`,
        mobileNumber: inactMobile,
        role: RoleType.CONSTITUENCY_INCHARGE,
        accountStatus: AccountStatus.SUSPENDED,
      },
    });

    OtpService.clearCooldown(inactMobile);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: { mobileNumber: inactMobile },
    });

    assert.equal(res.statusCode, 403);
    const json = JSON.parse(res.body);
    assert.equal(json.error.code, 'ACCOUNT_INACTIVE');
  });

  it('15. Security: Users belonging to disabled organisations are rejected (403 ORGANISATION_DISABLED)', async () => {
    const ts = Date.now().toString().slice(-5);
    const disabledOrg = await prisma.organisation.create({
      data: {
        name: `Disabled Org ${ts}`,
        code: `DIS-${ts}`,
        isActive: false, // Disabled organization!
      },
    });
    createdOrgIds.push(disabledOrg.id);

    await prisma.politicalParty.create({
      data: {
        organisationId: disabledOrg.id,
        name: 'Disabled Party',
        code: `DISP-${ts}`,
        shortName: 'DISP',
        primaryColor: '#000000',
        isActive: true,
      },
    });

    const disMobile = `9971${ts.padStart(6, '8')}`;
    testMobilesToCleanup.push(disMobile);

    await prisma.user.create({
      data: {
        organisationId: disabledOrg.id,
        name: 'Disabled Org Member',
        userCode: `DISM-${ts}`,
        mobileNumber: disMobile,
        role: RoleType.CONSTITUENCY_INCHARGE,
        accountStatus: AccountStatus.ACTIVE,
      },
    });

    OtpService.clearCooldown(disMobile);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: { mobileNumber: disMobile },
    });

    assert.equal(res.statusCode, 403);
    const json = JSON.parse(res.body);
    assert.equal(json.error.code, 'ORGANISATION_DISABLED');
  });

  it('16. Security: Unknown numbers are rejected (404 in test mode)', async () => {
    const unknownMobile = '9199999999';
    OtpService.clearCooldown(unknownMobile);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: { mobileNumber: unknownMobile },
    });

    assert.equal(res.statusCode, 404);
    const json = JSON.parse(res.body);
    assert.equal(json.error.code, 'USER_NOT_FOUND');
  });

  it('17. Security: Cross-tenant session authorization verification', async () => {
    // Generate valid session token for Constituency Incharge in tierUsers.orgId
    const constToken = await issueValidToken(tierUsers.constituency);

    // Create a resource in another organisation
    const ts = Date.now().toString().slice(-5);
    const foreignOrg = await prisma.organisation.create({
      data: {
        name: `Foreign Tenant Org ${ts}`,
        code: `FTN-${ts}`,
        isActive: true,
      },
    });
    createdOrgIds.push(foreignOrg.id);

    const foreignAnnouncement = await prisma.announcement.create({
      data: {
        organisationId: foreignOrg.id,
        title: 'Confidential Strategy',
        content: 'Confidential strategy only for foreign tenant',
        priority: 'HIGH',
      },
    });

    // Attempt to access announcements with tenant A token
    const res = await app.inject({
      method: 'GET',
      url: '/api/cms/announcements',
      headers: { authorization: `Bearer ${constToken}` },
    });

    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    const announcements = json.data?.announcements || json.announcements || json.data || [];
    const hasForeign = announcements.some((a: any) => a.id === foreignAnnouncement.id);
    assert.equal(hasForeign, false, 'Tenant A user MUST NOT see Tenant B announcements (Phase 1 isolation preserved)');
  });
});
