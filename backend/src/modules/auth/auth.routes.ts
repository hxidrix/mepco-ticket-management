import { Router } from 'express';
import type { Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { body } from 'express-validator';

import { env } from '../../config/env.js';
import { validateRequest } from '../../middleware/validate-request.js';
import { AppError } from '../../shared/app-error.js';
import { asyncHandler } from '../../shared/async-handler.js';
import { sendSuccess } from '../../shared/api-response.js';
import { requestContext } from '../../shared/request-context.js';
import {
  isConsumerReferenceNumber,
  isCnic,
  isEmployeeIdInput,
  isPhoneNumber,
} from '../../shared/identity-format.js';
import { authenticate } from './auth.middleware.js';
import { getRegistrationOptions } from './auth.repository.js';
import {
  createConsumerAccount,
  createEmployeeAccount,
  login,
  logout,
  refresh,
} from './auth.service.js';
import type { ConsumerRegistrationInput, EmployeeRegistrationInput, LoginMode } from './auth.types.js';

export const authRouter = Router();

const authenticationLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: 40,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_request, _response, next) => {
    next(new AppError(429, 'RATE_LIMITED', 'Too many authentication requests; try again later'));
  },
});

const passwordValidation = body('password')
  .isString()
  .isLength({ min: 10, max: 128 })
  .withMessage('Password must contain 10 to 128 characters')
  .matches(/[a-z]/u)
  .withMessage('Password must include a lowercase letter')
  .matches(/[A-Z]/u)
  .withMessage('Password must include an uppercase letter')
  .matches(/[0-9]/u)
  .withMessage('Password must include a number')
  .matches(/[^A-Za-z0-9]/u)
  .withMessage('Password must include a symbol');

function getRefreshCookie(request: Request): string | null {
  const cookies = request.cookies as Record<string, unknown>;
  const value = cookies[env.refreshCookieName];
  return typeof value === 'string' ? value : null;
}

function setRefreshCookie(response: Response, token: string): void {
  response.cookie(env.refreshCookieName, token, {
    httpOnly: true,
    secure: env.refreshCookieSecure,
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: env.refreshTokenTtlDays * 86_400_000,
  });
}

authRouter.get(
  '/registration-options',
  asyncHandler(async (_request, response) => {
    sendSuccess(response, 200, await getRegistrationOptions());
  }),
);

authRouter.post(
  '/register/consumer',
  authenticationLimiter,
  body('referenceNumber')
    .trim()
    .custom(isConsumerReferenceNumber)
    .withMessage('MEPCO Reference Number must contain exactly 14 digits'),
  body('name').trim().isLength({ min: 2, max: 140 }).withMessage('Name is required'),
  body('email').optional({ values: 'falsy' }).isEmail().normalizeEmail(),
  body('phone')
    .trim()
    .custom(isPhoneNumber)
    .withMessage('Phone number must contain exactly 11 digits and begin with 03'),
  body('cnic')
    .trim()
    .custom(isCnic)
    .withMessage('CNIC must contain exactly 13 digits'),
  passwordValidation,
  body('address').trim().isLength({ min: 5, max: 500 }).withMessage('Address is required'),
  body('circleId').isInt({ min: 1 }).toInt(),
  body('divisionId').isInt({ min: 1 }).toInt(),
  body('subdivisionId').isInt({ min: 1 }).toInt(),
  body('serviceAddress').optional({ values: 'falsy' }).trim().isLength({ max: 500 }),
  validateRequest,
  asyncHandler(async (request, response) => {
    const user = await createConsumerAccount(
      request.body as ConsumerRegistrationInput,
      requestContext(request),
    );
    sendSuccess(response, 201, { user }, 'Consumer account created successfully');
  }),
);

authRouter.post(
  '/register/employee',
  authenticationLimiter,
  body('employeeId')
    .trim()
    .custom(isEmployeeIdInput)
    .withMessage('Employee ID must contain 1 to 8 digits'),
  body('name').trim().isLength({ min: 2, max: 140 }).withMessage('Name is required'),
  body('email').isEmail().normalizeEmail(),
  body('phone')
    .trim()
    .custom(isPhoneNumber)
    .withMessage('Phone number must contain exactly 11 digits and begin with 03'),
  body('cnic')
    .trim()
    .custom(isCnic)
    .withMessage('CNIC must contain exactly 13 digits'),
  passwordValidation,
  body('departmentId').isInt({ min: 1 }).toInt(),
  body('designation').trim().isLength({ min: 2, max: 140 }),
  body('circleId').isInt({ min: 1 }).toInt(),
  body('divisionId').isInt({ min: 1 }).toInt(),
  body('subdivisionId').isInt({ min: 1 }).toInt(),
  validateRequest,
  asyncHandler(async (request, response) => {
    const user = await createEmployeeAccount(
      request.body as EmployeeRegistrationInput,
      requestContext(request),
    );
    sendSuccess(response, 201, { user }, 'Employee account created successfully');
  }),
);

authRouter.post(
  '/login',
  authenticationLimiter,
  body('mode').isIn(['consumer', 'employee', 'staff']),
  body('identifier')
    .trim()
    .custom((value: string, { req }) => {
      const requestBody: unknown = req.body;
      const mode = typeof requestBody === 'object'
        && requestBody !== null
        && 'mode' in requestBody
        ? (requestBody as { mode?: unknown }).mode
        : undefined;
      if (mode === 'consumer') return isConsumerReferenceNumber(value);
      if (mode === 'employee') return isEmployeeIdInput(value);
      return mode === 'staff' && value.length >= 3 && value.length <= 80;
    })
    .withMessage('Enter a valid identifier for the selected login type'),
  body('password').isString().isLength({ min: 1, max: 128 }),
  validateRequest,
  asyncHandler(async (request, response) => {
    const { mode, identifier, password } = request.body as {
      mode: LoginMode;
      identifier: string;
      password: string;
    };
    const result = await login(mode, identifier, password, requestContext(request));
    setRefreshCookie(response, result.tokens.refreshToken);
    sendSuccess(response, 200, {
      user: result.user,
      accessToken: result.tokens.accessToken,
      expiresIn: result.tokens.accessExpiresInSeconds,
    }, 'Signed in successfully');
  }),
);

authRouter.post(
  '/refresh',
  authenticationLimiter,
  asyncHandler(async (request, response) => {
    const refreshCookie = getRefreshCookie(request);
    if (refreshCookie === null) {
      throw new AppError(401, 'REFRESH_TOKEN_REQUIRED', 'No refresh session was provided');
    }
    const result = await refresh(refreshCookie, requestContext(request));
    setRefreshCookie(response, result.tokens.refreshToken);
    sendSuccess(response, 200, {
      user: result.user,
      accessToken: result.tokens.accessToken,
      expiresIn: result.tokens.accessExpiresInSeconds,
    });
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (request, response) => {
    await logout(getRefreshCookie(request), requestContext(request));
    response.clearCookie(env.refreshCookieName, {
      httpOnly: true,
      secure: env.refreshCookieSecure,
      sameSite: 'lax',
      path: '/api/v1/auth',
    });
    sendSuccess(response, 200, null, 'Signed out successfully');
  }),
);

authRouter.get('/me', authenticate, (request, response) => {
  sendSuccess(response, 200, { user: request.auth });
});
