/* Прелоадер «Монетка» (разметка в index.html, скрипт в public/loader.js).
   Показывается минимум один бросок монетки (1,6 с), чтобы не мелькать, потом плавно скрывается. */

const MIN_MS = 1600;
let done = false;

export function hidePreloader(): void {
  if (done) return;
  done = true;
  const wait = Math.max(0, MIN_MS - performance.now());
  setTimeout(() => {
    const m = (window as any).MonetkaLoader;
    if (m && m.hide) m.hide();
  }, wait);
}
