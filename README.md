# MEPCO Integrated Help Desk & Ticket Management System

A responsive local web application for two related service domains: electricity-consumer complaints and internal MEPCO employee support. Both domains share a traceable ticket engine while keeping identities, catalogs, routing, visibility, and authorization boundaries separate.

This repository is being delivered in verified milestones. Milestone 1 provides the React/Express/MySQL foundation, structured API responses and logging, health/readiness checks, initial OpenAPI documentation, Docker/XAMPP configuration, and automated foundation tests. Ticket and identity features are added in later milestones only after the preceding slice passes its verification gate.

> This is an internship/local-demonstration project. It does not connect to live MEPCO billing, HR, ERP, GIS, SCADA, email, or SMS systems, and it must never contain real consumer or employee data.

## Planned product scope

The finished application supports five roles:

- **Consumer** — register with a fictional MEPCO Reference Number, create and track personal consumer-service tickets, respond, and confirm or request reopening.
- **Employee** — register with a fictional Employee ID, create and track internal departmental tickets, and respond to support staff.
- **Technician** — work assigned tickets, add public updates/internal notes, request information, and propose resolutions.
- **Supervisor** — manage scoped queues, assignment/reassignment, priority, closure/reopening, and operational reports.
- **Administrator** — manage accounts, master data, support scopes, announcements, audit access, and controlled ticket corrections.

The implementation plan also includes refresh-token rotation/revocation, complete ticket history, protected attachments, in-app notifications, role-specific dashboards, pagination/search/filtering/sorting, reports and CSV export, audit records, realistic fictional seeds, and the SRS acceptance-test suite.

## Technology stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, React Router, Axios, and Framer Motion.
- **Backend:** Node.js, Express, TypeScript, `mysql2/promise`, Pino, Helmet, CORS, Swagger UI, Vitest, and Supertest.
- **Database:** MySQL 8.4 in Docker; XAMPP's MySQL-compatible MariaDB for the documented Windows workflow.
- **Delivery:** Docker Compose, Git feature branches/pull requests, ESLint, strict TypeScript checks, and production builds.

Prisma, Zod, paid cloud services, and unnecessary distributed infrastructure are intentionally excluded.

## Repository structure

```text
.
├── .github/                 Pull-request checklist
├── backend/                 Express API, configuration, data access, tests, OpenAPI
│   ├── src/
│   └── uploads/             Protected local attachment volume (contents ignored)
├── docs/                    SRS, master prompt, and supplied design reference
├── frontend/                React/Vite client and MEPCO logo asset
│   ├── public/
│   └── src/
├── docker-compose.yml       Frontend + API + MySQL local environment
├── .env.example             Docker Compose host-port/database examples
├── package.json             Root development and verification commands
└── README.md
```

## Prerequisites

Install:

- Node.js 22.12 or newer and npm.
- Git.
- **Either** Docker Desktop/Engine with Docker Compose **or** XAMPP for Windows.
- A current Chromium- or Firefox-based browser.

The current development machine uses Node.js 24 and XAMPP MariaDB 10.4. Docker is not installed there, so Docker runtime verification remains explicitly pending even though the Compose/Docker files are included.

## Method A — full Docker setup

Docker starts the frontend, backend, and MySQL services. The host MySQL port defaults to `3307`, avoiding a normal XAMPP installation on `3306`.

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Wait until all health checks are healthy, then open:

- Frontend: <http://localhost:5173>
- Backend readiness: <http://localhost:5000/api/v1/health/ready>
- Swagger UI: <http://localhost:5000/api-docs>
- OpenAPI JSON: <http://localhost:5000/api-docs.json>

View service state and logs:

```powershell
docker compose ps
docker compose logs --follow backend
```

Stop containers while preserving database and attachment volumes:

```powershell
docker compose down
```

Reset all Docker development data only when intentional:

```powershell
docker compose down --volumes
docker compose up --build
```

`docker compose down --volumes` permanently removes the local Docker MySQL and attachment volumes. Back up anything needed before running it.

## Method B — local Node.js with XAMPP MySQL on Windows

Apache is not required by the React/Express application. Start **MySQL** in the XAMPP Control Panel; start Apache only if you want to use phpMyAdmin.

1. Create the local database from PowerShell:

   ```powershell
   & "C:\xampp\mysql\bin\mysql.exe" -u root --execute="CREATE DATABASE IF NOT EXISTS mepco_help_desk CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
   ```

