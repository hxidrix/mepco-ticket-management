import type { RequestHandler } from 'express';
import { matchedData, validationResult } from 'express-validator';

import { AppError } from '../shared/app-error.js';

export const validateRequest: RequestHandler = (request, _response, next) => {
  const result = validationResult(request);
  if (!result.isEmpty()) {
    next(
      new AppError(
        422,
        'VALIDATION_ERROR',
        'Please check the highlighted fields',
        result.array({ onlyFirstError: true }).map((error) => {
          const message = typeof error.msg === 'string' ? error.msg : 'Invalid value';
          if (error.type !== 'field') return { message };
          const value: unknown = error.value;
          return { field: error.path, value, message };
        }),
      ),
    );
    return;
  }

  const validatedBody: unknown = matchedData(request, {
    locations: ['body'],
    includeOptionals: true,
  });
  request.body = validatedBody;
  next();
};
