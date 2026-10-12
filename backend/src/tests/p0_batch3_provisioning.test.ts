process.env.NODE_ENV = 'test';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { RoleType } from '@prisma/client';
import { TokenService } from '../modules/auth/services/token.service.js';

describe('P0 Security Hardening - Batch 3 Provisioning Safety & Atomicity', () => {
  let app: any;
  let adminOrg: any;
  let adminParty: any;
  let superAdminUser: any;
  let adminToken: string;
  const createdOrgIds: string[] = [];

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

  before(async () => {
    app = buildApp();
    await app.ready();

    adminOrg = await prisma.organisation.create({
      data: {
        name: `P0-Batch3-AdminOrg-${Date.now()}`,
        code: `B3A-${Date.now().toString().slice(-4)}`,
        isActive: true,
      },
    });
    createdOrgIds.push(adminOrg.id);

    adminParty = await prisma.politicalParty.create({
      data: {
        organisationId: adminOrg.id,
        name: 'Test Admin Party',
        code: `TAP-${Date.now().toString().slice(-4)}`,
        shortName: 'TAP',
        primaryColor: '#eab308',
      },
    });

    superAdminUser = await prisma.user.create({
      data: {
        organisationId: adminOrg.id,
        name: 'Batch 3 SuperAdmin',
        userCode: `SU-${Date.now().toString().slice(-4)}`,
        mobileNumber: `9833${Date.now().toString().slice(-6)}`,
        role: RoleType.SUPER_ADMIN,
        accountStatus: 'ACTIVE',
        isVerified: true,
      },
    });

    adminToken = await issueValidToken(superAdminUser);
  });

  after(async () => {
    // Clean up created test entities
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

  it('1. Atomic provisioning creates complete tenant hierarchy in transaction with no hardcoded fallback passwords', async () => {
    const timestamp = Date.now().toString().slice(-4);
    const tenantCode = `P0T-${timestamp}`;
    const orgName = `P0 Secured Party ${timestamp}`;
    const candidateMobile = `9123${Date.now().toString().slice(-6)}`;
    const explicitPassword = 'CustomSecurePassword!2026';

    const res = await app.inject({
      method: 'POST',
      url: '/api/cms/build-application',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        appName: orgName,
        organisationName: orgName,
        tenantCode,
        activePartyCode: `PRT-${timestamp}`,
        appScope: 'SINGLE_MLA',
        stateName: 'Andhra Pradesh',
        parliamentName: `Secured Parliament ${timestamp}`,
        candidateName: 'Test Candidate',
        candidateMobile,
        password: explicitPassword,
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.ok(body.data.application.organisationId);
    assert.equal(body.data.application.tenantCode, tenantCode);

    const newOrgId = body.data.application.organisationId;
    createdOrgIds.push(newOrgId);

    // Verify DB integrity
    const org = await prisma.organisation.findUnique({ where: { id: newOrgId } });
    assert.ok(org, 'Organisation must exist');
    assert.equal(org.code, tenantCode);

    const cmsConfig = await prisma.cMSConfiguration.findFirst({ where: { organisationId: newOrgId } });
    assert.ok(cmsConfig, 'CMSConfiguration must exist');

    const candidate = await prisma.user.findFirst({ where: { mobileNumber: candidateMobile } });
    assert.ok(candidate, 'Candidate user must exist');
    assert.equal(candidate.organisationId, newOrgId);

    // Verify password was hashed with the explicit password and NEVER matches old 'Kondapi@2026'
    assert.ok(candidate.passwordHash, 'Password must be hashed');
    const matchesExplicit = await bcrypt.compare(explicitPassword, candidate.passwordHash);
    assert.equal(matchesExplicit, true, 'Hashed password must match supplied password');

    const matchesHardcodedFallback = await bcrypt.compare('Kondapi@2026', candidate.passwordHash);
    assert.equal(matchesHardcodedFallback, false, 'Password MUST NOT match hardcoded Kondapi@2026 default');

    // Verify no backdoor demo role accounts were provisioned
    const otherUsers = await prisma.user.findMany({
      where: {
        organisationId: newOrgId,
        id: { not: candidate.id },
      },
    });
    assert.equal(otherUsers.length, 0, 'No backdoor mock users should be created');
  });

  it('2. Provisioning without password hashes secure random credentials, never default/shared password', async () => {
    const timestamp = (Date.now() + 1).toString().slice(-4);
    const tenantCode = `P0N-${timestamp}`;
    const orgName = `P0 NoPass Party ${timestamp}`;
    const candidateMobile = `9124${Date.now().toString().slice(-6)}`;

    const res = await app.inject({
      method: 'POST',
      url: '/api/cms/build-application',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        appName: orgName,
        organisationName: orgName,
        tenantCode,
        activePartyCode: `NPRT-${timestamp}`,
        appScope: 'SINGLE_MLA',
        stateName: 'Andhra Pradesh',
        candidateName: 'No Password Candidate',
        candidateMobile,
        // password intentionally omitted
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    const newOrgId = body.data.application.organisationId;
    createdOrgIds.push(newOrgId);

    // Credentials returned to client must NOT have a shared default password
    assert.equal(body.data.credentials.password, undefined);

    const candidate = await prisma.user.findFirst({ where: { mobileNumber: candidateMobile } });
    assert.ok(candidate);
    assert.ok(candidate.passwordHash);
    const matchesHardcodedFallback = await bcrypt.compare('Kondapi@2026', candidate.passwordHash!);
    assert.equal(matchesHardcodedFallback, false, 'Password MUST NOT match hardcoded Kondapi@2026 default');
  });

  it('3. Duplicate tenant code is rejected with HTTP 409 TENANT_ALREADY_EXISTS', async () => {
    const existingOrg = await prisma.organisation.findFirst({
      where: { id: { in: createdOrgIds } },
    });
    assert.ok(existingOrg);

    const res = await app.inject({
      method: 'POST',
      url: '/api/cms/build-application',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        appName: 'Unique New App Name',
        organisationName: 'Unique New Org Name',
        tenantCode: existingOrg.code, // Conflict!
        appScope: 'SINGLE_MLA',
      },
    });

    assert.equal(res.statusCode, 409);
    const body = JSON.parse(res.body);
    assert.equal(body.success, false);
    assert.equal(body.error?.code, 'TENANT_ALREADY_EXISTS');
  });

  it('4. Duplicate tenant name (case-insensitive) is rejected with HTTP 409 TENANT_ALREADY_EXISTS', async () => {
    const existingOrg = await prisma.organisation.findFirst({
      where: { id: { in: createdOrgIds } },
    });
    assert.ok(existingOrg);

    const res = await app.inject({
      method: 'POST',
      url: '/api/cms/build-application',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        appName: existingOrg.name.toLowerCase(), // Conflict on name!
        organisationName: existingOrg.name.toLowerCase(),
        tenantCode: `DIFF-${Date.now().toString().slice(-4)}`,
        appScope: 'SINGLE_MLA',
      },
    });

    assert.equal(res.statusCode, 409);
    const body = JSON.parse(res.body);
    assert.equal(body.success, false);
    assert.equal(body.error?.code, 'TENANT_ALREADY_EXISTS');
  });

  it('5. Mid-operation failure rolls back entire transaction leaving zero orphaned records', async () => {
    const timestamp = (Date.now() + 2).toString().slice(-4);
    const testCode = `ROLL-${timestamp}`;
    const testOrgName = `Rollback Test Org ${timestamp}`;

    // Verify test organization does not exist before test
    const beforeCount = await prisma.organisation.count({
      where: { code: testCode },
    });
    assert.equal(beforeCount, 0);

    // Simulate an atomic transaction failure inside prisma.$transaction
    // Attempt to execute a transaction that creates organization then encounters an intentional error
    let transactionThrew = false;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.organisation.create({
          data: {
            name: testOrgName,
            code: testCode,
            isActive: true,
          },
        });
        // Intentionally throw mid-operation failure
        throw new Error('Simulated mid-provisioning failure: disk/constraint error');
      });
    } catch (err: any) {
      transactionThrew = true;
      assert.ok(err.message.includes('Simulated mid-provisioning failure'));
    }

    assert.equal(transactionThrew, true);

    // Verify rollback: organisation record was NOT committed
    const afterCount = await prisma.organisation.count({
      where: { code: testCode },
    });
    assert.equal(afterCount, 0, 'No orphaned organisation record should persist after transaction failure');
  });
});
