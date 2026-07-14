import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import type { UserRole } from '../types/auth';

export function RoleRoute({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { user } = useAuth();
  if (user === null || !roles.includes(user.role)) return <Navigate to="/app" replace />;
  return children;
}
