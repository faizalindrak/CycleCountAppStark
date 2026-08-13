# Backlog Edit, Delete, and Supply Destinations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add creator/admin-controlled edit and delete actions to backlog transactions and add a reusable Supabase-backed supply-destination selector with an in-form Add Location modal.

**Architecture:** Keep `BacklogReport` as the page orchestrator while extracting pure backlog rules, Supabase data operations, and focused modal/field components. Store destinations in a dedicated master table, retain the existing destination-name snapshot on every transaction, and enforce creator-or-admin mutations in both UI rules and Supabase RLS.

**Tech Stack:** React 18, Vite 5, Vitest 4, React Testing Library, Tailwind CSS, Lucide React, Supabase PostgreSQL/RLS.

## Global Constraints

- `backlog_supply_destinations` must remain separate from the existing cycle-count `locations` table.
- SKU, item, and category are immutable during transaction edit.
- Quantity, transaction date, destination, and notes are editable.
- A transaction creator may edit/delete their own record; an admin may edit/delete every record; other users remain read-only.
- Every authenticated user may view and create supply destinations.
- New and edited transactions must write both `supply_destination_id` and the current `supply_destination` name snapshot.
- Existing backlog rows with a null destination ID must remain readable and valid.
- Destination creation must trim names, reject blanks, and prevent case-insensitive duplicates.
- Do not add destination rename/delete UI, bulk actions, or unrelated refactors.
- Use test-first red-green-refactor for every production behavior.

---

## File Structure

- Create `database/inventory_backlog_destinations_edit_delete_migration.sql`: idempotent Supabase migration for destination master, foreign key, admin helper, triggers, indexes, and RLS.
- Create `src/components/backlog/backlogRules.js`: pure permission, normalization, validation, and payload builders.
- Create `src/lib/backlogService.js`: the only new module that performs Supabase CRUD for destinations and backlog mutations.
- Create `src/components/backlog/SupplyDestinationField.jsx`: reusable destination select plus Add Location trigger.
- Create `src/components/backlog/AddSupplyDestinationModal.jsx`: add-location dialog and mutation feedback.
- Create `src/components/backlog/EditBacklogModal.jsx`: immutable item identity plus editable backlog fields.
- Create `src/components/backlog/DeleteBacklogDialog.jsx`: explicit destructive confirmation.
- Modify `src/components/BacklogReport.jsx`: load destinations, use extracted service/rules/components, render actions, and refresh summaries.
- Create `src/test/inventoryBacklogMigration.test.js`: migration contract tests.
- Create `src/test/backlogRules.test.js`: pure domain behavior tests.
- Create `src/test/SupplyDestinationComponents.test.jsx`: destination field/modal interaction tests.
- Create `src/test/BacklogMutationDialogs.test.jsx`: edit/delete dialog behavior tests.
- Create `src/test/BacklogReportActions.test.jsx`: page-level authorization/action integration tests.

---

### Task 1: Supabase Destination Master and Mutation Policies

**Files:**
- Create: `database/inventory_backlog_destinations_edit_delete_migration.sql`
- Create: `src/test/inventoryBacklogMigration.test.js`

**Interfaces:**
- Produces table `public.backlog_supply_destinations(id, name, created_by, created_at, updated_at)`.
- Produces nullable column `public.inventory_backlogs.supply_destination_id`.
- Produces `public.is_backlog_admin() RETURNS BOOLEAN`.
- Produces creator-or-admin UPDATE/DELETE policies for `inventory_backlogs`.

- [ ] **Step 1: Write a failing migration contract test**

```js
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  new URL('../../database/inventory_backlog_destinations_edit_delete_migration.sql', import.meta.url),
  'utf8'
);

describe('inventory backlog destination migration', () => {
  it('creates a dedicated destination master and links backlog rows', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.backlog_supply_destinations');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS supply_destination_id UUID');
    expect(sql).toContain('REFERENCES public.backlog_supply_destinations(id) ON DELETE SET NULL');
    expect(sql).toMatch(/UNIQUE INDEX[\s\S]*lower\(trim\(name\)\)/i);
  });

  it('enforces creator-or-admin backlog mutations', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.is_backlog_admin()');
    expect(sql).toMatch(/FOR UPDATE[\s\S]*created_by = auth\.uid\(\)[\s\S]*is_backlog_admin\(\)/i);
    expect(sql).toMatch(/FOR DELETE[\s\S]*created_by = auth\.uid\(\)[\s\S]*is_backlog_admin\(\)/i);
  });
});
```

