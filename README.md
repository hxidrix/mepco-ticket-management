# MEPCO Integrated Help Desk

A ticket management system for accountless MEPCO consumer complaints and authenticated internal employee support. The application provides one traceable workflow while preserving separate verification, routing, privacy, and reporting boundaries.

## Capabilities

- Public consumer complaint submission and read-only tracking without consumer accounts, passwords, JWTs, cookies, or browser persistence.
- Consumer verification using a 14-digit Reference Number plus 10-digit Consumer ID, with only masked details returned before submission.
- Employee verification using an 8-digit Employee ID plus the last four CNIC digits; staff retain username/password authentication.
- Secure employee/staff sessions with short-lived JWT access tokens, rotating HttpOnly refresh cookies, reuse detection, revocation, and logout.
- Fixed identity formats: 14-digit consumer Reference Number, 10-digit Consumer ID, 8-digit Employee ID, 11-digit phone beginning with `03`, and unique 13-digit CNIC for accounts.
- Circle → Division → Sub-division profiles, ticket locations, staff scopes, reporting filters, and automatic routing.
- Consumer priority classification and department/location-based staff assignment.
- Public complaint attachments at initial submission (up to three approved files), primary 10-digit numeric tracking using all three identifiers, and a secondary Reference Number plus Consumer ID complaint finder.
- Full employee ticket workflow, requester closure review, satisfaction rating, comments, internal notes, evidence attachments, history, event notifications, and administrator soft deletion.
- Notification inbox events for ticket creation and assignment, status changes, ticket comments, private staff messages, announcements, reviews, and account-governance actions.
- Suspension requests, manager decisions, restricted account portal, appeals, support requests, and secure technician/manager messaging.
- Role-scoped dashboards, announcements, audit logs, SLA monitoring, and CSV/PDF reports.
- Responsive light/dark liquid-glass interface with self-hosted Geist typography.
- OpenAPI 3.1 documentation for the complete versioned API.

See [public complaint portal](docs/PUBLIC_COMPLAINT_PORTAL.md), [identifier formats](docs/IDENTIFIER_FORMATS.md), [location hierarchy](docs/LOCATION_HIERARCHY.md), [SLA targets](docs/SLA_TARGETS.md), and [internal messaging](docs/INTERNAL_MESSAGES.md).

## Technology

- Frontend: React 19, TypeScript, Vite, React Router, Axios, Framer Motion.
- Backend: Node.js 22+, Express 5, TypeScript, MySQL, bcrypt, JWT, Multer, Pino, Helmet, Swagger UI, Vitest, Supertest.
- Database: MySQL 8.4 with Docker Compose, XAMPP MariaDB on Windows, or managed MySQL with TLS on Vercel.
- Cloud deployment: Vercel Services with Vite, Express Functions, and private Vercel Blob attachments.

```text
backend/        Express API, migrations, reference seeds, tests, OpenAPI
frontend/       React application and static assets
docs/           Requirements and operational references
docker-compose.yml
vercel.json      Vercel Services build, API routing, and SPA fallback
README.md
RUN_GUIDE.md
```

## Important data behavior

`db:seed` installs required reference data: roles, departments, locations, categories, complaint types, priorities, statuses, and SLA values. In development it also installs a small fictional-but-realistic consumer verification directory for local public-portal testing. Production seeding does not install these local consumer records. Normal seeding never creates users, passwords, tickets, announcements, or messages.

Integration-test identities and scenarios are created only inside the isolated database whose name ends in `_test`. They are never installed by normal setup, reset, Docker startup, or production seeding.

## Windows/XAMPP setup

Prerequisites: Node.js 22.12+, npm, Git, and XAMPP.

```powershell
cd "C:\Users\micro\Desktop\Ticket Management System"
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
npm.cmd run install:all
```

Start MySQL from XAMPP, then prepare the schema and reference catalog:

```powershell
npm.cmd run db:setup
npm.cmd run db:status
```

Create the first administrator once. Only username, display name, and password are required; contact and identity details can be completed later from the profile. The command refuses to run if an administrator already exists.

```powershell
$env:BOOTSTRAP_ADMIN_USERNAME = Read-Host "Administrator username"
$env:BOOTSTRAP_ADMIN_NAME = Read-Host "Administrator full name"
$securePassword = Read-Host "Strong initial password" -AsSecureString
$env:BOOTSTRAP_ADMIN_PASSWORD = [Net.NetworkCredential]::new('', $securePassword).Password
npm.cmd run db:bootstrap-admin
Remove-Item Env:BOOTSTRAP_ADMIN_USERNAME,Env:BOOTSTRAP_ADMIN_NAME,Env:BOOTSTRAP_ADMIN_PASSWORD
```

Start the API and web application in separate terminals:

```powershell
npm.cmd run dev:backend
```

```powershell
npm.cmd run dev:frontend
```

- Application: <http://localhost:5173>
- Readiness: <http://127.0.0.1:5000/api/v1/health/ready>
- Swagger in development: <http://127.0.0.1:5000/api-docs>
- OpenAPI JSON in development: <http://127.0.0.1:5000/api-docs.json>

The frontend should use `VITE_API_URL=/api/v1` so Vite proxies API and refresh-cookie requests through the same origin.

## Docker Compose setup

Prerequisite: Docker Desktop or Docker Engine with Compose.

```powershell
Copy-Item .env.example .env
```

Edit `.env` before starting. Replace both database passwords and both JWT secrets. JWT secrets must be different, deployment-specific, and at least 32 characters. The production backend intentionally rejects missing or example secrets.

