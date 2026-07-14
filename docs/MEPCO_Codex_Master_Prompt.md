# MEPCO Help Desk — Master Prompt for Codex in VS Code

You are the lead full-stack software engineer for my internship project:

**MEPCO Integrated Help Desk & Ticket Management System**

I have attached the project’s Software Requirements Specification (SRS). Read the entire SRS before changing or creating any project files. Treat the SRS as the source of truth for the business scope, roles, complaint categories, locations, ticket workflow, permissions and required features.

The goal is to build a complete but manageable internship-level web application that runs locally, looks professional, and demonstrates good software-engineering practices. Do not over-engineer it or introduce unnecessary services, patterns or paid dependencies.

## 1. First Actions

Before implementation:

1. Read the attached SRS completely.
2. Inspect the current VS Code workspace and report what already exists.
3. If the folder is empty, create the project structure described below.
4. Create a clear implementation plan with milestones and keep it updated while working.
5. Identify any genuine contradiction between the SRS and this prompt. Ask me only when the decision would materially change the project; otherwise choose the simplest reasonable solution and document the assumption.
6. Do not modify or delete the SRS.

After planning, begin implementation. Work in small, testable vertical slices rather than creating disconnected placeholder pages. Continue through safe implementation steps without repeatedly asking for permission for routine file creation, package installation, testing or local configuration.

## 2. Fixed Technology Stack

Use this stack unless the SRS explicitly requires something different:

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui where useful
- Framer Motion for purposeful interface animation
- React Router
- Axios or a small typed API client
- React Context for authentication and simple global state
- Responsive design for mobile and desktop

Avoid Redux unless the application genuinely becomes too difficult to manage without it.

### Backend

- Node.js
- Express
- TypeScript
- MySQL
- `mysql2/promise` with a clear repository/data-access layer
- `express-validator` for request validation
- `bcryptjs` for password hashing
- `jsonwebtoken` for JWT access and refresh tokens
- `multer` for controlled local attachment uploads
- Pino or Winston for structured logging
- Swagger/OpenAPI using maintained Express-compatible packages
- Vitest and Supertest for backend and API tests

### Important exclusions

- Do not use Prisma.
- Do not use Zod.
- Do not use PostgreSQL, MongoDB or Firebase.
- Do not require a paid cloud service.
- Do not add microservices, Kubernetes, Redis, message queues or other infrastructure that is unnecessary for this internship project.

## 3. Suggested Repository Structure

Use a simple structure similar to:

```text
/
├── frontend/
├── backend/
├── docs/
├── docker-compose.yml
├── .gitignore
└── README.md
```

Inside the backend, keep modules separated by purpose, for example:

```text
backend/src/
├── config/
├── database/
│   ├── migrations/
│   └── seeds/
├── middleware/
├── modules/
│   ├── auth/
│   ├── users/
│   ├── tickets/
│   ├── comments/
│   ├── attachments/
│   ├── notifications/
│   ├── reports/
│   ├── admin/
│   └── audit/
├── shared/
├── app.ts
└── server.ts
```

The exact folder names may change if a simpler consistent organization is better. Do not create empty architectural layers with no real purpose.

## 4. Required User Roles

Implement the five roles from the SRS:

1. Consumer
2. Employee
3. Technician
4. Supervisor
5. Administrator

Authentication identifiers:

- Consumers register and log in using their MEPCO Reference Number and password.
- Employees register and log in using their Employee ID and password.
- Technicians, Supervisors and Administrators log in using a username and password.

All authorization must be enforced by the backend. Hiding a button in React is not sufficient security.

## 5. Main Functional Scope

Implement the SRS features in practical milestones. The finished application should include:

