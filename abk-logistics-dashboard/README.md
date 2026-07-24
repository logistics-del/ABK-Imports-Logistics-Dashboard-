# ABK Imports — Logistics Performance Dashboard

A full-stack logistics KPI dashboard: Django REST Framework backend, React
(Tailwind) frontend, PostgreSQL, Celery + Redis for scheduled multi-source
data sync, and an India state-level heatmap with click-to-export.

---

## Architecture

```
abk-logistics-dashboard/
├── backend/            Django + DRF + Celery
│   ├── abk_dashboard/   settings, urls, celery app
│   ├── accounts/        custom User (admin/viewer roles), JWT auth
│   ├── shipments/       Shipment model, KPI/heatmap/export APIs, audit log
│   └── data_ingestion/  API / Excel / Google Sheets connectors + sync log
├── frontend/            React + Tailwind CSS
│   └── src/
│       ├── pages/        Login, Dashboard, DataManagement, UserManagement
│       ├── components/   KPICards, IndiaHeatmap, ShipmentTable, FilterBar,
│       │                 DataUploadPanel, LiveRefreshTimer, Navbar
│       ├── context/       AuthContext (JWT session)
│       └── utils/         api.js (axios + refresh), exportExcel.js
├── docker-compose.yml
├── .env.example
└── README.md
```

## Status colour scheme

| Status | Color |
|---|---|
| HIT | `#28a745` |
| MISS | `#DC143C` |
| RTS | `#FF8C00` |
| Total Intransit | `#FFBF00` |
| Out for Delivery | `#FFD700` |
| Delivered | `#28a745` |
| Exception | `#6D0F35` |
| NDR | `#6D0F35` |

Applied consistently in `KPICards.jsx`, `ShipmentTable.jsx` (status badges),
and `IndiaHeatmap.jsx` (choropleth color scale).

---

## Local Setup

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp ../.env.example ../.env      # fill in DB / Redis / Google creds
python manage.py makemigrations accounts shipments data_ingestion
python manage.py migrate
python manage.py createsuperuser
python manage.py seed_demo_data --count 800   # optional: realistic demo data
python manage.py runserver
```

Requires a local PostgreSQL instance matching `DB_*` in `.env`, and Redis
running on `REDIS_URL` (default `redis://localhost:6379/0`).

### 2. Celery (two extra terminals, from `backend/`)

```bash
celery -A abk_dashboard worker --loglevel=info
celery -A abk_dashboard beat --loglevel=info
```

`celery beat` is what drives the 15–30 minute auto-refresh — the interval is
read from `AUTO_REFRESH_INTERVAL_MINUTES` in `.env` (also configurable per
source in the Data Management panel).

### 3. Frontend

```bash
cd frontend
npm install
npm start
```

Runs on `http://localhost:3000`, talking to the API at
`REACT_APP_API_BASE_URL` (default `http://localhost:8000/api`).

---

## Docker Setup (recommended)

```bash
cp .env.example .env
docker-compose up --build
```

- Dashboard: http://localhost:3000
- API: http://localhost:8000/api
- Django admin: http://localhost:8000/admin

`docker-compose` brings up Postgres, Redis, the Django API, a Celery
worker, Celery beat, and the React dev server. First boot runs
migrations automatically; create your admin user with:

```bash
docker-compose exec backend python manage.py createsuperuser
docker-compose exec backend python manage.py seed_demo_data --count 800
```

---

## Authentication & Roles

- `POST /api/auth/login/` → `{ access, refresh, user }` (JWT).
- **Admin**: full CRUD on shipments, data-source configuration, Excel
  import, inline edits, user management.
- **Viewer**: read-only dashboard, filtering, and state-level Excel export.

Role is embedded in the JWT and also returned in the `user` object, so the
frontend can gate the *Data Management* / *User Management* nav items
(`AuthContext.jsx` exposes `isAdmin`).

---

## Data Ingestion

All three ingestion paths converge on the same `Shipment` table and dedupe
by `invoice_number` (`data_ingestion/mapping_utils.py::upsert_shipment_row`).

### A. REST API
Configure endpoint URL, auth token/header, and a `field_mapping` JSON
(`{"External Field": "internal_field"}`) in **Data Management → REST API
Integration**. "Test Connection" hits the endpoint once and shows a sample
record; "Sync Now" runs an on-demand pull; Celery beat runs it automatically
every `sync_interval_minutes`.

### B. Google Sheets
Same idea, authenticated via a per-source service-account JSON key (or the
app-wide `GOOGLE_SERVICE_ACCOUNT_FILE` fallback). Share the target sheet
with the service account's `client_email` first.

### C. Excel / CSV Upload
Drag-and-drop in **Data Management → Excel/CSV Upload**:
1. `POST /api/ingestion/excel/preview/` → headers, first 10 rows, and a
   best-guess column mapping.
2. Adjust the mapping in the UI (all 5 required fields — invoice number,
   ship date, EDD date, status, state — must be mapped).
3. `POST /api/ingestion/excel/import/` commits the import and logs the
   result.

Every sync (scheduled or manual, any source) writes a `SyncLog` row visible
in **Data Management → Recent Sync Log**, and the dashboard header shows
"Last Updated" from the most recent successful KPI refresh.

---

## India Heatmap & State Export

