# Google Sheet Material FIFO Stock Sync Design

## Context

The legacy Material FIFO dashboard stores its master settings and current FIFO lots in Google Sheets and exposes them through a Google Apps Script endpoint. The integrated application now uses Supabase. Before go-live, the current Google Sheet stock must be loaded as an opening balance, and the same process must be safe to rerun for a final synchronization.

The source snapshot inspected on 13 August 2026 contains:

- 247 SKU rows;
- 202 SKUs with positive stock;
- 363 positive FIFO lots;
- total stock and lot quantity of 210,728.89;
- no positive-stock SKU without a FIFO lot; and
- no SKU-level difference between the stock column and its FIFO lot sum.

This work migrates current stock and MIN/MAX settings only. It does not migrate cycle count data or the legacy transaction log.

## Goals

- Populate Supabase Material FIFO with the current Google Sheet stock as auditable opening balances.
- Reuse existing Raw Material SKUs and create source SKUs that do not yet exist.
- Make a later pre-live sync replace the previous Google migration rather than duplicate it.
- Prevent a refresh from deleting or corrupting operational FIFO activity.
- Reconcile the Supabase result to the source snapshot before reporting success.

## Non-Goals

- Continuous or scheduled synchronization.
- Bidirectional synchronization back to Google Sheets.
- Migration of legacy cycle counts.
- Migration of historical Google Sheet transactions.
- Changes to Material FIFO permissions, UI, stock rules, or issue allocation behavior.

## Source Access and Secrets

The sync utility logs in to the existing Apps Script endpoint and reads the current stock payload. The dashboard password is supplied at execution time through an environment variable or an interactive secret input. It must not appear in source control, command output, generated SQL, audit notes, or committed configuration.

The returned Apps Script token is memory-only and discarded when the process ends. The sync uses only the login and read endpoints; it never calls legacy stock mutation actions.

Supabase writes require a privileged connection suitable for a controlled migration. Connection credentials are also supplied at execution time and are never committed.

## Source Validation and Normalization

Before any Supabase mutation, the utility normalizes and validates the complete snapshot:

- identifiers are trimmed but preserve leading zeros;
- comparisons for SKU and product code are case-insensitive;
- UOM is normalized to uppercase;
- locations are normalized to uppercase and must match `^[A-Z]+[0-9]+\.[0-9]+$`;
- quantities use at most four decimal places and positive lots must be greater than zero;
- dates are converted from the legacy `dd/MM/yyyy` representation to ISO dates;
- SKUs, source product codes, and source lot keys must be unique where required;
- MIN and MAX must be non-negative and MAX must be greater than or equal to MIN;
- each SKU stock value must equal the sum of its positive FIFO lots within 0.0005; and
- the global stock total must equal the global lot total within 0.0005.

Rows with zero stock and no lots remain valid and still participate in master SKU and MIN/MAX synchronization. Zero-quantity lots are ignored. A malformed or contradictory row stops the entire run before any database writes.

The normalized snapshot receives a SHA-256 checksum derived from stable, sorted master, setting, and lot fields. The checksum identifies the exact source state used by a sync run.

## SKU Matching and Creation

Existing items are matched by normalized `items.sku`. A matched item must already be in category `Raw Material`; otherwise the run stops and reports the conflict. Existing master fields are not overwritten.

For source SKUs that do not exist, the utility creates an item with this approved mapping:

| Supabase field | Google Sheet field |
| --- | --- |
| `sku` | `SKU#` |
| `item_code` | `SKU#` |
| `internal_product_code` | `PRODUCT CODE` |
| `item_name` | `PRODUCT NAME` |
| `uom` | `STOCK UOM` / `UOM` |
| `category` | constant `Raw Material` |

Before creation, the utility detects collisions against existing `item_code` and `internal_product_code`. Any collision belonging to a different SKU stops the run. Missing required master fields also stop the run; the utility does not invent additional fallback identifiers.

## Migration Ownership and Audit Model

Material FIFO transactions, lots, settings, and new items require a valid `created_by` or `updated_by` user. Each run therefore receives one explicitly selected active Supabase user as the technical migration actor. The actor is recorded for audit but receives no special application permission.

A dedicated `material_fifo_sync_runs` table records each attempted database sync with:

- run ID and source kind (`GOOGLE_SHEET`);
- source checksum and legacy snapshot timestamp;
- status (`RUNNING`, `COMPLETED`, or `FAILED`);
- counts and totals from source and destination;
- migration actor;
- start/completion timestamps; and
- a compact failure message when the transaction is rejected.

