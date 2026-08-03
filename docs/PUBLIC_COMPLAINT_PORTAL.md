# Public Complaint Portal

Consumers use the public portal at `/` without creating an account or signing in.

## Submit a complaint

1. Select **Submit Complaint**.
2. Enter the 14-digit Reference Number and 10-digit Consumer ID.
3. Confirm the masked preview. The API never returns the full identifiers, CNIC, address, or full phone number.
4. Complete the complaint form. Circle, Division, and Sub-division come from the verified consumer record and cannot be changed in the browser.
5. If the record has no registered mobile, enter an 11-digit complaint-contact number beginning with `03`.
6. Optionally attach up to three JPG, PNG, PDF, TXT, DOC, or DOCX files. Each file uses the configured `MAX_UPLOAD_BYTES` limit (5 MB by default).
7. Save the returned tracking number. No JWT, refresh cookie, consumer user, or browser-persistent identity is created.

## Track a complaint

Tracking is read-only and requires all three values:

- 10-digit numeric tracking number, such as `2026100001`;
- the same 14-digit Reference Number;
- the same 10-digit Consumer ID.

The response contains status, classification, service location, timestamps, and a resolution summary when available. It does not expose internal notes, audit data, staff-only history, attachments, or consumer identity details.

## Local acceptance records

`npm.cmd run db:seed` installs fictional consumer directory records only when `NODE_ENV` is not `production`. Two useful local test cases are:

| Scenario | Reference Number | Consumer ID |
| --- | --- | --- |
| Registered mobile already available | `10012345678901` | `0123456789` |
| No registered mobile; form asks for one | `10012345678902` | `0123456790` |

These values are development fixtures, not real MEPCO customer data. Production seeding omits them; a live installation must import or query an approved authoritative consumer directory.

## Security boundaries

- Verification, submission, and tracking endpoints have independent IP rate limits.
- Failed verification and tracking responses do not reveal which supplied identifier was wrong.
- Submission re-verifies both consumer identifiers on the server; the masked preview is not trusted as authorization.
- Uploaded files are allow-listed, size-limited, checksum-recorded, and stored through the configured private attachment driver.
- Public tracking is deliberately read-only. Comments, further uploads, closure reviews, and workflow actions require an authenticated employee/staff role where applicable.
