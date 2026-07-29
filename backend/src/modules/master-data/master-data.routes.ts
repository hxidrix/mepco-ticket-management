import { Router } from 'express';
import { body, param, query } from 'express-validator';

import { validateRequest } from '../../middleware/validate-request.js';
import { asyncHandler } from '../../shared/async-handler.js';
import { sendSuccess } from '../../shared/api-response.js';
import { requestContext } from '../../shared/request-context.js';
import { authenticate, authorizeRoles, requireActiveAccount } from '../auth/auth.middleware.js';
import {
  createMasterItem, getActiveCatalog, listMasterItems, updateMasterItem,
} from './master-data.repository.js';
import type { MasterResource } from './master-data.repository.js';

export const masterDataRouter = Router();
const resources: MasterResource[] = ['departments', 'circles', 'divisions', 'subdivisions', 'categories', 'complaint-types', 'priorities', 'statuses'];
const resourceParam = param('resource').isIn(resources);

masterDataRouter.get('/catalog', asyncHandler(async (_request, response) => {
  sendSuccess(response, 200, await getActiveCatalog());
}));

masterDataRouter.use(authenticate);
masterDataRouter.use(requireActiveAccount);
masterDataRouter.use('/admin', authorizeRoles('administrator'));
masterDataRouter.get(
  '/admin/:resource', resourceParam,
  query('includeInactive').optional().isBoolean(), validateRequest,
  asyncHandler(async (request, response) => {
    const items = await listMasterItems(
      request.params.resource as MasterResource, request.query.includeInactive === 'true',
    );
    sendSuccess(response, 200, items);
  }),
);

const masterInputValidation = [
  body('name').trim().isLength({ min: 2, max: 180 }),
  body('slug').optional({ values: 'falsy' }).trim().isLength({ max: 200 }),
  body('description').optional({ values: 'falsy' }).trim().isLength({ max: 500 }),
  body('sortOrder').optional().isInt({ min: 0, max: 10000 }).toInt(),
  body('isActive').optional().isBoolean().toBoolean(),
  body('parentId').optional({ values: 'falsy' }).isInt({ min: 1 }).toInt(),
  body('departmentId').optional({ values: 'falsy' }).isInt({ min: 1 }).toInt(),
  body('domain').optional().isIn(['consumer', 'employee']),
  body('isConfidential').optional().isBoolean().toBoolean(),
  body('colorToken').optional().trim().isLength({ min: 2, max: 40 }),
  body('slaTargetHours').optional({ values: 'falsy' }).isInt({ min: 1, max: 10000 }).toInt(),
  body('isTerminal').optional().isBoolean().toBoolean(),
];

masterDataRouter.post(
  '/admin/:resource', resourceParam, ...masterInputValidation, validateRequest,
  asyncHandler(async (request, response) => {
    const id = await createMasterItem(
      request.params.resource as MasterResource, request.body as Record<string, unknown>,
      request.auth!.id, requestContext(request),
    );
    sendSuccess(response, 201, { id }, 'Master-data item created successfully');
  }),
);

masterDataRouter.put(
  '/admin/:resource/:id', resourceParam, param('id').isInt({ min: 1 }).toInt(),
  ...masterInputValidation, validateRequest,
  asyncHandler(async (request, response) => {
    await updateMasterItem(
      request.params.resource as MasterResource, Number(request.params.id),
      request.body as Record<string, unknown>, request.auth!.id, requestContext(request),
    );
    sendSuccess(response, 200, null, 'Master-data item updated successfully');
  }),
);
