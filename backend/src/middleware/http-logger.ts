import { randomUUID } from 'node:crypto';

import { pinoHttp } from 'pino-http';

import { logger } from '../config/logger.js';

export const httpLogger = pinoHttp({
  logger,
  genReqId(request, response) {
    const incomingRequestId = request.headers['x-request-id'];
    const requestId =
      typeof incomingRequestId === 'string' && incomingRequestId.length <= 128
        ? incomingRequestId
        : randomUUID();
    response.setHeader('x-request-id', requestId);
    return requestId;
  },
  customSuccessMessage(request, response) {
    return `${request.method ?? 'REQUEST'} ${request.url ?? ''} completed with ${response.statusCode}`;
  },
  customErrorMessage(request, response) {
    return `${request.method ?? 'REQUEST'} ${request.url ?? ''} failed with ${response.statusCode}`;
  },
});
