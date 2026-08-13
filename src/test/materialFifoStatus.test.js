import { describe, expect, it } from 'vitest';
import { FIFO_STATUS, getFifoStatus } from '../features/material-fifo/lib/fifoStatus';

describe('getFifoStatus', () => {
  it('marks missing bounds as not configured', () => {
    expect(getFifoStatus(0, null, null)).toBe(FIFO_STATUS.NOT_CONFIGURED);
  });

  it('applies critical, normal, and over boundaries', () => {
    expect(getFifoStatus(5, 5, 10)).toBe(FIFO_STATUS.CRITICAL);
    expect(getFifoStatus(10, 5, 10)).toBe(FIFO_STATUS.NORMAL);
    expect(getFifoStatus(10.0001, 5, 10)).toBe(FIFO_STATUS.OVER);
  });
});
