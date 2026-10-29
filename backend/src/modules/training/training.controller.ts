import { FastifyReply, FastifyRequest } from 'fastify';
import { successResponse } from '../../common/response.js';
import { TrainingService } from './training.service.js';

export class TrainingController {
  static async listVideos(req: FastifyRequest, reply: FastifyReply) {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const items = await TrainingService.listVideos(req.user?.organisationId, isSuperAdmin);
    return reply.send(successResponse(items));
  }

  static async createVideo(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as any;
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const item = await TrainingService.createVideo(body, req.user!.userId, req.user?.organisationId, isSuperAdmin);
    return reply.status(201).send(successResponse(item, 'Training video created'));
  }

  static async updateVideo(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    const body = req.body as any;
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const item = await TrainingService.updateVideo(params.id, body, req.user!.userId, req.user?.organisationId, isSuperAdmin);
    return reply.send(successResponse(item, 'Training video updated'));
  }

  static async deleteVideo(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const item = await TrainingService.deleteVideo(params.id, req.user!.userId, req.user?.organisationId, isSuperAdmin);
    return reply.send(successResponse(item, 'Training video deleted'));
  }

  static async assignVideo(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    const body = req.body as any;
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const result = await TrainingService.assignVideo(params.id, body, req.user!.userId, req.user?.organisationId, isSuperAdmin);
    return reply.send(successResponse(result, 'Training video assigned'));
  }

  static async updateProgress(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    const body = req.body as any;
    const progress = await TrainingService.updateProgress(params.id, req.user!.userId, body);
    return reply.send(successResponse(progress, 'Training progress updated'));
  }

  static async getAnalytics(req: FastifyRequest, reply: FastifyReply) {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const data = await TrainingService.getTrainingAnalytics(
      req.hierarchyScope?.accessibleUnitIds,
      req.user?.organisationId,
      isSuperAdmin
    );
    return reply.send(successResponse(data));
  }

  static async listProgress(req: FastifyRequest, reply: FastifyReply) {
    const query = req.query as { userId?: string };
    const targetUserId = query.userId || req.user?.userId;
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const items = await TrainingService.listProgress(targetUserId, req.user?.organisationId, isSuperAdmin);
    return reply.send(successResponse(items));
  }

  static async listProgressForUnit(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { unitId: string };
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const items = await TrainingService.listProgressForUnit(params.unitId, req.user?.organisationId, isSuperAdmin);
    return reply.send(successResponse(items));
  }

  static async ensureAssigned(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as { userId?: string; videoId: string };
    const targetUserId = body.userId || req.user!.userId;
    const item = await TrainingService.ensureAssigned(targetUserId, body.videoId, req.user!.userId);
    return reply.send(successResponse(item));
  }
}