- [ ] **Step 2: Run the migration test and verify RED**

Run: `npx vitest run src/test/inventoryBacklogMigration.test.js`

Expected: FAIL because `database/inventory_backlog_destinations_edit_delete_migration.sql` does not exist.

- [ ] **Step 3: Add the minimal idempotent migration**

Create the migration with these exact operations:

```sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.backlog_supply_destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_backlog_supply_destinations_normalized_name
  ON public.backlog_supply_destinations (lower(trim(name)));

ALTER TABLE public.inventory_backlogs
  ADD COLUMN IF NOT EXISTS supply_destination_id UUID;

DO $$ BEGIN
  ALTER TABLE public.inventory_backlogs
    ADD CONSTRAINT inventory_backlogs_supply_destination_id_fkey
    FOREIGN KEY (supply_destination_id)
    REFERENCES public.backlog_supply_destinations(id)
    ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.is_backlog_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role::text = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_backlog_admin() TO authenticated;
```

Add an updated-at trigger for destinations. Enable RLS. Add destination SELECT/INSERT policies, admin ALL policy, and replace backlog UPDATE/DELETE policies with `created_by = auth.uid() OR public.is_backlog_admin()`. Use both `USING` and `WITH CHECK` for UPDATE. Finish with `COMMIT;`.

- [ ] **Step 4: Run the migration contract test and verify GREEN**

Run: `npx vitest run src/test/inventoryBacklogMigration.test.js`

Expected: 2 tests PASS.

- [ ] **Step 5: Commit the migration slice**

```bash
git add database/inventory_backlog_destinations_edit_delete_migration.sql src/test/inventoryBacklogMigration.test.js
git commit -m "feat: add backlog supply destination schema"
```

---

### Task 2: Backlog Domain Rules and Supabase Service

**Files:**
- Create: `src/components/backlog/backlogRules.js`
- Create: `src/lib/backlogService.js`
- Create: `src/test/backlogRules.test.js`

**Interfaces:**
- Produces `canManageBacklog(record, userId, isAdmin): boolean`.
- Produces `normalizeDestinationName(name): string`.
- Produces `validateDestinationName(name, destinations): string | null`.
- Produces `buildBacklogWritePayload({ qty, transactionDate, destination, notes }): object`.
- Produces async service functions `listSupplyDestinations()`, `createSupplyDestination(name, userId)`, `updateBacklog(id, fields)`, and `deleteBacklog(id)`.

- [ ] **Step 1: Write failing pure-rule tests**

```js
import { describe, expect, it } from 'vitest';
import {
  buildBacklogWritePayload,
  canManageBacklog,
  normalizeDestinationName,
  validateDestinationName,
} from '../components/backlog/backlogRules';

describe('backlog rules', () => {
  it('allows only creator or admin to manage a record', () => {
    const record = { created_by: 'owner' };
    expect(canManageBacklog(record, 'owner', false)).toBe(true);
    expect(canManageBacklog(record, 'other', true)).toBe(true);
    expect(canManageBacklog(record, 'other', false)).toBe(false);
  });

  it('normalizes and rejects blank or duplicate destinations', () => {
    expect(normalizeDestinationName('  Line Produksi 2  ')).toBe('Line Produksi 2');
    expect(validateDestinationName('   ', [])).toBe('Nama lokasi wajib diisi.');
    expect(validateDestinationName(' line produksi 2 ', [{ name: 'Line Produksi 2' }]))
      .toBe('Lokasi sudah tersedia.');
  });

  it('builds an editable payload without SKU, item, or category', () => {
    const payload = buildBacklogWritePayload({
      qty: '12',
      transactionDate: '2026-08-12',
      destination: { id: 'dest-1', name: 'Line A' },
      notes: ' urgent ',
      sku: 'IGNORED',
      category: 'IGNORED',
    });
    expect(payload).toEqual({
      qty_backlog: 12,
      transaction_date: '2026-08-12',
      supply_destination_id: 'dest-1',
      supply_destination: 'Line A',
      backlog_notes: 'urgent',
    });
    expect(payload).not.toHaveProperty('sku');
    expect(payload).not.toHaveProperty('category');
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run src/test/backlogRules.test.js`

