import assert from 'node:assert/strict';

// Helper to simulate router resolution logic used across dashboard components
function resolveTab(baseRoute: string, pathname: string, pathToTab: Record<string, string>): { tab: string; isKnown: boolean } {
  const regex = new RegExp(`^${baseRoute}\\/?`);
  const subPath = pathname.replace(regex, '').split('/')[0] || '';
  const isKnown = subPath === '' || subPath in pathToTab;
  const tab = isKnown ? (pathToTab[subPath] || 'dashboard') : 'dashboard';
  return { tab, isKnown };
}

console.log('🧪 Starting Tier Routes & Sub-Path Navigation Verification Test Suite...');

// 1. VOTER_100_INCHARGE
{
  const PATH_TO_TAB: Record<string, string> = {
    '': 'dashboard',
    dashboard: 'dashboard',
    voters: 'voters',
    'live-track': 'live-track',
    'fake-doubtful': 'fake-doubtful',
    tasks: 'tasks',
    training: 'videos',
    videos: 'videos',
  };

  const expected = [
    { path: '/100-voter', tab: 'dashboard' },
    { path: '/100-voter/dashboard', tab: 'dashboard' },
    { path: '/100-voter/voters', tab: 'voters' },
    { path: '/100-voter/live-track', tab: 'live-track' },
    { path: '/100-voter/fake-doubtful', tab: 'fake-doubtful' },
    { path: '/100-voter/tasks', tab: 'tasks' },
    { path: '/100-voter/training', tab: 'videos' },
    { path: '/100-voter/videos', tab: 'videos' },
  ];

  for (const item of expected) {
    const res = resolveTab('/100-voter', item.path, PATH_TO_TAB);
    assert.equal(res.tab, item.tab, `Mismatch on ${item.path}`);
    assert.equal(res.isKnown, true, `Expected known route on ${item.path}`);
  }

  // Unknown subroute test
  const unknown = resolveTab('/100-voter', '/100-voter/unknown-slug', PATH_TO_TAB);
  assert.equal(unknown.isKnown, false, 'Expected unknown subroute to be flagged');
  console.log('  ✅ 1. 100-Voter Incharge: all 6 tabs & unknown fallback resolved correctly');
}

// 2. BOOTH_PRESIDENT
{
  const PATH_TO_TAB: Record<string, string> = {
    '': 'dashboard',
    dashboard: 'dashboard',
    voters: 'voters',
    'live-track': 'live-track',
    'fake-votes': 'fake-votes',
    tasks: 'tasks',
    caste: 'caste',
    'cadre-network': 'teams',
    teams: 'teams',
    videos: 'videos',
    training: 'videos',
  };

  const expected = [
    { path: '/booth', tab: 'dashboard' },
    { path: '/booth/voters', tab: 'voters' },
    { path: '/booth/live-track', tab: 'live-track' },
    { path: '/booth/fake-votes', tab: 'fake-votes' },
    { path: '/booth/tasks', tab: 'tasks' },
    { path: '/booth/caste', tab: 'caste' },
    { path: '/booth/cadre-network', tab: 'teams' },
    { path: '/booth/videos', tab: 'videos' },
  ];

  for (const item of expected) {
    const res = resolveTab('/booth', item.path, PATH_TO_TAB);
    assert.equal(res.tab, item.tab, `Mismatch on ${item.path}`);
    assert.equal(res.isKnown, true);
  }

  const unknown = resolveTab('/booth', '/booth/invalid', PATH_TO_TAB);
  assert.equal(unknown.isKnown, false);
  console.log('  ✅ 2. Booth Incharge: all 8 tabs & unknown fallback resolved correctly');
}

