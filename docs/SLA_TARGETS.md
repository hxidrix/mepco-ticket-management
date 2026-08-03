# Complaint SLA Targets

This file lists the configurable operational targets supplied with the MEPCO Help Desk. The SRS does not define official resolution times, so the configured values must be reviewed and approved by the responsible MEPCO authority before organizational deployment. An administrator can change a complaint type's normal target in **Master data → Complaint types** when policy changes.

## How the system calculates a ticket target

- Every complaint type has a normal resolution target below.
- Priority can shorten that target but cannot make it longer.
- The effective target is the smaller of the complaint-type target and the priority target.
- Priority caps are Critical **4 hours**, High **24 hours**, and Medium **72 hours**.
- Low priority has no shorter urgency cap, so it keeps the complaint type's normal target. This allows planned work to retain a 30-, 60-, or 90-day target.
- Example: a 30-day new-connection request marked High receives a 24-hour effective target.
- The effective target is copied onto the ticket when it is created. Later master-data edits do not rewrite that ticket's original target.
- A deliberate priority change recalculates the effective target from the ticket's frozen complaint baseline.
- Resolved, Closed, and Cancelled tickets are not shown as overdue. Every active ticket continues to be measured against its target.
- These are elapsed-hour targets, not business-hour calendars. Holiday and working-hour calendars can be added when an official policy exists.

## Consumer — Line Complaints

| Complaint type | Normal target | Hours |
| --- | ---: | ---: |
| Power Outage | 12 hours | 12 |
| Damaged Meter | 3 days | 72 |
| Electric Fire | 4 hours | 4 |
| Fluctuation | 1 day | 24 |
| Line Fault | 12 hours | 12 |
| Low/ High Voltage - Short Term | 1 day | 24 |
| Low/ High Voltage - Long Term | 7 days | 168 |
| Phase Issue | 1 day | 24 |
| Additional Feeder | 30 days | 720 |
| Damaged Transformer - Rural | 3 days | 72 |
| Damaged Transformer - Urban | 2 days | 48 |
| Transformer Relocation/Augmentation | 60 days | 1440 |
| Additional Transformer | 30 days | 720 |
| Live Fallen Wire | 4 hours | 4 |
| Service Line Reloc/Improve - Short Term | 3 days | 72 |
| LT/HT Line Relocation/Improvement- Long Term | 90 days | 2160 |
| Meter Sparking/Wire Loose | 4 hours | 4 |
| Permanent Rectification of Temporary Fix | 14 days | 336 |
| Tripping (Due to Transformer) | 12 hours | 12 |
| Transformer Oil Leakage | 1 day | 24 |
| Leakage of current | 4 hours | 4 |
| Damaged Transformer - Independent Consumer | 3 days | 72 |
| Other | 3 days | 72 |

## Consumer — Non-Line Complaints

| Complaint type | Normal target | Hours |
| --- | ---: | ---: |
| Meter Position | 7 days | 168 |
| Detection Bill | 7 days | 168 |
| Delayed Billing (New Connection) | 5 days | 120 |
| Late/Non-Delivery of Bill | 3 days | 72 |
| Electricity Theft | 7 days | 168 |
| Installed Transformer/Meter/Wire Theft | 1 day | 24 |
| Bulk Distribution Theft | 1 day | 24 |
| Electrical Safety | 4 hours | 4 |
| Defective Meter (1-phase) | 5 days | 120 |
| Defective Meter (3-phase) | 5 days | 120 |
| Wrong Meter Reading | 3 days | 72 |
| No Meter Reading Taken | 3 days | 72 |
| Excess Billing | 5 days | 120 |
| Under Billing | 5 days | 120 |
| Account Information | 2 days | 48 |
| Bribery/Corruption | 30 days | 720 |
| Delayed Meter Reading | 3 days | 72 |
| Change of Name | 7 days | 168 |
| Other | 5 days | 120 |

## Consumer — Leads / Requests / Others

| Complaint type | Normal target | Hours |
| --- | ---: | ---: |
| Additional Transformer | 30 days | 720 |
| Temporary Connection | 7 days | 168 |
| Relocation of Meter | 14 days | 336 |
| New Connection | 30 days | 720 |
| Reconnection | 5 days | 120 |
| Change of Sanctioned Load | 14 days | 336 |
| Electrification | 90 days | 2160 |
| Loadshedding Schedule | 1 day | 24 |
| Change of Tariff | 7 days | 168 |
| Replacement Distribution Box | 14 days | 336 |
| Net Metering | 30 days | 720 |
| Apna meter apni reading | 3 days | 72 |
| Other | 14 days | 336 |

## Consumer — Other

| Complaint type | Normal target | Hours |
| --- | ---: | ---: |
| Other | 5 days | 120 |

## Employee — Chief Executive Office (CEO)

| Complaint type | Normal target | Hours |
| --- | ---: | ---: |
| Strategic directive clarification | 5 days | 120 |
| Executive correspondence or approval | 3 days | 72 |
| Strategy/KPI tracking issue | 7 days | 168 |
| Inter-directorate coordination | 5 days | 120 |
| Confidential executive support | 1 day | 24 |
| Other | 3 days | 72 |

## Employee — Company Secretary Office

| Complaint type | Normal target | Hours |
| --- | ---: | ---: |
| Board meeting scheduling/material | 3 days | 72 |
| Minutes or resolution record | 5 days | 120 |
| Statutory filing/governance deadline | 1 day | 24 |
| Corporate record access | 3 days | 72 |
| Legal/governance clarification | 7 days | 168 |
| Other | 5 days | 120 |

## Employee — Internal Audit Section

