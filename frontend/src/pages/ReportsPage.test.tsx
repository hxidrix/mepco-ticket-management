import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MasterCatalog } from '../types/master-data';
import type { TicketMetrics } from '../lib/tickets-api';

const mocks = vi.hoisted(() => ({
  ticketMetricsRequest: vi.fn(),
  exportTicketsRequest: vi.fn(),
  catalogRequest: vi.fn(),
}));

vi.mock('../lib/auth-api', () => ({
  getApiErrorMessage: (error: unknown) => error instanceof Error ? error.message : 'Report request failed',
}));

vi.mock('../lib/tickets-api', () => ({
  ticketMetricsRequest: mocks.ticketMetricsRequest,
  exportTicketsRequest: mocks.exportTicketsRequest,
}));

vi.mock('../lib/master-data-api', () => ({ catalogRequest: mocks.catalogRequest }));

import { ReportsPage } from './ReportsPage';

const metrics: TicketMetrics = {
  summary: { total: 10, open: 5, overdue: 1, resolved: 8, averageResolutionHours: 18.5 },
  byStatus: [{ label: 'In Progress', count: 5 }, { label: 'Resolved', count: 5 }],
  byPriority: [{ label: 'High', count: 4 }, { label: 'Low', count: 6 }],
  workload: [{ assigneeId: 7, assigneeName: 'Sara IT Technician', count: 3 }],
  recent: [{
    id: 42,
    ticketNumber: '2026000042',
    domain: 'consumer',
    subject: 'Power supply interruption',
    description: 'Supply is unavailable.',
    categoryId: 1,
    categoryName: 'Line Complaints',
    complaintTypeId: 2,
    complaintTypeName: 'Power Outage',
    departmentName: 'Operations',
    circleName: 'Multan Circle',
    divisionName: 'Multan Cantt Division',
    subdivisionName: 'Cantt',
    priorityId: 2,
    priorityName: 'High',
    prioritySlug: 'high',
    priorityColor: '#e24a55',
    complaintSlaTargetHours: 12,
    slaTargetHours: 12,
    slaDueAt: '2026-07-27T12:00:00.000Z',
    isOverdue: 1,
    statusName: 'In Progress',
    statusSlug: 'in-progress',
    assigneeId: 7,
    assigneeName: 'Sara IT Technician',
    requesterId: 2,
    requesterName: 'Ayesha Consumer',
    resolutionSummary: null,
    version: 1,
    createdAt: '2026-07-26T12:00:00.000Z',
    updatedAt: '2026-07-26T13:00:00.000Z',
  }],
};

const catalog: MasterCatalog = {
  departments: [],
  circles: [{
    id: 10, name: 'Multan Circle', slug: 'multan-circle', description: null, isActive: true, sortOrder: 1,
    divisions: [{
      id: 20, name: 'Multan Cantt Division', slug: 'multan-cantt', description: null, isActive: true, sortOrder: 1,
      subdivisions: [{ id: 30, name: 'Cantt', slug: 'cantt', description: null, isActive: true, sortOrder: 1 }],
    }],
  }],
  categories: [{
    id: 1, name: 'Line Complaints', slug: 'line-complaints', description: null, isActive: true, sortOrder: 1, domain: 'consumer',
    complaintTypes: [{ id: 2, name: 'Power Outage', slug: 'power-outage', description: null, isActive: true, sortOrder: 1, slaTargetHours: 12 }],
  }],
  priorities: [{ id: 2, name: 'High', slug: 'high', description: null, isActive: true, sortOrder: 1, slaTargetHours: 24 }],
  statuses: [{ id: 3, name: 'In Progress', slug: 'in-progress', description: null, isActive: true, sortOrder: 1 }],
};

describe('Reports and SLA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ticketMetricsRequest.mockResolvedValue(metrics);
    mocks.catalogRequest.mockResolvedValue(catalog);
    mocks.exportTicketsRequest.mockResolvedValue(undefined);
  });

  it('shows operational health, SLA targets, and applies export filters', async () => {
    render(<MemoryRouter><ReportsPage /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Reports & SLA' })).toBeVisible();
    expect(screen.getAllByText('80%')).toHaveLength(2);
    expect(screen.getByText('Power Outage')).toBeVisible();
    expect(screen.getByText('12 hours')).toBeVisible();
    expect(screen.getByRole('link', { name: /2026000042/u })).toHaveAttribute('href', '/app/tickets/42');

    fireEvent.change(screen.getByLabelText('Ticket domain'), { target: { value: 'consumer' } });
    fireEvent.change(screen.getByLabelText('Circle'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Division'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('Sub-division'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Export PDF' }));

    await waitFor(() => expect(mocks.exportTicketsRequest).toHaveBeenCalledWith('pdf', {
      domain: 'consumer', circleId: '10', divisionId: '20', subdivisionId: '30',
    }));
  });
});
