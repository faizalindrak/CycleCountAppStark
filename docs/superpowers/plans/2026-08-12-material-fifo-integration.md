# Material FIFO Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the legacy Material FIFO workflows into the existing Warehouse Cycle Count React application using Supabase-backed atomic inventory operations for Raw Material SKUs.

**Architecture:** Add a normalized FIFO schema and security-definer RPC boundary in Supabase, then build a protected React workspace that consumes only that boundary. Keep inventory mutations server-atomic, derive stock from remaining lots, and isolate scanning, import parsing, exports, and status rules in focused modules with direct tests.

**Tech Stack:** React 18, React Router 7, Vite 5, Tailwind CSS 3, Supabase JS 2/PostgreSQL, Vitest, React Testing Library, `@zxing/library`, `xlsx`, `write-excel-file`, service worker APIs.

## Global Constraints

- Material FIFO is restricted to items whose normalized category is exactly `Raw Material`.
- All active authenticated users can read and operate FIFO; inactive users and anonymous users cannot.
- Quantity columns use `NUMERIC(20,4)` and UI calculations must avoid binary floating-point stock mutation.
- Derived stock is `SUM(material_fifo_lots.remaining_qty)`; there is no editable stock field.
- FIFO order is `received_date ASC, created_at ASC, id ASC`.
- Locations must match `^[A-Za-z]+[0-9]+\.[0-9]+$`, for example `A1.1`.
- Inventory writes occur only through database RPCs and use `auth.uid()` for audit identity.
- The legacy Material FIFO cycle count, Apps Script API, Google Sheet storage, and separate password are not ported.
- The existing Cycle Count and all other current application modules must remain behaviorally unchanged.
- FIFO transactions require a network connection; the service worker must never cache Supabase responses or queue mutations.
- UI copy is Indonesian and visual styling follows the existing slate/blue Tailwind project design.

---

## File Map

### Database

- `database/material_fifo_migration.sql`: tables, indexes, helper functions, security-invoker view, RLS, grants, RPCs, Realtime publication.
- `database/material_fifo_regression_tests.sql`: rollback-only SQL assertions for FIFO ordering, manual location, idempotency, authorization, constraints, and derived stock.
- `database/material_fifo_setup.md`: deployment order and test-database instructions.

### Domain and API

- `src/features/material-fifo/lib/fifoStatus.js`: status constants and threshold calculation.
- `src/features/material-fifo/lib/scanCodes.js`: exact code normalization/matching and keyboard-wedge buffer.
- `src/features/material-fifo/lib/importRows.js`: pure worksheet-row parsers and validations.
- `src/features/material-fifo/lib/exportRows.js`: pure stock and transaction export mapping.
- `src/features/material-fifo/api/materialFifoApi.js`: typed-shape Supabase queries and RPC wrappers.
- `src/features/material-fifo/hooks/useMaterialFifoData.js`: loading, refresh, last-refresh, and Realtime invalidation.

### React workspace

- `src/features/material-fifo/MaterialFifoPage.jsx`: nested workspace route and shared modal state.
- `src/features/material-fifo/components/MaterialFifoLayout.jsx`: desktop sidebar, mobile drawer, header, online state, and persistent actions.
- `src/features/material-fifo/components/CodeScanner.jsx`: native detector, ZXing fallback, handheld input, and manual entry.
- `src/features/material-fifo/components/MaterialSearchField.jsx`: searchable/scan-enabled Raw Material selector.
- `src/features/material-fifo/components/FifoInboundModal.jsx`: inbound form and confirmation.
- `src/features/material-fifo/components/FifoOutboundModal.jsx`: FIFO/manual allocation preview and confirmation.
- `src/features/material-fifo/pages/OverviewPage.jsx`: KPIs and attention lists.
- `src/features/material-fifo/pages/DataFifoPage.jsx`: filters, settings editing, and lot display.
- `src/features/material-fifo/pages/TransactionsPage.jsx`: immutable history and allocation details.
- `src/features/material-fifo/pages/ImportPage.jsx`: outbound and MIN/MAX import workflows.
- `src/features/material-fifo/pages/ExportPage.jsx`: stock and transaction export controls.
- `src/features/material-fifo/pages/ManageSkuPage.jsx`: complete Raw Material item form.

### Application and PWA integration

- `src/App.jsx`: protected `/material-fifo/*` route.
- `src/components/Home.jsx`: Material FIFO dashboard card.
- `src/main.jsx`: service worker registration.
- `src/components/AppUpdateToast.jsx`: waiting-service-worker update prompt.
- `public/manifest.webmanifest`: unified install metadata.
- `public/sw.js`: versioned static app-shell cache and update lifecycle.
- `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-512-maskable.png`: reused legacy PWA artwork.
- `index.html`: manifest, theme-color, and mobile metadata.
- `README.md`: feature, migration, scanner, and PWA setup notes.

### Tests

- `src/test/materialFifoStatus.test.js`
- `src/test/materialFifoScanCodes.test.js`
- `src/test/materialFifoImportRows.test.js`
- `src/test/materialFifoExportRows.test.js`
- `src/test/materialFifoApi.test.js`
- `src/test/useMaterialFifoData.test.jsx`
- `src/test/CodeScanner.test.jsx`
- `src/test/MaterialFifoRouting.test.jsx`
- `src/test/FifoTransactionModals.test.jsx`
- `src/test/MaterialFifoPages.test.jsx`
- `src/test/MaterialFifoImportExport.test.jsx`
- `src/test/AppUpdateToast.test.jsx`

---

### Task 1: Supabase FIFO Schema and Atomic RPCs

**Files:**
- Create: `database/material_fifo_regression_tests.sql`
- Create: `database/material_fifo_migration.sql`
- Create: `database/material_fifo_setup.md`

