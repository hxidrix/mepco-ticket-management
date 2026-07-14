import type { Request } from 'express';

import type { RequestContext } from '../modules/auth/auth.types.js';

export function requestContext(request: Request): RequestContext {
  const requestId = request.id;
  return {
    requestId:
      typeof requestId === 'string' || typeof requestId === 'number'
        ? String(requestId)
        : 'unknown-request',
    ipAddress: request.ip ?? null,
    userAgent: request.header('user-agent') ?? null,
  };
}
