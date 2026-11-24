# Service Admin App

React Native client for the Service Admin API. New accounts register with a name and email or mobile number, then verify a one-time code. Existing accounts sign in with an OTP; unknown accounts cannot use the login flow. Password sign-in is not part of the app.

The backend is the source of truth for onboarding. Closing the app and opening it again calls `POST /api/auth/refresh` and `GET /api/auth/me`, then opens the step that matches `onboardingStatus`.

## Run

```sh
cd Service_admin_App
npm install
npm run start
# In a second terminal:
npm run android
```

This is a bare React Native CLI Android app. `npm run start` starts Metro; `npm run android` builds and installs the native debug app on a connected device or emulator. No Expo Go or Expo development server is used.

For a phone connected over Wi-Fi ADB, pair and connect it first, then run `npm run android:wifi`. To select one device when several are connected, set `$env:ANDROID_SERIAL` to its ADB serial before running the script. Only run one app's Metro server at a time; both apps use port 8081, so stop the other app's server first. Metro and the phone must be able to reach one another; start the backend separately and ensure it listens on `0.0.0.0`. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` to the backend computer's reachable LAN IP and port (for example, `http://192.168.1.8:3000`). The native app reads this configuration at build time, so rebuild/reinstall after changing it. Release builds only allow HTTPS.

Rebuild the native app after pulling or changing `.env`. Site GPS uses `@react-native-community/geolocation`, linked through React Native autolinking.

```sh
npm test
npm run typecheck
npm run lint
```

The OTP is never returned by the API and is never stored or prefilled in the app. Local development can use `DEV_FIXED_OTP` from the backend environment; retrieve locally delivered codes from `/api/dev/mailbox` only when enabled. Production email OTP delivery requires SMTP, and production SMS requires a configured provider.

Company, site, and profile onboarding fields start from the authenticated account and backend records; sample data is never prefilled by the app. The optional backend seed command stores local sample records in PostgreSQL, which the app then loads through the normal API.

## Architecture

```
App
  ThemeProvider          light/dark appearance, reduced motion
  AuthProvider           session, account, onboarding status
  RootNavigator
    Splash               cold start and offline retry
    AuthNavigator        welcome, email-or-phone login/signup, OTP
    OnboardingNavigator  company, sites, profile, complete
    AppNavigator         dashboard and account tools
```

Screens do not call `fetch`. They use `src/api/client.js` through `src/api/auth.api.js` and `src/api/resources.js`. Session writes go through `src/services/auth.service.js`, which stores only the access token and refresh token.

| Layer | Path | Responsibility |
| --- | --- | --- |
| Client | `src/api/client.js` | JSON envelope, bearer header, one refresh retry, 401 session expiry |
| Auth API | `src/api/auth.api.js` | OTP, profile name, email verification |
| Resources | `src/api/resources.js` | Company, sites, profile, API keys, sessions, roles |
| Auth service | `src/services/auth.service.js` | Persist or clear the keychain session and attach device metadata |
| Secure storage | `src/storage/secureStorage.js` | Refresh and access tokens in the device keychain |
| Preferences | `src/storage/preferences.js` | Light/dark appearance and a non-secret device id |

No database credentials, OTP peppers, or server secrets are in the app.

## Routes

Signed out:

| Route | Screen |
| --- | --- |
| `Welcome` | Get started or log in |
| `Register` | Name and email or phone number |
| `Login` | Registered email or phone number |
| `OTPVerification` | 6-digit code |

Onboarding, chosen from `onboardingStatus`:

| Status | Route |
| --- | --- |
| `COMPANY_PENDING`, `PHONE_VERIFIED`, `COMPANY_COMPLETED` | `CompanyDetails` |
| `SITES_PENDING`, `SITES_COMPLETED` | `Sites` |
| `PROFILE_PENDING` | `Profile` |
| `ONBOARDING_COMPLETED` | Dashboard, after the in-session complete screen |

Signed in and finished:

| Route | Screen |
| --- | --- |
| `Dashboard` | Field board: emergency, jobs, AMC, repair, compliance |
| `Emergency` | Raise a 30-minute rush visit |
| `QuickServices` | Book panel, PLC, or cabling work |
| `Jobs` | Open jobs and status updates |
| `Amc` | Cover and 48-hour quotes |
| `Projects` | Installation bookings |
| `Marketplace` | Spare catalogue, when the role allows it |
| `Compliance` | Certificates |
| `RepairCenter` | Workshop send-in |
| `Expert` | Request a call |
| `Company` | Edit company |
| `SitesList` | Add, edit, remove, and choose the primary site |
| `ProfileSettings` | Name, role, email |
| `Security` | Set or change password, sign out |
| `APIKeys` | Create, rotate, revoke |
| `Sessions` | Active devices |
| `Appearance` | Light or dark mode |

