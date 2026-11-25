import { Transaction } from '../types/fin';
import { LangCode } from '../types/settings';
import { MONTHS_SHORT_L, L } from '../i18n';
import { StatData, Per, DAY, daysIn } from './statsView';

/* Расчёты карточки «Сводка» (barsFor, paintTiles, paintRows из legacy). */

export interface Bar {
  from: number;
  to: number;
  /** номер месяца, только для годового вида */
  mo?: number;
  sum: number;
  n: number;
}

export function barsFor(d: StatData, per: Per): Bar[] {
  const a = new Date(d.r.from);
  const out: Bar[] = [];
  if (per === 'year') {
    for (let i = 0; i < 12; i++) {
      out.push({
        from: new Date(a.getFullYear(), i, 1).getTime(),
        to: new Date(a.getFullYear(), i + 1, 0).getTime(),
        mo: i,
        sum: 0,
        n: 0,
      });
    }
  } else {
    const n = per === 'week' ? 7 : new Date(a.getFullYear(), a.getMonth() + 1, 0).getDate();
    for (let i = 0; i < n; i++) {
      const ts = new Date(a.getFullYear(), a.getMonth(), a.getDate() + i).getTime();
      out.push({ from: ts, to: ts, sum: 0, n: 0 });
    }
  }
  out.forEach(b => {
    d.items.forEach((t: Transaction) => {
      if (t.ts >= b.from && t.ts <= b.to) {
        b.sum += Math.abs(t.sum);
        b.n++;
      }
    });
    b.sum = Math.round(b.sum * 100) / 100;
  });
  return out;
}

/** Какой столбик выделен: выбранный тапом, иначе сегодняшний, иначе самый большой. */
export function barHi(bars: Bar[], sel: number | null, today: number): number {
  let hi = -1;
  let mx = 0;
  bars.forEach((b, i) => {
    if (sel === b.from) hi = i;
  });
  if (hi >= 0) return hi;
  bars.forEach((b, i) => {
    if (today >= b.from && today <= b.to) hi = i;
  });
  if (hi >= 0) return hi;
  bars.forEach((b, i) => {
    if (b.sum > mx) {
      mx = b.sum;
      hi = i;
    }
  });
  return hi;
}

export function fmtDay(ts: number, lang: LangCode): string {
  const d = new Date(ts);
  return d.getDate() + ' ' + MONTHS_SHORT_L[lang][d.getMonth()];
}

export function dayShort(ts: number, today: number, lang: LangCode): string {
  const o = Math.round((today - ts) / DAY);
  return o === 0 ? L('Сегодня') : o === 1 ? L('Вчера') : fmtDay(ts, lang);
}

export interface Tile {
  /** русский ключ перевода */
  label: string;
  value: number;
  /** разница с прошлым периодом; null, если сравнивать не с чем */
  delta: number | null;
}

export function tilesFor(d: StatData, per: Per, k: number, today: number): Tile[] {
  if (!d.items.length) return [];
  const r = d.r;
  const el = Math.max(1, Math.round((Math.min(r.to, today) - r.from) / DAY) + 1);
  const pv = d.prev;
  const avg = d.total / el;
  const fc = avg * daysIn(r);
  const t: Tile[] = [
    {
      label: 'В среднем в день',
      value: Math.round(avg * 100) / 100,
      delta: pv.has ? avg - pv.total / pv.days : null,
    },
  ];
  if (!d.inc && k === 0 && el >= 3) {
    t.push({
      label: per === 'week' ? 'К концу недели' : per === 'year' ? 'К концу года' : 'К концу месяца',
      value: Math.round(fc),
      delta: pv.has ? fc - pv.full : null,
    });
  }
  return t;
}

export interface SummaryRows {
  big: Transaction;
  topTs: number;
}

/** Крупнейшая операция и самый дорогой день периода. */
export function rowsFor(d: StatData): SummaryRows | null {
  if (!d.items.length) return null;
  let big = d.items[0];
  const byDay = new Map<number, number>();
  d.items.forEach(t => {
    if (Math.abs(t.sum) > Math.abs(big.sum)) big = t;
    byDay.set(t.ts, (byDay.get(t.ts) || 0) + Math.abs(t.sum));
  });
  let topTs = d.items[0].ts;
  let topV = -1;
  byDay.forEach((v, ts) => {
    if (v > topV) {
      topV = v;
      topTs = ts;
    }
  });
  return { big, topTs };
}
