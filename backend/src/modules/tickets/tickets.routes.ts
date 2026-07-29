import { pipeline } from 'node:stream/promises';

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import multer from 'multer';

import { env } from '../../config/env.js';
import { validateRequest } from '../../middleware/validate-request.js';
import { openAttachment } from '../../shared/attachment-storage.js';
import { asyncHandler } from '../../shared/async-handler.js';
import { sendSuccess } from '../../shared/api-response.js';
import { AppError } from '../../shared/app-error.js';
import { requestContext } from '../../shared/request-context.js';
import { authenticate, authorizeRoles, requireActiveAccount } from '../auth/auth.middleware.js';
import {
  assignTicket,
  addTicketAttachment,
  addTicketComment,
  changeTicketPriority,
  closeTicketWithReview,
  createTicket,
  deleteTicket,
  exportTicketsCsv,
  exportTicketsPdf,
  getTicketDetail,
  getTicketAttachment,
  listTechnicians,
  listTickets,
  ticketMetrics,
  transitionTicket,
} from './tickets.repository.js';
import type { TicketClosureReviewInput, TicketCreateInput, TicketDomain, TicketListInput } from './tickets.types.js';

export const ticketsRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { files: 1, fileSize: env.maxUploadBytes } });
ticketsRouter.use(authenticate);
ticketsRouter.use(requireActiveAccount);

ticketsRouter.post(
  '/', authorizeRoles('employee'),
  body('subject').trim().isLength({ min: 5, max: 180 }),
  body('description').trim().isLength({ min: 10, max: 10000 }),
  body('categoryId').isInt({ min: 1 }).toInt(), body('complaintTypeId').isInt({ min: 1 }).toInt(),
  body('departmentId').optional({ values: 'falsy' }).isInt({ min: 1 }).toInt(),
  body('circleId').optional({ values: 'falsy' }).isInt({ min: 1 }).toInt(),
  body('divisionId').optional({ values: 'falsy' }).isInt({ min: 1 }).toInt(),
  body('subdivisionId').optional({ values: 'falsy' }).isInt({ min: 1 }).toInt(),
  body('priorityId').optional({ values: 'falsy' }).isInt({ min: 1 }).toInt(),
  body('otherCategory').optional({ values: 'falsy' }).trim().isLength({ max: 180 }),
  body('otherComplaintType').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
  body('locationDetails').optional({ values: 'falsy' }).trim().isLength({ max: 500 }),
  body('idempotencyKey').optional({ values: 'falsy' }).trim().isLength({ min: 8, max: 100 }),
  validateRequest,
  asyncHandler(async (request, response) => {
    const ticket = await createTicket(request.auth!, request.body as TicketCreateInput, requestContext(request));
    sendSuccess(response, 201, { ticket }, 'Ticket submitted successfully');
  }),
);

