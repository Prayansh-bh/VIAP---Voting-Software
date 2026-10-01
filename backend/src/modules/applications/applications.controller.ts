import { FastifyReply, FastifyRequest } from 'fastify';
import { errorResponse, successResponse } from '../../common/response.js';
import { ApplicationsService } from './applications.service.js';

export class ApplicationsController {
  static async getApplications(_req: FastifyRequest, reply: FastifyReply) {
    const data = await ApplicationsService.getApplications();
    return reply.send(successResponse(data));
  }

  static async getConfiguration(req: FastifyRequest, reply: FastifyReply) {
    const { applicationId } = req.params as { applicationId: string };
    const data = await ApplicationsService.getConfiguration(applicationId);
    return reply.send(successResponse(data));
  }

  static async getHierarchy(req: FastifyRequest, reply: FastifyReply) {
    const { applicationId } = req.params as { applicationId: string };
    const data = await ApplicationsService.getHierarchy(applicationId);
    return reply.send(successResponse(data));
  }

  static async getHierarchyNodes(req: FastifyRequest, reply: FastifyReply) {
    const { applicationId, level } = req.params as { applicationId: string; level: string };
    const query = req.query as { parentId?: string };
    const data = await ApplicationsService.getHierarchyNodesByLevel(applicationId, level, query?.parentId);
    return reply.send(successResponse(data));
  }

  static async getConstituencies(req: FastifyRequest, reply: FastifyReply) {
    const { applicationId } = req.params as { applicationId: string };
    const query = req.query as { stateId?: string; zoneId?: string; parliamentId?: string };
    const data = await ApplicationsService.getConstituencies(applicationId, query);
    return reply.send(successResponse(data));
  }

  static async getConstituencyDetail(req: FastifyRequest, reply: FastifyReply) {
    const { applicationId, id } = req.params as { applicationId: string; id: string };
    const data = await ApplicationsService.getConstituencyDetail(applicationId, id);
    return reply.send(successResponse(data));
  }

  static async suggestColumnMapping(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as { headers: string[] };
    const data = ApplicationsService.suggestColumnMapping(body.headers || []);
    return reply.send(successResponse(data));
  }

  static async validateData(req: FastifyRequest, reply: FastifyReply) {
    const { applicationId } = req.params as { applicationId: string };
    const body = req.body as {
      level?: string;
      rows: any[];
      targetConstituencyId?: string;
      columnMapping?: Record<string, string>;
      fileName?: string;
    };
    const result = await ApplicationsService.validateData(applicationId, body.level || 'VOTER', body.rows, {
      targetConstituencyId: body.targetConstituencyId,
      columnMapping: body.columnMapping,
      fileName: body.fileName,
    });
    return reply.send(successResponse(result, 'Data validation report generated successfully'));
  }

  static async importData(req: FastifyRequest, reply: FastifyReply) {
    const { applicationId } = req.params as { applicationId: string };
    const body = req.body as {
      level?: string;
      rows: any[];
      targetConstituencyId?: string;
      columnMapping?: Record<string, string>;
      importMode?: 'APPEND' | 'REPLACE';
      voterGroupSize?: number;
      fileName?: string;
      fileSize?: number;
    };
    const actorId = req.user?.userId;

    try {
      const result = await ApplicationsService.importData(
        applicationId,
        body.level || 'VOTER',
        body.rows,
        {
          targetConstituencyId: body.targetConstituencyId,
          columnMapping: body.columnMapping,
          importMode: body.importMode,
          voterGroupSize: body.voterGroupSize,
          fileName: body.fileName,
          fileSize: body.fileSize,
        },
        actorId,
        req.hierarchyScope,
      );
      return reply.status(201).send(successResponse(result, 'Data successfully imported and committed to hierarchy'));
    } catch (err: any) {
      const statusCode = err.statusCode || 500;
      return reply.status(statusCode).send(errorResponse(err.message || 'Import failed', err.code || 'IMPORT_FAILED', err.data));
    }
  }

  static async getDataImports(req: FastifyRequest, reply: FastifyReply) {
    const { applicationId } = req.params as { applicationId: string };
    const query = req.query as {
      status?: string;
      constituencyId?: string;
      startDate?: string;
      endDate?: string;
      page?: string;
      limit?: string;
    };
    const data = await ApplicationsService.getDataImports(applicationId, {
      status: query?.status,
      constituencyId: query?.constituencyId,
      startDate: query?.startDate,
      endDate: query?.endDate,
      page: query?.page ? parseInt(query.page, 10) : 1,
      limit: query?.limit ? parseInt(query.limit, 10) : 20,
    }, req.hierarchyScope);
    return reply.send(successResponse(data));
  }

  static async getDataImportById(req: FastifyRequest, reply: FastifyReply) {
    const { applicationId, importId } = req.params as { applicationId?: string; importId: string };
    const data = await ApplicationsService.getDataImportById(importId, applicationId, req.hierarchyScope, req.user?.userId);
    return reply.send(successResponse(data));
  }

  static async getDataImportErrors(req: FastifyRequest, reply: FastifyReply) {
    const { applicationId, importId, jobId } = req.params as { applicationId?: string; importId?: string; jobId?: string };
    const id = importId || jobId;
    if (!id) {
      return reply.status(400).send({ success: false, error: { message: 'Import ID is required' } });
    }
    const data = await ApplicationsService.getDataImportErrors(id, applicationId, req.hierarchyScope, req.user?.userId);
    return reply.send(successResponse(data));
  }

