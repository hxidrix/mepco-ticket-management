import type { ErrorRequestHandler } from 'express';

import { AppError } from '../shared/app-error.js';

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  void _next;
  const isAppError = error instanceof AppError;
  const statusCode = isAppError ? error.statusCode : 500;
  const code = isAppError ? error.code : 'INTERNAL_SERVER_ERROR';
  const message = isAppError ? error.message : 'An unexpected error occurred';

  if (!isAppError) {
    request.log.error({ err: error }, 'Unhandled request error');
  }

  response.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(isAppError && error.details !== undefined ? { details: error.details } : {}),
    },
    requestId: request.id,
  });
};
