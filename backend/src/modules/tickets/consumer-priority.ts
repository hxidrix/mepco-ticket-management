export type ConsumerPrioritySlug = 'low' | 'medium' | 'high' | 'critical';

export interface ConsumerIssueForPriority {
  categoryName: string;
  complaintTypeName: string;
  subject: string;
  description: string;
  otherCategory?: string;
  otherComplaintType?: string;
}

const criticalComplaintTypes = new Set([
  'electric fire',
  'electrical safety',
  'leakage of current',
  'live fallen wire',
  'meter sparking wire loose',
]);

const highComplaintTypes = new Set([
  'bulk distribution theft',
  'damaged meter',
  'damaged transformer independent consumer',
  'damaged transformer rural',
  'damaged transformer urban',
  'electricity theft',
  'fluctuation',
  'installed transformer meter wire theft',
  'line fault',
  'low high voltage long term',
  'low high voltage short term',
  'phase issue',
  'power outage',
  'transformer oil leakage',
  'tripping due to transformer',
]);

const lowComplaintTypes = new Set([
  'account information',
  'additional feeder',
  'additional transformer',
  'apna meter apni reading',
  'change of name',
  'change of sanctioned load',
  'change of tariff',
  'electrification',
  'loadshedding schedule',
  'meter position',
  'net metering',
  'new connection',
  'relocation of meter',
  'temporary connection',
  'transformer relocation augmentation',
]);

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim();
}

export function classifyConsumerPriority(issue: ConsumerIssueForPriority): ConsumerPrioritySlug {
  const complaintType = normalize(issue.complaintTypeName);
  if (criticalComplaintTypes.has(complaintType)) return 'critical';
  if (highComplaintTypes.has(complaintType)) return 'high';
  if (lowComplaintTypes.has(complaintType)) return 'low';

  const searchableIssue = normalize([
    issue.subject,
    issue.description,
    issue.otherCategory ?? '',
    issue.otherComplaintType ?? '',
  ].join(' '));

  if (/\b(live wire|fallen wire|electric(?:al)? fire|electrocut(?:ion|ed)?|electric shock|sparking|explosion|life threat|immediate danger|current leakage)\b/u.test(searchableIssue)) {
    return 'critical';
  }
  if (/\b(power outage|no electricity|line fault|transformer|high voltage|low voltage|voltage fluctuation|phase issue|tripping|theft|major outage)\b/u.test(searchableIssue)) {
    return 'high';
  }

  const category = normalize(issue.categoryName);
  if (category === 'line complaints') return 'high';
  if (category === 'leads requests others') return 'low';
  return 'medium';
}
