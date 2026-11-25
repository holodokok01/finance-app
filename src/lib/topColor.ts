import { getTelegramWebApp } from '../services/telegram';

// Цвет шапки Telegram следует за градиентом верхнего блока при прокрутке. Цвета должны совпадать с --grad-start и --bg в base.css.
const COLORS = {
  dark: { start: '#082b45', end: '#0b0b0d', sheet: '#151619', other: '#0b0b0d' },
  // В светлой теме на других вкладках шапка осталась белой, как была
  light: { start: '#c9e4f8', end: '#f2f2f7', sheet: '#ffffff', other: '#ffffff' },
};
const theme = () => (document.documentElement.getAttribute('data-theme') === 'light' ? COLORS.light : COLORS.dark);
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
  const c = theme();
  if (document.querySelector('.detail.show, .sheet.show')) return c.sheet;
  const app = document.getElementById('app');
  const panel = document.querySelector('.panel') as HTMLElement | null;
  // Главная скрыта (другая вкладка): шапка цвета фона
  if (!panel || !panel.offsetHeight) return c.other;
  const h = panel.offsetHeight * GRAD_END;
  const raw = app && h ? Math.max(0, Math.min(1, app.scrollTop / h)) : 0;
  return mix(c.start, c.end, Math.round(raw * STEPS) / STEPS);
}

/** Цвет шапки по текущей прокрутке и теме. */
export function topHeaderColor(): string {
  const c = compute();
  last = c;
  return c;
}

function apply(): void {
  const c = compute();
  if (c === last) return;
  const tg = getTelegramWebApp();
  if (!tg || !tg.setHeaderColor) return;
  last = c;
  try {
    tg.setHeaderColor(c);
  } catch (e) {}
}

/** Перекрасить шапку сразу, например после смены вкладки. */
export function refreshTopColor(): void {
  apply();
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