**Interfaces:**
- Consumes: existing `public.items`, `public.categories`, `public.profiles`, and `auth.users`.
- Produces: `material_fifo_settings`, `material_fifo_transactions`, `material_fifo_lots`, `material_fifo_allocations`, `material_fifo_stock_view`, and the five RPCs listed below.

- [ ] **Step 1: Write the rollback-only SQL regression test first**

Create a transaction-scoped test with active/inactive users, Raw Material/non-Raw-Material items, three dated lots, idempotent issue, manual-location issue, and rejected mutations:

```sql
BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.assert_true(condition boolean, message text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT condition THEN RAISE EXCEPTION 'ASSERTION FAILED: %', message; END IF;
END;
$$;

CREATE TEMP TABLE test_context AS
SELECT
  gen_random_uuid() AS active_user_id,
  gen_random_uuid() AS inactive_user_id,
  gen_random_uuid() AS raw_item_id,
  gen_random_uuid() AS non_raw_item_id,
  gen_random_uuid() AS request_in_1,
  gen_random_uuid() AS request_in_2,
  gen_random_uuid() AS request_in_3,
  gen_random_uuid() AS request_out_fifo,
  gen_random_uuid() AS request_out_manual;

INSERT INTO auth.users
  (id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
SELECT active_user_id, 'authenticated', 'authenticated',
       'fifo-active@example.test', crypt('test-password', gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
FROM test_context
UNION ALL
SELECT inactive_user_id, 'authenticated', 'authenticated',
       'fifo-inactive@example.test', crypt('test-password', gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
FROM test_context;

INSERT INTO public.profiles (id, name, username, role, status)
SELECT active_user_id, 'FIFO Active Test', 'fifo_active_test', 'user', 'active'
FROM test_context
UNION ALL
SELECT inactive_user_id, 'FIFO Inactive Test', 'fifo_inactive_test', 'user', 'inactive'
FROM test_context;

INSERT INTO public.items
  (id, sku, item_code, item_name, category, uom,
   internal_product_code, created_by)
SELECT raw_item_id, 'RM-FIFO-TEST', 'RM-CODE', 'Raw FIFO Test',
       'Raw Material', 'KG', 'RM-INTERNAL', active_user_id
FROM test_context
UNION ALL
SELECT non_raw_item_id, 'FG-FIFO-TEST', 'FG-CODE', 'Finished FIFO Test',
       'Finished Goods', 'PCS', 'FG-INTERNAL', active_user_id
FROM test_context;

SELECT set_config('request.jwt.claim.sub', active_user_id::text, true),
       set_config(
         'request.jwt.claims',
         jsonb_build_object('sub', active_user_id, 'role', 'authenticated')::text,
         true
       )
FROM test_context;

SET LOCAL ROLE authenticated;

SELECT pg_temp.assert_true(
  (public.receive_material_fifo(
    (SELECT raw_item_id FROM test_context), 'A1.1', 10.0000,
    DATE '2026-08-01', 'oldest', (SELECT request_in_1 FROM test_context)
  )->>'stock_after')::numeric = 10.0000,
  'first inbound must produce stock 10'
);

SELECT public.receive_material_fifo(
  (SELECT raw_item_id FROM test_context), 'A2.1', 5.0000,
  DATE '2026-08-02', 'second', (SELECT request_in_2 FROM test_context)
);
SELECT public.receive_material_fifo(
  (SELECT raw_item_id FROM test_context), 'A1.1', 8.0000,
  DATE '2026-08-03', 'newest', (SELECT request_in_3 FROM test_context)
);

SELECT pg_temp.assert_true(
  jsonb_array_length((public.preview_material_fifo_issue(
    (SELECT raw_item_id FROM test_context), 12.0000, 'FIFO', NULL
  )->'allocations')) = 2,
  'FIFO preview must span the two oldest lots'
);

SELECT public.issue_material_fifo(
  (SELECT raw_item_id FROM test_context), 12.0000, 'FIFO', NULL,
  DATE '2026-08-12', 'fifo issue',
  (SELECT request_out_fifo FROM test_context), NULL
);
SELECT pg_temp.assert_true(
  (public.issue_material_fifo(
    (SELECT raw_item_id FROM test_context), 12.0000, 'FIFO', NULL,
    DATE '2026-08-12', 'fifo issue retry',
    (SELECT request_out_fifo FROM test_context), NULL
  )->>'replayed')::boolean,
  'repeated request ID must return replayed true'
);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.material_fifo_transactions
   WHERE request_id = (SELECT request_out_fifo FROM test_context)) = 1,
  'repeated request ID must create one transaction'
);

SELECT public.issue_material_fifo(
  (SELECT raw_item_id FROM test_context), 2.0000, 'MANUAL', 'A1.1',
  DATE '2026-08-12', 'manual issue',
  (SELECT request_out_manual FROM test_context), NULL
);
SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1
    FROM public.material_fifo_allocations a
    JOIN public.material_fifo_lots l ON l.id = a.lot_id
    WHERE a.transaction_id = (
      SELECT id FROM public.material_fifo_transactions
      WHERE request_id = (SELECT request_out_manual FROM test_context)
    ) AND upper(l.location) <> 'A1.1'
  ),
  'manual issue must allocate only the selected location'
);

DO $$
DECLARE
  v_before numeric;
  v_after numeric;
  v_message text;
BEGIN
  SELECT sum(remaining_qty) INTO v_before FROM public.material_fifo_lots;
  BEGIN
    PERFORM public.issue_material_fifo(
      (SELECT raw_item_id FROM test_context), 999.0000, 'FIFO', NULL,
      DATE '2026-08-12', 'must fail', gen_random_uuid(), NULL
    );
    RAISE EXCEPTION 'expected insufficient stock failure';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    PERFORM pg_temp.assert_true(
      position('MF_INSUFFICIENT_STOCK:' in v_message) = 1,
      'insufficient stock must use MF_INSUFFICIENT_STOCK code'
    );
  END;
  SELECT sum(remaining_qty) INTO v_after FROM public.material_fifo_lots;
  PERFORM pg_temp.assert_true(v_before = v_after, 'failed issue must not mutate lots');
END;
$$;

SELECT set_config('request.jwt.claim.sub', inactive_user_id::text, true),
       set_config(
         'request.jwt.claims',
         jsonb_build_object('sub', inactive_user_id, 'role', 'authenticated')::text,
         true
       )
FROM test_context;
DO $$
DECLARE v_message text;
BEGIN
  BEGIN
    PERFORM public.preview_material_fifo_issue(
      (SELECT raw_item_id FROM test_context), 1.0000, 'FIFO', NULL
    );
    RAISE EXCEPTION 'expected inactive-user failure';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    PERFORM pg_temp.assert_true(
      position('MF_INACTIVE_USER:' in v_message) = 1,
      'inactive user must use MF_INACTIVE_USER code'
    );
  END;
END;
$$;

SELECT set_config('request.jwt.claim.sub', active_user_id::text, true),
       set_config(
         'request.jwt.claims',
         jsonb_build_object('sub', active_user_id, 'role', 'authenticated')::text,
         true
       )
FROM test_context;
DO $$
DECLARE v_message text;
BEGIN
  BEGIN
    PERFORM public.preview_material_fifo_issue(
      (SELECT non_raw_item_id FROM test_context), 1.0000, 'FIFO', NULL
    );
    RAISE EXCEPTION 'expected non-Raw-Material failure';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    PERFORM pg_temp.assert_true(
      position('MF_NOT_RAW_MATERIAL:' in v_message) = 1,
      'non-Raw-Material must use MF_NOT_RAW_MATERIAL code'
    );
  END;
END;
$$;

SELECT pg_temp.assert_true(
  (SELECT stock_qty FROM public.material_fifo_stock_view
   WHERE item_id = (SELECT raw_item_id FROM test_context)) =
  (SELECT coalesce(sum(remaining_qty), 0) FROM public.material_fifo_lots
   WHERE item_id = (SELECT raw_item_id FROM test_context)),
  'derived stock view must equal remaining lot sum'
);

RESET ROLE;

ROLLBACK;
```

