import { describe, expect, it } from 'vitest';

import { sqlPagination } from './sql-pagination.js';

describe('sqlPagination', () => {
  it('returns a numeric limit and offset clause', () => {
    expect(sqlPagination(3, 20)).toBe('LIMIT 20 OFFSET 40');
  });

  it.each([
    [0, 20],
    [1.5, 20],
    [1, 0],
    [1, Number.NaN],
  ])('rejects unsafe pagination values: page=%s pageSize=%s', (page, pageSize) => {
    expect(() => sqlPagination(page, pageSize)).toThrow(RangeError);
  });
});