Opening transactions created by the sync carry the run ID in `import_batch_id` and a stable note prefix identifying them as Google Sheet opening balance records. One inbound transaction and one lot are created for every positive source lot. Request IDs are deterministic from the source kind, SKU, location, received date, and stable lot occurrence, so retrying an identical snapshot cannot create duplicates.

MIN/MAX is upserted from the snapshot. Existing settings for source SKUs are intentionally replaced because the Google Sheet is the source of truth until go-live.

## Controlled Replace Algorithm

The replacement is implemented as one privileged database function or one explicit database transaction so application readers never observe a partially replaced snapshot.

The operation follows this order:

1. Lock Material FIFO synchronization so only one sync can run.
2. Revalidate the requested migration actor and all source-to-item mappings.
3. Identify every previous completed Google Sheet sync batch.
4. Run the operational safety gate.
5. Remove allocations, lots, and inbound transactions belonging only to replaceable Google Sheet batches.
6. Upsert approved missing Raw Material items and source MIN/MAX settings.
7. Insert the new opening inbound transactions and lots with the current run ID.
8. Reconcile per-SKU and global stock against the normalized snapshot.
9. Mark the run completed and commit.

Any error rolls back all stock, settings, master creation, and run-state mutations made by that attempt. A failed attempt is reported by the utility without leaving a partial opening balance.

## Operational Safety Gate

Replacement is allowed only while Supabase remains in a staging opening-balance state. The database rejects replacement when any of these conditions is true:

- an outbound transaction exists;
- a FIFO allocation exists;
- an inbound transaction exists that is not owned by a previous completed Google Sheet sync batch;
- a Google-migrated lot has been changed from its original opening quantity;
- a previous migration transaction or lot cannot be traced unambiguously to its sync run; or
- the destination already contains an unresolved or failed partial sync state.

This gate intentionally stops final synchronization after anyone has started operational receiving or issuing. It does not silently reset user activity. If staging activity must be discarded, that requires a separate explicit reset decision and is outside this sync design.

## Preview and Execution Modes

The utility supports two modes:

- `preview`: fetch, normalize, compare with Supabase, and print a secret-free summary of creates, matches, settings changes, lot counts, totals, conflicts, and safety-gate status; it performs no writes.
- `apply`: repeat all reads and validations, require the same safety gate, execute the controlled replace, and perform post-write reconciliation.

Apply is never inferred from preview. The operator must explicitly select apply. The final pre-live procedure is preview first, review the report, then apply.

## Reconciliation and Success Criteria

A sync is successful only when all of the following are true after the database transaction:

- every source SKU maps to exactly one Raw Material item;
- every positive source lot maps to exactly one active Supabase lot;
- every source SKU stock equals `material_fifo_stock_view.stock_qty` within 0.0005;
- the global Supabase opening stock equals the source total within 0.0005;
- source MIN/MAX equals the settings stored for all source SKUs;
- no orphan migration transaction, lot, or allocation exists; and
- the completed sync run stores the source checksum and matching counts/totals.

The current baseline expectation is 247 mapped source SKUs, 363 positive lots, and total stock of 210,728.89. These values are observations, not hard-coded limits; a later final snapshot may legitimately differ.

## Error Reporting

The preview/apply report uses stable error categories for malformed source data, master conflicts, invalid migration actor, unsafe operational activity, database failure, and reconciliation mismatch. Reports never include the dashboard password, Apps Script token, Supabase secret, or complete raw payload.

## Testing and Verification

Implementation includes:

- unit tests for normalization, leading-zero SKU preservation, dates, locations, quantities, checksums, and reconciliation;
- tests for existing SKU matching and all master collision cases;
- database regression tests for first import, identical rerun, changed-snapshot replacement, rollback on invalid data, and all safety-gate rejection cases;
- a preview against the live legacy endpoint with secret-free totals;
- a database preview before the initial apply;
- post-apply queries comparing SKU counts, lot counts, per-SKU stock, global stock, and MIN/MAX; and
- a final application-level read of `material_fifo_stock_view` and FIFO lots after import.

## Go-Live Procedure

Until final sync, the Google Sheet remains the authoritative operational source and Supabase is staging data only. Immediately before go-live:

1. Stop writes to the legacy dashboard.
2. Confirm no operational FIFO activity exists in Supabase.
3. Run sync preview and review all differences.
4. Run apply and complete reconciliation.
5. Smoke-test Material FIFO reads, scanning, inbound preview, and outbound preview without committing an operational transaction.
6. Declare Supabase authoritative and retire legacy writes.

If the safety gate fails, go-live pauses; the sync does not attempt an automatic destructive recovery.