`Splash` is shown while the session is restoring, and again with retry when the API cannot be reached.

## State

`AuthProvider` keeps:

- `status`: `loading`, `offline`, `unauthenticated`, `authenticated`
- `user`, `company`, `onboardingStatus`, `onboarding`
- `celebrate`: memory-only flag for the completion screen

`celebrate` is not stored. If the app is closed on that screen, the next launch reads `ONBOARDING_COMPLETED` and opens the dashboard.

A 401 on an authenticated call refreshes once. If refresh fails, the keychain session is cleared and the handler returns the app to phone sign-in.

## API integration

Success responses use `{ success, data }`. Errors use `{ success: false, error: { code, message, details } }`.

| Step | Call |
| --- | --- |
| Send code | `POST /api/auth/send-otp` `{ email or phone, purpose, fullName for signup }` |
| Verify | `POST /api/auth/verify-otp` `{ email or phone, otp, purpose, fullName for signup, deviceId, deviceName }` |
| Restore | `POST /api/auth/refresh`, then `GET /api/auth/me` |
| Company | `POST /api/companies` or `PATCH /api/companies/:id` |
| Sites | `GET/POST /api/companies/:companyId/sites`, `PATCH/DELETE /api/sites/:id`, `PATCH /api/sites/:id/primary` |
| Profile | `POST /api/profile` or `PATCH /api/profile` |
| Keys | `GET/POST /api/api-keys`, `POST /api/api-keys/:id/revoke`, `POST /api/api-keys/:id/rotate` |
| Sessions | `GET /api/auth/sessions`, `POST /api/auth/sessions/:id/revoke` |
| Dashboard | `GET /api/dashboard` |

Client checks mirror the server for phone, OTP, GSTIN checksum, city, site coordinates, and email. The server still rejects bad data. Field errors from `422 VALIDATION_ERROR` are shown on the matching inputs.

Role labels in the profile are the real account roles:

| API role | Label |
| --- | --- |
| `DIRECTOR_OWNER` | Director / Owner |
| `MAINTENANCE_HEAD` | Maintenance Head |
| `PURCHASE_MGR` | Purchase Manager |
| `SITE_ENGINEER` | Site Engineer |

Creating a company makes that account `DIRECTOR_OWNER`. The API rejects changing your own role. The profile still offers the other labels so the server, not the form, enforces that rule.

A full API key is held in memory only until you leave the screen. It is not written to the keychain.

## Theme

`ThemeProvider` provides light and dark appearance modes with a fixed orange action, red alert, and green success palette. Appearance choices are stored in the preferences keychain entry, separate from the auth session. Older saved accent and navigation palette preferences are ignored. `AccessibilityInfo` turns off progress, splash, and skeleton motion when reduced motion is enabled.

The choice is stored in the preferences keychain entry, separate from the auth session. `AccessibilityInfo` turns off progress, splash, and skeleton motion when reduced motion is enabled.

## Onboarding

Progress is Account, Company, Sites, Profile, Complete. The active step comes from `stepIndexForStatus` in `src/constants/onboarding.js`, using the status returned by the API.

1. Get started requests a signup code for a new email or phone number; login requests a code only for an existing account.
2. Verify creates the new account or stores the existing session, then continues onboarding or opens the profile.
3. Company collects name, GSTIN, industry, and city.
4. Sites can be added, edited, removed, and marked primary. GPS permission is requested only from the location button. If it is denied, coordinates can be typed.
5. Profile collects name, confirms the assigned role, and optional email.
6. The complete screen opens the dashboard for this session only.

The dashboard loads `GET /api/dashboard`. The board shows live field work from that response: emergency, repair confirmation, an engineer on the way, active jobs, SLA risk, AMC, expiring certificates, and recent jobs. Quick services, projects, marketplace spares, and the service menu come from `/api/field`. Counts stay at zero until someone creates a job, quote, or certificate. People, marketplace, workshop send-in, and API keys stay hidden when the role cannot read them.

| Role | Field actions |
| --- | --- |
| Director / Owner, Maintenance Head | Emergency, jobs, AMC quotes, marketplace, compliance, workshop |
| Purchase Manager | Jobs, AMC quotes, marketplace, workshop. Job status changes stay with the engineer |
| Site Engineer | Emergency, booking, job status. Marketplace and workshop stay hidden |

## Components

Shared UI lives in `src/components`: `Screen` (keyboard-safe scroll and sticky actions), `Button`, `TextField`, `Banner`, `AppBar`, `ProgressHeader`, `Skeleton`, `EmptyState`, `OptionGroup`, and `FadeIn`. Company, site, and profile forms are in `src/components/forms` and are reused by onboarding and the signed-in screens.

## Validation

`npm test` runs the flow unit tests; `npm run lint` runs ESLint for the app. Verify phone, dark mode, and keyboard layouts on a device with `npm run android` against the local API.
