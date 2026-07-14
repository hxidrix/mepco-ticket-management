import type { RequestHandler } from 'express';

import { AppError } from '../../shared/app-error.js';
import { verifyAccessToken } from './auth.tokens.js';
import type { UserRole } from './auth.types.js';

export const authenticate: RequestHandler = (request, _response, next) => {
  const authorization = request.header('authorization');
  if (authorization === undefined || !authorization.startsWith('Bearer ')) {
    next(new AppError(401, 'AUTHENTICATION_REQUIRED', 'Please sign in to continue'));
    return;
  }
  request.auth = verifyAccessToken(authorization.slice(7));
  next();
};

export function authorizeRoles(...roles: UserRole[]): RequestHandler {
  return (request, _response, next) => {
    if (request.auth === undefined) {
      next(new AppError(401, 'AUTHENTICATION_REQUIRED', 'Please sign in to continue'));
      return;
    }
    if (!roles.includes(request.auth.role)) {
      next(new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action'));
      return;
    }
    next();
  };
}