2. Create ignored local environment files from the safe examples:

   ```powershell
   Copy-Item backend\.env.example backend\.env
   Copy-Item frontend\.env.example frontend\.env
   ```

   The backend example already matches the usual XAMPP defaults:

   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=mepco_help_desk
   ```

3. Install the pinned dependencies and produce/reuse the package lockfiles:

   ```powershell
   npm.cmd run install:all
   ```

4. Apply migrations and fictional seed data when those commands are introduced in Milestone 2. The current Milestone 1 foundation intentionally has no business tables or demo accounts yet; no nonexistent database command is documented as working.

5. Start the API in one terminal:

   ```powershell
   npm.cmd run dev:backend
   ```

6. Start the frontend in a second terminal:

   ```powershell
   npm.cmd run dev:frontend
   ```

7. Open the frontend and Swagger URLs listed above. The foundation page reports **API and database are ready** only when the real readiness request succeeds.

## Environment variables

### Root Docker Compose `.env`

| Variable | Safe local default | Purpose |
| --- | --- | --- |
| `FRONTEND_PORT` | `5173` | Frontend host port |
| `BACKEND_PORT` | `5000` | API host port |
| `MYSQL_HOST_PORT` | `3307` | MySQL host port; container stays on `3306` |
| `MYSQL_DATABASE` | `mepco_help_desk` | Application database |
| `MYSQL_USER` | `mepco_app` | Docker-only application user |
| `MYSQL_PASSWORD` | development example | Docker-only local password |
| `MYSQL_ROOT_PASSWORD` | development example | Docker-only local root password |

### Backend `.env`

| Variable | Example | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `test`, or `production` |
| `HOST` / `PORT` | `127.0.0.1` / `5000` | API listener |
| `CORS_ORIGIN` | `http://localhost:5173` | Comma-separated allowed browser origins |
| `LOG_LEVEL` | `debug` | Pino minimum log level |
| `DB_HOST` / `DB_PORT` | `localhost` / `3306` | MySQL/XAMPP endpoint |
| `DB_USER` / `DB_PASSWORD` | `root` / empty | XAMPP credentials |
| `DB_NAME` | `mepco_help_desk` | Application database |
| `DB_CONNECTION_LIMIT` | `10` | MySQL pool size |
| `UPLOAD_DIR` | `uploads` | Protected attachment directory |
| `MAX_UPLOAD_BYTES` | `5242880` | Five-megabyte upload ceiling |

### Frontend `.env`

| Variable | Example | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | `http://localhost:5000/api/v1` | Versioned browser API base URL |

Never commit real `.env` files. Production credentials and JWT settings added in the authentication milestone must use new secrets, HTTPS, and an approved secret-management process.

## Available development commands

Run these from the repository root:

```powershell
npm.cmd run install:all
npm.cmd run dev:backend
npm.cmd run dev:frontend
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npm.cmd run verify
```

`verify` runs lint, strict TypeScript checks, backend/frontend tests, and both production builds. If PowerShell blocks `npm.ps1`, use `npm.cmd` exactly as shown.

### Database migration, seed, and reset status

Repeatable SQL migration, seed, and development-reset scripts are a required Milestone 2 deliverable. Their exact commands will be added here at the same time as the executable runners and verified against both MySQL 8.4 and XAMPP. Until then, the only database operation required by Milestone 1 is creating the empty `mepco_help_desk` database.

This explicit status prevents reviewers from being given commands that do not yet exist.

## Database backup and restore

Create a local backup directory, then export an XAMPP database:

```powershell
New-Item -ItemType Directory -Force .\backups
& "C:\xampp\mysql\bin\mysqldump.exe" -u root --databases mepco_help_desk | Set-Content -Encoding utf8 .\backups\mepco_help_desk.sql
```

Restore that backup into a running XAMPP MySQL instance:

```powershell
Get-Content .\backups\mepco_help_desk.sql | & "C:\xampp\mysql\bin\mysql.exe" -u root
```

Backups may contain application data and are ignored by Git. Milestone 2 will exercise these commands against the real schema and record the verification result.

## Attachment storage

Attachment bytes are stored outside the public frontend at `backend/uploads/` locally and in the Compose `attachment_data` named volume in Docker. Only the empty `.gitkeep` is versioned. Later attachment endpoints will store validated metadata in MySQL, generate storage names, enforce MIME/extension/size allow-lists, and authorize every download. Never serve this directory as static public content.

## Fictional development accounts

Development-only seeded accounts for all five roles are required, but do not exist in Milestone 1. Milestones 2–3 will add fictional records and this section will list the verified credentials. No real Reference Number, Employee ID, phone number, address, or password may be used as seed data.

