# Energy Hub Shared Backend

This is the single API server used by both mobile apps and the Superadmin web UI.

| Module | API prefix |
|---|---|
| Energy Hub mobile app | `/api/v1` |
| Service Admin mobile app | `/api` |
| Website | `/api/website` |
| Existing Superadmin API | `/api/superadmin` |
| Superadmin web-console API | `/api/superadmin/console` |

## Setup

Copy `.env.example` to `.env`, configure PostgreSQL and a unique Superadmin password of at least 12 characters, then install dependencies:

```powershell
Copy-Item .env.example .env
npm ci
```

Set `SUPERADMIN_EMAIL`, `SUPERADMIN_NAME`, and `SUPERADMIN_PASSWORD` before the first start. The console admin records are stored in the separate `data/superadmin-access-control.json` file (or `SUPERADMIN_DATA_FILE`) so they do not conflict with the operational PostgreSQL database.

## Run

```powershell
npm run dev
```

The shared API listens on port 3000 by default. From `E:\gravityhub\superadmin\frontend`, run `npm ci` once and `npm start -- --host 127.0.0.1`; its `/api` proxy points to this server.

## Tests

```powershell
npm test
```

The suite includes Superadmin authentication, permissions, storage, and a shared-process integration test, along with the provider and service backend checks.
