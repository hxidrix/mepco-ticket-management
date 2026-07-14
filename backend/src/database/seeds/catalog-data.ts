export type ServiceDomain = 'consumer' | 'employee';

export interface DepartmentSeed {
  name: string;
  description: string;
}

export interface CircleSeed {
  name: string;
  cities: readonly string[];
}

export interface CategorySeed {
  domain: ServiceDomain;
  name: string;
  department?: string;
  complaintTypes: readonly string[];
  confidentialTypes?: readonly string[];
}

export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 180);
}

export const roles = [
  ['consumer', 'External electricity consumer requester'],
  ['employee', 'Internal MEPCO employee requester'],
  ['technician', 'Support staff assigned to investigate tickets'],
  ['supervisor', 'Support manager responsible for routing and closure'],
  ['administrator', 'System identity, configuration and audit administrator'],
] as const;

export const priorities = [
  ['Low', 'low', 'Routine request or low-impact issue', 'priority-low', 120],
  ['Medium', 'medium', 'Important issue with limited impact', 'priority-medium', 72],
  ['High', 'high', 'Major impact without a reasonable workaround', 'priority-high', 24],
  ['Critical', 'critical', 'Immediate danger, major outage or serious security risk', 'priority-critical', 4],
] as const;

export const ticketStatuses = [
  ['New', 'new', 'Submitted and awaiting triage or assignment', false],
  ['Assigned', 'assigned', 'Ownership has been given to an eligible technician', false],
  ['In Progress', 'in-progress', 'A technician is actively investigating or working', false],
  ['Pending User', 'pending-user', 'Requester information or confirmation is required', false],
  ['Resolved', 'resolved', 'Resolution has been proposed and awaits review', false],
  ['Closed', 'closed', 'Work is accepted and complete', true],
  ['Reopened', 'reopened', 'The issue requires further work', false],
  ['Cancelled', 'cancelled', 'The request was withdrawn, invalid or administratively cancelled', true],
] as const;

export const departments: readonly DepartmentSeed[] = [
  { name: 'Chief Executive Office (CEO)', description: 'Oversees macro corporate strategy.' },
  { name: 'Company Secretary Office', description: 'Handles board governance and legal matters.' },
  { name: 'Internal Audit Section', description: 'Reviews compliance and asset security.' },
  {
    name: 'HR & Administration Directorate',
    description: 'Coordinates public relations, legal and labor affairs, transport, and testing.',
  },
  {
    name: 'Finance Directorate',
    description: 'Oversees general accounts, pricing, and revenue collection.',
  },
  {
    name: 'Commercial/Customer Services Directorate (CSD)',
    description: 'Directs billing, customer service, meters, safety metrics, and testing.',
  },
  {
    name: 'Operations (OP) Directorate',
    description: 'Manages power distribution networks, feeders, and field staff.',
  },
  {
    name: 'Information Technology (IT) Directorate',
    description: 'Develops online applications, MIS frameworks, and net-metering databases.',
  },
  {
    name: 'Strategic Planning & Engineering Directorate',
    description: 'Governs network expansions and upgrades.',
  },
  {
    name: 'Operations & Maintenance (O&M) T&G Directorate',
    description: 'Secures and regulates transmission infrastructure and grid operations.',
  },
  {
    name: 'Supply Chain Management Office',
    description: 'Procures materials, hardware, and structural warehouse units.',
  },
  {
    name: 'Regional Training Centre (RTC)',
    description: 'Directs engineering technical courses and employee development programs.',
  },
  {
    name: 'MEPCO Intelligence/Surveillance Unit',
    description: 'Investigates electricity theft, illegal bypasses, and line tampering.',
  },
  { name: 'Other', description: 'Organizational unit not yet represented in the master list.' },
];

