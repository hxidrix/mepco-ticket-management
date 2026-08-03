import {
  categories,
  circles,
  complaintTypeSlaTargetHours,
  departments,
  roles,
  ticketStatuses,
} from './catalog-data.js';

describe('SRS master-data seed', () => {
  it('contains all five roles and all lifecycle statuses', () => {
    expect(roles.map(([name]) => name)).toEqual([
      'consumer',
      'employee',
      'technician',
      'supervisor',
      'administrator',
    ]);
    expect(ticketStatuses).toHaveLength(7);
  });

  it('contains the complete department and operational circle lists', () => {
    expect(departments).toHaveLength(14);
    expect(circles).toHaveLength(11);
    expect(circles.flatMap((circle) => circle.divisions)).toHaveLength(55);
    expect(circles.flatMap((circle) => circle.divisions)
      .flatMap((division) => division.subdivisions)).toHaveLength(169);
    expect(circles.every((circle) =>
      circle.divisions.some((division) => division.name === 'Other Division'
        && division.subdivisions.includes('Other Sub-division')))).toBe(true);
  });

  it('includes Other in every category and preserves both service domains', () => {
    expect(categories.some((category) => category.domain === 'consumer')).toBe(true);
    expect(categories.some((category) => category.domain === 'employee')).toBe(true);
    expect(categories.every((category) => category.complaintTypes.includes('Other'))).toBe(true);
    expect(categories).toHaveLength(18);
  });

  it('does not contain duplicate complaint slugs inside a category', async () => {
    const { slugify } = await import('./catalog-data.js');
    for (const category of categories) {
      const slugs = category.complaintTypes.map(slugify);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  it('assigns a configurable SLA target to every complaint type', () => {
    const complaintTypes = categories.flatMap((category) =>
      category.complaintTypes.map((complaintType) => ({ category, complaintType })),
    );

    expect(complaintTypes).toHaveLength(154);
    for (const { category, complaintType } of complaintTypes) {
      const target = complaintTypeSlaTargetHours(
        category.domain,
        category.name,
        complaintType,
      );
      expect(target).toBeGreaterThanOrEqual(1);
      expect(target).toBeLessThanOrEqual(10_000);
    }

    expect(complaintTypeSlaTargetHours('consumer', 'Line Complaints', 'Live Fallen Wire')).toBe(4);
    expect(complaintTypeSlaTargetHours('consumer', 'Line Complaints', 'LT/HT Line Relocation/Improvement- Long Term')).toBe(2160);
  });
});
