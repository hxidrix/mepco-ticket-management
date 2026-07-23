export type UserRole = 'consumer' | 'employee' | 'technician' | 'supervisor' | 'administrator';
export type LoginMode = 'consumer' | 'employee' | 'staff';

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

export interface RequestContext {
  requestId: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface ConsumerRegistrationInput {
  referenceNumber: string;
  name: string;
  email?: string;
  phone: string;
  password: string;
  address: string;
  circleId: number;
  divisionId: number;
  subdivisionId: number;
  serviceAddress?: string;
}

export interface EmployeeRegistrationInput {
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  password: string;
  departmentId: number;
  designation: string;
  workLocation: string;
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