- [ ] **Step 2: Run the SQL test to verify it fails before the migration exists**

Run:

```powershell
psql $env:TEST_DATABASE_URL -v ON_ERROR_STOP=1 -f database/material_fifo_regression_tests.sql
```

Expected: FAIL with `function public.receive_material_fifo does not exist` or `relation material_fifo_* does not exist`.

- [ ] **Step 3: Implement the schema, constraints, indexes, view, RLS, and grants**

Create the four tables exactly as specified in the design. Add these indexes:

```sql
CREATE INDEX idx_material_fifo_lots_issue
  ON public.material_fifo_lots(item_id, received_date, created_at, id)
  WHERE remaining_qty > 0;
CREATE INDEX idx_material_fifo_lots_location_issue
  ON public.material_fifo_lots(item_id, upper(location), received_date, created_at, id)
  WHERE remaining_qty > 0;
CREATE INDEX idx_material_fifo_transactions_history
  ON public.material_fifo_transactions(transaction_date DESC, created_at DESC);
CREATE INDEX idx_material_fifo_transactions_item
  ON public.material_fifo_transactions(item_id, created_at DESC);
CREATE INDEX idx_material_fifo_allocations_transaction
  ON public.material_fifo_allocations(transaction_id);
```

Add `public.is_active_user()` and `public.is_raw_material(uuid)` as `SECURITY DEFINER` functions with `SET search_path = public, auth`. The stock view must be `WITH (security_invoker = true)` and return master identifiers, thresholds, remarks, `COALESCE(SUM(remaining_qty), 0)::numeric(20,4) AS stock_qty`, lot count, and the four status values `NOT_CONFIGURED`, `CRITICAL`, `OVER`, `NORMAL`.

Enable RLS on every FIFO table. Grant active authenticated users `SELECT`; revoke direct `INSERT`, `UPDATE`, and `DELETE` from `anon` and `authenticated`. Grant `EXECUTE` only on the RPC signatures. Add settings/lots/transactions to `supabase_realtime` only when not already published.

- [ ] **Step 4: Implement the five RPC contracts**

Use these exact signatures and JSON result keys:

```sql
public.receive_material_fifo(
  p_item_id uuid, p_location text, p_quantity numeric,
  p_received_date date, p_notes text, p_request_id uuid
) RETURNS jsonb

public.preview_material_fifo_issue(
  p_item_id uuid, p_quantity numeric,
  p_issue_method text, p_location text DEFAULT NULL
) RETURNS jsonb

public.issue_material_fifo(
  p_item_id uuid, p_quantity numeric, p_issue_method text,
  p_location text, p_transaction_date date, p_notes text,
  p_request_id uuid, p_import_batch_id uuid DEFAULT NULL
) RETURNS jsonb

public.upsert_material_fifo_settings(
  p_item_id uuid, p_min_qty numeric, p_max_qty numeric, p_remarks text
) RETURNS jsonb

public.create_raw_material_item(
  p_sku text, p_item_code text, p_internal_product_code text,
  p_item_name text, p_uom text
) RETURNS jsonb
```

Return mutation results in this shape:

```json
{
  "transaction_id": "uuid",
  "request_id": "uuid",
  "stock_before": 15.0,
  "stock_after": 3.0,
  "allocations": [
    {"lot_id":"uuid","location":"A1.1","received_date":"2026-08-01","quantity":10.0}
  ],
  "replayed": false
}
```

