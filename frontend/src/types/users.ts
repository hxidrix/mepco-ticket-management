import type { UserRole } from './auth';

export type UserStatus = 'active' | 'suspended' | 'inactive';
export type StaffRole = 'technician' | 'supervisor' | 'administrator';

export interface UserProfile {
  id: number;
  role: UserRole;
  displayName: string;
  username: string | null;
  email: string | null;
  phone: string | null;
  status: UserStatus;
  statusReason: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  referenceNumber?: string;
  address?: string;
  circleId?: number;
  circleName?: string;
  cityId?: number;
  cityName?: string;
  serviceAddress?: string | null;
  employeeId?: string;
  departmentId?: number | null;
  departmentName?: string | null;
  designation?: string;
  workLocation?: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}
