import { StrictMode } from 'react';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthPayload } from '../types/auth';

const { loginRequest, logoutRequest, refreshRequest, setApiAccessToken } = vi.hoisted(() => ({
  loginRequest: vi.fn(),
  logoutRequest: vi.fn(),
  refreshRequest: vi.fn(),
  setApiAccessToken: vi.fn(),
}));

vi.mock('../lib/auth-api', () => ({
  loginRequest,
  logoutRequest,
  refreshRequest,
}));

vi.mock('../lib/api', () => ({
  setApiAccessToken,
}));

import { AuthProvider } from './AuthProvider';
import { useAuth } from '../hooks/useAuth';

const restoredSession: AuthPayload = {
  user: { id: 1, role: 'consumer', displayName: 'Ayesha' },
  accessToken: 'short-lived-access-token',
  expiresIn: 900,
};

function SessionProbe() {
  const { isLoading, user } = useAuth();
  if (isLoading) return <p>Loading</p>;
  return <p>{user === null ? 'Signed out' : `Signed in as ${user.displayName}`}</p>;
}

describe('AuthProvider session restoration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refreshRequest.mockResolvedValue(restoredSession);
  });

  it('restores a refresh-cookie session once when React Strict Mode remounts effects', async () => {
    await act(async () => {
      render(
        <StrictMode>
          <AuthProvider>
            <SessionProbe />
          </AuthProvider>
        </StrictMode>,
      );
      await Promise.resolve();
    });

    expect(await screen.findByText('Signed in as Ayesha')).toBeVisible();
    expect(refreshRequest).toHaveBeenCalledTimes(1);
    expect(setApiAccessToken).toHaveBeenCalledWith(restoredSession.accessToken);
  });
});