Every RPC must check `is_active_user()`, validate Raw Material scope, set a fixed search path, derive audit identity from `auth.uid()`, and raise stable prefixed messages such as `MF_INSUFFICIENT_STOCK:Stok tersedia 3.0000, diminta 5.0000`. `issue_material_fifo` must lock eligible rows with `FOR UPDATE`, verify total eligible stock before any mutation, update each locked lot, and insert allocation rows. On request replay, return the existing transaction and allocations with `replayed: true`.

- [ ] **Step 5: Run the complete regression script after the migration**

Run migration then the already-complete rollback-only test:

```powershell
psql $env:TEST_DATABASE_URL -v ON_ERROR_STOP=1 -f database/material_fifo_migration.sql
psql $env:TEST_DATABASE_URL -v ON_ERROR_STOP=1 -f database/material_fifo_regression_tests.sql
```

Expected: both exit 0; the test transaction ends with `ROLLBACK` and leaves no fixture rows.

- [ ] **Step 6: Document Supabase deployment and commit**

Document migration order, the required `TEST_DATABASE_URL`, SQL Editor fallback, and production warning not to run regression fixtures outside their rollback transaction. Then commit:

```powershell
git add database/material_fifo_migration.sql database/material_fifo_regression_tests.sql database/material_fifo_setup.md
git commit -m "feat: add atomic material fifo database"
```

---

### Task 2: Pure FIFO Status, Scan, Import, and Export Logic

**Files:**
- Create: `src/test/materialFifoStatus.test.js`
- Create: `src/test/materialFifoScanCodes.test.js`
- Create: `src/test/materialFifoImportRows.test.js`
- Create: `src/test/materialFifoExportRows.test.js`
- Create: `src/features/material-fifo/lib/fifoStatus.js`
- Create: `src/features/material-fifo/lib/scanCodes.js`
- Create: `src/features/material-fifo/lib/importRows.js`
- Create: `src/features/material-fifo/lib/exportRows.js`

**Interfaces:**
- Consumes: item shapes `{ id, sku, item_code, internal_product_code, item_name, category, uom, stock_qty, min_qty, max_qty }`.
- Produces: `getFifoStatus`, `findItemByScannedCode`, `KeyboardWedgeBuffer`, `parseMinMaxRows`, `parseOutboundRows`, `toStockExportRows`, and `toTransactionExportRows`.

- [ ] **Step 1: Write failing status and scan tests**

```js
expect(getFifoStatus(0, null, null)).toBe('NOT_CONFIGURED');
expect(getFifoStatus(5, 5, 10)).toBe('CRITICAL');
expect(getFifoStatus(10, 5, 10)).toBe('NORMAL');
expect(getFifoStatus(10.0001, 5, 10)).toBe('OVER');

expect(findItemByScannedCode(' RM-01 ', items).sku).toBe('RM-01');
expect(findItemByScannedCode('000123JI4ACO', items).internal_product_code).toBe('JI4ACO');
expect(findItemByScannedCode('unknown', items)).toBeNull();

const buffer = new KeyboardWedgeBuffer({ maxGapMs: 80, minLength: 3 });
buffer.push('R', 0); buffer.push('M', 10); buffer.push('1', 20);
expect(buffer.push('Enter', 30)).toBe('RM1');
```

- [ ] **Step 2: Write failing import and export tests**

Test header aliases, valid rows, duplicate SKU, unknown SKU, non-Raw-Material SKU, negative values, `MIN > MAX`, optional outbound location, and row numbers. Assert exports include four-decimal quantities, allocation locations, audit user, and request ID.

```js
const result = parseMinMaxRows([
  ['SKU', 'MIN', 'MAX'],
  ['RM-01', 5, 10],
  ['MISSING', 1, 2],
], items);
expect(result.rows[0]).toMatchObject({ rowNumber: 2, valid: true, min: 5, max: 10 });
expect(result.rows[1]).toMatchObject({ rowNumber: 3, valid: false, code: 'UNKNOWN_SKU' });

expect(parseOutboundRows([
  ['SKU#', 'QTY KELUAR', 'LOCATION'],
  ['RM-01', 3.5, 'A1.1'],
], items).rows[0]).toMatchObject({ valid: true, quantity: 3.5, location: 'A1.1' });
```

- [ ] **Step 3: Run focused tests and verify failure**

Run:

```powershell
npx vitest run src/test/materialFifoStatus.test.js src/test/materialFifoScanCodes.test.js src/test/materialFifoImportRows.test.js src/test/materialFifoExportRows.test.js
```

Expected: FAIL because the four library modules do not exist.

- [ ] **Step 4: Implement the pure functions**

Use string constants and decimal-safe comparisons by converting API quantity strings to numbers only for display/validation, never for database stock mutation. Implement scan matching in this order: exact normalized raw value across SKU/internal code/item code, then legacy numeric-prefix candidates only if exact matching failed.

```js
export const FIFO_STATUS = Object.freeze({
  NOT_CONFIGURED: 'NOT_CONFIGURED',
  CRITICAL: 'CRITICAL',
  OVER: 'OVER',
  NORMAL: 'NORMAL',
});

export function getFifoStatus(stock, min, max) {
  if (min === null || min === undefined || max === null || max === undefined) return FIFO_STATUS.NOT_CONFIGURED;
  const qty = Number(stock);
  if (qty <= Number(min)) return FIFO_STATUS.CRITICAL;
  if (qty > Number(max)) return FIFO_STATUS.OVER;
  return FIFO_STATUS.NORMAL;
}
```

Parser results must always be `{ rows, validRows, invalidRows }`; every row must include `{ rowNumber, valid, code, reason }`. Do not mutate the supplied item list or worksheet arrays.

- [ ] **Step 5: Run tests and commit**