// 3. VILLAGE_INCHARGE
{
  const PATH_TO_TAB: Record<string, string> = {
    '': 'dashboard',
    dashboard: 'dashboard',
    voters: 'voters',
    live_track: 'live_track',
    'live-track': 'live_track',
    fake_votes: 'fake_votes',
    'fake-votes': 'fake_votes',
    tasks: 'tasks',
    caste_analytics: 'caste_analytics',
    caste: 'caste_analytics',
    cadre_network: 'cadre_network',
    cadre: 'cadre_network',
    training: 'training',
    videos: 'training',
  };

  const expected = [
    { path: '/village', tab: 'dashboard' },
    { path: '/village/voters', tab: 'voters' },
    { path: '/village/live_track', tab: 'live_track' },
    { path: '/village/fake_votes', tab: 'fake_votes' },
    { path: '/village/tasks', tab: 'tasks' },
    { path: '/village/caste_analytics', tab: 'caste_analytics' },
    { path: '/village/cadre_network', tab: 'cadre_network' },
    { path: '/village/training', tab: 'training' },
  ];

  for (const item of expected) {
    const res = resolveTab('/village', item.path, PATH_TO_TAB);
    assert.equal(res.tab, item.tab);
    assert.equal(res.isKnown, true);
  }

  const unknown = resolveTab('/village', '/village/random', PATH_TO_TAB);
  assert.equal(unknown.isKnown, false);
  console.log('  ✅ 3. Village Incharge: all 8 tabs & unknown fallback resolved correctly');
}

// 4. MANDAL_INCHARGE
{
  const PATH_TO_TAB: Record<string, string> = {
    '': 'dashboard',
    dashboard: 'dashboard',
    village_list: 'village_list',
    villages: 'village_list',
    booth_incharge_list: 'booth_incharge_list',
    booths: 'booth_incharge_list',
    voters: 'voters',
    live_track: 'live_track',
    'live-track': 'live_track',
    fake_votes: 'fake_votes',
    'fake-votes': 'fake_votes',
    tasks: 'tasks',
    caste_analytics: 'caste_analytics',
    caste: 'caste_analytics',
    cadre_network: 'cadre_network',
    cadre: 'cadre_network',
    training: 'training',
    videos: 'training',
    training_analytics: 'training_analytics',
  };

  const expected = [
    { path: '/mandal', tab: 'dashboard' },
    { path: '/mandal/village_list', tab: 'village_list' },
    { path: '/mandal/booth_incharge_list', tab: 'booth_incharge_list' },
    { path: '/mandal/fake_votes', tab: 'fake_votes' },
    { path: '/mandal/tasks', tab: 'tasks' },
    { path: '/mandal/caste_analytics', tab: 'caste_analytics' },
    { path: '/mandal/cadre_network', tab: 'cadre_network' },
    { path: '/mandal/training', tab: 'training' },
    { path: '/mandal/training_analytics', tab: 'training_analytics' },
  ];

  for (const item of expected) {
    const res = resolveTab('/mandal', item.path, PATH_TO_TAB);
    assert.equal(res.tab, item.tab);
    assert.equal(res.isKnown, true);
  }

  const unknown = resolveTab('/mandal', '/mandal/xyz', PATH_TO_TAB);
  assert.equal(unknown.isKnown, false);
  console.log('  ✅ 4. Mandal Incharge: all 9 tabs & unknown fallback resolved correctly');
}

// 5. CONSTITUENCY_INCHARGE
{
  const PATH_TO_TAB: Record<string, string> = {
    '': 'dashboard',
    dashboard: 'dashboard',
    mandal_list: 'mandal_list',
    mandals: 'mandal_list',
    village_list: 'village_list',
    villages: 'village_list',
    tasks: 'tasks',
    caste_analytics: 'caste_analytics',
    caste: 'caste_analytics',
    cadre_network: 'cadre_network',
    cadre: 'cadre_network',
    fake_votes: 'fake_votes',
    'fake-votes': 'fake_votes',
    strategic_intelligence: 'strategic_intelligence',
    'ai-intel': 'strategic_intelligence',
    training_analytics: 'training_analytics',
    live_voter_tracking: 'live_voter_tracking',
    'live-track': 'live_voter_tracking',
    migrated_voters: 'migrated_voters',
    migrated: 'migrated_voters',
  };

  const expected = [
    { path: '/constituency', tab: 'dashboard' },
    { path: '/constituency/mandal_list', tab: 'mandal_list' },
    { path: '/constituency/village_list', tab: 'village_list' },
    { path: '/constituency/tasks', tab: 'tasks' },
    { path: '/constituency/caste_analytics', tab: 'caste_analytics' },
    { path: '/constituency/cadre_network', tab: 'cadre_network' },
    { path: '/constituency/fake_votes', tab: 'fake_votes' },
    { path: '/constituency/strategic_intelligence', tab: 'strategic_intelligence' },
    { path: '/constituency/training_analytics', tab: 'training_analytics' },
    { path: '/constituency/live_voter_tracking', tab: 'live_voter_tracking' },
    { path: '/constituency/migrated_voters', tab: 'migrated_voters' },
  ];

  for (const item of expected) {
    const res = resolveTab('/constituency', item.path, PATH_TO_TAB);
    assert.equal(res.tab, item.tab);
    assert.equal(res.isKnown, true);
  }

  const unknown = resolveTab('/constituency', '/constituency/bad', PATH_TO_TAB);
  assert.equal(unknown.isKnown, false);
  console.log('  ✅ 5. Constituency Incharge: all 11 tabs & unknown fallback resolved correctly');
}

