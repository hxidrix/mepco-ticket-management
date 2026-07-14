import { Router } from 'express';

import { checkDatabaseConnection } from '../../database/pool.js';
import { AppError } from '../../shared/app-error.js';
import { sendSuccess } from '../../shared/api-response.js';

export const healthRouter = Router();

healthRouter.get('/live', (_request, response) => {
  sendSuccess(response, 200, {
    service: 'mepco-help-desk-api',
    status: 'up',
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get('/ready', async (request, response, next) => {
  try {
    await checkDatabaseConnection();
    sendSuccess(response, 200, {
      service: 'mepco-help-desk-api',
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    request.log.warn({ err: error }, 'Database readiness check failed');
    next(
      new AppError(
        503,
        'DATABASE_UNAVAILABLE',
        'The API is running but its database is unavailable',
      ),
    );
  }
});
