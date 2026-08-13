# Material FIFO Production Hotfix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix broken Material FIFO nested navigation, the production service-worker response-clone failure, and duplicate/misleading Supabase auth initialization.

**Architecture:** Keep the hotfix within the existing React/Supabase/PWA boundaries. Use absolute Material FIFO destinations, make the existing classic service worker clone cache responses before crossing an asynchronous boundary, and make Supabase `INITIAL_SESSION` the only startup-auth source while profile lookup consumes the session user already supplied by Auth.

**Tech Stack:** React 18, React Router 7, Supabase JS 2, classic Service Worker API, Vitest 4, React Testing Library.

## Global Constraints

- Do not change FIFO inventory rules, database schema, import/export formats, permissions, or visual design.
- Service workers must never intercept Supabase or other cross-origin requests.
- Authentication recovery must clear only the local browser session.
- Every production change requires a failing regression test first.
- Use one-worker Vitest commands because this Windows runtime cannot reliably run the default worker pool.

---

### Task 1: Absolute Material FIFO Navigation

**Files:**
- Modify: `src/features/material-fifo/components/MaterialFifoLayout.jsx`
- Modify: `src/test/MaterialFifoRouting.test.jsx`

**Interfaces:**
- Consumes: React Router `NavLink`, the protected `/material-fifo/*` route.
- Produces: sidebar destinations `/material-fifo/overview`, `/material-fifo/data`, `/material-fifo/transactions`, `/material-fifo/import`, `/material-fifo/export`, and `/material-fifo/sku`.

- [ ] **Step 1: Add a failing nested-navigation regression**

Extend `MaterialFifoRouting.test.jsx` with a harness that starts at `/material-fifo/overview`, renders `MaterialFifoLayout`, clicks `Data FIFO`, and exposes `useLocation().pathname`:

```jsx
const LocationProbe = () => <span data-testid="pathname">{useLocation().pathname}</span>;

render(
  <MemoryRouter initialEntries={['/material-fifo/overview']}>
    <Routes>
      <Route path="/material-fifo/*" element={
        <MaterialFifoLayout context={{}} openInbound={vi.fn()} openOutbound={vi.fn()} />
      }>
        <Route path="overview" element={<LocationProbe />} />
        <Route path="data" element={<LocationProbe />} />
      </Route>
    </Routes>
  </MemoryRouter>,
);
fireEvent.click(screen.getByRole('link', { name: 'Data FIFO' }));
expect(screen.getByTestId('pathname')).toHaveTextContent('/material-fifo/data');
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npx vitest run src/test/MaterialFifoRouting.test.jsx --maxWorkers=1 --no-file-parallelism
```

Expected: FAIL because the current relative `to="data"` resolves to `/material-fifo/overview/data`.

- [ ] **Step 3: Make sidebar destinations absolute**

Represent link slugs separately and build `to` with the stable workspace prefix:

```jsx
{links.map(([slug, label]) => (
  <NavLink key={slug} to={`/material-fifo/${slug}`}>...</NavLink>
))}
```

Preserve the existing active styles, mobile-menu close behavior, and Home button.

- [ ] **Step 4: Run routing tests and commit**

Run:

```powershell
npx vitest run src/test/MaterialFifoRouting.test.jsx src/test/MaterialFifoPages.test.jsx --maxWorkers=1 --no-file-parallelism
git add src/features/material-fifo/components/MaterialFifoLayout.jsx src/test/MaterialFifoRouting.test.jsx
git commit -m "fix: use absolute material fifo navigation"
```

Expected: all focused tests PASS.

---

### Task 2: Safe Network-First Service Worker

**Files:**
- Modify: `public/sw.js`
- Create: `src/test/serviceWorker.test.js`

**Interfaces:**
- Consumes: classic service-worker globals `self`, `caches`, `fetch`, `URL`, and FetchEvent methods `respondWith`/`waitUntil`.
- Produces: a network-first GET handler that clones a successful same-origin response before asynchronous cache work and uses cache name `warehouse-app-shell-v2`.

