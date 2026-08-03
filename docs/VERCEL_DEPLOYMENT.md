# Vercel Deployment Guide

This project deploys as one Vercel Services project containing a Vite frontend and an Express backend. API traffic remains under `/api/v1`, while all other browser routes are handled by the React application.

## Required hosted resources

Vercel cannot connect to XAMPP or keep uploaded files in a local `uploads` directory. Before deploying, prepare:

1. A managed, network-accessible **MySQL 8** database with TLS.
2. A **Private Vercel Blob** store connected to the Vercel project.
3. Two different high-entropy JWT secrets.

Use a least-privileged MySQL account that owns only the application database. Do not expose a local XAMPP server to the internet.

## 1. Create or update the Vercel project

1. Import the GitHub repository into Vercel.
2. Keep the Vercel project root at the repository root, not `frontend` or `backend`.
3. Open **Project Settings -> Build and Deployment**.
4. Set **Framework Preset** to **Services**.
5. Confirm that `vercel.json` is present on the deployed branch.

The root configuration builds `frontend` as Vite, imports `backend/src/app.ts` as Express, routes `/api/*` to the backend, preserves frontend assets, and sends React routes to `index.html`.

## 2. Connect a private Blob store

1. Open the Vercel project’s **Storage** tab.
2. Create a Blob store with **Private** access.
3. Connect the store to this project for Production and Preview environments.

Current Vercel runtimes provide the store ID and short-lived OIDC credentials automatically. If an older account configuration supplies `BLOB_READ_WRITE_TOKEN` instead, keep it only in Vercel Environment Variables. Never commit it.

Ticket files are uploaded as private objects and downloaded only through the existing authenticated ticket endpoint. Local development continues to use `backend/uploads`.

## 3. Configure environment variables

Use `vercel.env.example` as the checklist. Add real values through **Project Settings -> Environment Variables** and apply them to Production and, where required, Preview.

Required application values:

- `DATABASE_URL`: managed MySQL connection URL.
- `DB_SSL_MODE`: normally `verify_identity`; use `required` only if the provider cannot validate with the Node trust store.
- `DB_SSL_CA_BASE64`: optional base64-encoded provider CA certificate.
- `DB_CONNECTION_LIMIT`: start with `5` for serverless workloads.
- `ATTACHMENT_STORAGE=vercel-blob`.
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`: different random values, at least 32 characters.
- `CORS_ORIGIN`: final HTTPS application origin.
- `REFRESH_COOKIE_SECURE=true`.
- `ENABLE_API_DOCS=false`.

Do not add `VITE_API_URL`; the frontend intentionally defaults to the same-origin `/api/v1` path for secure refresh cookies and preview deployments.

## 4. Initialize the hosted database once

Database migrations must run as a controlled release task, not during every function start or cold start.

Install and authenticate the Vercel CLI, link the repository root to the project, and pull the production variables into an ignored file:

```powershell
cd "C:\Users\micro\Desktop\Ticket Management System"
vercel link
vercel env pull backend\.env.vercel --environment=production
Set-Location backend
$env:DOTENV_CONFIG_PATH = '.env.vercel'
npm.cmd run db:setup
npm.cmd run db:status
```

`db:setup` applies migrations and installs reference catalogs only. It creates no sample accounts or tickets.

Create the first administrator once:

```powershell
$env:BOOTSTRAP_ADMIN_USERNAME = Read-Host "Administrator username"
$env:BOOTSTRAP_ADMIN_NAME = Read-Host "Administrator full name"
$securePassword = Read-Host "Strong initial password" -AsSecureString
$env:BOOTSTRAP_ADMIN_PASSWORD = [Net.NetworkCredential]::new('', $securePassword).Password
npm.cmd run db:bootstrap-admin
Remove-Item Env:BOOTSTRAP_ADMIN_USERNAME,Env:BOOTSTRAP_ADMIN_NAME,Env:BOOTSTRAP_ADMIN_PASSWORD,Env:DOTENV_CONFIG_PATH
Remove-Item -LiteralPath .env.vercel
```

Only username, display name, and password are required for the initial administrator; the remaining profile details can be added later. The bootstrap command refuses to create a second administrator. The temporary environment file is ignored by Git, but it should still be deleted immediately.

## 5. Deploy and verify

Push the configured files, then redeploy from Vercel. Every service is built independently from its own lockfile.

Verify these URLs on the deployment:

- `/` loads the public complaint portal.
- `/complaints/verify`, `/complaints/track`, `/login`, and `/app` refresh without a Vercel 404.
- `/api/v1/health/live` returns HTTP 200.
- `/api/v1/health/ready` reports `database: connected`.
- `/api-docs` returns 404 in production.

Then perform both smoke tests:

1. Verify a non-production consumer record, submit a complaint with an attachment, track it using tracking number + Reference Number + Consumer ID, and test the secondary Reference Number + Consumer ID finder.
2. Sign in as an employee/staff member, create or process a ticket, add/download a private attachment, refresh the page, and sign out.

## Operational notes

- Set the backend function region near the MySQL provider through Vercel project settings.
- Run `db:migrate` before promoting releases that add migrations.
- Keep encrypted database backups and test restoration separately from Vercel deployments.
- Existing files from a local `uploads` directory are not automatically copied to Blob storage.
- Review Vercel Function and Blob usage limits before accepting production traffic.
- Use preview deployments for acceptance testing, then promote the tested deployment.
