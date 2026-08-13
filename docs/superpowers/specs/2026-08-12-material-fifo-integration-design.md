# Material FIFO Integration Design

**Date:** 2026-08-12

**Status:** Approved in conversation; pending written-spec review

**Project:** Warehouse Cycle Count App

## 1. Objective

Port `integrate/material-fifo/` into the existing React/Vite Warehouse Cycle Count application as one authenticated application. Replace Google Sheets and Google Apps Script with Supabase, preserve the operational FIFO features, and restyle the user interface to match the current project.

Material FIFO applies only to SKUs whose category is `Raw Material`. Existing Raw Material records in `public.items` are the master data. A missing SKU can be added through a validated form as a Raw Material item.

## 2. Confirmed Scope

### Included

- Dashboard KPIs and critical/over-stock lists.
- Searchable and filterable FIFO stock data.
- Inbound transactions that create dated location lots.
- Outbound transactions using automatic FIFO or an explicitly selected location.
- Camera, browser-native, handheld, and manual QR/barcode input.
- Bulk outbound import from Excel.
- MIN/MAX configuration and Excel/CSV import using `SKU | MIN | MAX`.
- Current-stock export with lot details.
- Transaction-history export.
- Realtime data refresh.
- All active users can view and operate Material FIFO.
- Audit attribution to the authenticated Supabase user.
- Installable PWA shell and new-version notification for the unified application.

### Explicitly excluded

- The cycle-count feature contained in the legacy Material FIFO application.
- Google Sheets, Google Apps Script, and the legacy shared-password authentication.
- Migration of old stock, FIFO lots, or transaction history from Google Sheets.
- Offline FIFO transactions. Inventory reads and writes require a network connection.
- Direct editing or deletion of immutable FIFO transaction history.

The existing Cycle Count module in the main project remains unchanged and separate from Material FIFO.

## 3. Feature-Parity Mapping

| Legacy capability | Integrated behavior |
| --- | --- |
| Separate password login/change password | Replaced by the existing Supabase Auth session and active profile check |
| Stock dashboard and status lists | Native React overview using Supabase data |
| FIFO data table, search, and filters | Native React Data FIFO page |
| Inbound lot entry | Atomic Supabase RPC |
| Automatic FIFO outbound entry | Atomic Supabase RPC with deterministic lot locking |
| Manual-location outbound entry | Atomic RPC restricted to lots in that location |
| Camera scan and manual input | Native `BarcodeDetector`, ZXing fallback, keyboard-wedge support, and manual input |
| Bulk Excel outbound | Preview, per-row validation, and per-row atomic processing |
| Current-stock download | Excel export including all remaining lots |
| Transaction-log download | Excel export from immutable Supabase history |
| Auto refresh | Supabase Realtime plus explicit refresh |
| PWA install/update prompt | Unified application manifest, app-shell service worker, and update notification |
| Material FIFO cycle count | Removed by explicit requirement |

## 4. Application Architecture

Material FIFO is a protected route at `/material-fifo`. It reuses the existing `AuthContext`, Supabase client, React Router, Tailwind design tokens, Lucide icons, and project-level loading/error patterns.

A `Material FIFO` card is added to `Home` for every active authenticated user. The module is implemented as focused React components and data services rather than embedding the legacy HTML/JavaScript application.

Suggested boundaries:

- `MaterialFifoLayout`: responsive workspace navigation and shared actions.
- `MaterialFifoOverview`: KPIs and attention lists.
- `MaterialFifoData`: material, stock, threshold, and lot table.
- `MaterialFifoTransactions`: audited transaction history and filters.
- `MaterialFifoImport`: outbound and MIN/MAX import flows.
- `MaterialFifoExport`: stock and transaction downloads.
- `MaterialFifoSkuManagement`: add Raw Material SKU form.
- `FifoInboundModal` and `FifoOutboundModal`: guided transaction flows.
- `CodeScanner`: native camera, ZXing, handheld, and manual scan adapter.
- `materialFifoService`: the only frontend boundary for queries and RPC calls.
- Pure helpers for status calculation, import parsing, scan normalization, and allocation previews.

No component writes directly to lot or transaction tables.

## 5. Supabase Data Model

Quantities use `NUMERIC(20,4)` rather than integers so existing material UOMs can use up to four fractional digits without floating-point drift.

