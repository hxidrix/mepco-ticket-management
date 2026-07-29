import { act, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import type * as FramerMotion from 'framer-motion';

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof FramerMotion>();
  return {
    ...actual,
    useReducedMotion: () => true,
  };
});

vi.mock('./components/SilkBackground', () => ({
  SilkBackground: () => <div data-testid="silk-background" />,
}));

vi.mock('./lib/auth-api', () => ({
  refreshRequest: vi.fn().mockRejectedValue(new Error('No existing session')),
  locationCatalogRequest: vi.fn().mockResolvedValue({ departments: [], circles: [] }),
  getApiErrorMessage: vi.fn().mockReturnValue('Unable to sign in'),
  loginRequest: vi.fn(),
  logoutRequest: vi.fn(),
  verifyEmployeeRequest: vi.fn(),
}));

import App from './App';

describe('public portal', () => {
  it('presents only the primary complaint actions after session discovery', async () => {
    await act(async () => {
      render(<App />);
      await Promise.resolve();
    });

    expect(await screen.findByRole('heading', { name: /report\. track\. resolve\./i })).toBeVisible();
    expect(screen.getByAltText('MEPCO')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Start complaint' })).toHaveAttribute('href', '/complaints/verify');
    expect(screen.getByRole('link', { name: 'Track complaint' })).toHaveAttribute('href', '/complaints/track');
    expect(screen.getByRole('link', { name: 'Employee / staff sign in' })).toHaveAttribute('href', '/login');
    expect(screen.getByTestId('silk-background')).toBeInTheDocument();
  });
});