For a local HTTP-only Compose run, keep `REFRESH_COOKIE_SECURE=false`. Set it to `true` behind production HTTPS. Set `CORS_ORIGIN` to the exact public frontend origin. Keep `ENABLE_API_DOCS=false` unless protected documentation is intentionally required.

```powershell
docker compose config --quiet
docker compose up --build -d
docker compose ps
docker compose logs --follow backend
```

Docker applies migrations and reference data automatically. Create the first administrator by supplying the three bootstrap values to the built script inside the backend container:

```powershell
docker compose exec `
  -e BOOTSTRAP_ADMIN_USERNAME="$env:BOOTSTRAP_ADMIN_USERNAME" `
  -e BOOTSTRAP_ADMIN_NAME="$env:BOOTSTRAP_ADMIN_NAME" `
  -e BOOTSTRAP_ADMIN_PASSWORD="$env:BOOTSTRAP_ADMIN_PASSWORD" `
  backend node dist/database/scripts/bootstrap-admin.js
```

Clear the temporary shell variables immediately afterward using the `Remove-Item Env:...` command shown in the XAMPP section.

Stop without deleting data:

```powershell
docker compose down
```

`docker compose down --volumes` permanently deletes the Docker database and attachments and must not be used on a system containing required data.

## Vercel deployment

The repository includes a root `vercel.json` for the Vite frontend and Express backend. A complete deployment also requires a managed MySQL 8 database and a connected Private Vercel Blob store; XAMPP and local upload folders cannot be used by cloud functions.

In Vercel, keep the project root at the repository root and set the Framework Preset to **Services**. Configure the variables listed in `vercel.env.example`, initialize the hosted database once, and then redeploy.

Follow the complete sequence in [docs/VERCEL_DEPLOYMENT.md](docs/VERCEL_DEPLOYMENT.md). Do not run database migrations or administrator bootstrap code on every function start.

## Database operations

```powershell
npm.cmd run db:migrate           # apply pending migrations
npm.cmd run db:status            # verify migration checksums/status
npm.cmd run db:seed              # upsert reference data only
npm.cmd run db:setup             # migrate, then seed references
npm.cmd run db:bootstrap-admin   # create the first administrator once
npm.cmd run db:reset             # destructive: drop all tables and rebuild references
```

Legacy pre-release installations can remove the known sample identities and all records directly owned by them with:

```powershell
npm.cmd run db:purge-sample-data
```

Back up the database before running a cleanup command. The cleanup is transaction-based and does not delete reference catalogs.

```powershell
npm.cmd run db:backup -- ..\backups\mepco-help-desk.sql
npm.cmd run db:restore -- ..\backups\mepco-help-desk.sql
```

Backups, `.env` files, uploaded evidence, and generated build output are excluded from Git. Every attachment download rechecks ticket authorization.

## Verification

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run test:integration --prefix backend
npm.cmd run build
npm.cmd run verify
docker compose config --quiet
git diff --check
```

`verify` runs both linters, strict TypeScript checks, unit/component tests, and production builds. Integration tests recreate only `mepco_help_desk_test`; never point that command at a database containing required information.

Dependency advisory checks require network access and are intentionally separate:

```powershell
npm.cmd audit --prefix backend --omit=dev
npm.cmd audit --prefix frontend --omit=dev
```

## API and Swagger

Application routes are versioned under `/api/v1`. Success envelopes use `{ success, data, message?, meta? }`; errors use `{ success: false, error, requestId }`.

`ENABLE_API_DOCS=true` enables Swagger UI at `/api-docs` and OpenAPI JSON at `/api-docs.json`. It defaults to enabled for development/test and disabled for production. Do not expose interactive API documentation publicly without an explicit access-control decision.

There are no consumer accounts or self-registration endpoints. Administrators provision employee accounts; only staff accounts use passwords. Public consumer verification is deliberately request-scoped and never creates an authenticated session.

## Environment and security

The variable templates are `.env.example`, `backend/.env.example`, `frontend/.env.example`, and `vercel.env.example`.

- Use different high-entropy `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` values.
- Use HTTPS and `REFRESH_COOKIE_SECURE=true` outside local HTTP development.
- Restrict `CORS_ORIGIN` to exact trusted frontend origins.
- Use a least-privileged database account; do not run the application as MySQL root in production.
- Keep Swagger disabled in production unless deliberately protected.
- Store secrets in a deployment secret manager, not Git or images.
- Put uploads on durable private storage, add malware scanning, and define retention rules.
- Schedule encrypted backups and test restoration.
- Replace the local fictional consumer directory with an authoritative read-only MEPCO consumer lookup before accepting live public data.
- Add centralized monitoring, TLS termination, rate-limit review, privacy approval, and an incident-response process before organizational deployment.

## Release checklist

1. Run migrations and `db:status` against a backed-up staging database.
2. Run `verify`, isolated integration tests, dependency audits, `docker compose config --quiet`, and `git diff --check`.
3. Confirm no `.env`, backup, upload, log, or generated build file is staged.
4. Confirm no shared/sample account exists and bootstrap credentials have been cleared.
5. Confirm production secrets, HTTPS, secure cookies, CORS, storage, backups, monitoring, and consumer-directory integration.
6. Perform role-by-role acceptance testing in staging.
7. Obtain business, security, privacy, and operations approval before serving real MEPCO data.

For a beginner-friendly local startup sequence, see [RUN_GUIDE.md](RUN_GUIDE.md).