### `public.material_fifo_settings`

- `item_id UUID PRIMARY KEY REFERENCES public.items(id) ON DELETE RESTRICT`
- `min_qty NUMERIC(20,4) NOT NULL CHECK (min_qty >= 0)`
- `max_qty NUMERIC(20,4) NOT NULL CHECK (max_qty >= min_qty)`
- `remarks TEXT`
- `updated_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`

Only Raw Material items may receive FIFO settings.

### `public.material_fifo_transactions`

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `request_id UUID NOT NULL UNIQUE`
- `item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT`
- `transaction_type TEXT NOT NULL CHECK (transaction_type IN ('IN', 'OUT'))`
- `issue_method TEXT CHECK (issue_method IN ('FIFO', 'MANUAL') OR issue_method IS NULL)`
- `quantity NUMERIC(20,4) NOT NULL CHECK (quantity > 0)`
- `transaction_date DATE NOT NULL`
- `selected_location TEXT`
- `stock_before NUMERIC(20,4) NOT NULL CHECK (stock_before >= 0)`
- `stock_after NUMERIC(20,4) NOT NULL CHECK (stock_after >= 0)`
- `notes TEXT`
- `import_batch_id UUID`
- `created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

Rows are immutable audit records. `request_id` supplies idempotency for retries and duplicate clicks.

### `public.material_fifo_lots`

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT`
- `inbound_transaction_id UUID NOT NULL UNIQUE REFERENCES public.material_fifo_transactions(id) ON DELETE RESTRICT`
- `location TEXT NOT NULL`
- `received_date DATE NOT NULL`
- `initial_qty NUMERIC(20,4) NOT NULL CHECK (initial_qty > 0)`
- `remaining_qty NUMERIC(20,4) NOT NULL CHECK (remaining_qty >= 0 AND remaining_qty <= initial_qty)`
- `created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`

The required location format remains letters plus digits, a dot, and digits, such as `A1.1`. The database and UI both enforce `^[A-Za-z]+[0-9]+\.[0-9]+$`. The same location may contain multiple independently dated lots.

### `public.material_fifo_allocations`

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `transaction_id UUID NOT NULL REFERENCES public.material_fifo_transactions(id) ON DELETE RESTRICT`
- `lot_id UUID NOT NULL REFERENCES public.material_fifo_lots(id) ON DELETE RESTRICT`
- `quantity NUMERIC(20,4) NOT NULL CHECK (quantity > 0)`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `UNIQUE (transaction_id, lot_id)`

Allocations record which lots an outbound transaction consumed.

### Read model

A security-invoker view or equivalent query returns Raw Material master data joined to settings and aggregated remaining stock. Stock is always derived from `SUM(material_fifo_lots.remaining_qty)` and is never a freely editable field.

The Raw Material predicate is case-insensitive and whitespace-normalized. The migration ensures the canonical `Raw Material` category exists. Newly created items use that canonical category.

## 6. Database Operations and Concurrency

All inventory mutations run through narrowly scoped PostgreSQL RPCs with fixed `search_path` values and explicit authorization checks.

### Receive stock

`receive_material_fifo(...)`:

1. Verifies an active authenticated user and a Raw Material item.
2. Validates location, date, positive quantity, and request ID.
3. Locks the relevant item transaction scope.
4. Calculates current stock.
5. Inserts an `IN` transaction.
6. Inserts a new lot linked to that transaction.
7. Returns the transaction and refreshed stock in one database transaction.

### Issue stock

`issue_material_fifo(...)`:

1. Verifies an active authenticated user and a Raw Material item.
2. Selects positive-remaining lots using `FOR UPDATE`.
3. For automatic FIFO, sorts by `received_date`, `created_at`, then `id`.
4. For manual mode, first restricts lots to the selected location, then applies the same oldest-first ordering within that location.
5. Rejects the entire request if eligible stock is insufficient.
6. Reduces one or more lot balances.
7. Inserts one immutable `OUT` transaction and its allocation rows.
8. Returns the allocations and refreshed stock atomically.

Database locking prevents concurrent users from consuming the same remaining quantity. A repeated `request_id` returns the prior result without creating another transaction.

### Settings and SKU operations

