# DPR System — Bhushilp Mines and Minerals Pvt. Ltd.

Mobile-friendly daily reporting system for mine sites, replacing the paper
shift-card + end-of-day Excel transcription process. Built as a classic MERN
app (Express + MongoDB/Mongoose backend, React/Vite frontend).

## How it's organized

- **Login → Business line (Mining/Exploration) → Project → Form.** Each
  project gets its **own separate MongoDB database** — one small central
  database (`dpr_control`) holds users/projects/auth only.
- **Per-form, per-project access control.** A user's `assignments` say
  exactly which forms they can use on which projects (e.g. a clerk might
  only have Shift Card on one project). Enforced on the backend in
  middleware, not just hidden in the UI.
- **Forms live so far:**
  - **Shift Card** — the digitized version of the paper "Tipper/Dumper
    Driver Shift Card". One page: pick date, shift, vehicle and driver, fill
    in the card, save; entries already saved for that shift are listed
    underneath. One entry per date+shift+vehicle+driver.
  - **Daily Production** — one entry per date+shift.
  - **Daily Fuel Consumption** — one page, one entry per date+vehicle.
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
