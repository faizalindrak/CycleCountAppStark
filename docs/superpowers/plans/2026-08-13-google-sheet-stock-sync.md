# Google Sheet Material FIFO Stock Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and run a repeatable, guarded snapshot replacement that loads the legacy Google Sheet Material FIFO stock and MIN/MAX settings into Supabase as opening balances.

**Architecture:** A pure Node module fetches and normalizes the legacy payload into a stable snapshot with deterministic request IDs and checksum. An admin-only Supabase RPC previews or atomically replaces only prior Google migration batches, records a sync audit row, and reconciles the result. A small CLI supplies secrets only at runtime, prints a secret-free preview, and requires an explicit `--apply` flag for mutation.

**Tech Stack:** Node.js 20, built-in `fetch`/`crypto`, Supabase JS 2, PostgreSQL 15/PL/pgSQL, Vitest 4.

## Global Constraints

- The Google Sheet remains authoritative until the final pre-live sync.
- Never commit or print the legacy dashboard password, Apps Script token, Supabase password, anon key, access token, or service-role key.
- Preserve leading zeros in SKU and product-code identifiers.
- Existing item master fields are never overwritten; missing items use the approved `SKU#/SKU#/PRODUCT CODE/PRODUCT NAME/UOM/Raw Material` mapping.
- Apply must stop before mutation when any outbound, allocation, non-Google inbound, changed migration lot, ambiguous batch, or reconciliation conflict exists.
- The replace operation must be atomic and must remove only transactions/lots owned by prior completed `GOOGLE_SHEET` sync runs.
- Cycle count and the legacy transaction history are outside scope.
- Use one-worker Vitest commands because the Windows workspace contains nested worktrees; always pass `--dir src/test` from the main checkout or run from an isolated worktree.

---

### Task 1: Pure Legacy Snapshot Normalizer

**Files:**
- Create: `scripts/material-fifo-sync/snapshot.js`
- Create: `src/test/materialFifoSyncSnapshot.test.js`

**Interfaces:**
- Consumes: the legacy Apps Script payload `{ ok, meta, data[] }`.
- Produces: `normalizeLegacySnapshot(payload): NormalizedSnapshot`, `stableRequestId(parts): string`, and `checksumSnapshot(snapshot): string`.

`NormalizedSnapshot` has this shape:

```js
{
  sourceTimestamp: '12 August 2026 21:30',
  checksum: '<64 lowercase hex characters>',
  totals: { skuCount: 247, stockedSkuCount: 202, lotCount: 363, stockQty: '210728.8900' },
  items: [{
    sku: '001313', itemCode: '001313', internalProductCode: 'ABC123',
    itemName: 'Material Name', uom: 'KG', minQty: '10.0000', maxQty: '20.0000',
    stockQty: '5.0000',
    lots: [{ sourceKey: '001313|A1.1|2026-08-01|5.0000|1', location: 'A1.1',
      receivedDate: '2026-08-01', quantity: '5.0000', requestId: '<uuid>' }]
  }]
}
```

- [ ] **Step 1: Write failing validation and stability tests**

Create table-driven tests covering:

```js
expect(normalizeLegacySnapshot(validPayload).items[0].sku).toBe('001313');
expect(normalizeLegacySnapshot(validPayload).items[0].lots[0].receivedDate).toBe('2026-08-01');
expect(() => normalizeLegacySnapshot(stockLotMismatch)).toThrow(/SOURCE_STOCK_MISMATCH/);
expect(() => normalizeLegacySnapshot(invalidLocation)).toThrow(/SOURCE_INVALID_LOCATION/);
expect(() => normalizeLegacySnapshot(duplicateSku)).toThrow(/SOURCE_DUPLICATE_SKU/);
expect(normalizeLegacySnapshot(validPayload)).toEqual(normalizeLegacySnapshot(reorderedPayload));
expect(stableRequestId(['GOOGLE_SHEET', '001313', 'A1.1'])).toMatch(UUID_REGEX);
```

