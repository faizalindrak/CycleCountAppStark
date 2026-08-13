# Material FIFO UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign every Material FIFO page and related modal to match the supplied compact desktop reference while retaining all existing Supabase-backed behavior and providing a responsive tablet/mobile layout.

**Architecture:** Add a small set of feature-local presentation primitives, then migrate the shell and each page onto those primitives without changing hooks, API functions, routes, or transaction semantics. Data FIFO becomes a responsive semantic table with dynamic FIFO columns; other pages use the same typography, surfaces, controls, status treatment, and modal structure.

**Tech Stack:** React 18, React Router 7, Tailwind CSS 3, Lucide React, Vitest, React Testing Library, Supabase data supplied through the existing `useMaterialFifoData` hook.

## Global Constraints

- Scope is limited to all routes under `/material-fifo/*` and their Material FIFO modals/components.
- Preserve all existing Supabase calls, scanner behavior, validation, import/export formats, permissions, and transaction allocation rules.
- Do not copy static sample data from `integrate/REDESAIGN UI/` into production code.
- Desktop must closely match the supplied reference; tablet and mobile must remain fully usable.
- Navigation paths and the `/home` return action remain unchanged.
- No page-level horizontal overflow; wide tables scroll inside their table surface.
- Status meaning must be conveyed by text in addition to color.
- Use semantic navigation, headings, forms, buttons, dialogs, and tables with visible focus states.
- No new runtime dependencies.

---

## File Structure

- Create `src/features/material-fifo/components/MaterialFifoUi.jsx`: feature-local primitives for page headings, panels, table shells, empty states, status badges, lot chips, fields, and modal framing.
- Modify `src/features/material-fifo/components/MaterialFifoLayout.jsx`: responsive sidebar/drawer and compact reference-style top bar.
- Modify `src/features/material-fifo/pages/DataFifoPage.jsx`: dynamic FIFO table and shared MIN/MAX modal frame.
- Modify `src/features/material-fifo/pages/OverviewPage.jsx`: compact KPI cards and attention table/list.
- Modify `src/features/material-fifo/pages/TransactionsPage.jsx`: responsive transaction history table/cards and allocation details.
- Modify `src/features/material-fifo/pages/ImportPage.jsx`: consistent staged workflow surfaces.
- Modify `src/features/material-fifo/pages/ExportPage.jsx`: consistent export panels and action hierarchy.
- Modify `src/features/material-fifo/pages/ManageSkuPage.jsx`: responsive form styling and alerts.
- Modify `src/features/material-fifo/components/FifoInboundModal.jsx`: shared modal structure and field styling.
- Modify `src/features/material-fifo/components/FifoOutboundModal.jsx`: shared modal structure, preview surface, and field styling.
- Modify `src/features/material-fifo/components/MaterialSearchField.jsx`: shared input/button/dropdown styling.
- Modify `src/features/material-fifo/components/CodeScanner.jsx`: shared modal styling without changing scanner lifecycle.
- Modify `src/index.css`: Material FIFO-scoped font, scrollbar, and utility refinements only when Tailwind utilities cannot express the requirement cleanly.
- Modify `src/test/MaterialFifoRouting.test.jsx`, `src/test/MaterialFifoPages.test.jsx`, `src/test/MaterialFifoImportExport.test.jsx`, `src/test/FifoTransactionModals.test.jsx`, and `src/test/CodeScanner.test.jsx`: regression and accessibility coverage for the redesigned structures.

---

### Task 1: Shared UI Primitives and Responsive Application Shell

**Files:**
- Create: `src/features/material-fifo/components/MaterialFifoUi.jsx`
- Modify: `src/features/material-fifo/components/MaterialFifoLayout.jsx`
- Modify: `src/index.css`
- Test: `src/test/MaterialFifoRouting.test.jsx`

