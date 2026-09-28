import { FastifyReply, FastifyRequest } from 'fastify';
import { TaskStatus } from '@prisma/client';
import { successResponse } from '../../common/response.js';
import { TasksService } from './tasks.service.js';

export class TasksController {
  static async listTasks(req: FastifyRequest, reply: FastifyReply) {
    const query = req.query as any;
    const items = await TasksService.listTasks(query, req.hierarchyScope);
    return reply.send(successResponse(items));
  }

  static async getTask(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    const task = await TasksService.getTaskById(params.id, req.hierarchyScope, req.user?.userId);
    return reply.send(successResponse(task));
  }

  static async createTask(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as any;
    const task = await TasksService.createTask(body, req.user!.userId, req.hierarchyScope);
    return reply.status(201).send(successResponse(task, 'Task created'));
  }

  static async updateTask(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    const body = req.body as any;
    const task = await TasksService.updateTask(params.id, body, req.user!.userId, req.hierarchyScope);
    return reply.send(successResponse(task, 'Task updated'));
  }

  static async assignTask(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    const body = req.body as { userIds: string[] };
    const result = await TasksService.assignTask(params.id, body.userIds, req.user!.userId, req.hierarchyScope);
    return reply.send(successResponse(result, 'Task assigned'));
  }

  static async updateTaskStatus(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    const body = req.body as { status: TaskStatus; comments?: string };
    const task = await TasksService.updateTaskStatus(params.id, body.status, body.comments, req.user!.userId, req.hierarchyScope);
    return reply.send(successResponse(task, 'Task status updated'));
  }

  static async completeTask(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    const task = await TasksService.updateTaskStatus(params.id, TaskStatus.COMPLETED, 'Marked completed', req.user!.userId, req.hierarchyScope);
    return reply.send(successResponse(task, 'Task completed'));
  }
}
