import type { ErrorRequestHandler } from 'express';
import { MulterError } from 'multer';

import { AppError } from '../shared/app-error.js';

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  void _next;
  const isAppError = error instanceof AppError;
  const isMulterError = error instanceof MulterError;
  const statusCode = isAppError ? error.statusCode : isMulterError && error.code === 'LIMIT_FILE_SIZE' ? 413 : isMulterError ? 400 : 500;
  const code = isAppError ? error.code : isMulterError ? `UPLOAD_${error.code}` : 'INTERNAL_SERVER_ERROR';
  const message = isAppError ? error.message : isMulterError && error.code === 'LIMIT_FILE_SIZE'
    ? 'The attachment exceeds the configured size limit' : isMulterError ? 'The attachment upload is invalid' : 'An unexpected error occurred';

  if (!isAppError && !isMulterError) {
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
