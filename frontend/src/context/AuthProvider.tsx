import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { loginRequest, logoutRequest, refreshRequest } from '../lib/auth-api';
import { setApiAccessToken } from '../lib/api';
import type { AuthPayload, AuthUser, LoginMode } from '../types/auth';
import { AuthContext } from './auth-context';

let sessionDiscoveryPromise: Promise<AuthPayload> | null = null;

function discoverSession(): Promise<AuthPayload> {
  if (sessionDiscoveryPromise === null) {
    const pendingRequest = refreshRequest();
    sessionDiscoveryPromise = pendingRequest;
    void pendingRequest.then(
      () => {
        if (sessionDiscoveryPromise === pendingRequest) sessionDiscoveryPromise = null;
      },
      () => {
        if (sessionDiscoveryPromise === pendingRequest) sessionDiscoveryPromise = null;
      },
    );
  }
  return sessionDiscoveryPromise;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    discoverSession()
      .then((payload) => {
        if (!active) return;
        setApiAccessToken(payload.accessToken);
        setUser(payload.user);
      })
      .catch(() => {
        if (!active) return;
        setApiAccessToken(null);
        setUser(null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (mode: LoginMode, identifier: string, password: string) => {
    const payload = await loginRequest(mode, identifier, password);
    setApiAccessToken(payload.accessToken);
    setUser(payload.user);
    return payload.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setApiAccessToken(null);
      setUser(null);
    }
  }, []);

  const updateDisplayName = useCallback((displayName: string) => {
    setUser((current) => current === null ? null : { ...current, displayName });
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, logout, updateDisplayName }),
    [isLoading, login, logout, updateDisplayName, user],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
