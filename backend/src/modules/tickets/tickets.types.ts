import type { UserRole } from '../auth/auth.types.js';

export type TicketDomain = 'consumer' | 'employee';

export interface TicketCreateInput {
  subject: string;
  description: string;
  categoryId: number;
  complaintTypeId: number;
  departmentId?: number;
  circleId?: number;
  cityId?: number;
  otherCategory?: string;
  otherComplaintType?: string;
  locationDetails?: string;
  priorityId?: number;
  idempotencyKey?: string;
}

export interface TicketClosureReviewInput {
  issueResolved: boolean;
  satisfactionRating: number;
  reviewText?: string;
  version: number;
}

export interface TicketActor {
  id: number;
  role: UserRole;
}

export interface TicketListInput {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  view?: 'open' | 'overdue';
  priority?: string;
  domain?: TicketDomain;
  categoryId?: number;
  departmentId?: number;
  circleId?: number;
  assigneeId?: number;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'ticketNumber' | 'priority' | 'status';
  sortOrder?: 'asc' | 'desc';
}
