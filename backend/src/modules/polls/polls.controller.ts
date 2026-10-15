import { FastifyReply, FastifyRequest } from 'fastify';
import { PollsService } from './polls.service.js';
import { createPollSchema, votePollSchema } from './polls.schema.js';
import { successResponse } from '../../common/response.js';

export class PollsController {
  static async listPolls(req: FastifyRequest, reply: FastifyReply) {
    const user = (req as any).user;
    const polls = await PollsService.listPolls(user, req.hierarchyScope);
    return reply.status(200).send(successResponse(polls));
  }

  static async createPoll(req: FastifyRequest, reply: FastifyReply) {
    const body = createPollSchema.parse(req.body);
    const user = (req as any).user;
    const poll = await PollsService.createPoll(body, user, req.hierarchyScope);
    return reply.status(201).send(successResponse(poll, 'Poll created successfully'));
  }

  static async vote(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const body = votePollSchema.parse(req.body);
    const user = (req as any).user;
    const result = await PollsService.vote(req.params.id, body, user, req.hierarchyScope);
    return reply.status(200).send(successResponse(result, 'Vote submitted successfully'));
  }

  static async closePoll(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const user = (req as any).user;
    const poll = await PollsService.closePoll(req.params.id, user, req.hierarchyScope);
    return reply.status(200).send(successResponse(poll, 'Poll closed successfully'));
  }

  static async getPoll(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const user = (req as any).user;
    const poll = await PollsService.getPollById(req.params.id, user, req.hierarchyScope);
    return reply.status(200).send(successResponse(poll));
  }

  static async updatePoll(req: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) {
    const user = (req as any).user;
    const poll = await PollsService.updatePoll(req.params.id, req.body, user, req.hierarchyScope);
    return reply.status(200).send(successResponse(poll, 'Poll updated successfully'));
  }

  static async deletePoll(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const user = (req as any).user;
    const result = await PollsService.deletePoll(req.params.id, user, req.hierarchyScope);
    const message = (result as any).softArchived ? 'Poll soft-archived to preserve votes' : 'Poll deleted successfully';
    return reply.status(200).send(successResponse(result, message));
  }
}
