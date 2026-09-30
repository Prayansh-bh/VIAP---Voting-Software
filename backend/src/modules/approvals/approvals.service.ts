import { prisma } from '../../lib/prisma.js';
import { CreateApprovalDto } from './approvals.schema.js';

export interface ApprovalRecord {
  id: string;
  partyId?: string;
  type: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  title: string;
  description?: string;
  entityId?: string;
  entityType?: string;
  payload: Record<string, any>;
  requestedByName: string;
  requestedByRole: string;
  requestedByMobile: string;
  actionedByName?: string;
  actionedAt?: Date | string;
  rejectionReason?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export class ApprovalsService {
  private static tableInitialized = false;

  private static async ensureTable() {
    if (this.tableInitialized) return;
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS approval_requests (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          party_id VARCHAR(255),
          type VARCHAR(100) NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
          title VARCHAR(255) NOT NULL,
          description TEXT,
          entity_id VARCHAR(255),
          entity_type VARCHAR(100),
          payload JSONB DEFAULT '{}'::jsonb,
          requested_by_name VARCHAR(255),
          requested_by_role VARCHAR(100),
          requested_by_mobile VARCHAR(50),
          actioned_by_name VARCHAR(255),
          actioned_at TIMESTAMPTZ,
          rejection_reason TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_approval_party_status ON approval_requests(party_id, status);
        CREATE INDEX IF NOT EXISTS idx_approval_type ON approval_requests(type);
      `);

      // Check if seeded; if empty, seed realistic approval items matching specifications
      const countResult: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM approval_requests`);
      const count = countResult?.[0]?.count ?? 0;
      if (count === 0) {
        await this.seedInitialApprovals();
      }

      this.tableInitialized = true;
    } catch (err) {
      console.warn('Approvals table init note:', err);
    }
  }

