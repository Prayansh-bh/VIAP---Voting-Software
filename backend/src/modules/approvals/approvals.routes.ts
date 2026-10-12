import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { successResponse, errorResponse } from '../../common/response.js';
import { validateBody } from '../../common/validation.js';
import { optionalAuthenticate } from '../../middleware/auth.js';
import {
  createApprovalSchema,
  rejectApprovalSchema,
  CreateApprovalDto,
} from './approvals.schema.js';
import { ApprovalsService } from './approvals.service.js';

export async function approvalsRoutes(fastify: FastifyInstance) {
  // 1. Get approval stats (Pending counts per category)
  fastify.get('/stats', { preHandler: [optionalAuthenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = (req.query || {}) as { partyId?: string };
      const stats = await ApprovalsService.getStats(query.partyId);
      return reply.send(successResponse(stats));
    } catch (err: any) {
      return reply.status(500).send(errorResponse(err.message || 'Failed to fetch approval stats'));
    }
  });

  // 2. List approvals with filters
  fastify.get('/', { preHandler: [optionalAuthenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = (req.query || {}) as {
        partyId?: string;
        type?: string;
        status?: string;
        limit?: string;
        offset?: string;
      };
      const result = await ApprovalsService.getApprovals({
        partyId: query.partyId,
        type: query.type,
        status: query.status,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
      });
      return reply.send(successResponse(result));
    } catch (err: any) {
      return reply.status(500).send(errorResponse(err.message || 'Failed to fetch approvals'));
    }
  });

  // 3. Create new approval request
  fastify.post(
    '/',
    {
      preHandler: [optionalAuthenticate],
      preValidation: [validateBody(createApprovalSchema)],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = req.body as CreateApprovalDto;
        const result = await ApprovalsService.createApproval(body);
        return reply.status(201).send(successResponse(result, 'Approval request submitted successfully'));
      } catch (err: any) {
        return reply.status(500).send(errorResponse(err.message || 'Failed to create approval request'));
      }
    }
  );

  // 4. Approve request
  const approveHandler = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = req.params as { id: string };
      const user = (req as any).user;
      const actionedBy = user?.name || user?.role || 'Party Super Admin';
      const result = await ApprovalsService.approve(id, actionedBy);
      return reply.send(successResponse(result, 'Approval request approved'));
    } catch (err: any) {
      return reply.status(400).send(errorResponse(err.message || 'Failed to approve request'));
    }
  };

  fastify.patch('/:id/approve', { preHandler: [optionalAuthenticate] }, approveHandler);
  fastify.post('/:id/approve', { preHandler: [optionalAuthenticate] }, approveHandler);

  // 5. Reject request
  const rejectHandler = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = req.params as { id: string };
      const body = (req.body || {}) as { reason?: string };
      const user = (req as any).user;
      const actionedBy = user?.name || user?.role || 'Party Super Admin';
      const result = await ApprovalsService.reject(id, body.reason || 'Rejected by Admin', actionedBy);
      return reply.send(successResponse(result, 'Approval request rejected'));
    } catch (err: any) {
      return reply.status(400).send(errorResponse(err.message || 'Failed to reject request'));
    }
  };

  fastify.patch('/:id/reject', { preHandler: [optionalAuthenticate], preValidation: [validateBody(rejectApprovalSchema)] }, rejectHandler);
  fastify.post('/:id/reject', { preHandler: [optionalAuthenticate] }, rejectHandler);
}
