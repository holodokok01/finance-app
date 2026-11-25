import { getTelegramWebApp } from '../services/telegram';

// Цвет шапки Telegram следует за градиентом верхнего блока при прокрутке (тёмная тема).
const START = '#082b45';
const END = '#0b0b0d';
// Когда открыт шит или модал, под шапкой нет градиента, шапка серая как сам шит.
const SHEET = '#151619';
// Доля высоты блока, на которой градиент доходит до цвета фона. Должна совпадать с base.css.
export const GRAD_END = 0.6;
// Шапка перекрашивается ступенями, а не каждый кадр: вызов идёт в нативную часть и фризит скролл.
const STEPS = 6;

let last = '';

function rgb(hex: string): number[] {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
}

function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  const c = x.map((v, i) => Math.round(v + (y[i] - v) * t));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}

function compute(): string {
  if (document.querySelector('.detail.show, .sheet.show')) return SHEET;
  const app = document.getElementById('app');
  const panel = document.querySelector('.panel') as HTMLElement | null;
  const h = panel ? panel.offsetHeight * GRAD_END : 0;
  const raw = app && h ? Math.max(0, Math.min(1, app.scrollTop / h)) : 0;
  return mix(START, END, Math.round(raw * STEPS) / STEPS);
}

/** Цвет шапки для тёмной темы по текущей прокрутке. */
export function topHeaderColor(): string {
  const c = compute();
  last = c;
  return c;
}

function apply(): void {
  if (document.documentElement.getAttribute('data-theme') !== 'dark') return;
  const c = compute();
  if (c === last) return;
  const tg = getTelegramWebApp();
  if (!tg || !tg.setHeaderColor) return;
  last = c;
  try {
    tg.setHeaderColor(c);
  } catch (e) {}
}

export function startTopColor(): void {
  const app = document.getElementById('app');
  if (!app) return;
  let raf = 0;
  const schedule = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      apply();
    });
  };
  app.addEventListener('scroll', schedule, { passive: true });
  // Шиты открываются и закрываются сменой класса show
  new MutationObserver(schedule).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
}
