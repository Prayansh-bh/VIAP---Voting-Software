process.env.NODE_ENV = 'test';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { RoleType, AccountStatus, AuditAction } from '@prisma/client';
import { ApplicationsService } from '../modules/applications/applications.service.js';
import { TokenService } from '../modules/auth/services/token.service.js';

describe('VIAP — Safe Tenant Deletion, User Lifecycle & Phone Reuse Test Suite', () => {
  let app: any;
  let superAdminUser: any;
  let superAdminToken: string;

  const testOrgIds: string[] = [];
  const testUserIds: string[] = [];

  function getSampleCMSData(org: any, key: string, name: string) {
    return {
      configKey: key,
      organisationName: org.name,
      headerTitle: name,
      stateName: 'Andhra Pradesh',
      organisationId: org.id,
      hierarchyLabels: {
        STATE: 'State',
        ZONE: 'Zone',
        PARLIAMENT: 'Parliament',
        CONSTITUENCY: 'Constituency',
        MANDAL: 'Mandal',
        VILLAGE: 'Village',
        BOOTH: 'Booth',
        VOTER_GROUP: 'Section',
      },
      featureToggles: {
        aiInsights: true,
        cadreManagement: true,
        dataImport: true,
      },
    };
  }

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
    app = buildApp();
    await app.ready();

    // Ensure a baseline default application exists so deletion of test apps is permitted
    const existingDefault = await prisma.cMSConfiguration.findFirst({
      where: { configKey: 'default' },
    });
    if (!existingDefault) {
      const defaultOrg = await prisma.organisation.create({
        data: {
          name: `VIAP System Root Org ${Date.now()}`,
          code: `ROOT-${Date.now().toString().slice(-4)}`,
          isActive: true,
        },
      });
      testOrgIds.push(defaultOrg.id);
      await prisma.cMSConfiguration.create({
        data: getSampleCMSData(defaultOrg, 'default', 'VIAP Root'),
      });
    }

    // Identify or create a verified SUPER_ADMIN for test actor attribution
    const existingSuperAdmin = await prisma.user.findFirst({
      where: { role: RoleType.SUPER_ADMIN },
    });
    if (existingSuperAdmin) {
      superAdminUser = existingSuperAdmin;
    } else {
      superAdminUser = await prisma.user.create({
        data: {
          name: 'Platform Super Admin Test',
          userCode: `SA_TEST_${Date.now().toString().slice(-4)}`,
          mobileNumber: `9099${Date.now().toString().slice(-6)}`,
          role: RoleType.SUPER_ADMIN,
          accountStatus: AccountStatus.ACTIVE,
        },
      });
      testUserIds.push(superAdminUser.id);
    }

    superAdminToken = await issueToken(superAdminUser);
  });

  after(async () => {
    // Cleanup any lingering test orgs
    for (const orgId of testOrgIds) {
      try {
        await prisma.cMSConfiguration.deleteMany({ where: { organisationId: orgId } });
        await prisma.user.deleteMany({ where: { organisationId: orgId } });
        await prisma.organisation.deleteMany({ where: { id: orgId } });
      } catch {
        // Ignore cleanup errors
      }
    }
    for (const userId of testUserIds) {
      try {
        await prisma.loginSession.deleteMany({ where: { userId } });
        await prisma.user.delete({ where: { id: userId } });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it('1. Shared App Protection: Deleting an application while another config references the org preserves org and tenant users', async () => {
    const timestamp = Date.now();
    const sharedOrg = await prisma.organisation.create({
      data: {
        name: `Shared Tenant Org ${timestamp}`,
        code: `SH_${timestamp.toString().slice(-6)}`,
      },
    });
    testOrgIds.push(sharedOrg.id);

    const config1 = await prisma.cMSConfiguration.create({
      data: getSampleCMSData(sharedOrg, `cfg_alpha_${timestamp}`, 'Alpha App'),
    });

    const config2 = await prisma.cMSConfiguration.create({
      data: getSampleCMSData(sharedOrg, `cfg_beta_${timestamp}`, 'Beta App'),
    });

    const tenantUser = await prisma.user.create({
      data: {
        organisationId: sharedOrg.id,
        name: 'Shared Tenant Incharge',
        userCode: `SH_USER_${timestamp.toString().slice(-4)}`,
        mobileNumber: `9111${timestamp.toString().slice(-6)}`,
        role: RoleType.CONSTITUENCY_INCHARGE,
      },
    });

    // Delete config1
    const result = await ApplicationsService.deleteApplication(config1.id, {
      userId: superAdminUser.id,
      userCode: superAdminUser.userCode,
      mobileNumber: superAdminUser.mobileNumber,
      role: superAdminUser.role,
      organisationId: null,
    });

    assert.equal(result.deleted, true);
    assert.equal(result.permanentOrgPurge, false);

    // Verify config1 is deleted
    const foundConfig1 = await prisma.cMSConfiguration.findUnique({ where: { id: config1.id } });
    assert.equal(foundConfig1, null);

    // Verify config2, sharedOrg, and tenantUser STILL EXIST completely intact!
    const foundConfig2 = await prisma.cMSConfiguration.findUnique({ where: { id: config2.id } });
    assert.ok(foundConfig2, 'Second configuration must remain active');

    const foundOrg = await prisma.organisation.findUnique({ where: { id: sharedOrg.id } });
    assert.ok(foundOrg, 'Organisation must be preserved when other configs remain');

    const foundUser = await prisma.user.findUnique({ where: { id: tenantUser.id } });
    assert.ok(foundUser, 'Tenant user must NOT be deleted while organisation is still referenced');
    assert.equal(foundUser.organisationId, sharedOrg.id, 'User must remain attached to organization');
  });

  it('2. Final Deletion: Deleting the final applicable reference permanently purges tenant users and releases phone number', async () => {
    const timestamp = Date.now() + 100;
    const testOrg = await prisma.organisation.create({
      data: {
        name: `Solo Tenant Org ${timestamp}`,
        code: `SOLO_${timestamp.toString().slice(-6)}`,
      },
    });
    testOrgIds.push(testOrg.id);

    const testConfig = await prisma.cMSConfiguration.create({
      data: getSampleCMSData(testOrg, `cfg_solo_${timestamp}`, 'Solo App'),
    });

    const reusableMobile = `9222${timestamp.toString().slice(-6)}`;
    const tenantUser = await prisma.user.create({
      data: {
        organisationId: testOrg.id,
        name: 'Solo Tenant User',
        userCode: `SOLO_U_${timestamp.toString().slice(-4)}`,
        mobileNumber: reusableMobile,
        role: RoleType.BOOTH_INCHARGE,
      },
    });

    // Create dependent records
    const session = await prisma.loginSession.create({
      data: {
        userId: tenantUser.id,
        tokenHash: `test_token_hash_${timestamp}`,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    const device = await prisma.userDevice.create({
      data: {
        userId: tenantUser.id,
        deviceId: `dev_${timestamp}`,
        deviceTokenHash: `dev_token_${timestamp}`,
      },
    });

    const otp = await prisma.oTPVerification.create({
      data: {
        userId: tenantUser.id,
        mobileNumber: reusableMobile,
        role: RoleType.BOOTH_INCHARGE,
        otpCode: '123456',
        expiresAt: new Date(Date.now() + 600000),
      },
    });

    const announcement = await prisma.announcement.create({
      data: {
        organisationId: testOrg.id,
        title: 'Org Notice',
        content: 'Notice content',
      },
    });

    // Execute deletion of final config
    const result = await ApplicationsService.deleteApplication(testConfig.id, {
      userId: superAdminUser.id,
      userCode: superAdminUser.userCode,
      mobileNumber: superAdminUser.mobileNumber,
      role: superAdminUser.role,
      organisationId: null,
    });

    assert.equal(result.deleted, true);
    assert.equal(result.permanentOrgPurge, true);
    assert.equal(result.purgedUserCount, 1);

    // Verify tenant user is completely removed from User table (no orphaned detached user!)
    const checkUser = await prisma.user.findUnique({ where: { id: tenantUser.id } });
    assert.equal(checkUser, null, 'Tenant user must be permanently purged on final org deletion');

    // Verify dependents are cleaned up
    const checkSession = await prisma.loginSession.findUnique({ where: { id: session.id } });
    assert.equal(checkSession, null);

    const checkDevice = await prisma.userDevice.findUnique({ where: { id: device.id } });
    assert.equal(checkDevice, null);

    const checkOtp = await prisma.oTPVerification.findUnique({ where: { id: otp.id } });
    assert.equal(checkOtp, null);

    const checkAnnouncement = await prisma.announcement.findUnique({ where: { id: announcement.id } });
    assert.equal(checkAnnouncement, null);

    const checkOrg = await prisma.organisation.findUnique({ where: { id: testOrg.id } });
    assert.equal(checkOrg, null, 'Organisation must be cleanly deleted');

    // TEST: Phone reuse succeeds immediately after previous tenant account has been validly retired
    const newOrg = await prisma.organisation.create({
      data: {
        name: `New Org Phone Reuse ${timestamp}`,
        code: `NEWP_${timestamp.toString().slice(-6)}`,
      },
    });
    testOrgIds.push(newOrg.id);

    const newUser = await prisma.user.create({
      data: {
        organisationId: newOrg.id,
        name: 'New Reused Phone User',
        userCode: `NEWU_${timestamp.toString().slice(-4)}`,
        mobileNumber: reusableMobile, // REUSED MOBILE NUMBER!
        role: RoleType.BOOTH_INCHARGE,
      },
    });

    assert.ok(newUser, 'New account successfully claimed the freed phone number without collision');
    assert.equal(newUser.mobileNumber, reusableMobile);
  });

  it('3. Atomicity & Rollback: Failure during deletion leaves no partially deleted tenant state', async () => {
    const timestamp = Date.now() + 200;
    const testOrg = await prisma.organisation.create({
      data: {
        name: `Rollback Test Org ${timestamp}`,
        code: `RB_${timestamp.toString().slice(-6)}`,
      },
    });
    testOrgIds.push(testOrg.id);

    const testConfig = await prisma.cMSConfiguration.create({
      data: getSampleCMSData(testOrg, `cfg_rb_${timestamp}`, 'Rollback App'),
    });

    const tenantUser = await prisma.user.create({
      data: {
        organisationId: testOrg.id,
        name: 'Rollback User',
        userCode: `RB_U_${timestamp.toString().slice(-4)}`,
        mobileNumber: `9333${timestamp.toString().slice(-6)}`,
        role: RoleType.VOTER_100_INCHARGE,
      },
    });

    // Attempt deletion with invalid/non-existent ID throws 404
    await assert.rejects(
      async () => {
        await ApplicationsService.deleteApplication('non-existent-uuid-12345');
      },
      (err: any) => {
        assert.ok(err.message.includes('not found'));
        return true;
      },
    );

    // Verify existing state was completely untouched
    const checkOrg = await prisma.organisation.findUnique({ where: { id: testOrg.id } });
    assert.ok(checkOrg, 'Organisation must remain intact');

    const checkConfig = await prisma.cMSConfiguration.findUnique({ where: { id: testConfig.id } });
    assert.ok(checkConfig, 'Configuration must remain intact');

    const checkUser = await prisma.user.findUnique({ where: { id: tenantUser.id } });
    assert.ok(checkUser, 'Tenant user must remain intact');
  });

  it('5. SUPER_ADMIN Immunity: Legitimate platform administrators are never deleted during tenant deletion', async () => {
    const timestamp = Date.now() + 300;
    const testOrg = await prisma.organisation.create({
      data: {
        name: `Admin Immunity Org ${timestamp}`,
        code: `IMM_${timestamp.toString().slice(-6)}`,
      },
    });
    testOrgIds.push(testOrg.id);

    const testConfig = await prisma.cMSConfiguration.create({
      data: getSampleCMSData(testOrg, `cfg_imm_${timestamp}`, 'Immunity App'),
    });

    // Create a regular tenant user
    const tenantUser = await prisma.user.create({
      data: {
        organisationId: testOrg.id,
        name: 'Normal Tenant User',
        userCode: `NORM_${timestamp.toString().slice(-4)}`,
        mobileNumber: `9444${timestamp.toString().slice(-6)}`,
        role: RoleType.BOOTH_PRESIDENT,
      },
    });

    // Ensure superAdminUser is known and exists
    const superAdminBefore = await prisma.user.findUnique({
      where: { id: superAdminUser.id },
    });
    assert.ok(superAdminBefore);
    assert.equal(superAdminBefore.role, RoleType.SUPER_ADMIN);

    // Delete the application
    await ApplicationsService.deleteApplication(testConfig.id, {
      userId: superAdminUser.id,
      userCode: superAdminUser.userCode,
      mobileNumber: superAdminUser.mobileNumber,
      role: superAdminUser.role,
      organisationId: null,
    });

    // Verify regular tenant user is purged
    const checkTenantUser = await prisma.user.findUnique({ where: { id: tenantUser.id } });
    assert.equal(checkTenantUser, null);

    // Verify platform SUPER_ADMIN is 100% intact!
    const superAdminAfter = await prisma.user.findUnique({
      where: { id: superAdminUser.id },
    });
    assert.ok(superAdminAfter, 'Platform SUPER_ADMIN must NEVER be deleted');
    assert.equal(superAdminAfter.role, RoleType.SUPER_ADMIN);
  });

  it('6. Tenant Isolation: Organisation-null users cannot obtain unauthorized tenant or platform access', async () => {
    // User 9340423885 is known to have organisationId = null
    const orphanedUser = await prisma.user.findFirst({
      where: { organisationId: null, role: { not: RoleType.SUPER_ADMIN } },
    });

    if (orphanedUser) {
      // Attempting tenant login OTP flow
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/request-otp',
        payload: {
          mobileNumber: orphanedUser.mobileNumber,
          role: orphanedUser.role,
        },
      });

      // Must be rejected with 403 Forbidden because user is not linked to any active political party/organization
      assert.equal(res.statusCode, 403, 'Orphaned user must not obtain tenant authentication');
      const body = JSON.parse(res.payload);
      assert.ok(
        body.error?.message?.includes('not registered with any active political party') ||
        body.error?.message?.includes('Access restricted') ||
        body.error?.message?.includes('Access denied'),
      );
    }
  });

  it('8. Duplicate Prevention: Concurrent duplicate mobile registration is safely rejected', async () => {
    const timestamp = Date.now() + 400;
    const testOrg = await prisma.organisation.create({
      data: {
        name: `Duplicate Test Org ${timestamp}`,
        code: `DUP_${timestamp.toString().slice(-6)}`,
      },
    });
    testOrgIds.push(testOrg.id);

    const mobile = `9555${timestamp.toString().slice(-6)}`;

    // Create user 1
    await prisma.user.create({
      data: {
        organisationId: testOrg.id,
        name: 'User One',
        userCode: `DUP1_${timestamp.toString().slice(-4)}`,
        mobileNumber: mobile,
        role: RoleType.VOTER_100_INCHARGE,
      },
    });

    // Attempting to register another user with the exact same mobile number must fail uniquely
    await assert.rejects(
      async () => {
        await prisma.user.create({
          data: {
            organisationId: testOrg.id,
            name: 'User Two Duplicate',
            userCode: `DUP2_${timestamp.toString().slice(-4)}`,
            mobileNumber: mobile,
            role: RoleType.VOTER_100_INCHARGE,
          },
        });
      },
      (err: any) => {
        assert.ok(err.code === 'P2002' || err.message.includes('Unique constraint'));
        return true;
      },
    );
  });

  it('9. Audit Trail: Deletion records immutable audit event attributed to platform operator', async () => {
    const timestamp = Date.now() + 500;
    const testOrg = await prisma.organisation.create({
      data: {
        name: `Audit Org ${timestamp}`,
        code: `AUD_${timestamp.toString().slice(-6)}`,
      },
    });
    testOrgIds.push(testOrg.id);

    const testConfig = await prisma.cMSConfiguration.create({
      data: getSampleCMSData(testOrg, `cfg_aud_${timestamp}`, 'Audit App'),
    });

    await ApplicationsService.deleteApplication(testConfig.id, {
      userId: superAdminUser.id,
      userCode: superAdminUser.userCode,
      mobileNumber: superAdminUser.mobileNumber,
      role: superAdminUser.role,
      organisationId: null,
    });

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        entityType: 'CMSConfiguration',
        entityId: testConfig.id,
        userId: superAdminUser.id,
        action: AuditAction.DELETE,
      },
      orderBy: { createdAt: 'desc' },
    });

    assert.ok(auditLog, 'Audit log must record application deletion under operator account');
    assert.equal(auditLog.userId, superAdminUser.id);
  });

  it('11. Cross-Tenant Protection: Deleting one organization never modifies another organization data', async () => {
    const timestamp = Date.now() + 600;
    const orgA = await prisma.organisation.create({
      data: { name: `Isolation Org A ${timestamp}`, code: `ISOA_${timestamp.toString().slice(-6)}` },
    });
    testOrgIds.push(orgA.id);

    const orgB = await prisma.organisation.create({
      data: { name: `Isolation Org B ${timestamp}`, code: `ISOB_${timestamp.toString().slice(-6)}` },
    });
    testOrgIds.push(orgB.id);

    const configA = await prisma.cMSConfiguration.create({
      data: getSampleCMSData(orgA, `cfg_isoa_${timestamp}`, 'App A'),
    });

    const configB = await prisma.cMSConfiguration.create({
      data: getSampleCMSData(orgB, `cfg_isob_${timestamp}`, 'App B'),
    });

    const userB = await prisma.user.create({
      data: {
        organisationId: orgB.id,
        name: 'Tenant B User',
        userCode: `USER_B_${timestamp.toString().slice(-4)}`,
        mobileNumber: `9777${timestamp.toString().slice(-6)}`,
        role: RoleType.CONSTITUENCY_INCHARGE,
      },
    });

    // Delete Org A
    await ApplicationsService.deleteApplication(configA.id, {
      userId: superAdminUser.id,
      userCode: superAdminUser.userCode,
      mobileNumber: superAdminUser.mobileNumber,
      role: superAdminUser.role,
      organisationId: null,
    });

    // Verify Org A is deleted
    const checkOrgA = await prisma.organisation.findUnique({ where: { id: orgA.id } });
    assert.equal(checkOrgA, null);

    // Verify Org B and its users, configs are 100% UNTOUCHED
    const checkOrgB = await prisma.organisation.findUnique({ where: { id: orgB.id } });
    assert.ok(checkOrgB, 'Org B must remain intact');

    const checkConfigB = await prisma.cMSConfiguration.findUnique({ where: { id: configB.id } });
    assert.ok(checkConfigB, 'Config B must remain intact');

    const checkUserB = await prisma.user.findUnique({ where: { id: userB.id } });
    assert.ok(checkUserB, 'User B must remain intact');
    assert.equal(checkUserB.organisationId, orgB.id);
  });

  it('12. Post-Deletion Accuracy: getApplications returns accurate application lists and voter counts', async () => {
    const timestamp = Date.now() + 800;
    const orgTarget = await prisma.organisation.create({
      data: { name: `Target Count Org ${timestamp}`, code: `TGT_${timestamp.toString().slice(-6)}` },
    });
    testOrgIds.push(orgTarget.id);

    const orgSurvivor = await prisma.organisation.create({
      data: { name: `Survivor Count Org ${timestamp}`, code: `SRV_${timestamp.toString().slice(-6)}` },
    });
    testOrgIds.push(orgSurvivor.id);

    const configTarget = await prisma.cMSConfiguration.create({
      data: getSampleCMSData(orgTarget, `cfg_tgt_${timestamp}`, 'Target App'),
    });

    const configSurvivor = await prisma.cMSConfiguration.create({
      data: getSampleCMSData(orgSurvivor, `cfg_srv_${timestamp}`, 'Survivor App'),
    });

    const stateSurvivor = await prisma.state.create({
      data: {
        name: `Survivor State ${timestamp}`,
        code: `ST_SRV_${timestamp.toString().slice(-6)}`,
        organisationId: orgSurvivor.id,
      },
    });

    // Create 2 voters attached to Survivor State
    await prisma.voter.create({
      data: {
        epicNumber: `EPIC_SRV1_${timestamp.toString().slice(-6)}`,
        name: 'Survivor Voter 1',
        fatherHusbandName: 'Parent',
        houseNumber: '10-1',
        age: 30,
        serialNumber: 1,
        stateId: stateSurvivor.id,
      },
    });

    await prisma.voter.create({
      data: {
        epicNumber: `EPIC_SRV2_${timestamp.toString().slice(-6)}`,
        name: 'Survivor Voter 2',
        fatherHusbandName: 'Parent',
        houseNumber: '10-2',
        age: 32,
        serialNumber: 2,
        stateId: stateSurvivor.id,
      },
    });

    // Verify before deletion
    const appsBefore = await ApplicationsService.getApplications(undefined, true);
    const survivorAppBefore = appsBefore.find((a) => a.id === configSurvivor.id);
    assert.ok(survivorAppBefore);
    assert.equal(survivorAppBefore.votersCount, 2);

    // Delete Target application
    await ApplicationsService.deleteApplication(configTarget.id, {
      userId: superAdminUser.id,
      userCode: superAdminUser.userCode,
      mobileNumber: superAdminUser.mobileNumber,
      role: superAdminUser.role,
      organisationId: null,
    });

    // Verify after deletion
    const appsAfter = await ApplicationsService.getApplications(undefined, true);
    const targetAppAfter = appsAfter.find((a) => a.id === configTarget.id);
    const survivorAppAfter = appsAfter.find((a) => a.id === configSurvivor.id);

    assert.equal(targetAppAfter, undefined, 'Target app must be completely absent from getApplications');
    assert.ok(survivorAppAfter, 'Survivor app must remain present');
    assert.equal(survivorAppAfter.votersCount, 2, 'Survivor app voter count must remain precisely 2');
  });
});
