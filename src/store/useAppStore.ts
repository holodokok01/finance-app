import { create } from 'zustand';
import { Category, CategoryOrder, RecurringPayment, Transaction } from '../types/fin';
import { applySaved, chunkString, getDefaultCategories, packTx } from '../lib/storage';
import { generateDemoHistory } from '../lib/demo';
import { calcBalance } from '../lib/balance';
import { getTelegramWebApp } from '../services/telegram';

interface AppState {
  transactions: Transaction[];
  categories: Record<string, Category>;
  categoryOrder: CategoryOrder;
  payments: RecurringPayment[];
  opening: number;
  base: string;
  savedAt: number;
  todayMidnight: number;

  balance: () => number;
  loadStorage: () => void;
  cloudLoad: () => void;
  saveNow: () => void;
  saveSoon: () => void;

  addTransaction: (tx: Omit<Transaction, 'id' | 'd'>) => void;
  updateTransaction: (id: number, tx: Partial<Transaction>) => void;
  deleteTransaction: (id: number) => Transaction | undefined;
  restoreTransaction: (index: number, tx: Transaction) => void;

  addPayment: (p: RecurringPayment) => void;
  updatePayment: (id: string, p: Partial<RecurringPayment>) => void;
  deletePayment: (id: string) => void;

  addCategory: (cat: Category) => void;
  updateCategory: (id: string, cat: Partial<Category>) => void;
  deleteCategory: (id: string, moveToCatId?: string) => void;
  reorderCategories: (type: 'expense' | 'income', ids: string[]) => void;

