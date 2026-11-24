import { describe, it, expect } from 'vitest';
import { monthTotal } from '../../src/components/home/TransactionDetailSheet';
import { Transaction } from '../../src/types/fin';

const DAY = 86400000;
const today = new Date('2026-11-24T00:00:00').getTime();
const mk = (id: number, d: number, cat: string, sum: number): Transaction => ({
  id, d, ts: today - d * DAY, t: '10:00', cat, sum, note: '',
});

describe('monthTotal', () => {
  const list = [
    mk(1, 0, 'food', -10),
    mk(2, 29, 'food', -20),
    mk(3, 30, 'food', -40),
    mk(4, 5, 'coffee', -7),
    mk(5, 3, 'food', 100),
  ];
  it('sums same category and sign over 30 days incl. today', () => {
    expect(monthTotal(list[0], list, today)).toBe(30);
  });
  it('ignores other categories and the opposite sign', () => {
    expect(monthTotal(list[3], list, today)).toBe(7);
    expect(monthTotal(list[4], list, today)).toBe(100);
  });
});
