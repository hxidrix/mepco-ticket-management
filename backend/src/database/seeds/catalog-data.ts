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
  ['Low', 'low', 'Routine request or low-impact issue; uses the complaint type target', 'priority-low', null],
  ['Medium', 'medium', 'Important issue with limited impact', 'priority-medium', 72],
  ['High', 'high', 'Major impact without a reasonable workaround', 'priority-high', 24],
  ['Critical', 'critical', 'Immediate danger, major outage or serious security risk', 'priority-critical', 4],
] as const;

const complaintTypeSlaDefaults = new Map<string, number>([
  ['consumer|line complaints', 72],
  ['consumer|non-line complaints', 120],
  ['consumer|leads / requests / others', 336],
  ['consumer|other', 120],
  ['employee|chief executive office (ceo)', 72],
  ['employee|company secretary office', 120],
  ['employee|internal audit section', 168],
  ['employee|hr & administration directorate', 120],
  ['employee|finance directorate', 120],
  ['employee|commercial/customer services directorate (csd)', 120],
  ['employee|operations (op) directorate', 72],
  ['employee|information technology (it) directorate', 48],
  ['employee|strategic planning & engineering directorate', 336],
  ['employee|operations & maintenance (o&m) t&g directorate', 72],
  ['employee|supply chain management office', 240],
  ['employee|regional training centre (rtc)', 120],
  ['employee|mepco intelligence/surveillance unit', 336],
  ['employee|other', 120],
]);

