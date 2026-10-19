import { prisma } from '../lib/prisma.js';
import { RoleType, AccountStatus, AuditAction, OrgHierarchyLevel } from '@prisma/client';
import { ApplicationsService } from '../modules/applications/applications.service.js';

interface ProfilingMetrics {
  totalDeletionDurationMs: number;
  lockAcquisitionDurationMs: number;
  configDeletionDurationMs: number;
  sharedConfigCheckDurationMs: number;
  partyCleanupDurationMs: number;
  hierarchyDiscoveryDurationMs: number;
  hierarchyChildEntitiesDeletionDurationMs: number;
  hierarchyNodesDeletionDurationMs: number;
  announcementsAndVideosDurationMs: number;
  tenantUsersCleanupDurationMs: number;
  orgAndRolesDeletionDurationMs: number;
  transactionTotalDurationMs: number;
  auditWriteDurationMs: number;
  listRefreshDurationMs: number;
  voterCountDurationMs: number;
  totalQueriesEstimated: number;
}

export async function runBenchmark(label: string = 'Current Baseline'): Promise<ProfilingMetrics> {
  const nonce = Date.now().toString().slice(-6);
  const orgCode = `BENCH_ORG_${nonce}`;
  const orgName = `Benchmarking Org ${nonce}`;
  const configKey = `cfg_bench_${nonce}`;
  const stateCode = `ST_BENCH_${nonce}`;

  console.log(`\n======================================================`);
  console.log(`[PROFILER] Setting up isolated benchmark data for: ${label}`);
  console.log(`======================================================`);

  // 1. Create isolated benchmark organisation
  const org = await prisma.organisation.create({
    data: {
      code: orgCode,
      name: orgName,
      isActive: true,
    },
  });

  // 2. Create isolated hierarchy tree
  const state = await prisma.state.create({
    data: {
      name: `Benchmark State ${nonce}`,
      code: stateCode,
      organisationId: org.id,
    },
  });

  const zone = await prisma.zone.create({
    data: {
      name: `Zone ${nonce}`,
      code: `ZN_BENCH_${nonce}`,
      stateId: state.id,
    },
  });

  const parliament = await prisma.parliament.create({
    data: {
      name: `Parliament ${nonce}`,
      code: `PC_BENCH_${nonce}`,
      zoneId: zone.id,
    },
  });

  const constituency = await prisma.constituency.create({
    data: {
      name: `Constituency ${nonce}`,
      code: `AC_BENCH_${nonce}`,
      parliamentId: parliament.id,
    },
  });

  const mandal = await prisma.mandal.create({
    data: {
      name: `Mandal ${nonce}`,
      code: `MND_BENCH_${nonce}`,
      constituencyId: constituency.id,
    },
  });

  const village = await prisma.village.create({
    data: {
      name: `Village ${nonce}`,
      code: `VLG_BENCH_${nonce}`,
      mandalId: mandal.id,
    },
  });

  const booth = await prisma.booth.create({
    data: {
      name: `Booth ${nonce}`,
      code: `BTH_BENCH_${nonce}`,
      boothNumber: `B-${nonce}`,
      villageId: village.id,
    },
  });

  const voterGroup = await prisma.voterGroup.create({
    data: {
      name: `Voter Group ${nonce}`,
      code: `VG_BENCH_${nonce}`,
      boothId: booth.id,
    },
  });

  // 3. Create isolated benchmark party
  const party = await prisma.politicalParty.create({
    data: {
      code: `BP_${nonce}`,
      name: `Bench Party ${nonce}`,
      shortName: `BP${nonce}`,
      organisationId: org.id,
      isActive: true,
    },
  });

  // 4. Create isolated tenant user & dependents
  const tenantUser = await prisma.user.create({
    data: {
      name: `Bench User ${nonce}`,
      userCode: `USR_BENCH_${nonce}`,
      mobileNumber: `9810${nonce}`,
      role: RoleType.BOOTH_INCHARGE,
      accountStatus: AccountStatus.ACTIVE,
      organisationId: org.id,
    },
  });

  await prisma.loginSession.create({
    data: {
      userId: tenantUser.id,
      tokenHash: `hash_${nonce}`,
      ipAddress: '127.0.0.1',
      deviceInfo: 'Benchmark Agent',
      expiresAt: new Date(Date.now() + 86400000),
    },
  });

  await prisma.oTPVerification.create({
    data: {
      mobileNumber: tenantUser.mobileNumber,
      otpCode: '123456',
      role: RoleType.BOOTH_INCHARGE,
      expiresAt: new Date(Date.now() + 600000),
      userId: tenantUser.id,
    },
  });

  // 5. Create benchmark CMS configuration
  const config = await prisma.cMSConfiguration.create({
    data: {
      configKey,
      organisationName: orgName,
      headerTitle: orgName,
      stateName: 'Benchmark State',
      organisationId: org.id,
      activePartyCode: party.code,
      featureToggles: {
        aiInsights: true,
        cadreManagement: true,
        dataImport: true,
      },
      hierarchyLabels: {
        STATE: 'State',
        ZONE: 'Zone',
        PARLIAMENT: 'Parliament',
        CONSTITUENCY: 'Constituency',
        MANDAL: 'Mandal',
        VILLAGE: 'Village',
        BOOTH: 'Booth',
        VOTER_GROUP: 'Group',
      },
    },
  });

  console.log(`[PROFILER] Benchmark fixture ready. Beginning deletion instrumentation...`);

  // Instrument voter count independently first (baseline for getApplications voter count)
  const voterCountStart = performance.now();
  await prisma.voter.count({
    where: {
      OR: [
        { state: { organisationId: org.id } },
        { constituency: { parliament: { zone: { state: { organisationId: org.id } } } } },
        { booth: { village: { mandal: { constituency: { parliament: { zone: { state: { organisationId: org.id } } } } } } } },
      ],
    },
  });
  const voterCountDurationMs = Math.round((performance.now() - voterCountStart) * 100) / 100;

  const superAdmin = await prisma.user.findFirst({
    where: { role: RoleType.SUPER_ADMIN },
  });

  // Now measure deleteApplication
  const delStart = performance.now();
  const deleteResult = await ApplicationsService.deleteApplication(config.id, {
    userId: superAdmin?.id || tenantUser.id,
    role: RoleType.SUPER_ADMIN,
    mobileNumber: superAdmin?.mobileNumber || tenantUser.mobileNumber,
    organisationId: superAdmin?.organisationId || undefined,
    userCode: superAdmin?.userCode || 'SUPER_ADMIN',
  });
  const totalDeletionDurationMs = Math.round((performance.now() - delStart) * 100) / 100;

  // Now measure getApplications (List Refresh)
  const refreshStart = performance.now();
  await ApplicationsService.getApplications(undefined, true);
  const listRefreshDurationMs = Math.round((performance.now() - refreshStart) * 100) / 100;

  const t = (deleteResult as any).timings || {};

  const metrics: ProfilingMetrics = {
    totalDeletionDurationMs,
    lockAcquisitionDurationMs: t.lockMs || 0,
    configDeletionDurationMs: t.configDeleteMs || 0,
    sharedConfigCheckDurationMs: t.sharedCheckMs || 0,
    partyCleanupDurationMs: t.partyCleanupMs || 0,
    hierarchyDiscoveryDurationMs: t.hierarchyDiscoveryMs || 0,
    hierarchyChildEntitiesDeletionDurationMs: t.childEntitiesDeleteMs || 0,
    hierarchyNodesDeletionDurationMs: t.hierarchyNodesDeleteMs || 0,
    announcementsAndVideosDurationMs: t.announcementsVideosMs || 0,
    tenantUsersCleanupDurationMs: t.tenantUsersCleanupMs || 0,
    orgAndRolesDeletionDurationMs: t.orgDeleteMs || 0,
    transactionTotalDurationMs: t.transactionTotalMs || totalDeletionDurationMs,
    auditWriteDurationMs: t.auditWriteMs || 0,
    listRefreshDurationMs,
    voterCountDurationMs,
    totalQueriesEstimated: 14,
  };

  console.log(`[PROFILER] [${label}] Results:`);
  console.log(`  - Total Deletion Duration: ${totalDeletionDurationMs} ms`);
  console.log(`    * Lock Acquisition: ${t.lockMs} ms`);
  console.log(`    * Config Deletion: ${t.configDeleteMs} ms`);
  console.log(`    * Shared Config Check: ${t.sharedCheckMs} ms`);
  console.log(`    * Party Cleanup: ${t.partyCleanupMs} ms`);
  console.log(`    * Hierarchy Discovery (1 Tree Query): ${t.hierarchyDiscoveryMs} ms`);
  console.log(`    * Child Entities Deletion: ${t.childEntitiesDeleteMs} ms`);
  console.log(`    * Hierarchy Nodes Deletion (PG Cascade): ${t.hierarchyNodesDeleteMs} ms`);
  console.log(`    * Announcements & Videos: ${t.announcementsVideosMs} ms`);
  console.log(`    * Tenant Users Purge (PG Cascade): ${t.tenantUsersCleanupMs} ms`);
  console.log(`    * Org & Roles Deletion: ${t.orgDeleteMs} ms`);
  console.log(`    * Audit Event Write: ${t.auditWriteMs} ms`);
  console.log(`  - Subsequent getApplications Refresh Duration: ${listRefreshDurationMs} ms`);
  console.log(`  - Per-Org Nested Voter Count Duration: ${voterCountDurationMs} ms`);
  console.log(`  - Permanent Org Purged: ${deleteResult.permanentOrgPurge}`);
  console.log(`  - Purged Users: ${deleteResult.purgedUserCount}`);
  console.log(`======================================================\n`);

  return metrics;
}

if (process.argv[1]?.includes('profile-deletion-baseline')) {
  runBenchmark('Current Baseline')
    .then((metrics) => {
      console.log('BENCHMARK_COMPLETE:', JSON.stringify(metrics, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('Benchmark failed:', err);
      process.exit(1);
    });
}
