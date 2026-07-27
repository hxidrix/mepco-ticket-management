import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { body, param, query } from 'express-validator';

import { validateRequest } from '../../middleware/validate-request.js';
import { asyncHandler } from '../../shared/async-handler.js';
import { sendSuccess } from '../../shared/api-response.js';
import { requestContext } from '../../shared/request-context.js';
import { authenticate, authorizeRoles, requireActiveAccount } from '../auth/auth.middleware.js';
import {
  createTechnicianSuspensionRequest,
  directlySuspendRequester,
  listRequesterOptions,
  listSuspensionCases,
  reactivateRequester,
  reviewTechnicianRequest,
} from './account-governance.repository.js';
import type {
  SuspensionCaseInput,
  SuspensionCaseStatus,
} from './account-governance.repository.js';

export const accountGovernanceRouter = Router();
accountGovernanceRouter.use(authenticate, requireActiveAccount);
accountGovernanceRouter.use(authorizeRoles('technician', 'supervisor', 'administrator'));

const categories = [
  'abusive-behavior', 'fraudulent-information', 'repeated-policy-violation',
  'security-risk', 'misuse-of-service', 'other',
];
const caseFields = () => [
  body('category').isIn(categories),
  body('reasonSummary').trim().isLength({ min: 10, max: 255 }),
  body('details').trim().isLength({ min: 20, max: 4000 }),
];
const requestLimiter = rateLimit({
  windowMs: 60 * 60 * 1_000,
  limit: 12,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  validate: { forwardedHeader: false },
});

accountGovernanceRouter.get(
  '/requests',
  query('status').optional().isIn(['pending', 'approved', 'rejected']),
  validateRequest,
  asyncHandler(async (request, response) => {
    const status = typeof request.query.status === 'string'
      ? request.query.status as SuspensionCaseStatus
      : undefined;
    sendSuccess(response, 200, await listSuspensionCases(request.auth!, status));
  }),
);

accountGovernanceRouter.post(
  '/requests',
  authorizeRoles('technician'), requestLimiter,
  body('ticketId').isInt({ min: 1 }).toInt(), ...caseFields(), validateRequest,
  asyncHandler(async (request, response) => {
    const input = request.body as SuspensionCaseInput & { ticketId: number };
    const id = await createTechnicianSuspensionRequest(
      request.auth!.id, input.ticketId, input, requestContext(request),
    );
    sendSuccess(response, 201, { id }, 'Suspension request sent to supervisors and administrators');
  }),
);

accountGovernanceRouter.get(
  '/requesters',
  authorizeRoles('supervisor', 'administrator'),
  query('search').optional().trim().isLength({ max: 140 }), validateRequest,
  asyncHandler(async (request, response) => {
    const search = typeof request.query.search === 'string' && request.query.search !== ''
      ? request.query.search
      : undefined;
    sendSuccess(response, 200, await listRequesterOptions(search));
  }),
);

accountGovernanceRouter.post(
  '/users/:id/suspend',
  authorizeRoles('supervisor', 'administrator'),
  param('id').isInt({ min: 1 }).toInt(), ...caseFields(), validateRequest,
  asyncHandler(async (request, response) => {
    const id = await directlySuspendRequester(
      request.auth!, Number(request.params.id), request.body as SuspensionCaseInput, requestContext(request),
    );
    sendSuccess(response, 201, { id }, 'The account was suspended and its sessions were revoked');
  }),
);

accountGovernanceRouter.post(
  '/users/:id/reactivate',
  authorizeRoles('supervisor', 'administrator'),
  param('id').isInt({ min: 1 }).toInt(),
  body('reason').trim().isLength({ min: 10, max: 500 }), validateRequest,
  asyncHandler(async (request, response) => {
    await reactivateRequester(
      request.auth!, Number(request.params.id), (request.body as { reason: string }).reason,
      requestContext(request),
    );
    sendSuccess(response, 200, null, 'The requester account was reactivated');
  }),
);

accountGovernanceRouter.put(
  '/requests/:id/review',
  authorizeRoles('supervisor', 'administrator'),
  param('id').isInt({ min: 1 }).toInt(),
  body('decision').isIn(['approved', 'rejected']),
  body('decisionNotes').trim().isLength({ min: 10, max: 4000 }), validateRequest,
  asyncHandler(async (request, response) => {
    const input = request.body as { decision: 'approved' | 'rejected'; decisionNotes: string };
    await reviewTechnicianRequest(
      request.auth!, Number(request.params.id), input.decision, input.decisionNotes,
      requestContext(request),
    );
    sendSuccess(response, 200, null, `The suspension request was ${input.decision}`);
  }),
);
