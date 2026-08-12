# Material FIFO Supabase Setup

1. Back up the Supabase project.
2. Run `database/material_fifo_migration.sql` in the Supabase SQL Editor. The migration is idempotent.
3. Confirm the canonical `Raw Material` category and the four `material_fifo_*` tables exist.
4. Confirm authenticated active users can query `material_fifo_stock_view` but cannot insert or update lot/history tables directly.
5. For a disposable test database, set `TEST_DATABASE_URL` and run:

```powershell
psql $env:TEST_DATABASE_URL -v ON_ERROR_STOP=1 -f database/material_fifo_migration.sql
psql $env:TEST_DATABASE_URL -v ON_ERROR_STOP=1 -f database/material_fifo_regression_tests.sql
```

The regression script always opens a transaction and ends with `ROLLBACK`. Do not copy partial fixture statements into production.

The frontend needs only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Never place a service-role key in the browser environment.
