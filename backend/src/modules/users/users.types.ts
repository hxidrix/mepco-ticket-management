import type { UserRole } from '../auth/auth.types.js';

export type UserStatus = 'active' | 'suspended' | 'inactive';
export type StaffRole = 'technician' | 'supervisor' | 'administrator';

export interface UserProfile {
  id: number;
  role: UserRole;
  displayName: string;
  username: string | null;
  email: string | null;
  phone: string | null;
  cnic: string | null;
  status: UserStatus;
  statusReason: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  referenceNumber?: string;
  address?: string;
  circleId?: number;
  circleName?: string;
  divisionId?: number;
  divisionName?: string;
  subdivisionId?: number;
  subdivisionName?: string;
  serviceAddress?: string | null;
  employeeId?: string;
  departmentId?: number | null;
  departmentName?: string | null;
  designation?: string;
  workLocation?: string;
}

export interface ProfileUpdateInput {
  displayName: string;
  email?: string;
  phone?: string;
  cnic: string;
  address?: string;
  circleId?: number;
  divisionId?: number;
  subdivisionId?: number;
  serviceAddress?: string;
  departmentId?: number;
  designation?: string;
  workLocation?: string;
}

export interface StaffCreateInput {
  role: StaffRole;
  username: string;
  displayName: string;
  email?: string;
  phone?: string;
  cnic: string;
  password: string;
  departmentId?: number;
  designation: string;
  workLocation: string;
}

export interface AdminUserUpdateInput {
  displayName: string;
  email?: string;
  phone?: string;
  cnic?: string;
  status: UserStatus;
  statusReason?: string;
  role?: StaffRole;
  departmentId?: number;
  designation?: string;
  workLocation?: string;
}