  private static async seedInitialApprovals() {
    const defaultParty = (await prisma.politicalParty.findFirst({ where: { isActive: true } }))?.code || 'TDP';

    const sampleRequests: Array<{
      type: string;
      title: string;
      desc: string;
      name: string;
      role: string;
      mobile: string;
      payload: any;
    }> = [
      // 1. User Registrations
      {
        type: 'USER_REGISTRATION',
        title: 'New Cadre Registration — Polling Agent',
        desc: 'Self-registered via Mobile Gateway for Booth #104 (Kondapi)',
        name: 'Ramesh Naidu',
        role: 'POLLING_AGENT',
        mobile: '9848011221',
        payload: { area: 'Booth #104', village: 'Kondapi', idProof: 'EPIC-A109' },
      },
      {
        type: 'USER_REGISTRATION',
        title: 'New Volunteer Application — Village Ward 3',
        desc: 'Cadre volunteer enrollment request',
        name: 'K. Sunitha',
        role: 'VOLUNTEER',
        mobile: '9848011222',
        payload: { area: 'Ward 3', village: 'Ananthavaram' },
      },
      // 2. Incharge Requests
      {
        type: 'INCHARGE_APPROVAL',
        title: 'Appointment: Booth Incharge for Booth #112',
        desc: 'Proposed replacement for superannuated incharge in Booth #112',
        name: 'V. Venkatesh',
        role: 'BOOTH_PRESIDENT',
        mobile: '9848011223',
        payload: { boothNumber: '112', targetMandal: 'Kondapi', voterCount: 840 },
      },
      {
        type: 'INCHARGE_APPROVAL',
        title: 'Appointment: 100-Voter Cluster Incharge',
        desc: 'Cluster Committee lead for Section 2 (Voters 101-200)',
        name: 'M. Harish',
        role: 'VOTER_100_INCHARGE',
        mobile: '9848011224',
        payload: { clusterRange: '101-200', booth: '#108' },
      },
      // 3. Data Corrections
      {
        type: 'DATA_CORRECTION',
        title: 'Voter Status Update: EPIC WDX2910384 to MIGRATED',
        desc: 'Voter permanently shifted to Hyderabad for employment; request status update to Migrated Outreach',
        name: 'S. Prasad (Booth Incharge #14)',
        role: 'BOOTH_PRESIDENT',
        mobile: '9848010002',
        payload: { epicNumber: 'WDX2910384', previousStatus: 'ACTIVE', newStatus: 'MIGRATED', city: 'Hyderabad' },
      },
      {
        type: 'DATA_CORRECTION',
        title: 'Voter Family Relation Correction: EPIC WDX1029381',
        desc: 'Relation updated from Father to Husband as per latest electoral roll revision',
        name: 'L. Nageswara Rao',
        role: 'VOTER_100_INCHARGE',
        mobile: '9848010003',
        payload: { epicNumber: 'WDX1029381', field: 'relationType', from: 'FATHER', to: 'HUSBAND' },
      },
      // 4. Survey Approvals
      {
        type: 'SURVEY_APPROVAL',
        title: 'Batch Survey Submission: Booth #105 (48 Verified)',
        desc: 'Door-to-door ground sentiment and scheme beneficiary survey completed',
        name: 'P. Anjaneyulu',
        role: 'VOTER_100_INCHARGE',
        mobile: '9848010004',
        payload: { completedSurveys: 48, favorableCount: 39, neutralCount: 7, schemesChecked: 3 },
      },
      {
        type: 'SURVEY_APPROVAL',
        title: 'Batch Survey Submission: Booth #108 (35 Verified)',
        desc: 'Local community feedback survey report ready for sign-off',
        name: 'T. Rama Rao',
        role: 'BOOTH_PRESIDENT',
        mobile: '9848010002',
        payload: { completedSurveys: 35, favorableCount: 28, neutralCount: 5 },
      },
      // 5. Transfer Approvals
      {
        type: 'TRANSFER_APPROVAL',
        title: 'Incharge Transfer: Move from Booth #101 to Booth #106',
        desc: 'Cadre relocation due to residential transfer in Kondapi Mandal',
        name: 'Ch. Srinivas',
        role: 'BOOTH_PRESIDENT',
        mobile: '9848011225',
        payload: { fromBooth: '101', toBooth: '106', mandal: 'Kondapi' },
      },
    ];

    for (const item of sampleRequests) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO approval_requests (party_id, type, status, title, description, payload, requested_by_name, requested_by_role, requested_by_mobile, created_at, updated_at)
         VALUES ($1, $2, 'PENDING', $3, $4, $5::jsonb, $6, $7, $8, NOW(), NOW())`,
        defaultParty,
        item.type,
        item.title,
        item.desc,
        JSON.stringify(item.payload),
        item.name,
        item.role,
        item.mobile
      );
    }
  }

  static async getApprovals(query: {
    partyId?: string;
    type?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    await this.ensureTable();
    const conditions: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    if (query.partyId && query.partyId !== 'all') {
      conditions.push(`(party_id = $${pIdx} OR party_id IS NULL)`);
      params.push(query.partyId);
      pIdx++;
    }

    if (query.type && query.type !== 'ALL') {
      conditions.push(`type = $${pIdx}`);
      params.push(query.type);
      pIdx++;
    }

    if (query.status && query.status !== 'ALL') {
      conditions.push(`status = $${pIdx}`);
      params.push(query.status);
      pIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(query.limit || 50, 100);
    const offset = query.offset || 0;

    const countQuery = `SELECT COUNT(*)::int as total FROM approval_requests ${whereClause}`;
    const dataQuery = `
      SELECT id, party_id as "partyId", type, status, title, description, entity_id as "entityId",
             entity_type as "entityType", payload, requested_by_name as "requestedByName",
             requested_by_role as "requestedByRole", requested_by_mobile as "requestedByMobile",
             actioned_by_name as "actionedByName", actioned_at as "actionedAt",
             rejection_reason as "rejectionReason", created_at as "createdAt", updated_at as "updatedAt"
      FROM approval_requests
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const [totalRes, items] = (await Promise.all([
      prisma.$queryRawUnsafe(countQuery, ...params),
      prisma.$queryRawUnsafe(dataQuery, ...params),
    ])) as [any[], any[]];

    return {
      total: totalRes?.[0]?.total || 0,
      items: items || [],
      limit,
      offset,
    };
  }