```powershell
npx vitest run src/test/materialFifoStatus.test.js src/test/materialFifoScanCodes.test.js src/test/materialFifoImportRows.test.js src/test/materialFifoExportRows.test.js
git add src/features/material-fifo/lib src/test/materialFifoStatus.test.js src/test/materialFifoScanCodes.test.js src/test/materialFifoImportRows.test.js src/test/materialFifoExportRows.test.js
git commit -m "feat: add material fifo domain helpers"
```

Expected: all focused tests PASS.

---

### Task 3: Supabase API Boundary and Realtime Data Hook

**Files:**
- Create: `src/test/materialFifoApi.test.js`
- Create: `src/test/useMaterialFifoData.test.jsx`
- Create: `src/features/material-fifo/api/materialFifoApi.js`
- Create: `src/features/material-fifo/hooks/useMaterialFifoData.js`

**Interfaces:**
- Consumes: Supabase client and Task 1 RPC/view contracts.
- Produces: query/RPC functions and `useMaterialFifoData()` returning `{ materials, lotsByItem, transactions, profiles, loading, error, lastRefresh, refresh }`.

- [ ] **Step 1: Write failing API contract tests with a chainable Supabase mock**

Assert exact view/table/RPC names and parameter mapping:

```js
await receiveMaterial({
  itemId: 'item-1', location: 'A1.1', quantity: '2.5000',
  receivedDate: '2026-08-12', notes: '', requestId: 'request-1'
});
expect(mockSupabase.rpc).toHaveBeenCalledWith('receive_material_fifo', {
  p_item_id: 'item-1', p_location: 'A1.1', p_quantity: '2.5000',
  p_received_date: '2026-08-12', p_notes: '', p_request_id: 'request-1'
});
```

Cover `fetchFifoMaterials`, `fetchFifoLots`, `fetchFifoTransactions`, `fetchProfiles`, `previewIssue`, `issueMaterial`, `upsertSettings`, and `createRawMaterialItem`. Assert a Supabase error becomes a localized `MaterialFifoError` carrying the stable `MF_*` code.

- [ ] **Step 2: Write the failing hook test**

Render a test harness, resolve mocked initial queries, assert `lastRefresh`, then invoke the captured Realtime callback and verify a debounced refetch. Assert channel cleanup calls `supabase.removeChannel` on unmount.

- [ ] **Step 3: Run focused tests and verify failure**

```powershell
npx vitest run src/test/materialFifoApi.test.js src/test/useMaterialFifoData.test.jsx
```

Expected: FAIL because API and hook modules do not exist.

- [ ] **Step 4: Implement API wrappers and error mapping**

Export these names:

```js
fetchFifoMaterials()
fetchFifoLots(itemId = null)
fetchFifoTransactions(filters)
fetchProfiles(userIds)
receiveMaterial(input)
previewIssue(input)
issueMaterial(input)
upsertFifoSettings(input)
createRawMaterialItem(input)
```

Use `crypto.randomUUID()` at UI call sites, not inside retrying wrappers. Preserve quantity strings returned by Supabase. `fetchFifoLots(null)` returns all positive-remaining lots for the Data FIFO view; an item ID narrows the query for modal refreshes. `fetchFifoTransactions` selects joined item and allocation/lot details and supports date/type/item filters without interpolating raw user text into filter syntax. Fetch profile display names separately by unique `created_by` IDs because FIFO audit columns reference `auth.users`, not `public.profiles` directly.

- [ ] **Step 5: Implement Realtime invalidation**

Subscribe to `material_fifo_settings`, `material_fifo_lots`, and `material_fifo_transactions` on one uniquely named channel. Coalesce bursts into one refresh using a 150 ms timer. Fetch materials, positive lots, and latest transactions in parallel, derive `lotsByItem` once, then fetch the unique audit profiles. Keep the prior successful data visible when a background refresh fails.

- [ ] **Step 6: Run tests and commit**

```powershell
npx vitest run src/test/materialFifoApi.test.js src/test/useMaterialFifoData.test.jsx
git add src/features/material-fifo/api src/features/material-fifo/hooks src/test/materialFifoApi.test.js src/test/useMaterialFifoData.test.jsx
git commit -m "feat: add material fifo data service"
```

---

### Task 4: Protected Workspace, Navigation, Overview, and Data FIFO

**Files:**
- Create: `src/test/MaterialFifoRouting.test.jsx`
- Create: `src/test/MaterialFifoPages.test.jsx`
- Create: `src/features/material-fifo/MaterialFifoPage.jsx`
- Create: `src/features/material-fifo/components/MaterialFifoLayout.jsx`
- Create: `src/features/material-fifo/pages/OverviewPage.jsx`
- Create: `src/features/material-fifo/pages/DataFifoPage.jsx`
- Modify: `src/App.jsx`
- Modify: `src/components/Home.jsx`

**Interfaces:**
- Consumes: `useAuth`, `useMaterialFifoData`, `getFifoStatus`, nested React Router paths.
- Produces: protected `/material-fifo/*` UI and shared `outletContext` `{ materials, lotsByItem, profiles, refresh, openInbound, openOutbound }`.

- [ ] **Step 1: Write failing route and Home-card tests**

Render `App` with mocked auth and verify an anonymous user is redirected while an active counter can open the Material FIFO route. Render `Home` for both counter and admin and assert both see the card.

```jsx
expect(screen.getByRole('heading', { name: /Material FIFO/i })).toBeInTheDocument();
await user.click(screen.getByRole('button', { name: /Buka Material FIFO/i }));
expect(mockNavigate).toHaveBeenCalledWith('/material-fifo');
```

- [ ] **Step 2: Write failing Overview and Data FIFO tests**

Use materials representing all four statuses and one empty-lot item. Assert KPI counts, critical/over attention lists, search by internal code, status filtering, and oldest-first lot chips.