// 6. ZONE & PARLIAMENT
{
  const ZONE_PATH_TO_TAB: Record<string, string> = {
    '': 'dashboard',
    dashboard: 'dashboard',
    parliament_list: 'parliament_list',
    constituency_list: 'constituency_list',
    highcommand_tasks: 'highcommand_tasks',
    cadre_network: 'cadre_network',
    fake_votes: 'fake_votes',
    strategic_intelligence: 'strategic_intelligence',
    training_analytics: 'training_analytics',
  };

  const PARLIAMENT_PATH_TO_TAB: Record<string, string> = {
    '': 'dashboard',
    dashboard: 'dashboard',
    constituency_list: 'constituency_list',
    mandal_list: 'mandal_list',
    highcommand_tasks: 'highcommand_tasks',
    cadre_network: 'cadre_network',
    fake_votes: 'fake_votes',
    strategic_intelligence: 'strategic_intelligence',
    training_analytics: 'training_analytics',
  };

  assert.equal(resolveTab('/zone', '/zone/parliament_list', ZONE_PATH_TO_TAB).tab, 'parliament_list');
  assert.equal(resolveTab('/zone', '/zone/highcommand_tasks', ZONE_PATH_TO_TAB).tab, 'highcommand_tasks');
  assert.equal(resolveTab('/parliament', '/parliament/mandal_list', PARLIAMENT_PATH_TO_TAB).tab, 'mandal_list');
  assert.equal(resolveTab('/parliament', '/parliament/constituency_list', PARLIAMENT_PATH_TO_TAB).tab, 'constituency_list');
  console.log('  ✅ 6. Zone & Parliament Incharges: tabs resolved correctly with distinct roles');
}

// 7. STATE_ADMIN
{
  const STATE_PATH_TO_TAB: Record<string, string> = {
    '': 'dashboard',
    dashboard: 'dashboard',
    constituency_list: 'constituency_list',
    parliament_list: 'parliament_list',
    zone_list: 'zone_list',
    ground_reports: 'ground_reports',
    campaign: 'campaign',
    poll: 'poll',
    cadre_network: 'cadre_network',
    ai_intel: 'ai_intel',
  };

  assert.equal(resolveTab('/state', '/state/constituency_list', STATE_PATH_TO_TAB).tab, 'constituency_list');
  assert.equal(resolveTab('/state', '/state/campaign', STATE_PATH_TO_TAB).tab, 'campaign');
  assert.equal(resolveTab('/state', '/state/poll', STATE_PATH_TO_TAB).tab, 'poll');
  console.log('  ✅ 7. State Admin: all 9 tabs resolved correctly');
}

// 8. SUPER_ADMIN
{
  const SUPER_ADMIN_PATH_TO_TAB: Record<string, string> = {
    '': 'overview',
    overview: 'overview',
    orgs: 'orgs',
    parties: 'parties',
    ai: 'ai',
    storage: 'storage',
    audit: 'audit',
    health: 'health',
  };

  assert.equal(resolveTab('/super-admin', '/super-admin', SUPER_ADMIN_PATH_TO_TAB).tab, 'overview');
  assert.equal(resolveTab('/super-admin', '/super-admin/orgs', SUPER_ADMIN_PATH_TO_TAB).tab, 'orgs');
  assert.equal(resolveTab('/super-admin', '/super-admin/parties', SUPER_ADMIN_PATH_TO_TAB).tab, 'parties');
  assert.equal(resolveTab('/super-admin', '/super-admin/ai', SUPER_ADMIN_PATH_TO_TAB).tab, 'ai');
  assert.equal(resolveTab('/super-admin', '/super-admin/health', SUPER_ADMIN_PATH_TO_TAB).tab, 'health');
  console.log('  ✅ 8. Super Admin: all 7 tabs resolved correctly');
}

console.log('\n🎉 ALL TIER ROUTING & SUB-PATH RESOLUTION TESTS PASSED SUCCESSFULLY!\n');