Expected: FAIL because `backlogRules.js` does not exist.

- [ ] **Step 3: Implement the minimal pure rules**

```js
export const canManageBacklog = (record, userId, isAdmin) =>
  Boolean(isAdmin || (record?.created_by && record.created_by === userId));

export const normalizeDestinationName = (name) => String(name || '').trim();

export const validateDestinationName = (name, destinations) => {
  const normalized = normalizeDestinationName(name);
  if (!normalized) return 'Nama lokasi wajib diisi.';
  const duplicate = destinations.some(
    (item) => normalizeDestinationName(item.name).toLocaleLowerCase('id') === normalized.toLocaleLowerCase('id')
  );
  return duplicate ? 'Lokasi sudah tersedia.' : null;
};

export const buildBacklogWritePayload = ({ qty, transactionDate, destination, notes }) => ({
  qty_backlog: Number(qty),
  transaction_date: transactionDate,
  supply_destination_id: destination.id,
  supply_destination: destination.name,
  backlog_notes: String(notes || '').trim() || null,
});
```

- [ ] **Step 4: Run pure-rule tests and verify GREEN**

Run: `npx vitest run src/test/backlogRules.test.js`

Expected: 3 tests PASS.

- [ ] **Step 5: Add Supabase service functions**

Implement `src/lib/backlogService.js` using the existing `supabase` client:

```js
import { supabase } from './supabase';

export const listSupplyDestinations = async () => {
  const { data, error } = await supabase
    .from('backlog_supply_destinations')
    .select('id, name, created_by, created_at')
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const createSupplyDestination = async (name, userId) => {
  const { data, error } = await supabase
    .from('backlog_supply_destinations')
    .insert([{ name: name.trim(), created_by: userId }])
    .select('id, name, created_by, created_at')
    .single();
  if (error) throw error;
  return data;
};

export const updateBacklog = async (id, fields) => {
  const { data, error } = await supabase
    .from('inventory_backlogs').update(fields).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

export const deleteBacklog = async (id) => {
  const { error } = await supabase.from('inventory_backlogs').delete().eq('id', id);
  if (error) throw error;
};
```

- [ ] **Step 6: Re-run the domain tests**

Run: `npx vitest run src/test/backlogRules.test.js`

Expected: 3 tests PASS with no console errors.

- [ ] **Step 7: Commit the domain/service slice**

```bash
git add src/components/backlog/backlogRules.js src/lib/backlogService.js src/test/backlogRules.test.js
git commit -m "feat: add backlog mutation rules and service"
```

---

### Task 3: Supply Destination Field and Add Location Modal

**Files:**
- Create: `src/components/backlog/SupplyDestinationField.jsx`
- Create: `src/components/backlog/AddSupplyDestinationModal.jsx`
- Create: `src/test/SupplyDestinationComponents.test.jsx`

**Interfaces:**
- `SupplyDestinationField({ destinations, value, onChange, onAdd, disabled = false })` emits the selected destination object.
- `AddSupplyDestinationModal({ open, destinations, userId, onClose, onCreated })` creates a destination and emits the created row.
- Consumes `validateDestinationName()` and `createSupplyDestination()` from Task 2.

- [ ] **Step 1: Write failing component tests**

```jsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SupplyDestinationField from '../components/backlog/SupplyDestinationField';
import AddSupplyDestinationModal from '../components/backlog/AddSupplyDestinationModal';

vi.mock('../lib/backlogService', () => ({
  createSupplyDestination: vi.fn(async (name) => ({ id: 'new-id', name })),
}));

it('emits the selected destination and opens Add Location', () => {
  const onChange = vi.fn();
  const onAdd = vi.fn();
  render(<SupplyDestinationField destinations={[{ id: '1', name: 'Line A' }]} value="" onChange={onChange} onAdd={onAdd} />);
  fireEvent.change(screen.getByLabelText(/tujuan supply/i), { target: { value: '1' } });
  expect(onChange).toHaveBeenCalledWith({ id: '1', name: 'Line A' });
  fireEvent.click(screen.getByRole('button', { name: /tambah lokasi/i }));
  expect(onAdd).toHaveBeenCalled();
});

it('creates, closes, and returns a trimmed destination', async () => {
  const onCreated = vi.fn();
  const onClose = vi.fn();
  render(<AddSupplyDestinationModal open destinations={[]} userId="user-1" onCreated={onCreated} onClose={onClose} />);
  fireEvent.change(screen.getByLabelText(/nama lokasi/i), { target: { value: '  Line B  ' } });
  fireEvent.click(screen.getByRole('button', { name: /^simpan$/i }));
  await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ id: 'new-id', name: 'Line B' }));
  expect(onClose).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run src/test/SupplyDestinationComponents.test.jsx`

Expected: FAIL because both components do not exist.

- [ ] **Step 3: Implement `SupplyDestinationField`**

Render a labeled `<select id="supply-destination">`, an empty option labeled `Pilih tujuan supply`, destination options, and a secondary button labeled `+ Tambah Lokasi`. On selection, find the destination by ID and pass the complete object to `onChange`.

- [ ] **Step 4: Implement `AddSupplyDestinationModal`**

Render nothing when `open` is false. When open, render an accessible dialog with `aria-modal="true"`, a required `Nama Lokasi` input, Cancel, and Save. Validate with `validateDestinationName`, call `createSupplyDestination(normalizedName, userId)`, keep the modal open on failure, and disable controls while saving.

- [ ] **Step 5: Run component tests and verify GREEN**

Run: `npx vitest run src/test/SupplyDestinationComponents.test.jsx`

Expected: 2 tests PASS.

- [ ] **Step 6: Add duplicate and failure coverage**

Add tests asserting that `Line A` is rejected when `line a` already exists and that a rejected service promise displays `Gagal menyimpan lokasi.` while leaving the dialog visible.

- [ ] **Step 7: Run component tests again**

Run: `npx vitest run src/test/SupplyDestinationComponents.test.jsx`

Expected: 4 tests PASS.

- [ ] **Step 8: Commit destination UI**

```bash
git add src/components/backlog/SupplyDestinationField.jsx src/components/backlog/AddSupplyDestinationModal.jsx src/test/SupplyDestinationComponents.test.jsx
git commit -m "feat: add backlog supply destination picker"
```

---

### Task 4: Edit and Delete Transaction Dialogs

**Files:**
- Create: `src/components/backlog/EditBacklogModal.jsx`
- Create: `src/components/backlog/DeleteBacklogDialog.jsx`
- Create: `src/test/BacklogMutationDialogs.test.jsx`

**Interfaces:**
- `EditBacklogModal({ open, record, category, destinations, destinationOverrideId = '', onAddDestination, onClose, onSaved })`.
- `DeleteBacklogDialog({ open, record, onClose, onDeleted })`.
- Consumes `buildBacklogWritePayload()`, `updateBacklog()`, `deleteBacklog()`, and `SupplyDestinationField`.

- [ ] **Step 1: Write failing edit-dialog tests**

```jsx
vi.mock('../lib/backlogService', () => ({
  updateBacklog: vi.fn(async (_id, payload) => ({ id: 'r1', ...payload })),
  deleteBacklog: vi.fn(async () => undefined),
}));

it('locks SKU and category and submits only editable fields', async () => {
  const onSaved = vi.fn();
  render(<EditBacklogModal
    open
    record={{ id: 'r1', sku: 'SKU-1', item_name: 'Item 1', qty_backlog: 5, transaction_date: '2026-08-12', supply_destination_id: 'd1', backlog_notes: '' }}
    category="Raw Material"
    destinations={[{ id: 'd1', name: 'Line A' }]}
    onAddDestination={vi.fn()}
    onClose={vi.fn()}
    onSaved={onSaved}
  />);
  expect(screen.getByDisplayValue('SKU-1')).toBeDisabled();
  expect(screen.getByDisplayValue('Raw Material')).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/qty backlog/i), { target: { value: '8' } });
  fireEvent.click(screen.getByRole('button', { name: /simpan perubahan/i }));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
});
```

