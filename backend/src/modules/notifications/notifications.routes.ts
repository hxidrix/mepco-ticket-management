import { Router } from 'express';
import { param, query } from 'express-validator';

import { validateRequest } from '../../middleware/validate-request.js';
import { asyncHandler } from '../../shared/async-handler.js';
import { sendSuccess } from '../../shared/api-response.js';
import { authenticate } from '../auth/auth.middleware.js';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from './notifications.repository.js';

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

notificationsRouter.get(
  '/', query('page').optional().isInt({ min: 1 }).toInt(),
  query('pageSize').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('unreadOnly').optional().isBoolean().toBoolean(), validateRequest,
  asyncHandler(async (request, response) => {
    const page = Number(request.query.page ?? 1); const pageSize = Number(request.query.pageSize ?? 20);
    const unreadValue: unknown = request.query.unreadOnly;
    const result = await listNotifications(request.auth!.id, page, pageSize, unreadValue === true || unreadValue === 'true');
    sendSuccess(response, 200, { items: result.items, unreadCount: result.unreadCount }, undefined,
      { page, pageSize, totalItems: result.totalItems, totalPages: Math.ceil(result.totalItems / pageSize) });
  }),
);

notificationsRouter.post(
  '/read-all',
  asyncHandler(async (request, response) => {
    const updated = await markAllNotificationsRead(request.auth!.id);
    sendSuccess(response, 200, { updated }, 'All notifications marked as read');
  }),
);

notificationsRouter.post(
  '/:id/read', param('id').isInt({ min: 1 }).toInt(), validateRequest,
  asyncHandler(async (request, response) => {
    await markNotificationRead(request.auth!.id, Number(request.params.id));
    sendSuccess(response, 200, null, 'Notification marked as read');
  }),
);
