import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly headers: Record<string, string> = {},
  ) {
    super(message);
  }
}

export function requestId(request: Request): string {
  const candidate = request.headers.get('x-request-id');
  return candidate && /^[A-Za-z0-9._:-]{8,128}$/.test(candidate) ? candidate : randomUUID();
}

export function errorResponse(error: unknown, id: string): Response {
  if (error instanceof HttpError) {
    return Response.json(
      { error: { code: error.code, message: error.message, requestId: id, details: [] } },
      {
        status: error.status,
        headers: { 'Cache-Control': 'no-store', 'X-Request-Id': id, ...error.headers },
      },
    );
  }
  if (error instanceof ZodError) {
    return Response.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          requestId: id,
          details: error.issues.map((issue) => ({ path: issue.path.join('.'), code: issue.code })),
        },
      },
      { status: 422, headers: { 'Cache-Control': 'no-store', 'X-Request-Id': id } },
    );
  }
  return Response.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        requestId: id,
        details: [],
      },
    },
    { status: 500, headers: { 'Cache-Control': 'no-store', 'X-Request-Id': id } },
  );
}
