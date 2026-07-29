# MEPCO Identifier and Field Formats

This document records confirmed formats enforced by the application and formats that still require confirmation from MEPCO.

## Confirmed and enforced

| Field | Required format | Example | Behavior |
| --- | --- | --- | --- |
| Consumer Reference Number | Exactly 14 numeric digits | `12345678901234` | Rejected unless all 14 characters are digits. |
| Consumer ID | Exactly 10 numeric digits | `0123456789` | Used with the Reference Number for public verification; leading zeroes are significant. |
| Employee ID | Exactly 8 numeric digits when stored | `00001234` | Users may enter 1-8 digits. Leading zeroes are added automatically. |
| Phone number | Exactly 11 numeric digits beginning with `03` | `03001234567` | Separators, spaces, country codes, and other prefixes are rejected. |
| CNIC | Exactly 13 numeric digits | `3520212345671` | Required and unique for employee/staff accounts. Employee sign-in compares only the last four digits after the Employee ID matches. |
| Staff password | 10-128 characters with uppercase, lowercase, number, and symbol | Use a unique private value | Enforced for technician, supervisor, and administrator creation, changes, and resets. Employees do not use passwords. |
| Email | Valid email address | `employee@example.com` | Recorded when an administrator provisions an employee or staff account. |

The database enforces the consumer Reference Number, Consumer ID, Employee ID, phone, and CNIC formats. Consumer verification values are never converted into a user account or stored in browser persistence.

## Formats requiring MEPCO confirmation

Please confirm the correct business format for these fields before stricter validation is added:

1. Staff usernames for technicians, supervisors, and administrators.
2. Ticket numbers: current system-generated format versus any official MEPCO complaint-number format.
3. Meter number, account number, or connection number, if these will be stored separately from the Reference Number and Consumer ID.
4. Employee work email domain, if accounts must use an official MEPCO email domain.
5. Postal/service-address structure, if feeder or grid-station codes must be captured separately from Circle, Division, and Sub-division.
6. Department, designation, feeder, transformer, grid-station, and office codes, if official fixed codes exist.

Until confirmed, these fields keep their current safe length and type validation rather than guessing an official format.
