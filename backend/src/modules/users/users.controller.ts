import { FastifyReply, FastifyRequest } from 'fastify';
import { paginatedResponse, successResponse } from '../../common/response.js';
import { assertRoleHierarchy, assertUnitAccess, assertUserScope } from '../../middleware/rbac.js';
import { UsersService } from './users.service.js';

export class UsersController {
  static async listUsers(req: FastifyRequest, reply: FastifyReply) {
    const query = req.query as any;
    if (query?.unitId && !assertUnitAccess(req, reply, query.unitId)) return;

    const result = await UsersService.listUsers(query, req.hierarchyScope?.accessibleUnitIds);
    return reply.status(200).send(paginatedResponse(result.items, result.total, result.page, result.limit));
  }

  static async getUser(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    const user = await UsersService.getUserById(params.id);
    if (!assertUnitAccess(req, reply, user.unitId)) return;
    return reply.status(200).send(successResponse(user));
  }

  static async createUser(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as any;
    if (body?.unitId && !assertUnitAccess(req, reply, body.unitId)) return;
    if (body?.role && !assertRoleHierarchy(req.user!.role, body.role)) {
      return reply.status(403).send({ success: false, error: { code: 'VERTICAL_PRIVILEGE_VIOLATION', message: `Cannot create user with role (${body.role}) higher than or equal to your own.` } });
    }
    const user = await UsersService.createUser(body, req.user!.userId);
    return reply.status(201).send(successResponse(user, 'User created successfully'));
  }

  static async updateUser(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    const body = req.body as any;
    if (!(await assertUserScope(req, reply, params.id, body?.role))) return;
    if (body?.unitId && !assertUnitAccess(req, reply, body.unitId)) return;

    const user = await UsersService.updateUser(params.id, body, req.user!.userId);
    return reply.status(200).send(successResponse(user, 'User updated successfully'));
  }

  static async updateUserStatus(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    const body = req.body as any;
    if (!(await assertUserScope(req, reply, params.id))) return;

    const user = await UsersService.updateUserStatus(params.id, body, req.user!.userId);
    return reply.status(200).send(successResponse(user, 'User status updated successfully'));
  }

  static async deleteUser(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    if (!(await assertUserScope(req, reply, params.id))) return;

    const result = await UsersService.deleteUser(params.id, req.user!.userId);
    return reply.status(200).send(successResponse(result, 'User deleted successfully'));
  }
}