  static async getStats(partyId?: string) {
    await this.ensureTable();
    const filter = partyId && partyId !== 'all' ? `WHERE (party_id = '${partyId}' OR party_id IS NULL)` : '';

    const stats: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'PENDING')::int as "totalPending",
        COUNT(*) FILTER (WHERE status = 'APPROVED')::int as "totalApproved",
        COUNT(*) FILTER (WHERE status = 'REJECTED')::int as "totalRejected",
        COUNT(*) FILTER (WHERE status = 'PENDING' AND type = 'USER_REGISTRATION')::int as "userRegistrations",
        COUNT(*) FILTER (WHERE status = 'PENDING' AND type = 'INCHARGE_APPROVAL')::int as "inchargeRequests",
        COUNT(*) FILTER (WHERE status = 'PENDING' AND type = 'DATA_CORRECTION')::int as "dataCorrections",
        COUNT(*) FILTER (WHERE status = 'PENDING' AND type = 'SURVEY_APPROVAL')::int as "surveyApprovals",
        COUNT(*) FILTER (WHERE status = 'PENDING' AND type = 'TRANSFER_APPROVAL')::int as "transferApprovals"
      FROM approval_requests
      ${filter}
    `);

    return (
      stats?.[0] || {
        totalPending: 0,
        totalApproved: 0,
        totalRejected: 0,
        userRegistrations: 0,
        inchargeRequests: 0,
        dataCorrections: 0,
        surveyApprovals: 0,
        transferApprovals: 0,
      }
    );
  }

  static async createApproval(data: CreateApprovalDto) {
    await this.ensureTable();
    const rows: any[] = await prisma.$queryRawUnsafe(
      `INSERT INTO approval_requests (party_id, type, status, title, description, entity_id, entity_type, payload, requested_by_name, requested_by_role, requested_by_mobile, created_at, updated_at)
       VALUES ($1, $2, 'PENDING', $3, $4, $5, $6, $7::jsonb, $8, $9, $10, NOW(), NOW())
       RETURNING id, type, status, title, created_at as "createdAt"`,
      data.partyId || 'TDP',
      data.type,
      data.title,
      data.description || null,
      data.entityId || null,
      data.entityType || null,
      JSON.stringify(data.payload || {}),
      data.requestedByName || 'In-Charge',
      data.requestedByRole || 'VOTER_100_INCHARGE',
      data.requestedByMobile || ''
    );
    return rows?.[0];
  }

  static async approve(id: string, actionedBy: string = 'Party Super Admin') {
    await this.ensureTable();
    const rows: any[] = await prisma.$queryRawUnsafe(
      `UPDATE approval_requests 
       SET status = 'APPROVED', actioned_by_name = $1, actioned_at = NOW(), updated_at = NOW()
       WHERE id = $2::uuid
       RETURNING id, status, actioned_by_name as "actionedByName", actioned_at as "actionedAt"`,
      actionedBy,
      id
    );
    if (!rows || rows.length === 0) {
      throw new Error(`Approval request with ID ${id} not found.`);
    }
    return rows[0];
  }

  static async reject(id: string, reason: string, actionedBy: string = 'Party Super Admin') {
    await this.ensureTable();
    const rows: any[] = await prisma.$queryRawUnsafe(
      `UPDATE approval_requests 
       SET status = 'REJECTED', rejection_reason = $1, actioned_by_name = $2, actioned_at = NOW(), updated_at = NOW()
       WHERE id = $3::uuid
       RETURNING id, status, rejection_reason as "rejectionReason", actioned_by_name as "actionedByName", actioned_at as "actionedAt"`,
      reason,
      actionedBy,
      id
    );
    if (!rows || rows.length === 0) {
      throw new Error(`Approval request with ID ${id} not found.`);
    }
    return rows[0];
  }
}
