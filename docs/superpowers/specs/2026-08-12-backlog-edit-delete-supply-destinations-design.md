# Backlog Edit, Delete, and Supply Destinations Design

Date: 2026-08-12
Status: Approved design

## Goal

Extend the Report Backlog page so authorized users can edit or delete backlog transactions and can choose a reusable supply destination. A user can create a destination without leaving the backlog form by opening an Add Location modal.

## Scope

This change includes:

- Edit and delete actions for backlog transactions.
- A dedicated master table for backlog supply destinations, separate from the existing warehouse `locations` table.
- A destination selector in the create and edit forms.
- An Add Location modal that creates a destination and selects it immediately.
- Supabase migration updates, RLS policies, UI behavior, and automated tests.

This change does not include destination rename/delete management, bulk transaction actions, or changes to the cycle-count warehouse-location workflow.

## User Experience

### Create transaction

The existing backlog form keeps its SKU/category search behavior. `Tujuan Supply` changes from free text to a searchable or standard select populated from the new destination master. A small `+ Tambah Lokasi` button beside the selector opens the Add Location modal.

The modal contains one required destination-name field. Submitting it:

1. trims and validates the name;
2. prevents a case-insensitive duplicate;
3. saves the destination in Supabase;
4. refreshes the destination list;
5. closes the modal; and
6. selects the newly created destination in the transaction form.

### Edit transaction

Each row has an Edit action. It opens a modal rather than reusing the create form.

The modal displays SKU, item name, and category as read-only context. The user can edit:

- quantity backlog;
- transaction date;
- supply destination; and
- backlog notes.

SKU and category cannot be changed because category is derived from the SKU master and the identity of an existing backlog transaction must remain stable.

The edit modal also exposes `+ Tambah Lokasi`, using the same Add Location modal and automatically selecting the new destination when the user returns.

### Delete transaction

Each authorized row has a Delete action. Selecting it opens a confirmation dialog containing the SKU, item name, and quantity. No deletion occurs until the user confirms. A successful deletion removes the record from the visible list and refreshes summary totals.

### Authorization visibility

- A transaction creator sees Edit and Delete on their own records.
- An admin sees Edit and Delete on every record.
- Other authenticated users can view the record but do not see those actions.
- Database RLS enforces the same rules; UI hiding is not treated as security.

## Data Model

### New table: `public.backlog_supply_destinations`

Columns:

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `name TEXT NOT NULL`
- `created_by UUID NOT NULL REFERENCES auth.users(id)`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Destination names use a unique case-insensitive index on `lower(trim(name))`. A check constraint rejects blank names. The table has an updated-at trigger.

RLS rules:

- every authenticated user can select destinations;
- every authenticated user can insert a destination when `created_by = auth.uid()`;
- destination update/delete is outside the current UI scope and is not granted to normal users;
- admins may manage all destination records for future administration needs.

### Existing table: `public.inventory_backlogs`

Add nullable `supply_destination_id UUID REFERENCES public.backlog_supply_destinations(id) ON DELETE SET NULL`.

The existing `supply_destination TEXT NOT NULL` remains as a snapshot of the selected destination name. Keeping the snapshot preserves historical report readability even if a destination is renamed or removed later. New and edited records write both the foreign key and current destination name.

Existing rows remain valid with a null destination ID and their current text value. No destructive backfill is required.

### Admin detection

The migration defines or reuses a security-definer helper that checks the current user's `profiles.role = 'admin'` without causing RLS recursion. Backlog update/delete policies allow either `created_by = auth.uid()` or the admin helper.

## Component Boundaries

### `BacklogReport`

Owns page-level data loading, create form state, table state, permission checks, realtime refresh, and opening/closing the child dialogs. It fetches destinations in parallel with items and transactions.

### `SupplyDestinationField`

A reusable controlled field used by both create and edit forms. It renders the destination selector and Add Location button. It receives destinations, the selected destination ID, an `onChange` callback, and an `onAdd` callback.

### `AddSupplyDestinationModal`

Owns destination-name input, validation, saving state, and Supabase insert errors. On success it returns the created destination object to its parent.

### `EditBacklogModal`

Owns the editable copy of one transaction. It validates quantity, date, and destination before issuing an update. SKU/item/category are read-only. It can request the Add Location modal through a callback.

### `DeleteBacklogDialog`

Shows transaction identity, handles confirmation/cancel, displays deletion progress, and reports success or failure to the page.

Small pure helpers should contain permission and validation logic so they can be tested without rendering the entire page.

## Data Flow

1. Page load fetches items, destinations, and date-filtered backlog records.
2. Create submits the selected master destination ID and its current name snapshot.
3. Add Location inserts a destination and passes the returned row to the active create/edit form.
4. Edit updates only quantity, date, destination ID/name, and notes; it never sends item/SKU fields.
5. Delete targets one transaction ID and relies on RLS to enforce creator/admin ownership.
6. Successful mutations refresh transactions; destination creation refreshes destination choices.
7. Realtime backlog events continue to refresh the selected report date.

## Error Handling

- Required fields show concise Indonesian validation messages.
- Duplicate destinations produce a friendly `lokasi sudah tersedia` message.
- Supabase authorization failures display an access-denied message without changing local data.
- Failed edits/deletes leave their modal open so the user can retry.
- Controls are disabled while a request is in progress to prevent duplicate writes.
- Legacy records with no destination ID continue to display the saved destination text.

## Testing Strategy

Implementation follows test-driven development. Tests are written and observed failing before production changes.

Pure behavior tests cover:

- creator/admin/other-user action permissions;
- edit payload excludes SKU, item, and category;
- destination-name trimming and blank validation;
- duplicate-name normalization;
- create/update payloads write destination ID and destination snapshot together.

Component tests cover:

- Edit opens with immutable SKU/category and editable allowed fields;
- Delete requires explicit confirmation;
- Add Location success closes the modal and selects the created destination;
- unauthorized rows do not render mutation actions;
- mutation errors preserve the dialog and display feedback.

Final verification includes targeted tests, the existing test suite where runtime permits, and a production build.

## Migration Delivery

A new idempotent SQL migration file will be added under `database/`. It will create the destination table, indexes, trigger, foreign key column, admin helper, and RLS policies. The user can paste the whole migration into Supabase Dashboard SQL Editor and run it once before using the updated page.
