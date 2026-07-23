import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { body, param } from 'express-validator';

import { validateRequest } from '../../middleware/validate-request.js';
import { asyncHandler } from '../../shared/async-handler.js';
import { sendSuccess } from '../../shared/api-response.js';
import { requestContext } from '../../shared/request-context.js';
import { authenticate, authorizeRoles, requireActiveAccount } from '../auth/auth.middleware.js';
import {
  createMessageThread,
  getMessageThread,
  listMessageRecipients,
  listMessageThreads,
  replyToMessageThread,
} from './internal-messages.repository.js';

export const internalMessagesRouter = Router();
internalMessagesRouter.use(authenticate, requireActiveAccount);
internalMessagesRouter.use(authorizeRoles('technician', 'supervisor', 'administrator'));

const messageLimiter = rateLimit({
  windowMs: 60 * 60 * 1_000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

internalMessagesRouter.get(
  '/recipients',
  asyncHandler(async (request, response) => {
    sendSuccess(response, 200, await listMessageRecipients(request.auth!));
  }),
);

internalMessagesRouter.get(
  '/threads',
  asyncHandler(async (request, response) => {
    sendSuccess(response, 200, await listMessageThreads(request.auth!));
  }),
);

internalMessagesRouter.post(
  '/threads',
  messageLimiter,
  body('recipientId').isInt({ min: 1 }).toInt(),
  body('subject').trim().isLength({ min: 3, max: 160 }),
  body('message').trim().isLength({ min: 1, max: 4000 }),
  validateRequest,
  asyncHandler(async (request, response) => {
    const input = request.body as { recipientId: number; subject: string; message: string };
    const threadId = await createMessageThread(
      request.auth!,
      input.recipientId,
      input.subject,
      input.message,
      requestContext(request),
    );
    sendSuccess(response, 201, { threadId }, 'Message sent');
  }),
);

internalMessagesRouter.get(
  '/threads/:id',
  param('id').isInt({ min: 1 }).toInt(),
  validateRequest,
  asyncHandler(async (request, response) => {
    sendSuccess(response, 200, await getMessageThread(request.auth!, Number(request.params.id)));
  }),
);

internalMessagesRouter.post(
  '/threads/:id/messages',
  messageLimiter,
  param('id').isInt({ min: 1 }).toInt(),
  body('message').trim().isLength({ min: 1, max: 4000 }),
  validateRequest,
  asyncHandler(async (request, response) => {
    const messageId = await replyToMessageThread(
      request.auth!,
      Number(request.params.id),
      (request.body as { message: string }).message,
      requestContext(request),
    );
    sendSuccess(response, 201, { messageId }, 'Reply sent');
  }),
);
