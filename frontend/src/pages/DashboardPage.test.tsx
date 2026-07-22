import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import type { TicketSummary } from '../types/tickets';
import { DashboardPage } from './DashboardPage';

vi.mock('framer-motion', () => ({
  motion: {
    main: ({ children }: { children?: React.ReactNode }) => <main>{children}</main>,
  },
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 2, displayName: 'Hamza Demo Employee', role: 'employee', status: 'active' },
  }),
}));

const pendingTicket = vi.hoisted(() => ({
  id: 4,
  ticketNumber: 'MEPCO-2026-000004',
  domain: 'employee',
  subject: 'VPN details required',
  description: 'Additional connection details are required.',
  categoryId: 1,
  categoryName: 'Information Technology',
  complaintTypeId: 1,
  complaintTypeName: 'Network & Connectivity',
  departmentName: 'Information Technology',
  circleName: null,
  cityName: null,
  priorityId: 1,
  priorityName: 'Low',
  prioritySlug: 'low',
  priorityColor: '#22a06b',
  complaintSlaTargetHours: 48,
  slaTargetHours: 48,
  slaDueAt: '2026-07-22T12:00:00.000Z',
  isOverdue: 0,
  statusName: 'Pending User',
  statusSlug: 'pending-user',
  assigneeId: 7,
  assigneeName: 'Demo Technician',
  requesterId: 2,
  requesterName: 'Hamza Demo Employee',
  resolutionSummary: null,
  version: 2,
  createdAt: '2026-07-06T18:15:00.000Z',
  updatedAt: '2026-07-14T23:15:00.000Z',
} satisfies TicketSummary));

vi.mock('../lib/tickets-api', () => ({
  ticketMetricsRequest: vi.fn().mockResolvedValue({
    summary: { total: 4, open: 2, overdue: 2, resolved: 1, averageResolutionHours: '12.5' },
    byStatus: [{ label: 'Pending User', count: 2 }],
    byPriority: [{ label: 'Low', count: 1 }],
    workload: [],
    recent: [pendingTicket],
  }),
  ticketsRequest: vi.fn().mockResolvedValue({
    items: [pendingTicket],
    meta: { page: 1, pageSize: 4, totalItems: 2, totalPages: 1 },
  }),
}));

vi.mock('../lib/administration-api', () => ({
  activeAnnouncementsRequest: vi.fn().mockResolvedValue([{
    id: 1,
    title: 'Planned maintenance notice',
    body: 'Service maintenance is scheduled for tonight.',
    authorName: 'MEPCO Administrator',
    startsAt: '2026-07-14T12:00:00.000Z',
    endsAt: null,
    isActive: 1,
    audiences: ['employee'],
    createdAt: '2026-07-14T12:00:00.000Z',
    updatedAt: '2026-07-14T12:00:00.000Z',
  }]),
}));

vi.mock('../lib/auth-api', () => ({
  getApiErrorMessage: vi.fn().mockReturnValue('Unable to load dashboard'),
}));

describe('dashboard overview', () => {
  it('shows response-needed tickets and links to the filtered queue', async () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Waiting for your response' })).toBeVisible();
    expect(screen.getAllByText('VPN details required')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'View all awaiting-response tickets' }))
      .toHaveAttribute('href', '/app/tickets?status=pending-user');
    expect(await screen.findByRole('heading', { name: 'Announcements' })).toBeVisible();
    expect(screen.getByText('Planned maintenance notice')).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Queue health' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View all visible tickets' })).toHaveAttribute('href', '/app/tickets');
    expect(screen.getByRole('link', { name: 'View open tickets' })).toHaveAttribute('href', '/app/tickets?view=open');
    expect(screen.getByRole('link', { name: 'View tickets awaiting a response' })).toHaveAttribute('href', '/app/tickets?status=pending-user');
    expect(screen.getByRole('link', { name: 'View tickets past SLA' })).toHaveAttribute('href', '/app/tickets?view=overdue');
  });
});
