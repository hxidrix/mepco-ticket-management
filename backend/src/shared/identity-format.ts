import type { LoginMode } from '../modules/auth/auth.types.js';

export const CONSUMER_REFERENCE_LENGTH = 14;
export const EMPLOYEE_ID_LENGTH = 8;
export const PHONE_NUMBER_LENGTH = 11;
export const CNIC_LENGTH = 13;

const consumerReferencePattern = /^\d{14}$/u;
const employeeIdInputPattern = /^\d{1,8}$/u;
const employeeIdStoredPattern = /^\d{8}$/u;
const phoneNumberPattern = /^03\d{9}$/u;
const cnicPattern = /^\d{13}$/u;

export function isConsumerReferenceNumber(value: string): boolean {
  return consumerReferencePattern.test(value.trim());
}

export function isEmployeeIdInput(value: string): boolean {
  return employeeIdInputPattern.test(value.trim());
}

export function isStoredEmployeeId(value: string): boolean {
  return employeeIdStoredPattern.test(value.trim());
}

export function isPhoneNumber(value: string): boolean {
  return phoneNumberPattern.test(value.trim());
}

export function isCnic(value: string): boolean {
  return cnicPattern.test(value.trim());
}

export function normalizeOptionalPhoneNumber(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

export function normalizeEmployeeId(value: string): string {
  const trimmed = value.trim();
  return isEmployeeIdInput(trimmed)
    ? trimmed.padStart(EMPLOYEE_ID_LENGTH, '0')
    : trimmed;
}

export function normalizeLoginIdentifier(mode: LoginMode, value: string): string {
  const trimmed = value.trim();
  return mode === 'employee' ? normalizeEmployeeId(trimmed) : trimmed;
}
