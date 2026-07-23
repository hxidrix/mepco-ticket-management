# MEPCO Identifier and Field Formats

This document records confirmed formats enforced by the application and formats that still require confirmation from MEPCO.

## Confirmed and enforced

| Field | Required format | Example | Behavior |
| --- | --- | --- | --- |
| Consumer reference number | Exactly 14 numeric digits | `10000000000001` | Rejected unless all 14 characters are digits. |
| Employee ID | Exactly 8 numeric digits when stored | `00001234` | Users may enter 1–8 digits. Leading zeroes are added automatically. |
| Phone number | Exactly 11 numeric digits beginning with `03` | `03001234567` | Separators, spaces, country codes, and other prefixes are rejected. |
| CNIC | Exactly 13 numeric digits | `3520212345671` | Required for new accounts in every role; unique when provided and editable from My profile. |
| Password | 10–128 characters with uppercase, lowercase, number, and symbol | `Demo@12345` | Enforced during registration, password changes, and resets. |
| Email | Valid email address | `employee@example.com` | Required for employee registration; optional for consumers. |

The database also enforces the consumer reference-number and employee-ID formats. This prevents imports, scripts, or future API routes from inserting malformed identifiers.

## Formats requiring MEPCO confirmation

Please confirm the correct business format for these fields before stricter validation is added:

1. Staff usernames for technicians, supervisors, and administrators.
2. Ticket numbers: current system-generated format versus any official MEPCO complaint-number format.
3. Meter number, account number, or connection number, if these will be stored separately from the 14-digit reference number.
4. Employee work email domain, if accounts must use an official MEPCO email domain.
5. Postal/service-address structure, if circle, division, sub-division, city, feeder, or grid-station codes must be captured separately.
6. Department, designation, feeder, transformer, grid-station, and office codes, if official fixed codes exist.

Until confirmed, these fields keep their current safe length and type validation rather than guessing an official format.