| Complaint type | Normal target | Hours |
| --- | ---: | ---: |
| Audit observation or response | 7 days | 168 |
| Audit document/evidence request | 3 days | 72 |
| Control weakness or compliance breach | 1 day | 24 |
| Asset verification | 10 days | 240 |
| Audit system/access issue | 1 day | 24 |
| Other | 7 days | 168 |

## Employee — HR & Administration Directorate

| Complaint type | Normal target | Hours |
| --- | ---: | ---: |
| Workplace Harassment | 30 days | 720 |
| Discrimination | 30 days | 720 |
| Payroll & Compensation | 5 days | 120 |
| Benefits & Insurance | 7 days | 168 |
| Leave & Attendance | 3 days | 72 |
| Performance Review | 14 days | 336 |
| Code of Conduct | 14 days | 336 |
| Office Maintenance | 3 days | 72 |
| Communications | 2 days | 48 |
| Office Supplies | 5 days | 120 |
| Physical Security | 4 hours | 4 |
| Other | 5 days | 120 |

## Employee — Finance Directorate

| Complaint type | Normal target | Hours |
| --- | ---: | ---: |
| Salary/payment processing | 3 days | 72 |
| Travel or expense reimbursement | 7 days | 168 |
| Budget allocation/approval | 10 days | 240 |
| Vendor payment | 7 days | 168 |
| Ledger/accounting discrepancy | 10 days | 240 |
| Tax or deduction matter | 7 days | 168 |
| Financial report access/error | 2 days | 48 |
| Other | 5 days | 120 |

## Employee — Commercial/Customer Services Directorate (CSD)

| Complaint type | Normal target | Hours |
| --- | ---: | ---: |
| Billing or revenue system issue | 2 days | 48 |
| Consumer service escalation | 3 days | 72 |
| Metering/M&T request | 7 days | 168 |
| New connection/tariff case | 10 days | 240 |
| Recovery or arrears matter | 7 days | 168 |
| Customer record correction | 3 days | 72 |
| Other | 5 days | 120 |

## Employee — Operations (OP) Directorate

| Complaint type | Normal target | Hours |
| --- | ---: | ---: |
| Safety Protocol Violations | 12 hours | 12 |
| Field Equipment Shortage | 3 days | 72 |
| Vehicle Maintenance | 5 days | 120 |
| Inventory Management | 7 days | 168 |
| Work Order Discrepancies | 3 days | 72 |
| Feeder/outage coordination | 12 hours | 12 |
| Load management or field staffing | 1 day | 24 |
| Other | 3 days | 72 |

## Employee — Information Technology (IT) Directorate

| Complaint type | Normal target | Hours |
| --- | ---: | ---: |
| Hardware | 2 days | 48 |
| Network & Connectivity | 12 hours | 12 |
| Enterprise Software (ERP/SAP) | 3 days | 72 |
| Billing Systems | 1 day | 24 |
| Account/Security | 12 hours | 12 |
| Digital Portals | 2 days | 48 |
| Other | 2 days | 48 |

## Employee — Strategic Planning & Engineering Directorate

| Complaint type | Normal target | Hours |
| --- | ---: | ---: |
| Network expansion proposal | 30 days | 720 |
| Load forecast/planning data | 14 days | 336 |
| Design/drawing review | 14 days | 336 |
| Estimate or project approval | 20 days | 480 |
| GIS/survey information | 10 days | 240 |
| Project progress coordination | 7 days | 168 |
| Other | 14 days | 336 |

## Employee — Operations & Maintenance (O&M) T&G Directorate

| Complaint type | Normal target | Hours |
| --- | ---: | ---: |
| Grid station equipment fault | 12 hours | 12 |
| Transmission line issue | 12 hours | 12 |
| Protection/control system issue | 12 hours | 12 |
| Scheduled maintenance request | 7 days | 168 |
| SCADA/telecommunication issue | 1 day | 24 |
| Safety or switching coordination | 4 hours | 4 |
| Other | 3 days | 72 |

## Employee — Supply Chain Management Office

| Complaint type | Normal target | Hours |
| --- | ---: | ---: |
| Purchase requisition | 10 days | 240 |
| Tender/procurement status | 7 days | 168 |
| Vendor registration/performance | 14 days | 336 |
| Inventory availability | 3 days | 72 |
| Delivery/inspection discrepancy | 5 days | 120 |
| Warehouse record issue | 5 days | 120 |
| Other | 10 days | 240 |

## Employee — Regional Training Centre (RTC)

| Complaint type | Normal target | Hours |
| --- | ---: | ---: |
| Training nomination/enrollment | 5 days | 120 |
| Course schedule | 3 days | 72 |
| Attendance/certification | 5 days | 120 |
| Training material | 3 days | 72 |
| Lab/classroom/facility issue | 2 days | 48 |
| Trainer or evaluation matter | 7 days | 168 |
| Other | 5 days | 120 |

## Employee — MEPCO Intelligence/Surveillance Unit

| Complaint type | Normal target | Hours |
| --- | ---: | ---: |
| Theft/Misuse of Property | 30 days | 720 |
| Corruption/Bribery | 60 days | 1440 |
| Safety Incident Reporting | 12 hours | 12 |
| Audit & Compliance | 14 days | 336 |
| Electricity theft intelligence | 7 days | 168 |
| Surveillance/investigation request | 30 days | 720 |
| Evidence submission/access | 3 days | 72 |
| Confidential case coordination | 7 days | 168 |
| Other | 14 days | 336 |

## Employee — Other

| Complaint type | Normal target | Hours |
| --- | ---: | ---: |
| Other | 5 days | 120 |
