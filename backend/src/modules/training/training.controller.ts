import { FastifyReply, FastifyRequest } from 'fastify';
import { successResponse } from '../../common/response.js';
import { TrainingService } from './training.service.js';

export class TrainingController {
  static async listVideos(_req: FastifyRequest, reply: FastifyReply) {
    const items = await TrainingService.listVideos();
    return reply.send(successResponse(items));
  }

  static async createVideo(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as any;
    const item = await TrainingService.createVideo(body, req.user!.userId);
    return reply.status(201).send(successResponse(item, 'Training video created'));
  }

  static async updateVideo(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    const body = req.body as any;
    const item = await TrainingService.updateVideo(params.id, body, req.user!.userId);
    return reply.send(successResponse(item, 'Training video updated'));
  }

  static async deleteVideo(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    const item = await TrainingService.deleteVideo(params.id, req.user!.userId);
    return reply.send(successResponse(item, 'Training video deleted'));
  }

  static async assignVideo(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    const body = req.body as any;
    const result = await TrainingService.assignVideo(params.id, body, req.user!.userId);
    return reply.send(successResponse(result, 'Training video assigned'));
  }

  static async updateProgress(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    const body = req.body as any;
    const progress = await TrainingService.updateProgress(params.id, req.user!.userId, body);
    return reply.send(successResponse(progress, 'Training progress updated'));
  }

  static async getAnalytics(req: FastifyRequest, reply: FastifyReply) {
    const data = await TrainingService.getTrainingAnalytics(req.hierarchyScope?.accessibleUnitIds);
    return reply.send(successResponse(data));
  }
}
