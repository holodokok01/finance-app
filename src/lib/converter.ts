import { LangCode } from '../types/settings';
import { groupThousands } from './balance';

/* Конвертер: список валют, база и сумма (хранятся в cv_v1), форматирование чисел и названия валют (перенос из legacy) */

export interface CvState {
  list: string[];
  base: string;
  amount: number;
}

export const CV_DEFAULT: CvState = { list: ['EUR', 'USD', 'UAH'], base: 'EUR', amount: 100 };
export const CV_POP = ['EUR', 'USD', 'UAH', 'GBP', 'PLN', 'BGN', 'RON', 'CHF', 'CZK', 'TRY'];

export function loadCv(): CvState {
  try {
    const s = JSON.parse(localStorage.getItem('cv_v1') || 'null');
    if (s && Array.isArray(s.list) && s.list.length) return { list: s.list, base: s.base, amount: +s.amount || 0 };
  } catch (e) {}
  return { ...CV_DEFAULT, list: CV_DEFAULT.list.slice() };
}

export function saveCv(s: CvState): void {
  try {
    localStorage.setItem('cv_v1', JSON.stringify(s));
  } catch (e) {}
}

const names: Record<string, Intl.DisplayNames | null> = {};

export function cvName(code: string, lang: LangCode): string {
  if (!(lang in names)) {
    try {
      names[lang] = new Intl.DisplayNames([lang], { type: 'currency' });
    } catch (e) {
      names[lang] = null;
    }
  }
  let n = '';
  try {
    n = names[lang] ? names[lang]!.of(code) || '' : '';
  } catch (e) {}
  if (!n || n === code) n = code;
  return n.charAt(0).toUpperCase() + n.slice(1);
}

/** Число в строке конвертера: до 2 знаков, для мелких значений больше, хвостовые нули убираются. */
export function cvFmt(v: number): string {
  if (!v) return '0';
  const a = Math.abs(v);
  const d = a >= 1 ? 2 : Math.min(6, Math.max(2, Math.ceil(-Math.log10(a)) + 2));
  const p = a.toFixed(d).split('.');
  const frac = (p[1] || '').replace(/0+$/, '');
  return groupThousands(+p[0]) + (frac ? ',' + frac : '');
}
