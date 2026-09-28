import { FastifyReply, FastifyRequest } from 'fastify';
import { errorResponse, paginatedResponse, successResponse } from '../../common/response.js';
import { assertUnitAccess, assertVoterFieldPermitted, assertVoterScope } from '../../middleware/rbac.js';
import { VotersService } from './voters.service.js';

export class VotersController {
  static async listVoters(req: FastifyRequest, reply: FastifyReply) {
    const query = req.query as any;
    if (query?.unitId && !assertUnitAccess(req, reply, query.unitId)) return;

    const result = await VotersService.listVoters(query, req.hierarchyScope);
    return reply.status(200).send(paginatedResponse(result.items, result.total, result.page, result.limit));
  }

  static async getVoter(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    if (!(await assertVoterScope(req, reply, params.id))) return;
    const voter = await VotersService.getVoterById(params.id);
    return reply.status(200).send(successResponse(voter));
  }

  static async createVoter(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as any;
    if (body?.unitId && !assertUnitAccess(req, reply, body.unitId)) return;
    const voter = await VotersService.createVoter(body, req.user!.userId);
    return reply.status(201).send(successResponse(voter, 'Voter record created'));
  }

  static async updateVoter(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    const body = req.body as any;
    if (!(await assertVoterScope(req, reply, params.id))) return;
    if (!assertVoterFieldPermitted(req, reply, body)) return;
    if (body?.unitId && !assertUnitAccess(req, reply, body.unitId)) return;

    const voter = await VotersService.updateVoter(params.id, body, req.user!.userId);
    return reply.status(200).send(successResponse(voter, 'Voter updated'));
  }

  static async updateVoterStatus(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    const body = req.body as any;
    if (!(await assertVoterScope(req, reply, params.id))) return;

    const voter = await VotersService.updateVoterStatus(params.id, body, req.user!.userId);
    return reply.status(200).send(successResponse(voter, 'Voter status updated'));
  }

  static async flagFakeVoter(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    const body = req.body as any;
    if (!(await assertVoterScope(req, reply, params.id))) return;

    const flag = await VotersService.flagFakeVoter(params.id, body, req.user!.userId);
    return reply.status(201).send(successResponse(flag, 'Voter flagged as fake / objection recorded'));
  }

  static async markVoteDone(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    if (!(await assertVoterScope(req, reply, params.id))) return;

    const voter = await VotersService.markVoteDone(params.id, req.user!.userId);
    return reply.status(200).send(successResponse(voter, 'Voter marked as Vote Done'));
  }

  static async markNotVoted(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    if (!(await assertVoterScope(req, reply, params.id))) return;

    const voter = await VotersService.markNotVoted(params.id, req.user!.userId);
    return reply.status(200).send(successResponse(voter, 'Voter marked as Not Voted'));
  }

  static async updateMigration(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    const body = req.body as any;
    if (!(await assertVoterScope(req, reply, params.id))) return;

    const migration = await VotersService.updateMigration(params.id, body, req.user!.userId);
    return reply.status(200).send(successResponse(migration, 'Migration details updated'));
  }

  static async getVoterHistory(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    if (!(await assertVoterScope(req, reply, params.id))) return;

    const history = await VotersService.getVoterHistory(params.id);
    return reply.status(200).send(successResponse(history));
  }

  static async deleteVoter(req: FastifyRequest, reply: FastifyReply) {
    const params = req.params as { id: string };
    if (!(await assertVoterScope(req, reply, params.id))) return;

    const result = await VotersService.deleteVoter(params.id, req.user!.userId);
    return reply.status(200).send(successResponse(result, 'Voter deleted'));
  }

