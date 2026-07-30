# Local Demo Accounts and Seed Data

This file contains fictional credentials and identifiers for local development and acceptance testing.
None of these values belong to real MEPCO consumers or employees.

## Safety rules

- Run this seed only on a local or disposable non-production database.
- The seed command refuses to run when `NODE_ENV=production`.
- Do not reuse the demo password for a real account.
- Do not expose these credentials on the application login page or public portal.

## Install the demo data

From the project root:

```powershell
npm.cmd run db:migrate
npm.cmd run db:seed-demo
```

The command is idempotent. Running it again updates the demo identities and leaves the named demo tickets in place without duplicating them.

## Employee sign-in

Employees sign in with their eight-digit Employee ID and the last four digits of their CNIC. They do not use a password.

| Scenario | Name | Employee ID | Full fictional CNIC | CNIC last four |
| --- | --- | --- | --- | --- |
| Active employee | Hamza Nadeem | `00001001` | `3520212345601` | `5601` |
| Suspended employee portal | Areeba Khan | `00001002` | `3520212345602` | `5602` |

## Staff sign-in

Select **Staff** on the sign-in page. All local staff accounts use this fictional password:

```text
MepcoDemo@2026!
```

| Role | Name | Username |
| --- | --- | --- |
| Administrator | Usman Khalid | `admin.local` |
| Supervisor | Mariam Raza | `supervisor.multan` |
| IT technician | Sara Ahmed | `tech.it.local` |
| Operations technician | Bilal Hussain | `tech.ops.local` |
| Customer-services technician | Zain Ali | `tech.csd.local` |

## Public consumer verification records

Consumers do not have accounts. Use a Reference Number and Consumer ID to begin a public complaint.

| Name | Reference Number | Consumer ID | Registered mobile |
| --- | --- | --- | --- |
| Muhammad Ahmad | `10012345678901` | `0123456789` | Yes |
| Fatima Zahra | `10012345678902` | `0123456790` | No; the form requests one |
| Ali Raza | `10012345678903` | `0123456791` | Yes |
| Ayesha Siddiqua | `10012345678904` | `0123456792` | Yes |
| Usman Tariq | `10012345678905` | `0123456793` | No; the form requests one |

Additional consumer records cover the remaining seeded circles and can be inspected directly in the `consumer_records` table.

## Public complaint tracking examples

Enter all three values on **Track Complaint**.

| Status scenario | Tracking number | Reference Number | Consumer ID |
| --- | --- | --- | --- |
| New critical complaint | `MEPCO-2026-100001` | `10012345678901` | `0123456789` |
| In-progress complaint | `MEPCO-2026-100002` | `10012345678901` | `0123456789` |
| Waiting for consumer response | `MEPCO-2026-100003` | `10012345678903` | `0123456791` |
| Resolved complaint | `MEPCO-2026-100004` | `10012345678904` | `0123456792` |

## Other seeded operational data

The demo seed also creates:

- two employee tickets in assigned and pending-user states;
- technician access scopes for IT, Operations, and Customer Services;
- one active supervisor with cross-domain visibility;
- one suspended employee for restricted-portal testing;
- one realistic internal announcement;
- assignments, public ticket comments, notifications, ticket history, and an audit record.

The standard `npm.cmd run db:seed` command continues to install reference/master data only. It does not create these demo accounts.
