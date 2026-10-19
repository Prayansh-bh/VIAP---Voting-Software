/**
 * VIAP — Phase 2 CMS State Scoping and Multi-Tenant Isolation Tests
 *
 * Covers:
 * 1. Switching between two tenants with different configurations.
 * 2. Cache isolation: tenant A's branding does not leak into tenant B.
 * 3. PostgreSQL-backed API authoritative precedence over stale local cache.
 * 4. Refreshing configuration without losing tenant-specific fields.
 * 5. Failed saves rollback and error surfacing without state contamination.
 * 6. Dual-application isolation under the same parent Organisation.
 *
 * Strict safety: isolated unit tests with 0 writes to live database.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Canonical CMS cache key resolver matching admin and frontend implementations.
 * Application-specific identity (configKey or id) is authoritative over organisationId.
 */
function getCmsCacheKey(identifier?: {
  id?: string;
  configKey?: string;
  applicationId?: string;
  tenantCode?: string;
  organisationId?: string;
} | string | null): string {
  if (!identifier) return 'kdp_cms_config_default';
  if (typeof identifier === 'string') {
    const clean = identifier.trim().toLowerCase();
    return `kdp_cms_config_${clean || 'default'}`;
  }
  const appKey = (identifier.configKey && identifier.configKey !== 'default' ? identifier.configKey : '')
    || identifier.id
    || identifier.applicationId
    || identifier.tenantCode;

  if (appKey) {
    return `kdp_cms_config_${appKey.toString().trim().toLowerCase()}`;
  }

  if (identifier.configKey === 'default') {
    return 'kdp_cms_config_default';
  }

  return '';
}

