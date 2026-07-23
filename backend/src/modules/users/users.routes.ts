import { Router } from 'express';
import { body, param, query } from 'express-validator';

import { validateRequest } from '../../middleware/validate-request.js';
import { asyncHandler } from '../../shared/async-handler.js';
import { sendSuccess } from '../../shared/api-response.js';
import { requestContext } from '../../shared/request-context.js';
import { isCnic, isPhoneNumber } from '../../shared/identity-format.js';
import { authenticate, authorizeRoles, requireActiveAccount } from '../auth/auth.middleware.js';
import type { UserRole } from '../auth/auth.types.js';
import {
  findUserProfile,
  listUsers,
  softDeleteUser,
  updateUserAsAdmin,
} from './users.repository.js';
import { changePassword, createStaff, resetUserPassword, updateProfile } from './users.service.js';
import type {
  AdminUserUpdateInput,
  ProfileUpdateInput,
  StaffCreateInput,
  UserStatus,
} from './users.types.js';

export const usersRouter = Router();
usersRouter.use(authenticate);
usersRouter.use(requireActiveAccount);

const optionalEmail = body('email').optional({ values: 'falsy' }).isEmail().normalizeEmail();
const optionalPhone = body('phone')
  .optional({ values: 'falsy' })
  .trim()
  .custom(isPhoneNumber)
  .withMessage('Phone number must contain exactly 11 digits and begin with 03');
const strongPassword = (field: string) => body(field)
  .isString().isLength({ min: 10, max: 128 })
  .matches(/[a-z]/u).matches(/[A-Z]/u).matches(/[0-9]/u).matches(/[^A-Za-z0-9]/u)
  .withMessage('Password must include upper, lower, number, and symbol');

usersRouter.get('/me/profile', asyncHandler(async (request, response) => {
  const profile = await findUserProfile(request.auth!.id);
  sendSuccess(response, 200, { profile });
}));

usersRouter.put(
  '/me/profile',
  body('displayName').trim().isLength({ min: 2, max: 140 }), optionalEmail,
  optionalPhone,
  body('cnic').trim().custom(isCnic).withMessage('CNIC must contain exactly 13 digits'),
  body('address').optional().trim().isLength({ min: 5, max: 500 }),
  body('circleId').optional().isInt({ min: 1 }).toInt(),
  body('divisionId').optional().isInt({ min: 1 }).toInt(),
  body('subdivisionId').optional().isInt({ min: 1 }).toInt(),
  body('serviceAddress').optional({ values: 'falsy' }).trim().isLength({ max: 500 }),
  body('departmentId').optional({ values: 'falsy' }).isInt({ min: 1 }).toInt(),
  body('designation').optional().trim().isLength({ min: 2, max: 140 }),
  body('workLocation').optional().trim().isLength({ min: 2, max: 255 }),
  validateRequest,
  asyncHandler(async (request, response) => {
    const profile = await updateProfile(
      request.auth!.id, request.auth!.role, request.body as ProfileUpdateInput, requestContext(request),
    );
    sendSuccess(response, 200, { profile }, 'Profile updated successfully');
  }),
);

usersRouter.post(
  '/me/password',
  body('currentPassword').isString().isLength({ min: 1, max: 128 }),
  strongPassword('newPassword'), validateRequest,
  asyncHandler(async (request, response) => {
    const input = request.body as { currentPassword: string; newPassword: string };
    await changePassword(request.auth!.id, input.currentPassword, input.newPassword, requestContext(request));
    sendSuccess(response, 200, null, 'Password changed; please sign in again');
  }),
);

usersRouter.use('/admin', authorizeRoles('administrator'));