`IndiaHeatmap.jsx` renders state boundaries via `react-simple-maps` using a
public GeoJSON source (`geohacker/india`). Clicking a state calls
`GET /api/shipments/export-state/<state>/`, which streams an `.xlsx` built
by `shipments/utils.py::build_pending_cases_workbook` with exactly these
columns:

```
Invoice Number | Month | Ship Date | EDD Date | Delivery Date | Shipment Status |
Ageing TAT (days) | City | State | Customer Mobile Number | Mode of Payment |
Remarks | Compliance Category
```

filtered to "pending/active" statuses (`INTRANSIT`, `OFD`, `EXCEPTION`,
`NDR`, `MISS`), and named `ABK_Pending_Cases_<State>_<Date>.xlsx`.

> **Note:** for a fully offline/air-gapped deployment, download the
> GeoJSON once and serve it from `frontend/public/india_states.geojson`,
> then point `GEO_URL` in `IndiaHeatmap.jsx` at the local path instead.

---

## Inline Editing & Audit Log

The shipment table supports inline editing of **Remarks** and **Compliance
Category** (Admin role). Each save is a `PATCH
/api/shipments/shipments/<id>/inline-edit/`, which:
- Writes the change immediately to Postgres.
- Shows a green "Saved ✓" confirmation in the cell.
- Creates an `AuditLog` row (`shipments/models.py`) recording who changed
  what and when — visible via `GET /api/shipments/shipments/audit-log/`.

---

## Live Auto-Refresh

`LiveRefreshTimer.jsx` shows a live "Next refresh in mm:ss" countdown and
the last-updated timestamp, re-fetching KPI/heatmap/table data on expiry or
on manual "Refresh now". The dashboard currently uses polling rather than a
websocket push (Channels is wired into `settings.py`/`asgi.py` and included
in `requirements.txt` for anyone who wants to extend this to a live push
model — polling was chosen here to keep the moving parts you have to run
locally to a minimum).

---

## Key API Endpoints

| Method & Path | Description |
|---|---|
| `POST /api/auth/login/` | Obtain JWT (access + refresh + user) |
| `POST /api/auth/token/refresh/` | Refresh access token |
| `GET/POST /api/auth/users/` | User management (admin only) |
| `GET /api/shipments/kpi-summary/` | KPI card counts, %, trend vs. previous period |
| `GET /api/shipments/heatmap/?metric=hit_rate\|miss_rate` | Per-state map data |
| `GET /api/shipments/vendor-performance/` | HIT/MISS/RTS by vendor |
| `GET /api/shipments/export-state/<state>/` | Excel export of pending cases |
| `GET/POST /api/shipments/shipments/` | Shipment list/create (filterable) |
| `PATCH /api/shipments/shipments/<id>/inline-edit/` | Inline remarks/compliance edit |
| `GET /api/shipments/shipments/audit-log/` | Recent audit trail |
| `POST /api/ingestion/excel/preview/` | Upload preview + suggested mapping |
| `POST /api/ingestion/excel/import/` | Confirmed Excel/CSV import |
| `GET/POST /api/ingestion/sources/` | REST API / Google Sheets source config |
| `POST /api/ingestion/sources/<id>/test-connection/` | Validate a source |
| `POST /api/ingestion/sources/<id>/sync-now/` | Trigger an on-demand sync |
| `GET /api/ingestion/sync-logs/` | Sync history |

All list endpoints accept the shared filter set: `ship_date_from/to`,
`edd_date_from/to`, `delivery_date_from/to`, `status` (comma-separated),
`state`, `vendor`, `mode_of_payment`, `compliance`, `search`.

---

## Online Demo Deployment (Render, free tier)

A `render.yaml` blueprint is included at the project root so the whole app
(database + backend + frontend) can be deployed to Render's free tier from
a connected GitHub repo, without installing anything locally.

**This is a look-around demo path, not a private/production one:**
- The free Postgres database is **deleted after 30 days**.
- The free backend service **cold-starts** (sleeps after 15 min idle, ~30–60s
  to wake up).
- Celery/Redis are intentionally left out (background workers need a paid
  Render plan) — scheduled auto-sync won't run, but everything else
  (manual refresh, Excel upload, the dashboard itself) works normally.
- It ships with a fixed demo login (`admin` / `ABKDemo2026!`, seeded via
  `bootstrap_demo` on first deploy) and 800 fake sample shipments — **don't
  put real customer data into this deployment.** For real data, run it
  privately (Docker on your own machine/company server) as described above.

To use it: push this project to a GitHub repo, then in Render click
**New + → Blueprint**, connect the repo, and click **Apply**. Render reads
`render.yaml` and provisions the database, backend, and frontend
automatically.

## Production Notes

- Set `DEBUG=False`, a strong `DJANGO_SECRET_KEY`, and a real
  `ALLOWED_HOSTS` before deploying.
- Swap the frontend Docker target from `dev` (hot-reload dev server) to a
  static build served by nginx/whitenoise for production traffic — the
  `build` stage in `frontend/Dockerfile` is already set up for this.
- Rotate/secure the Google service-account JSON and API tokens; they're
  stored as-is in Postgres/media today, so put the DB behind proper access
  control and consider field-level encryption if you're handling sensitive
  third-party credentials at scale.
- `channels`/`channels-redis` are included so the polling-based refresh can
  be swapped for a websocket push without adding a new dependency later.
