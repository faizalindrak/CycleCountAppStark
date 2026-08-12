import { describe, expect, it } from 'vitest';
import { localDateInput } from '../features/material-fifo/lib/dates';

describe('localDateInput', () => {
  it('uses local calendar fields instead of the UTC date', () => {
    const jakartaMidnight = new Date('2026-08-11T17:30:00.000Z');
    jakartaMidnight.getFullYear = () => 2026;
    jakartaMidnight.getMonth = () => 7;
    jakartaMidnight.getDate = () => 12;
    expect(localDateInput(jakartaMidnight)).toBe('2026-08-12');
  });
});
