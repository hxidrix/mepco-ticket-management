export type UserRole = 'consumer' | 'employee' | 'technician' | 'supervisor' | 'administrator';
export type LoginMode = 'consumer' | 'employee' | 'staff';

export interface AuthUser {
  id: number;
  role: UserRole;
  displayName: string;
  status: 'active' | 'suspended';
}

export interface AuthPayload {
  user: AuthUser;
  accessToken: string;
  expiresIn: number;
}

export interface RegistrationOptions {
  selfRegistrationEnabled: boolean;
  departments: Array<{ id: number; name: string }>;
  circles: Array<{
    id: number;
    name: string;
    divisions: Array<{
      id: number;
      name: string;
      subdivisions: Array<{ id: number; name: string }>;
    }>;
  }>;
}