**Interfaces:**
- Consumes: existing `context`, `openInbound`, `openOutbound`, and `lastRefresh` props on `MaterialFifoLayout`.
- Produces: named exports `PageHeader`, `Panel`, `TableShell`, `EmptyState`, `StatusBadge`, `LotChip`, `FieldLabel`, and `ModalFrame` from `MaterialFifoUi.jsx`.
- Produces: unchanged `MaterialFifoLayout` default export and unchanged route paths.

- [ ] **Step 1: Write failing shell accessibility and structure tests**

Add assertions to `MaterialFifoRouting.test.jsx` that render the layout, verify the application shell marker, active navigation, online status text, both transaction actions, and drawer controls:

```jsx
const renderFifoLayout = () => render(
  <MemoryRouter initialEntries={['/material-fifo/data']}>
    <Routes>
      <Route path="/material-fifo/*" element={<MaterialFifoLayout context={{}} openInbound={vi.fn()} openOutbound={vi.fn()} lastRefresh={new Date('2026-08-13T14:43:57')} />}>
        <Route path="data" element={<p>Data content</p>} />
      </Route>
    </Routes>
  </MemoryRouter>,
);

it('renders the redesigned FIFO shell with accessible global actions', () => {
  renderFifoLayout();
  expect(screen.getByTestId('material-fifo-shell')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Data FIFO' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('button', { name: /Barang Masuk/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Barang Keluar/i })).toBeInTheDocument();
  expect(screen.getByText(/Online.*Diperbarui/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Buka menu' })).toHaveAttribute('aria-expanded', 'false');
});

it('opens and closes the responsive navigation drawer', () => {
  renderFifoLayout();
  fireEvent.click(screen.getByRole('button', { name: 'Buka menu' }));
  expect(screen.getByRole('dialog', { name: 'Navigasi Material FIFO' })).toBeInTheDocument();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('dialog', { name: 'Navigasi Material FIFO' })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the routing tests and confirm the new assertions fail**

Run: `npm test -- --run src/test/MaterialFifoRouting.test.jsx`

Expected: FAIL because `material-fifo-shell`, the dialog semantics, and `aria-expanded` are not present.

- [ ] **Step 3: Add reusable presentation primitives**

Create `MaterialFifoUi.jsx` with feature-local, prop-driven components. Keep the interface small and use `children` instead of page-specific knowledge:

```jsx
export const PageHeader = ({ title, description, children }) => (
  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
    <div>
      <h2 className="text-xl font-bold tracking-tight text-slate-950">{title}</h2>
      <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">{description}</p>
    </div>
    {children && <div className="flex flex-col gap-2 sm:flex-row sm:items-center">{children}</div>}
  </div>
);

export const Panel = ({ children, className = '' }) => (
  <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>
);

export const TableShell = ({ children, minWidth, label }) => (
  <div data-testid="table-scroll" aria-label={label} className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
    <table className="w-full border-collapse text-xs" style={minWidth ? { minWidth } : undefined}>{children}</table>
  </div>
);

export const EmptyState = ({ children, colSpan }) => colSpan
  ? <tr><td colSpan={colSpan} className="px-4 py-16 text-center text-sm text-slate-400">{children}</td></tr>
  : <div className="px-4 py-12 text-center text-sm text-slate-400">{children}</div>;

const statusPresentation = {
  NORMAL: ['Normal', 'bg-emerald-50 text-emerald-700'],
  CRITICAL: ['Kritis', 'bg-red-50 text-red-700'],
  OVER: ['Over', 'bg-violet-50 text-violet-700'],
  NOT_CONFIGURED: ['Belum diset', 'bg-slate-100 text-slate-600'],
  IN: ['Masuk', 'bg-blue-50 text-blue-700'],
  OUT: ['Keluar', 'bg-orange-50 text-orange-700'],
};

