# Super Admin Console

Angular 22 application for the Energy Hub Super Admin console. The API is served by the shared backend in `../../backend`; local development uses the Angular proxy on port 3000.

## Development

```bash
npm install
npm start
```

Open `http://localhost:4200`. The development server proxies API requests through [proxy.conf.json](./proxy.conf.json).

## Validation

```bash
npm test -- --watch=false
npm run build
```

The project currently has unit tests but no end-to-end test runner.

## Structure

- `src/app/core/` contains auth, API clients, guards, shared models, and session-level operations data.
- `src/app/features/admin/` contains the authenticated admin shell and its feature pages.
- `src/app/features/auth/` contains sign-in and account-entry flows.
- `src/styles.scss` loads the shared theme and global styles; `src/styles/` contains their Sass modules.
- `public/assets/` contains the active brand marks and app icons copied into the build.

## Required project configuration

- `angular.json` defines the Angular build, dev-server, proxy, asset, and test targets.
- `package.json` and `package-lock.json` define and lock the Angular toolchain and application dependencies.
- `tsconfig.json`, `tsconfig.app.json`, and `tsconfig.spec.json` provide separate compiler settings for the app and tests.

These are framework inputs, not duplicate application files; keep them aligned with the Angular CLI and dependency versions.
