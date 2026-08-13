# Material FIFO Production Hotfix Design

## Context

After PR #38 was merged, production logs exposed three independent client-side failures:

1. Material FIFO sidebar links are relative to the current nested URL. From `/material-fifo/overview`, selecting Data FIFO produces `/material-fifo/overview/data` instead of `/material-fifo/data`.
2. The service worker returns the network `Response` before the asynchronous cache callback clones it. Once the browser starts consuming the response body, `response.clone()` throws `Response body is already used`.
3. `AuthProvider` initializes authentication twice: it calls `getSession()` and also handles Supabase's `INITIAL_SESSION` event. Both paths call `getCurrentUserProfile()`, which performs another `/auth/v1/user` validation request. An invalid persisted session therefore causes duplicate validation, misleading “profile inactive” logging, and repeated sign-out events. A subsequent manual sign-in can still succeed.

## Scope

This is a targeted production hotfix. It does not change FIFO inventory rules, database schema, import/export formats, permissions, or visual design.

## Design

### Material FIFO routing

Sidebar destinations use absolute application paths (`/material-fifo/overview`, `/material-fifo/data`, and so on). Route matching remains inside the existing `/material-fifo/*` protected route.

### Service worker

The network-first handler clones a successful response synchronously, before any asynchronous cache operation and before returning the original response to the browser. Cache writes are attached to the fetch event lifetime. The cache version is incremented so the fixed worker removes the broken app-shell cache during activation. Supabase and other cross-origin requests remain outside service-worker handling.

### Authentication initialization

`onAuthStateChange` becomes the single initialization source, including `INITIAL_SESSION`. Profile lookup receives the authenticated user ID already present in the validated Supabase session instead of calling `auth.getUser()` again. Sign-in continues to validate credentials through `signInWithPassword`, then loads the profile by the returned user ID.

Profile outcomes are distinguished:

- missing/inactive profile: local sign-out with the existing user-facing access behavior;
- invalid or expired persisted session: clear only the local browser session once;
- transient profile query failure: stop loading and expose/log the actual error without labeling the profile inactive.

Explicit sign-out uses local scope so recovering one broken browser session does not revoke the user's sessions on other devices.

## Testing

- Routing regression verifies that navigation from Overview resolves to `/material-fifo/data`, not `/material-fifo/overview/data`.
- Service-worker regression simulates a response body being consumed immediately after the handler returns and verifies caching uses an already-created clone without rejection.
- Auth regressions verify one profile lookup for `INITIAL_SESSION`, no redundant `auth.getUser()` call, one local sign-out for an invalid initial session, and successful manual sign-in.
- Run the complete Vitest suite and production Vite build.

## Deployment

Merge and redeploy the hotfix. The service worker cache name change installs a new worker; existing clients receive the normal “Perbarui sekarang” prompt. Users with the already-broken worker can reload once or clear site data if the update prompt cannot complete.