- [ ] **Step 2: Write a failing delete-confirmation test**

```jsx
it('does not delete until explicit confirmation', async () => {
  const onDeleted = vi.fn();
  render(<DeleteBacklogDialog open record={{ id: 'r1', sku: 'SKU-1', item_name: 'Item 1', qty_backlog: 5 }} onClose={vi.fn()} onDeleted={onDeleted} />);
  expect(screen.getByText(/SKU-1/)).toBeInTheDocument();
  expect(deleteBacklog).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /^hapus$/i }));
  await waitFor(() => expect(deleteBacklog).toHaveBeenCalledWith('r1'));
  expect(onDeleted).toHaveBeenCalledWith('r1');
});
```

- [ ] **Step 3: Run dialog tests and verify RED**

Run: `npx vitest run src/test/BacklogMutationDialogs.test.jsx`

Expected: FAIL because the dialog components do not exist.

- [ ] **Step 4: Implement `EditBacklogModal`**

Initialize local state whenever `record` changes. When a non-empty `destinationOverrideId` changes, copy it into the local destination selection so a newly created destination becomes selected. Render disabled SKU/category inputs and editable quantity, date, `SupplyDestinationField`, and notes. Reject non-positive integer quantity or missing destination. Build the update using `buildBacklogWritePayload`; never include `sku`, `item_id`, `item_name`, `uom`, or category. Keep the modal open and show `Gagal memperbarui backlog.` when the service rejects.

- [ ] **Step 5: Implement `DeleteBacklogDialog`**

Render an accessible confirmation dialog showing SKU, item name, and formatted quantity. Call `deleteBacklog(record.id)` only from the red confirm button. Keep the dialog open and show `Gagal menghapus backlog.` on rejection.

- [ ] **Step 6: Run dialog tests and verify GREEN**

Run: `npx vitest run src/test/BacklogMutationDialogs.test.jsx`

Expected: edit and delete tests PASS.

- [ ] **Step 7: Add mutation-failure tests**

Add one rejected-promise test per dialog and assert the error text remains visible with the dialog still mounted.

- [ ] **Step 8: Run dialog tests again**

Run: `npx vitest run src/test/BacklogMutationDialogs.test.jsx`

Expected: all dialog tests PASS.

- [ ] **Step 9: Commit transaction dialogs**

```bash
git add src/components/backlog/EditBacklogModal.jsx src/components/backlog/DeleteBacklogDialog.jsx src/test/BacklogMutationDialogs.test.jsx
git commit -m "feat: add backlog edit and delete dialogs"
```

---

### Task 5: Integrate Destinations and Authorized Actions into Report Backlog

**Files:**
- Modify: `src/components/BacklogReport.jsx`
- Create: `src/test/BacklogReportActions.test.jsx`

**Interfaces:**
- Consumes all Task 2-4 interfaces.
- Uses `useAuth()` values `user`, `profile`, `isAdmin`, and `signOut`.
- Adds page state `destinations`, `editingRecord`, `deletingRecord`, `showDestinationModal`, and `destinationTarget` (`create` or `edit`).

- [ ] **Step 1: Write a failing authorization rendering test**

Mock page data so three records are returned: one owned by the current user, one owned by another user, and use two auth variants. Assert a normal user sees Edit/Delete only on their record; assert an admin sees actions on both records. Use accessible button names containing the SKU, for example `Edit SKU-1` and `Hapus SKU-1`.

- [ ] **Step 2: Run the page authorization test and verify RED**

Run: `npx vitest run src/test/BacklogReportActions.test.jsx`

Expected: FAIL because the page has no edit/delete actions.

- [ ] **Step 3: Load destinations with page data**

Import `listSupplyDestinations` and add `fetchDestinations`. Include it in the existing `Promise.all([fetchItems(), fetchRecords(), fetchDestinations()])`. Change `emptyForm` to store `supplyDestinationId` instead of free text.

- [ ] **Step 4: Replace free-text destination entry**

Use `SupplyDestinationField` in the create form. On selection write `form.supplyDestinationId`. On submit resolve the selected destination object and call `buildBacklogWritePayload`, then merge the immutable item fields and `created_by`:

