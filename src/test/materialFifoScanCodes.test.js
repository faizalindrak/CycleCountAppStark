import { describe, expect, it } from 'vitest';
import { KeyboardWedgeBuffer, findItemByScannedCode } from '../features/material-fifo/lib/scanCodes';

const items = [
  { sku: 'RM-01', item_code: 'ITEM-01', internal_product_code: 'JI4ACO' },
  { sku: '000123JI4ACO', item_code: 'EXACT', internal_product_code: 'OTHER' },
];

describe('scan code matching', () => {
  it('uses exact values before stripping a numeric prefix', () => {
    expect(findItemByScannedCode(' RM-01 ', items)?.sku).toBe('RM-01');
    expect(findItemByScannedCode('000123JI4ACO', items)?.item_code).toBe('EXACT');
  });

  it('falls back to legacy numeric prefix stripping', () => {
    expect(findItemByScannedCode('00999JI4ACO', items)?.internal_product_code).toBe('JI4ACO');
    expect(findItemByScannedCode('unknown', items)).toBeNull();
  });
});

describe('KeyboardWedgeBuffer', () => {
  it('returns rapid scanner input on Enter', () => {
    const buffer = new KeyboardWedgeBuffer({ maxGapMs: 80, minLength: 3 });
    buffer.push('R', 0);
    buffer.push('M', 10);
    buffer.push('1', 20);
    expect(buffer.push('Enter', 30)).toBe('RM1');
  });

  it('resets slow human typing', () => {
    const buffer = new KeyboardWedgeBuffer({ maxGapMs: 30, minLength: 2 });
    buffer.push('R', 0);
    buffer.push('M', 100);
    expect(buffer.push('Enter', 110)).toBeNull();
  });
});
