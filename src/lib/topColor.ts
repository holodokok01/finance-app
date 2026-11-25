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

/** Цвет шапки для тёмной темы по текущей прокрутке или null, если вариант не включён. */
export function topHeaderColor(): string | null {
  const variant = document.documentElement.getAttribute('data-top');
  if (!variant || !START[variant]) return null;
  const app = document.getElementById('app');
  const panel = document.querySelector('.panel') as HTMLElement | null;
  const h = panel ? panel.offsetHeight : 0;
  const t = app && h ? Math.max(0, Math.min(1, app.scrollTop / h)) : 0;
  return mix(START[variant], END, t);
}

export function applyTopHeaderColor(): void {
  if (document.documentElement.getAttribute('data-theme') !== 'dark') return;
  const c = topHeaderColor();
  const tg = getTelegramWebApp();
  if (!c || !tg || !tg.setHeaderColor) return;
  try {
    tg.setHeaderColor(c);
  } catch (e) {}
}