ticketsRouter.get(
  '/',
  query('page').optional().isInt({ min: 1 }).toInt(), query('pageSize').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('search').optional().trim().isLength({ max: 180 }),
  query('status').optional().trim().isLength({ max: 70 }), query('priority').optional().trim().isLength({ max: 50 }),
  query('view').optional().isIn(['open', 'overdue']),
  query('domain').optional().isIn(['consumer', 'employee']),
  query('categoryId').optional().isInt({ min: 1 }).toInt(), query('departmentId').optional().isInt({ min: 1 }).toInt(),
  query('circleId').optional().isInt({ min: 1 }).toInt(),
  query('divisionId').optional().isInt({ min: 1 }).toInt(),
  query('subdivisionId').optional().isInt({ min: 1 }).toInt(),
  query('assigneeId').optional().isInt({ min: 1 }).toInt(),
  query('dateFrom').optional().isISO8601(), query('dateTo').optional().isISO8601(),
  query('sortBy').optional().isIn(['createdAt', 'updatedAt', 'ticketNumber', 'priority', 'status']),
  query('sortOrder').optional().isIn(['asc', 'desc']), validateRequest,
  asyncHandler(async (request, response) => {
    const page = Number(request.query.page ?? 1); const pageSize = Number(request.query.pageSize ?? 20);
    const optionalString = (key: string) => typeof request.query[key] === 'string' && request.query[key] !== '' ? String(request.query[key]) : undefined;
    const optionalNumber = (key: string) => request.query[key] === undefined ? undefined : Number(request.query[key]);
    const input: TicketListInput = { page, pageSize };
    const search = optionalString('search'); if (search !== undefined) input.search = search;
    const status = optionalString('status'); if (status !== undefined) input.status = status;
    const view = optionalString('view'); if (view !== undefined) input.view = view as NonNullable<TicketListInput['view']>;
    const priority = optionalString('priority'); if (priority !== undefined) input.priority = priority;
    const domain = optionalString('domain'); if (domain !== undefined) input.domain = domain as TicketDomain;
    const categoryId = optionalNumber('categoryId'); if (categoryId !== undefined) input.categoryId = categoryId;
    const departmentId = optionalNumber('departmentId'); if (departmentId !== undefined) input.departmentId = departmentId;
    const circleId = optionalNumber('circleId'); if (circleId !== undefined) input.circleId = circleId;
    const divisionId = optionalNumber('divisionId'); if (divisionId !== undefined) input.divisionId = divisionId;
    const subdivisionId = optionalNumber('subdivisionId'); if (subdivisionId !== undefined) input.subdivisionId = subdivisionId;
    const assigneeId = optionalNumber('assigneeId'); if (assigneeId !== undefined) input.assigneeId = assigneeId;
    const dateFrom = optionalString('dateFrom'); if (dateFrom !== undefined) input.dateFrom = dateFrom;
    const dateTo = optionalString('dateTo'); if (dateTo !== undefined) input.dateTo = dateTo;
    const sortBy = optionalString('sortBy'); if (sortBy !== undefined) input.sortBy = sortBy as NonNullable<TicketListInput['sortBy']>;
    const sortOrder = optionalString('sortOrder'); if (sortOrder !== undefined) input.sortOrder = sortOrder as NonNullable<TicketListInput['sortOrder']>;
    const result = await listTickets(request.auth!, input);
    sendSuccess(response, 200, result.items, undefined, { page, pageSize, totalItems: result.totalItems, totalPages: Math.ceil(result.totalItems / pageSize) });
  }),
);

ticketsRouter.get(
  '/workflow/technicians',
  authorizeRoles('supervisor', 'administrator'),
  query('ticketId').optional().isInt({ min: 1 }).toInt(), validateRequest,
  asyncHandler(async (request, response) => {
    const ticketId = request.query.ticketId === undefined ? undefined : Number(request.query.ticketId);
    sendSuccess(response, 200, await listTechnicians(request.auth!, ticketId));
  }),
);

ticketsRouter.get(
  '/reports/metrics',
  asyncHandler(async (request, response) => {
    sendSuccess(response, 200, await ticketMetrics(request.auth!));
  }),
);

ticketsRouter.get(
  '/reports/export.csv', authorizeRoles('supervisor', 'administrator'),
  query('status').optional().trim().isLength({ max: 70 }), query('priority').optional().trim().isLength({ max: 50 }),
  query('domain').optional().isIn(['consumer', 'employee']), query('dateFrom').optional().isISO8601(),
  query('dateTo').optional().isISO8601(), query('circleId').optional().isInt({ min: 1 }).toInt(),
  query('divisionId').optional().isInt({ min: 1 }).toInt(),
  query('subdivisionId').optional().isInt({ min: 1 }).toInt(), validateRequest,
  asyncHandler(async (request, response) => {
    const input: Omit<TicketListInput, 'page' | 'pageSize'> = {};
    if (typeof request.query.status === 'string' && request.query.status !== '') input.status = request.query.status;
    if (typeof request.query.priority === 'string' && request.query.priority !== '') input.priority = request.query.priority;
    if (request.query.domain === 'consumer' || request.query.domain === 'employee') input.domain = request.query.domain;
    if (typeof request.query.dateFrom === 'string') input.dateFrom = request.query.dateFrom;
    if (typeof request.query.dateTo === 'string') input.dateTo = request.query.dateTo;
    if (request.query.circleId !== undefined) input.circleId = Number(request.query.circleId);
    if (request.query.divisionId !== undefined) input.divisionId = Number(request.query.divisionId);
    if (request.query.subdivisionId !== undefined) input.subdivisionId = Number(request.query.subdivisionId);
    response.type('text/csv').attachment(`mepco-tickets-${new Date().toISOString().slice(0, 10)}.csv`)
      .send(await exportTicketsCsv(request.auth!, input));
  }),
);

