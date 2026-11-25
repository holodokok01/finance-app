import { useAppStore } from '../store/useAppStore';
import { createCategory } from './storage';
import { CAT_PAL } from './catData';
import { L } from '../i18n';
import { CategoryType } from '../types/fin';

/* Операции над категориями: свободный цвет, сохранение из редактора, подсчёт операций, удаление с переносом. */

/** Цвет палитры, которым пользуются реже всего (первый из свободных). */
export function catFreeColor(): string {
  const { categories } = useAppStore.getState();
  const used: Record<string, number> = {};
  Object.keys(categories).forEach(k => {
    const c = categories[k].color;
    used[c] = (used[c] || 0) + 1;
  });
  for (let n = 0; n < 99; n++) for (let i = 0; i < CAT_PAL.length; i++) if ((used[CAT_PAL[i]] || 0) === n) return CAT_PAL[i];
  return CAT_PAL[0];
}

export function catCount(k: string): number {
  let n = 0;
  useAppStore.getState().transactions.forEach(t => {
    if (t.cat === k) n++;
  });
  return n;
}

export interface CatDraft {
  k: string | null;
  type: CategoryType;
  name: string;
  color: string;
  kind: 'icon' | 'emoji';
  icon: string;
  emoji: string;
}

/** Создаёт или обновляет категорию, возвращает её id. Своё имя хранится в n, пока оно отличается от стандартного. */
export function saveCategory(d: CatDraft): string {
  const s = useAppStore.getState();
  const old = d.k ? s.categories[d.k] : null;
  const k = d.k || 'c' + Date.now().toString(36);
  const keepRu = !!(old && old.ru && d.name === L(old.ru));
  const emoji = d.kind === 'emoji' && d.emoji ? d.emoji : '';
  const cat = createCategory(k, {
    n: keepRu ? '' : d.name,
    ru: old ? old.ru : '',
    icon: emoji ? (old ? old.icon : '') : d.icon || (old ? old.icon : '') || 'star',
    emoji,
    color: d.color,
    type: old ? old.type : d.type,
  });
  const order = old
    ? s.categoryOrder
    : { ...s.categoryOrder, [cat.type]: [...s.categoryOrder[cat.type], k] };
  useAppStore.setState({ categories: { ...s.categories, [k]: cat }, categoryOrder: order });
  useAppStore.getState().saveSoon();
  return k;
}

/** Удаляет категорию: операции переходят в `to` или удаляются вместе с ней. */
export function removeCategory(k: string, to?: string) {
  useAppStore.getState().deleteCategory(k, to);
  useAppStore.getState().saveNow();
}
