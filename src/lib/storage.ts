import { Category, CategoryOrder, FinV1Storage, RecurringPayment, Transaction } from '../types/fin';
import { L } from '../i18n';

export function chunkString(str: string, chunkSize = 3000): Record<string, string> {
  const n = Math.ceil(str.length / chunkSize) || 1;
  const items: Record<string, string> = {
    fin_v1_n: String(n),
  };
  for (let i = 0; i < n; i++) {
    items[`fin_v1_${i}`] = str.slice(i * chunkSize, (i + 1) * chunkSize);
  }
  return items;
}

export function unchunkStrings(getter: (key: string) => string | undefined, count: number): string {
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    parts.push(getter(`fin_v1_${i}`) || '');
  }
  return parts.join('');
}

export function createCategory(k: string, d: { n?: string; ru?: string; icon?: string; emoji?: string; color?: string; type?: 'expense' | 'income' }): Category {
  const o: Category = {
    id: k,
    n: d.n || '',
    ru: d.ru || '',
    icon: d.icon || '',
    emoji: d.emoji || '',
    color: d.color || '#8e8e93',
    type: d.type === 'income' ? 'income' : 'expense',
    get name() {
      return this.n || L(this.ru || '');
    },
  };
  return o;
}

export function getDefaultCategories(): { cats: Record<string, Category>; order: CategoryOrder } {
  const cats: Record<string, Category> = {};
  const order: CategoryOrder = { expense: [], income: [] };

  const defaults: Array<[string, string, string, string, ('expense' | 'income')?]> = [
    ['food', 'Продукты', 'food', '#ff9f0a'],
    ['car', 'Транспорт', 'car', '#3fa7ff'],
    ['coffee', 'Кафе', 'coffee', '#ac8e68'],
    ['home', 'Жильё', 'home', '#5e5ce6'],
    ['fun', 'Досуг', 'film', '#bf5af2'],
    ['health', 'Здоровье', 'heart', '#ff453a'],
    ['salary', 'Зарплата', 'work', '#30d158', 'income'],
    ['freelance', 'Фриланс', 'laptop', '#40c8e0', 'income'],
  ];

  for (let i = 0; i < defaults.length; i++) {
    const x = defaults[i];
    const cat = createCategory(x[0], { ru: x[1], icon: x[2], color: x[3], type: x[4] });
    cats[x[0]] = cat;
    order[x[4] || 'expense'].push(x[0]);
  }

  return { cats, order };
}

export interface ParsedSavedData {
  at: number;
  base: string;
  opening: number;
  cats: Record<string, Category>;
  order: CategoryOrder;
  pays: RecurringPayment[];
  tx: Transaction[];
}

export function applySaved(raw: string, todayMidnight: number): ParsedSavedData | null {
  try {
    const o = JSON.parse(raw);
    if (!o || (!o.tx && !o.at)) return null;

    let cats = getDefaultCategories().cats;
    let order = getDefaultCategories().order;

    if (o.cats) {
      if (o.cats.items) {
        cats = {};
        for (const k in o.cats.items) {
          cats[k] = createCategory(k, o.cats.items[k]);
        }
      }
      if (o.cats.order) {
        order = {
          expense: Array.isArray(o.cats.order.expense) ? o.cats.order.expense.slice() : [],
          income: Array.isArray(o.cats.order.income) ? o.cats.order.income.slice() : [],
        };
      }
    }

    const pays: RecurringPayment[] = Array.isArray(o.pays)
      ? o.pays.filter((q: RecurringPayment) => q && q.sum > 0 && q.next)
      : [];

    let nextId = 1;
    const tx: Transaction[] = [];

    if (Array.isArray(o.tx)) {
      for (let i = 0; i < o.tx.length; i++) {
        const x = o.tx[i];
        if (!cats[x.cat]) continue;
        const d = Math.round((todayMidnight - x.ts) / 86400000);
        // Migration: old 'title' field moves to 'note' if note is empty
        const note = x.note || (x.title && x.title !== cats[x.cat].name ? x.title : '') || '';
        tx.push({
          id: nextId++,
          ts: x.ts,
          t: x.t,
          cat: x.cat,
          sum: x.sum,
          note,
          demo: x.demo ? 1 : undefined,
          d,
        });
      }
    }

    tx.sort((a, b) => a.d - b.d || (a.t < b.t ? 1 : a.t > b.t ? -1 : b.id - a.id));

    return {
      at: o.at || 0,
      base: o.base || 'EUR',
      opening: typeof o.opening === 'number' ? o.opening : 6000,
      cats,
      order,
      pays,
      tx,
    };
  } catch (e) {
    return null;
  }
}

export function packTx(
  at: number,
  base: string,
  opening: number,
  cats: Record<string, Category>,
  order: CategoryOrder,
  pays: RecurringPayment[],
  tx: Transaction[]
): string {
  const catItems: Record<string, Omit<Category, 'id' | 'name'>> = {};
  for (const k in cats) {
    catItems[k] = {
      n: cats[k].n,
      ru: cats[k].ru,
      icon: cats[k].icon,
      emoji: cats[k].emoji,
      color: cats[k].color,
      type: cats[k].type,
    };
  }

  const payload: FinV1Storage = {
    at,
    base,
    opening,
    cats: {
      order,
      items: catItems,
    },
    pays,
    tx: tx.map(t => ({
      ts: t.ts,
      t: t.t,
      cat: t.cat,
      sum: t.sum,
      note: t.note || '',
      demo: t.demo ? 1 : undefined,
    })),
  };

  return JSON.stringify(payload);
}
