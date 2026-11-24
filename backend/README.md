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
Superadmin users can update their display name and phone number, manage a JPEG, PNG, or WebP profile photo, and change their password from their profile page. Photos are resized in the browser, limited to 512 KB, and stored in a private sibling `<data-file>.avatars` directory; sign-in email remains read-only because email verification is not configured. Password changes require the current password and a new password of 12–200 characters; the current session is retained and other active sessions are revoked.

Shared company details are stored in the Superadmin JSON state and can be edited only by accounts with `settings:edit`. The initial business phone is `6483948880`; company name and GSTIN remain blank until provided, and `contact@example.invalid` is a non-deliverable email placeholder. Access summaries identify whether page access comes from the user's role defaults or a custom assignment and link to each permitted console page.

For local development only, `ENABLE_LOCAL_DEMO_LOGIN=true` enables a separate superadmin demo account using `LOCAL_DEMO_EMAIL` and `LOCAL_DEMO_PASSWORD`. The login page displays a fill-in card for this account, and the backend only reveals or accepts its credentials on loopback requests. The server refuses to start this feature outside `NODE_ENV=development`; keep it disabled for shared or production deployments.

Superadmin page visibility and API access use each signed-in account's effective `view` permission. Role defaults apply unless **User access** sets an account-specific matrix; this also allows an individual Superadmin account to be restricted without changing the full-access Superadmin role default. Accounts cannot change their own page access.

From **Users & Roles**, a Superadmin with user view/edit access can open an active non-Superadmin account in a separate tab. The one-time launch link expires after 60 seconds; the tab receives a 30-minute session scoped to that user and their effective permissions. The Superadmin's role and user-management access are rechecked on requests, actions are audited with the initiating Superadmin attributed, password changes are blocked while viewing another account, and ending the tab session does not replace the original tab's login.

The Superadmin **App Registrations** page is available at `/directory`. It combines Energy Hub partner accounts with Service Admin user accounts, assigns stable unique registration IDs, and shows saved profile, service, payout, and rating information. Its API endpoint is `GET /api/superadmin/console/admin/registrations` and requires the `directory:view` permission. Existing access-control files are migrated to deny this personal-data view to viewer accounts by default.

Energy Hub partners can share foreground GPS while checked in to an active service job. The app requests location permission at check-in, sends updates only while the job workflow is open in the foreground, and stops tracking when the job is completed. Only the latest position is retained; Superadmin profile access shows a fresh position for two minutes and then hides its coordinates. No background tracking is performed. Service completion-time estimates and written customer reviews are not stored.

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