const complaintTypeSlaOverrides = new Map<string, number>([
  ['consumer|line complaints|power outage', 12],
  ['consumer|line complaints|damaged meter', 72],
  ['consumer|line complaints|electric fire', 4],
  ['consumer|line complaints|fluctuation', 24],
  ['consumer|line complaints|line fault', 12],
  ['consumer|line complaints|low/ high voltage - short term', 24],
  ['consumer|line complaints|low/ high voltage - long term', 168],
  ['consumer|line complaints|phase issue', 24],
  ['consumer|line complaints|additional feeder', 720],
  ['consumer|line complaints|damaged transformer - rural', 72],
  ['consumer|line complaints|damaged transformer - urban', 48],
  ['consumer|line complaints|transformer relocation/augmentation', 1440],
  ['consumer|line complaints|additional transformer', 720],
  ['consumer|line complaints|live fallen wire', 4],
  ['consumer|line complaints|service line reloc/improve - short term', 72],
  ['consumer|line complaints|lt/ht line relocation/improvement- long term', 2160],
  ['consumer|line complaints|meter sparking/wire loose', 4],
  ['consumer|line complaints|permanent rectification of temporary fix', 336],
  ['consumer|line complaints|tripping (due to transformer)', 12],
  ['consumer|line complaints|transformer oil leakage', 24],
  ['consumer|line complaints|leakage of current', 4],
  ['consumer|line complaints|damaged transformer - independent consumer', 72],
  ['consumer|non-line complaints|meter position', 168],
  ['consumer|non-line complaints|detection bill', 168],
  ['consumer|non-line complaints|delayed billing (new connection)', 120],
  ['consumer|non-line complaints|late/non-delivery of bill', 72],
  ['consumer|non-line complaints|electricity theft', 168],
  ['consumer|non-line complaints|installed transformer/meter/wire theft', 24],
  ['consumer|non-line complaints|bulk distribution theft', 24],
  ['consumer|non-line complaints|electrical safety', 4],
  ['consumer|non-line complaints|defective meter (1-phase)', 120],
  ['consumer|non-line complaints|defective meter (3-phase)', 120],
  ['consumer|non-line complaints|wrong meter reading', 72],
  ['consumer|non-line complaints|no meter reading taken', 72],
  ['consumer|non-line complaints|excess billing', 120],
  ['consumer|non-line complaints|under billing', 120],
  ['consumer|non-line complaints|account information', 48],
  ['consumer|non-line complaints|bribery/corruption', 720],
  ['consumer|non-line complaints|delayed meter reading', 72],
  ['consumer|non-line complaints|change of name', 168],
  ['consumer|leads / requests / others|additional transformer', 720],
  ['consumer|leads / requests / others|temporary connection', 168],
  ['consumer|leads / requests / others|relocation of meter', 336],
  ['consumer|leads / requests / others|new connection', 720],
  ['consumer|leads / requests / others|reconnection', 120],
  ['consumer|leads / requests / others|change of sanctioned load', 336],
  ['consumer|leads / requests / others|electrification', 2160],
  ['consumer|leads / requests / others|loadshedding schedule', 24],
  ['consumer|leads / requests / others|change of tariff', 168],
  ['consumer|leads / requests / others|replacement distribution box', 336],
  ['consumer|leads / requests / others|net metering', 720],
  ['consumer|leads / requests / others|apna meter apni reading', 72],
  ['employee|chief executive office (ceo)|strategic directive clarification', 120],
  ['employee|chief executive office (ceo)|executive correspondence or approval', 72],
  ['employee|chief executive office (ceo)|strategy/kpi tracking issue', 168],
  ['employee|chief executive office (ceo)|inter-directorate coordination', 120],
  ['employee|chief executive office (ceo)|confidential executive support', 24],
  ['employee|company secretary office|board meeting scheduling/material', 72],
  ['employee|company secretary office|minutes or resolution record', 120],
  ['employee|company secretary office|statutory filing/governance deadline', 24],
  ['employee|company secretary office|corporate record access', 72],
  ['employee|company secretary office|legal/governance clarification', 168],
  ['employee|internal audit section|audit observation or response', 168],
  ['employee|internal audit section|audit document/evidence request', 72],
  ['employee|internal audit section|control weakness or compliance breach', 24],
  ['employee|internal audit section|asset verification', 240],
  ['employee|internal audit section|audit system/access issue', 24],
  ['employee|hr & administration directorate|workplace harassment', 720],
  ['employee|hr & administration directorate|discrimination', 720],
  ['employee|hr & administration directorate|payroll & compensation', 120],
  ['employee|hr & administration directorate|benefits & insurance', 168],
  ['employee|hr & administration directorate|leave & attendance', 72],
  ['employee|hr & administration directorate|performance review', 336],
  ['employee|hr & administration directorate|code of conduct', 336],
  ['employee|hr & administration directorate|office maintenance', 72],
  ['employee|hr & administration directorate|communications', 48],
  ['employee|hr & administration directorate|office supplies', 120],
  ['employee|hr & administration directorate|physical security', 4],
  ['employee|finance directorate|salary/payment processing', 72],
  ['employee|finance directorate|travel or expense reimbursement', 168],
  ['employee|finance directorate|budget allocation/approval', 240],
  ['employee|finance directorate|vendor payment', 168],
  ['employee|finance directorate|ledger/accounting discrepancy', 240],
  ['employee|finance directorate|tax or deduction matter', 168],
  ['employee|finance directorate|financial report access/error', 48],
  ['employee|commercial/customer services directorate (csd)|billing or revenue system issue', 48],
  ['employee|commercial/customer services directorate (csd)|consumer service escalation', 72],
  ['employee|commercial/customer services directorate (csd)|metering/m&t request', 168],
  ['employee|commercial/customer services directorate (csd)|new connection/tariff case', 240],
  ['employee|commercial/customer services directorate (csd)|recovery or arrears matter', 168],
  ['employee|commercial/customer services directorate (csd)|customer record correction', 72],
  ['employee|operations (op) directorate|safety protocol violations', 12],
  ['employee|operations (op) directorate|field equipment shortage', 72],
  ['employee|operations (op) directorate|vehicle maintenance', 120],
  ['employee|operations (op) directorate|inventory management', 168],
  ['employee|operations (op) directorate|work order discrepancies', 72],
  ['employee|operations (op) directorate|feeder/outage coordination', 12],
  ['employee|operations (op) directorate|load management or field staffing', 24],
  ['employee|information technology (it) directorate|hardware', 48],
  ['employee|information technology (it) directorate|network & connectivity', 12],
  ['employee|information technology (it) directorate|enterprise software (erp/sap)', 72],
  ['employee|information technology (it) directorate|billing systems', 24],
  ['employee|information technology (it) directorate|account/security', 12],
  ['employee|information technology (it) directorate|digital portals', 48],
  ['employee|strategic planning & engineering directorate|network expansion proposal', 720],
  ['employee|strategic planning & engineering directorate|load forecast/planning data', 336],
  ['employee|strategic planning & engineering directorate|design/drawing review', 336],
  ['employee|strategic planning & engineering directorate|estimate or project approval', 480],
  ['employee|strategic planning & engineering directorate|gis/survey information', 240],
  ['employee|strategic planning & engineering directorate|project progress coordination', 168],
  ['employee|operations & maintenance (o&m) t&g directorate|grid station equipment fault', 12],
  ['employee|operations & maintenance (o&m) t&g directorate|transmission line issue', 12],
  ['employee|operations & maintenance (o&m) t&g directorate|protection/control system issue', 12],
  ['employee|operations & maintenance (o&m) t&g directorate|scheduled maintenance request', 168],
  ['employee|operations & maintenance (o&m) t&g directorate|scada/telecommunication issue', 24],
  ['employee|operations & maintenance (o&m) t&g directorate|safety or switching coordination', 4],
  ['employee|supply chain management office|purchase requisition', 240],
  ['employee|supply chain management office|tender/procurement status', 168],
  ['employee|supply chain management office|vendor registration/performance', 336],
  ['employee|supply chain management office|inventory availability', 72],
  ['employee|supply chain management office|delivery/inspection discrepancy', 120],
  ['employee|supply chain management office|warehouse record issue', 120],
  ['employee|regional training centre (rtc)|training nomination/enrollment', 120],
  ['employee|regional training centre (rtc)|course schedule', 72],
  ['employee|regional training centre (rtc)|attendance/certification', 120],
  ['employee|regional training centre (rtc)|training material', 72],
  ['employee|regional training centre (rtc)|lab/classroom/facility issue', 48],
  ['employee|regional training centre (rtc)|trainer or evaluation matter', 168],
  ['employee|mepco intelligence/surveillance unit|theft/misuse of property', 720],
  ['employee|mepco intelligence/surveillance unit|corruption/bribery', 1440],
  ['employee|mepco intelligence/surveillance unit|safety incident reporting', 12],
  ['employee|mepco intelligence/surveillance unit|audit & compliance', 336],
  ['employee|mepco intelligence/surveillance unit|electricity theft intelligence', 168],
  ['employee|mepco intelligence/surveillance unit|surveillance/investigation request', 720],
  ['employee|mepco intelligence/surveillance unit|evidence submission/access', 72],
  ['employee|mepco intelligence/surveillance unit|confidential case coordination', 168],
]);

function complaintTypeSlaKey(
  domain: ServiceDomain,
  categoryName: string,
  complaintTypeName?: string,
): string {
  const categoryKey = `${domain}|${categoryName.trim().toLowerCase()}`;
  return complaintTypeName === undefined
    ? categoryKey
    : `${categoryKey}|${complaintTypeName.trim().toLowerCase()}`;
}

export function complaintTypeSlaTargetHours(
  domain: ServiceDomain,
  categoryName: string,
  complaintTypeName: string,
): number {
  return complaintTypeSlaOverrides.get(
    complaintTypeSlaKey(domain, categoryName, complaintTypeName),
  ) ?? complaintTypeSlaDefaults.get(complaintTypeSlaKey(domain, categoryName)) ?? 120;
}

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
