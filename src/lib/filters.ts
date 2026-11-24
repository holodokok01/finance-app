import { Category, Transaction } from '../types/fin';

export interface ListFilter {
  q: string;
  type: 'income' | 'expense' | null;
  cat: string | null;
  from: number | null;
  to: number | null;
}

export const EMPTY_FILTER: ListFilter = { q: '', type: null, cat: null, from: null, to: null };

export function hasFilter(f: ListFilter): boolean {
  return !!(f.q || f.type || f.cat || f.from !== null);
}

export function filterTx(list: Transaction[], f: ListFilter, categories: Record<string, Category>): Transaction[] {
  const q = f.q.trim().toLowerCase();
  return list.filter(t => {
    if (f.type === 'income' && t.sum < 0) return false;
    if (f.type === 'expense' && t.sum > 0) return false;
    if (f.cat && t.cat !== f.cat) return false;
    if (f.from !== null && f.to !== null && (t.ts < f.from || t.ts > f.to)) return false;
    if (q) {
      const name = categories[t.cat] ? categories[t.cat].name : '';
      if (((t.note || '') + ' ' + name).toLowerCase().indexOf(q) < 0) return false;
    }
    return true;
  });
}

export interface DayGroup {
  d: number;
  rows: Transaction[];
}

export function groupByDay(items: Transaction[]): DayGroup[] {
  const days: DayGroup[] = [];
  items.forEach(t => {
    const last = days[days.length - 1];
    if (last && last.d === t.d) last.rows.push(t);
    else days.push({ d: t.d, rows: [t] });
  });
  return days;
}
