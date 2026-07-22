import { createContext } from 'react';

import type { AuthUser, LoginMode } from '../types/auth';

export interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (mode: LoginMode, identifier: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  updateDisplayName: (displayName: string) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
