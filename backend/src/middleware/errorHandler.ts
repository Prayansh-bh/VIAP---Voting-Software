import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { errorResponse } from '../common/response.js';

export function errorHandler(error: FastifyError, req: FastifyRequest, reply: FastifyReply) {
  req.log.error({ err: error, url: req.url, method: req.method }, 'Request Error');

  if (error instanceof ZodError) {
    return reply.status(400).send(errorResponse('Validation error', 'VALIDATION_ERROR', (error as any).issues || (error as any).errors));
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target = (error.meta?.target as string[])?.join(', ') || 'field';
      return reply.status(409).send(errorResponse(`Unique constraint violation on ${target}`, 'CONFLICT', error.meta));
    }
    if (error.code === 'P2025') {
      return reply.status(404).send(errorResponse('Requested resource not found', 'NOT_FOUND', error.meta));
    }
    if (error.code === 'P2003') {
      return reply.status(400).send(errorResponse('Foreign key relation violation', 'FOREIGN_KEY_VIOLATION', error.meta));
    }
  }

  const statusCode = error.statusCode || 500;
  const message = statusCode >= 500 ? 'Internal server error occurred' : error.message;

  return reply.status(statusCode).send(
    errorResponse(message, error.code || 'INTERNAL_SERVER_ERROR', process.env.NODE_ENV === 'development' ? error.stack : undefined),
  );
}