  removeDemoHistory: () => void;
  clearAllData: () => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function getTodayMidnight(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const defaultCats = getDefaultCategories();

export const useAppStore = create<AppState>((set, get) => ({
  transactions: [],
  categories: defaultCats.cats,
  categoryOrder: defaultCats.order,
  payments: [],
  opening: 6000,
  base: 'EUR',
  savedAt: 0,
  todayMidnight: getTodayMidnight(),

  balance: () => {
    return calcBalance(get().opening, get().transactions);
  },

  loadStorage: () => {
    const today = getTodayMidnight();
    set({ todayMidnight: today });

    let raw: string | null = null;
    try {
      raw = localStorage.getItem('fin_v1');
    } catch (e) {}

    if (raw) {
      const parsed = applySaved(raw, today);
      if (parsed) {
        set({
          transactions: parsed.tx,
          categories: parsed.cats,
          categoryOrder: parsed.order,
          payments: parsed.pays,
          opening: parsed.opening,
          base: parsed.base,
          savedAt: parsed.at,
        });
        return;
      }
    }

    // Default sample data if no saved data
    const sampleTx: Array<{ d: number; t: string; cat: string; note: string; sum: number }> = [
      { d: 0, t: '09:12', cat: 'coffee', note: 'Costa', sum: -5 },
      { d: 0, t: '08:40', cat: 'food', note: 'Lidl', sum: -64 },
      { d: 1, t: '22:05', cat: 'car', note: 'Bolt', sum: -12 },
      { d: 1, t: '19:30', cat: 'fun', note: 'Cinema City', sum: -18 },
      { d: 2, t: '10:00', cat: 'home', note: 'Квартира', sum: -450 },
      { d: 3, t: '12:00', cat: 'salary', note: 'Основная работа', sum: 2200 },
      { d: 4, t: '17:15', cat: 'health', note: 'Аптека', sum: -23 },
      { d: 6, t: '18:20', cat: 'food', note: 'Kaufland', sum: -81 },
      { d: 8, t: '15:45', cat: 'freelance', note: 'Заказ на сайт', sum: 640 },
      { d: 9, t: '09:05', cat: 'coffee', note: 'Costa', sum: -6 },
      { d: 11, t: '13:10', cat: 'car', note: 'Бензин', sum: -45 },
      { d: 13, t: '19:02', cat: 'food', note: 'Lidl', sum: -52 },
      { d: 15, t: '21:30', cat: 'fun', note: 'Steam', sum: -20 },
      { d: 17, t: '08:50', cat: 'coffee', note: 'Costa', sum: -5 },
      { d: 19, t: '17:40', cat: 'food', note: 'Kaufland', sum: -74 },
    ];

    let id = 1;
    const initialTx: Transaction[] = sampleTx.map(t => ({
      id: id++,
      ts: today - t.d * 86400000,
      t: t.t,
      cat: t.cat,
      note: t.note,
      sum: t.sum,
      d: t.d,
    }));

    const withDemo = generateDemoHistory(today, defaultCats.cats, initialTx, false);

    set({
      transactions: withDemo,
      categories: defaultCats.cats,
      categoryOrder: defaultCats.order,
      payments: [],
      opening: 6000,
      base: 'EUR',
      savedAt: 0,
    });
  },

  cloudLoad: () => {
    const tg = getTelegramWebApp();
    const cs = tg?.CloudStorage;
    if (!cs || !cs.getItem) return;

    try {
      cs.getItem('fin_v1_n', (err, val) => {
        const n = parseInt(val, 10);
        if (err || !n) return;
        const keys: string[] = [];
        for (let i = 0; i < n; i++) keys.push(`fin_v1_${i}`);
        cs.getItems?.(keys, (err2, vals) => {
          if (err2 || !vals) return;
          const raw = keys.map(k => vals[k] || '').join('');
          let at = 0;
          try {
            at = JSON.parse(raw).at || 0;
          } catch (e) {
            return;
          }
          if (at > get().savedAt) {
            const today = get().todayMidnight;
            const parsed = applySaved(raw, today);
            if (parsed) {
              set({
                transactions: parsed.tx,
                categories: parsed.cats,
                categoryOrder: parsed.order,
                payments: parsed.pays,
                opening: parsed.opening,
                base: parsed.base,
                savedAt: parsed.at,
              });
              try {
                localStorage.setItem('fin_v1', raw);
              } catch (e) {}
            }
          }
        });
      });
    } catch (e) {}
  },

  saveNow: () => {
    const s = get();
    const at = Date.now();
    const str = packTx(at, s.base, s.opening, s.categories, s.categoryOrder, s.payments, s.transactions);
    set({ savedAt: at });

    try {
      localStorage.setItem('fin_v1', str);
    } catch (e) {}

    const tg = getTelegramWebApp();
    const cs = tg?.CloudStorage;
    if (cs && cs.setItems) {
      const items = chunkString(str, 3000);
      try {
        cs.setItems(items, () => {});
      } catch (e) {}
    }
  },

  saveSoon: () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      get().saveNow();
    }, 300);
  },

  addTransaction: (tx) => {
    const today = get().todayMidnight;
    const maxId = get().transactions.reduce((acc, t) => Math.max(acc, t.id), 0);
    const newTx: Transaction = {
      ...tx,
      id: maxId + 1,
      d: Math.round((today - tx.ts) / 86400000),
    };
    const list = [...get().transactions, newTx];
    list.sort((a, b) => a.d - b.d || (a.t < b.t ? 1 : a.t > b.t ? -1 : b.id - a.id));
    set({ transactions: list });
    get().saveSoon();
  },

  updateTransaction: (id, update) => {
    const today = get().todayMidnight;
    const list = get().transactions.map(t => {
      if (t.id === id) {
        const updated = { ...t, ...update };
        if (update.ts !== undefined) {
          updated.d = Math.round((today - update.ts) / 86400000);
        }
        return updated;
      }
      return t;
    });
    list.sort((a, b) => a.d - b.d || (a.t < b.t ? 1 : a.t > b.t ? -1 : b.id - a.id));
    set({ transactions: list });
    get().saveSoon();
  },

  deleteTransaction: (id) => {
    const tx = get().transactions.find(t => t.id === id);
    if (!tx) return undefined;
    const list = get().transactions.filter(t => t.id !== id);
    set({ transactions: list });
    get().saveSoon();
    return tx;
  },

  restoreTransaction: (index, tx) => {
    const list = [...get().transactions];
    list.splice(index, 0, tx);
    set({ transactions: list });
    get().saveSoon();
  },

  addPayment: (p) => {
    set({ payments: [...get().payments, p] });
    get().saveSoon();
  },

  updatePayment: (id, update) => {
    set({
      payments: get().payments.map(p => (p.id === id ? { ...p, ...update } : p)),
    });
    get().saveSoon();
  },

  deletePayment: (id) => {
    set({ payments: get().payments.filter(p => p.id !== id) });
    get().saveSoon();
  },

  addCategory: (cat) => {
    const cats = { ...get().categories, [cat.id]: cat };
    const order = {
      ...get().categoryOrder,
      [cat.type]: [...get().categoryOrder[cat.type], cat.id],
    };
    set({ categories: cats, categoryOrder: order });
    get().saveSoon();
  },

  updateCategory: (id, update) => {
    const current = get().categories[id];
    if (!current) return;
    const updated = { ...current, ...update };
    set({ categories: { ...get().categories, [id]: updated } });
    get().saveSoon();
  },

  deleteCategory: (id, moveToCatId) => {
    const cat = get().categories[id];
    if (!cat) return;

    const cats = { ...get().categories };
    delete cats[id];

    const order = {
      expense: get().categoryOrder.expense.filter(x => x !== id),
      income: get().categoryOrder.income.filter(x => x !== id),
    };

    let txList = get().transactions;
    if (moveToCatId) {
      txList = txList.map(t => (t.cat === id ? { ...t, cat: moveToCatId } : t));
    } else {
      txList = txList.filter(t => t.cat !== id);
    }

    set({ categories: cats, categoryOrder: order, transactions: txList });
    get().saveSoon();
  },

  reorderCategories: (type, ids) => {
    set({
      categoryOrder: {
        ...get().categoryOrder,
        [type]: ids,
      },
    });
    get().saveSoon();
  },

  removeDemoHistory: () => {
    const list = get().transactions.filter(t => !t.demo);
    set({ transactions: list });
    get().saveSoon();
  },

  clearAllData: () => {
    set({
      transactions: [],
      payments: [],
      opening: 0,
    });
    get().saveSoon();
  },
}));
