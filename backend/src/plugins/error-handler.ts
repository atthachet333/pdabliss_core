import type { FastifyError, FastifyInstance } from 'fastify';
import { AppError } from '../lib/errors.js';

export interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string;
  };
}

export function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler<FastifyError | AppError>((error, request, reply) => {
    if (error instanceof AppError) {
      const body: ErrorBody = {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
          requestId: request.id,
        },
      };
      return reply.status(error.statusCode).send(body);
    }

    // Fastify-native client errors (malformed JSON, schema validation, rate limit, …)
    const status = error.statusCode ?? 500;
    if (status >= 400 && status < 500) {
      return reply.status(status).send({
        error: {
          // EP23: the per-route limiter sets no code — name a 429 for what it is.
          code: error.code ?? (status === 429 ? 'RATE_LIMITED' : 'BAD_REQUEST'),
          message: error.message,
          requestId: request.id,
        },
      } satisfies ErrorBody);
    }

    request.log.error({ err: error }, 'Unhandled error');
    return reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        requestId: request.id,
      },
    } satisfies ErrorBody);
  });

  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
        requestId: request.id,
      },
    } satisfies ErrorBody);
  });
}
