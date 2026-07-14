export type UserRole = 'consumer' | 'employee' | 'technician' | 'supervisor' | 'administrator';
export type LoginMode = 'consumer' | 'employee' | 'staff';

export interface AuthUser {
  id: number;
  role: UserRole;
  displayName: string;
}

export interface AuthPayload {
  user: AuthUser;
  accessToken: string;
  expiresIn: number;
}

export interface RegistrationOptions {
  departments: Array<{ id: number; name: string }>;
  circles: Array<{
    id: number;
    name: string;
    cities: Array<{ id: number; name: string }>;
  }>;
}

