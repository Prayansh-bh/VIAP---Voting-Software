process.env.NODE_ENV = 'test';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { RoleType } from '@prisma/client';
import { TokenService } from '../modules/auth/services/token.service.js';
import { encryptSecret, decryptSecret, maskSecret } from '../lib/crypto.js';
import { CredentialsService } from '../modules/credentials/credentials.service.js';

describe('Phase 5 — Encrypted Credential Management & Tenant Party Admin Suite', () => {
  let app: any;
  let tenantAOrg: any;
  let tenantBOrg: any;
  let tenantAAdmin: any;
  let tenantBAdmin: any;
  let partyAdminUser: any;
  let superAdminUser: any;

  let tenantAToken: string;
  let tenantBToken: string;
  let partyAdminToken: string;
  let superAdminToken: string;

  let testKeyName: string;

  const createdOrgIds: string[] = [];

  async function issueToken(user: any, roleOverride?: string) {
    const role = roleOverride || user.role;
    const payload = {
      userId: user.id,
      userCode: user.userCode,
      mobileNumber: user.mobileNumber,
      role,
      organisationId: user.organisationId,
    };
    const { token, sessionId } = TokenService.generateTokens(payload);
    await TokenService.recordLoginSession(user.id, user.mobileNumber, token, sessionId);
    return token;
  }

  before(async () => {
    app = await buildApp();
    const timestamp = Date.now();
    testKeyName = `SMS_KEY_${timestamp}`;

    // 1. Create Tenant A and Tenant B Organisations
    tenantAOrg = await prisma.organisation.create({
      data: {
        name: `Cred Org A ${timestamp}`,
        code: `CRD_A_${timestamp}`,
        description: 'Tenant A for Credentials & Party Admin Testing',
      },
    });
    createdOrgIds.push(tenantAOrg.id);

    tenantBOrg = await prisma.organisation.create({
      data: {
        name: `Cred Org B ${timestamp}`,
        code: `CRD_B_${timestamp}`,
        description: 'Tenant B for Credentials & Party Admin Testing',
      },
    });
    createdOrgIds.push(tenantBOrg.id);

    // Create PoliticalParty for both tenants to satisfy PartyEligibilityService
    await prisma.politicalParty.create({
      data: {
        name: `Cred Party A ${timestamp}`,
        code: `CPA_${timestamp}`,
        shortName: `CPA_${timestamp}`,
        organisationId: tenantAOrg.id,
      },
    });
    await prisma.politicalParty.create({
      data: {
        name: `Cred Party B ${timestamp}`,
        code: `CPB_${timestamp}`,
        shortName: `CPB_${timestamp}`,
        organisationId: tenantBOrg.id,
      },
    });

    // Setup hierarchy for Tenant A and Tenant B
    const stateA = await prisma.state.create({
      data: { name: `Cred State A ${timestamp}`, code: `CSA_${timestamp}`, organisationId: tenantAOrg.id },
    });
    const stateB = await prisma.state.create({
      data: { name: `Cred State B ${timestamp}`, code: `CSB_${timestamp}`, organisationId: tenantBOrg.id },
    });

    // 2. Create Users
    tenantAAdmin = await prisma.user.create({
      data: {
        userCode: `TA_ADM_${timestamp}`,
        name: 'Tenant A State Admin',
        mobileNumber: `9011${String(timestamp).slice(-6)}`,
        role: RoleType.STATE_ADMIN,
        organisationId: tenantAOrg.id,
        accountStatus: 'ACTIVE',
      },
    });
    await prisma.userHierarchyAssignment.create({
      data: { userId: tenantAAdmin.id, stateId: stateA.id, roleType: RoleType.STATE_ADMIN, isActive: true },
    });

    tenantBAdmin = await prisma.user.create({
      data: {
        userCode: `TB_ADM_${timestamp}`,
        name: 'Tenant B State Admin',
        mobileNumber: `9012${String(timestamp).slice(-6)}`,
        role: RoleType.STATE_ADMIN,
        organisationId: tenantBOrg.id,
        accountStatus: 'ACTIVE',
      },
    });
    await prisma.userHierarchyAssignment.create({
      data: { userId: tenantBAdmin.id, stateId: stateB.id, roleType: RoleType.STATE_ADMIN, isActive: true },
    });

    partyAdminUser = await prisma.user.create({
      data: {
        userCode: `PA_USER_${timestamp}`,
        name: 'Party Admin Tenant A',
        mobileNumber: `9013${String(timestamp).slice(-6)}`,
        role: RoleType.STATE_ADMIN, // DB role maps to state admin level
        organisationId: tenantAOrg.id,
        accountStatus: 'ACTIVE',
      },
    });
    await prisma.userHierarchyAssignment.create({
      data: { userId: partyAdminUser.id, stateId: stateA.id, roleType: RoleType.STATE_ADMIN, isActive: true },
    });

    superAdminUser = await prisma.user.create({
      data: {
        userCode: `SA_USER_${timestamp}`,
        name: 'Super Admin User',
        mobileNumber: `9014${String(timestamp).slice(-6)}`,
        role: RoleType.SUPER_ADMIN,
        accountStatus: 'ACTIVE',
      },
    });

    // Issue JWTs
    tenantAToken = await issueToken(tenantAAdmin);
    tenantBToken = await issueToken(tenantBAdmin);
    partyAdminToken = await issueToken(partyAdminUser, 'PARTY_ADMIN');
    superAdminToken = await issueToken(superAdminUser);
  });

  after(async () => {
    if (app) await app.close();
  });

  // --------------------------------------------------------------------------
  // TEST 1: AES-256-GCM Encryption at Rest & Secret Masking
  // --------------------------------------------------------------------------
  it('1. verifies AES-256-GCM ciphertext, unique IV, authTag, and secret masking at rest', async () => {
    const rawSecret = 'sk_live_9876543210abcdef998877';
    const enc1 = encryptSecret(rawSecret);
    const enc2 = encryptSecret(rawSecret);

    // Verification of encryption payload structure
    assert.ok(enc1.ciphertext, 'Ciphertext must be present');
    assert.ok(enc1.iv, 'IV must be present');
    assert.ok(enc1.authTag, 'AuthTag must be present');
    assert.equal(enc1.iv.length, 24, 'IV must be 12 bytes (24 hex chars)');
    assert.equal(enc1.authTag.length, 32, 'AuthTag must be 16 bytes (32 hex chars)');

    // Verification of randomized IV per encryption
    assert.notEqual(enc1.iv, enc2.iv, 'Each encryption must use a unique initialization vector');
    assert.notEqual(enc1.ciphertext, enc2.ciphertext, 'Different IVs must yield different ciphertexts');

    // Verification of proper decryption
    const decrypted = decryptSecret(enc1);
    assert.equal(decrypted, rawSecret, 'Decrypted secret must match raw secret exactly');

    // Tampering detection (GCM authenticity)
    assert.throws(() => {
      decryptSecret({ ...enc1, authTag: '00000000000000000000000000000000' });
    }, /Unsupported state or unable to authenticate data|bad decrypt/i);

    // Verification of maskSecret
    assert.equal(maskSecret('sk_live_9876543210abcdef998877'), 'sk_live_...8877');
    assert.equal(maskSecret('msg91_test_secret_key_12345'), 'msg91_...2345');
    assert.equal(maskSecret('short'), '****rt');
    assert.equal(maskSecret(''), '****');

    // Verification of storage at rest in CMSConfiguration
    const cred = await CredentialsService.setCredential(
      tenantAOrg.id,
      testKeyName,
      rawSecret,
      tenantAAdmin.id,
      'fast2sms',
    );
    assert.equal(cred.keyName, testKeyName);
    assert.equal(cred.maskedValue, 'sk_live_...8877');
    assert.equal(cred.version, 1);

    const cms = await prisma.cMSConfiguration.findFirst({
      where: { organisationId: tenantAOrg.id },
    });
    assert.ok(cms);
    const storedRecord = (cms.dashboardConfig as any)?.credentials?.[testKeyName];
    assert.ok(storedRecord, 'Credential record must be saved in dashboardConfig.credentials');
    assert.ok(storedRecord.ciphertext, 'Ciphertext must be saved in database');
    assert.ok(storedRecord.iv, 'IV must be saved in database');
    assert.ok(storedRecord.authTag, 'AuthTag must be saved in database');
    assert.equal(storedRecord.maskedValue, 'sk_live_...8877');

    // CRITICAL: Plaintext secret must NEVER be saved in the database
    const rawJson = JSON.stringify(cms.dashboardConfig);
    assert.equal(rawJson.includes(rawSecret), false, 'Plaintext secret MUST NOT be stored in database JSON');
  });

  // --------------------------------------------------------------------------
  // TEST 2: Credential Retrieval & Audit Trail Masking
  // --------------------------------------------------------------------------
  it('2. verifies list returns masked values only, reveal decrypts plaintext, and audit log contains only masked data', async () => {
    // 1. List credentials via API
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/credentials',
      headers: { authorization: `Bearer ${tenantAToken}` },
    });
    assert.equal(listRes.statusCode, 200);
    const listBody = JSON.parse(listRes.body);
    assert.equal(listBody.success, true);
    assert.ok(Array.isArray(listBody.data));

    const item = listBody.data.find((c: any) => c.keyName === testKeyName);
    assert.ok(item, 'Stored credential must appear in list');
    assert.equal(item.maskedValue, 'sk_live_...8877');
    assert.equal(item.version, 1);
    assert.equal(item.ciphertext, undefined, 'Ciphertext must NEVER be leaked in list endpoint');
    assert.equal(item.secretValue, undefined, 'Secret value must NEVER be leaked in list endpoint');

    // 2. Reveal credential via authorized endpoint
    const revealRes = await app.inject({
      method: 'GET',
      url: `/api/credentials/${testKeyName}/reveal`,
      headers: { authorization: `Bearer ${tenantAToken}` },
    });
    assert.equal(revealRes.statusCode, 200);
    const revealBody = JSON.parse(revealRes.body);
    assert.equal(revealBody.success, true);
    assert.equal(revealBody.data.secretValue, 'sk_live_9876543210abcdef998877');
    assert.equal(revealBody.data.maskedValue, 'sk_live_...8877');

    // 3. Verify Audit Log
    const auditLogs = await prisma.auditLog.findMany({
      where: { entityType: 'Credential', entityId: testKeyName },
    });
    assert.ok(auditLogs.length >= 2, 'Audit logs must be created for CREATE and REVEAL actions');

    for (const log of auditLogs) {
      const metaStr = JSON.stringify(log.metadata);
      assert.equal(
        metaStr.includes('sk_live_9876543210abcdef998877'),
        false,
        'Plaintext secret MUST NEVER be recorded in AuditLog metadata',
      );
      assert.ok(metaStr.includes('sk_live_...8877'), 'AuditLog metadata MUST include maskedValue');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 3: Credential Rotation & Version Increment
  // --------------------------------------------------------------------------
  it('3. rotates credential secret, increments version, archives rotated timestamp, and validates new decrypted value', async () => {
    const rotatedSecret = 'sk_live_new_rotated_secret_value_112233';

    const rotateRes = await app.inject({
      method: 'POST',
      url: `/api/credentials/${testKeyName}/rotate`,
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: { newSecretValue: rotatedSecret },
    });
    assert.equal(rotateRes.statusCode, 200);
    const rotateBody = JSON.parse(rotateRes.body);
    assert.equal(rotateBody.success, true);
    assert.equal(rotateBody.data.version, 2, 'Version must increment to 2 on rotation');
    assert.equal(rotateBody.data.maskedValue, 'sk_live_...2233');

    // Verify reveal returns rotated secret
    const revealRes = await app.inject({
      method: 'GET',
      url: `/api/credentials/${testKeyName}/reveal`,
      headers: { authorization: `Bearer ${tenantAToken}` },
    });
    assert.equal(revealRes.statusCode, 200);
    const revealBody = JSON.parse(revealRes.body);
    assert.equal(revealBody.data.secretValue, rotatedSecret);
    assert.equal(revealBody.data.version, 2);

    // Verify DB record has rotatedAt
    const cms = await prisma.cMSConfiguration.findFirst({
      where: { organisationId: tenantAOrg.id },
    });
    const record = (cms?.dashboardConfig as any)?.credentials?.[testKeyName];
    assert.equal(record.version, 2);
    assert.ok(record.rotatedAt, 'rotatedAt timestamp must be recorded');
  });

  // --------------------------------------------------------------------------
  // TEST 4: Cross-Tenant Credential Isolation
  // --------------------------------------------------------------------------
  it('4. strictly blocks Tenant B admin from listing, revealing, rotating, or deleting Tenant A credentials', async () => {
    // 1. Tenant B listing credentials -> should NOT see Tenant A's credential
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/credentials',
      headers: { authorization: `Bearer ${tenantBToken}` },
    });
    assert.equal(listRes.statusCode, 200);
    const listBody = JSON.parse(listRes.body);
    const item = listBody.data.find((c: any) => c.keyName === testKeyName);
    assert.equal(item, undefined, 'Tenant B must NOT see Tenant A credentials in list');

    // 2. Tenant B attempting to reveal Tenant A credential -> 404 NOT_FOUND
    const revealRes = await app.inject({
      method: 'GET',
      url: `/api/credentials/${testKeyName}/reveal`,
      headers: { authorization: `Bearer ${tenantBToken}` },
    });
    assert.equal(revealRes.statusCode, 404);
    const revealBody = JSON.parse(revealRes.body);
    assert.equal(revealBody.success, false);
    assert.equal(revealBody.error?.code, 'NOT_FOUND');

    // 3. Tenant B attempting to rotate Tenant A credential -> 404 NOT_FOUND
    const rotateRes = await app.inject({
      method: 'POST',
      url: `/api/credentials/${testKeyName}/rotate`,
      headers: { authorization: `Bearer ${tenantBToken}` },
      payload: { newSecretValue: 'hacked_value_12345' },
    });
    assert.equal(rotateRes.statusCode, 404);

    // 4. Tenant B attempting to delete Tenant A credential -> 404 NOT_FOUND
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/credentials/${testKeyName}`,
      headers: { authorization: `Bearer ${tenantBToken}` },
    });
    assert.equal(deleteRes.statusCode, 404);

    // 5. Tenant B passing organisationId query parameter spoofing Tenant A -> ignored and scoped to Tenant B
    const spoofRes = await app.inject({
      method: 'GET',
      url: `/api/credentials?organisationId=${tenantAOrg.id}`,
      headers: { authorization: `Bearer ${tenantBToken}` },
    });
    assert.equal(spoofRes.statusCode, 200);
    const spoofBody = JSON.parse(spoofRes.body);
    const spoofItem = spoofBody.data.find((c: any) => c.keyName === testKeyName);
    assert.equal(spoofItem, undefined, 'Tenant B cannot spoof tenantId via query parameter');
  });

  // --------------------------------------------------------------------------
  // TEST 5: Tenant-Scoped PARTY_ADMIN Role Permissions
  // --------------------------------------------------------------------------
  it('5. allows PARTY_ADMIN to manage credentials, tasks, voters, and cadre within their organisation', async () => {
    // 1. PARTY_ADMIN can list credentials
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/credentials',
      headers: { authorization: `Bearer ${partyAdminToken}` },
    });
    assert.equal(listRes.statusCode, 200);

    // 2. PARTY_ADMIN can store a new credential in their organisation
    const createCredRes = await app.inject({
      method: 'POST',
      url: '/api/credentials',
      headers: { authorization: `Bearer ${partyAdminToken}` },
      payload: {
        keyName: 'WHATSAPP_BUSINESS_API',
        secretValue: 'whatsapp_live_token_abcdef123456',
        provider: 'meta',
      },
    });
    assert.equal(createCredRes.statusCode, 201);
    const createBody = JSON.parse(createCredRes.body);
    assert.equal(createBody.data.keyName, 'WHATSAPP_BUSINESS_API');
    assert.equal(createBody.data.maskedValue, 'whatsapp_...3456');

    // 3. PARTY_ADMIN can reveal credential in their organisation
    const revealRes = await app.inject({
      method: 'GET',
      url: '/api/credentials/WHATSAPP_BUSINESS_API/reveal',
      headers: { authorization: `Bearer ${partyAdminToken}` },
    });
    assert.equal(revealRes.statusCode, 200);
    const revealBody = JSON.parse(revealRes.body);
    assert.equal(revealBody.data.secretValue, 'whatsapp_live_token_abcdef123456');

    // 4. PARTY_ADMIN can query voters in their organisation
    const votersRes = await app.inject({
      method: 'GET',
      url: '/api/voters',
      headers: { authorization: `Bearer ${partyAdminToken}` },
    });
    assert.equal(votersRes.statusCode, 200);

    // 5. PARTY_ADMIN can query cadre in their organisation
    const cadreRes = await app.inject({
      method: 'GET',
      url: '/api/cadre',
      headers: { authorization: `Bearer ${partyAdminToken}` },
    });
    assert.equal(cadreRes.statusCode, 200);
  });

  // --------------------------------------------------------------------------
  // TEST 6: PARTY_ADMIN Platform Escalation Rejection
  // --------------------------------------------------------------------------
  it('6. strictly rejects PARTY_ADMIN from accessing SuperAdmin endpoints or elevating roles to SUPER_ADMIN', async () => {
    // 1. Cannot access SuperAdmin platform routes (e.g. POST /api/organisations)
    const orgCreateRes = await app.inject({
      method: 'POST',
      url: '/api/organisations',
      headers: { authorization: `Bearer ${partyAdminToken}` },
      payload: {
        name: 'Unauthorized Escalation Org',
        code: 'ESC_ORG',
      },
    });
    assert.equal(orgCreateRes.statusCode, 403);
    const orgBody = JSON.parse(orgCreateRes.body);
    assert.equal(orgBody.error?.code, 'SUPER_ADMIN_REQUIRED');

    // 2. Cannot create a user with SUPER_ADMIN role (vertical escalation forbidden)
    const elevateRes = await app.inject({
      method: 'POST',
      url: '/api/users',
      headers: { authorization: `Bearer ${partyAdminToken}` },
      payload: {
        userCode: 'ESC_SA_ATTEMPT',
        name: 'Escalated Super Admin Attempt',
        mobileNumber: '9999999999',
        role: RoleType.SUPER_ADMIN,
        organisationId: tenantAOrg.id,
      },
    });
    assert.equal(elevateRes.statusCode, 403);
    const elevateBody = JSON.parse(elevateRes.body);
    assert.equal(elevateBody.error?.code, 'VERTICAL_PRIVILEGE_VIOLATION');

    // 3. Cannot create a user with HIGH_COMMAND role (rank 90 > rank 85)
    const hcRes = await app.inject({
      method: 'POST',
      url: '/api/users',
      headers: { authorization: `Bearer ${partyAdminToken}` },
      payload: {
        userCode: 'ESC_HC_ATTEMPT',
        name: 'Escalated High Command Attempt',
        mobileNumber: '9999999998',
        role: RoleType.HIGH_COMMAND,
        organisationId: tenantAOrg.id,
      },
    });
    assert.equal(hcRes.statusCode, 403);
    const hcBody = JSON.parse(hcRes.body);
    assert.equal(hcBody.error?.code, 'VERTICAL_PRIVILEGE_VIOLATION');

    // 4. SuperAdmin CAN list credentials for any tenant using query parameter
    const saRes = await app.inject({
      method: 'GET',
      url: `/api/credentials?organisationId=${tenantAOrg.id}`,
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(saRes.statusCode, 200);
    const saBody = JSON.parse(saRes.body);
    const found = saBody.data.find((c: any) => c.keyName === testKeyName);
    assert.ok(found, 'SuperAdmin can manage tenant credentials across organisations');
  });
});