  static async downloadErrorReport(req: FastifyRequest, reply: FastifyReply) {
    const { applicationId, importId, jobId } = req.params as { applicationId?: string; importId?: string; jobId?: string };
    const id = importId || jobId;
    if (!id) {
      return reply.status(400).send({ success: false, error: { message: 'Import ID is required' } });
    }
    const csv = await ApplicationsService.downloadErrorReport(id, applicationId, req.hierarchyScope, req.user?.userId);
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="import_errors_${id}.csv"`);
    return reply.send(csv);
  }

  static async getImportHistory(req: FastifyRequest, reply: FastifyReply) {
    const { applicationId } = req.params as { applicationId: string };
    const data = await ApplicationsService.getImportHistory(applicationId, req.hierarchyScope);
    return reply.send(successResponse(data));
  }

  static async getImportJobErrors(req: FastifyRequest, reply: FastifyReply) {
    const { jobId } = req.params as { jobId: string };
    const data = await ApplicationsService.getImportJobErrors(jobId, undefined, req.hierarchyScope, req.user?.userId);
    return reply.send(successResponse(data));
  }

  static async getIncharges(req: FastifyRequest, reply: FastifyReply) {
    const { applicationId } = req.params as { applicationId: string };
    const query = req.query as { level?: string; jurisdictionId?: string; page?: string; limit?: string };
    const page = query?.page ? parseInt(query.page, 10) : undefined;
    const limit = query?.limit ? parseInt(query.limit, 10) : undefined;
    const data = await ApplicationsService.getIncharges(
      applicationId,
      query?.level,
      query?.jurisdictionId,
      req.hierarchyScope,
      page || limit ? { page, limit } : undefined
    );
    return reply.send(successResponse(data));
  }

  static async assignIncharge(req: FastifyRequest, reply: FastifyReply) {
    const { applicationId } = req.params as { applicationId: string };
    const body = req.body as any;
    const actor = req.user;
    const scope = req.hierarchyScope;
    const data = await ApplicationsService.assignIncharge(applicationId, body, actor, scope);
    return reply.status(201).send(successResponse(data, 'Incharge successfully assigned to jurisdiction'));
  }

  static async deleteIncharge(req: FastifyRequest, reply: FastifyReply) {
    const { applicationId, id } = req.params as { applicationId: string; id: string };
    const actor = req.user;
    const scope = req.hierarchyScope;
    const data = await ApplicationsService.deleteIncharge(applicationId, id, actor, scope);
    return reply.send(successResponse(data, 'Incharge assignment successfully revoked'));
  }

  static async transferIncharge(req: FastifyRequest, reply: FastifyReply) {
    const { applicationId, id } = req.params as { applicationId: string; id: string };
    const body = (req.body || {}) as { targetUnitLevel: string; targetUnitId: string; reason?: string };
    const data = await ApplicationsService.transferIncharge(
      applicationId,
      id,
      body.targetUnitLevel,
      body.targetUnitId,
      body.reason,
      req.user
    );
    return reply.send(successResponse(data, 'Incharge jurisdiction transferred successfully'));
  }

  static async replaceIncharge(req: FastifyRequest, reply: FastifyReply) {
    const { applicationId, id } = req.params as { applicationId: string; id: string };
    const body = (req.body || {}) as { name: string; mobileNumber: string; email?: string; reason?: string };
    const data = await ApplicationsService.replaceIncharge(applicationId, id, body, req.user);
    return reply.status(201).send(successResponse(data, 'Incharge replaced successfully'));
  }

  static async updateInchargeStatus(req: FastifyRequest, reply: FastifyReply) {
    const { applicationId, id } = req.params as { applicationId: string; id: string };
    const body = (req.body || {}) as { isActive: boolean };
    const data = await ApplicationsService.updateInchargeStatus(applicationId, id, Boolean(body.isActive), req.user);
    return reply.send(successResponse(data, `Incharge status updated to ${body.isActive ? 'ACTIVE' : 'INACTIVE'}`));
  }

  static async resetCredentials(req: FastifyRequest, reply: FastifyReply) {
    const { applicationId, id } = req.params as { applicationId: string; id: string };
    const data = await ApplicationsService.resetCredentials(applicationId, id, req.user);
    return reply.send(successResponse(data, data.message));
  }

  static async getInchargePerformance(req: FastifyRequest, reply: FastifyReply) {
    const { applicationId } = req.params as { applicationId: string };
    const data = await ApplicationsService.getInchargePerformance(applicationId);
    return reply.send(successResponse(data));
  }

  static async getVoters(req: FastifyRequest, reply: FastifyReply) {
    const { applicationId } = req.params as { applicationId: string };
    const query = req.query as any;
    const data = await ApplicationsService.getVoters(applicationId, query, req.hierarchyScope);
    return reply.send(successResponse(data));
  }

  static async getBooths(req: FastifyRequest, reply: FastifyReply) {
    const { applicationId } = req.params as { applicationId: string };
    const query = req.query as { villageId?: string };
    const data = await ApplicationsService.getHierarchyNodesByLevel(applicationId, 'BOOTH', query?.villageId);
    return reply.send(successResponse(data));
  }

  static async getVoterGroups(req: FastifyRequest, reply: FastifyReply) {
    const { applicationId } = req.params as { applicationId: string };
    const query = req.query as { boothId?: string };
    const data = await ApplicationsService.getHierarchyNodesByLevel(applicationId, 'VOTER_GROUP', query?.boothId);
    return reply.send(successResponse(data));
  }

  static async getSummary(req: FastifyRequest, reply: FastifyReply) {
    const { applicationId } = req.params as { applicationId: string };
    const data = await ApplicationsService.getSummary(applicationId, req.hierarchyScope);
    return reply.send(successResponse(data));
  }
}
