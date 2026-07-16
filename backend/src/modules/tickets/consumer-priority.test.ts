import { classifyConsumerPriority } from './consumer-priority.js';

const baseIssue = {
  categoryName: 'Non-Line Complaints',
  complaintTypeName: 'Wrong Meter Reading',
  subject: 'Incorrect meter reading',
  description: 'The reading shown on the bill is not correct.',
};

describe('consumer priority classification', () => {
  it('marks immediate electrical dangers as critical', () => {
    expect(classifyConsumerPriority({
      ...baseIssue,
      categoryName: 'Line Complaints',
      complaintTypeName: 'Live Fallen Wire',
    })).toBe('critical');
  });

  it('marks outages and network faults as high priority', () => {
    expect(classifyConsumerPriority({
      ...baseIssue,
      categoryName: 'Line Complaints',
      complaintTypeName: 'Power Outage',
    })).toBe('high');
  });

  it('keeps routine service requests low and billing complaints medium', () => {
    expect(classifyConsumerPriority({
      ...baseIssue,
      categoryName: 'Leads / Requests / Others',
      complaintTypeName: 'New Connection',
    })).toBe('low');
    expect(classifyConsumerPriority(baseIssue)).toBe('medium');
  });

  it('uses issue text to escalate an otherwise unclassified complaint', () => {
    expect(classifyConsumerPriority({
      ...baseIssue,
      categoryName: 'Other',
      complaintTypeName: 'Other',
      subject: 'Emergency near the meter',
      description: 'There is sparking and an electric fire at the service point.',
    })).toBe('critical');
  });
});
