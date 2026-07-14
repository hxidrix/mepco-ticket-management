import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import type * as FramerMotion from 'framer-motion';

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof FramerMotion>();
  return {
    ...actual,
    useReducedMotion: () => true,
  };
});

vi.mock('./components/DotGridCanvas', () => ({
  DotGridCanvas: () => <div data-testid="dot-grid" />,
}));

vi.mock('./lib/auth-api', () => ({
  refreshRequest: vi.fn().mockRejectedValue(new Error('No existing session')),
  registrationOptionsRequest: vi.fn().mockResolvedValue({ departments: [], circles: [] }),
  getApiErrorMessage: vi.fn().mockReturnValue('Unable to sign in'),
  loginRequest: vi.fn(),
  logoutRequest: vi.fn(),
  registerConsumerRequest: vi.fn(),
  registerEmployeeRequest: vi.fn(),
}));

import App from './App';

describe('authentication page', () => {
  it('presents the branded identity modes after session discovery', async () => {
    render(<App />);

    expect(await screen.findByRole('heading', { name: /report\. track\. resolve\./i })).toBeVisible();
    expect(screen.getByAltText('MEPCO')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Consumer' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Employee' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Staff' })).toBeVisible();
    expect(screen.getByTestId('dot-grid')).toBeInTheDocument();
  });
});
