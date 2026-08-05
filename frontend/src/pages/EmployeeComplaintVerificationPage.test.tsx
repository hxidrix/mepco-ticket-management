import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, vi } from 'vitest';

import { EmployeeComplaintVerificationPage } from './EmployeeComplaintVerificationPage';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  verifyEmployeeRequest: vi.fn(),
}));

vi.mock('../components/SilkBackground', () => ({
  SilkBackground: () => <div data-testid="silk-background" />,
}));

vi.mock('../components/ThemeToggle', () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: null, login: mocks.login }),
}));

vi.mock('../lib/auth-api', () => ({
  getApiErrorMessage: () => 'Unable to verify employee',
  verifyEmployeeRequest: mocks.verifyEmployeeRequest,
}));

describe('employee complaint verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyEmployeeRequest.mockResolvedValue({
      employeeId: '****0001',
      name: 'M***** E*******',
      email: 'm***@mepco.test',
      phone: '*******0001',
      department: 'Operations',
      office: 'Multan Cantt Division / Cantt',
    });
    mocks.login.mockResolvedValue({
      id: 2,
      role: 'employee',
      displayName: 'MEPCO Employee',
      status: 'active',
    });
  });

  it('verifies Employee ID and CNIC suffix before starting an authenticated complaint', async () => {
    render(
      <MemoryRouter initialEntries={['/employee/complaints/verify']}>
        <Routes>
          <Route path="/employee/complaints/verify" element={<EmployeeComplaintVerificationPage />} />
          <Route path="/app/tickets/new" element={<h1>Employee complaint form</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Employee ID'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Last 4 digits of CNIC'), { target: { value: '0002' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify employee' }));

    await waitFor(() => expect(mocks.verifyEmployeeRequest).toHaveBeenCalledWith('00000001', '0002'));
    expect(await screen.findByText('****0001')).toBeVisible();
    expect(screen.queryByText('m***@mepco.test')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Continue to complaint' }));
    await waitFor(() => expect(mocks.login).toHaveBeenCalledWith('employee', '00000001', '0002'));
    expect(await screen.findByRole('heading', { name: 'Employee complaint form' })).toBeVisible();
  });
});
