/* Досчёт числа до нового значения (общий для всего приложения).
   Промежуточные значения идут с той же точностью, что и конечное: если итог целый, считаем целыми,
   если с копейками, копейки видны всё время. Так в последнем кадре число не «прыгает». */

type El = HTMLElement & { _cu?: number };

export const COUNT_MS = 450;

export function countUp(el: El, from: number, to: number, paint: (el: HTMLElement, v: number) => void, dur = COUNT_MS): void {
  if (el._cu) cancelAnimationFrame(el._cu);
  el._cu = 0;
  if (from === to || isNaN(from)) {
    paint(el, to);
    return;
  }
  const cents = Math.round(Math.abs(to) * 100) % 100 !== 0;
  const round = (v: number) => (cents ? Math.round(v * 100) / 100 : Math.round(v));
  const t0 = performance.now();
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    paint(el, k < 1 ? round(from + (to - from) * e) : to);
    if (k < 1) el._cu = requestAnimationFrame(step);
    else el._cu = 0;
  };
  step(t0);
}

/* Числа, которые уже показывались в этом запуске приложения: «от нуля» считаем только при первом показе */
const seen = new Set<string>();

export function firstShow(id: string): boolean {
  if (seen.has(id)) return false;
  seen.add(id);
  return true;
}
