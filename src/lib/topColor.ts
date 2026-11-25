import { getTelegramWebApp } from '../services/telegram';

// ВРЕМЕННО вместе с SectionVariantSwitch: цвет шапки Telegram следует за градиентом при прокрутке.
const START: Record<string, string> = { grad: '#082b45', round: '#151619' };
const END = '#0b0b0d';

function rgb(hex: string): number[] {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
}

function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  const c = x.map((v, i) => Math.round(v + (y[i] - v) * t));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}

// Доля высоты блока, на которой градиент доходит до цвета фона. Должна совпадать с base.css.
export const GRAD_END = 0.6;
// Шапка Telegram перекрашивается ступенями, а не каждый кадр: вызов идёт в нативную часть и фризит скролл.
const STEPS = 6;

let last = '';

function compute(): string | null {
  const variant = document.documentElement.getAttribute('data-top');
  if (!variant || !START[variant]) return null;
  const app = document.getElementById('app');
  const panel = document.querySelector('.panel') as HTMLElement | null;
  const h = panel ? panel.offsetHeight * GRAD_END : 0;
  const raw = app && h ? Math.max(0, Math.min(1, app.scrollTop / h)) : 0;
  return mix(START[variant], END, Math.round(raw * STEPS) / STEPS);
}

/** Цвет шапки для тёмной темы по текущей прокрутке или null, если вариант не включён. */
export function topHeaderColor(): string | null {
  const c = compute();
  if (c) last = c;
  return c;
}

export function applyTopHeaderColor(): void {
  if (document.documentElement.getAttribute('data-theme') !== 'dark') return;
  const c = compute();
  if (!c || c === last) return;
  const tg = getTelegramWebApp();
  if (!tg || !tg.setHeaderColor) return;
  last = c;
  try {
    tg.setHeaderColor(c);
  } catch (e) {}
}
