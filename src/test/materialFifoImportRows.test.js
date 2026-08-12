import { describe, expect, it } from 'vitest';
import { parseMinMaxRows, parseOutboundRows } from '../features/material-fifo/lib/importRows';

const items = [
  { id: '1', sku: 'RM-01', category: 'Raw Material', uom: 'KG', stock_qty: '10.0000' },
  { id: '2', sku: 'FG-01', category: 'Finished Goods', uom: 'PCS', stock_qty: '8.0000' },
];

describe('parseMinMaxRows', () => {
  it('validates known Raw Material rows and reports source row numbers', () => {
    const result = parseMinMaxRows([
      ['SKU', 'MIN', 'MAX'],
      ['RM-01', 5, 10],
      ['MISSING', 1, 2],
      ['RM-01', 3, 7],
      ['FG-01', 1, 2],
    ], items);

    expect(result.rows[0]).toMatchObject({ rowNumber: 2, valid: true, min: 5, max: 10 });
    expect(result.rows[1]).toMatchObject({ rowNumber: 3, valid: false, code: 'UNKNOWN_SKU' });
    expect(result.rows[2]).toMatchObject({ rowNumber: 4, valid: false, code: 'DUPLICATE_SKU' });
    expect(result.rows[3]).toMatchObject({ rowNumber: 5, valid: false, code: 'NOT_RAW_MATERIAL' });
  });

  it('rejects invalid ranges and missing headers', () => {
    expect(parseMinMaxRows([['SKU', 'MIN'], ['RM-01', 2]], items).rows[0].code).toBe('MISSING_HEADERS');
    expect(parseMinMaxRows([['SKU', 'MIN', 'MAX'], ['RM-01', 9, 2]], items).rows[0].code).toBe('MIN_GREATER_THAN_MAX');
  });
});

describe('parseOutboundRows', () => {
  it('accepts aliases and optional manual location', () => {
    const row = parseOutboundRows([
      ['SKU#', 'QTY KELUAR', 'LOCATION'],
      ['RM-01', 3.5, 'A1.1'],
    ], items).rows[0];
    expect(row).toMatchObject({ valid: true, quantity: 3.5, location: 'A1.1' });
  });

  it('rejects quantities above stock', () => {
    const row = parseOutboundRows([['SKU', 'QTY'], ['RM-01', 11]], items).rows[0];
    expect(row).toMatchObject({ valid: false, code: 'INSUFFICIENT_STOCK' });
  });
});
