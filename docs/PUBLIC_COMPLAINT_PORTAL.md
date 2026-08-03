# Public Complaint Portal

Consumers use the public portal at `/` without creating an account or signing in.

## Submit a complaint

1. Select **Submit Complaint**.
2. Enter the 14-digit Reference Number and 10-digit Consumer ID.
3. Confirm the masked preview. The API never returns the full identifiers, CNIC, or address.
4. Complete the complaint form. Circle, Division, and Sub-division come from the verified consumer record and cannot be changed in the browser.
5. Optionally attach up to three JPG, PNG, PDF, TXT, DOC, or DOCX files. Each file uses the configured `MAX_UPLOAD_BYTES` limit (5 MB by default).
6. Save the returned tracking number. No JWT, refresh cookie, consumer user, or browser-persistent identity is created.

## Track a complaint

Tracking is read-only and requires all three values:

- 10-digit numeric tracking number, such as `2026100001`;
- the same 14-digit Reference Number;
- the same 10-digit Consumer ID.

The response contains status, classification, service location, timestamps, and a resolution summary when available. It does not expose internal notes, audit data, staff-only history, attachments, or consumer identity details.

If the tracking number is unavailable, the secondary finder accepts the Reference Number and Consumer ID and returns a minimal list of complaints for that verified connection. Selecting a result runs the normal three-identifier lookup before full complaint details are displayed. The tracking-number form remains the primary lookup.

## Local acceptance records

`npm.cmd run db:seed` installs fictional consumer directory records only when `NODE_ENV` is not `production`. Two useful local test cases are:

| Scenario | Reference Number | Consumer ID |
| --- | --- | --- |
| Primary fictional service connection | `10012345678901` | `0123456789` |
| Secondary fictional service connection | `10012345678902` | `0123456790` |

These values are development fixtures, not real MEPCO customer data. Production seeding omits them; a live installation must import or query an approved authoritative consumer directory.

## Security boundaries

- Verification, submission, primary tracking, and secondary lookup endpoints have IP rate limits.
- Failed verification and tracking responses do not reveal which supplied identifier was wrong.
- Submission re-verifies both consumer identifiers on the server; the masked preview is not trusted as authorization.
- Uploaded files are allow-listed, size-limited, checksum-recorded, and stored through the configured private attachment driver.
- Public tracking is deliberately read-only. Comments, further uploads, closure reviews, and workflow actions require an authenticated employee/staff role where applicable.
