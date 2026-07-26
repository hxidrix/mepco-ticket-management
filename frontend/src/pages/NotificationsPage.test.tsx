import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  notificationsRequest: vi.fn(),
  markNotificationReadRequest: vi.fn(),
  markAllNotificationsReadRequest: vi.fn(),
}));

vi.mock('../lib/auth-api', () => ({
  getApiErrorMessage: (error: unknown) => error instanceof Error ? error.message : 'Notification request failed',
}));

vi.mock('../lib/notifications-api', () => ({
  notificationsRequest: mocks.notificationsRequest,
  markNotificationReadRequest: mocks.markNotificationReadRequest,
  markAllNotificationsReadRequest: mocks.markAllNotificationsReadRequest,
}));

import { NotificationsPage } from './NotificationsPage';

describe('Notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.notificationsRequest.mockResolvedValue({
      unreadCount: 1,
      items: [{
        id: 12,
        type: 'ticket.updated',
        title: 'Ticket updated',
        message: 'Your ticket has a new response.',
        targetType: 'ticket',
        targetId: 42,
        readAt: null,
        createdAt: '2026-07-26T12:00:00.000Z',
      }],
      meta: { page: 1, pageSize: 30, totalItems: 1, totalPages: 1 },
    });
    mocks.markNotificationReadRequest.mockResolvedValue(undefined);
  });

  it('provides clear mark-as-read and ticket actions', async () => {
    render(<MemoryRouter><NotificationsPage /></MemoryRouter>);

    const ticketLink = await screen.findByRole('link', { name: 'View ticket' });
    expect(ticketLink).toHaveAttribute('href', '/app/tickets/42');
    expect(ticketLink).toHaveClass('button', 'button--primary', 'notification-target-button');

    fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }));

    await waitFor(() => expect(mocks.markNotificationReadRequest).toHaveBeenCalledWith(12));
    expect(await screen.findByText('Read')).toBeVisible();
    expect(screen.getByRole('heading', { name: '0 unread' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Mark as read' })).not.toBeInTheDocument();
  });
});
