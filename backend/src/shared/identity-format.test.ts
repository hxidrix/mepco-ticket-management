import { describe, expect, it } from 'vitest';

import {
  isConsumerReferenceNumber,
  isCnic,
  isEmployeeIdInput,
  isPhoneNumber,
  isStoredEmployeeId,
  normalizeEmployeeId,
  normalizeLoginIdentifier,
  normalizeOptionalPhoneNumber,
} from './identity-format.js';

describe('identity formats', () => {
  it('accepts only 14-digit consumer reference numbers', () => {
    expect(isConsumerReferenceNumber('10000000000001')).toBe(true);
    expect(isConsumerReferenceNumber('1000000000001')).toBe(false);
    expect(isConsumerReferenceNumber('1000000000000A')).toBe(false);
  });

  it('normalizes employee codes to eight digits with leading zeroes', () => {
    expect(isEmployeeIdInput('1')).toBe(true);
    expect(normalizeEmployeeId('1')).toBe('00000001');
    expect(normalizeEmployeeId(' 12345678 ')).toBe('12345678');
    expect(isStoredEmployeeId('00000001')).toBe(true);
  });

  it('does not normalize malformed or overlong employee IDs', () => {
    expect(isEmployeeIdInput('EMP-1')).toBe(false);
    expect(isEmployeeIdInput('123456789')).toBe(false);
    expect(normalizeEmployeeId('EMP-1')).toBe('EMP-1');
  });

  it('normalizes employee login identifiers without changing other login modes', () => {
    expect(normalizeLoginIdentifier('employee', '42')).toBe('00000042');
    expect(normalizeLoginIdentifier('consumer', ' 10000000000001 ')).toBe('10000000000001');
    expect(normalizeLoginIdentifier('staff', ' tech.it ')).toBe('tech.it');
  });

  it('accepts only 11-digit phone numbers beginning with 03', () => {
    expect(isPhoneNumber('03001234567')).toBe(true);
    expect(isPhoneNumber('02001234567')).toBe(false);
    expect(isPhoneNumber('0300-1234567')).toBe(false);
    expect(isPhoneNumber('0300123456')).toBe(false);
    expect(normalizeOptionalPhoneNumber('')).toBeNull();
    expect(normalizeOptionalPhoneNumber(' 03001234567 ')).toBe('03001234567');
  });

  it('recognizes the confirmed 13-digit CNIC format', () => {
    expect(isCnic('3520212345671')).toBe(true);
    expect(isCnic('35202-1234567-1')).toBe(false);
    expect(isCnic('352021234567')).toBe(false);
  });
});
