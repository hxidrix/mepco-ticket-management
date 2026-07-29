import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LocationCatalogOptions } from '../types/auth';
import type { UserProfile } from '../types/users';

const mocks = vi.hoisted(() => ({
  profileRequest: vi.fn(),
  updateProfileRequest: vi.fn(),
  changePasswordRequest: vi.fn(),
  locationCatalogRequest: vi.fn(),
  updateDisplayName: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 2, displayName: 'Hamza Demo Employee', role: 'employee', status: 'active' },
    updateDisplayName: mocks.updateDisplayName,
    logout: mocks.logout,
  }),
}));

vi.mock('../lib/auth-api', () => ({
  getApiErrorMessage: (error: unknown) => error instanceof Error ? error.message : 'Profile request failed',
  locationCatalogRequest: mocks.locationCatalogRequest,
}));

vi.mock('../lib/users-api', () => ({
  profileRequest: mocks.profileRequest,
  updateProfileRequest: mocks.updateProfileRequest,
  changePasswordRequest: mocks.changePasswordRequest,
}));

import { ProfilePage } from './ProfilePage';

const options: LocationCatalogOptions = {
  departments: [{ id: 1, name: 'Information Technology' }],
  circles: [{
    id: 10,
    name: 'Multan Circle',
    divisions: [{
      id: 20,
      name: 'Multan Cantt Division',
      subdivisions: [{ id: 30, name: 'Cantt' }],
    }],
  }],
};

const legacyProfile: UserProfile = {
  id: 2,
  role: 'employee',
  displayName: 'Hamza Demo Employee',
  username: null,
  email: 'employee.demo@example.test',
  phone: '03002222222',
  cnic: '3520200000002',
  status: 'active',
  statusReason: null,
  lastLoginAt: null,
  createdAt: '2026-07-14T12:00:00.000Z',
  employeeId: '00000001',
  departmentId: 1,
  departmentName: 'Information Technology',
  designation: 'Junior Software Engineer',
  workLocation: 'Legacy free-text office',
};

describe('My Profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.profileRequest.mockResolvedValue(legacyProfile);
    mocks.locationCatalogRequest.mockResolvedValue(options);
    mocks.updateProfileRequest.mockImplementation((input: Record<string, unknown>) => Promise.resolve({
      ...legacyProfile,
      ...input,
      circleName: 'Multan Circle',
      divisionName: 'Multan Cantt Division',
      subdivisionName: 'Cantt',
    }));
  });

  it('loads a legacy employee profile and confirms a structured-location save beside the button', async () => {
    render(<ProfilePage />);

    expect(await screen.findByRole('heading', { name: 'My profile' })).toBeVisible();
    expect(screen.getByLabelText('Work circle')).toHaveValue('');

    fireEvent.change(screen.getByLabelText('Work circle'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => expect(mocks.updateProfileRequest).toHaveBeenCalledWith(
      expect.objectContaining({ circleId: 10, divisionId: 20, subdivisionId: 30 }),
    ));
    expect(await screen.findByRole('status')).toHaveTextContent('Changes saved successfully.');
  });
});
