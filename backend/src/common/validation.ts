import { z, ZodError, ZodSchema } from 'zod';
import { FastifyReply, FastifyRequest } from 'fastify';
import { errorResponse } from './response.js';

export function validateBody<T>(schema: ZodSchema<T>) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      req.body = schema.parse(req.body);
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send(errorResponse('Validation error', 'VALIDATION_ERROR', (err as any).issues || (err as any).errors));
      }
      return reply.status(400).send(errorResponse('Invalid request body', 'INVALID_BODY'));
    }
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      req.query = schema.parse(req.query);
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send(errorResponse('Validation error', 'VALIDATION_ERROR', (err as any).issues || (err as any).errors));
      }
      return reply.status(400).send(errorResponse('Invalid query parameters', 'INVALID_QUERY'));
    }
  };
}

export function validateParams<T>(schema: ZodSchema<T>) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      req.params = schema.parse(req.params);
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send(errorResponse('Validation error', 'VALIDATION_ERROR', (err as any).issues || (err as any).errors));
      }
      return reply.status(400).send(errorResponse('Invalid route parameters', 'INVALID_PARAMS'));
    }
  };
}

export const paginationQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});