ticketsRouter.get(
  '/reports/export.pdf', authorizeRoles('supervisor', 'administrator'),
  query('status').optional().trim().isLength({ max: 70 }), query('priority').optional().trim().isLength({ max: 50 }),
  query('domain').optional().isIn(['consumer', 'employee']), query('dateFrom').optional().isISO8601(),
  query('dateTo').optional().isISO8601(), query('circleId').optional().isInt({ min: 1 }).toInt(),
  query('divisionId').optional().isInt({ min: 1 }).toInt(),
  query('subdivisionId').optional().isInt({ min: 1 }).toInt(), validateRequest,
  asyncHandler(async (request, response) => {
    const input: Omit<TicketListInput, 'page' | 'pageSize'> = {};
    if (typeof request.query.status === 'string' && request.query.status !== '') input.status = request.query.status;
    if (typeof request.query.priority === 'string' && request.query.priority !== '') input.priority = request.query.priority;
    if (request.query.domain === 'consumer' || request.query.domain === 'employee') input.domain = request.query.domain;
    if (typeof request.query.dateFrom === 'string') input.dateFrom = request.query.dateFrom;
    if (typeof request.query.dateTo === 'string') input.dateTo = request.query.dateTo;
    if (request.query.circleId !== undefined) input.circleId = Number(request.query.circleId);
    if (request.query.divisionId !== undefined) input.divisionId = Number(request.query.divisionId);
    if (request.query.subdivisionId !== undefined) input.subdivisionId = Number(request.query.subdivisionId);
    response.type('application/pdf').attachment(`mepco-tickets-${new Date().toISOString().slice(0, 10)}.pdf`)
      .send(await exportTicketsPdf(request.auth!, input));
  }),
);

ticketsRouter.get(
  '/attachments/:attachmentId/download',
  param('attachmentId').isInt({ min: 1 }).toInt(), validateRequest,
  asyncHandler(async (request, response) => {
    const attachment = await getTicketAttachment(request.auth!, Number(request.params.attachmentId));
    response.type(attachment.mimeType);
    response.attachment(attachment.originalName);
    response.setHeader('Cache-Control', 'private, no-store');
    const opened = await openAttachment(attachment.storagePath);
    if (opened.kind === 'stream') {
      await pipeline(opened.stream, response);
      return;
    }
    await new Promise<void>((resolve, reject) => {
      response.sendFile(opened.path, (error) => error === undefined ? resolve() : reject(error));
    });
  }),
);

ticketsRouter.post(
  '/:id/assign', authorizeRoles('supervisor', 'administrator'),
  param('id').isInt({ min: 1 }).toInt(), body('technicianId').isInt({ min: 1 }).toInt(),
  body('reason').trim().isLength({ min: 3, max: 500 }), body('version').isInt({ min: 1 }).toInt(),
  validateRequest,
  asyncHandler(async (request, response) => {
    const input = request.body as { technicianId: number; reason: string; version: number };
    await assignTicket(request.auth!, Number(request.params.id), input.technicianId, input.reason, input.version, requestContext(request));
    sendSuccess(response, 200, null, 'Ticket assigned successfully');
  }),
);

