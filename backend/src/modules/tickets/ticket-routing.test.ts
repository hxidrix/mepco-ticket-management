import { describe, expect, it } from 'vitest';

import { consumerRoutingDepartment } from './ticket-routing.js';

describe('consumer ticket department routing', () => {
  it('routes line complaints to Operations', () => {
    expect(consumerRoutingDepartment('Line Complaints')).toBe('Operations (OP) Directorate');
  });

  it('routes non-line complaints and service requests to Customer Services', () => {
    expect(consumerRoutingDepartment('Non-Line Complaints')).toBe('Commercial/Customer Services Directorate (CSD)');
    expect(consumerRoutingDepartment('Leads / Requests / Others')).toBe('Commercial/Customer Services Directorate (CSD)');
  });

  it('uses Operations as the safe fallback', () => {
    expect(consumerRoutingDepartment('Other')).toBe('Operations (OP) Directorate');
    expect(consumerRoutingDepartment('A newly added category')).toBe('Operations (OP) Directorate');
  });
});
