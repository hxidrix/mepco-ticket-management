# Simple Windows Run Guide

This guide runs the MEPCO Help Desk with XAMPP MySQL, one backend terminal, and one frontend terminal.

## First-time setup

1. Install Node.js 22.12 or newer, Git, and XAMPP.
2. Open PowerShell in the project:

   ```powershell
   cd "C:\Users\micro\Desktop\Ticket Management System"
   ```

3. Create local configuration files:

   ```powershell
   Copy-Item backend\.env.example backend\.env
   Copy-Item frontend\.env.example frontend\.env
   ```

4. Install packages:

   ```powershell
   npm.cmd run install:all
   ```

5. Open XAMPP and start **MySQL**. Apache is optional.
6. Create the database tables and required reference lists:

   ```powershell
   npm.cmd run db:setup
   npm.cmd run db:status
   ```

7. Create the first administrator once:

   ```powershell
   $env:BOOTSTRAP_ADMIN_USERNAME = Read-Host "Administrator username"
   $env:BOOTSTRAP_ADMIN_NAME = Read-Host "Administrator full name"
   $env:BOOTSTRAP_ADMIN_EMAIL = Read-Host "Administrator email"
   $env:BOOTSTRAP_ADMIN_PHONE = Read-Host "Phone (11 digits beginning 03)"
   $env:BOOTSTRAP_ADMIN_CNIC = Read-Host "CNIC (13 digits)"
   $securePassword = Read-Host "Strong initial password" -AsSecureString
   $env:BOOTSTRAP_ADMIN_PASSWORD = [Net.NetworkCredential]::new('', $securePassword).Password
   npm.cmd run db:bootstrap-admin
   Remove-Item Env:BOOTSTRAP_ADMIN_USERNAME,Env:BOOTSTRAP_ADMIN_NAME,Env:BOOTSTRAP_ADMIN_EMAIL,Env:BOOTSTRAP_ADMIN_PHONE,Env:BOOTSTRAP_ADMIN_CNIC,Env:BOOTSTRAP_ADMIN_PASSWORD
   ```

   The password must have at least 10 characters and include uppercase, lowercase, a number, and a symbol. The command stops if an administrator already exists.

## Start the application each day

1. Start **MySQL** in XAMPP.
2. Open PowerShell terminal 1:

   ```powershell
   cd "C:\Users\micro\Desktop\Ticket Management System"
   npm.cmd run dev:backend
   ```

3. Open <http://127.0.0.1:5000/api/v1/health/ready>. Continue only when it says the database is connected.
4. Open PowerShell terminal 2:

   ```powershell
   cd "C:\Users\micro\Desktop\Ticket Management System"
   npm.cmd run dev:frontend
   ```

5. Open <http://localhost:5173>.

Keep XAMPP and both terminals open while using the website.

## Create users

- Consumers and employees register from the sign-in page with their own identity details.
- The first administrator creates technicians, supervisors, and additional administrators from **User accounts**.
- Never reuse one password for multiple accounts.

## Stop the application

1. Press `Ctrl+C` in the frontend terminal.
2. Press `Ctrl+C` in the backend terminal.
3. Stop MySQL in XAMPP.

## If login says Network Error

1. Confirm XAMPP MySQL is green/running.
2. Confirm the backend terminal has no error.
3. Open <http://127.0.0.1:5000/api/v1/health/ready>.
4. Confirm the frontend terminal is running.
5. Use exactly <http://localhost:5173>.
6. Keep `VITE_API_URL=/api/v1` in `frontend/.env`.
7. Restart both development servers after changing an `.env` file.

## Database commands

```powershell
npm.cmd run db:migrate
npm.cmd run db:status
npm.cmd run db:seed
npm.cmd run db:backup -- ..\backups\mepco-help-desk.sql
npm.cmd run db:restore -- ..\backups\mepco-help-desk.sql
```

`db:seed` adds or updates reference lists only. It does not create accounts or tickets.

`npm.cmd run db:reset` deletes every table in the configured database. Use it only on a disposable local database after making a backup.

## Tests before a release

Keep XAMPP MySQL running, then run:

```powershell
npm.cmd run verify
npm.cmd run test:integration --prefix backend
npm.cmd run db:status
git diff --check
```

The integration command recreates `mepco_help_desk_test`. Never rename it to your working or production database.

## Swagger for development

With `ENABLE_API_DOCS=true` in `backend/.env`:

- Swagger UI: <http://127.0.0.1:5000/api-docs>
- OpenAPI JSON: <http://127.0.0.1:5000/api-docs.json>

Production defaults to `ENABLE_API_DOCS=false`.

## Docker alternative

Docker does not use XAMPP.

1. Copy `.env.example` to `.env`.
2. Replace all database passwords and JWT secrets in `.env`.
3. Run:

   ```powershell
   docker compose config --quiet
   docker compose up --build -d
   docker compose ps
   ```

4. Open <http://localhost:5173>.
5. Follow the Docker administrator-bootstrap command in [README.md](README.md).

Stop without deleting data:

```powershell
docker compose down
```

Do not add `--volumes` unless you intentionally want to delete the Docker database and attachments.
