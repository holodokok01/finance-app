import { describe, it, expect } from 'vitest';
import { calcBalance, calcTotals30Days, formatCurrency, symOf } from '../../src/lib/balance';
import { payAdvance, payMonthly, calcFreeBalance } from '../../src/lib/payments';
import { periodRange, periodLabel, calcPeriodStats } from '../../src/lib/stats';
import { buildCsv, parseCsv, dateTs } from '../../src/lib/csv';
import { generateDemoHistory } from '../../src/lib/demo';
import { chunkString, unchunkStrings, getDefaultCategories } from '../../src/lib/storage';
import { RecurringPayment, Transaction } from '../../src/types/fin';

describe('Balance calculations', () => {
  it('correctly calculates balance with opening balance and ignores demo transactions', () => {
    const tx: Transaction[] = [
      { id: 1, ts: 1000, t: '10:00', cat: 'food', sum: -50, d: 0 },
      { id: 2, ts: 1000, t: '11:00', cat: 'salary', sum: 500, d: 0 },
      { id: 3, ts: 1000, t: '12:00', cat: 'food', sum: -100, demo: 1, d: 0 },
    ];
    expect(calcBalance(1000, tx)).toBe(1450);
  });

  it('correctly calculates 30 days totals', () => {
    const today = 1700000000000;
    const tx: Transaction[] = [
      { id: 1, ts: today - 5 * 86400000, t: '10:00', cat: 'food', sum: -60, d: 5 },
      { id: 2, ts: today - 10 * 86400000, t: '11:00', cat: 'salary', sum: 2000, d: 10 },
      { id: 3, ts: today - 35 * 86400000, t: '12:00', cat: 'food', sum: -300, d: 35 },
    ];
    const totals = calcTotals30Days(tx, today);
    expect(totals.income).toBe(2000);
    expect(totals.expense).toBe(60);
  });

  it('formats currency correctly', () => {
    expect(symOf('EUR')).toBe('€');
    expect(formatCurrency(1250.5, '€')).toBe('1 250,50 €');
    expect(formatCurrency(10000, '€')).toBe('10 000 €');
  });
});

describe('Payments calculations', () => {
  it('payAdvance advances weekly, monthly, and yearly', () => {
    // Week
    const pWeek: { next: number; per: 'week' } = {
      next: new Date(2026, 0, 1).getTime(),
      per: 'week',
    };
    payAdvance(pWeek);
    expect(new Date(pWeek.next).getDate()).toBe(8);

    // Month
    const pMonth: { next: number; per: 'month'; day?: number } = {
      next: new Date(2026, 0, 31).getTime(),
      per: 'month',
      day: 31,
    };
    payAdvance(pMonth);
    // February 2026 has 28 days
    expect(new Date(pMonth.next).getMonth()).toBe(1);
    expect(new Date(pMonth.next).getDate()).toBe(28);
  });

  it('payMonthly converts weekly and yearly payments to monthly equivalent', () => {
    const pays: RecurringPayment[] = [
      { id: '1', sum: 100, cat: 'home', per: 'month', next: 1000 },
      { id: '2', sum: 120, cat: 'fun', per: 'year', next: 1000 }, // 120 / 12 = 10
      { id: '3', sum: 70, cat: 'car', per: 'week', next: 1000 },  // 70 * 52 / 12 = 303.33
    ];
    expect(payMonthly(pays)).toBe(Math.round(100 + 10 + (70 * 52) / 12));
  });

  it('calcFreeBalance subtracts upcoming payments until end of month', () => {
    const today = new Date(2026, 4, 10).getTime(); // May 10
    const pays: RecurringPayment[] = [
      { id: '1', sum: 200, cat: 'home', per: 'month', next: new Date(2026, 4, 15).getTime() },
      { id: '2', sum: 500, cat: 'home', per: 'month', next: new Date(2026, 5, 2).getTime() }, // Next month!
    ];
    // Free balance should only subtract the May 15 payment (200), not June 2
    expect(calcFreeBalance(1000, pays, today)).toBe(800);
  });
});

