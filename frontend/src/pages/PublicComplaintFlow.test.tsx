import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';

import { PublicComplaintProvider } from '../context/PublicComplaintProvider';
import { ConsumerVerificationPage } from './ConsumerVerificationPage';
import { TrackComplaintPage } from './TrackComplaintPage';

const mocks = vi.hoisted(() => ({
  verifyConsumerRequest: vi.fn(),
  trackPublicComplaintRequest: vi.fn(),
}));

vi.mock('../components/SilkBackground', () => ({
  SilkBackground: () => <div data-testid="silk-background" />,
}));

vi.mock('../components/ThemeToggle', () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

vi.mock('../lib/public-complaints-api', () => ({
  verifyConsumerRequest: mocks.verifyConsumerRequest,
  trackPublicComplaintRequest: mocks.trackPublicComplaintRequest,
}));

function renderVerification() {
  render(
    <MemoryRouter initialEntries={['/complaints/verify']}>
      <PublicComplaintProvider>
        <Routes>
          <Route path="/complaints/verify" element={<ConsumerVerificationPage />} />
          <Route path="/complaints/new" element={<h1>Complaint form</h1>} />
        </Routes>
      </PublicComplaintProvider>
    </MemoryRouter>,
  );
}

describe('public complaint flow', () => {
  it('shows only a masked consumer preview before continuing to the complaint form', async () => {
    mocks.verifyConsumerRequest.mockResolvedValue({
      referenceNumber: '**********8901',
      consumerId: '******6789',
      name: 'M******* A*****',
      subdivision: 'Cantt',
      tariff: 'A-1a Residential',
      hasRegisteredPhone: true,
    });
    renderVerification();

    fireEvent.change(screen.getByLabelText('Reference Number'), {
      target: { value: '10012345678901' },
    });
    fireEvent.change(screen.getByLabelText('Consumer ID'), {
      target: { value: '0123456789' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify details' }));

    expect(await screen.findByText('**********8901')).toBeVisible();
    expect(screen.queryByText('10012345678901')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Complaint form' })).toBeVisible();
  });

  it('requires and sends the tracking number, Reference Number, and Consumer ID', async () => {
    mocks.trackPublicComplaintRequest.mockResolvedValue({
      ticketNumber: '2026123456',
      subject: 'Voltage fluctuation',
      description: 'Lights repeatedly dim during evening peak hours.',
      categoryName: 'Line Complaints',
      complaintTypeName: 'Fluctuation',
      departmentName: null,
      priorityName: 'High',
      statusName: 'Assigned',
      statusSlug: 'assigned',
      circleName: 'Multan Circle',
      divisionName: 'Multan Cantt Division',
      subdivisionName: 'Cantt',
      locationDetails: 'Near the main market',
      slaTargetHours: 24,
      slaDueAt: '2026-07-30T06:00:00.000Z',
      resolutionSummary: null,
      createdAt: '2026-07-29T06:00:00.000Z',
      updatedAt: '2026-07-29T06:05:00.000Z',
      resolvedAt: null,
      closedAt: null,
    });
    render(
      <MemoryRouter>
        <TrackComplaintPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Tracking number'), {
      target: { value: '2026123456' },
    });
    fireEvent.change(screen.getByLabelText('Reference Number'), {
      target: { value: '10012345678901' },
    });
    fireEvent.change(screen.getByLabelText('Consumer ID'), {
      target: { value: '0123456789' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Track complaint' }));

    await waitFor(() => expect(mocks.trackPublicComplaintRequest).toHaveBeenCalledWith({
      ticketNumber: '2026123456',
      referenceNumber: '10012345678901',
      consumerId: '0123456789',
    }));
    expect(await screen.findByRole('heading', { name: 'Voltage fluctuation' })).toBeVisible();
    expect(screen.getByText('Assigned')).toBeVisible();
  });
});
