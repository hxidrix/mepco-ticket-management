# Simple Step-by-Step Run Guide

This guide explains how to run the MEPCO Help Desk on Windows in simple terms.

The recommended method is:

- XAMPP runs the MySQL database.
- One terminal runs the backend API.
- A second terminal runs the frontend website.

You must keep all three running while using the application.

## 1. Programs you need

Install these programs before continuing:

1. Node.js version 22.12 or newer.
2. XAMPP for Windows.
3. Git.
4. A browser such as Chrome, Edge, or Firefox.

To check Node.js and npm, open PowerShell and run:

```powershell
node --version
npm.cmd --version
```

Both commands should print a version number.

## 2. Open the correct project folder

Open PowerShell and move into the project folder:

```powershell
cd "C:\Users\micro\OneDrive\Desktop\Ticket Management System"
```

You can check that you are in the correct folder by running:

```powershell
Get-ChildItem
```

You should see folders named `backend`, `frontend`, and `docs`.

You should also see `package.json`, `README.md`, and `docker-compose.yml`.

## 3. First-time environment setup

You normally do this only once.

From the project root, run:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

If PowerShell says the files already exist, do not overwrite them unless you intentionally want to reset your local settings.

The normal local settings are:

```text
Frontend: http://localhost:5173
Backend:  http://127.0.0.1:5000
MySQL:    localhost:3306
Database: mepco_help_desk
```

The normal XAMPP database account is:

```text
Username: root
Password: empty
```

If your XAMPP MySQL account has a password, put that password in `backend/.env` as `DB_PASSWORD`.

## 4. Install project packages

You normally do this only once, or after `package.json` changes.

From the project root, run:

```powershell
npm.cmd run install:all
```

Wait for the command to finish. Do not close the terminal while packages are installing.

## 5. Start the XAMPP database

1. Open the XAMPP Control Panel.
2. Find the row named **MySQL**.
3. Click **Start**.
4. Wait until MySQL becomes green and shows that it is running.

Apache is not needed for this React and Express application.

You only need Apache if you want to open phpMyAdmin.

If MySQL does not start, another database program may already be using port `3306`.

## 6. Prepare the database

Return to PowerShell in the project root.

Run:

```powershell
npm.cmd run db:setup
```

This command does two things:

1. It creates/applies the database tables.
2. It adds the complete fictional demo data.

Check the migration status with:

```powershell
npm.cmd run db:status
```

You should see `001_initial_schema.sql` in the result.

You do not need to run `db:setup` every time you start the application. Run it during first-time setup or after receiving new database migrations.

## 7. Start the backend server

Open a new PowerShell terminal.

Move to the project root:

```powershell
cd "C:\Users\micro\OneDrive\Desktop\Ticket Management System"
```

Start the backend:

```powershell
npm.cmd run dev:backend
```

Keep this terminal open.

The backend uses port `5000`. It connects the website to MySQL and handles login, tickets, files, reports, and administration.

Check that the backend and database are ready by opening this URL in your browser:

<http://127.0.0.1:5000/api/v1/health/ready>

You should see a response containing:

```json
{
  "status": "ready",
  "database": "connected"
}
```

The complete response also contains `success`, service, timestamp, and metadata fields.

Do not start the frontend until this readiness URL works.

## 8. Start the frontend server

Open another PowerShell terminal. Do not close the backend terminal.

Move to the project root:

```powershell
cd "C:\Users\micro\OneDrive\Desktop\Ticket Management System"
```

Start the frontend:

```powershell
npm.cmd run dev:frontend
```

Keep this terminal open too.

The frontend uses port `5173`.

Open the application at:

<http://localhost:5173>

## 9. Correct daily startup order

After the first-time setup, use this order every day:

1. Start XAMPP MySQL.
2. Run `npm.cmd run dev:backend` in the first terminal.
3. Open the backend readiness URL and confirm it says `ready` and `connected`.
4. Run `npm.cmd run dev:frontend` in the second terminal.
5. Open <http://localhost:5173>.
6. Sign in using a fictional demo account.

Do not run only the frontend. Login cannot work without the backend and MySQL.

## 10. Demo login accounts

All active demo accounts use this password:

```text
Demo@12345
```

### Consumer login

Select **Consumer** on the login page.

```text
MEPCO Reference Number: 10000000000001
Password: Demo@12345
```

### Employee login

Select **Employee** on the login page.

```text
Employee ID: EMP-DEMO-001
Password: Demo@12345
```

### Technician login

Select **Staff** on the login page.

```text
Username: tech.it
Password: Demo@12345
```

Another technician is available:

```text
Username: tech.ops
Password: Demo@12345
```

### Supervisor login

Select **Staff** on the login page.

```text
Username: supervisor.demo
Password: Demo@12345
```

### Administrator login

Select **Staff** on the login page.

```text
Username: admin.demo
Password: Demo@12345
```

These accounts and passwords are only for local development.

## 11. Useful application URLs

Use these URLs while the servers are running:

| Purpose | URL |
| --- | --- |
| Website | <http://localhost:5173> |
| Backend liveness | <http://127.0.0.1:5000/api/v1/health/live> |
| Backend and database readiness | <http://127.0.0.1:5000/api/v1/health/ready> |
| Swagger API documentation | <http://127.0.0.1:5000/api-docs> |
| OpenAPI JSON | <http://127.0.0.1:5000/api-docs.json> |

## 12. How to stop everything

### Stop the frontend

Open the frontend terminal and press:

```text
Ctrl+C
```

If PowerShell asks whether to terminate the batch job, type `Y` and press Enter.

### Stop the backend

Open the backend terminal and press:

```text
Ctrl+C
```

### Stop MySQL

Return to the XAMPP Control Panel and click **Stop** beside MySQL.

## 13. How to run tests

Keep XAMPP MySQL running for integration tests.

From the project root, run the normal quality checks:

```powershell
npm.cmd run verify
```

This runs:

1. Backend and frontend lint checks.
2. Strict TypeScript checks.
3. Unit and frontend component tests.
4. Backend and frontend production builds.

Run the MySQL integration tests separately:

```powershell
npm.cmd run test:integration --prefix backend
```

The integration tests recreate a database named `mepco_help_desk_test`.

Never change the integration-test database name to a database containing information you need.

## 14. Database commands

Run these commands from the project root.

### Apply migrations

```powershell
npm.cmd run db:migrate
```

### Show migration status

```powershell
npm.cmd run db:status
```

### Add/update fictional seed data

```powershell
npm.cmd run db:seed
```

### Apply migrations and seed data together

```powershell
npm.cmd run db:setup
```

### Completely reset the development database

```powershell
npm.cmd run db:reset
```

Warning: `db:reset` deletes all tables and data in the configured database before rebuilding it. Use it only with a local development database.

## 15. Database backup and restore

Create a backup from the project root:

```powershell
npm.cmd run db:backup -- ..\backups\mepco-help-desk.sql
```

Restore that backup:

```powershell
npm.cmd run db:restore -- ..\backups\mepco-help-desk.sql
```

The `..` is required because npm runs the database script from inside the `backend` folder.

Keep backups private. They are ignored by Git.

## 16. Fixing a login "Network Error"

A login **Network Error** normally does not mean the password is incorrect. It means the browser could not contact the backend.

Check these items in order:

1. Confirm XAMPP MySQL is running.
2. Confirm the backend terminal is still open.
3. Open <http://127.0.0.1:5000/api/v1/health/ready>.
4. Confirm the response says `ready` and `connected`.
5. Confirm the frontend terminal is still open.
6. Open the website at exactly <http://localhost:5173>.
7. Refresh the page with `Ctrl+F5`.
8. Restart the frontend if you changed `frontend/.env`.

To restart the frontend:

1. Press `Ctrl+C` in the frontend terminal.
2. Run `npm.cmd run dev:frontend` again.

To restart the backend:

1. Press `Ctrl+C` in the backend terminal.
2. Run `npm.cmd run dev:backend` again.

The expected frontend environment value is:

```env
VITE_API_URL=http://localhost:5000/api/v1
```

The backend CORS list should contain both local frontend addresses:

```env
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
```

## 17. Fixing "port already in use"

If the backend says port `5000` is already in use, another backend process may already be running.

If the frontend says port `5173` is already in use, another Vite process may already be running. Vite may also choose another port. Always use the URL printed in the frontend terminal.

Check the normal ports with:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 3306,5000,5173 -ErrorAction SilentlyContinue
```

Close the old terminal or stop the old process before starting another copy.

## 18. Fixing database connection errors

Open `backend/.env` and check:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=mepco_help_desk
MYSQL_BIN_DIR=C:\xampp\mysql\bin
```

If your XAMPP MySQL uses a different port, username, or password, update these values and restart the backend.

## 19. Optional Docker method

Use this method only if Docker Desktop is installed and running.

You do not need XAMPP when using Docker.

From the project root:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Docker starts:

1. MySQL.
2. The backend API.
3. The frontend website.

Open:

<http://localhost:5173>

Check the containers:

```powershell
docker compose ps
```

View backend logs:

```powershell
docker compose logs --follow backend
```

Stop Docker services without deleting data:

```powershell
docker compose down
```

Delete all Docker development database and attachment volumes only when you intentionally want a complete reset:

```powershell
docker compose down --volumes
```

This Docker reset is destructive.

## 20. Short version for normal daily use

Use three running windows:

### Window 1: XAMPP

Start MySQL.

### Window 2: backend

```powershell
cd "C:\Users\micro\OneDrive\Desktop\Ticket Management System"
npm.cmd run dev:backend
```

### Window 3: frontend

```powershell
cd "C:\Users\micro\OneDrive\Desktop\Ticket Management System"
npm.cmd run dev:frontend
```

Then open:

<http://localhost:5173>

If login fails with a Network Error, check this URL first:

<http://127.0.0.1:5000/api/v1/health/ready>