Also test zero-stock rows, four-decimal quantities, invalid MIN/MAX, missing required master fields, duplicate product codes, duplicate source lot occurrence handling, and exact global totals.

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
npx vitest run --dir src/test src/test/materialFifoSyncSnapshot.test.js --maxWorkers=1 --no-file-parallelism
```

Expected: FAIL because `scripts/material-fifo-sync/snapshot.js` does not exist.

- [ ] **Step 3: Implement decimal-safe normalization**

Use scaled integers (quantity × 10,000) internally instead of binary floating-point sums. Normalize dates with an explicit `dd/MM/yyyy` parser, sort items by normalized SKU, sort lots by date/location/quantity/original occurrence, and derive deterministic UUIDs from SHA-256 bytes with RFC-4122 version/variant bits.

Export:

```js
export class SnapshotValidationError extends Error {
  constructor(code, message, details = {}) { /* name/code/details, no secrets */ }
}
export function stableRequestId(parts) { /* deterministic UUID */ }
export function checksumSnapshot(snapshotWithoutChecksum) { /* SHA-256 stable JSON */ }
export function normalizeLegacySnapshot(payload) { /* validate and return frozen snapshot */ }
```

- [ ] **Step 4: Run tests and verify GREEN**

Run the Task 1 command. Expected: all snapshot tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add scripts/material-fifo-sync/snapshot.js src/test/materialFifoSyncSnapshot.test.js
git commit -m "feat: normalize legacy fifo stock snapshots"
```

---

### Task 2: Read-Only Legacy Apps Script Client

**Files:**
- Create: `scripts/material-fifo-sync/legacyClient.js`
- Create: `src/test/materialFifoSyncLegacyClient.test.js`

**Interfaces:**
- Consumes: `createLegacyClient({ endpoint, password, fetchImpl? })`.
- Produces: `client.fetchSnapshotPayload(): Promise<object>`; login token remains private to the client closure.

- [ ] **Step 1: Write failing login/read/redaction tests**

Mock `fetchImpl` and assert:

```js
const client = createLegacyClient({ endpoint: 'https://script.google.com/.../exec', password: 'secret', fetchImpl });
await expect(client.fetchSnapshotPayload()).resolves.toEqual(payload);
expect(fetchImpl).toHaveBeenNthCalledWith(1, endpoint, expect.objectContaining({ method: 'POST' }));
expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ action: 'login', password: 'secret' });
expect(fetchImpl.mock.calls[1][0]).toContain('?token=');
expect(String(client)).not.toContain('secret');
```

Cover non-JSON responses, `{ ok:false }`, HTTP failures, missing password, and URL-encoding the token.

- [ ] **Step 2: Run tests and verify RED**

```powershell
npx vitest run --dir src/test src/test/materialFifoSyncLegacyClient.test.js --maxWorkers=1 --no-file-parallelism
```

Expected: FAIL because the client module does not exist.

- [ ] **Step 3: Implement the two-request read client**

Implement `POST { action:'login', password }`, retain the returned token only in a local variable, then `GET ?token=<encoded>`. Errors expose stable codes (`LEGACY_LOGIN_FAILED`, `LEGACY_READ_FAILED`, `LEGACY_INVALID_RESPONSE`) without response bodies or secrets.

- [ ] **Step 4: Run tests and commit**

Run the Task 2 command, then:

```powershell
git add scripts/material-fifo-sync/legacyClient.js src/test/materialFifoSyncLegacyClient.test.js
git commit -m "feat: add read-only legacy fifo client"
```

---

### Task 3: Admin-Only Atomic Sync Database API

**Files:**
- Create: `database/material_fifo_google_sync_migration.sql`
- Create: `database/material_fifo_google_sync_regression_tests.sql`
- Modify: `database/material_fifo_setup.md`

**Interfaces:**
- Consumes: authenticated admin `auth.uid()`, normalized snapshot JSON, source checksum, and source timestamp.
- Produces:
  - table `public.material_fifo_sync_runs`;
  - function `public.preview_google_material_fifo_sync(p_snapshot jsonb, p_source_checksum text, p_source_timestamp text): jsonb`;
  - function `public.apply_google_material_fifo_sync(p_snapshot jsonb, p_source_checksum text, p_source_timestamp text): jsonb`.

- [ ] **Step 1: Write failing SQL regressions**

The regression script runs in a transaction, creates admin/normal test contexts, and asserts with `public.assert_true`:

```sql
SELECT public.assert_true(
  (public.preview_google_material_fifo_sync(test_snapshot, repeat('a', 64), 'test')->>'safe_to_apply')::boolean,
  'empty FIFO must be safe to apply'
);
SELECT public.apply_google_material_fifo_sync(test_snapshot, repeat('a', 64), 'test');
SELECT public.assert_true((SELECT count(*) FROM material_fifo_lots) = 2, 'two lots imported');
SELECT public.apply_google_material_fifo_sync(test_snapshot, repeat('a', 64), 'test');
SELECT public.assert_true((SELECT count(*) FROM material_fifo_lots) = 2, 'identical rerun does not duplicate');
```

