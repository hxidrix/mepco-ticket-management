import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { body } from 'express-validator';
import multer from 'multer';

import { env } from '../../config/env.js';
import { validateRequest } from '../../middleware/validate-request.js';
import { sendSuccess } from '../../shared/api-response.js';
import { AppError } from '../../shared/app-error.js';
import { asyncHandler } from '../../shared/async-handler.js';
import {
  isConsumerId,
  isConsumerReferenceNumber,
  isPhoneNumber,
} from '../../shared/identity-format.js';
import { requestContext } from '../../shared/request-context.js';
import {
  submitPublicComplaint,
  trackPublicComplaint,
  verifyConsumer,
} from './public-complaints.repository.js';
import type { PublicComplaintInput } from './public-complaints.repository.js';

export const publicComplaintsRouter = Router();

const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  validate: { forwardedHeader: false },
  handler: (_request, _response, next) => {
    next(new AppError(429, 'RATE_LIMITED', 'Too many verification attempts; try again later'));
  },
});

const submissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1_000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  validate: { forwardedHeader: false },
  handler: (_request, _response, next) => {
    next(new AppError(429, 'RATE_LIMITED', 'Too many complaints were submitted; try again later'));
  },
});

const consumerIdentityValidation = [
  body('referenceNumber').trim().custom(isConsumerReferenceNumber)
    .withMessage('Reference Number must contain exactly 14 digits'),
  body('consumerId').trim().custom(isConsumerId)
    .withMessage('Consumer ID must contain exactly 10 digits'),
];

publicComplaintsRouter.post(
  '/verify',
  verificationLimiter,
  ...consumerIdentityValidation,
  validateRequest,
  asyncHandler(async (request, response) => {
    const input = request.body as { referenceNumber: string; consumerId: string };
    sendSuccess(response, 200, {
      consumer: await verifyConsumer(input.referenceNumber, input.consumerId),
    }, 'Consumer details verified');
  }),
);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 3, fileSize: env.maxUploadBytes },
});

publicComplaintsRouter.post(
  '/submit',
  submissionLimiter,
  upload.array('attachments', 3),
  ...consumerIdentityValidation,
  body('contactPhone').optional({ values: 'falsy' }).trim().custom(isPhoneNumber)
    .withMessage('Phone number must contain exactly 11 digits and begin with 03'),
  body('subject').trim().isLength({ min: 5, max: 180 }),
  body('description').trim().isLength({ min: 10, max: 10000 }),
  body('categoryId').isInt({ min: 1 }).toInt(),
  body('complaintTypeId').isInt({ min: 1 }).toInt(),
  body('otherCategory').optional({ values: 'falsy' }).trim().isLength({ max: 180 }),
  body('otherComplaintType').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
  body('locationDetails').optional({ values: 'falsy' }).trim().isLength({ max: 500 }),
  body('idempotencyKey').trim().isLength({ min: 8, max: 100 }),
  validateRequest,
  asyncHandler(async (request, response) => {
    const files = Array.isArray(request.files) ? request.files : [];
    const ticket = await submitPublicComplaint(
      request.body as PublicComplaintInput,
      files,
      requestContext(request),
    );
    sendSuccess(response, 201, { ticket }, 'Complaint submitted successfully');
  }),
);

publicComplaintsRouter.post(
  '/track',
  verificationLimiter,
  body('ticketNumber').trim().matches(/^MEPCO-\d{4}-\d{6}$/u)
    .withMessage('Enter a valid complaint tracking number'),
  ...consumerIdentityValidation,
  validateRequest,
  asyncHandler(async (request, response) => {
    const input = request.body as {
      ticketNumber: string;
      referenceNumber: string;
      consumerId: string;
    };
    sendSuccess(response, 200, {
      ticket: await trackPublicComplaint(
        input.ticketNumber,
        input.referenceNumber,
        input.consumerId,
      ),
    });
  }),
);