export const circles: readonly CircleSeed[] = [
  { name: 'Multan Circle', cities: ['Multan', 'Shujabad', 'Jalalpur Pirwala', 'Other'] },
  {
    name: 'Khanewal Circle',
    cities: ['Khanewal', 'Kabirwala', 'Mian Channu', 'Jahanian', 'Other'],
  },
  { name: 'Vehari Circle', cities: ['Vehari', 'Burewala', 'Mailsi', 'Other'] },
  {
    name: 'Sahiwal Circle',
    cities: ['Sahiwal', 'Chichawatni', 'Pakpattan', 'Arifwala', 'Other'],
  },
  {
    name: 'Dera Ghazi Khan (D.G. Khan) Circle',
    cities: ['Dera Ghazi Khan', 'Taunsa Sharif', 'Kot Chutta', 'Rajanpur', 'Jampur', 'Rojhan', 'Other'],
  },
  {
    name: 'Muzaffargarh Circle',
    cities: ['Muzaffargarh', 'Kot Addu', 'Alipur', 'Khan Garh', 'Other'],
  },
  { name: 'Layyah Circle', cities: ['Layyah', 'Chowk Azam', 'Keoror Lal Esan', 'Other'] },
  {
    name: 'Bahawalpur Circle',
    cities: ['Bahawalpur', 'Ahmedpur East', 'Hasilpur', 'Lodhran', 'Kahror Pacca', 'Dunyapur', 'Other'],
  },
  {
    name: 'Bahawalnagar Circle',
    cities: ['Bahawalnagar', 'Chishtian', 'Haroonabad', 'Fort Abbas', 'Other'],
  },
  {
    name: 'Rahim Yar Khan Circle',
    cities: ['Rahim Yar Khan', 'Sadiqabad', 'Liaqatpur', 'Khanpur', 'Other'],
  },
  { name: 'Other', cities: ['Other'] },
];

const consumerCategories: readonly CategorySeed[] = [
  {
    domain: 'consumer',
    name: 'Line Complaints',
    complaintTypes: [
      'Power Outage',
      'Damaged Meter',
      'Electric Fire',
      'Fluctuation',
      'Line Fault',
      'Low/ High Voltage - Short Term',
      'Low/ High Voltage - Long Term',
      'Phase Issue',
      'Additional Feeder',
      'Damaged Transformer - Rural',
      'Damaged Transformer - Urban',
      'Transformer Relocation/Augmentation',
      'Additional Transformer',
      'Live Fallen Wire',
      'Service Line Reloc/Improve - Short Term',
      'LT/HT Line Relocation/Improvement- Long Term',
      'Meter Sparking/Wire Loose',
      'Permanent Rectification of Temporary Fix',
      'Tripping (Due to Transformer)',
      'Transformer Oil Leakage',
      'Leakage of current',
      'Damaged Transformer - Independent Consumer',
      'Other',
    ],
  },
  {
    domain: 'consumer',
    name: 'Non-Line Complaints',
    complaintTypes: [
      'Meter Position',
      'Detection Bill',
      'Delayed Billing (New Connection)',
      'Late/Non-Delivery of Bill',
      'Electricity Theft',
      'Installed Transformer/Meter/Wire Theft',
      'Bulk Distribution Theft',
      'Electrical Safety',
      'Defective Meter (1-phase)',
      'Defective Meter (3-phase)',
      'Wrong Meter Reading',
      'No Meter Reading Taken',
      'Excess Billing',
      'Under Billing',
      'Account Information',
      'Bribery/Corruption',
      'Delayed Meter Reading',
      'Change of Name',
      'Other',
    ],
    confidentialTypes: ['Bribery/Corruption'],
  },
  {
    domain: 'consumer',
    name: 'Leads / Requests / Others',
    complaintTypes: [
      'Additional Transformer',
      'Temporary Connection',
      'Relocation of Meter',
      'New Connection',
      'Reconnection',
      'Change of Sanctioned Load',
      'Electrification',
      'Loadshedding Schedule',
      'Change of Tariff',
      'Replacement Distribution Box',
      'Net Metering',
      'Apna meter apni reading',
      'Other',
    ],
  },
  { domain: 'consumer', name: 'Other', complaintTypes: ['Other'] },
];

type EmployeeCatalogSeed = readonly [
  department: string,
  complaintTypes: readonly string[],
  confidentialTypes?: readonly string[],
];