- Consumer and Employee registration and login.
- Staff account management by an Administrator.
- JWT access tokens and refresh-token rotation/revocation.
- Role-based access control.
- User profiles.
- Separate Consumer and Employee ticket domains inside one shared platform.
- Ticket creation using dependent category and complaint-type dropdowns.
- MEPCO departments, circles, cities and complaint catalogs from the SRS.
- An `Other` option wherever required by the SRS.
- Ticket priorities and statuses.
- Supervisor assignment and reassignment of eligible Technicians.
- Ticket lifecycle: New, Assigned, In Progress, Pending User, Resolved, Closed, Reopened and Cancelled.
- Public comments and staff-only internal notes.
- Controlled attachments with file-size/type validation and authorization on download.
- Ticket history and assignment history.
- In-application notifications.
- Role-specific dashboards.
- Search, pagination, sorting and filtering.
- Supervisor reports, including completed, incomplete, aging and technician-workload summaries.
- Administrator management of users, departments, locations, categories, complaint types, priorities, announcements and audit logs.
- Soft deletion/deactivation where historical data must be preserved.
- Structured application logs and separate audit records.
- Swagger/OpenAPI documentation.
- Realistic fictional seed data covering all five roles and important workflows.
- Automated backend business-logic and API tests.

Do not integrate with live MEPCO billing, employee, ERP, SMS, email or other production systems. Use fictional seed records for the local demonstration.

## 6. Database Requirements

Use MySQL with SQL migration and seed scripts that work with both Docker MySQL and XAMPP MySQL.

Requirements:

- Use parameterized queries.
- Use transactions for operations that update multiple related records.
- Add foreign keys and useful indexes.
- Keep identity keys unique: Consumer Reference Number, Employee ID and staff username.
- Store password hashes, never plaintext passwords.
- Store refresh sessions/tokens securely using hashes or revocable token identifiers.
- Preserve ticket, status, assignment and audit history.
- Store attachment metadata in MySQL and attachment files in a protected local upload directory/volume.
- Include repeatable commands for database migration, seeding and resetting development data.
- Never seed real consumer or employee personal information.

## 7. REST API Rules

Use a versioned API such as `/api/v1`.

Use consistent success and error formats, for example:

```json
{
  "success": true,
  "message": "Ticket created successfully",
  "data": {},
  "meta": null
}
```

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the highlighted fields",
    "details": []
  },
  "requestId": "..."
}
```

Add centralized validation and error-handling middleware. Do not expose stack traces, SQL errors, password hashes, tokens or secrets in client responses or normal logs.

All list endpoints should support safe pagination. Relevant ticket and administration endpoints should also support allow-listed sorting and filtering.

## 8. Frontend Requirements

Create a distinctive, modern and professional interface suitable for MEPCO. It must not look like a generic shadcn dashboard, copied admin template or collection of default components.

### Visual direction

Use my portfolio website as the creative reference:

`https://hxidrix.vercel.app/`

The MEPCO application should capture the portfolio’s premium feeling, smoothness, attention to spacing, interactive cards and polished hover behaviour, while remaining appropriate for a serious utility/help-desk system. Do not literally copy portfolio sections into the application.

If I place screenshots, screen recordings or other visual references in a folder such as `docs/design-reference/`, inspect all of them before finalizing the design system. Treat those files as the most accurate visual reference. Do not require the live portfolio URL to remain available during development.

I will also provide the MEPCO logo image. Place a copy at:

```text
frontend/public/mepco-logo.png
```

Use the logo without stretching, recoloring or distorting it. Because the supplied logo contains a white background and strong colors, display it on a clean white/light circular plate or contained light brand area when it appears over a dark surface. Give it adequate clear space. Use it prominently on the authentication experience and more compactly in the application navigation.

### Chosen brand palette

Derive the interface from the supplied logo without using every logo color everywhere. Establish tokens close to:

```css
--background: #050816;
--surface: #0b1224;
--surface-elevated: #111b33;
--surface-soft: #17223d;
--brand-blue-deep: #060da5;
--brand-blue: #1297ef;
--brand-cyan: #56d6ff;
--brand-red: #f90706;
--brand-yellow: #f8e90b;
--text-primary: #f8fafc;
--text-secondary: #a8b3c7;
--border: rgba(148, 163, 184, 0.18);
```

These values may be adjusted slightly for contrast and harmony, but keep their roles consistent:

- Blue is the main interactive/brand color.
- Cyan is used for restrained glow, motion and secondary highlights.
- Red is reserved for Critical priority, destructive actions, serious errors and rare brand emphasis.
- Yellow is a sparing highlight/focus accent, not a general button or background color.
- Dark navy surfaces create the premium portfolio-inspired foundation.
- White and cool gray maintain clear readability.