- [ ] **Step 3: Run tests to verify failure**

```powershell
npx vitest run src/test/MaterialFifoRouting.test.jsx src/test/MaterialFifoPages.test.jsx
```

Expected: FAIL because the route and pages do not exist.

- [ ] **Step 4: Implement route, card, and responsive workspace layout**

Add the lazy-safe static route under the existing protected router:

```jsx
<Route path="/material-fifo/*" element={
  <ProtectedRoute><MaterialFifoPage /></ProtectedRoute>
} />
```

Use nested paths `overview`, `data`, `transactions`, `import`, `export`, and `sku`, with the index redirecting to `overview`. Desktop uses a left sidebar; mobile uses an accessible drawer with focusable links and an Escape close handler. Add offline status and last-refresh text. Inbound/outbound buttons are actual `<button>` elements with accessible names.

- [ ] **Step 5: Implement Overview and Data FIFO presentation**

Compute KPI/status collections with `useMemo`. Data FIFO search matches SKU, item name, item code, and internal product code. Status chips use existing slate/blue styles plus red for Critical, purple for Over, green for Normal, and amber for Not Configured. Sort lots with an explicit comparator rather than assuming API order.

- [ ] **Step 6: Run tests, build, and commit**

```powershell
npx vitest run src/test/MaterialFifoRouting.test.jsx src/test/MaterialFifoPages.test.jsx
npm run build
git add src/App.jsx src/components/Home.jsx src/features/material-fifo/MaterialFifoPage.jsx src/features/material-fifo/components/MaterialFifoLayout.jsx src/features/material-fifo/pages/OverviewPage.jsx src/features/material-fifo/pages/DataFifoPage.jsx src/test/MaterialFifoRouting.test.jsx src/test/MaterialFifoPages.test.jsx
git commit -m "feat: add material fifo workspace"
```

---

### Task 5: QR/Barcode Scanner and Search Selector

**Files:**
- Create: `src/test/CodeScanner.test.jsx`
- Create: `src/features/material-fifo/components/CodeScanner.jsx`
- Create: `src/features/material-fifo/components/MaterialSearchField.jsx`

**Interfaces:**
- Consumes: `findItemByScannedCode`, `KeyboardWedgeBuffer`, Raw Material item array.
- Produces: `<CodeScanner items onSelect onClose />` and `<MaterialSearchField items value onChange />`.

- [ ] **Step 1: Write failing scanner lifecycle tests**

Cover native success, native initialization failure followed by ZXing, permission denial, unknown code, handheld key stream, manual submit, and camera cleanup.

```jsx
const stop = vi.fn();
navigator.mediaDevices.getUserMedia = vi.fn().mockResolvedValue({
  getTracks: () => [{ stop }],
});
render(<CodeScanner items={items} onSelect={onSelect} onClose={onClose} />);
await user.click(screen.getByRole('button', { name: /Tutup scanner/i }));
expect(stop).toHaveBeenCalled();
```

Mock `global.BarcodeDetector` for the native path and `BrowserMultiFormatReader` for fallback. Assert unmount also calls `reset()` and stops tracks.

- [ ] **Step 2: Run the scanner test to verify failure**

```powershell
npx vitest run src/test/CodeScanner.test.jsx
```

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement layered scanner behavior**

On open, request the environment-facing camera. If `BarcodeDetector` supports one of `qr_code`, `code_128`, `code_39`, `ean_13`, or `ean_8`, use it with a `requestAnimationFrame` loop. Otherwise start ZXing `BrowserMultiFormatReader.decodeFromVideoDevice`. While the scanner dialog is open, feed rapid non-modifier keys to `KeyboardWedgeBuffer`; resolve on `Enter`. Keep a labeled manual input and submit button.

Use one `cleanupScanner()` callback that cancels animation frames, calls the ZXing reset method, and stops every media track. Invoke it on success, close, route change/unmount, and initialization failure before changing strategies.

- [ ] **Step 4: Implement accessible MaterialSearchField integration**

Provide debounced text filtering, arrow-key selection, exact scan selection, SKU/name/code display, and a scan button. Do not allow non-Raw-Material options even if accidentally passed; filter by normalized category defensively.

- [ ] **Step 5: Run tests and commit**

```powershell
npx vitest run src/test/materialFifoScanCodes.test.js src/test/CodeScanner.test.jsx
git add src/features/material-fifo/components/CodeScanner.jsx src/features/material-fifo/components/MaterialSearchField.jsx src/test/CodeScanner.test.jsx
git commit -m "feat: add material fifo code scanner"
```

---

### Task 6: Inbound and Outbound Transaction Workflows

**Files:**
- Create: `src/test/FifoTransactionModals.test.jsx`
- Create: `src/features/material-fifo/components/FifoInboundModal.jsx`
- Create: `src/features/material-fifo/components/FifoOutboundModal.jsx`
- Modify: `src/features/material-fifo/MaterialFifoPage.jsx`

**Interfaces:**
- Consumes: `MaterialSearchField`, `receiveMaterial`, `previewIssue`, `issueMaterial`, and `refresh`.
- Produces: complete inbound/outbound user flows and their shared workspace modal triggers.

- [ ] **Step 1: Write failing inbound tests**

Assert required SKU, strict location format, positive quantity, required date, existing-location informational notice, disabled double submit, UUID reuse on retry, success message, and refresh.

```jsx
await user.type(screen.getByLabelText(/Lokasi FIFO/i), 'A1-1');
await user.click(screen.getByRole('button', { name: /Simpan barang masuk/i }));
expect(await screen.findByText(/Gunakan format seperti A1.1/i)).toBeInTheDocument();
expect(receiveMaterial).not.toHaveBeenCalled();
```

