import { prisma } from '../../lib/prisma.js';
import { CreateApprovalDto } from './approvals.schema.js';
import { Prisma } from '@prisma/client';

export interface ApprovalRecord {
  id: string;
  partyId?: string | null;
  type: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  title: string;
  description?: string | null;
  entityId?: string | null;
  entityType?: string | null;
  payload: Record<string, any>;
  requestedByName?: string | null;
  requestedByRole?: string | null;
  requestedByMobile?: string | null;
  actionedByName?: string | null;
  actionedAt?: Date | string | null;
  rejectionReason?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export class ApprovalsService {
  static async getApprovals(query: {
    partyId?: string;
    type?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: Prisma.ApprovalRequestWhereInput = {};

    if (query.partyId && query.partyId !== 'all') {
      where.OR = [
        { partyId: query.partyId },
        { partyId: null },
      ];
    }

    if (query.type && query.type !== 'ALL') {
      if (query.type === 'INCHARGE_REQUEST') {
        where.type = { in: ['INCHARGE_REQUEST', 'INCHARGE_APPROVAL', 'TRANSFER_APPROVAL', 'TRANSFER_REQUEST'] };
      } else {
        where.type = query.type;
      }
    }

    if (query.status && query.status !== 'ALL') {
      where.status = query.status;
    }

    const limit = Math.min(query.limit || 50, 100);
    const offset = query.offset || 0;

    const [total, items] = await Promise.all([
      prisma.approvalRequest.count({ where }),
      prisma.approvalRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
    ]);

    return {
      total,
      items: items.map((item) => ({
        id: item.id,
        partyId: item.partyId,
        type: item.type,
        status: item.status as 'PENDING' | 'APPROVED' | 'REJECTED',
        title: item.title,
        description: item.description,
        entityId: item.entityId,
        entityType: item.entityType,
        payload: (item.payload as Record<string, any>) || {},
        requestedByName: item.requestedByName || 'Incharge',
        requestedByRole: item.requestedByRole || 'CADRE',
        requestedByMobile: item.requestedByMobile || '',
        actionedByName: item.actionedByName,
        actionedAt: item.actionedAt,
        rejectionReason: item.rejectionReason,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      limit,
      offset,
    };
  }

  static async getStats(partyId?: string) {
    const where: Prisma.ApprovalRequestWhereInput = {};
    if (partyId && partyId !== 'all') {
      where.OR = [{ partyId }, { partyId: null }];
    }

    const all = await prisma.approvalRequest.findMany({
      where,
      select: { type: true, status: true },
    });

    const totalPending = all.filter((a) => a.status === 'PENDING').length;
    const totalApproved = all.filter((a) => a.status === 'APPROVED').length;
    const totalRejected = all.filter((a) => a.status === 'REJECTED').length;

    const userRegistrations = all.filter((a) => a.status === 'PENDING' && a.type === 'USER_REGISTRATION').length;
    const inchargeRequests = all.filter(
      (a) =>
        a.status === 'PENDING' &&
        (a.type === 'INCHARGE_REQUEST' || a.type === 'INCHARGE_APPROVAL' || a.type === 'TRANSFER_APPROVAL' || a.type === 'TRANSFER_REQUEST')
    ).length;
    const dataCorrections = all.filter((a) => a.status === 'PENDING' && a.type === 'DATA_CORRECTION').length;
    const surveyApprovals = all.filter((a) => a.status === 'PENDING' && a.type === 'SURVEY_APPROVAL').length;
    const transferApprovals = all.filter(
      (a) => a.status === 'PENDING' && (a.type === 'TRANSFER_APPROVAL' || a.type === 'TRANSFER_REQUEST')
    ).length;

    return {
      totalPending,
      totalApproved,
      totalRejected,
      userRegistrations,
      inchargeRequests,
      dataCorrections,
      surveyApprovals,
      transferApprovals,
    };
  }

  static async createApproval(data: CreateApprovalDto) {
    const created = await prisma.approvalRequest.create({
      data: {
        partyId: data.partyId || 'SDS',
        type: data.type,
        title: data.title,
        description: data.description || null,
        entityId: data.entityId || null,
        entityType: data.entityType || null,
        payload: (data.payload as Prisma.InputJsonValue) || {},
        requestedByName: data.requestedByName || 'In-Charge',
        requestedByRole: data.requestedByRole || 'VOTER_100_INCHARGE',
        requestedByMobile: data.requestedByMobile || '',
        status: 'PENDING',
      },
    });

    return created;
  }

  static async approve(id: string, actionedBy: string = 'Party Super Admin') {
    return prisma.$transaction(async (tx) => {
      const request = await tx.approvalRequest.findUnique({ where: { id } });
      if (!request) {
        throw new Error(`Approval request with ID '${id}' not found.`);
      }
      if (request.status !== 'PENDING') {
        throw new Error(`Approval request has already been ${request.status.toLowerCase()}.`);
      }

      const payload = (request.payload as Record<string, any>) || {};

      // Outbound Execution Dispatcher based on Type
      switch (request.type) {
        case 'USER_REGISTRATION': {
          const userId = request.entityId || payload.userId;
          if (userId) {
            await tx.user.updateMany({
              where: { id: userId },
              data: { accountStatus: 'ACTIVE', isVerified: true },
            });
          } else {
            const mobile = payload.mobileNumber || request.requestedByMobile;
            if (mobile) {
              const existing = await tx.user.findFirst({
                where: { mobileNumber: mobile },
              });
              if (existing) {
                await tx.user.update({
                  where: { id: existing.id },
                  data: { accountStatus: 'ACTIVE', isVerified: true },
                });
              } else {
                let organisationId = request.partyId || payload.organisationId;
                if (!organisationId) {
                  const defaultOrg = await tx.organisation.findFirst({ select: { id: true } });
                  organisationId = defaultOrg?.id;
                }
                if (organisationId) {
                  const role = (payload.role || request.requestedByRole || 'BOOTH_INCHARGE').toUpperCase();
                  await tx.user.create({
                    data: {
                      userCode: `CADRE-${mobile.slice(-4)}-${Date.now().toString().slice(-4)}`,
                      mobileNumber: mobile,
                      name: payload.name || request.requestedByName || 'Cadre Member',
                      role: role as any,
                      organisationId,
                      accountStatus: 'ACTIVE',
                      isVerified: true,
                    },
                  });
                }
              }
            }
          }
          break;
        }

        case 'INCHARGE_APPROVAL':
        case 'INCHARGE_REQUEST':
        case 'TRANSFER_APPROVAL':
        case 'TRANSFER_REQUEST': {
          const assignmentId = payload.assignmentId || request.entityId;
          const newUnitLevel = (payload.newUnitLevel || payload.targetLevel || '').toUpperCase();
          const newUnitId = payload.newUnitId || payload.targetJurisdictionId || payload.unitId;

          if (assignmentId && newUnitLevel && newUnitId) {
            const updateData: any = {
              stateId: null,
              zoneId: null,
              parliamentId: null,
              constituencyId: null,
              mandalId: null,
              villageId: null,
              boothId: null,
              voterGroupId: null,
              assignedAt: new Date(),
            };

            switch (newUnitLevel) {
              case 'STATE': updateData.stateId = newUnitId; break;
              case 'ZONE': updateData.zoneId = newUnitId; break;
              case 'PARLIAMENT': updateData.parliamentId = newUnitId; break;
              case 'CONSTITUENCY': updateData.constituencyId = newUnitId; break;
              case 'MANDAL': updateData.mandalId = newUnitId; break;
              case 'VILLAGE': updateData.villageId = newUnitId; break;
              case 'BOOTH': updateData.boothId = newUnitId; break;
              case 'VOTER_GROUP': updateData.voterGroupId = newUnitId; break;
            }

            await tx.userHierarchyAssignment.updateMany({
              where: { id: assignmentId },
              data: updateData,
            });
          }
          break;
        }

        case 'DATA_CORRECTION': {
          const voterId = payload.voterId || request.entityId;
          const updates = payload.updates || payload.data || {};
          if (voterId && Object.keys(updates).length > 0) {
            const existingVoter = await tx.voter.findUnique({
              where: { id: voterId },
              select: { id: true, voterStatus: true },
            });
            if (existingVoter) {
              await tx.voter.update({
                where: { id: voterId },
                data: updates,
              });

              if (updates.voterStatus && updates.voterStatus !== existingVoter.voterStatus) {
                await tx.voterStatusHistory.create({
                  data: {
                    voterId,
                    previousStatus: existingVoter.voterStatus,
                    newStatus: updates.voterStatus,
                    reason: `Approved via Central Approval Engine: ${request.title}`,
                  },
                });
              }
            }
          }
          break;
        }

        case 'SURVEY_APPROVAL': {
          const voterIds = payload.voterIds;
          if (Array.isArray(voterIds) && voterIds.length > 0) {
            await tx.voter.updateMany({
              where: { id: { in: voterIds } },
              data: { surveyStatus: 'VERIFIED' },
            });
          }
          break;
        }
      }

      // Update approval request status
      const updated = await tx.approvalRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          actionedByName: actionedBy,
          actionedAt: new Date(),
        },
      });

      return updated;
    });
  }

  static async reject(id: string, reason: string, actionedBy: string = 'Party Super Admin') {
    return prisma.$transaction(async (tx) => {
      const request = await tx.approvalRequest.findUnique({ where: { id } });
      if (!request) {
        throw new Error(`Approval request with ID '${id}' not found.`);
      }
      if (request.status !== 'PENDING') {
        throw new Error(`Approval request has already been ${request.status.toLowerCase()}.`);
      }

      if (request.type === 'USER_REGISTRATION') {
        const userId = request.entityId || (request.payload as any)?.userId;
        if (userId) {
          await tx.user.updateMany({
            where: { id: userId, accountStatus: 'PENDING' },
            data: { accountStatus: 'SUSPENDED' },
          });
        }
      }

      const updated = await tx.approvalRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectionReason: reason,
          actionedByName: actionedBy,
          actionedAt: new Date(),
        },
      });

      return updated;
    });
  }
}
