import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { body, param, query } from 'express-validator';

import { validateRequest } from '../../middleware/validate-request.js';
import { asyncHandler } from '../../shared/async-handler.js';
import { sendSuccess } from '../../shared/api-response.js';
import { requestContext } from '../../shared/request-context.js';
import { authenticate, authorizeRoles, requireActiveAccount } from '../auth/auth.middleware.js';
import {
  createSuspensionRequest,
  listSuspensionRequests,
  reviewSuspensionRequest,
  suspensionPortal,
} from './suspensions.repository.js';
import type { SuspensionRequestStatus } from './suspensions.repository.js';

export const suspensionsRouter = Router();
suspensionsRouter.use(authenticate);

const submissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1_000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

suspensionsRouter.get('/me', asyncHandler(async (request, response) => {
  sendSuccess(response, 200, await suspensionPortal(request.auth!.id));
}));

suspensionsRouter.post(
  '/me/requests', submissionLimiter,
  body('requestType').isIn(['appeal', 'support']),
  body('message').trim().isLength({ min: 20, max: 4000 }),
  body('contactPreference').isIn(['portal', 'email', 'phone']),
  validateRequest,
  asyncHandler(async (request, response) => {
    const input = request.body as { requestType: 'appeal' | 'support'; message: string; contactPreference: 'portal' | 'email' | 'phone' };
    const id = await createSuspensionRequest(request.auth!.id, input, requestContext(request));
    sendSuccess(response, 201, { id }, 'Your request was submitted for review');
  }),
);

suspensionsRouter.use('/admin', requireActiveAccount, authorizeRoles('administrator'));
suspensionsRouter.get(
  '/admin/requests',
  query('status').optional().isIn(['submitted', 'under-review', 'approved', 'rejected', 'resolved']),
  validateRequest,
  asyncHandler(async (request, response) => {
    const status = typeof request.query.status === 'string' ? request.query.status as SuspensionRequestStatus : undefined;
    sendSuccess(response, 200, await listSuspensionRequests(status));
  }),
);
suspensionsRouter.put(
  '/admin/requests/:id',
  param('id').isInt({ min: 1 }).toInt(),
  body('status').isIn(['under-review', 'approved', 'rejected', 'resolved']),
  body('response').trim().isLength({ min: 3, max: 4000 }),
  validateRequest,
  asyncHandler(async (request, response) => {
    await reviewSuspensionRequest(
      request.auth!.id,
      Number(request.params.id),
      request.body as { status: 'under-review' | 'approved' | 'rejected' | 'resolved'; response: string },
      requestContext(request),
    );
    sendSuccess(response, 200, null, 'Suspension request updated');
  }),
);
