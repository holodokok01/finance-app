export type CategoryType = 'expense' | 'income';

export interface CategoryItem {
  id: string;
  n?: string;
  ru?: string;
  icon?: string;
  emoji?: string;
  color: string;
  type: CategoryType;
}

export interface Category extends CategoryItem {
  name: string; // n || L(ru)
}

export interface CategoryOrder {
  expense: string[];
  income: string[];
}

export interface CategoriesData {
  order: CategoryOrder;
  items: Record<string, CategoryItem>;
}

export interface Transaction {
  id: number;
  ts: number; // midnight timestamp
  t: string; // HH:MM
  cat: string; // category id
  sum: number; // < 0 for expense, > 0 for income
  note?: string;
  demo?: 1;
  d: number; // days ago from today
}

export type RecurringPeriod = 'week' | 'month' | 'year';

export interface RecurringPayment {
  id: string;
  sum: number;
  cat: string;
  n?: string;
  per: RecurringPeriod;
  next: number; // timestamp
  day?: number;
}

export interface FinV1Storage {
  at: number;
  base: string;
  opening: number;
  cats: {
    order: CategoryOrder;
    items: Record<string, Omit<CategoryItem, 'id'>>;
  };
  pays: RecurringPayment[];
  tx: Array<{
    ts: number;
    t: string;
    cat: string;
    sum: number;
    note?: string;
    demo?: 1;
    title?: string; // legacy migration
  }>;
}