## Swagger and API conventions

Swagger UI is served by the Express application at <http://localhost:5000/api-docs>. The machine-readable OpenAPI 3.1 document is at <http://localhost:5000/api-docs.json>.

Implemented endpoints currently include:

- `GET /api/v1/health/live` — confirms the API process is accepting requests.
- `GET /api/v1/health/ready` — confirms the API can query the configured MySQL database.

The API uses versioned routes, request IDs, safe centralized errors, and consistent success/error envelopes. OpenAPI coverage expands with each vertical slice and is reviewed against behavior before handoff.

## Git workflow

The repository is initialized locally. Do not push or create a remote pull request unless explicitly requested.

1. Start from a releasable `main` branch.
2. Create a focused branch such as `feature/auth-refresh`, `feature/ticket-create`, or `fix/ticket-scope`.
3. Keep commits small and descriptive; include the relevant SRS requirement IDs where useful.
4. Run `npm.cmd run verify` and exercise the affected UI/API flow.
5. Open a pull request using `.github/pull_request_template.md`, include test evidence, and complete self/mentor review before merge.

Never commit dependencies, builds, `.env` files, database files, backups, private uploads, logs, or real personal data.

## Troubleshooting

### Port 3306 or 3307 is already in use

- XAMPP normally uses `3306`; Docker defaults to host port `3307`.
- Check listeners with `Get-NetTCPConnection -LocalPort 3306,3307 -ErrorAction SilentlyContinue`.
- Override only the Docker host mapping in root `.env`, for example `MYSQL_HOST_PORT=3308`. Do not edit application source.

### XAMPP MySQL does not start

- Stop another MySQL/MariaDB service that already owns `3306`, or change the XAMPP port and update `backend/.env` to match.
- Read the XAMPP MySQL error log before changing/removing any data files.
- Do not delete `C:\xampp\mysql\data` as a troubleshooting shortcut.

### Database access denied

- Confirm `DB_USER`, `DB_PASSWORD`, host, and port match the selected Docker or XAMPP method.
- The usual XAMPP root account has a blank local password; use the actual configured value if yours differs.
- Docker backend credentials are the `MYSQL_USER`/`MYSQL_PASSWORD` values, not necessarily root.

### Missing `.env` files

Recreate ignored local files from the examples. Never rename or delete the `.env.example` files.

```powershell
Copy-Item .env.example .env
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

### CORS errors

- Open the frontend at the exact origin configured in `CORS_ORIGIN` (normally `http://localhost:5173`).
- Ensure `VITE_API_URL` points to `http://localhost:5000/api/v1` for local development.
- Restart the affected dev server after changing environment files.

### Docker daemon is not running

Start Docker Desktop/Engine, wait until it reports ready, then run `docker compose version` and retry `docker compose up --build`.

### Migration or seed failure

Migration/seed runners arrive in Milestone 2. Once present, verify the correct database is selected, confirm the MySQL service is healthy, and inspect the first reported SQL error rather than repeatedly applying a partial seed.

### Frontend cannot reach the API

- Open <http://localhost:5000/api/v1/health/live> and then `/ready` directly.
- A successful `/live` with a failed `/ready` means the API is running but MySQL/database configuration is unavailable.
- Confirm the frontend uses `localhost` when `CORS_ORIGIN` allows `localhost`; `localhost` and `127.0.0.1` are different browser origins.
- Check `.runtime-logs` or the active terminal output for the request ID and safe structured error.

## Current verification record

Verified on the current Windows development environment:

- Dependency installation completed with zero reported npm vulnerabilities.
- Backend and frontend ESLint checks pass.
- Strict backend and frontend TypeScript checks pass.
- Four automated foundation tests pass (three API, one React).
- Backend and frontend production builds pass.
- XAMPP starts, the local database exists, and `/api/v1/health/ready` reports a real database connection.
- Swagger UI and OpenAPI JSON load successfully.
- Browser checks at `1440×1000` and `390×844` show meaningful content, the connected readiness state, no Vite overlay/page errors, and no mobile horizontal overflow.

Not verified in this environment:

- `docker compose up --build`, health status, and volume reset, because Docker is not installed on the current machine.
- Schema migration/seed/reset and populated backup/restore, which belong to Milestone 2.

Do not interpret an unverified item as a claimed pass.

## Security warning

All example settings and future seeded credentials are development-only. Never reuse them in production. A production deployment requires HTTPS, rotated secrets, reviewed identity verification, confidential-category policy, malware scanning, backups/retention rules, monitoring, and MEPCO stakeholder approval.
