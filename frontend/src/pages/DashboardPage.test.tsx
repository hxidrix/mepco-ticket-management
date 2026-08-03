import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import { DashboardPage } from './DashboardPage';

vi.mock('framer-motion', () => ({ motion: { main: ({ children }: { children?: React.ReactNode }) => <main>{children}</main> } }));
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 2, displayName: 'Hamza Demo Employee', role: 'employee', status: 'active' } }),
}));
vi.mock('../lib/tickets-api', () => ({
  ticketMetricsRequest: vi.fn().mockResolvedValue({
    summary: { total: 4, open: 2, overdue: 1, resolved: 2, averageResolutionHours: 12.5 },
    byStatus: [{ label: 'In Progress', count: 2 }],
    byPriority: [{ label: 'Low', count: 1 }],
    workload: [],
    recent: [{
      id: 4, ticketNumber: '2026000004', subject: 'VPN configuration in progress',
      categoryName: 'Information Technology', statusName: 'In Progress',
      statusSlug: 'in-progress', updatedAt: '2026-07-14T23:15:00.000Z',
    }],
  }),
}));
vi.mock('../lib/administration-api', () => ({
  activeAnnouncementsRequest: vi.fn().mockResolvedValue([{
    id: 1, title: 'Planned maintenance notice', body: 'Service maintenance is scheduled for tonight.',
    authorName: 'MEPCO Administrator', startsAt: '2026-07-14T12:00:00.000Z', endsAt: null,
    isActive: 1, audiences: ['employee'], createdAt: '2026-07-14T12:00:00.000Z',
    updatedAt: '2026-07-14T12:00:00.000Z',
  }]),
}));
vi.mock('../lib/auth-api', () => ({ getApiErrorMessage: vi.fn().mockReturnValue('Unable to load dashboard') }));

describe('dashboard overview', () => {
  it('shows the active queue, SLA risk, recent tickets, and announcements without a response-wait queue', async () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Announcements' })).toBeVisible();
    expect(screen.getByText('Planned maintenance notice')).toBeVisible();
    expect(screen.getByText('VPN configuration in progress')).toBeVisible();
    expect(screen.queryByText(/awaiting response/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/response watch/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View all visible tickets' })).toHaveAttribute('href', '/app/tickets');
    expect(screen.getByRole('link', { name: 'View open tickets' })).toHaveAttribute('href', '/app/tickets?view=open');
    expect(screen.getByRole('link', { name: 'View tickets past SLA' })).toHaveAttribute('href', '/app/tickets?view=overdue');
  });
});
