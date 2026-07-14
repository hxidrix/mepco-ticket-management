import type { Response } from 'express';

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export function sendSuccess<T>(
  response: Response,
  statusCode: number,
  data: T,
  message?: string,
  meta: PaginationMeta | null = null,
): Response {
  return response.status(statusCode).json({
    success: true,
    ...(message === undefined ? {} : { message }),
    data,
    meta,
  });
}

