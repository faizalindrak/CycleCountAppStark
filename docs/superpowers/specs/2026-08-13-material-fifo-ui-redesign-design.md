# Material FIFO UI Redesign Design

**Date:** 2026-08-13  
**Status:** Approved for planning  
**Scope:** All Material FIFO routes under `/material-fifo/*`

## Objective

Redesign the complete Material FIFO module to match the visual reference in `integrate/REDESAIGN UI/` while preserving the production application's existing Supabase data flow, routing, transactions, scanner, validation, import/export behavior, and access rules.

The result must closely match the reference on desktop and remain practical on tablet and mobile. This is a presentation and component-structure change, not a rewrite of the Material FIFO business logic.

## Chosen Approach

Use a shared Material FIFO design system and rebuild each Material FIFO page with reusable presentation components.

This approach is preferred over applying isolated CSS changes because it gives every page the same spacing, typography, controls, table treatment, status language, empty states, and responsive behavior. A full feature refactor is intentionally excluded because the existing data and API boundaries already work and changing them would add regression risk without improving the requested visual result.

## Visual Direction

The reference establishes the following visual language:

- White fixed desktop sidebar with a compact blue module mark and six navigation links.
- White top bar separated by a thin border, with module status at the left and primary inbound/outbound actions at the right.
- Very light cool-gray content background.
- Compact Inter-like typography with dark navy headings, muted supporting text, blue primary actions, and orange outbound actions.
- White content surfaces with subtle gray borders, modest corner radii, and minimal shadows.
- Dense but readable tables, small uppercase column labels, alternating row backgrounds, and soft blue or indigo lot chips.
- Status conveyed through text color, badges, and small colored indicators rather than large decorative elements.

Existing global application styling outside `/material-fifo/*` will not be redesigned.

## Layout and Responsive Behavior

### Desktop

- Sidebar width is approximately 205 pixels, matching the reference proportions.
- The sidebar and top bar remain visible while the page content scrolls.
- The top bar contains the title, online/last-refresh status, and Barang Masuk/Barang Keluar buttons.
- Main content uses compact horizontal padding and maximizes useful table width.
- Page headings and controls share one horizontal row when space permits.

### Tablet

- The sidebar may remain visible at larger tablet widths and switches to a drawer below the chosen desktop breakpoint.
- Toolbars wrap without overlapping or truncating interactive controls.
- Wide tables use horizontal scrolling inside their own bordered surface.

### Mobile

- Navigation is shown in an accessible drawer opened from the top bar and closed by its close button, backdrop, navigation selection, or Escape.
- Header content may use two rows; inbound/outbound actions remain immediately reachable.
- Search, filters, date fields, and page actions stack to full or near-full width.
- Tables retain their semantic table structure and scroll horizontally. Where a table would make a workflow materially difficult, the page may use compact responsive cards while preserving the same information and actions.
- Tap targets remain large enough for touch use, and no action depends on hover.

## Shared Component Boundaries

The redesign should introduce small presentational components within the Material FIFO feature rather than one monolithic page component:

- `MaterialFifoLayout`: owns desktop sidebar, mobile drawer, top bar, global transaction buttons, and the outlet boundary.
- Page heading component: standardizes title, description, and optional actions or controls.
- Toolbar/surface component: standardizes search, select, date, and action-control grouping.
- Status badge/indicator component: maps existing FIFO statuses and transaction types to consistent labels and colors.
- Empty-state component: provides a consistent no-results presentation.
- Table surface and reusable table styles: standardize headers, row density, scrolling, and responsive boundaries.
- Lot chip component: displays FIFO location, remaining quantity, and received date consistently.
- Form and modal primitives: standardize labels, inputs, validation messages, footers, disabled states, and close behavior.

These components depend only on props and existing routing context. Supabase calls and domain operations remain in their existing API, hook, modal, and page layers.

## Page Designs

### Overview

- Retain all six KPI values: total material, normal, critical, over, without lots, and MIN/MAX not configured.
- Present KPIs as compact bordered cards using the shared status colors.
- Present the attention list as a responsive table or compact list surface with SKU, material name, current stock, and status.
- Preserve the existing empty message when no material needs attention.

### Data FIFO

- Match the reference table most closely because this is the primary reference screen.
- Place the title and description on the left and search/status filters on the right at desktop widths.
- Use columns for SKU, product code, material name, MIN, MAX, stock, and dynamic FIFO lot columns.
- Sort lots oldest first using the existing received-date ordering.
- Render each lot as a compact chip containing location, remaining quantity, and received date.
- Keep MIN/MAX editing available through an explicit per-row action. The action may be a small button or compact action menu, but it must have an accessible name containing the SKU.
- Stock values use the existing `fifo_status` as the source of truth for visual status. Missing values display a muted em dash.
- An empty filtered result renders one full-width table message.