Add changed-snapshot replacement, missing SKU creation, existing Raw Material reuse, MIN/MAX replacement, non-Raw conflict, item-code/internal-code collision, non-admin rejection, OUT/allocation/non-Google-IN rejection, modified opening-lot rejection, malformed payload rejection, and reconciliation rollback tests.

- [ ] **Step 2: Run SQL tests and verify RED when a disposable database is available**

```powershell
psql $env:TEST_DATABASE_URL -v ON_ERROR_STOP=1 -f database/material_fifo_migration.sql
psql $env:TEST_DATABASE_URL -v ON_ERROR_STOP=1 -f database/material_fifo_google_sync_regression_tests.sql
```

Expected: second command FAIL because the sync table/functions do not exist. If `TEST_DATABASE_URL` is unavailable, record the skipped local integration test and require the same regression script in a disposable Supabase branch before production apply.

- [ ] **Step 3: Create the audit table and ownership constraints**

Create `material_fifo_sync_runs` with UUID ID, source kind/checksum/timestamp, status, actor, source/destination counts and totals, error code/message, timestamps, and a unique completed checksum constraint. Enable RLS; grant admin SELECT through a policy; revoke INSERT/UPDATE/DELETE from client roles.

The migration also adds a foreign key from `material_fifo_transactions.import_batch_id` to sync runs only if existing non-null values are compatible; otherwise it stops with an actionable migration error instead of rewriting data.

- [ ] **Step 4: Implement shared validation and preview**

Add private helpers that:

- require `profiles.status='active'` and `profiles.role='admin'` for `auth.uid()`;
- parse every snapshot field into typed temporary tables;
- match items by case-insensitive trimmed SKU;
- report all creates/matches/conflicts;
- compute the operational safety gate; and
- return secret-free JSON counts, totals, checksum, and conflict codes.

Preview must not mutate item, setting, transaction, lot, allocation, or sync-run tables.

- [ ] **Step 5: Implement apply with a PL/pgSQL subtransaction**

Use `pg_advisory_xact_lock(hashtextextended('GOOGLE_SHEET_MATERIAL_FIFO_SYNC', 0))`. Insert a `RUNNING` audit row, then perform replacement inside a nested `BEGIN … EXCEPTION` block. Delete only allocations/lots/transactions whose `import_batch_id` belongs to completed `GOOGLE_SHEET` runs; upsert missing items/settings; insert deterministic opening transactions/lots; reconcile; mark `COMPLETED`. On exception, the nested changes roll back, then the outer block marks the run `FAILED` with a stable code and returns `{ ok:false }`.

The function must never delete an item, including items created by an older sync.

- [ ] **Step 6: Lock permissions**

Revoke public execution. Grant preview/apply to `authenticated`, with the internal admin check as the authorization boundary. Do not grant direct mutation access to the audit table.

- [ ] **Step 7: Run database regressions and commit**

Run both SQL commands from Step 2 and expect PASS, then:

```powershell
git add database/material_fifo_google_sync_migration.sql database/material_fifo_google_sync_regression_tests.sql database/material_fifo_setup.md
git commit -m "feat: add guarded google stock sync rpc"
```

---

### Task 4: Secret-Safe Preview/Apply CLI