```js
const payload = {
  item_id: selectedItem.id,
  sku: selectedItem.sku,
  item_name: selectedItem.item_name,
  uom: selectedItem.uom,
  ...buildBacklogWritePayload({
    qty: form.qty,
    transactionDate: form.transactionDate,
    destination: selectedDestination,
    notes: form.notes,
  }),
  created_by: user.id,
};
```

- [ ] **Step 5: Add location-modal orchestration**

Open `AddSupplyDestinationModal` from either create or edit. When `onCreated(destination)` fires, append/sort the destination list. If target is create, update the create form ID; if target is edit, store the new ID in page state and pass it to `EditBacklogModal` as `destinationOverrideId`. Clear the target when the modal closes and clear the override when the edit modal closes.

- [ ] **Step 6: Render authorized row actions**

Read `isAdmin` from auth. Add an `Aksi` table column. For each row where `canManageBacklog(record, user.id, isAdmin)` is true, render Edit and Delete icon buttons with SKU-specific accessible labels. Render no action controls for unauthorized users.

- [ ] **Step 7: Wire edit and delete completion**

On edit success, close the modal, update `filterDate` to the edited date when necessary, call `fetchRecords()`, and show `Backlog berhasil diperbarui.` On delete success, close the dialog, call `fetchRecords()`, and show `Backlog berhasil dihapus.` Existing summary totals recompute from refreshed `records`.

- [ ] **Step 8: Preserve legacy destinations and exports**

Display and export `record.supply_destination` exactly as before even when `record.supply_destination_id` is null. When editing a legacy row, include a temporary option using its saved text until the user selects a master destination; require a master destination before saving the edit.

- [ ] **Step 9: Run the page tests and verify GREEN**

Run: `npx vitest run src/test/BacklogReportActions.test.jsx`

Expected: authorization and modal-opening tests PASS.

- [ ] **Step 10: Run all new targeted tests**

Run: `npx vitest run src/test/inventoryBacklogMigration.test.js src/test/backlogRules.test.js src/test/SupplyDestinationComponents.test.jsx src/test/BacklogMutationDialogs.test.jsx src/test/BacklogReportActions.test.jsx`

Expected: all new tests PASS with no unhandled promise errors.

- [ ] **Step 11: Commit page integration**

```bash
git add src/components/BacklogReport.jsx src/test/BacklogReportActions.test.jsx
git commit -m "feat: manage backlog transactions and destinations"
```

---

### Task 6: Final Regression and Production Verification

**Files:**
- Modify only files needed to fix failures introduced by Tasks 1-5.

**Interfaces:**
- Consumes the completed feature; produces verified build and test evidence.

- [ ] **Step 1: Run the full test suite once**

Run: `npx vitest run`

Expected: all tests PASS. If the existing environment-specific test runtime hangs, capture the exact stuck suite, terminate it, and retain successful targeted-test evidence; do not claim the full suite passed.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: Vite exits 0 and writes `dist/`. Existing bundle-size and Browserslist freshness warnings are acceptable; compile errors are not.

- [ ] **Step 3: Inspect the final diff**

Run: `git diff --check && git status --short && git diff --stat HEAD~5..HEAD`

Expected: no whitespace errors; only planned feature/test/migration files plus the already-approved design and plan documents are present. Leave unrelated `integrate/` content untouched.

- [ ] **Step 4: Verify migration handoff text**

Confirm `database/inventory_backlog_destinations_edit_delete_migration.sql` begins with a comment instructing the user to paste the complete file into Supabase Dashboard SQL Editor and run it after the original `inventory_backlogs` migration.

- [ ] **Step 5: Commit any verification-only correction**

Only if Step 1-4 required a correction:

```bash
git add database/inventory_backlog_destinations_edit_delete_migration.sql src/components/BacklogReport.jsx src/components/backlog src/lib/backlogService.js src/test/inventoryBacklogMigration.test.js src/test/backlogRules.test.js src/test/SupplyDestinationComponents.test.jsx src/test/BacklogMutationDialogs.test.jsx src/test/BacklogReportActions.test.jsx
git commit -m "fix: finalize backlog destination management"
```

Do not create an empty commit.
