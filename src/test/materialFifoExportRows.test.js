import { describe, expect, it } from 'vitest';
import { toStockExportRows, toTransactionExportRows } from '../features/material-fifo/lib/exportRows';

describe('FIFO export mapping', () => {
  it('maps stock and remaining lots', () => {
    const rows = toStockExportRows([{
      sku: 'RM-01', item_name: 'Resin', uom: 'KG', stock_qty: '3.5000',
      lots: [{ location: 'A1.1', remaining_qty: '3.5000', received_date: '2026-08-01' }],
    }]);
    expect(rows[0]).toMatchObject({ SKU: 'RM-01', Stock: 3.5 });
    expect(rows[0].Lots).toContain('A1.1 | 3.5000 KG | 01/08/2026');
  });

  it('maps allocation and audit details', () => {
    const rows = toTransactionExportRows([{
      id: 'tx-1', request_id: 'req-1', transaction_type: 'OUT', quantity: '2.0000',
      stock_before: '5.0000', stock_after: '3.0000', created_by_name: 'Faizal',
      allocations: [{ quantity: '2.0000', lot: { location: 'A1.1', received_date: '2026-08-01' } }],
    }]);
    expect(rows[0]['Request ID']).toBe('req-1');
    expect(rows[0].User).toBe('Faizal');
    expect(rows[0].Allocations).toContain('A1.1');
  });
});
