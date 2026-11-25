import { Transaction } from '../types/fin';
import { periodRange } from './stats';

/* Расчёты экрана «Статистика», один в один с legacy (statData, prevData). Границы периода это полночи дней. */

export type Per = 'week' | 'month' | 'year';
export const DAY = 86400000;

export interface RangeM {
  from: number;
  to: number;
}

/** Период с концом в полночь последнего дня, как periodRange в legacy. */
export function rangeM(per: Per, k: number, today: number): RangeM {
  const r = periodRange(per, k, today);
  const to = new Date(r.to);
  to.setHours(0, 0, 0, 0);
  return { from: r.from, to: to.getTime() };
}

export function daysIn(r: RangeM): number {
  return Math.round((r.to - r.from) / DAY) + 1;
}

export interface PrevData {
  has: boolean;
  full: number;
  total: number;
  cats: Record<string, number>;
  days: number;
}

/** Прошлый период: текущий сравнивается с тем же числом дней предыдущего. */
export function prevData(per: Per, k: number, today: number, tx: Transaction[], inc: boolean): PrevData {
  const r = rangeM(per, k, today);
  const pr = rangeM(per, k + 1, today);
  const pf = new Date(pr.from);
  let days = daysIn(pr);
  let to = pr.to;
  if (k === 0) {
    const el = Math.round((today - r.from) / DAY) + 1;
    to = Math.min(pr.to, new Date(pf.getFullYear(), pf.getMonth(), pf.getDate() + el - 1).getTime());
    days = Math.round((to - pr.from) / DAY) + 1;
  }
  let full = 0;
  let part = 0;
  let n = 0;
  const cats: Record<string, number> = {};
  for (const t of tx) {
    if (t.sum > 0 !== inc || t.ts < pr.from || t.ts > pr.to) continue;
    const a = Math.abs(t.sum);
    full += a;
    if (t.ts <= to) {
      part += a;
      n++;
      cats[t.cat] = (cats[t.cat] || 0) + a;
    }
  }
  return { has: n > 0 || full > 0, full, total: part, cats, days: Math.max(1, days) };
}

export interface CatStat {
  cat: string;
  sum: number;
  n: number;
}

export interface StatData {
  r: RangeM;
  inc: boolean;
  items: Transaction[];
  cats: CatStat[];
  total: number;
  prev: PrevData;
}

export function statData(per: Per, k: number, today: number, tx: Transaction[], inc: boolean): StatData {
  const r = rangeM(per, k, today);
  const by: Record<string, CatStat> = {};
  const items = tx.filter(t => t.sum > 0 === inc && t.ts >= r.from && t.ts <= r.to);
  items.forEach(t => {
    const b = by[t.cat] || (by[t.cat] = { cat: t.cat, sum: 0, n: 0 });
    b.sum = Math.round((b.sum + Math.abs(t.sum)) * 100) / 100;
    b.n++;
  });
  const cats = Object.keys(by)
    .map(key => by[key])
    .sort((a, b) => b.sum - a.sum);
  let total = 0;
  cats.forEach(c => (total += c.sum));
  return { r, inc, items, cats, total: Math.round(total * 100) / 100, prev: prevData(per, k, today, tx, inc) };
}