Do not create large red-and-yellow sections merely because those colors appear in the logo. The application should feel controlled, modern and trustworthy.

### Signature authentication hero

Make the login/registration experience the visual signature of the project. Use a spacious responsive split layout on desktop and a carefully stacked layout on mobile.

The presentation side should include:

- The MEPCO logo on a clean light plate.
- A premium animated headline such as **“Report. Track. Resolve.”**
- Supporting copy such as **“One help desk for MEPCO consumers and employees.”**
- Clear role/context language without overcrowding the page.
- Blue-to-cyan gradient emphasis on one important word or short phrase.
- A subtle radial glow behind the central content.
- The interactive dot-grid background described below.

Animate the headline with a one-time line/word mask reveal using Framer Motion: slight upward movement, blur-to-sharp transition and short word staggering. Important words may receive a restrained gradient sweep after entrance. Do not use a permanently looping typewriter effect, bouncing letters or animation that makes the text difficult to read.

The form side should use a refined glass/elevated surface with strong labels, accessible inputs and subtle focus glow. Switching between Consumer, Employee and Staff login modes should animate smoothly without moving the entire layout unpredictably.

### Interactive dot-grid background

Use this Framer component as a behavioural reference:

`https://framer.com/m/Dot-Grid-BG-GVxaLr.js@mfNBQfaPK0E7CX1epbhh`

Do not import the remote JavaScript component at runtime and do not copy its source verbatim. Build an original local React + TypeScript canvas component inspired by the effect.

Required behaviour:

- Render a crisp responsive grid of small dots on a `<canvas>`.
- Use `requestAnimationFrame`, `ResizeObserver` and device-pixel-ratio awareness.
- Dots near the pointer should brighten, gently scale and move into subtle orbit/depth motion.
- Dots should ease smoothly back into their grid positions when the pointer moves away.
- Use blue/cyan dot colors at low opacity so the effect supports the content instead of competing with it.
- Keep the canvas `pointer-events: none` so it never blocks forms, links or buttons.
- Pause or greatly reduce work when the component is offscreen, the tab is hidden or reduced motion is requested.
- Reduce grid density and disable complex orbit behaviour on small/mobile or low-performance devices.
- Avoid React state updates for every animation frame; keep frame data in refs/local canvas logic.
- Clean up animation frames, observers and listeners when unmounted.

Use the full interactive version only on authentication/landing presentation areas. A static or very low-motion dotted texture may appear in dashboard welcome headers or empty states. Do not render the animated grid continuously behind tables, forms, reports or administration screens.

### Role-dashboard composition

Do not give every role the same generic row of four statistic cards. Create a shared design language but compose each dashboard around the role’s real work:

- Consumer/Employee: animated welcome header, prominent **Create Ticket** action, personal ticket summary, recent ticket timeline and useful announcements.
- Technician: current workload, priority queue, pending-user cases, recently updated tickets and completion progress.
- Supervisor: assignment queue, unassigned/aging tickets, technician workload, completion trends and quick assignment actions.
- Administrator: system health summary, user/account activity, master-data shortcuts, recent security/audit events and announcements.

Summary cards may use restrained hover lift, slight pointer-based depth, animated accent borders and count-up motion. Keep maximum tilt very small so the interface remains stable. Ticket lists and data tables should prioritize clarity, with subtle row highlights and smoothly appearing actions rather than dramatic 3D effects.

Suggested visual character:

- Deep navy/charcoal foundations with MEPCO-appropriate blue, cyan or teal accents.
- Carefully controlled gradients and soft glows rather than loud neon effects.
- Strong typography, generous spacing and a clear information hierarchy.
- Refined cards with subtle borders, layered surfaces and restrained depth.
- Rounded corners used consistently rather than randomly.
- A cohesive icon set and custom-looking compositions instead of default component arrangements.
- A central design-token system for colors, spacing, radius, shadows, typography and motion timing.
- Consistent visual language across authentication, dashboards, tickets, reports and administration pages.
- Occasional abstract power-grid/transmission-line geometry may be used as a very subtle decorative motif, without copying or redrawing the full logo.

