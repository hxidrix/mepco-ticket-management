# MEPCO Integrated Help Desk & Ticket Management System

A complete local demonstration of the MEPCO help-desk requirements. Consumer electricity complaints and internal employee support share one traceable ticket engine while preserving separate identities, catalogs, routing scopes, privacy rules, and dashboards.

All records and credentials in this repository are fictional. The application has no connection to live MEPCO billing, HR, ERP, GIS, SCADA, email, or SMS systems.

## Delivered capabilities

- Consumer, employee, technician, supervisor, and administrator roles with backend-enforced RBAC.
- Consumer/employee registration; three login modes; bcrypt password hashes; lockout; short-lived JWT access tokens; HttpOnly refresh rotation, reuse detection, revocation, and logout.
- Role-specific profiles and administrator account lifecycle controls.
- Complete SRS reference catalog: 14 departments, 11 circles, 52 cities, 18 categories, 154 complaint types, priorities, statuses, and protected `Other` values.
- Requester ticket submission with dependent catalog fields, automatic issue-based priority and department-based staff assignment, idempotency, immutable snapshots, role-scoped lists/detail, search, pagination, and advanced filters.
- Scoped technician eligibility, assignment/reassignment, optimistic version checks, priority changes, SLA aging, requester closure reviews and satisfaction ratings, administrator ticket soft deletion, and controlled status transitions through New, Assigned, In Progress, Pending User, Resolved, Closed, Reopened, and Cancelled.
- Public comments, staff-only internal notes, protected evidence attachments, authenticated downloads, complete history, and in-app notifications.
- Live role-scoped dashboards, status/priority/workload metrics, SLA reporting, and manager-scoped CSV/PDF exports.
- Complaint-specific SLA targets from 4 hours to 90 days, with priority urgency caps and configurable master-data values; see [the SLA catalogue](docs/SLA_TARGETS.md).
- Administrator master data, announcements/audiences, staff routing scopes, users, and immutable audit-log views.
- Structured Pino logs, request IDs, safe error envelopes, Helmet/CORS, parameterized SQL, transactions, foreign keys, and soft deactivation.
- OpenAPI 3.1 / Swagger for the complete API surface.

## Stack and layout

- Frontend: React 19, TypeScript, Vite, React Router, Axios, Framer Motion, Tailwind tooling, self-hosted Geist typography, persistent light/dark themes, and a responsive liquid-glass design system.
- Backend: Node.js 22+, Express 5, TypeScript, `mysql2/promise`, `express-validator`, bcrypt, JWT, Multer, Pino, Helmet, Swagger UI, Vitest, and Supertest.
- Database: MySQL 8.4 through Docker Compose or XAMPP MariaDB 10.4 on Windows.

```text
backend/        Express modules, SQL migration/seeds, tests, OpenAPI, protected uploads
frontend/       React application and copied MEPCO logo asset
docs/           Supplied SRS, master prompt, and design reference
docker-compose.yml
README.md
```

## Fictional demo accounts

Every active account uses the development-only password `Demo@12345`.

| Login mode | Role | Identifier |
| --- | --- | --- |
| Consumer | Consumer | `10000000000001` |
| Employee | Employee | `EMP-DEMO-001` |
| Staff | Technician | `tech.it` |
| Staff | Technician | `tech.ops` |
| Staff | Supervisor | `supervisor.demo` |
| Staff | Administrator | `admin.demo` |

The seed also includes suspended/inactive accounts and eight fictional tickets covering all important workflow states.

## Method A: Docker Compose

Prerequisites: Docker Desktop/Engine with Compose. Docker uses host port `3307` for MySQL so it can coexist with XAMPP on `3306`.

```powershell
Copy-Item .env.example .env
docker compose up --build
```

The backend container waits for MySQL, applies the repeatable migration, seeds reference/demo data, then starts. Named volumes preserve MySQL and attachments.

- Application: <http://localhost:5173>
- API readiness: <http://localhost:5000/api/v1/health/ready>
- Swagger UI: <http://localhost:5000/api-docs>
- OpenAPI JSON: <http://localhost:5000/api-docs.json>

```powershell
docker compose ps
docker compose logs --follow backend
docker compose down
```

To intentionally erase Docker development data:

```powershell
docker compose down --volumes
docker compose up --build
```

`down --volumes` permanently deletes the Docker database and attachment volumes. The Compose definition, multi-stage images, health checks, non-root API runtime, SPA fallback, persistent volumes, and startup ordering are present. Docker runtime execution could not be tested on the delivery workstation because Docker is not installed; this limitation is not reported as a pass.

## Method B: Windows + XAMPP

Prerequisites: Node.js 22.12+, npm, Git, and XAMPP. Only XAMPP MySQL is required; Apache is optional for phpMyAdmin.

1. Start MySQL in the XAMPP Control Panel.
2. Create local configurations and install pinned dependencies:

   ```powershell
   Copy-Item backend\.env.example backend\.env
   Copy-Item frontend\.env.example frontend\.env
   npm.cmd run install:all
   ```

