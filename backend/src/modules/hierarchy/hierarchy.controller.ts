import { FastifyReply, FastifyRequest } from 'fastify';
import { successResponse } from '../../common/response.js';
import { HierarchyService } from './hierarchy.service.js';

export class HierarchyController {
  static async getStates(_req: FastifyRequest, reply: FastifyReply) {
    const items = await HierarchyService.getStates();
    return reply.send(successResponse(items));
  }

  static async createState(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as any;
    const item = await HierarchyService.createState(body, req.user!.userId);
    return reply.status(201).send(successResponse(item, 'State created'));
  }

  static async getZones(req: FastifyRequest, reply: FastifyReply) {
    const query = req.query as any;
    const items = await HierarchyService.getZones(query?.stateId);
    return reply.send(successResponse(items));
  }

  static async createZone(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as any;
    const item = await HierarchyService.createZone(body, req.user!.userId);
    return reply.status(201).send(successResponse(item, 'Zone created'));
  }

  static async getParliaments(req: FastifyRequest, reply: FastifyReply) {
    const query = req.query as any;
    const items = await HierarchyService.getParliaments(query?.zoneId);
    return reply.send(successResponse(items));
  }

  static async createParliament(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as any;
    const item = await HierarchyService.createParliament(body, req.user!.userId);
    return reply.status(201).send(successResponse(item, 'Parliament created'));
  }

  static async getConstituencies(req: FastifyRequest, reply: FastifyReply) {
    const query = req.query as any;
    const items = await HierarchyService.getConstituencies(query?.parliamentId);
    return reply.send(successResponse(items));
  }

  static async createConstituency(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as any;
    const item = await HierarchyService.createConstituency(body, req.user!.userId);
    return reply.status(201).send(successResponse(item, 'Constituency created'));
  }

  static async getMandals(req: FastifyRequest, reply: FastifyReply) {
    const query = req.query as any;
    const items = await HierarchyService.getMandals(query?.constituencyId);
    return reply.send(successResponse(items));
  }

  static async createMandal(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as any;
    const item = await HierarchyService.createMandal(body, req.user!.userId);
    return reply.status(201).send(successResponse(item, 'Mandal created'));
  }

  static async getVillages(req: FastifyRequest, reply: FastifyReply) {
    const query = req.query as any;
    const items = await HierarchyService.getVillages(query?.mandalId);
    return reply.send(successResponse(items));
  }

  static async createVillage(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as any;
    const item = await HierarchyService.createVillage(body, req.user!.userId);
    return reply.status(201).send(successResponse(item, 'Village created'));
  }

  static async getBooths(req: FastifyRequest, reply: FastifyReply) {
    const query = req.query as any;
    const items = await HierarchyService.getBooths(query?.villageId);
    return reply.send(successResponse(items));
  }

  static async createBooth(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as any;
    const item = await HierarchyService.createBooth(body, req.user!.userId);
    return reply.status(201).send(successResponse(item, 'Booth created'));
  }

  static async getVoterIncharges(req: FastifyRequest, reply: FastifyReply) {
    const query = req.query as any;
    const items = await HierarchyService.getVoterIncharges(query?.boothId);
    return reply.send(successResponse(items));
  }

  static async createVoterIncharge(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as any;
    const item = await HierarchyService.createVoterIncharge(body, req.user!.userId);
    return reply.status(201).send(successResponse(item, '100-Voter Cluster created'));
  }
}