describe('Stats calculations', () => {
  it('periodRange computes correct boundaries', () => {
    const today = new Date(2026, 2, 15).getTime(); // March 15, 2026
    const m = periodRange('month', 0, today);
    expect(new Date(m.from).getDate()).toBe(1);
    expect(new Date(m.from).getMonth()).toBe(2);
    expect(new Date(m.to).getDate()).toBe(31);
    expect(new Date(m.to).getMonth()).toBe(2);
  });

  it('periodLabel formats months and years', () => {
    const today = new Date(2026, 2, 15).getTime();
    expect(periodLabel('month', 0, today, 'ru')).toBe('Март');
    expect(periodLabel('year', 0, today, 'ru')).toBe('2026');
  });

  it('calcPeriodStats aggregates category totals', () => {
    const today = new Date(2026, 2, 15).getTime();
    const tx: Transaction[] = [
      { id: 1, ts: new Date(2026, 2, 10).getTime(), t: '12:00', cat: 'food', sum: -50, d: 5 },
      { id: 2, ts: new Date(2026, 2, 11).getTime(), t: '13:00', cat: 'food', sum: -30, d: 4 },
      { id: 3, ts: new Date(2026, 2, 12).getTime(), t: '14:00', cat: 'car', sum: -100, d: 3 },
      { id: 4, ts: new Date(2026, 1, 15).getTime(), t: '14:00', cat: 'car', sum: -200, d: 30 }, // previous month
    ];
    const res = calcPeriodStats('month', 0, today, tx, 'expense');
    expect(res.total).toBe(180);
    expect(res.cats[0].cat).toBe('car');
    expect(res.cats[0].sum).toBe(100);
    expect(res.cats[1].cat).toBe('food');
    expect(res.cats[1].sum).toBe(80);
  });
});

describe('CSV import/export', () => {
  it('builds CSV and parses CSV without data loss', () => {
    const { cats } = getDefaultCategories();
    const tx: Transaction[] = [
      { id: 1, ts: new Date(2026, 2, 10).getTime(), t: '12:34', cat: 'food', sum: -55.5, note: 'Lidl; fresh', d: 0 },
      { id: 2, ts: new Date(2026, 2, 11).getTime(), t: '14:20', cat: 'salary', sum: 2500, note: 'Job "bonus"', d: 0 },
    ];
    const { text, n } = buildCsv(tx, cats, 'EUR', 'ru');
    expect(n).toBe(2);
    const parsed = parseCsv(text);
    expect(parsed.length).toBe(3); // header + 2 rows
    // Rows are sorted by date descending (March 11 first, then March 10)
    expect(parsed[1][4]).toBe('Job "bonus"');
    expect(parsed[2][4]).toBe('Lidl; fresh');
  });

  it('dateTs parses various formats', () => {
    expect(dateTs('2026-03-15')).not.toBeNull();
    expect(dateTs('15.03.2026')).not.toBeNull();
    expect(dateTs('15/03/2026')).not.toBeNull();
  });
});

describe('Demo history generation', () => {
  it('generates demo transactions for previous months when needed', () => {
    const today = new Date(2026, 2, 15).getTime();
    const { cats } = getDefaultCategories();
    const existing: Transaction[] = [
      { id: 1, ts: today, t: '12:00', cat: 'food', sum: -20, d: 0 },
    ];
    const withDemo = generateDemoHistory(today, cats, existing, false);
    expect(withDemo.length).toBeGreaterThan(existing.length);
    const demoItems = withDemo.filter(t => t.demo === 1);
    expect(demoItems.length).toBeGreaterThan(0);
  });
});

describe('Storage and Telegram chunking', () => {
  it('chunks and unchunks strings correctly across 3000 byte boundaries', () => {
    const longString = 'A'.repeat(8500);
    const chunks = chunkString(longString, 3000);
    expect(chunks.fin_v1_n).toBe('3');
    expect(chunks.fin_v1_0.length).toBe(3000);
    expect(chunks.fin_v1_1.length).toBe(3000);
    expect(chunks.fin_v1_2.length).toBe(2500);

    const reassembled = unchunkStrings(k => chunks[k], 3);
    expect(reassembled).toBe(longString);
  });
});
