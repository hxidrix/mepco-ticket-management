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
  isCnicLastFour,
  isEmployeeIdInput,
} from '../../shared/identity-format.js';
import { authenticate } from './auth.middleware.js';
import {
  continueEmployeeLogin,
  login,
  logout,
  refresh,
  verifyEmployeeIdentity,
} from './auth.service.js';

export const authRouter = Router();

const authenticationLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: 40,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  validate: { forwardedHeader: false },
  handler: (_request, _response, next) => {
    next(new AppError(429, 'RATE_LIMITED', 'Too many authentication requests; try again later'));
  },
});

const identityVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  validate: { forwardedHeader: false },
  handler: (_request, _response, next) => {
    next(new AppError(429, 'RATE_LIMITED', 'Too many verification attempts; try again later'));
  },
});

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

authRouter.post(
  '/login',
  authenticationLimiter,
  body('mode').equals('staff'),
  body('identifier').trim().isLength({ min: 3, max: 80 }),
  body('password').isString().isLength({ min: 1, max: 128 }),
  validateRequest,
  asyncHandler(async (request, response) => {
    const { identifier, password } = request.body as {
      identifier: string;
      password: string;
    };
    const result = await login('staff', identifier, password, requestContext(request));
    setRefreshCookie(response, result.tokens.refreshToken);
    sendSuccess(response, 200, {
      user: result.user,
      accessToken: result.tokens.accessToken,
      expiresIn: result.tokens.accessExpiresInSeconds,
    }, 'Signed in successfully');
  }),
);

const employeeIdentityValidation = [
  body('employeeId').trim().custom(isEmployeeIdInput)
    .withMessage('Employee ID must contain 1 to 8 digits'),
  body('cnicLastFour').trim().custom(isCnicLastFour)
    .withMessage('Enter the last four digits of the CNIC'),
];

authRouter.post(
  '/employee/verify',
  identityVerificationLimiter,
  ...employeeIdentityValidation,
  validateRequest,
  asyncHandler(async (request, response) => {
    const input = request.body as { employeeId: string; cnicLastFour: string };
    const employee = await verifyEmployeeIdentity(
      input.employeeId,
      input.cnicLastFour,
      requestContext(request),
    );
    sendSuccess(response, 200, { employee }, 'Employee details verified');
  }),
);

authRouter.post(
  '/employee/continue',
  identityVerificationLimiter,
  ...employeeIdentityValidation,
  validateRequest,
  asyncHandler(async (request, response) => {
    const input = request.body as { employeeId: string; cnicLastFour: string };
    const result = await continueEmployeeLogin(
      input.employeeId,
      input.cnicLastFour,
      requestContext(request),
    );
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