const employeeCatalogs: readonly EmployeeCatalogSeed[] = [
  [
    'Chief Executive Office (CEO)',
    [
      'Strategic directive clarification',
      'Executive correspondence or approval',
      'Strategy/KPI tracking issue',
      'Inter-directorate coordination',
      'Confidential executive support',
      'Other',
    ],
    ['Confidential executive support'],
  ],
  [
    'Company Secretary Office',
    [
      'Board meeting scheduling/material',
      'Minutes or resolution record',
      'Statutory filing/governance deadline',
      'Corporate record access',
      'Legal/governance clarification',
      'Other',
    ],
  ],
  [
    'Internal Audit Section',
    [
      'Audit observation or response',
      'Audit document/evidence request',
      'Control weakness or compliance breach',
      'Asset verification',
      'Audit system/access issue',
      'Other',
    ],
    [
      'Audit observation or response',
      'Audit document/evidence request',
      'Control weakness or compliance breach',
      'Asset verification',
    ],
  ],
  [
    'HR & Administration Directorate',
    [
      'Workplace Harassment',
      'Discrimination',
      'Payroll & Compensation',
      'Benefits & Insurance',
      'Leave & Attendance',
      'Performance Review',
      'Code of Conduct',
      'Office Maintenance',
      'Communications',
      'Office Supplies',
      'Physical Security',
      'Other',
    ],
    ['Workplace Harassment', 'Discrimination', 'Code of Conduct'],
  ],
  [
    'Finance Directorate',
    [
      'Salary/payment processing',
      'Travel or expense reimbursement',
      'Budget allocation/approval',
      'Vendor payment',
      'Ledger/accounting discrepancy',
      'Tax or deduction matter',
      'Financial report access/error',
      'Other',
    ],
  ],
  [
    'Commercial/Customer Services Directorate (CSD)',
    [
      'Billing or revenue system issue',
      'Consumer service escalation',
      'Metering/M&T request',
      'New connection/tariff case',
      'Recovery or arrears matter',
      'Customer record correction',
      'Other',
    ],
  ],
  [
    'Operations (OP) Directorate',
    [
      'Safety Protocol Violations',
      'Field Equipment Shortage',
      'Vehicle Maintenance',
      'Inventory Management',
      'Work Order Discrepancies',
      'Feeder/outage coordination',
      'Load management or field staffing',
      'Other',
    ],
  ],
  [
    'Information Technology (IT) Directorate',
    [
      'Hardware',
      'Network & Connectivity',
      'Enterprise Software (ERP/SAP)',
      'Billing Systems',
      'Account/Security',
      'Digital Portals',
      'Other',
    ],
  ],
  [
    'Strategic Planning & Engineering Directorate',
    [
      'Network expansion proposal',
      'Load forecast/planning data',
      'Design/drawing review',
      'Estimate or project approval',
      'GIS/survey information',
      'Project progress coordination',
      'Other',
    ],
  ],
  [
    'Operations & Maintenance (O&M) T&G Directorate',
    [
      'Grid station equipment fault',
      'Transmission line issue',
      'Protection/control system issue',
      'Scheduled maintenance request',
      'SCADA/telecommunication issue',
      'Safety or switching coordination',
      'Other',
    ],
  ],
  [
    'Supply Chain Management Office',
    [
      'Purchase requisition',
      'Tender/procurement status',
      'Vendor registration/performance',
      'Inventory availability',
      'Delivery/inspection discrepancy',
      'Warehouse record issue',
      'Other',
    ],
  ],
  [
    'Regional Training Centre (RTC)',
    [
      'Training nomination/enrollment',
      'Course schedule',
      'Attendance/certification',
      'Training material',
      'Lab/classroom/facility issue',
      'Trainer or evaluation matter',
      'Other',
    ],
  ],
  [
    'MEPCO Intelligence/Surveillance Unit',
    [
      'Theft/Misuse of Property',
      'Corruption/Bribery',
      'Safety Incident Reporting',
      'Audit & Compliance',
      'Electricity theft intelligence',
      'Surveillance/investigation request',
      'Evidence submission/access',
      'Confidential case coordination',
      'Other',
    ],
    [
      'Theft/Misuse of Property',
      'Corruption/Bribery',
      'Safety Incident Reporting',
      'Audit & Compliance',
      'Electricity theft intelligence',
      'Surveillance/investigation request',
      'Evidence submission/access',
      'Confidential case coordination',
    ],
  ],
  ['Other', ['Other']],
];

export const categories: readonly CategorySeed[] = [
  ...consumerCategories,
  ...employeeCatalogs.map(([department, complaintTypes, confidentialTypes]) => ({
    domain: 'employee' as const,
    name: department,
    department,
    complaintTypes,
    ...(confidentialTypes === undefined ? {} : { confidentialTypes }),
  })),
];