**Files:**
- Create: `scripts/material-fifo-sync/supabaseClient.js`
- Create: `scripts/material-fifo-sync/cli.js`
- Create: `src/test/materialFifoSyncCli.test.js`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes environment variables `LEGACY_FIFO_ENDPOINT`, `LEGACY_FIFO_PASSWORD`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_ADMIN_EMAIL`, and `SUPABASE_ADMIN_PASSWORD`.
- Produces commands `npm run fifo:sync:preview` and `npm run fifo:sync:apply`.

- [ ] **Step 1: Write failing orchestration tests**

Inject fake legacy/Supabase clients and assert:

```js
const result = await runSync({ mode: 'preview', env, legacyClient, supabaseClient, output });
expect(supabaseClient.preview).toHaveBeenCalledWith(snapshot);
expect(supabaseClient.apply).not.toHaveBeenCalled();
expect(output.join('\n')).toContain('247 SKU');
expect(output.join('\n')).not.toContain(env.LEGACY_FIFO_PASSWORD);
```

Test missing env names, non-admin sign-in, unsafe preview, explicit apply, reconciliation failure, exit codes, and secret redaction.

- [ ] **Step 2: Run tests and verify RED**

```powershell
npx vitest run --dir src/test src/test/materialFifoSyncCli.test.js --maxWorkers=1 --no-file-parallelism
```

- [ ] **Step 3: Implement authenticated Supabase RPC client**

Create a non-persisting Supabase client (`persistSession:false`, `autoRefreshToken:false`), sign in with the supplied admin credentials, call preview/apply RPC, and always sign out locally in `finally`. Never log the auth result or session.

- [ ] **Step 4: Implement CLI and scripts**

Export `runSync(dependencies)` for tests and execute it only when `cli.js` is the entry point. `--apply` is the only mutation switch; the default is preview. Add:

```json
"fifo:sync:preview": "node scripts/material-fifo-sync/cli.js",
"fifo:sync:apply": "node scripts/material-fifo-sync/cli.js --apply"
```

Ignore `.env.fifo-sync` and `artifacts/material-fifo-sync/`. CLI output includes checksum, source timestamp, creates/matches/conflicts, safety status, counts/totals, and reconciliation result, but no raw payload.

- [ ] **Step 5: Run CLI tests and commit**

```powershell
npx vitest run --dir src/test src/test/materialFifoSyncSnapshot.test.js src/test/materialFifoSyncLegacyClient.test.js src/test/materialFifoSyncCli.test.js --maxWorkers=1 --no-file-parallelism
git add scripts/material-fifo-sync src/test/materialFifoSyncCli.test.js package.json package-lock.json .gitignore
git commit -m "feat: add material fifo stock sync cli"
```

---

### Task 5: Deploy Migration and Run Initial Opening Balance

**Files:**
- Verify only; no expected source edits unless deployment uncovers a reproducible defect.

**Interfaces:**
- Consumes: approved SQL migration, Apps Script credentials, Supabase admin credentials, and the current source snapshot.
- Produces: one completed Google sync run and reconciled opening balances in the target Supabase project.

- [ ] **Step 1: Run full local verification**

```powershell
npx vitest run --dir src/test --maxWorkers=1 --no-file-parallelism
npm run build
git diff --check
git status --short
```

Expected: all application and sync tests PASS, build exits 0, no tracked changes remain.

- [ ] **Step 2: Apply database migration**

Run `database/material_fifo_google_sync_migration.sql` in the target Supabase SQL editor or an authenticated migration connection. Immediately verify table/function existence, RLS, grants, and admin-only execution.

- [ ] **Step 3: Run database regression tests in a disposable target**

Execute `database/material_fifo_google_sync_regression_tests.sql` against a disposable Supabase branch/project with `ON_ERROR_STOP=1`. Do not run destructive regression fixtures against the production project.

- [ ] **Step 4: Run live preview**

Supply secrets only to the current process and run:

```powershell
npm run fifo:sync:preview
```

Expected source baseline for the observed snapshot: 247 SKUs, 202 stocked SKUs, 363 lots, total 210728.8900, zero validation mismatch. Review item creates/matches/conflicts and require `safe_to_apply=true`.

- [ ] **Step 5: Run apply only after preview is clean**

```powershell
npm run fifo:sync:apply
```

Expected: one `COMPLETED` run, the reported checksum matches preview, and destination reconciliation reports the same SKU/lot/stock/settings totals.

- [ ] **Step 6: Independently query reconciliation**

Verify with read-only queries:

```sql
SELECT count(*) AS lots, sum(remaining_qty) AS stock FROM public.material_fifo_lots WHERE remaining_qty > 0;
SELECT count(*) FILTER (WHERE status = 'COMPLETED') FROM public.material_fifo_sync_runs WHERE source_kind = 'GOOGLE_SHEET';
SELECT item_id, stock_qty FROM public.material_fifo_stock_view ORDER BY sku;
```

Compare results to the CLI source summary and spot-check earliest/middle/latest lots and leading-zero SKUs.

- [ ] **Step 7: Smoke-test application reads**

Open Material FIFO Data and Overview, confirm totals/lots/MIN/MAX, scan a representative QR/code, and run inbound/outbound preview without committing. Confirm there are no browser console errors or unexpected service-worker cache failures.

- [ ] **Step 8: Record handoff**

Report the completed run ID, checksum, snapshot timestamp, SKU/lot/stock totals, creates/matches, reconciliation result, and the exact final-sync command. Do not include secrets or raw source data.
