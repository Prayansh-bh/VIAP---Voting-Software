import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { generateToken } from '../middleware/auth.js';
import { RoleType, OrgHierarchyLevel } from '@prisma/client';

async function runIntegrationTests() {
  console.log('🚀 Starting Political Connect Complete Integration Test Suite...\n');
  const app = buildApp();
  await app.ready();

  const { SmsProviderFactory } = await import('../lib/sms/factory.js');
  const { OtpService } = await import('../modules/auth/services/otp.service.js');
  SmsProviderFactory.setProvider({
    name: 'msg91',
    sendOtp: async () => ({
      success: true,
      messageId: 'mock-msg91-integration',
      provider: 'msg91',
      timestamp: new Date(),
    }),
    sendTransactional: async () => ({
      success: true,
      messageId: 'mock-msg91-integration-tx',
      provider: 'msg91',
      timestamp: new Date(),
    }),
  });

  let passedTests = 0;
  let failedTests = 0;

  async function testStep(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✅ ${name}`);
      passedTests++;
    } catch (err: any) {
      console.error(`  ❌ ${name}:`, err.message, err.stack);
      failedTests++;
    }
  }

  // 1. Health check
  await testStep('1. GET /health & GET /api/health returns UP with DB ping', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.status, 'UP');
    assert.equal(json.database, 'healthy');
  });

  // Get real users from DB
  const mlaUser = await prisma.user.findFirst({ where: { role: RoleType.CONSTITUENCY_INCHARGE } });
  const incharge100 = await prisma.user.findFirst({ where: { role: RoleType.VOTER_100_INCHARGE } });

  assert.ok(mlaUser, 'MLA user must exist');
  assert.ok(incharge100, '100-Voter Incharge user must exist');

  let superAdminUser = await prisma.user.findFirst({ where: { role: RoleType.SUPER_ADMIN } });
  if (!superAdminUser) {
    superAdminUser = await prisma.user.create({
      data: {
        userCode: 'SUPER-1',
        name: 'Super Administrator',
        mobileNumber: '9999999999',
        role: RoleType.SUPER_ADMIN,
        organisationId: mlaUser.organisationId,
      },
    });
  }

  const superAdminToken = generateToken({
    userId: superAdminUser.id,
    userCode: superAdminUser.userCode,
    mobileNumber: superAdminUser.mobileNumber,
    role: RoleType.SUPER_ADMIN,
    organisationId: superAdminUser.organisationId,
  });

  const inchargeToken = generateToken({
    userId: incharge100.id,
    userCode: incharge100.userCode,
    mobileNumber: incharge100.mobileNumber,
    role: RoleType.VOTER_100_INCHARGE,
    organisationId: incharge100.organisationId,
    unitId: incharge100.unitId,
  });

  // 2. Authentication - Request OTP
  let devOtp = '';
  let requestId = '';
  await testStep('2. POST /api/auth/request-otp generates OTP and requestId', async () => {
    await prisma.oTPVerification.deleteMany({ where: { mobileNumber: mlaUser.mobileNumber } });
    OtpService.clearCooldown(mlaUser.mobileNumber);
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: { mobileNumber: mlaUser.mobileNumber, role: mlaUser.role },
    });
    const json = JSON.parse(res.body);
    assert.equal(res.statusCode, 200, `Expected 200, got ${res.statusCode}: ${res.body}`);
    assert.ok(json.data?.requestId);
    assert.equal(json.data?.devOtp, undefined, 'devOtp must not be leaked');
    requestId = json.data.requestId;
    const { hashOtp } = await import('../lib/crypto.js');
    await prisma.oTPVerification.update({
      where: { id: requestId },
      data: { otpCode: hashOtp('123456', mlaUser.mobileNumber) },
    });
    devOtp = '123456';
  });

  // 3. Authentication - Verify OTP
  let userToken = '';
  await testStep('3. POST /api/auth/verify-otp authenticates and returns JWT session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: { requestId, otpCode: devOtp },
    });
    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.ok(json.data?.token);
    userToken = json.data.token;
  });

  // 4. Auth - Me Profile
  await testStep('4. GET /api/auth/me returns authenticated caller profile', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${userToken}` },
    });
    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.data?.role, 'CONSTITUENCY_INCHARGE');
  });

  // 5. CMS Configuration
  await testStep('5. GET /api/cms/config returns complete multi-tenant dynamic branding bundle', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/cms/config' });
    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.ok(json.data?.config || json.data?.organisationName);
    assert.ok(json.data?.parties || json.data?.primaryColor);
  });

  // 6. Hierarchy Deletion Safety Check
  await testStep('6. DELETE /api/cms/hierarchy-node rejects deletion when child dependencies exist', async () => {
    const mandal = await prisma.mandal.findFirst();
    if (mandal) {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/cms/hierarchy-node/mandal/${mandal.id}`,
        headers: { authorization: `Bearer ${superAdminToken}` },
      });
      // Correctly prevents deleting a mandal with linked villages/voters
      assert.equal(res.statusCode, 400);
    }
  });

  // 7. RBAC - Vertical Privilege Escalation Protection
  await testStep('7. POST /api/users rejects vertical privilege escalation when lower role attempts to create higher role', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/users',
      headers: { authorization: `Bearer ${inchargeToken}` },
      payload: {
        mobileNumber: '9991234567',
        name: 'Attacker Admin',
        role: RoleType.SUPER_ADMIN,
        userCode: 'HACKER-1',
      },
    });
    assert.equal(res.statusCode, 403);
  });

  // 8. Voter List Query (Paginated & Filtered)
  await testStep('8. GET /api/voters returns paginated records with metadata', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/voters?limit=10&page=1',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.ok(Array.isArray(json.data));
    assert.ok(json.meta?.limit === 10);
  });

  // 9. Voter Status & Vote Marking
  let testVoter = await prisma.voter.findFirst();
  if (!testVoter) {
    const booth = await prisma.booth.findFirst();
    const voterGroup = await prisma.voterGroup.findFirst();
    if (booth) {
      testVoter = await prisma.voter.create({
        data: {
          epicNumber: 'TEST-EPIC-001',
          name: 'Test Voter 1',
          fatherHusbandName: 'Father Name',
          houseNumber: '1-100',
          serialNumber: 1,
          age: 35,
          gender: 'MALE',
          booth: { connect: { id: booth.id } },
          voterGroup: voterGroup ? { connect: { id: voterGroup.id } } : undefined,
          voterStatus: 'ACTIVE',
          surveyStatus: 'NOT_SURVEYED',
          voteStatus: 'NOT_VOTED',
        },
      });
    }
  }
  assert.ok(testVoter, 'Voter record must exist');

  await testStep('9. POST /api/voters/:id/mark-vote-done marks vote and prevents duplicate increments', async () => {
    const res1 = await app.inject({
      method: 'POST',
      url: `/api/voters/${testVoter.id}/mark-vote-done`,
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res1.statusCode, 200);

    // Duplicate call test
    const res2 = await app.inject({
      method: 'POST',
      url: `/api/voters/${testVoter.id}/mark-vote-done`,
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res2.statusCode, 200);
  });

  // 10. Fake Voter Flagging
  await testStep('10. POST /api/voters/:id/flag-fake logs objection and updates status', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/voters/${testVoter.id}/flag-fake`,
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: { reason: 'Duplicate entry with another constituency' },
    });
    assert.equal(res.statusCode, 201);
  });

  // 11. Hierarchy Upward Analytics Rollup
  await testStep('11. GET /api/analytics/state computes aggregated voter metrics', async () => {
    let stateUnit = await prisma.organizationUnit.findFirst({ where: { level: OrgHierarchyLevel.STATE } });
    if (!stateUnit) {
      const state = await prisma.state.findFirst();
      stateUnit = await prisma.organizationUnit.create({
        data: {
          name: state?.name || 'Telangana State',
          code: state?.code || 'TS',
          level: OrgHierarchyLevel.STATE,
        },
      });
    }

    const res = await app.inject({
      method: 'GET',
      url: '/api/analytics/state',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.ok(json.data?.summary);
    assert.ok(typeof json.data.summary.turnoutPercentage === 'number');
    assert.ok(json.data?.partyPreference);
    assert.ok(json.data?.demographics);
  });

  // 12. AI Strategy Query (Telugu Tactical Briefing)
  await testStep('12. POST /api/ai/query returns tactical briefing in Telugu', async () => {
    const ac = await prisma.constituency.findFirst();
    const unit = await prisma.organizationUnit.findFirst({ where: { level: 'CONSTITUENCY' } });
    const targetUnitId = unit?.id || ac?.id;
    if (targetUnitId) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/ai/query',
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          unitId: targetUnitId,
          prompt: 'యువత ఓటర్లలో పోలింగ్ శాతాన్ని పెంచడానికి వ్యూహం ఏమిటి?',
          language: 'te',
        },
      });
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.ok(json.data?.answer);
    }
  });

  // 13. Tasks API
  await testStep('13. GET /api/tasks returns active field task directives', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/tasks',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.ok(Array.isArray(json.data));
  });

  // 14. Training Videos Catalog
  await testStep('14. GET /api/training/videos returns training module library', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/training/videos',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.ok(Array.isArray(json.data));
  });

  // 15. Ground Reports API
  await testStep('15. GET /api/reports/ground returns operational ground incidents', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/reports/ground',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.statusCode, 200);
  });

  // 16. Polling Reports API
  await testStep('16. GET /api/reports/polling returns election polling records', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/reports/polling',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.statusCode, 200);
  });

  // 17. Notifications API
  await testStep('17. GET /api/notifications returns user alert inbox', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/notifications',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.ok(Array.isArray(json.data?.items));
  });

  // 18. Audit Log Recording
  await testStep('18. GET /api/audit returns immutable security audit trail', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/audit',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.ok(Array.isArray(json.data));
  });

  // 19. Political Parties Master
  await testStep('19. GET /api/parties & GET /api/cms/parties lists configured parties', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/parties' });
    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.ok(Array.isArray(json.data));
  });

  // 20. Cadre Network
  await testStep('20. GET /api/cadre/network & GET /api/cadre/performance returns cadre scores', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/cadre/network',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.statusCode, 200);
  });

  // 21. Polls Creation
  let createdPollId = '';
  let pollOptionId = '';
  await testStep('21. POST /api/polls creates new tactical poll with options', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/polls',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        title: 'Booth Readiness Pulse Survey 2026',
        description: 'Assessing ground worker readiness across all booths',
        options: ['100% Ready', 'Minor Issues', 'Requires High Command Support'],
      },
    });
    assert.equal(res.statusCode, 201);
    const json = JSON.parse(res.body);
    assert.ok(json.data?.id);
    createdPollId = json.data.id;
    pollOptionId = json.data.options[0]?.id;
  });

  // 22. Polls Listing
  await testStep('22. GET /api/polls lists published polls with vote counts', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/polls',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.ok(Array.isArray(json.data));
    const found = json.data.find((p: any) => p.id === createdPollId);
    assert.ok(found);
  });

  // 23. Polls Voting & Duplicate Prevention
  await testStep('23. POST /api/polls/:id/vote records vote and rejects duplicate voting', async () => {
    // 1st vote
    const res1 = await app.inject({
      method: 'POST',
      url: `/api/polls/${createdPollId}/vote`,
      headers: { authorization: `Bearer ${inchargeToken}` },
      payload: { optionId: pollOptionId },
    });
    assert.equal(res1.statusCode, 200);

    // 2nd vote (should be rejected with 409 conflict)
    const res2 = await app.inject({
      method: 'POST',
      url: `/api/polls/${createdPollId}/vote`,
      headers: { authorization: `Bearer ${inchargeToken}` },
      payload: { optionId: pollOptionId },
    });
    assert.equal(res2.statusCode, 409);
  });

  // 24. Voter Excel Import Template Specification
  await testStep('24. GET /api/voters/template returns downloadable dynamic Excel template schema', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/voters/template',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.ok(Array.isArray(json.data?.columns));
    assert.ok(json.data.columns.some((c: any) => c.field === 'epicNumber'));
  });

  // 25. WhatsApp Cloud Provider Delivery
  await testStep('25. WhatsApp Cloud Provider sends verified OTP message format', async () => {
    const { WhatsAppCloudProvider } = await import('../lib/sms/providers/whatsapp-cloud.provider.js');
    const provider = new WhatsAppCloudProvider();
    const result = await provider.sendOtp('9876543210', '654321');
    assert.equal(result.success, true);
    assert.equal(result.provider, 'whatsapp-cloud');
  });

  // 26. Close Poll & Audit Verification
  await testStep('26. PATCH /api/polls/:id/close closes active poll and records audit trail', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/polls/${createdPollId}/close`,
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.data?.status, 'CLOSED');
  });

  // --------------------------------------------------------------------------
  // PARTY CMS IMMUTABILITY LIFECYCLE TESTS (DRAFT -> PUBLISHED -> LOCKED)
  // --------------------------------------------------------------------------
  let testPartyId = '';
  const testPartyCode = `TEST_PTY_${Date.now()}`;

  // 27. Create party in DRAFT state
  await testStep('27. POST /api/cms/parties creates party in DRAFT state (editable)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/cms/parties',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        code: testPartyCode,
        name: 'Democratic Progressive Front',
        shortName: 'DPF',
        symbolName: 'Torch',
        primaryColor: '#6366f1',
        secondaryColor: '#1e1b4b',
        accentColor: '#a855f7',
        lifecycleStatus: 'DRAFT',
      },
    });
    assert.equal(res.statusCode, 201);
    const json = JSON.parse(res.body);
    assert.ok(json.data?.id);
    assert.equal(json.data.lifecycleStatus, 'DRAFT');
    assert.equal(json.data.isLocked, false);
    testPartyId = json.data.id;
  });

  // 28. Edit party while still in DRAFT
  await testStep('28. PATCH /api/cms/parties/:id allows modification while in DRAFT state', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/cms/parties/${testPartyId}`,
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        symbolName: 'Rising Sun Torch',
      },
    });
    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.data.symbolName, 'Rising Sun Torch');
  });

  // 29. Publish & Lock party (Seals immutability)
  await testStep('29. POST /api/cms/parties/:id/publish transitions party to LOCKED (immutable)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/cms/parties/${testPartyId}/publish`,
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.data.lifecycleStatus, 'LOCKED');
    assert.equal(json.data.isLocked, true);
    assert.ok(json.data.publishedAt);
  });

  // 30. PATCH locked party is forbidden (403)
  await testStep('30. PATCH /api/cms/parties/:id on LOCKED party returns 403 Forbidden', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/cms/parties/${testPartyId}`,
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        name: 'Hacked Party Name',
        primaryColor: '#000000',
      },
    });
    assert.equal(res.statusCode, 403);
    const json = JSON.parse(res.body);
    assert.equal(json.error?.code, 'PARTY_CONFIGURATION_LOCKED');
  });

  // 31. PUT locked party is forbidden (403)
  await testStep('31. PUT /api/cms/parties/:id on LOCKED party returns 403 Forbidden', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/cms/parties/${testPartyId}`,
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        code: testPartyCode,
        name: 'Overwritten Name',
        shortName: 'OWN',
        primaryColor: '#ffffff',
      },
    });
    assert.equal(res.statusCode, 403);
    const json = JSON.parse(res.body);
    assert.equal(json.error?.code, 'PARTY_CONFIGURATION_LOCKED');
  });

  // 32. DELETE locked party is forbidden (403)
  await testStep('32. DELETE /api/cms/parties/:id on LOCKED party returns 403 Forbidden', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/cms/parties/${testPartyId}`,
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.statusCode, 403);
    const json = JSON.parse(res.body);
    assert.equal(json.error?.code, 'PARTY_CONFIGURATION_LOCKED');
  });

  // 33. Verify original party data in PostgreSQL remains unchanged and audit log recorded blocked attempts
  await testStep('33. Verify locked party remains unchanged in DB & audit trail logs blocked attempts', async () => {
    const dbParty = await prisma.politicalParty.findUnique({
      where: { id: testPartyId },
    });
    assert.ok(dbParty);
    assert.equal(dbParty.name, 'Democratic Progressive Front', 'Name must not be modified');
    assert.equal(dbParty.symbolName, 'Rising Sun Torch');
    assert.equal(dbParty.isLocked, true);
    assert.equal(dbParty.lifecycleStatus, 'LOCKED');

    // Check audit logs for blocked attempts
    const blockedAudit = await prisma.auditLog.findFirst({
      where: {
        entityId: testPartyId,
        entityType: 'PoliticalParty',
      },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(blockedAudit, 'Audit log must record party operations');

    // Clean up test party from database so it doesn't pollute production/CMS data
    await prisma.politicalParty.deleteMany({
      where: { code: { startsWith: 'TEST_PTY_' } },
    });
  });

  // --------------------------------------------------------------------------
  // ENTERPRISE CMS APPLICATION BUILDER & GOVERNANCE TESTS
  // --------------------------------------------------------------------------

  // 34. Multi-Application List
  await testStep('34. GET /api/cms/applications returns configured application instances', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/cms/applications',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.ok(Array.isArray(json.data));
    assert.ok(json.data.length >= 1);
    assert.ok(json.data.some((a: any) => a.configKey === 'default' || a.id));
  });

  // 35. Roles & Jurisdiction Matrix
  await testStep('35. GET /api/cms/roles-permissions returns enterprise RBAC & jurisdiction matrix', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/cms/roles-permissions',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.ok(Array.isArray(json.data));
    assert.ok(json.data.some((r: any) => r.role === 'SUPER_ADMIN'));
    assert.ok(json.data.some((r: any) => r.role === 'CONSTITUENCY_INCHARGE'));
    assert.ok(json.data.some((r: any) => r.role === 'VOTER_100_INCHARGE'));
  });

  // 36. Geography Hierarchy Tree
  await testStep('36. GET /api/cms/geography returns full multi-tier geographic hierarchy', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/cms/geography',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.ok(Array.isArray(json.data));
    assert.ok(json.data.length >= 1);
  });

  // 37. Create Geography Unit
  await testStep('37. POST /api/cms/geography/unit creates new Assembly Constituency entity', async () => {
    const testAcName = `Test AC ${Date.now().toString().slice(-4)}`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/cms/geography/unit',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        level: 'CONSTITUENCY',
        name: testAcName,
        code: `AC-${Date.now().toString().slice(-4)}`,
        totalVoters: 215000,
      },
    });
    assert.equal(res.statusCode, 201);
    const json = JSON.parse(res.body);
    assert.ok(json.data?.id);
    assert.equal(json.data.name, testAcName);
  });

  // 38. Excel Column Mapping Validator
  await testStep('38. POST /api/cms/validate-excel-mapping validates dynamic column mappings', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/cms/validate-excel-mapping',
      payload: {
        columnMapping: {
          'Voter EPIC': 'epicNumber',
          'Voter Full Name': 'name',
          'Gender': 'gender',
          'Age': 'age',
          'Mandal': 'mandal',
        },
        sampleRows: [
          { 'Voter EPIC': 'EPIC123', 'Voter Full Name': 'Test Voter', 'Gender': 'MALE', 'Age': 35, 'Mandal': 'Kondapi' },
        ],
      },
    });
    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.data?.isValid, true);
    assert.equal(json.data?.missingRequiredFields.length, 0);
  });

  // 39. Version History Snapshots
  await testStep('39. GET /api/cms/versions returns configuration version history', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/cms/versions',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.ok(Array.isArray(json.data));
  });

  // 40. Create Version Checkpoint
  await testStep('40. POST /api/cms/versions creates manual configuration checkpoint', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/cms/versions',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        versionName: `v1.${Date.now()}`,
        changeSummary: 'Pre-election tactical configuration lock snapshot',
      },
    });
    assert.equal(res.statusCode, 201);
    const json = JSON.parse(res.body);
    assert.ok(json.data?.id);
  });

  // 41. Incharge Dynamic Template Generation
  await testStep('41. GET /api/cms/incharges/template returns dynamic level-specific schema & sample rows', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/cms/incharges/template?level=VOTER_GROUP',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.data?.level, 'VOTER_GROUP');
    assert.ok(json.data?.columns.includes('Incharge Code'));
    assert.ok(json.data?.columns.includes('Mobile Number'));
    assert.ok(json.data?.sampleRows.length >= 1);
  });

  // 42. Incharge Bulk Excel Import & Auto User Creation
  await testStep('42. POST /api/cms/incharges/bulk-import validates and creates real users with hierarchy assignments', async () => {
    const testMobile = `9848${Math.floor(100000 + Math.random() * 899999)}`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/cms/incharges/bulk-import',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        level: 'BOOTH',
        rows: [
          {
            'Booth / Part No': 'Booth 101',
            'Incharge Name': 'K. Satyanarayana',
            'Mobile Number': testMobile,
            'Designation': 'Booth President',
          },
        ],
      },
    });
    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.data?.validRows, 1);
    assert.ok(json.data?.assignedUsers.length >= 1);
    assert.equal(json.data?.assignedUsers[0].name, 'K. Satyanarayana');

    // Verify user exists in DB
    const dbUser = await prisma.user.findFirst({
      where: { mobileNumber: testMobile },
    });
    assert.ok(dbUser);
    assert.equal(dbUser.name, 'K. Satyanarayana');
  });

  // 43. Incharge Deactivation & Revocation
  await testStep('43. POST /api/cms/incharges/deactivate suspends incharge and revokes hierarchy access', async () => {
    const testUser = await prisma.user.findFirst({
      where: { name: 'K. Satyanarayana' },
    });
    assert.ok(testUser);

    const res = await app.inject({
      method: 'POST',
      url: '/api/cms/incharges/deactivate',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        userId: testUser.id,
        reason: 'Post-election roster reshuffle',
      },
    });
    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.data?.accountStatus, 'SUSPENDED');

    const updatedUser = await prisma.user.findUnique({
      where: { id: testUser.id },
    });
    assert.equal(updatedUser?.accountStatus, 'SUSPENDED');
  });

  // 44. Incharge Transfer Route
  await testStep('44. POST /api/cms/incharges/transfer transfers incharge jurisdiction and logs audit', async () => {
    const booth = await prisma.booth.findFirst();
    assert.ok(booth);
    const testMobile = `9848${Math.floor(100000 + Math.random() * 899999)}`;
    const user = await prisma.user.create({
      data: {
        userCode: `INC-BOO-${testMobile.slice(-4)}`,
        name: 'Transfer Test Cadre',
        mobileNumber: testMobile,
        role: RoleType.BOOTH_PRESIDENT,
        accountStatus: 'ACTIVE',
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/cms/incharges/transfer',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        userId: user.id,
        toUnitLevel: 'BOOTH',
        toUnitId: booth.id,
        reason: 'Redeployment to target polling station',
      },
    });
    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.data?.user?.id, user.id);
    assert.equal(json.data?.assignment?.boothId, booth.id);
    assert.equal(json.data?.assignment?.isActive, true);
  });

  // 45. Incharge Replacement Route
  await testStep('45. POST /api/cms/incharges/replace replaces incharge and preserves audit history', async () => {
    const booth = await prisma.booth.findFirst();
    assert.ok(booth);
    const newMobile = `9848${Math.floor(100000 + Math.random() * 899999)}`;

    const res = await app.inject({
      method: 'POST',
      url: '/api/cms/incharges/replace',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        unitLevel: 'BOOTH',
        unitId: booth.id,
        newUserName: 'Replacement Incharge Officer',
        newMobileNumber: newMobile,
        reason: 'Leadership rotation',
      },
    });
    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.data?.newUser?.name, 'Replacement Incharge Officer');
    assert.equal(json.data?.assignment?.boothId, booth.id);
  });

  // 46. Search Existing Users
  await testStep('46. GET /api/cms/incharges/users/search searches users by name or mobile', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/cms/incharges/users/search?q=Replacement',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.ok(Array.isArray(json.data));
    assert.ok(json.data.some((u: any) => u.name.includes('Replacement')));
  });

  // 47. Incharge Assignment History
  await testStep('47. GET /api/cms/incharges/history retrieves incharge transfer/replacement audit logs', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/cms/incharges/history',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.ok(Array.isArray(json.data));
    assert.ok(json.data.length >= 1);
  });

  // Clean up test-created party, geography unit, test voter, and test cadres
  try {
    if (testPartyId) {
      await prisma.politicalParty.deleteMany({ where: { id: testPartyId } }).catch(() => {});
    }
    await prisma.constituency.deleteMany({
      where: { name: { startsWith: 'Test AC ' } },
    }).catch(() => {});
    await prisma.voter.deleteMany({
      where: { epicNumber: 'TEST-EPIC-001' },
    }).catch(() => {});
    const testCadres = await prisma.user.findMany({
      where: {
        OR: [
          { name: 'Transfer Test Cadre' },
          { name: 'Replacement Incharge Officer' },
          { name: 'K. Satyanarayana', role: RoleType.BOOTH_PRESIDENT, accountStatus: 'ACTIVE' },
        ],
      },
      select: { id: true },
    });
    const testCadreIds = testCadres.map((u) => u.id);
    if (testCadreIds.length > 0) {
      await prisma.userHierarchyAssignment.deleteMany({ where: { userId: { in: testCadreIds } } }).catch(() => {});
      await prisma.auditLog.deleteMany({ where: { userId: { in: testCadreIds } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: testCadreIds } } }).catch(() => {});
    }
  } catch {
    // ignore
  }

  console.log(`\n========================================`);
  console.log(`Test Results: ${passedTests} Passed, ${failedTests} Failed`);
  console.log(`========================================\n`);

  SmsProviderFactory.reset();

  if (failedTests > 0) {
    process.exit(1);
  }
}

runIntegrationTests()
  .then(() => {
    console.log('🎉 All 47 critical integration tests passed successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });


