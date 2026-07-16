export type TicketDomain = 'consumer' | 'employee';

export interface TicketSummary {
  id: number;
  ticketNumber: string;
  domain: TicketDomain;
  subject: string;
  description: string;
  categoryId: number;
  categoryName: string;
  complaintTypeId: number;
  complaintTypeName: string;
  departmentName: string | null;
  circleName: string | null;
  cityName: string | null;
  priorityId: number;
  priorityName: string;
  prioritySlug: string;
  priorityColor: string;
  statusName: string;
  statusSlug: string;
  assigneeId: number | null;
  assigneeName: string | null;
  requesterId: number;
  requesterName: string;
  resolutionSummary: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface TicketComment {
  id: number; visibility: 'public' | 'internal'; body: string; createdAt: string;
  authorId: number; authorName: string; authorRole: string;
}

export interface TicketHistory {
  id: number; eventType: string; oldValue: unknown; newValue: unknown;
  reason: string | null; createdAt: string; actorName: string | null;
}

export interface TicketAttachment {
  id: number; originalName: string; mimeType: string; sizeBytes: number; createdAt: string;
}

export interface TicketReview {
  id: number;
  issueResolved: boolean;
  satisfactionRating: number;
  reviewText: string | null;
  requesterId: number;
  requesterName: string;
  createdAt: string;
}

export interface TicketDetail {
  ticket: TicketSummary;
  comments: TicketComment[];
  history: TicketHistory[];
  attachments: TicketAttachment[];
  review: TicketReview | null;
  allowedStatusTransitions: string[];
}
