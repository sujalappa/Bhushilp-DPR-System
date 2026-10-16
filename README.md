# DPR System — Bhushilp Mines and Minerals Pvt. Ltd.

Mobile-friendly daily reporting system for mine sites, replacing the paper
shift-card + end-of-day Excel transcription process. Built as a classic MERN
app (Express + MongoDB/Mongoose backend, React/Vite frontend).

## How it's organized

- **Login → Business line (Mining/Exploration) → Project → Form.** Each
  project gets its **own separate MongoDB database** — one small central
  database (`dpr_control`) holds users/projects/auth only.
- **Three roles** (`backend/utils/roles.js`), enforced on the backend in
  middleware, not just hidden in the UI:
  - **Superadmin** — everything, every project; creates projects and
    admins, and picks which projects each admin runs.
  - **Admin** — everything inside their projects (`adminProjects`): all
    forms and entries, work orders, levels, rates, labour and billing,
    export, analysis. Adds the supervisors who work there and ticks their
    forms.
  - **Supervisor** — fills in the forms they're assigned (`assignments`,
    per project and form). On the underground forms their own name is
    filled in as the supervisor (they can change it).
  Accounts from before roles existed read as superadmin or supervisor from
  their old `isSuperAdmin` flag.
- **Forms live so far:**
  - **Shift Card** — the digitized version of the paper "Tipper/Dumper
    Driver Shift Card". One page: pick date, shift, vehicle and driver, fill
    in the card, save; entries already saved for that shift are listed
    underneath. One entry per date+shift+vehicle+driver. Each entry is
    ticked as OB Rehandling or Soft OB; its trips count towards that column
    of Daily Production (per-trip figures in `backend/utils/obFactors.js`).
  - **Daily Production** — one entry per date+shift. OB Rehandling and Soft
    OB are filled in from the Shift Card.
  - **Daily Fuel Consumption** — one page, one entry per date+vehicle.
- **Underground projects have their own forms.** A project's type (Open
  Cast, Underground, Exploration) decides which forms it shows. An
  underground project opens on its **work orders** (e.g. 9100005472); the
  forms sit inside a work order, and each work order holds its own rate per
  m³ and wage rates.
  - **Level Production** — one entry per date+shift+work order+level+
    supervisor (a gang): head counts and tubs. Tons, m³ and OMS are
    calculated from that level's own conversion factors, shown under the
    level picker on the form, where the superadmin can edit them. Below the
    form: the workbook's labour and billing block (driller and helper
    man-shifts converted to m³, Total Cum, Billing amount) for the day and
    month to date.
  - **Development** — one entry per date+shift+work order+heading (e.g.
    "-170 Ore Drive"): head counts, ore or rock tons, filling and metres of
    progress, with a running total per heading.
  - On both, entering a head count opens that many name boxes. Names are
    optional; the server matches them to one shared list of workers.
  - `backend/scripts/assignWorkOrder.js` moves entries saved before work
    orders existed under a work order.
  - **Works offline.** The app can be added to a phone's home screen and
    opens with no signal (`frontend/public/sw.js`). Level Production and
    Development entries saved without signal stay on the phone, marked
    "waiting to send", and are sent when the signal returns
    (`frontend/src/offline/`). An entry the server refuses stays on the
    phone with the reason, to fix or discard. Things that need the server
    while offline (adding a heading, deleting, labour and billing, admin
    pages) say so. Production builds only; `npm run dev` has no service
    worker.
- **Superadmin Analysis** (`/admin/analysis`) — charts over a project's
  entries for a chosen period (production, manpower, trips, fuel,
  development progress), each with a table view of the same figures. The
  charts follow the project's type, like its forms.
- **Superadmin Data Export** (`/admin/export`) — on-page spreadsheet view
  plus a full multi-sheet Excel download, across all projects, for backup.

See `Kamptee_OC_Mine_Daily_Reporting_Formats (1).xlsx` for the original
paper-based Excel workbook this app is digitizing, sheet by sheet.

## Project structure

```
backend/     Express API — config/, models/, controllers/, routes/, middleware/
frontend/    React (Vite) + Tailwind CSS
```

## Setup

### 1. Backend

```
cd backend
npm install
cp .env.example .env   # then fill in your own MongoDB connection string
npm run dev
```

Required env vars (`backend/.env`):

| Variable | Meaning |
|---|---|
| `MONGO_URI_BASE` | Your MongoDB Atlas cluster base URI, no database name (`mongodb+srv://user:pass@cluster-host`) |
| `MONGO_CENTRAL_DB` | Name of the central DB, e.g. `dpr_control` — created automatically on first use |
| `JWT_SECRET` | Any long random string, used to sign login sessions |
| `JWT_EXPIRES_IN` | Session length, e.g. `30d` |
| `CLIENT_ORIGIN` | URL of the running frontend, for CORS (`http://localhost:5173` in dev) |
| `PORT` | Port the API listens on (default `5000`) |

Each project's own database is created automatically the first time it's
provisioned through the app — nothing to set up manually there.

### 2. Seed the first superadmin

There's no login yet on a brand-new database, so this one-time script
bootstraps the first account (everyone else is created afterwards through
the app's Manage Users screen):

```
cd backend
node scripts/seedSuperAdmin.js "Full Name" you@example.com yourpassword
```

### 3. Frontend

```
cd frontend
npm install
cp .env.example .env   # defaults to http://localhost:5000/api, adjust if needed
npm run dev
```

Then open the printed local URL and log in with the superadmin account
from step 2.

## Notes for a new environment (e.g. a colleague testing this)

- `.env` files are gitignored on purpose (they hold real database
  credentials) — always copy from `.env.example` and fill in your own
  values, never share/commit the real one.
- Pointing `MONGO_URI_BASE` at a different cluster is enough to run this
  app against a completely separate, empty database — just remember to
  seed a superadmin on it (step 2 above).