usersRouter.get(
  '/admin',
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('pageSize').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('search').optional().trim().isLength({ max: 140 }),
  query('role').optional().isIn(['consumer', 'employee', 'technician', 'supervisor', 'administrator']),
  query('status').optional().isIn(['active', 'suspended', 'inactive']), validateRequest,
  asyncHandler(async (request, response) => {
    const page = Number(request.query.page ?? 1);
    const pageSize = Number(request.query.pageSize ?? 20);
    const result = await listUsers({
      page, pageSize,
      ...(typeof request.query.search === 'string' && request.query.search !== '' ? { search: request.query.search } : {}),
      ...(typeof request.query.role === 'string' ? { role: request.query.role as UserRole } : {}),
      ...(typeof request.query.status === 'string' ? { status: request.query.status as UserStatus } : {}),
    });
    sendSuccess(response, 200, result.items, undefined, {
      page, pageSize, totalItems: result.totalItems, totalPages: Math.ceil(result.totalItems / pageSize),
    });
  }),
);

usersRouter.post(
  '/admin',
  body('role').isIn(['technician', 'supervisor', 'administrator']),
  body('username').trim().isLength({ min: 3, max: 80 }).matches(/^[a-zA-Z0-9._-]+$/u),
  body('displayName').trim().isLength({ min: 2, max: 140 }), optionalEmail,
  optionalPhone, strongPassword('password'),
  body('cnic').trim().custom(isCnic).withMessage('CNIC must contain exactly 13 digits'),
  body('departmentId').optional({ values: 'falsy' }).isInt({ min: 1 }).toInt(),
  body('designation').trim().isLength({ min: 2, max: 140 }),
  body('workLocation').trim().isLength({ min: 2, max: 255 }), validateRequest,
  asyncHandler(async (request, response) => {
    const profile = await createStaff(request.body as StaffCreateInput, request.auth!.id, requestContext(request));
    sendSuccess(response, 201, { profile }, 'Staff account created successfully');
  }),
);

usersRouter.put(
  '/admin/:id',
  param('id').isInt({ min: 1 }).toInt(),
  body('displayName').trim().isLength({ min: 2, max: 140 }), optionalEmail,
  optionalPhone,
  body('cnic').optional({ values: 'falsy' }).trim().custom(isCnic)
    .withMessage('CNIC must contain exactly 13 digits'),
  body('status').isIn(['active', 'suspended', 'inactive']),
  body('statusReason').custom((value: unknown, { req }) => {
    const requestBody = req.body as { status?: unknown };
    if (requestBody.status === 'suspended' && (typeof value !== 'string' || value.trim().length < 10)) {
      throw new Error('A specific suspension reason of at least 10 characters is required');
    }
    return value === undefined || value === null || (typeof value === 'string' && value.trim().length <= 500);
  }),
  body('role').optional().isIn(['technician', 'supervisor', 'administrator']),
  body('departmentId').optional({ values: 'falsy' }).isInt({ min: 1 }).toInt(),
  body('designation').optional().trim().isLength({ min: 2, max: 140 }),
  body('workLocation').optional().trim().isLength({ min: 2, max: 255 }), validateRequest,
  asyncHandler(async (request, response) => {
    const profile = await updateUserAsAdmin(
      Number(request.params.id), request.auth!.id, request.body as AdminUserUpdateInput, requestContext(request),
    );
    sendSuccess(response, 200, { profile }, 'User account updated successfully');
  }),
);

usersRouter.post(
  '/admin/:id/reset-password',
  param('id').isInt({ min: 1 }).toInt(), strongPassword('password'), validateRequest,
  asyncHandler(async (request, response) => {
    await resetUserPassword(
      Number(request.params.id), (request.body as { password: string }).password,
      request.auth!.id, requestContext(request),
    );
    sendSuccess(response, 200, null, 'Password reset successfully');
  }),
);

usersRouter.delete(
  '/admin/:id', param('id').isInt({ min: 1 }).toInt(), validateRequest,
  asyncHandler(async (request, response) => {
    await softDeleteUser(Number(request.params.id), request.auth!.id, requestContext(request));
    sendSuccess(response, 200, null, 'User account deleted successfully');
  }),
);