- [ ] **Step 1: Add a failing response-clone timing test**

Load the actual `public/sw.js` source with `node:fs`, evaluate it with `node:vm`, capture the registered `fetch` listener, and leave `caches.open()` unresolved:

```js
const clone = vi.fn(() => ({ cachedCopy: true }));
const response = { ok: true, clone };
let resolveOpen;
const openPromise = new Promise((resolve) => { resolveOpen = resolve; });

fetchHandler({
  request: { method: 'GET', url: 'https://app.test/material-fifo/data', mode: 'navigate' },
  respondWith: (promise) => { responsePromise = promise; },
  waitUntil: vi.fn(),
});
await responsePromise;
expect(clone).toHaveBeenCalledTimes(1);
resolveOpen({ put: vi.fn() });
```

Also assert that a cross-origin Supabase request does not call `respondWith`, and that the script contains `warehouse-app-shell-v2`.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npx vitest run src/test/serviceWorker.test.js --maxWorkers=1 --no-file-parallelism
```

Expected: FAIL because `clone()` is currently deferred until `caches.open()` resolves and the cache is still `v1`.

- [ ] **Step 3: Clone synchronously and attach cache work to the event**

Update the successful network branch:

```js
event.respondWith(fetch(event.request).then((response) => {
  if (response.ok) {
    const cacheCopy = response.clone();
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cacheCopy)),
    );
  }
  return response;
}).catch(async () => { ... }));
```

Change `CACHE_NAME` to `warehouse-app-shell-v2`. Preserve the same-origin guard, offline navigation fallback, explicit update message, and old-cache deletion.

- [ ] **Step 4: Run service-worker and update-toast tests, then commit**

Run:

```powershell
npx vitest run src/test/serviceWorker.test.js src/test/AppUpdateToast.test.jsx --maxWorkers=1 --no-file-parallelism
git add public/sw.js src/test/serviceWorker.test.js
git commit -m "fix: clone service worker responses before caching"
```

Expected: all focused tests PASS without unhandled promise rejections.

---

### Task 3: Single-Source Supabase Auth Initialization

**Files:**
- Modify: `src/lib/supabase.js`
- Modify: `src/contexts/AuthContext.jsx`
- Create: `src/test/AuthContext.test.jsx`
- Create: `src/test/supabaseProfile.test.js`

**Interfaces:**
- Consumes: `onAuthStateChange(event, session)`, `session.user`, `signInWithPassword`, and `profiles` table queries.
- Produces: `getCurrentUserProfile(user)` where `user.id` selects the profile and `user.user_metadata` is used only for missing-profile creation; `AuthProvider` initializes from `INITIAL_SESSION` without calling `getSession()`.

- [ ] **Step 1: Add failing profile-helper tests**

Mock the Supabase query builder and call:

```js
await getCurrentUserProfile({ id: 'user-1', user_metadata: {} });
expect(mockSupabase.auth.getUser).not.toHaveBeenCalled();
expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
expect(eq).toHaveBeenCalledWith('id', 'user-1');
```

Add a second test where the profile query returns `{ code: 'PGRST500', message: 'database unavailable' }` and assert `getCurrentUserProfile(user)` rejects with that error instead of returning `null`.

- [ ] **Step 2: Add failing AuthProvider initialization tests**

Mock `onAuthStateChange` to capture its callback. Render a consumer showing `loading`, `user`, and `profile`, then invoke the callback with `INITIAL_SESSION`:

```jsx
await act(async () => authCallback('INITIAL_SESSION', { user: { id: 'user-1' } }));
expect(mockSupabase.auth.getSession).not.toHaveBeenCalled();
expect(getCurrentUserProfile).toHaveBeenCalledTimes(1);
expect(getCurrentUserProfile).toHaveBeenCalledWith({ id: 'user-1' });
```

Add these cases:

- active profile sets authenticated state;
- missing/inactive profile calls `signOut({ scope: 'local' })` once;
- rejected lookup with `{ status: 403, code: 'bad_jwt' }` calls local sign-out once;
- rejected lookup with status `500` does not sign out and finishes loading;
- successful `signInWithPassword` loads the profile using `authData.user` and sets state.

- [ ] **Step 3: Run auth tests and verify RED**

Run:

```powershell
npx vitest run src/test/AuthContext.test.jsx src/test/supabaseProfile.test.js --maxWorkers=1 --no-file-parallelism
```

Expected: FAIL because initialization currently calls both `getSession()` and `INITIAL_SESSION`, the helper calls `auth.getUser()`, query errors collapse to `null`, and sign-out has global scope.

- [ ] **Step 4: Change profile lookup to consume the supplied session user**

Implement this contract in `src/lib/supabase.js`:

```js
export const getCurrentUserProfile = async (user) => {
  if (!user?.id) return null;
  const { data: profile, error } = await supabase
    .from('profiles').select('*').eq('id', user.id).single();
  if (!error) return profile;
  if (error.code !== 'PGRST116') throw error;
  // Existing missing-profile creation uses user.user_metadata.
};
```

Keep the existing profile creation fields and defaults. Throw insertion errors so callers can distinguish an unavailable backend from a missing/inactive profile.

- [ ] **Step 5: Make `INITIAL_SESSION` the only startup source**

Remove the separate `getInitialSession()`/`getSession()` path. Register one synchronous listener that delegates without awaiting inside the callback:

```js
const handleAuthEvent = async (event, session) => { ... };
const { data: { subscription } } = supabase.auth.onAuthStateChange(
  (event, session) => { void handleAuthEvent(event, session); },
);
```

For `SIGNED_OUT` or a missing session, clear state and loading. For `INITIAL_SESSION`, `TOKEN_REFRESHED`, and `USER_UPDATED`, load the profile once using `session.user`. Preserve the existing `SIGNED_IN` ownership by `signIn()` to avoid duplicate profile queries during password login.

Use this invalid-session predicate:

```js
const isInvalidSessionError = (error) =>
  [401, 403].includes(error?.status)
  || ['bad_jwt', 'refresh_token_not_found', 'refresh_token_already_used'].includes(error?.code);
