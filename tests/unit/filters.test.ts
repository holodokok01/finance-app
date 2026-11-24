import { describe, it, expect } from 'vitest';
import { EMPTY_FILTER, filterTx, groupByDay, hasFilter } from '../../src/lib/filters';
import { Category, Transaction } from '../../src/types/fin';

const DAY = 86400000;
const today = new Date('2026-11-24T00:00:00').getTime();
const cats = {
  food: { id: 'food', name: 'Продукты', color: '#fff', type: 'expense' },
  salary: { id: 'salary', name: 'Зарплата', color: '#fff', type: 'income' },
} as Record<string, Category>;
const mk = (id: number, d: number, cat: string, sum: number, note = ''): Transaction => ({
  id, d, ts: today - d * DAY, t: '10:00', cat, sum, note,
});
const list = [
  mk(1, 0, 'food', -10, 'Lidl'),
  mk(2, 0, 'food', -5, ''),
  mk(3, 3, 'salary', 2000, 'Основная работа'),
  mk(4, 10, 'food', -30, 'Kaufland'),
];

describe('filterTx', () => {
  it('returns everything for the empty filter', () => {
    expect(filterTx(list, EMPTY_FILTER, cats)).toHaveLength(4);
    expect(hasFilter(EMPTY_FILTER)).toBe(false);
  });
  it('filters by type and category', () => {
    expect(filterTx(list, { ...EMPTY_FILTER, type: 'income' }, cats).map(t => t.id)).toEqual([3]);
    expect(filterTx(list, { ...EMPTY_FILTER, cat: 'food' }, cats)).toHaveLength(3);
  });
  it('searches note and category name, case-insensitive', () => {
    expect(filterTx(list, { ...EMPTY_FILTER, q: 'lidl' }, cats).map(t => t.id)).toEqual([1]);
    expect(filterTx(list, { ...EMPTY_FILTER, q: ' ПРОДУКТЫ ' }, cats)).toHaveLength(3);
    expect(filterTx(list, { ...EMPTY_FILTER, q: 'nope' }, cats)).toHaveLength(0);
  });
  it('filters by an inclusive date range', () => {
    const f = { ...EMPTY_FILTER, from: today - 3 * DAY, to: today };
    expect(filterTx(list, f, cats).map(t => t.id)).toEqual([1, 2, 3]);
    expect(hasFilter(f)).toBe(true);
  });
});

describe('groupByDay', () => {
  it('groups consecutive rows by day offset', () => {
    const g = groupByDay(list);
    expect(g.map(x => x.d)).toEqual([0, 3, 10]);
    expect(g[0].rows).toHaveLength(2);
  });
});
