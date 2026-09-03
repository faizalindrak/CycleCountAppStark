import { describe, expect, it } from 'vitest';
import { parseMigrationSheet, parseNumberFlexible, parseLotString, parseTanggalToIso } from '../features/material-fifo/lib/parseMigrationSheet';

describe('parseNumberFlexible', () => {
  it('handles Indonesian format with thousand dot and decimal comma', () => {
    expect(parseNumberFlexible('1.000')).toBe(1000);
    expect(parseNumberFlexible('6,5')).toBe(6.5);
    expect(parseNumberFlexible('90,8')).toBe(90.8);
    expect(parseNumberFlexible('140,14')).toBe(140.14);
    expect(parseNumberFlexible('333,7')).toBe(333.7);
    expect(parseNumberFlexible('1.234,56')).toBe(1234.56);
    expect(parseNumberFlexible('450 KG')).toBe(450);
  });
});

describe('parseLotString', () => {
  it('parses single and multiple lots from old dashboard export', () => {
    const r1 = parseLotString('B6.7 (450, 24/03/2026)');
    expect(r1).toEqual([{ loc: 'B6.7', qty: 450, tanggal: '2026-03-24' }]);

    const r2 = parseLotString('B5.11 (6,5, 11/01/2026)');
    expect(r2).toEqual([{ loc: 'B5.11', qty: 6.5, tanggal: '2026-01-11' }]);

    const r3 = parseLotString('D3.1 (75, 10/08/2026) | F7.7 (1.000, 25/08/2026)');
    expect(r3).toEqual([
      { loc: 'D3.1', qty: 75, tanggal: '2026-08-10' },
      { loc: 'F7.7', qty: 1000, tanggal: '2026-08-25' },
    ]);

    const rEmpty = parseLotString('-');
    expect(rEmpty).toEqual([]);
  });
});

describe('parseMigrationSheet with stock_material file format', () => {
  const rows = [
    ['SKU', 'Product Code', 'Nama Material', 'MIN', 'MAX', 'STOCK', 'UOM', 'Status', 'Lokasi FIFO (Lokasi, Qty, Tanggal)'],
    ['000002', 'LOMPOM-MDRC1BB', 'POM DUR M90-44 PLT9B529 2018', 250, 750, '450 KG', 'KG', 'OK', 'B6.7 (450, 24/03/2026)'],
    ['000004', 'LOMSTB-MPLM300', 'COOLMASTER ORANGE 2233', 3, 8, '6.5 KG', 'KG', 'OK', 'B5.11 (6,5, 11/01/2026)'],
    ['000010', 'LOPLPP-MCSP1BBK0', 'PP AZ564GL 201B', 1000, 1700, '1075 KG', 'KG', 'OK', 'D3.1 (75, 10/08/2026) | F7.7 (1.000, 25/08/2026)'],
    ['000318', 'LOMSTB-MPLMJPBK', 'MB PLAMASTER JP 112 BLACK', 0, 0, '0 KG', 'KG', 'OK', '-'],
  ];

  it('correctly parses all items and lots from exported excel file', () => {
    const result = parseMigrationSheet(rows, []);
    expect(result.missingHeaders).toHaveLength(0);
    expect(result.items).toHaveLength(4);
    expect(result.validItems).toHaveLength(4);

    // Item 1
    expect(result.items[0]).toMatchObject({
      sku: '000002',
      name: 'POM DUR M90-44 PLT9B529 2018',
      code: 'LOMPOM-MDRC1BB',
      min: 250,
      max: 750,
      lots: [{ loc: 'B6.7', qty: 450, tanggal: '2026-03-24' }],
    });

    // Item 2 (decimal qty)
    expect(result.items[1]).toMatchObject({
      sku: '000004',
      min: 3,
      max: 8,
      lots: [{ loc: 'B5.11', qty: 6.5, tanggal: '2026-01-11' }],
    });

    // Item 3 (thousand dot & multi lot)
    expect(result.items[2]).toMatchObject({
      sku: '000010',
      min: 1000,
      max: 1700,
      lots: [
        { loc: 'D3.1', qty: 75, tanggal: '2026-08-10' },
        { loc: 'F7.7', qty: 1000, tanggal: '2026-08-25' },
      ],
    });

    // Item 4 (0 stock, no lots)
    expect(result.items[3]).toMatchObject({
      sku: '000318',
      min: 0,
      max: 0,
      lots: [],
    });
  });
});
