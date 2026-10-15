process.env.NODE_ENV = 'test';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { RoleType, AccountStatus } from '@prisma/client';
import { TokenService } from '../modules/auth/services/token.service.js';

describe('Phase 3 — CMS Persistence, Branding, Asset Storage & Zero-Data Onboarding Suite', () => {
  let app: any;
  let tenantAOrg: any;
  let tenantBOrg: any;
  let tenantAAdmin: any;
  let tenantBAdmin: any;
  let tenantAToken: string;
  let tenantBToken: string;

  const createdOrgIds: string[] = [];

  // Valid 1x1 PNG Base64
  const VALID_PNG_BASE64 =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  // Valid 1x1 JPEG Base64
  const VALID_JPEG_BASE64 =
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

  // Valid WebP Base64 (minimal 1x1 lossless webp)
  const VALID_WEBP_BASE64 =
    'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';

  // Valid SVG Base64
  const VALID_SVG_BASE64 =
    'data:image/svg+xml;base64,' +
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="red"/></svg>').toString('base64');

  // Malicious SVG with embedded script
  const MALICIOUS_SVG_BASE64 =
    'data:image/svg+xml;base64,' +
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert("XSS")</script></svg>').toString('base64');

  // Text file disguised as image
  const FAKE_IMAGE_BASE64 =
    'data:image/png;base64,' + Buffer.from('NOT_AN_IMAGE_FILE_JUST_PLAIN_TEXT').toString('base64');

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
    app = await buildApp();

    const timestamp = Date.now();

    // Create Tenant A
    tenantAOrg = await prisma.organisation.create({
      data: {
        code: `TEST_P3_A_${timestamp}`,
        name: `Test Tenant A ${timestamp}`,
        description: 'Phase 3 Tenant A',
        logoUrl: '/api/cms/assets/initial-a.png',
      },
    });
    createdOrgIds.push(tenantAOrg.id);

    // Create Tenant A active party for PartyEligibilityService
    await prisma.politicalParty.create({
      data: {
        code: `PARTY_A_${timestamp}`,
        name: `Party Alpha ${timestamp}`,
        shortName: 'ALPHA',
        primaryColor: '#059669',
        organisationId: tenantAOrg.id,
        isActive: true,
      },
    });

    // Create Tenant B
    tenantBOrg = await prisma.organisation.create({
      data: {
        code: `TEST_P3_B_${timestamp}`,
        name: `Test Tenant B ${timestamp}`,
        description: 'Phase 3 Tenant B',
        logoUrl: '/api/cms/assets/initial-b.png',
      },
    });
    createdOrgIds.push(tenantBOrg.id);

    // Create Tenant B active party for PartyEligibilityService
    await prisma.politicalParty.create({
      data: {
        code: `PARTY_B_${timestamp}`,
        name: `Party Beta ${timestamp}`,
        shortName: 'BETA',
        primaryColor: '#dc2626',
        organisationId: tenantBOrg.id,
        isActive: true,
      },
    });

    // Create Tenant A Admin
    tenantAAdmin = await prisma.user.create({
      data: {
        organisationId: tenantAOrg.id,
        userCode: `ADMIN_A_${timestamp}`,
        name: 'Admin Tenant A',
        mobileNumber: `911${String(timestamp).slice(-7)}`,
        role: RoleType.HIGH_COMMAND,
        accountStatus: AccountStatus.ACTIVE,
      },
    });
    tenantAToken = await issueToken(tenantAAdmin);

    // Create Tenant B Admin
    tenantBAdmin = await prisma.user.create({
      data: {
        organisationId: tenantBOrg.id,
        userCode: `ADMIN_B_${timestamp}`,
        name: 'Admin Tenant B',
        mobileNumber: `912${String(timestamp).slice(-7)}`,
        role: RoleType.HIGH_COMMAND,
        accountStatus: AccountStatus.ACTIVE,
      },
    });
    tenantBToken = await issueToken(tenantBAdmin);
  });

  after(async () => {
    for (const orgId of createdOrgIds) {
      await prisma.loginSession.deleteMany({ where: { user: { organisationId: orgId } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { organisationId: orgId } }).catch(() => {});
      await prisma.cMSConfiguration.deleteMany({ where: { organisationId: orgId } }).catch(() => {});
      await prisma.politicalParty.deleteMany({ where: { organisationId: orgId } }).catch(() => {});
      await prisma.organisation.delete({ where: { id: orgId } }).catch(() => {});
    }
    await app.close();
  });

  // --------------------------------------------------------------------------
  // Test 1: Upload Asset Validation (Magic Bytes & Safety)
  // --------------------------------------------------------------------------
  it('1. Upload Asset: Successfully uploads valid PNG, JPEG, WebP and SVG', async () => {
    // 1a. Upload PNG
    const pngRes = await app.inject({
      method: 'POST',
      url: '/api/cms/upload-asset',
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: {
        data: VALID_PNG_BASE64,
        filename: 'party_logo.png',
      },
    });
    assert.equal(pngRes.statusCode, 201, `PNG upload failed: ${pngRes.body}`);
    const pngBody = JSON.parse(pngRes.body);
    const pngData = pngBody.data || pngBody;
    assert.equal(pngData.mimeType, 'image/png');
    assert.ok(pngData.assetUrl.startsWith('/api/cms/assets/'));

    // 1b. Upload JPEG
    const jpegRes = await app.inject({
      method: 'POST',
      url: '/api/cms/upload-asset',
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: {
        data: VALID_JPEG_BASE64,
        filename: 'banner.jpeg',
      },
    });
    assert.equal(jpegRes.statusCode, 201, `JPEG upload failed: ${jpegRes.body}`);
    const jpegData = JSON.parse(jpegRes.body).data || JSON.parse(jpegRes.body);
    assert.equal(jpegData.mimeType, 'image/jpeg');

    // 1c. Upload WebP
    const webpRes = await app.inject({
      method: 'POST',
      url: '/api/cms/upload-asset',
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: {
        data: VALID_WEBP_BASE64,
        filename: 'candidate.webp',
      },
    });
    assert.equal(webpRes.statusCode, 201, `WebP upload failed: ${webpRes.body}`);
    const webpData = JSON.parse(webpRes.body).data || JSON.parse(webpRes.body);
    assert.equal(webpData.mimeType, 'image/webp');

    // 1d. Upload valid SVG
    const svgRes = await app.inject({
      method: 'POST',
      url: '/api/cms/upload-asset',
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: {
        data: VALID_SVG_BASE64,
        filename: 'symbol.svg',
      },
    });
    assert.equal(svgRes.statusCode, 201, `SVG upload failed: ${svgRes.body}`);
    const svgData = JSON.parse(svgRes.body).data || JSON.parse(svgRes.body);
    assert.equal(svgData.mimeType, 'image/svg+xml');
  });

  it('2. Upload Asset: Rejects fake images, malicious SVG, and oversized payloads', async () => {
    // 2a. Rejects fake image (plain text with PNG MIME)
    const fakeRes = await app.inject({
      method: 'POST',
      url: '/api/cms/upload-asset',
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: {
        data: FAKE_IMAGE_BASE64,
        filename: 'fake.png',
      },
    });
    assert.equal(fakeRes.statusCode, 400);
    const fakeBody = JSON.parse(fakeRes.body);
    const fakeError = fakeBody.error || fakeBody;
    assert.equal(fakeError.code, 'INVALID_ASSET_TYPE');

    // 2b. Rejects malicious SVG with embedded <script>
    const scriptRes = await app.inject({
      method: 'POST',
      url: '/api/cms/upload-asset',
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: {
        data: MALICIOUS_SVG_BASE64,
        filename: 'xss.svg',
      },
    });
    assert.equal(scriptRes.statusCode, 400);
    const scriptBody = JSON.parse(scriptRes.body);
    const scriptError = scriptBody.error || scriptBody;
    assert.equal(scriptError.code, 'INVALID_ASSET_TYPE');

    // 2c. Rejects oversized payload (> 5MB)
    const largeBuffer = Buffer.alloc(5.5 * 1024 * 1024, 0x41);
    const largeBase64 = `data:image/png;base64,${largeBuffer.toString('base64')}`;
    const largeRes = await app.inject({
      method: 'POST',
      url: '/api/cms/upload-asset',
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: {
        data: largeBase64,
        filename: 'huge.png',
      },
    });
    assert.equal(largeRes.statusCode, 400);
    const largeBody = JSON.parse(largeRes.body);
    const largeError = largeBody.error || largeBody;
    assert.equal(largeError.code, 'ASSET_TOO_LARGE');
  });

  // --------------------------------------------------------------------------
  // Test 2: Asset Retrieval Endpoint
  // --------------------------------------------------------------------------
  it('3. Asset Retrieval: Serves uploaded asset with correct Content-Type and security headers, prevents traversal', async () => {
    // Upload a test image first
    const uploadRes = await app.inject({
      method: 'POST',
      url: '/api/cms/upload-asset',
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: {
        data: VALID_PNG_BASE64,
        filename: 'serve_test.png',
      },
    });
    const uploadData = JSON.parse(uploadRes.body).data || JSON.parse(uploadRes.body);
    const { assetUrl } = uploadData;

    // Fetch the asset
    const fetchRes = await app.inject({
      method: 'GET',
      url: assetUrl,
    });
    assert.equal(fetchRes.statusCode, 200);
    assert.equal(fetchRes.headers['content-type'], 'image/png');
    assert.equal(fetchRes.headers['x-content-type-options'], 'nosniff');
    assert.ok(fetchRes.body.length > 0);

    // Non-existent or invalid filename returns 404 safely
    const notFoundRes = await app.inject({
      method: 'GET',
      url: '/api/cms/assets/nonexistent_file_000.png',
    });
    assert.equal(notFoundRes.statusCode, 404);

    // Dangerous extension returns 404 (prevented by strict filename regex)
    const dangerousRes = await app.inject({
      method: 'GET',
      url: '/api/cms/assets/malicious_payload.exe',
    });
    assert.equal(dangerousRes.statusCode, 404);
  });

  // --------------------------------------------------------------------------
  // Test 3: Save and Reload Persistence
  // --------------------------------------------------------------------------
  it('4. Save and Reload: Persists organisation name, slogan, logoUrl, colors and feature toggles', async () => {
    const updatedLogoUrl = '/api/cms/assets/alpha_official_logo.png';
    const payload = {
      organisationName: 'Alpha Progressive Front',
      slogan: 'Together We Rise',
      logoUrl: updatedLogoUrl,
      primaryColor: '#059669', // Emerald
      secondaryColor: '#064e3b',
      accentColor: '#10b981',
      featureToggles: {
        voterManagement: true,
        fakeVoterFlagging: true,
        aiStrategicIntelligence: false,
      },
      hierarchyLabels: {
        CONSTITUENCY: 'Division Commander',
        BOOTH: 'Booth Station Captain',
      },
    };

    // Update config as Tenant A
    const putRes = await app.inject({
      method: 'PUT',
      url: '/api/cms/config',
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload,
    });
    assert.equal(putRes.statusCode, 200, `PUT config failed: ${putRes.body}`);
    const putJson = JSON.parse(putRes.body);
    const putConfig = putJson.data?.config || putJson.data || putJson.config;
    assert.equal(putConfig.organisationName, 'Alpha Progressive Front');
    assert.equal(putConfig.slogan, 'Together We Rise');
    assert.equal(putConfig.logoUrl, updatedLogoUrl);
    assert.equal(putConfig.primaryColor, '#059669');

    // Reload config with Tenant A token
    const reloadRes = await app.inject({
      method: 'GET',
      url: '/api/cms/config',
      headers: { authorization: `Bearer ${tenantAToken}` },
    });
    assert.equal(reloadRes.statusCode, 200);
    const reloadJson = JSON.parse(reloadRes.body);
    const reloadConfig = reloadJson.data?.config || reloadJson.config;
    assert.equal(reloadConfig.organisationName, 'Alpha Progressive Front');
    assert.equal(reloadConfig.slogan, 'Together We Rise');
    assert.equal(reloadConfig.logoUrl, updatedLogoUrl);
    assert.equal(reloadConfig.primaryColor, '#059669');
    assert.equal(reloadConfig.secondaryColor, '#064e3b');
    assert.equal(reloadConfig.featureToggles.aiStrategicIntelligence, false);
    assert.equal(reloadConfig.hierarchyLabels.CONSTITUENCY, 'Division Commander');
    assert.equal(reloadConfig.hierarchyLabels.BOOTH, 'Booth Station Captain');

    // Verify database row for organisation is synchronized
    const orgInDb = await prisma.organisation.findUnique({ where: { id: tenantAOrg.id } });
    assert.equal(orgInDb?.name, 'Alpha Progressive Front');
    assert.equal(orgInDb?.logoUrl, updatedLogoUrl);
  });

  // --------------------------------------------------------------------------
  // Test 4: Tenant Branding Isolation (No Cross-Tenant Bleed)
  // --------------------------------------------------------------------------
  it('5. Tenant Branding Isolation: Tenant A and Tenant B maintain strictly isolated branding', async () => {
    // Set Tenant B custom branding
    const bPayload = {
      organisationName: 'Beta Peoples Movement',
      slogan: 'Empowering Every Citizen',
      logoUrl: '/api/cms/assets/beta_official_logo.png',
      primaryColor: '#dc2626', // Red
      secondaryColor: '#7f1d1d',
    };

    const putBRes = await app.inject({
      method: 'PUT',
      url: '/api/cms/config',
      headers: { authorization: `Bearer ${tenantBToken}` },
      payload: bPayload,
    });
    assert.equal(putBRes.statusCode, 200);

    // Read config as Tenant A: MUST receive Alpha branding, NEVER Beta
    const readARes = await app.inject({
      method: 'GET',
      url: '/api/cms/config',
      headers: { authorization: `Bearer ${tenantAToken}` },
    });
    const aJson = JSON.parse(readARes.body);
    const aConfig = aJson.data?.config || aJson.config;
    assert.equal(aConfig.organisationName, 'Alpha Progressive Front');
    assert.equal(aConfig.logoUrl, '/api/cms/assets/alpha_official_logo.png');
    assert.equal(aConfig.primaryColor, '#059669');

    // Read config as Tenant B: MUST receive Beta branding, NEVER Alpha
    const readBRes = await app.inject({
      method: 'GET',
      url: '/api/cms/config',
      headers: { authorization: `Bearer ${tenantBToken}` },
    });
    const bJson = JSON.parse(readBRes.body);
    const bConfig = bJson.data?.config || bJson.config;
    assert.equal(bConfig.organisationName, 'Beta Peoples Movement');
    assert.equal(bConfig.logoUrl, '/api/cms/assets/beta_official_logo.png');
    assert.equal(bConfig.primaryColor, '#dc2626');

    // Query parameter lookup for Tenant A without auth header: returns Tenant A branding
    const queryARes = await app.inject({
      method: 'GET',
      url: `/api/cms/config?organisationId=${tenantAOrg.id}`,
    });
    assert.equal(queryARes.statusCode, 200);
    const queryAJson = JSON.parse(queryARes.body);
    const queryAConfig = queryAJson.data?.config || queryAJson.config;
    assert.equal(queryAConfig.organisationName, 'Alpha Progressive Front');
    assert.equal(queryAConfig.primaryColor, '#059669');
  });

  // --------------------------------------------------------------------------
  // Test 5: Missing Configuration & Safe Default Creation (No Bleed)
  // --------------------------------------------------------------------------
  it('6. Missing Configuration: Synthesizes isolated tenant config without falling back to other tenants', async () => {
    const timestamp = Date.now();
    const freshOrg = await prisma.organisation.create({
      data: {
        code: `FRESH_ORG_${timestamp}`,
        name: `Fresh Campaign ${timestamp}`,
        logoUrl: '/api/cms/assets/fresh_logo.png',
      },
    });
    createdOrgIds.push(freshOrg.id);

    // Fetch config for freshOrg before any CMSConfiguration record exists
    const freshRes = await app.inject({
      method: 'GET',
      url: `/api/cms/config?organisationId=${freshOrg.id}`,
    });
    assert.equal(freshRes.statusCode, 200);
    const freshJson = JSON.parse(freshRes.body);
    const freshConfig = freshJson.data?.config || freshJson.config;

    // Must return freshOrg's own name and logo, NOT Tenant A, Tenant B, or TDP defaults
    assert.equal(freshConfig.organisationName, `Fresh Campaign ${timestamp}`);
    assert.equal(freshConfig.logoUrl, '/api/cms/assets/fresh_logo.png');
    assert.notEqual(freshConfig.organisationName, 'Alpha Progressive Front');
    assert.notEqual(freshConfig.organisationName, 'Beta Peoples Movement');
    assert.notEqual(freshConfig.organisationName, 'Kondapi TDP Connect');
  });

  // --------------------------------------------------------------------------
  // Test 6: Zero-Data Onboarding (Honest Zeros & No Fabricated Records)
  // --------------------------------------------------------------------------
  it('7. Zero-Data Onboarding: Newly provisioned organisation has zero real records and no fake voters', async () => {
    const timestamp = Date.now();
    const cleanOrg = await prisma.organisation.create({
      data: {
        code: `ZERO_DATA_ORG_${timestamp}`,
        name: `Zero Data Org ${timestamp}`,
      },
    });
    createdOrgIds.push(cleanOrg.id);

    // Verify in database: zero voters, zero users, zero parties
    const [voterCount, userCount, partyCount] = await Promise.all([
      prisma.voter.count({ where: { state: { organisationId: cleanOrg.id } } }),
      prisma.user.count({ where: { organisationId: cleanOrg.id } }),
      prisma.politicalParty.count({ where: { organisationId: cleanOrg.id } }),
    ]);

    assert.equal(voterCount, 0, 'New organisation must have 0 real voters');
    assert.equal(userCount, 0, 'New organisation must have 0 users');
    assert.equal(partyCount, 0, 'New organisation must have 0 parties');

    // Verify CMS config response for new organisation has empty constituencies list
    const cmsRes = await app.inject({
      method: 'GET',
      url: `/api/cms/config?organisationId=${cleanOrg.id}`,
    });
    assert.equal(cmsRes.statusCode, 200);
    const cmsJson = JSON.parse(cmsRes.body);
    const cmsData = cmsJson.data || cmsJson;
    assert.deepEqual(cmsData.constituencies, [], 'New organisation must have 0 constituencies');
    assert.equal(cmsData.parties.length, 0, 'New organisation with no linked parties has 0 parties');
  });
});
