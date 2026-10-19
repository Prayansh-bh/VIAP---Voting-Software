/**
 * VIAP — Safe Test Artifact & Orphan Dry-Run Inventory Tool
 *
 * Implements Objective E:
 * - Read-only / dry-run by default.
 * - Inspects candidate records: test voters, orphaned states, test parties, and test users.
 * - Produces a structured manifest of primary keys, relationships, timestamps, references, and dependencies.
 * - Enforces safety guards: requires explicit --execute-confirmed flag AND --production-approval-token to ever mutate anything.
 * - NEVER deletes any records unless explicitly confirmed by owner.
 * - ZERO database mutations occur during default execution.
 * - NEVER prints database credentials or connection strings.
 */

import { RoleType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export interface CleanupCandidate {
  entityType: 'VOTER' | 'STATE' | 'USER' | 'POLITICAL_PARTY' | 'ORGANISATION';
  id: string;
  identifier: string;
  name?: string;
  createdAt?: string;
  organisationId: string | null;
  organisationName?: string;
  evidence: string[];
  operationalReferences: {
    hasVotingHistory: boolean;
    voteCount: number;
    auditLogCount: number;
    assignedUsersCount: number;
    childEntitiesCount: number;
  };
  classification: 'KNOWN_TEST_ARTIFACT' | 'ACTIVE_OPERATIONAL_RECORD' | 'AMBIGUOUS_REQUIRES_OWNER_REVIEW';
  safetyVerdict: 'SAFE_FOR_FUTURE_CLEANUP_ONCE_APPROVED' | 'MUST_BE_RETAINED' | 'MANUAL_REVIEW_REQUIRED';
}

export interface CleanupManifest {
  runTimestamp: string;
  mode: 'DRY_RUN_READ_ONLY' | 'EXECUTE_CONFIRMED';
  summary: {
    totalCandidatesAnalyzed: number;
    testVotersCount: number;
    orphanStatesCount: number;
    testPartiesCount: number;
    orphanUsersCount: number;
    safeForCleanupCount: number;
    mustRetainCount: number;
    requiresReviewCount: number;
  };
  candidates: CleanupCandidate[];
}

export async function runDryRunAudit(): Promise<CleanupManifest> {
  const candidates: CleanupCandidate[] = [];

  // 1. Audit Voters
  const allVoters: any[] = await prisma.voter.findMany({
    include: {
      state: { select: { id: true, code: true, name: true, organisationId: true, organisation: { select: { name: true } } } },
      _count: {
        select: {
          voteTrackings: true,
          fakeVoterFlags: true,
          liveVoteEvents: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  for (const v of allVoters) {
    const isTestEpic = /^(EPIC_B_|EPIC_VOTE_|EPIC_SRV|TEST_|DEMO_)/i.test(v.epicNumber);
    const hasVotingEvidence = v.voteStatus === 'VOTE_DONE' || v._count.voteTrackings > 0 || v._count.liveVoteEvents > 0;
    const isUnderActiveTenant = Boolean(v.state?.organisationId);

    const evidence: string[] = [];
    if (isTestEpic) evidence.push(`EPIC prefix "${v.epicNumber.split('_')[0]}" matches test pattern`);
    if (v.name?.toLowerCase().includes('voter')) evidence.push(`Generic test name "${v.name}"`);
    if (!v.state?.organisationId) evidence.push('State has no associated organisation (organisationId = NULL)');

    let classification: CleanupCandidate['classification'] = 'AMBIGUOUS_REQUIRES_OWNER_REVIEW';
    let safetyVerdict: CleanupCandidate['safetyVerdict'] = 'MANUAL_REVIEW_REQUIRED';

    if (isTestEpic && !isUnderActiveTenant) {
      classification = 'KNOWN_TEST_ARTIFACT';
      safetyVerdict = hasVotingEvidence ? 'MANUAL_REVIEW_REQUIRED' : 'SAFE_FOR_FUTURE_CLEANUP_ONCE_APPROVED';
    } else if (hasVotingEvidence) {
      classification = 'ACTIVE_OPERATIONAL_RECORD';
      safetyVerdict = 'MUST_BE_RETAINED';
    }

    candidates.push({
      entityType: 'VOTER',
      id: v.id,
      identifier: v.epicNumber,
      name: v.name,
      createdAt: v.createdAt?.toISOString(),
      organisationId: v.state?.organisationId || null,
      organisationName: v.state?.organisation?.name || 'Unassigned / Orphan',
      evidence,
      operationalReferences: {
        hasVotingHistory: hasVotingEvidence,
        voteCount: v._count.voteTrackings + v._count.liveVoteEvents,
        auditLogCount: 0,
        assignedUsersCount: 0,
        childEntitiesCount: v._count.fakeVoterFlags,
      },
      classification,
      safetyVerdict,
    });
  }

  // 2. Audit States with organisationId = NULL
  const nullOrgStates: any[] = await prisma.state.findMany({
    where: { organisationId: null },
    include: {
      _count: {
        select: {
          zones: true,
          voters: true,
          users: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  for (const s of nullOrgStates) {
    const totalDescendants = s._count.zones;

    const evidence: string[] = ['State organisationId is NULL'];
    const isTestCode = /^(TS_TEST|AP_TEST|BENCH|TEMP)/i.test(s.code);
    if (isTestCode) evidence.push(`State code "${s.code}" matches test prefix`);

    let classification: CleanupCandidate['classification'] = 'AMBIGUOUS_REQUIRES_OWNER_REVIEW';
    let safetyVerdict: CleanupCandidate['safetyVerdict'] = 'MANUAL_REVIEW_REQUIRED';

    if (s._count.voters === 0 && s._count.users === 0 && totalDescendants === 0) {
      classification = 'KNOWN_TEST_ARTIFACT';
      safetyVerdict = 'SAFE_FOR_FUTURE_CLEANUP_ONCE_APPROVED';
      evidence.push('Empty state with zero users, zero voters, and zero hierarchy descendants');
    } else if (s._count.voters > 0) {
      evidence.push(`Contains ${s._count.voters} persisted voter records`);
      classification = 'ACTIVE_OPERATIONAL_RECORD';
      safetyVerdict = 'MANUAL_REVIEW_REQUIRED';
    }

    candidates.push({
      entityType: 'STATE',
      id: s.id,
      identifier: s.code,
      name: s.name,
      createdAt: s.createdAt?.toISOString(),
      organisationId: null,
      organisationName: 'None (organisationId = NULL)',
      evidence,
      operationalReferences: {
        hasVotingHistory: false,
        voteCount: 0,
        auditLogCount: 0,
        assignedUsersCount: s._count.users,
        childEntitiesCount: totalDescendants + s._count.voters,
      },
      classification,
      safetyVerdict,
    });
  }

  // 3. Audit Test Political Parties
  const testParties: any[] = await prisma.politicalParty.findMany({
    where: {
      OR: [
        { code: { startsWith: 'TEST_' } },
        { code: { startsWith: 'BENCH_' } },
      ],
    },
    include: {
      _count: {
        select: {
          voterPreferences: true,
        },
      },
      organisation: { select: { id: true, name: true, code: true } },
    },
  });

  for (const p of testParties) {
    candidates.push({
      entityType: 'POLITICAL_PARTY',
      id: p.id,
      identifier: p.code,
      name: p.name,
      createdAt: p.createdAt?.toISOString(),
      organisationId: p.organisationId,
      organisationName: p.organisation?.name || 'Unassigned',
      evidence: [`Party code "${p.code}" has benchmark/test prefix`],
      operationalReferences: {
        hasVotingHistory: false,
        voteCount: 0,
        auditLogCount: 0,
        assignedUsersCount: 0,
        childEntitiesCount: p._count.voterPreferences,
      },
      classification: 'KNOWN_TEST_ARTIFACT',
      safetyVerdict: p._count.voterPreferences === 0 ? 'SAFE_FOR_FUTURE_CLEANUP_ONCE_APPROVED' : 'MANUAL_REVIEW_REQUIRED',
    });
  }

  // 4. Audit Users with organisationId = NULL
  const nullOrgUsers: any[] = await prisma.user.findMany({
    where: { organisationId: null },
    include: {
      _count: {
        select: {
          hierarchyAssignments: true,
          managedVoterGroups: true,
          assignedVoters: true,
          auditLogs: true,
        },
      },
    },
  });

  for (const u of nullOrgUsers) {
    if (u.role === RoleType.SUPER_ADMIN) {
      candidates.push({
        entityType: 'USER',
        id: u.id,
        identifier: u.userCode,
        name: u.name,
        createdAt: u.createdAt?.toISOString(),
        organisationId: null,
        organisationName: 'Root SaaS Global Platform',
        evidence: ['Role is SUPER_ADMIN (Platform Administrator)'],
        operationalReferences: {
          hasVotingHistory: false,
          voteCount: 0,
          auditLogCount: u._count.auditLogs,
          assignedUsersCount: 0,
          childEntitiesCount: 0,
        },
        classification: 'ACTIVE_OPERATIONAL_RECORD',
        safetyVerdict: 'MUST_BE_RETAINED',
      });
    } else {
      candidates.push({
        entityType: 'USER',
        id: u.id,
        identifier: u.userCode,
        name: u.name,
        createdAt: u.createdAt?.toISOString(),
        organisationId: null,
        organisationName: 'Orphaned Tenant User',
        evidence: ['Tenant-level role without organisation assignment'],
        operationalReferences: {
          hasVotingHistory: false,
          voteCount: 0,
          auditLogCount: u._count.auditLogs,
          assignedUsersCount: 0,
          childEntitiesCount: u._count.hierarchyAssignments + u._count.assignedVoters,
        },
        classification: 'AMBIGUOUS_REQUIRES_OWNER_REVIEW',
        safetyVerdict: 'MANUAL_REVIEW_REQUIRED',
      });
    }
  }

  const manifest: CleanupManifest = {
    runTimestamp: new Date().toISOString(),
    mode: 'DRY_RUN_READ_ONLY',
    summary: {
      totalCandidatesAnalyzed: candidates.length,
      testVotersCount: candidates.filter((c) => c.entityType === 'VOTER').length,
      orphanStatesCount: candidates.filter((c) => c.entityType === 'STATE').length,
      testPartiesCount: candidates.filter((c) => c.entityType === 'POLITICAL_PARTY').length,
      orphanUsersCount: candidates.filter((c) => c.entityType === 'USER').length,
      safeForCleanupCount: candidates.filter((c) => c.safetyVerdict === 'SAFE_FOR_FUTURE_CLEANUP_ONCE_APPROVED').length,
      mustRetainCount: candidates.filter((c) => c.safetyVerdict === 'MUST_BE_RETAINED').length,
      requiresReviewCount: candidates.filter((c) => c.safetyVerdict === 'MANUAL_REVIEW_REQUIRED').length,
    },
    candidates,
  };

  return manifest;
}

async function main() {
  const args = process.argv.slice(2);
  const isExecuteRequested = args.includes('--execute-confirmed');
  const approvalToken = args.find((a) => a.startsWith('--production-approval-token='))?.split('=')[1];

  console.log('================================================================================');
  console.log('VIAP — TEST DATA & ORPHAN INVENTORY & DRY-RUN CLEANUP TOOL');
  console.log('================================================================================\n');

  const manifest = await runDryRunAudit();

  console.log(`[MODE] ${manifest.mode}`);
  console.log(`[TIMESTAMP] ${manifest.runTimestamp}`);
  console.log(`[SUMMARY]`);
  console.log(`  - Total Candidates Analyzed:    ${manifest.summary.totalCandidatesAnalyzed}`);
  console.log(`  - Test Voters:                  ${manifest.summary.testVotersCount}`);
  console.log(`  - Orphan States:                ${manifest.summary.orphanStatesCount}`);
  console.log(`  - Test Parties:                 ${manifest.summary.testPartiesCount}`);
  console.log(`  - Null Org Users:               ${manifest.summary.orphanUsersCount}`);
  console.log(`  - Safe for Cleanup (Dry Run):   ${manifest.summary.safeForCleanupCount}`);
  console.log(`  - Must Be Retained:             ${manifest.summary.mustRetainCount}`);
  console.log(`  - Requires Owner Review:        ${manifest.summary.requiresReviewCount}`);
  console.log('');

  console.log('[CANDIDATES BREAKDOWN]');
  for (const c of manifest.candidates) {
    console.log(`  [${c.entityType}] ID: ${c.id}`);
    console.log(`    Identifier: ${c.identifier} | Name: "${c.name || 'N/A'}"`);
    console.log(`    Org: ${c.organisationName} (${c.organisationId || 'NULL'})`);
    console.log(`    Classification: ${c.classification} | Verdict: ${c.safetyVerdict}`);
    console.log(`    Evidence: ${c.evidence.join('; ') || 'None'}`);
    console.log(`    References: Votes=${c.operationalReferences.voteCount}, Children=${c.operationalReferences.childEntitiesCount}, Users=${c.operationalReferences.assignedUsersCount}`);
    console.log('');
  }

  if (isExecuteRequested) {
    console.error('⛔ DESTRUCTIVE EXECUTION REFUSED.');
    console.error('In accordance with the Strict Safety Rules, no rows may be mutated or deleted in this session.');
    console.error('The candidate manifest above is presented for owner review only.');
    process.exit(0);
  }

  console.log('================================================================================');
  console.log('✅ DRY-RUN COMPLETED: 0 database rows were modified or deleted.');
  console.log('================================================================================');
}

main()
  .catch((err) => {
    console.error('Dry run execution error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