- A validated RPC upserts MIN/MAX for Raw Material items and records `auth.uid()`.
- A narrowly scoped RPC creates a missing Raw Material item only when all required master fields are supplied: SKU, item code, internal product code, item name, and UOM.
- Existing SKU, item-code, and internal-product-code uniqueness rules remain authoritative.

## 7. Authorization and Audit

- All FIFO tables have RLS enabled.
- An active user is an authenticated user whose `public.profiles.status = 'active'`.
- Active users may read FIFO settings, lots, allocations, and transaction history.
- Direct insert/update/delete access to lots, allocations, and transactions is denied to browser roles.
- Active users execute the validated FIFO, settings, import, and Raw Material creation RPCs.
- RPCs derive `created_by` or `updated_by` from `auth.uid()`; the client cannot impersonate another user.
- Existing non-Raw-Material items and existing project modules keep their current permissions.

## 8. User Experience

The approved visual direction is a responsive workspace with sidebar navigation.

### Desktop

- Project header with identity, user, Home navigation, and logout.
- Sidebar: Overview, Data FIFO, Transactions, Import, Export, Manage SKU, and Back to Home.
- Persistent primary actions for inbound and outbound stock.

### Mobile

- The sidebar collapses into a compact menu/drawer.
- Inbound/outbound actions remain prominent and touch-friendly.
- Tables use responsive cards or controlled horizontal scrolling without hiding audit-critical fields.
- Scanner controls prioritize camera and handheld workflows.

### Overview

KPIs show Total Raw Material, Normal, Critical, Over, Without Lot, and MIN/MAX Not Set. Without Lot is a supplementary count and can overlap a configured status.

Status rules are:

- `NOT_CONFIGURED` when either MIN or MAX is absent.
- `CRITICAL` when configured stock is less than or equal to MIN.
- `OVER` when configured stock is greater than MAX.
- `NORMAL` otherwise.

### Data FIFO

Users can search by SKU, item name, item code, or internal product code and filter by status. Each row shows UOM, MIN, MAX, derived stock, status, remarks, and remaining lots ordered oldest first. MIN, MAX, and remarks can also be maintained individually from this page.

### Inbound flow

Scan/search SKU, enter location, quantity, received date, and optional notes, review the values, then confirm. If a location already holds lots, the UI informs the user and still creates a separate lot.

### Outbound flow

Scan/search SKU, enter quantity, select automatic FIFO or a manual location, and review a server-derived allocation preview. On confirmation, the server recalculates and atomically commits the allocation. If stock changed after preview, the final server result is authoritative and the UI explains any rejection.

### Transactions

History supports date, type, SKU, location, and user filters. A transaction detail shows all consumed lots for outbound stock. History is read-only.

## 9. Scanner Design

The reusable scanner applies the following priority:

1. Use the browser/device-native `BarcodeDetector` API when available.
2. Fall back to ZXing camera scanning when native detection is unavailable or cannot initialize.
3. Capture dedicated USB/Bluetooth handheld scanners that emit keyboard input followed by `Enter`.
4. Always provide manual input.

Matching uses normalized, case-insensitive exact values against SKU, internal product code, and item code. Raw scan text is attempted first. Legacy numeric-prefix stripping is attempted only when the original value has no exact match, preventing a transformed value from overriding a valid code.

The scanner stops its media tracks after success, modal close, route change, or component unmount. The UI clearly distinguishes permission denied, unavailable camera, initialization failure, and unknown code.

## 10. Import and Export

### Bulk outbound

Accepted first-sheet headers are `SKU`/`SKU#`, `QTY`/`QTY KELUAR`/`QUANTITY`, and optional `LOKASI`/`LOC`/`LOCATION`. Empty location means automatic FIFO. A location value means manual-location issue.

The flow is file selection, parsed preview, validation, confirmation, then per-row results. Each valid row gets a separate request ID and atomic database call. Invalid rows are skipped and retained in the result with their row number and reason. Runtime failures in one row do not undo successful rows.

### MIN/MAX import

The downloadable template has exactly `SKU`, `MIN`, and `MAX`. Excel and CSV are accepted. Validation rejects:

- Missing or unknown SKU.
- A SKU outside Raw Material.
- Duplicate SKU rows in the file.
- Missing, nonnumeric, or negative values.
- `MIN > MAX`.