```

Invalid sessions and missing/inactive profiles call `supabase.auth.signOut({ scope: 'local' })`. Transient errors log the actual error, clear user/profile, and finish loading without sign-out. Pass `authData.user` to the helper in `signIn()`. Explicit `signOut()` also uses local scope.

- [ ] **Step 6: Run auth regressions and the full suite**

Run:

```powershell
npx vitest run src/test/AuthContext.test.jsx src/test/supabaseProfile.test.js --maxWorkers=1 --no-file-parallelism
npm test -- --run --maxWorkers=1 --no-file-parallelism
```

Expected: focused auth tests and all existing tests PASS.

- [ ] **Step 7: Build and commit the auth fix**

Run:

```powershell
npm run build
git add src/lib/supabase.js src/contexts/AuthContext.jsx src/test/AuthContext.test.jsx src/test/supabaseProfile.test.js
git commit -m "fix: deduplicate supabase auth initialization"
```

Expected: production build exits 0.

---

### Task 4: Final Production Verification and Handoff

**Files:**
- Verify only; no expected production edits.

**Interfaces:**
- Consumes: completed routing, service-worker, and auth hotfix commits.
- Produces: a clean hotfix branch ready for review and deployment.

- [ ] **Step 1: Run fresh verification**

```powershell
npm test -- --run --maxWorkers=1 --no-file-parallelism
npm run build
git diff --check
git status --short
```

Expected: all tests PASS, build exits 0, diff check is empty, and worktree is clean.

- [ ] **Step 2: Inspect the branch range**

```powershell
git log --oneline origin/main..HEAD
git diff --stat origin/main...HEAD
```

Confirm the range contains only the design and three hotfix concerns.

- [ ] **Step 3: Use `superpowers:finishing-a-development-branch`**

Offer merge/push/keep options. If the user chooses a Pull Request, push `codex/material-fifo-production-hotfix`, create a PR against `main`, and preserve the worktree for review.