### Transactions

- Keep type, date range, and free-text filters.
- Present history in a responsive table on desktop with transaction type, date, material, quantity, user, and allocation action.
- Preserve immutable-history wording and do not add edit or delete actions.
- FIFO allocation details remain expandable and ordered oldest first.
- On narrow screens, rows may become cards if that is clearer than a very wide transaction table.

### Import

- Keep import type selection, template download, file selection, preview, processing progress, and per-row results.
- Organize the workflow into compact bordered surfaces with a clear progression: configuration, preview, then result.
- Valid and invalid rows receive distinct accessible text and color treatment.
- Processing and disabled states remain explicit.

### Export

- Keep stock filtering, export-all, export-filtered, and transaction-history export.
- Present stock and transaction export options as two consistent bordered panels.
- Buttons use the shared primary and secondary styles while preserving current filenames and workbook content.

### Kelola SKU

- Keep the existing complete Raw Material form and its validation behavior.
- Use a compact responsive form grid, consistent label/input styling, clear error/success alerts, and a single primary submit action.
- Category remains fixed by the underlying feature and is not exposed as an editable field.

### Transaction and Settings Modals

- Preserve the inbound/outbound workflows, scanner integration, FIFO/manual allocation choices, validations, request identifiers, and refresh behavior.
- Restyle both transaction modals and the MIN/MAX settings modal to use one modal structure: overlay, header, scrollable body, validation region, and footer actions.
- Mobile modals use the available viewport safely and keep primary actions reachable without content overflow.
- Modal focus behavior, labels, keyboard interaction, and close controls must remain accessible.

## Data Flow and Behavior Preservation

`useMaterialFifoData` remains the source of materials, lots, transactions, profiles, loading state, errors, refresh function, and last refresh time. `MaterialFifoPage` continues to pass this data through the layout outlet context and to open the inbound/outbound modals.

Pages continue to derive filtered or sorted views locally. The redesign must not introduce duplicate production data, replace Supabase data with the prototype's static sample data, or change transaction semantics. Existing API functions remain responsible for writes and validations.

Navigation paths remain:

- `/material-fifo/overview`
- `/material-fifo/data`
- `/material-fifo/transactions`
- `/material-fifo/import`
- `/material-fifo/export`
- `/material-fifo/sku`

The Kembali ke Home action continues to navigate to `/home`.

## Error, Loading, and Empty States

- Initial feature loading continues to use the application's loading screen.
- Refresh or operation errors are shown near the relevant page or modal action without discarding already loaded data.
- Buttons show disabled or busy states while an operation is running.
- Search and filter results use a consistent empty-state presentation.
- Offline status is visible in the top bar; online-only operations continue to rely on existing API safeguards and errors.
- Text remains the primary carrier of meaning; color is supplemental.

## Accessibility

- Preserve semantic navigation, buttons, forms, labels, headings, and tables.
- Mobile drawer and modal controls have explicit accessible names.
- Current route is visually distinct and exposed through the existing `NavLink` behavior.
- Focus indicators remain visible on all interactive elements.
- Status colors meet practical contrast targets, and status meaning is also written as text or available through an accessible label.
- Horizontal table scrolling is contained within the table surface rather than causing full-page overflow.

## Testing and Verification

Implementation will use the existing Vitest and React Testing Library suite as the regression baseline.

Tests should cover:

- Existing routing between all Material FIFO pages.
- Search, status filtering, oldest-first lot ordering, and MIN/MAX editing in Data FIFO.
- Overview KPI and attention states.
- Transaction filtering and allocation expansion.
- Import preview/process states and export actions.
- SKU form validation and creation behavior.
- Accessible mobile drawer controls and shared status rendering where new component behavior warrants coverage.

Verification must include:

1. Run focused Material FIFO tests during development.
2. Run the complete test suite.
3. Run the production build.
4. Inspect the rendered module against the supplied reference at a desktop viewport.
5. Inspect representative tablet and mobile viewports for drawer behavior, wrapping, touch usability, modal overflow, and table scrolling.

## Non-Goals

- No changes to the database schema, Supabase policies, RPC functions, or transaction allocation rules.
- No redesign of non-Material-FIFO application pages.
- No replacement of real data with the static prototype data.
- No new inventory features, permissions, import formats, or export formats.
- No broad refactor of authentication, global routing, or unrelated shared components.

## Acceptance Criteria

- All six Material FIFO pages and related modals share the reference visual language.
- The Data FIFO desktop view closely matches the supplied screenshot in structure, density, color, and hierarchy.
- The module remains usable at desktop, tablet, and mobile widths with no page-level horizontal overflow.
- All currently supported Material FIFO workflows remain available and preserve their existing business behavior.
- Existing and added tests pass, the production build succeeds, and visual inspection finds no major layout regressions.