export const StatusBadge = ({ status }) => {
  const [label, styles] = statusPresentation[status] ?? [status, 'bg-slate-100 text-slate-600'];
  return <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${styles}`}>{label}</span>;
};

export const LotChip = ({ lot, uom }) => (
  <span data-testid="lot-chip" className="inline-flex whitespace-nowrap rounded-md border border-indigo-100 bg-indigo-50 px-2 py-1 font-mono text-[10px] text-indigo-700">
    {lot.location} · {Number(lot.remaining_qty).toLocaleString('id-ID')} {uom} · {lot.received_date}
  </span>
);

export const FieldLabel = ({ label, children, className = '' }) => (
  <label className={`block text-xs font-medium text-slate-700 ${className}`}>
    {label}{children}
  </label>
);

export const ModalFrame = ({ title, description, onClose, children, footer }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
    <section role="dialog" aria-modal="true" aria-label={title} className="flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
      <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
        <div><h2 className="font-bold text-slate-950">{title}</h2><p className="text-xs text-slate-500">{description}</p></div>
        <button type="button" aria-label={`Tutup ${title}`} onClick={onClose}>×</button>
      </header>
      <div className="overflow-y-auto p-5">{children}</div>
      {footer && <footer className="border-t border-slate-200 px-5 py-4">{footer}</footer>}
    </section>
  </div>
);
```

Use the shown interfaces for `StatusBadge`, `LotChip`, `FieldLabel`, and `ModalFrame`. Replace the text close glyph with the existing Lucide `X` icon while retaining the generated accessible name. Do not put API or routing calls in this file.

- [ ] **Step 4: Rebuild `MaterialFifoLayout` around the reference shell**

Use a 205-pixel desktop sidebar (`lg:w-[205px]`, `lg:pl-[205px]`), compact header, blue grid module icon, active `NavLink` state, green/gray online dot, and reference action colors. Add `data-testid="material-fifo-shell"`, `aria-expanded={open}`, `aria-controls="material-fifo-mobile-nav"`, and mobile drawer dialog semantics. Keep `/material-fifo/...` destinations and `/home` unchanged.

Add only scoped CSS to `src/index.css`:

```css
@layer components {
  .material-fifo-shell {
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  .material-fifo-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: #cbd5e1 transparent;
  }
}
```

- [ ] **Step 5: Run routing tests and build**

Run: `npm test -- --run src/test/MaterialFifoRouting.test.jsx`

Expected: PASS.

Run: `npm run build`

Expected: Vite build completes without JSX, CSS, or import errors.

- [ ] **Step 6: Commit the shell and primitives**

```bash
git add src/features/material-fifo/components/MaterialFifoUi.jsx src/features/material-fifo/components/MaterialFifoLayout.jsx src/index.css src/test/MaterialFifoRouting.test.jsx
git commit -m "feat: redesign material fifo shell"
```

---

### Task 2: Data FIFO Responsive Table and Settings Modal

**Files:**
- Modify: `src/features/material-fifo/pages/DataFifoPage.jsx`
- Test: `src/test/MaterialFifoPages.test.jsx`

**Interfaces:**
- Consumes: `PageHeader`, `TableShell`, `EmptyState`, `LotChip`, `FieldLabel`, and `ModalFrame` from Task 1.
- Consumes: existing `materials`, `lotsByItem`, and `refresh` props or outlet values.
- Produces: unchanged `DataFifoPage` default export and unchanged `upsertFifoSettings` payload.

- [ ] **Step 1: Write failing tests for the reference table structure**

Extend `MaterialFifoPages.test.jsx`:

```jsx
it('renders Data FIFO as a dynamic semantic FIFO table', () => {
  render(<MemoryRouter><DataFifoPage materials={materials} lotsByItem={lotsByItem} /></MemoryRouter>);
  expect(screen.getByRole('table', { name: 'Data FIFO material' })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'SKU' })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'FIFO 1' })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'FIFO 2' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Atur MIN/MAX RM-01' })).toBeInTheDocument();
  expect(screen.getAllByTestId('lot-chip')[0]).toHaveTextContent('A1.1');
});

it('shows one table empty state after filtering', () => {
  render(<MemoryRouter><DataFifoPage materials={materials} lotsByItem={lotsByItem} /></MemoryRouter>);
  fireEvent.change(screen.getByPlaceholderText(/Cari SKU/i), { target: { value: 'tidak-ada' } });
  expect(screen.getByText('Tidak ada item ditemukan')).toBeInTheDocument();
});
```

Ensure the fixture includes both `item_code` and at least two lots for one item so product-code and dynamic-column rendering are exercised.

- [ ] **Step 2: Run the focused Data FIFO tests and confirm failure**

Run: `npm test -- --run src/test/MaterialFifoPages.test.jsx -t "Data FIFO|searches internal code|validates and saves"`

Expected: FAIL because the current page renders cards instead of a labelled table.

- [ ] **Step 3: Replace card rendering with the responsive table**

In `DataFifoPage.jsx`, retain `validSetting`, filtering, `upsertFifoSettings`, and oldest-first sorting. Derive dynamic columns with a minimum of two:

```jsx
const rows = filtered.map((item) => ({
  item,
  lots: [...(lotsByItem[item.item_id] ?? [])].sort((a, b) =>
    `${a.received_date}|${a.created_at ?? ''}|${a.id}`.localeCompare(`${b.received_date}|${b.created_at ?? ''}|${b.id}`),
  ),
}));
const fifoColumnCount = Math.max(2, ...rows.map(({ lots }) => lots.length));
```

Render `PageHeader` with right-aligned search and status controls, then a `TableShell` labelled `Data FIFO material`. Use columns SKU, Product Code, Nama Item, MIN, MAX, Stock, Aksi, and FIFO 1..N. Use `item.item_code || item.internal_product_code || '—'` for product code, `item.fifo_status` for status color, `LotChip` for each existing lot, and a muted em dash for missing lots. Keep the existing accessible MIN/MAX action for every row.

- [ ] **Step 4: Move SettingsModal to the shared modal frame**

Preserve validation and submit behavior exactly. Use `ModalFrame` with title `Atur MIN/MAX`, description containing SKU and item name, cancel button, and submit button. Keep input labels `MIN`, `MAX`, and `Catatan MIN/MAX` unchanged so tests and assistive technology remain stable.

- [ ] **Step 5: Run all Material FIFO page tests**

Run: `npm test -- --run src/test/MaterialFifoPages.test.jsx`

Expected: PASS, including search, lot ordering, MIN/MAX validation, Overview, Transactions, and SKU creation tests.

- [ ] **Step 6: Commit Data FIFO redesign**

```bash
git add src/features/material-fifo/pages/DataFifoPage.jsx src/test/MaterialFifoPages.test.jsx
git commit -m "feat: redesign data fifo table"
```

---

### Task 3: Overview and Transaction History Redesign

**Files:**
- Modify: `src/features/material-fifo/pages/OverviewPage.jsx`
- Modify: `src/features/material-fifo/pages/TransactionsPage.jsx`
- Test: `src/test/MaterialFifoPages.test.jsx`

**Interfaces:**
- Consumes: `PageHeader`, `Panel`, `TableShell`, `EmptyState`, and `StatusBadge` from Task 1.
- Consumes: existing materials, lots, transactions, and profiles props/outlet context.
- Produces: unchanged page default exports and unchanged filter/allocation behavior.

- [ ] **Step 1: Write failing semantic-table and empty-state tests**

Add to `MaterialFifoPages.test.jsx`:

```jsx
it('renders Overview attention items with explicit status text', () => {
  render(<OverviewPage materials={materials} lotsByItem={lotsByItem} />);
  expect(screen.getByRole('table', { name: 'Material perlu perhatian' })).toBeInTheDocument();
  expect(screen.getByText('Kritis')).toBeInTheDocument();
  expect(screen.getByText('Over')).toBeInTheDocument();
});

it('renders transaction history in a labelled responsive table', () => {
  render(<MemoryRouter><TransactionsPage transactions={transactions} profiles={profiles} /></MemoryRouter>);
  expect(screen.getByRole('table', { name: 'Riwayat transaksi FIFO' })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'User' })).toBeInTheDocument();
});
```

Reuse the existing transaction and profile fixture by lifting it to the describe scope.

- [ ] **Step 2: Run the two new tests and confirm failure**

Run: `npm test -- --run src/test/MaterialFifoPages.test.jsx -t "explicit status|labelled responsive table"`

Expected: FAIL because the existing pages use generic cards.

- [ ] **Step 3: Redesign Overview using compact shared surfaces**

Keep the six current KPI computations and test IDs. Add a label/color/icon definition per KPI and render compact `Panel` cards in a responsive grid. Render attention items inside `TableShell` labelled `Material perlu perhatian`, with SKU, material, stock, and `StatusBadge`. Use `EmptyState` when the list is empty.

Do not change which statuses are considered attention: only `CRITICAL` and `OVER`.

- [ ] **Step 4: Redesign Transactions with table and mobile-safe allocation rows**

Keep the current memoized filtering and allocation sort. Render `PageHeader`, a compact filter panel, and `TableShell` labelled `Riwayat transaksi FIFO`. Each transaction row shows `StatusBadge`, date, SKU/name, quantity, user, and the existing allocation toggle. Expanded allocation content must be a full-width following row with ordered allocation lines.

Use responsive utility classes to hide lower-priority table columns only if their content is repeated inside the primary material cell; do not remove date, quantity, user, or allocation actions from mobile access.

- [ ] **Step 5: Run the complete Material FIFO page test file**

Run: `npm test -- --run src/test/MaterialFifoPages.test.jsx`

Expected: PASS, including existing filter and allocation-order assertions.

- [ ] **Step 6: Commit Overview and Transactions redesign**

```bash
git add src/features/material-fifo/pages/OverviewPage.jsx src/features/material-fifo/pages/TransactionsPage.jsx src/test/MaterialFifoPages.test.jsx
git commit -m "feat: redesign fifo overview and transactions"
```

---

### Task 4: Import, Export, and SKU Management Redesign

**Files:**
- Modify: `src/features/material-fifo/pages/ImportPage.jsx`
- Modify: `src/features/material-fifo/pages/ExportPage.jsx`
- Modify: `src/features/material-fifo/pages/ManageSkuPage.jsx`
- Test: `src/test/MaterialFifoImportExport.test.jsx`
- Test: `src/test/MaterialFifoPages.test.jsx`

**Interfaces:**
- Consumes: `PageHeader`, `Panel`, `FieldLabel`, `StatusBadge`, and `EmptyState` from Task 1.
- Produces: unchanged import parsing, request/batch identifier reuse, XLSX filenames/content, export filtering, and SKU creation payloads.

- [ ] **Step 1: Add failing workflow-structure tests**

Add stable semantic markers rather than testing Tailwind class strings:

```jsx
it('presents import as configuration, preview, and result stages', async () => {
  const user = userEvent.setup();
  xlsx.rows = [['SKU', 'MIN', 'MAX'], ['RM-01', 2, 5]];
  render(<MemoryRouter><ImportPage materials={materials} refresh={vi.fn().mockResolvedValue()} /></MemoryRouter>);
  expect(screen.getByRole('region', { name: 'Konfigurasi import' })).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText('Jenis import'), 'MINMAX');
  fireEvent.change(screen.getByLabelText('File import'), { target: { files: [new File(['x'], 'minmax.xlsx')] } });
  expect(await screen.findByRole('region', { name: 'Preview import' })).toBeInTheDocument();
});

it('groups stock and transaction exports in labelled regions', () => {
  render(<MemoryRouter><ExportPage materials={materials} lotsByItem={{}} transactions={[]} profiles={{}} /></MemoryRouter>);
  expect(screen.getByRole('region', { name: 'Stok Material FIFO' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Histori Transaksi' })).toBeInTheDocument();
});
```

Add to `MaterialFifoPages.test.jsx`:

```jsx
expect(screen.getByRole('form', { name: 'Tambah SKU Raw Material' })).toBeInTheDocument();
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npm test -- --run src/test/MaterialFifoImportExport.test.jsx src/test/MaterialFifoPages.test.jsx -t "configuration|labelled regions|complete SKU"`

Expected: FAIL because the current surfaces are not labelled regions/forms.

- [ ] **Step 3: Restyle Import without changing processing behavior**

Wrap configuration, preview, and results in labelled `Panel` regions. Keep `kind`, file input accept values, XLSX parsing, `importIdentity`, sequential `for...of` processing, partial results, and button accessible names unchanged. Present preview rows in a bordered table/list with explicit `Valid` or failure-reason text.

- [ ] **Step 4: Restyle Export without changing workbook output**

Use `PageHeader` and two labelled `Panel` regions. Keep `saveRows`, `toStockExportRows`, `toTransactionExportRows`, filter behavior, button labels, sheet names, and filenames unchanged.

- [ ] **Step 5: Restyle Kelola SKU as a labelled responsive form**

Add `aria-label="Tambah SKU Raw Material"` to the form, use the shared heading and field treatments, preserve the five required fields, normalization, duplicate-identifier message, refresh, reset, and success copy. Do not add a category field.

- [ ] **Step 6: Run import/export and page tests**

Run: `npm test -- --run src/test/MaterialFifoImportExport.test.jsx src/test/MaterialFifoPages.test.jsx`

Expected: PASS with existing request-ID, partial-result, workbook, validation, and creation assertions unchanged.

- [ ] **Step 7: Commit workflow-page redesign**

```bash
git add src/features/material-fifo/pages/ImportPage.jsx src/features/material-fifo/pages/ExportPage.jsx src/features/material-fifo/pages/ManageSkuPage.jsx src/test/MaterialFifoImportExport.test.jsx src/test/MaterialFifoPages.test.jsx
git commit -m "feat: redesign fifo workflow pages"
```

---

### Task 5: Transaction, Search, and Scanner Modal Redesign

**Files:**
- Modify: `src/features/material-fifo/components/FifoInboundModal.jsx`
- Modify: `src/features/material-fifo/components/FifoOutboundModal.jsx`
- Modify: `src/features/material-fifo/components/MaterialSearchField.jsx`
- Modify: `src/features/material-fifo/components/CodeScanner.jsx`
- Test: `src/test/FifoTransactionModals.test.jsx`
- Test: `src/test/CodeScanner.test.jsx`

**Interfaces:**
- Consumes: `ModalFrame`, `FieldLabel`, `Panel`, and `StatusBadge` from Task 1.
- Produces: unchanged component props, scanner callbacks, API payloads, debounce timing, and cleanup behavior.

- [ ] **Step 1: Write failing dialog and responsive-frame assertions**

Add to `FifoTransactionModals.test.jsx`:

```jsx
it('exposes inbound and outbound forms as labelled modal dialogs', () => {
  const { unmount } = render(<FifoInboundModal materials={materials} lotsByItem={{}} onClose={vi.fn()} refresh={vi.fn()} />);
  expect(screen.getByRole('dialog', { name: 'Barang Masuk FIFO' })).toHaveAttribute('aria-modal', 'true');
  unmount();
  render(<FifoOutboundModal materials={materials} lotsByItem={{}} onClose={vi.fn()} refresh={vi.fn()} />);
  expect(screen.getByRole('dialog', { name: 'Barang Keluar FIFO' })).toHaveAttribute('aria-modal', 'true');
});
```

Add to `CodeScanner.test.jsx`:

```jsx
expect(screen.getByRole('dialog', { name: 'Scanner QR dan barcode' })).toHaveAttribute('aria-modal', 'true');
expect(screen.getByRole('button', { name: 'Tutup scanner' })).toBeInTheDocument();
```

- [ ] **Step 2: Run modal tests and confirm the transaction-dialog test fails**

Run: `npm test -- --run src/test/FifoTransactionModals.test.jsx src/test/CodeScanner.test.jsx`

Expected: FAIL for transaction modal dialog semantics; existing scanner behavior remains green.

- [ ] **Step 3: Move inbound and outbound modals onto `ModalFrame`**

Use shared modal header/body/footer slots, compact two-column fields above the small breakpoint, `max-h-[calc(100dvh-2rem)]`, and an overflow-y-auto body. Preserve every validation message, `navigator.onLine` check, request ID, API argument, preview debounce, allocation rendering, refresh, and close behavior.

Inbound footer contains cancel/close and blue submit actions. Outbound footer contains preview and orange confirmation actions; confirmation stays disabled until `preview` exists.

- [ ] **Step 4: Restyle MaterialSearchField and CodeScanner**

Keep Raw Material filtering, eight-result cap, camera lifecycle, native `BarcodeDetector`, ZXing fallback, handheld wedge buffer, and manual input behavior unchanged. Apply consistent focus rings, compact dropdown rows, icon-button labels, viewport-safe scanner modal dimensions, and responsive manual-input layout.

- [ ] **Step 5: Run all modal and scanner tests**

Run: `npm test -- --run src/test/FifoTransactionModals.test.jsx src/test/CodeScanner.test.jsx`

Expected: PASS, including API calls, debounce, native/fallback scanning, manual input, cleanup, and new dialog assertions.

- [ ] **Step 6: Commit modal redesign**

```bash
git add src/features/material-fifo/components/FifoInboundModal.jsx src/features/material-fifo/components/FifoOutboundModal.jsx src/features/material-fifo/components/MaterialSearchField.jsx src/features/material-fifo/components/CodeScanner.jsx src/test/FifoTransactionModals.test.jsx src/test/CodeScanner.test.jsx
git commit -m "feat: redesign fifo transaction modals"
```

---

### Task 6: Full Regression, Production Build, and Visual Verification

**Files:**
- Modify only files from Tasks 1–5 if verification reveals a concrete defect.
- Test: all files under `src/test/`.

**Interfaces:**
- Consumes: completed redesigned Material FIFO module.
- Produces: verified responsive implementation with no known functional or visual regressions.

- [ ] **Step 1: Run the focused Material FIFO regression suite**

Run:

```bash
npm test -- --run src/test/MaterialFifoRouting.test.jsx src/test/MaterialFifoPages.test.jsx src/test/MaterialFifoImportExport.test.jsx src/test/FifoTransactionModals.test.jsx src/test/CodeScanner.test.jsx
```

Expected: all focused tests PASS.

- [ ] **Step 2: Run the complete test suite**

Run: `npm test -- --run`

Expected: all tests PASS with zero unhandled errors.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: Vite build succeeds and emits production assets to `dist/`.

- [ ] **Step 4: Inspect the desktop reference viewport**

Run the application with its existing development command and inspect `/material-fifo/data` at approximately 1536×781. Confirm:

- Sidebar, top bar, content padding, controls, table density, row striping, status dots, and FIFO chips visually follow the supplied screenshot.
- Data is sourced from the application, not the prototype fixture.
- The table scroll container—not the page—owns horizontal overflow.
- MIN/MAX actions and both transaction buttons open their respective modals.

- [ ] **Step 5: Inspect tablet and mobile viewports**

Inspect approximately 768×1024 and 390×844. Confirm:

- Sidebar becomes a drawer and closes by button, backdrop, route selection, and Escape.
- Header actions remain reachable and do not overlap.
- Search/filter controls stack cleanly.
- Every table is usable by horizontal scroll or its intended mobile presentation.
- Modal headers, bodies, alerts, and footer actions fit inside the viewport.
- No Material FIFO route causes page-level horizontal overflow.

- [ ] **Step 6: Fix only verified defects and rerun the affected test plus build**

For each concrete defect, first add or adjust the narrowest regression assertion, observe it fail, then make the smallest implementation correction. Rerun the affected test file followed by `npm run build`.

- [ ] **Step 7: Commit verification fixes if any files changed**

```bash
git add src/features/material-fifo src/test src/index.css
git commit -m "fix: polish responsive material fifo UI"
```

If verification produces no file changes, do not create an empty commit.
