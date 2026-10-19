/**
 * VIAP — Orphaned Tenant Users & Platform Admin Forensic Audit Utility
 *
 * STRICT DRY-RUN / REPORT-ONLY MODE
 * This script analyzes users with `organisationId = null` using evidence-based
 * database relationships and historical links.
 * 
 * SAFETY ASSURANCES:
 * - NO MUTATIONS: Does not execute UPDATE, DELETE, or INSERT statements.
 * - ZERO DATA LOSS: Operates 100% read-only.
 * - PII PROTECTION: Masks mobile numbers and personal identifiers.
 */

import { RoleType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export interface UserAuditClassification {
  id: string;
  userCode: string;
  name: string;
  maskedMobile: string;
  role: RoleType;
  category: 'VERIFIED_PLATFORM_ADMIN' | 'CONFIRMED_ORPHANED_TENANT_USER' | 'AMBIGUOUS_MANUAL_REVIEW_REQUIRED';
  evidence: string[];
  recommendedAction: string;
}

export interface AuditReportSummary {
  timestamp: string;
  totalNullOrgUsers: number;
  verifiedPlatformAdmins: number;
  confirmedOrphanedTenantUsers: number;
  ambiguousUsers: number;
  classifications: UserAuditClassification[];
}

function maskMobile(mobile?: string | null): string {
  if (!mobile) return 'N/A';
  if (mobile.length <= 4) return '***';
  return `${mobile.slice(0, 4)}***${mobile.slice(-4)}`;
}

export async function generateOrphanAuditReport(): Promise<AuditReportSummary> {
  const users = await prisma.user.findMany({
    where: { organisationId: null },
    include: {
      hierarchyAssignments: {
        include: {
          state: { select: { id: true, name: true, code: true, organisationId: true } },
          constituency: { select: { id: true, name: true, code: true } },
        },
      },
      managedVoterGroups: { select: { id: true, name: true, code: true }, take: 3 },
      assignedVoters: { select: { id: true, stateId: true, constituencyId: true }, take: 5 },
      cadreProfile: { select: { id: true, performanceScore: true } },
      auditLogs: { select: { id: true, action: true, entityType: true, entityId: true }, take: 3 },
      sessions: { select: { id: true, createdAt: true }, take: 1 },
      devices: { select: { id: true, deviceId: true }, take: 1 },
    },
    orderBy: { createdAt: 'asc' },
  });

  const classifications: UserAuditClassification[] = [];

  for (const user of users) {
    const evidence: string[] = [];

    // 1. Platform Admin Identification
    if (user.role === RoleType.SUPER_ADMIN) {
      classifications.push({
        id: user.id,
        userCode: user.userCode,
        name: user.name,
        maskedMobile: maskMobile(user.mobileNumber),
        role: user.role,
        category: 'VERIFIED_PLATFORM_ADMIN',
        evidence: [
          'Role is explicitly SUPER_ADMIN',
          'Root platform administrator privileges required across all tenants',
          `User code pattern: ${user.userCode}`,
        ],
        recommendedAction: 'PRESERVE: Do not modify or attach to any tenant. Maintain platform privileges.',
      });
      continue;
    }

    // 2. Tenant Evidence Gathering
    let confirmedTenantEvidence = false;

    // Check userCode pattern
    if (/^(DEL-|DCPTHE|TDP-|INC-|YSRCP-)/i.test(user.userCode)) {
      evidence.push(`UserCode prefix indicates prior tenant code: ${user.userCode.split('-')[0]}`);
      confirmedTenantEvidence = true;
    }

    // Check hierarchy assignments
    if (user.hierarchyAssignments.length > 0) {
      const assignmentSummary = user.hierarchyAssignments
        .map((a) => `${a.roleType} in State: ${a.state?.name || a.stateId || 'Unknown'}`)
        .join(', ');
      evidence.push(`Active hierarchy assignment history: ${assignmentSummary}`);
      confirmedTenantEvidence = true;
    }

    // Check managed voter groups
    if (user.managedVoterGroups.length > 0) {
      evidence.push(`Assigned incharge of ${user.managedVoterGroups.length} voter groups`);
      confirmedTenantEvidence = true;
    }

    // Check assigned voters
    if (user.assignedVoters.length > 0) {
      evidence.push(`Direct incharge of ${user.assignedVoters.length}+ voter records in constituency ${user.assignedVoters[0]?.constituencyId || 'N/A'}`);
      confirmedTenantEvidence = true;
    }

    // Check cadre profile
    if (user.cadreProfile) {
      evidence.push('Attached cadre profile record exists');
      confirmedTenantEvidence = true;
    }

    // Check audit logs
    if (user.auditLogs.length > 0) {
      const logSummary = user.auditLogs.map((l) => `${l.action} ${l.entityType}`).join(', ');
      evidence.push(`Audit events recorded: ${logSummary}`);
    }

    // 3. Classification
    if (confirmedTenantEvidence) {
      classifications.push({
        id: user.id,
        userCode: user.userCode,
        name: user.name,
        maskedMobile: maskMobile(user.mobileNumber),
        role: user.role,
        category: 'CONFIRMED_ORPHANED_TENANT_USER',
        evidence,
        recommendedAction: 'CANDIDATE FOR CLEANUP: Tenant was deleted. Permanent removal releases phone number for re-registration without data leakage.',
      });
    } else {
      classifications.push({
        id: user.id,
        userCode: user.userCode,
        name: user.name,
        maskedMobile: maskMobile(user.mobileNumber),
        role: user.role,
        category: 'AMBIGUOUS_MANUAL_REVIEW_REQUIRED',
        evidence: evidence.length > 0 ? evidence : ['No attached hierarchy, voter, or audit relationships found.'],
        recommendedAction: 'MANUAL REVIEW REQUIRED: Insufficient relationship evidence to determine originating tenant.',
      });
    }
  }

  const summary: AuditReportSummary = {
    timestamp: new Date().toISOString(),
    totalNullOrgUsers: users.length,
    verifiedPlatformAdmins: classifications.filter((c) => c.category === 'VERIFIED_PLATFORM_ADMIN').length,
    confirmedOrphanedTenantUsers: classifications.filter((c) => c.category === 'CONFIRMED_ORPHANED_TENANT_USER').length,
    ambiguousUsers: classifications.filter((c) => c.category === 'AMBIGUOUS_MANUAL_REVIEW_REQUIRED').length,
    classifications,
  };

  return summary;
}

// Run CLI report if invoked directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  generateOrphanAuditReport()
    .then((report) => {
      console.log('================================================================================');
      console.log('VIAP — ORPHANED USER FORENSIC AUDIT (REPORT-ONLY / DRY-RUN)');
      console.log('================================================================================');
      console.log(`Generated At: ${report.timestamp}`);
      console.log(`Total Users with organisationId = NULL: ${report.totalNullOrgUsers}`);
      console.log(`  - [1] Verified Platform Administrators (SUPER_ADMIN): ${report.verifiedPlatformAdmins}`);
      console.log(`  - [2] Confirmed Orphaned Tenant Users:                ${report.confirmedOrphanedTenantUsers}`);
      console.log(`  - [3] Ambiguous Users Requiring Manual Review:        ${report.ambiguousUsers}`);
      console.log('--------------------------------------------------------------------------------');
      console.log('SAFE BREAKDOWN:');
      console.log('--------------------------------------------------------------------------------');
      for (const item of report.classifications) {
        console.log(`[${item.category}]`);
        console.log(`  ID:     ${item.id}`);
        console.log(`  Code:   ${item.userCode}`);
        console.log(`  Role:   ${item.role}`);
        console.log(`  Mobile: ${item.maskedMobile}`);
        console.log(`  Evidence:`);
        for (const ev of item.evidence) {
          console.log(`    * ${ev}`);
        }
        console.log(`  Action: ${item.recommendedAction}`);
        console.log('');
      }
      console.log('================================================================================');
      console.log('[DRY-RUN / REPORT-ONLY] Zero database records were modified or deleted.');
      console.log('================================================================================');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Audit report failed:', err);
      process.exit(1);
    });
}
