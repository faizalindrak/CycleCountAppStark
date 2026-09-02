# Report Backlog, Material FIFO, and Admin UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with verification checkpoints.

**Goal:** Refresh the visual experience of Report Backlog, Material FIFO, and Admin pages with a cohesive white-blue WMS style while preserving every existing data flow and user action.

**Architecture:** Reuse existing React components and Tailwind classes. Add a small set of scoped CSS tokens for shared surfaces, background pattern, motion, and focus states; update page shells and common FIFO primitives first, then the admin shell. No Supabase/API, routing, state, role guard, modal, or CRUD logic changes.

**Tech Stack:** React 18, React Router, Tailwind CSS, lucide-react, Vitest + Testing Library.

**Spec:** User-approved redesign proposal in the conversation.

## Global Constraints

- Visual-only changes; existing functions, queries, routes, permissions, and form behavior must remain unchanged.
- Keep responsive behavior and keyboard accessibility.
- Do not push or deploy in this task.
- Preserve unrelated working-tree changes.

---

### Task 1: Add visual regression hooks (RED)

**Files:**
- Create: `src/test/UiRedesign.test.jsx`

- [ ] **Step 1: Write failing tests** asserting each page exposes a stable visual shell hook (`data-testid` and shared class) while retaining key labels/actions.
- [ ] **Step 2: Run the focused test** with `npm test -- --run src/test/UiRedesign.test.jsx` and confirm it fails because the hooks do not exist.

### Task 2: Shared visual language and Report Backlog

**Files:**
- Modify: `src/index.css`
- Modify: `src/components/BacklogReport.jsx`

- [ ] **Step 1: Add scoped WMS utility classes** for patterned backgrounds, elevated cards, hover lift, and accessible focus.
- [ ] **Step 2: Update BacklogReport shell/header/forms/KPI/table classes** to use the shared white-blue surfaces and subtle motion without changing handlers or data rendering.
- [ ] **Step 3: Run the focused redesign test and confirm it passes.**

### Task 3: Material FIFO visual system

**Files:**
- Modify: `src/features/material-fifo/components/MaterialFifoLayout.jsx`
- Modify: `src/features/material-fifo/components/MaterialFifoUi.jsx`
- Modify: `src/features/material-fifo/pages/OverviewPage.jsx`
- Modify: `src/features/material-fifo/pages/DataFifoPage.jsx`
- Modify: `src/features/material-fifo/pages/TransactionsPage.jsx`
- Modify: `src/features/material-fifo/pages/ImportPage.jsx`
- Modify: `src/features/material-fifo/pages/ExportPage.jsx`
- Modify: `src/features/material-fifo/pages/ManageSkuPage.jsx`

- [ ] **Step 1: Restyle the FIFO shell and shared primitives** (sidebar, header, PageHeader, Panel, TableShell, status cards) using the new visual tokens.
- [ ] **Step 2: Restyle page-level sections and controls** while preserving scan, inbound/outbound, import/export, popup, and MIN/MAX interactions.
- [ ] **Step 3: Run FIFO routing/pages tests and the focused redesign test.**

### Task 4: Admin workspace shell

**Files:**
- Modify: `src/components/AdminDashboard.jsx`

- [ ] **Step 1: Restyle the admin root, header, tab navigation, loading/error surfaces, and main content frame** with scoped admin classes.
- [ ] **Step 2: Add lightweight hover/focus transitions to existing manager surfaces** without changing manager logic or modal contents.
- [ ] **Step 3: Run the focused redesign test and existing admin-related tests.**

### Task 5: Full verification

- [ ] **Step 1: Run the complete test suite with `npm test -- --run`.**
- [ ] **Step 2: Run `npm run build`.**
- [ ] **Step 3: Inspect the diff to confirm only intended visual/test/plan files changed and report the local preview URL; do not push or deploy.**