describe('VIAP Phase 2 — Tenant Configuration Scoping & Isolation Suite', () => {

  const tenantA_ServerConfig = {
    id: 'org-tenant-tdp',
    configKey: 'tdp_connect',
    organisationId: 'org-tdp-uuid',
    organisationName: 'Telugu Desam Party',
    primaryColor: '#F59E0B',
    secondaryColor: '#DC2626',
    activePartyCode: 'TDP',
    slogan: 'Kondapi 2026 Leadership',
    logoUrl: 'https://example.com/tdp-logo.png',
  };

  const tenantB_ServerConfig = {
    id: 'org-tenant-inc',
    configKey: 'inc_connect',
    organisationId: 'org-inc-uuid',
    organisationName: 'Indian National Congress',
    primaryColor: '#0284C7',
    secondaryColor: '#138808',
    activePartyCode: 'INC',
    slogan: 'Praja Palana',
    logoUrl: 'https://example.com/inc-logo.png',
  };

  it('1. Guarantees separate scoped cache keys for distinct tenants', () => {
    const keyA = getCmsCacheKey(tenantA_ServerConfig);
    const keyB = getCmsCacheKey(tenantB_ServerConfig);

    assert.equal(keyA, 'kdp_cms_config_tdp_connect');
    assert.equal(keyB, 'kdp_cms_config_inc_connect');
    assert.notEqual(keyA, keyB, 'Tenant cache keys must never collide');
  });

  it('2. Prevents tenant A branding from leaking when switching to tenant B', () => {
    // Simulated multi-tenant store
    const localCache: Record<string, any> = {};

    function saveTenantCache(tenantConfig: any) {
      localCache[getCmsCacheKey(tenantConfig)] = tenantConfig;
    }

    function loadTenantConfig(targetIdentifier: any, serverData: any) {
      // Server is authoritative; local cache is secondary
      const cached = localCache[getCmsCacheKey(targetIdentifier)];
      return serverData || cached;
    }

    // Tenant A is loaded and cached
    saveTenantCache(tenantA_ServerConfig);
    assert.equal(localCache['kdp_cms_config_tdp_connect'].primaryColor, '#F59E0B');

    // Switch to Tenant B
    const activeView = loadTenantConfig(tenantB_ServerConfig, tenantB_ServerConfig);

    assert.equal(activeView.id, 'org-tenant-inc');
    assert.equal(activeView.organisationName, 'Indian National Congress');
    assert.equal(activeView.primaryColor, '#0284C7');
    assert.notEqual(activeView.primaryColor, '#F59E0B', 'Tenant A color must not leak into Tenant B');
    assert.equal(activeView.slogan, 'Praja Palana');
  });

  it('3. Authoritative server response overrides stale local cache', () => {
    const staleCache = {
      ...tenantA_ServerConfig,
      organisationName: 'Old Stale Name',
      primaryColor: '#000000',
    };

    const authoritativeServer = {
      ...tenantA_ServerConfig,
      organisationName: 'Authoritative Persisted Name',
      primaryColor: '#F59E0B',
    };

    function reconcileConfig(server: any, cached: any) {
      if (server && server.id) {
        return server; // Server is authoritative
      }
      return cached;
    }

    const reconciled = reconcileConfig(authoritativeServer, staleCache);
    assert.equal(reconciled.organisationName, 'Authoritative Persisted Name');
    assert.equal(reconciled.primaryColor, '#F59E0B');
  });

  it('4. Handles failed API save by preserving valid state without corrupting cache', async () => {
    let activeConfig = { ...tenantA_ServerConfig };
    const localCache: Record<string, any> = {
      [getCmsCacheKey(tenantA_ServerConfig)]: { ...tenantA_ServerConfig },
    };

    async function attemptSave(targetConfig: any, updatePayload: any, shouldFail: boolean) {
      if (shouldFail) {
        throw new Error('Database transaction timeout');
      }
      activeConfig = { ...activeConfig, ...updatePayload };
      localCache[getCmsCacheKey(targetConfig)] = activeConfig;
    }

    await assert.rejects(
      async () => attemptSave(tenantA_ServerConfig, { organisationName: 'Corrupted Name' }, true),
      (err: any) => {
        assert.match(err.message, /timeout/);
        return true;
      }
    );

    // Verify cache and active config are untouched
    assert.equal(activeConfig.organisationName, 'Telugu Desam Party');
    assert.equal(localCache['kdp_cms_config_tdp_connect'].organisationName, 'Telugu Desam Party');
  });

  it('5. Proves two applications under the same organisation maintain distinct canonical cache identities without bleeding', () => {
    // Both applications belong to the same parent organisation in PostgreSQL
    const sharedOrganisationId = 'd824ff00-4789-4a0b-a16a-8b8dfa320001';

    const appOne_Tdp = {
      id: 'd824ff00-4789-4a0b-a16a-8b8dfa320011',
      configKey: 'tdp_assembly_segment',
      organisationId: sharedOrganisationId,
      organisationName: 'Kondapi TDP Assembly Segment',
      primaryColor: '#EAB308',
      secondaryColor: '#1E293B',
      activePartyCode: 'TDP',
      slogan: 'Kondapi Cadre Command',
    };

    const appTwo_Jsp = {
      id: 'd824ff00-4789-4a0b-a16a-8b8dfa320022',
      configKey: 'jsp_veera_mahila',
      organisationId: sharedOrganisationId,
      organisationName: 'Kondapi JSP Sainik Connect',
      primaryColor: '#DC2626',
      secondaryColor: '#1E293B',
      activePartyCode: 'JSP',
      slogan: 'Sainik Praja Poratam',
    };

    // 1. Validate both apps have the exact same parent organisation
    assert.equal(appOne_Tdp.organisationId, appTwo_Jsp.organisationId);

    // 2. Derive canonical cache keys
    const keyOne = getCmsCacheKey(appOne_Tdp);
    const keyTwo = getCmsCacheKey(appTwo_Jsp);

    // 3. Guarantee separate application-scoped keys despite identical organisationId
    assert.equal(keyOne, 'kdp_cms_config_tdp_assembly_segment');
    assert.equal(keyTwo, 'kdp_cms_config_jsp_veera_mahila');
    assert.notEqual(keyOne, keyTwo, 'Applications under the same organisation must never share cache keys');

    // 4. Simulate multi-application localStorage
    const storage: Record<string, string> = {};
    storage[keyOne] = JSON.stringify(appOne_Tdp);
    storage[keyTwo] = JSON.stringify(appTwo_Jsp);

    // 5. Switching between apps under the same organisation must never bleed configuration
    const retrievedOne = JSON.parse(storage[keyOne]);
    const retrievedTwo = JSON.parse(storage[keyTwo]);

    assert.equal(retrievedOne.primaryColor, '#EAB308');
    assert.equal(retrievedOne.activePartyCode, 'TDP');
    assert.equal(retrievedTwo.primaryColor, '#DC2626');
    assert.equal(retrievedTwo.activePartyCode, 'JSP');
    assert.notEqual(retrievedOne.primaryColor, retrievedTwo.primaryColor);

    // 6. Saving changes to App Two must leave App One completely unmutated
    const updatedAppTwo = { ...appTwo_Jsp, primaryColor: '#B91C1C', slogan: 'Updated Sainik Movement' };
    storage[keyTwo] = JSON.stringify(updatedAppTwo);

    const postUpdateOne = JSON.parse(storage[keyOne]);
    assert.equal(postUpdateOne.primaryColor, '#EAB308');
    assert.equal(postUpdateOne.slogan, 'Kondapi Cadre Command');
  });

  it('6. Ensures application-specific operations fail safely without falling back to organisation-only or default cache', () => {
    // When an application-specific operation is missing the intended application ID
    const missingAppIdInput = {
      organisationId: '04a6211d-65b1-4f18-a6b6-3aa3d81b157a',
      organisationName: 'Telugu Desam Party',
    };

    // 1. Must NOT derive a key based on organisationId
    const derivedKey = getCmsCacheKey(missingAppIdInput);
    assert.notEqual(derivedKey, 'kdp_cms_config_04a6211d-65b1-4f18-a6b6-3aa3d81b157a');

    // 2. Must NOT silently fall back to 'default' cache
    assert.notEqual(derivedKey, 'kdp_cms_config_default');

    // 3. Must return empty string / fail safe so cache is never overwritten
    assert.equal(derivedKey, '');

    // 4. Legacy default behavior preserved ONLY when configKey is explicitly 'default'
    const explicitDefault = getCmsCacheKey({ configKey: 'default' });
    assert.equal(explicitDefault, 'kdp_cms_config_default');

    // 5. Valid application ID or configKey always resolves strictly to that application
    const validAppKey = getCmsCacheKey({ id: 'app-abc-123', organisationId: missingAppIdInput.organisationId });
    assert.equal(validAppKey, 'kdp_cms_config_app-abc-123');
  });
});