  static async bulkImport(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as {
      constituencyId: string;
      rows?: any[];
      data?: any[];
      validateOnly?: boolean;
      importMode?: 'APPEND' | 'REPLACE';
      mode?: 'APPEND' | 'REPLACE';
      voterGroupSize?: number;
    };
    const rows = Array.isArray(body?.rows) ? body.rows : Array.isArray(body?.data) ? body.data : null;
    const importMode = (body?.importMode || body?.mode || 'APPEND') as 'APPEND' | 'REPLACE';
    if (!body || !body.constituencyId || !rows) {
      return reply.status(400).send(errorResponse('Invalid payload: constituencyId and rows array required.', 'INVALID_PAYLOAD'));
    }

    try {
      const { BulkUploadService } = await import('./bulk-upload.service.js');
      const result = await BulkUploadService.importVotersFromData(body.constituencyId, rows, {
        validateOnly: body.validateOnly,
        importMode,
        voterGroupSize: body.voterGroupSize,
        actorId: req.user?.userId,
        scope: req.hierarchyScope,
      });
      return reply.status(200).send(successResponse(result, body.validateOnly ? 'Pre-flight validation report generated successfully' : 'Voter roll data successfully imported and assigned to hierarchy'));
    } catch (err: any) {
      const statusCode = err.statusCode || 500;
      return reply.status(statusCode).send(errorResponse(err.message || 'Bulk import failed', err.code || 'IMPORT_FAILED', err.validationReport ? { validationReport: err.validationReport } : undefined));
    }
  }

  static async downloadTemplate(_req: FastifyRequest, reply: FastifyReply) {
    const templateColumns = [
      { field: 'epicNumber', label: 'Voter ID / EPIC', required: true, example: 'ABC1234567' },
      { field: 'fullName', label: 'Full Name', required: true, example: 'Ravi Kumar' },
      { field: 'relativeName', label: 'Father / Husband Name', required: true, example: 'Subba Rao' },
      { field: 'relationType', label: 'Relation (FATHER/HUSBAND/MOTHER)', required: false, example: 'FATHER' },
      { field: 'gender', label: 'Gender (MALE/FEMALE/OTHER)', required: true, example: 'MALE' },
      { field: 'age', label: 'Age', required: true, example: 34 },
      { field: 'doorNo', label: 'Door / House No', required: false, example: '4-12/A' },
      { field: 'mobileNumber', label: 'Mobile Number', required: false, example: '9876543210' },
      { field: 'mandalName', label: 'Mandal Name', required: true, example: 'Central Mandal' },
      { field: 'villageName', label: 'Village / Ward Name', required: true, example: 'North Ward' },
      { field: 'boothNumber', label: 'Booth Number / PS Code', required: true, example: '101' },
      { field: 'voterGroup', label: '100-Voter Group (Optional)', required: false, example: 'Group 1' },
      { field: 'caste', label: 'Caste Category (Optional)', required: false, example: 'BC-A' },
      { field: 'profession', label: 'Profession (Optional)', required: false, example: 'Farmer' },
      { field: 'politicalPreference', label: 'Political Preference (Optional)', required: false, example: 'LEANING_POSITIVE' },
    ];

    return reply.status(200).send(successResponse({
      format: 'xlsx / csv / json',
      columns: templateColumns,
      sampleRows: [
        {
          epicNumber: 'VIAP9876543',
          fullName: 'Suresh Varma',
          relativeName: 'Narayana Varma',
          relationType: 'FATHER',
          gender: 'MALE',
          age: 42,
          doorNo: '12-3/A',
          mobileNumber: '9876500001',
          mandalName: 'Mandal One',
          villageName: 'Village One',
          boothNumber: '101',
          voterGroup: '100-Voter Group 1',
        },
        {
          epicNumber: 'VIAP9876544',
          fullName: 'Lakshmi Devi',
          relativeName: 'Suresh Varma',
          relationType: 'HUSBAND',
          gender: 'FEMALE',
          age: 38,
          doorNo: '12-3/A',
          mobileNumber: '9876500002',
          mandalName: 'Mandal One',
          villageName: 'Village One',
          boothNumber: '101',
          voterGroup: '100-Voter Group 1',
        },
      ],
    }, 'Sample voter import template specification retrieved'));
  }
}