3. Create/migrate and seed the database:

   ```powershell
   npm.cmd run db:setup
   npm.cmd run db:status
   ```

   The normal XAMPP defaults in `backend/.env.example` are host `localhost`, port `3306`, user `root`, and an empty password. `db:setup` creates the configured database if the account has permission.

4. Start two terminals:

   ```powershell
   npm.cmd run dev:backend
   ```

   ```powershell
   npm.cmd run dev:frontend
   ```

5. Open the application and Swagger URLs listed above.

The frontend calls `/api/v1` through Vite's same-origin proxy. Open the app at
`http://127.0.0.1:5173` (the URL printed by Vite); do not replace the frontend API
setting with a different host name. Keeping the page and refresh-cookie origin
identical allows the secure session to survive a browser refresh.

## Database operations

```powershell
npm.cmd run db:migrate   # apply unapplied SQL migrations
npm.cmd run db:status    # report migration checksum/status
npm.cmd run db:seed      # idempotently load complete reference/demo data
npm.cmd run db:setup     # migrate, then seed
npm.cmd run db:reset     # DROP all configured DB tables, migrate, and reseed
```

`db:reset` is destructive and is for development databases only.

Backup and restore use the configured MySQL/XAMPP binaries and pass the password through the child-process environment rather than the command line:

```powershell
npm.cmd run db:backup -- ..\backups\mepco-help-desk.sql
npm.cmd run db:restore -- ..\backups\mepco-help-desk.sql
```

The `..` is intentional: npm runs the database utility with `backend/` as its working directory, while this example keeps backups in the repository-level ignored `backups/` directory.

Backups and uploads can contain private application data and are ignored by Git. Attachment bytes remain outside the public frontend in `backend/uploads/` locally or the Docker `attachment_data` volume; every download rechecks ticket access.

## Development and verification

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run test:integration --prefix backend
npm.cmd run build
npm.cmd run verify
```

`verify` runs both linters, strict TypeScript checks, unit/component tests, and production builds. Backend integration tests recreate an isolated `mepco_help_desk_test` database, seed it, and execute authentication, RBAC, master-data, user, ticket, workflow, privacy, upload, notification, reporting, announcement, scope, and audit acceptance scenarios. Never point the integration command at a database containing data you need.

The final verified automated baseline is:

- 12 backend unit/foundation tests.
- 1 frontend component test.
- 28 isolated MySQL integration tests across 8 suites.
- Zero reported npm vulnerabilities in the installed dependency trees.
- Passing backend/frontend production builds.

## API conventions and Swagger

All application routes are versioned below `/api/v1`. Success responses use `{ success, data, message?, meta }`; errors use `{ success: false, error: { code, message, details? }, requestId }`. Lists use bounded pagination. Protected Swagger operations accept the access token through the `bearerAuth` control.

Swagger UI: <http://localhost:5000/api-docs>. The machine-readable OpenAPI 3.1 document is at <http://localhost:5000/api-docs.json> and describes all implemented authentication, user, master-data, ticket, workflow, collaboration, notification, report, and administration paths.

## Environment reference

Backend variables are documented in `backend/.env.example`; frontend variables are in `frontend/.env.example`; Compose host/database/JWT defaults are in the root `.env.example`. Important settings include:

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_CONNECTION_LIMIT`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, access/refresh TTLs, refresh cookie name, and `REFRESH_COOKIE_SECURE`
- `CORS_ORIGIN`, `HOST`, `PORT`, and `LOG_LEVEL`
- `UPLOAD_DIR`, `MAX_UPLOAD_BYTES`, and `REOPEN_WINDOW_DAYS`
- `VITE_API_URL` (normally `/api/v1`, routed by Vite or Nginx)

JWT secrets must be different and at least 32 characters. `REFRESH_COOKIE_SECURE` is false only for the local HTTP examples; it defaults to true in production and must remain true behind HTTPS. Replace every example password/secret before any non-local deployment. Never commit `.env` files.

## Troubleshooting

- Port conflict: XAMPP normally owns `3306`; Docker defaults to `3307`. Change only `MYSQL_HOST_PORT` for the Docker host mapping.
- API live but not ready: check XAMPP/MySQL state and backend DB variables, then run `npm.cmd run db:status`.
- CORS: use an origin listed exactly in `CORS_ORIGIN`; `localhost` and `127.0.0.1` are distinct origins.
- Session disappears after refresh: keep `VITE_API_URL=/api/v1`, restart the frontend after changing `.env`, and use the exact frontend URL printed by Vite.
- PowerShell blocks `npm.ps1`: use `npm.cmd` as shown.
- XAMPP failure: inspect its MySQL error log; never delete `C:\xampp\mysql\data` as a shortcut.
- Docker failure: start Docker Desktop, confirm `docker compose version`, then inspect `docker compose ps` and backend logs.
- Upload rejected: use JPG/JPEG, PNG, PDF, TXT, DOC, or DOCX within `MAX_UPLOAD_BYTES`.

## Security and production boundary

This is an internship/local-demonstration system. A real deployment additionally requires verified MEPCO identity sources, HTTPS and secure-cookie policy review, managed secrets, malware scanning, backup/restore drills, retention and privacy rules, monitoring, infrastructure review, and stakeholder approval. Do not import real consumer or employee data into the demo seeds.