ticketsRouter.post(
  '/:id/status',
  param('id').isInt({ min: 1 }).toInt(), body('status').trim().isLength({ min: 2, max: 70 }),
  body('reason').trim().isLength({ min: 3, max: 1000 }), body('resolutionSummary').optional({ values: 'falsy' }).trim().isLength({ max: 10000 }),
  body('version').isInt({ min: 1 }).toInt(), validateRequest,
  asyncHandler(async (request, response) => {
    const input = request.body as { status: string; reason: string; resolutionSummary?: string; version: number };
    await transitionTicket(request.auth!, Number(request.params.id), input.status, input.reason, input.resolutionSummary, input.version, requestContext(request));
    sendSuccess(response, 200, null, 'Ticket status updated successfully');
  }),
);

ticketsRouter.post(
  '/:id/close-review', authorizeRoles('employee'),
  param('id').isInt({ min: 1 }).toInt(),
  body('issueResolved').isBoolean().toBoolean(),
  body('satisfactionRating').isInt({ min: 1, max: 5 }).toInt(),
  body('reviewText').optional({ values: 'falsy' }).trim().isLength({ max: 2000 }),
  body('version').isInt({ min: 1 }).toInt(), validateRequest,
  asyncHandler(async (request, response) => {
    await closeTicketWithReview(
      request.auth!,
      Number(request.params.id),
      request.body as TicketClosureReviewInput,
      requestContext(request),
    );
    sendSuccess(response, 200, null, 'Ticket closed and review submitted successfully');
  }),
);

ticketsRouter.post(
  '/:id/priority', authorizeRoles('supervisor', 'administrator'),
  param('id').isInt({ min: 1 }).toInt(), body('priorityId').isInt({ min: 1 }).toInt(),
  body('reason').trim().isLength({ min: 3, max: 1000 }), body('version').isInt({ min: 1 }).toInt(), validateRequest,
  asyncHandler(async (request, response) => {
    const input = request.body as { priorityId: number; reason: string; version: number };
    await changeTicketPriority(request.auth!, Number(request.params.id), input.priorityId, input.reason, input.version, requestContext(request));
    sendSuccess(response, 200, null, 'Ticket priority updated successfully');
  }),
);

ticketsRouter.post(
  '/:id/comments',
  param('id').isInt({ min: 1 }).toInt(), body('body').trim().isLength({ min: 1, max: 10000 }),
  body('visibility').optional().isIn(['public', 'internal']), validateRequest,
  asyncHandler(async (request, response) => {
    const input = request.body as { body: string; visibility?: 'public' | 'internal' };
    const commentId = await addTicketComment(request.auth!, Number(request.params.id), input.body, input.visibility ?? 'public', requestContext(request));
    sendSuccess(response, 201, { commentId }, 'Comment added successfully');
  }),
);

ticketsRouter.post(
  '/:id/attachments',
  param('id').isInt({ min: 1 }).toInt(), validateRequest, upload.single('file'),
  asyncHandler(async (request, response) => {
    if (request.file === undefined) throw new AppError(400, 'ATTACHMENT_REQUIRED', 'Select a file to upload');
    const attachmentId = await addTicketAttachment(request.auth!, Number(request.params.id), request.file, requestContext(request));
    sendSuccess(response, 201, { attachmentId }, 'Attachment uploaded successfully');
  }),
);

ticketsRouter.delete(
  '/:id', authorizeRoles('administrator'),
  param('id').isInt({ min: 1 }).toInt(),
  body('reason').trim().isLength({ min: 3, max: 500 }),
  body('version').isInt({ min: 1 }).toInt(), validateRequest,
  asyncHandler(async (request, response) => {
    const input = request.body as { reason: string; version: number };
    await deleteTicket(
      request.auth!, Number(request.params.id), input.reason, input.version, requestContext(request),
    );
    sendSuccess(response, 200, null, 'Ticket deleted successfully');
  }),
);

ticketsRouter.get(
  '/:id', param('id').isInt({ min: 1 }).toInt(), validateRequest,
  asyncHandler(async (request, response) => {
    sendSuccess(response, 200, await getTicketDetail(request.auth!, Number(request.params.id)));
  }),
);
