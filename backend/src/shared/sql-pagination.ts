export function sqlPagination(page: number, pageSize: number): string {
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new RangeError('page must be a positive safe integer');
  }
  if (!Number.isSafeInteger(pageSize) || pageSize < 1) {
    throw new RangeError('pageSize must be a positive safe integer');
  }

  const offset = (page - 1) * pageSize;
  if (!Number.isSafeInteger(offset)) {
    throw new RangeError('pagination offset exceeds the safe integer range');
  }

  // MySQL 8.4 can reject native prepared-statement placeholders in LIMIT/OFFSET.
  // These values are safe to interpolate after the integer checks above.
  return `LIMIT ${pageSize} OFFSET ${offset}`;
}