- [ ] **Step 2: Write failing outbound tests**

Assert automatic FIFO preview spanning multiple lots, manual-location preview, insufficient stock error, server-preview refresh before confirmation, disabled offline submit, and allocation rows in the success state.

- [ ] **Step 3: Run focused tests to verify failure**

```powershell
npx vitest run src/test/FifoTransactionModals.test.jsx
```

Expected: FAIL because modal components do not exist.

- [ ] **Step 4: Implement inbound modal**

Keep form state local. Generate one `crypto.randomUUID()` when the user starts submission and retain it until success or an intentional form reset. Send decimal input as a normalized string with no more than four fractional digits. Show server errors through `MaterialFifoError` copy; do not update stock optimistically.

- [ ] **Step 5: Implement outbound preview and commit flow**

Debounce preview requests after valid SKU/quantity/method/location values. Render each allocation with location, received date, and quantity. Immediately before final issue, use the same input values and a stable request ID; treat the issue RPC response as authoritative. If the preview becomes stale and the issue is rejected, retain inputs and show a refresh/retry action.

- [ ] **Step 6: Wire modals to the workspace, run tests, and commit**

```powershell
npx vitest run src/test/FifoTransactionModals.test.jsx src/test/MaterialFifoPages.test.jsx
git add src/features/material-fifo/components/FifoInboundModal.jsx src/features/material-fifo/components/FifoOutboundModal.jsx src/features/material-fifo/MaterialFifoPage.jsx src/test/FifoTransactionModals.test.jsx
git commit -m "feat: add material fifo transactions"
```

---

### Task 7: Settings, Transaction History, and Raw Material SKU Management

**Files:**
- Modify: `src/test/MaterialFifoPages.test.jsx`
- Modify: `src/features/material-fifo/pages/DataFifoPage.jsx`
- Create: `src/features/material-fifo/pages/TransactionsPage.jsx`
- Create: `src/features/material-fifo/pages/ManageSkuPage.jsx`

**Interfaces:**
- Consumes: `upsertFifoSettings`, `createRawMaterialItem`, `fetchFifoTransactions`, and workspace `refresh`.
- Produces: individual MIN/MAX/remarks editing, immutable history detail, and complete SKU creation.

- [ ] **Step 1: Add failing settings tests**

Open a settings editor from Data FIFO, verify prefilled values, reject negative values and `MIN > MAX`, then assert the API receives strings and remarks. Verify successful save refreshes data.

- [ ] **Step 2: Add failing history and SKU tests**

Assert history filters for date/type/SKU/location/user, allocation detail expansion, empty state, and no edit/delete controls. For Manage SKU, require SKU, item code, internal product code, item name, and UOM; assert category is not user-editable and the RPC receives no category parameter.

- [ ] **Step 3: Run page tests to verify failure**

```powershell
npx vitest run src/test/MaterialFifoPages.test.jsx
```

- [ ] **Step 4: Implement individual settings and remarks editing**

Use the same client validation as the import parser. `MIN = MAX` is valid. After save, close only on success and keep the form recoverable on network errors.

- [ ] **Step 5: Implement immutable transaction history**

Query server-side date/type/item filters and apply user/location display filters without unsafe raw PostgREST interpolation. Expand outbound rows to show allocations ordered by lot received date. Resolve audit names from joined profiles; fall back to the user UUID if a profile is unavailable.

- [ ] **Step 6: Implement complete Raw Material creation form**

Trim identifiers, preserve meaningful item-name spacing, uppercase UOM for display consistency, and call `createRawMaterialItem`. Map uniqueness errors to the conflicting field. On success, reset the form, refresh master data, and show the created SKU.

- [ ] **Step 7: Run tests and commit**

```powershell
npx vitest run src/test/MaterialFifoPages.test.jsx
git add src/features/material-fifo/pages/DataFifoPage.jsx src/features/material-fifo/pages/TransactionsPage.jsx src/features/material-fifo/pages/ManageSkuPage.jsx src/test/MaterialFifoPages.test.jsx
git commit -m "feat: add fifo settings history and sku management"
```

---

### Task 8: Excel/CSV Imports and Excel Exports

**Files:**
- Create: `src/test/MaterialFifoImportExport.test.jsx`
- Create: `src/features/material-fifo/pages/ImportPage.jsx`
- Create: `src/features/material-fifo/pages/ExportPage.jsx`
- Modify: `src/features/material-fifo/lib/exportRows.js`

**Interfaces:**
- Consumes: Task 2 parsers/mappers, `issueMaterial`, `upsertFifoSettings`, `xlsx`, and `write-excel-file`.
- Produces: downloadable templates, preview/results workflows, and filtered/all export files.

- [ ] **Step 1: Write failing import UI tests**

Mock FileReader/XLSX conversion to worksheet arrays. Assert the outbound template headers are `SKU | QTY | LOKASI`, MIN/MAX headers are exactly `SKU | MIN | MAX`, invalid rows show row number/reason, only valid rows can be submitted, and runtime partial failures do not hide successes.

```jsx
expect(screen.getByText(/Baris 3/)).toHaveTextContent('SKU belum terdaftar');
await user.click(screen.getByRole('button', { name: /Proses 2 baris valid/i }));
expect(issueMaterial).toHaveBeenCalledTimes(2);
```

- [ ] **Step 2: Write failing export UI tests**

Assert default all-data export, explicit filtered export, stock fields/lot text, transaction allocation/audit fields, Indonesian filename dates, and fractional quantity preservation.

- [ ] **Step 3: Run focused tests to verify failure**

```powershell
npx vitest run src/test/materialFifoImportRows.test.js src/test/materialFifoExportRows.test.js src/test/MaterialFifoImportExport.test.jsx
```

- [ ] **Step 4: Implement import file reading and preview**