An unknown SKU is not created by this import because the template lacks required master fields. The result directs the user to Manage SKU, after which the import can be repeated.

### Export

- Stock export contains master identifiers, UOM, MIN, MAX, derived stock, status, and a human-readable list of remaining location/date/quantity lots.
- Transaction export contains timestamp, transaction date, type, SKU, name, locations/allocations, quantity, UOM, stock before/after, issue method, notes, request ID, and user identity.

Exports respect current Raw Material scope and active filters when the user explicitly chooses filtered export; the default export includes all Raw Material records.

## 11. Realtime, PWA, and Connectivity

The workspace subscribes to relevant Supabase Realtime changes and invalidates/refetches affected read models. It also offers explicit refresh and shows the most recent successful refresh time.

The unified application receives a web manifest and versioned service worker. The service worker caches only static application-shell assets and navigation fallback; it does not cache Supabase responses or queue FIFO mutations. A waiting service worker triggers an update notification. FIFO actions are disabled offline with a direct explanation, while the cached shell may still render.

## 12. Error Handling

- Client and database validation use the same business constraints.
- RPC failures return stable error codes with Indonesian user-facing messages.
- Expected codes include inactive user, non-Raw-Material SKU, duplicate identifier, invalid location, invalid quantity, insufficient stock, unknown location, invalid MIN/MAX, and idempotent replay.
- Submit controls are disabled during a request.
- Inventory is not updated optimistically.
- Network ambiguity is resolved by retrying the same request ID and reading the authoritative result.
- Import errors always include the source row number and reason.
- Unexpected errors are logged for developers without exposing keys, tokens, or database internals to users.

## 13. Verification Strategy

### Unit tests

- Status calculation at MIN, between thresholds, at MAX, and above MAX.
- Import header aliases, parsing, duplicate detection, unknown SKUs, invalid values, and `MIN > MAX`.
- Scan normalization and matching priority.
- Allocation preview formatting and quantity totals.

### React component tests

- Protected routing and Home card visibility for active users.
- Search, status filters, loading, empty, and error states.
- Inbound and outbound form validation.
- Automatic and manual allocation previews.
- Import preview and partial-result rendering.
- Native detector, ZXing fallback, camera cleanup, keyboard-wedge input, and manual input.

### SQL regression tests

- Inbound creates one transaction and one lot atomically.
- Automatic issue consumes the oldest lots across multiple locations.
- Manual issue consumes only the selected location, oldest first within it.
- Insufficient eligible stock changes nothing.
- Replayed request ID does not duplicate data.
- Non-Raw-Material and inactive users are rejected.
- RLS allows authenticated active reads and blocks direct inventory mutations.
- Settings reject invalid bounds.
- Derived stock equals the sum of remaining lots after every operation.

### Integration and release checks

- Run the existing Vitest suite to catch regressions in current modules.
- Run new Material FIFO tests and production build.
- Smoke-test Supabase migrations and RPCs against a disposable/test project.
- Test desktop and mobile responsive layouts.
- Test camera permission states and at least one handheld keyboard-wedge scanner path.
- Verify manifest installability, static-shell offline behavior, update notification, and online-only transaction enforcement.
- Verify Excel/CSV imports and Excel exports with representative fractional quantities.

## 14. Acceptance Criteria

1. An active user can open Material FIFO from Home without a second login.
2. Only Raw Material SKUs appear in FIFO views and operations.
3. A user can add a fully specified missing SKU as Raw Material.
4. Inbound stock creates a dated, located lot and audited transaction atomically.
5. Automatic outbound stock consumes the oldest eligible lots without allowing negative stock.
6. Manual outbound stock consumes only the selected location.
7. Concurrent or retried requests cannot consume the same quantity twice or create duplicate transactions.
8. Camera/native, ZXing fallback, handheld, and manual code entry can select an item.
9. MIN/MAX can be maintained individually and imported using only `SKU | MIN | MAX`.
10. Bulk outbound import preserves valid-row progress and reports invalid/failed rows precisely.
11. Dashboard status, stock exports, and transaction exports reflect Supabase data.
12. Existing application features and tests continue to work.
13. The unified app is installable, announces new versions, and never performs offline FIFO writes.
14. The legacy Material FIFO cycle count and Google Sheet dependency are absent from the integrated module.
