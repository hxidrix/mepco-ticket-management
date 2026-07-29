export type UserRole = 'consumer' | 'employee' | 'technician' | 'supervisor' | 'administrator';
export type LoginMode = 'employee' | 'staff';

export interface AuthenticatedUser {
  id: number;
  role: UserRole;
  displayName: string;
  status: 'active' | 'suspended';
}

export interface LoginCandidate {
  id: number;
  role: UserRole;
  displayName: string;
  passwordHash: string;
  status: 'active' | 'suspended' | 'inactive';
  lockedUntil: Date | null;
}

export interface EmployeeVerificationCandidate extends LoginCandidate {
  employeeId: string;
  cnic: string | null;
  email: string | null;
  phone: string | null;
  departmentName: string;
  office: string;
}

export interface RequestContext {
  requestId: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface RefreshSessionRecord {
  id: string;
  familyId: string;
  user: AuthenticatedUser;
  status: 'active' | 'suspended';
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface NewRefreshSession {
  id: string;
  familyId: string;
  userId: number;
  tokenJtiHash: string;
  expiresAt: Date;
}