Accept `.xlsx`, `.xls`, and `.csv`; use the first worksheet only. Never submit immediately after parsing. Show totals for valid and invalid rows and require explicit confirmation. Generate one import batch UUID and one stable request UUID per valid outbound row. Process rows sequentially or with concurrency `1` so later rows validate against updated stock deterministically. Record each result as `{ rowNumber, sku, ok, stockAfter, error }`.

For MIN/MAX, call `upsertFifoSettings` only for valid known Raw Material rows. Unknown SKUs remain errors directing users to Manage SKU.

- [ ] **Step 5: Implement templates and exports**

Create workbooks in the browser without network calls. Name files:

```text
template_barang_keluar_fifo.xlsx
template_min_max_fifo.xlsx
stok_material_fifo_YYYY-MM-DD.xlsx
transaksi_material_fifo_YYYY-MM-DD.xlsx
```

Stock lot text uses `LOCATION | quantity UOM | dd/MM/yyyy`, joined with newlines. Transaction rows include transaction/request IDs, type/method, stock before/after, notes, user, and an allocation summary.

- [ ] **Step 6: Run tests and commit**

```powershell
npx vitest run src/test/materialFifoImportRows.test.js src/test/materialFifoExportRows.test.js src/test/MaterialFifoImportExport.test.jsx
git add src/features/material-fifo/pages/ImportPage.jsx src/features/material-fifo/pages/ExportPage.jsx src/features/material-fifo/lib/exportRows.js src/test/MaterialFifoImportExport.test.jsx
git commit -m "feat: add material fifo import and export"
```

---

### Task 9: Unified PWA, Documentation, and Full Verification

**Files:**
- Create: `src/test/AppUpdateToast.test.jsx`
- Create: `src/components/AppUpdateToast.jsx`
- Create: `public/manifest.webmanifest`
- Create: `public/sw.js`
- Create: `public/icons/icon-192.png`
- Create: `public/icons/icon-512.png`
- Create: `public/icons/icon-512-maskable.png`
- Modify: `src/main.jsx`
- Modify: `index.html`
- Modify: `README.md`

**Interfaces:**
- Consumes: browser service worker/online APIs and reusable icon assets from `integrate/material-fifo/`.
- Produces: installable unified app, explicit update action, online-only FIFO enforcement documentation, and final verified build.

- [ ] **Step 1: Write the failing update-toast test**

Mock a waiting service worker and assert the toast sends `{ type: 'SKIP_WAITING' }`, listens for `controllerchange`, and reloads once. Assert dismiss hides the toast without activating the worker.

- [ ] **Step 2: Run test to verify failure**

```powershell
npx vitest run src/test/AppUpdateToast.test.jsx
```

Expected: FAIL because `AppUpdateToast` does not exist.

- [ ] **Step 3: Implement manifest, service worker, and registration**

The manifest uses the unified app name, `display: standalone`, `/` start URL, project blue theme, and 192/512/maskable icons. Copy the existing PNG assets without image re-encoding.

Use a versioned cache containing only `/`, `/index.html`, manifest, and icon/static build requests. In `fetch`, bypass every non-GET request and every request whose origin differs from `self.location.origin`; this excludes all Supabase API/Auth/Realtime traffic. Delete old app-shell caches on activate. Handle `SKIP_WAITING` messages.

Register after window load, surface `registration.waiting` and `updatefound`, and render `AppUpdateToast` once at the application root.

- [ ] **Step 4: Run PWA test and verify production output**

```powershell
npx vitest run src/test/AppUpdateToast.test.jsx
npm run build
```

Expected: test PASS; `dist/manifest.webmanifest`, `dist/sw.js`, and all three icon files exist.

- [ ] **Step 5: Update README and run complete verification**

Document Material FIFO navigation, all retained workflows, removed legacy cycle count, Supabase migration command/order, Raw Material restriction, scanner modes, import formats, and online-only transaction behavior.

Run:

```powershell
npm test -- --run
npm run build
git diff --check
```

Then, when `TEST_DATABASE_URL` is available:

```powershell
psql $env:TEST_DATABASE_URL -v ON_ERROR_STOP=1 -f database/material_fifo_migration.sql
psql $env:TEST_DATABASE_URL -v ON_ERROR_STOP=1 -f database/material_fifo_regression_tests.sql
```

Expected: all Vitest tests PASS, Vite build exits 0, diff check has no errors, SQL migration is idempotent, and rollback-only SQL tests exit 0.

- [ ] **Step 6: Perform manual smoke checks**

Verify desktop and narrow mobile layout, native camera permission denied/allowed states, ZXing fallback, handheld scanner `Enter` path, automatic FIFO across lots, manual location issue, import partial success, exports, offline mutation blocking, installability, and update-toast activation. Record environment-dependent checks in the final handoff rather than claiming unrun checks.

- [ ] **Step 7: Commit final integration**

```powershell
git add src/main.jsx src/components/AppUpdateToast.jsx src/test/AppUpdateToast.test.jsx public index.html README.md
git commit -m "feat: finish material fifo integration"
```

---

## Final Review Gate

Before declaring completion:

1. Compare every acceptance criterion in `docs/superpowers/specs/2026-08-12-material-fifo-integration-design.md` with an implemented test or recorded manual check.
2. Confirm `integrate/material-fifo/Code.gs` and its cycle-count UI were used only as behavioral reference and are not imported into the application bundle.
3. Confirm no service-role key, Supabase secret, old dashboard password, or Google Apps Script URL exists in committed frontend code.
4. Confirm no direct client mutation targets `material_fifo_lots`, `material_fifo_transactions`, or `material_fifo_allocations`.
5. Run `npm test -- --run`, `npm run build`, `git diff --check`, and available SQL regression tests immediately before the completion claim.