Create the visual system first—tokens, layout shell, navigation, typography, buttons, inputs, cards, tables, badges, dialogs and motion rules—then reuse it consistently. shadcn/ui components should be customized to this design language rather than left with their default appearance.

### Motion and interaction direction

Use Framer Motion as the main animation library. Add GSAP only if one isolated effect genuinely needs it; do not add GSAP merely because the portfolio uses it. Avoid a heavy smooth-scroll library inside data-heavy dashboards unless it remains stable and accessible.

Use purposeful motion such as:

- Smooth page and route transitions using opacity and small positional movement.
- Staggered entrance animations for dashboard summaries and ticket cards.
- Subtle card lift, border glow, light tilt or depth response on desktop hover.
- Animated active indicators in the sidebar and tab navigation.
- Smooth expanding/collapsing filter panels, accordions and ticket timelines.
- Polished modal, drawer, dropdown and toast transitions.
- Animated counters or progress indicators where they communicate real data.
- Skeleton loading states that match the final layout.
- Buttons with refined hover/press feedback and small icon movement.
- Table-row hover feedback and smoothly appearing row actions.

Animation must never make routine work slower. Prefer transform and opacity animations, usually around 150–400 ms. Do not delay form submission, navigation or data display just to play an animation. Respect `prefers-reduced-motion`, reduce effects on mobile, and maintain full keyboard usability.

The strongest visual animation may appear on the login/registration experience and dashboard overview. Forms, large tables, reports and administrative pages should use calmer micro-interactions so they remain practical.

Do not use excessive parallax, constant floating elements, distracting background movement or aggressive custom cursors across operational pages. If a custom cursor or spotlight effect is used, restrict it to suitable desktop-only presentation areas and ensure the normal interface remains completely usable without it.

Requirements:

- Responsive layouts for phone, tablet and desktop.
- Separate navigation and dashboards based on role.
- Clear forms with labels, required-field indicators and understandable validation errors.
- Search/filter controls that remain usable on small screens.
- Consistent status and priority badges; do not rely only on color.
- Loading, empty, success and error states.
- Confirmation dialogs for important actions.
- Keyboard-accessible controls, visible focus states and reasonable contrast.
- Protected frontend routes, while remembering that the backend is the real security boundary.
- A polished application shell with a distinctive sidebar/top bar, animated active states and responsive mobile navigation.
- Dashboard cards and ticket views that feel intentionally designed rather than generated from a standard admin template.
- A shared motion configuration so easing, duration and spring behaviour remain consistent.
- No layout shift, blocked clicks or performance-heavy animation during normal use.

Do not build a mock-only frontend. Connect pages to real backend endpoints as each feature is implemented.

Before considering the frontend complete, visually review at least the login page, each role dashboard, ticket creation form, ticket detail/timeline, supervisor queue, reports page and administrator screens at desktop and mobile sizes. Fix generic-looking sections, inconsistent spacing, awkward responsive behaviour and animation glitches.

## 9. Docker and XAMPP Support

The application must support two documented local launch methods.

### Method A — Full Docker Setup

Create a working `docker-compose.yml` that starts:

- Frontend
- Backend API
- MySQL database

Use health checks and named volumes where useful. A fresh user should be able to launch the project with a short command such as:

```bash
docker compose up --build
```

Suggested local URLs:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000`
- Swagger: `http://localhost:5000/api-docs`

If exposing the Docker MySQL port to the host, prefer a configurable host port such as `3307` so it does not conflict with XAMPP MySQL on `3306`.

### Method B — Local Node.js with XAMPP MySQL

Document how to:

1. Install Node.js, npm, Git and XAMPP.
2. Start the **MySQL service** from the XAMPP Control Panel. Apache is not required for the React/Express application, although phpMyAdmin may be used optionally.
3. Create the project database using the migration command or supplied SQL/migration runner.
4. Configure the backend environment variables for XAMPP, normally:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=mepco_help_desk
```

5. Install frontend and backend dependencies.
6. Run migrations and seed scripts.
7. Start backend and frontend development servers.
8. Open the frontend and Swagger URLs.

The same application code, migrations and seed scripts must work for both MySQL launch methods. Configuration differences should be handled through environment variables, not source-code edits.

## 10. README.md Is a Required Deliverable

Create a complete root `README.md` written for a student or reviewer who has never run the project before.

It must include:

- Project title and short description.
- Main features and five user roles.
- Technology stack.
- Project folder structure.
- Prerequisites.
- Full Docker launch instructions.
- Full local/XAMPP MySQL launch instructions for Windows.
- Exact environment variables with safe example values.
- Dependency installation commands.
- Database migration, seed, reset, backup and restore commands.
- Frontend, backend and Swagger URLs.
- Fictional seeded login accounts for each role, clearly labelled as development-only credentials.
- Commands for development, production build, tests and linting.
- How attachment storage works locally.
- How to stop or reset Docker containers and volumes safely.
- Common troubleshooting:
  - Port 3306/3307 already in use.
  - XAMPP MySQL not starting.
  - Database access denied.
  - Missing `.env` files.
  - CORS errors.
  - Docker daemon not running.
  - Migration/seed failure.
  - Frontend unable to reach the API.
- Git feature-branch and pull-request workflow expected by the project.
- Security warning never to use demo credentials or example secrets in production.

Keep the README synchronized with the commands that actually exist. Verify every documented command before claiming it works.

## 11. Environment and Security Files

Create:

- Appropriate `.gitignore` files.
- `backend/.env.example`.
- `frontend/.env.example` if the frontend needs configurable values.
- Safe Docker environment defaults or an example environment file.

Never commit real `.env` files, database files, uploaded user files, dependency folders, build outputs or secrets.

## 12. Testing and Verification

At minimum, automated tests should cover:

- Consumer, Employee and staff authentication.
- Refresh-token rotation and logout/revocation.
- Suspended users.
- Permission checks for all five roles.
- Users attempting to access another user’s ticket.
- Ticket creation and validation.
- Valid and invalid ticket-status transitions.
- Assignment and reassignment history.
- Public comments versus internal notes.
- Pagination, filtering and sorting.
- Administrator master-data changes.
- Audit-log creation for sensitive actions.

After every meaningful milestone:

1. Run relevant tests.
2. Run TypeScript checks and linting.
3. Start the affected services.
4. Verify the real flow through the UI and API where possible.
5. Fix issues before moving on.

Do not say a command or feature works unless you actually ran or verified it in the current environment. If Docker or XAMPP cannot be run from your environment, still validate everything possible and clearly state the exact unverified step.

## 13. Git and Change Management

If Git is not initialized, initialize it and create a suitable `.gitignore`. Prepare the project for feature branches and pull requests, but do not push to GitHub, open a pull request or publish anything unless I explicitly ask.

Use focused changes and preserve existing user work. Do not delete or rewrite unrelated files.

## 14. Implementation Order

Use this order unless the existing project requires a small adjustment:

1. Repository structure, environment files, Docker Compose and database connection.
2. Database schema, migrations and seed runner.
3. Authentication, refresh sessions and RBAC.
4. User profiles and Administrator account management.
5. Master data: departments, circles, cities, categories, complaint types, priorities and statuses.
6. Ticket creation, requester ticket lists and ticket details.
7. Supervisor assignment/reassignment and Technician workflow.
8. Comments, internal notes, attachments, history and notifications.
9. Dashboards, search, filtering, pagination and reports.
10. Administrator configuration, announcements and audit-log interface.
11. Swagger/OpenAPI completion and automated test coverage.
12. README verification, Docker/XAMPP launch testing and final cleanup.

Implement each milestone as a usable vertical slice. Do not leave core routes or pages as permanent placeholders.

## 15. Final Deliverables

The completed workspace should contain:

- Working React frontend.
- Working Express API.
- MySQL schema, migrations and realistic fictional seed data.
- Secure authentication and five-role RBAC.
- All main ticket-management workflows from the SRS.
- Docker Compose local environment.
- XAMPP-compatible local database configuration.
- Swagger/OpenAPI documentation.
- Automated backend/API tests.
- Root README with verified Docker and XAMPP launch instructions.
- Clean `.gitignore` and example environment files.
- No committed secrets or real MEPCO personal data.

Start now by reading the attached SRS, inspecting the workspace, and presenting the implementation plan. Then begin with the first milestone and verify it before moving forward.
