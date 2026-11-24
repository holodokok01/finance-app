import { Transaction } from '../types/fin';
import { MONTH_L, MONTHS_SHORT_L } from '../i18n';
import { LangCode } from '../types/settings';

export const DAY_MS = 86400000;

export interface PeriodRange {
  from: number;
  to: number;
}

export function periodRange(per: 'week' | 'month' | 'year', k: number, todayMidnight: number): PeriodRange {
  const t = new Date(todayMidnight);
  let from: Date;
  let to: Date;

  if (per === 'week') {
    const dow = (t.getDay() + 6) % 7;
    from = new Date(t.getFullYear(), t.getMonth(), t.getDate() - dow - 7 * k);
    to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6);
  } else if (per === 'month') {
    from = new Date(t.getFullYear(), t.getMonth() - k, 1);
    to = new Date(t.getFullYear(), t.getMonth() - k + 1, 0);
  } else {
    from = new Date(t.getFullYear() - k, 0, 1);
    to = new Date(t.getFullYear() - k, 11, 31);
  }
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return { from: from.getTime(), to: to.getTime() };
}

export function periodDays(range: PeriodRange): number {
  return Math.round((range.to - range.from) / DAY_MS) + 1;
}

export function periodLabel(
  per: 'week' | 'month' | 'year',
  k: number,
  todayMidnight: number,
  lang: LangCode = 'ru'
): string {
  const r = periodRange(per, k, todayMidnight);
  const a = new Date(r.from);
  const b = new Date(r.to);
  const y = new Date(todayMidnight).getFullYear();
  const months = MONTH_L[lang];
  const monthsShort = MONTHS_SHORT_L[lang];

  if (per === 'year') return String(a.getFullYear());
  if (per === 'month') {
    return months[a.getMonth()] + (a.getFullYear() !== y ? ' ' + a.getFullYear() : '');
  }
  if (a.getMonth() === b.getMonth()) {
    return a.getDate() + '–' + b.getDate() + ' ' + monthsShort[b.getMonth()];
  }
  return a.getDate() + ' ' + monthsShort[a.getMonth()] + ' – ' + b.getDate() + ' ' + monthsShort[b.getMonth()];
}

export interface PrevPeriodData {
  has: boolean;
  full: number;
  total: number;
  cats: Record<string, number>;
  days: number;
}

export function calcPrevPeriodData(
  per: 'week' | 'month' | 'year',
  k: number,
  todayMidnight: number,
  txList: Transaction[],
  inc: boolean
): PrevPeriodData {
  const currentR = periodRange(per, k, todayMidnight);
  const pr = periodRange(per, k + 1, todayMidnight);
  const pf = new Date(pr.from);
  let days = periodDays(pr);
  let full = 0;
  let part = 0;
  const byCat: Record<string, number> = {};
  let n = 0;
  let to = pr.to;

  if (k === 0) {
    const el = Math.round((todayMidnight - currentR.from) / DAY_MS) + 1;
    to = Math.min(pr.to, new Date(pf.getFullYear(), pf.getMonth(), pf.getDate() + el - 1).setHours(23, 59, 59, 999));
    days = Math.round((to - pr.from) / DAY_MS) + 1;
  }

  for (let i = 0; i < txList.length; i++) {
    const t = txList[i];
    if ((t.sum > 0) !== inc || t.ts < pr.from || t.ts > pr.to) continue;
    const a = Math.abs(t.sum);
    full += a;
    if (t.ts <= to) {
      part += a;
      n++;
      byCat[t.cat] = (byCat[t.cat] || 0) + a;
    }
  }

  return {
    has: n > 0 || full > 0,
    full: Math.round(full * 100) / 100,
    total: Math.round(part * 100) / 100,
    cats: byCat,
    days: Math.max(1, days),
  };
}

export interface CategoryStat {
  cat: string;
  sum: number;
  n: number;
}

export interface PeriodStatsResult {
  range: PeriodRange;
  inc: boolean;
  items: Transaction[];
  cats: CategoryStat[];
  total: number;
  prev: PrevPeriodData;
}

export function calcPeriodStats(
  per: 'week' | 'month' | 'year',
  k: number,
  todayMidnight: number,
  txList: Transaction[],
  type: 'expense' | 'income'
): PeriodStatsResult {
  const r = periodRange(per, k, todayMidnight);
  const inc = type === 'income';
  const by: Record<string, CategoryStat> = {};

  const items = txList.filter(t => (t.sum > 0) === inc && t.ts >= r.from && t.ts <= r.to);
  for (let i = 0; i < items.length; i++) {
    const t = items[i];
    const b = by[t.cat] || (by[t.cat] = { cat: t.cat, sum: 0, n: 0 });
    b.sum = Math.round((b.sum + Math.abs(t.sum)) * 100) / 100;
    b.n++;
  }

  const cats = Object.keys(by)
    .map(k => by[k])
    .sort((a, b) => b.sum - a.sum);

  let total = 0;
  for (let i = 0; i < cats.length; i++) {
    total += cats[i].sum;
  }

  return {
    range: r,
    inc,
    items,
    cats,
    total: Math.round(total * 100) / 100,
    prev: calcPrevPeriodData(per, k, todayMidnight, txList, inc),
  };
}
