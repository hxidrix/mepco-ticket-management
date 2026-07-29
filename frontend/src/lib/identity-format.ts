import type { LoginMode } from '../types/auth';

export const CONSUMER_REFERENCE_LENGTH = 14;
export const CONSUMER_ID_LENGTH = 10;
export const EMPLOYEE_ID_LENGTH = 8;
export const PHONE_NUMBER_LENGTH = 11;
export const PHONE_NUMBER_PATTERN = '03[0-9]{9}';
export const CNIC_LENGTH = 13;
export const CNIC_PATTERN = '[0-9]{13}';

const employeeIdInputPattern = /^\d{1,8}$/u;

export function normalizeEmployeeId(value: string): string {
  const trimmed = value.trim();
  return employeeIdInputPattern.test(trimmed)
    ? trimmed.padStart(EMPLOYEE_ID_LENGTH, '0')
    : trimmed;
}

export function normalizeLoginIdentifier(mode: LoginMode, value: string): string {
  const trimmed = value.trim();
  return mode === 'employee' ? normalizeEmployeeId(trimmed) : trimmed;
}
