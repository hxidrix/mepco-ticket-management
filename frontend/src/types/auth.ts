export type UserRole = 'consumer' | 'employee' | 'technician' | 'supervisor' | 'administrator';
export type LoginMode = 'employee' | 'staff';

export interface EmployeeVerificationPreview {
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  office: string;
}

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

export interface LocationCatalogOptions {
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
