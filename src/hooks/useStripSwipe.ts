import { useEffect, useRef } from 'react';
import { haptic } from '../services/telegram';

/* Свайп по полосе периодов (перенос из legacy): лента едет за пальцем как picker,
   быстрый флик пролетает несколько периодов и останавливается на ближайшем.
   Узлы React во время жеста не удаляются: iOS перестаёт слать touch-события, если тронутый узел исчез. */

const N = 24;

function mixGrey(t: number): string {
  const c = Math.round(99 + 156 * t);
  const b = Math.round(102 + 153 * t);
  return 'rgb(' + c + ',' + c + ',' + b + ')';
}

export interface StripSwipeState {
  k: number;
  canGoK: (kk: number) => boolean;
  label: (kk: number) => string;
  hapticOn: boolean;
}

interface Args {
  cardRef: React.RefObject<HTMLElement>;
  monthsRef: React.RefObject<HTMLElement>;
  stripRef: React.RefObject<HTMLElement>;
  getState: () => StripSwipeState;
  /** вызывается в конце: сдвиг на steps периодов (steps > 0 это в прошлое); cleanup убирает следы жеста */
  onFinish: (steps: number, cleanup: () => void) => void;
}

export function useStripSwipe({ cardRef, monthsRef, stripRef, getState, onFinish }: Args): void {
  const argsRef = useRef({ getState, onFinish });
  argsRef.current = { getState, onFinish };

  useEffect(() => {
    const card = cardRef.current;
    const months = monthsRef.current;
    if (!card || !months) return;

    let base = 0, x0 = 0, y0 = 0, mode = '', dx = 0, slot = 120, last = 0, lastT = 0, vel = 0;
    let maxOld = 0, maxNew = 0, step = 0, raf = 0;
    let strip: HTMLElement | null = null;
    let added: HTMLElement[] = [];
    let saved: { el: HTMLElement; cls: string }[] = [];

    const hap = (kind: 'select' | 'error') => haptic(kind, argsRef.current.getState().hapticOn);
    const slotW = () => parseFloat(months.style.getPropertyValue('--slot')) || 120;

    function fill(e: HTMLElement, o: number) {
      const ok = o <= maxOld && o >= -maxNew;
      e.setAttribute('data-o', String(o));
      e.classList.toggle('off', !ok);
    }

    function build() {
      const s = argsRef.current.getState();
      maxOld = 0;
      while (maxOld < N && s.canGoK(s.k + maxOld + 1)) maxOld++;
      maxNew = Math.min(s.k, N);
      strip = stripRef.current;
      if (!strip) return;
      const have = Array.from(strip.children) as HTMLElement[];
      saved = have.map(el => ({ el, cls: el.className }));
      have.forEach((e, j) => fill(e, 2 - j));
      added = [];
      for (let i = 3; i <= maxOld + 2; i++) {
        const a = document.createElement('div');
        a.className = 'st-m';
        a.textContent = s.label(s.k + i);
        fill(a, i);
        strip.insertBefore(a, strip.firstChild);
        added.push(a);
      }
      for (let i = -3; i >= -maxNew - 2; i--) {
        const z = document.createElement('div');
        z.className = 'st-m';
        z.textContent = s.label(s.k + i);
        fill(z, i);
        strip.appendChild(z);
        added.push(z);
      }
      strip.style.marginLeft = 'calc(var(--pad, 0px) - ' + (maxOld + 1) + ' * var(--slot, 0px))';
    }

    /* убрать следы жеста: добавленные узлы, сдвиг, стили; узлам React вернуть их классы */
    function cleanup() {
      added.forEach(a => a.remove());
      added = [];
      saved.forEach(({ el, cls }) => {
        el.className = cls;
        el.removeAttribute('data-o');
        el.style.scale = '';
        el.style.color = '';
      });
      saved = [];
      const st = stripRef.current;
      if (st) {
        st.style.translate = '';
        st.style.marginLeft = '';
      }
    }

    function limit(d: number) {
      const hi = maxOld * slot, lo = -maxNew * slot;
      if (d > hi) return hi + (d - hi) * 0.22;
      if (d < lo) return lo + (d - lo) * 0.22;
      return d;
    }

    function paint(d: number) {
      if (!strip) return;
      strip.style.translate = Math.round(d) + 'px 0';
      Array.from(strip.children).forEach(node => {
        const e = node as HTMLElement;
        const o = +(e.getAttribute('data-o') || 0);
        const x = d - o * slot;
        const t = Math.max(0, 1 - Math.abs(x) / slot);
        e.style.scale = String(Math.round((0.88 + 0.12 * t) * 1000) / 1000);
        e.style.color = e.classList.contains('off') ? '' : mixGrey(t);
      });
      const st = Math.round(d / slot);
      if (st !== step) {
        step = st;
        hap('select');
      }
    }

    function finish(steps: number) {
      strip = null;
      argsRef.current.onFinish(steps, cleanup);
    }

    function glide(from: number, steps: number) {
      const to = steps * slot;
      const t0 = performance.now();
      const dist = Math.abs(to - from);
      const D = Math.max(260, Math.min(700, dist * 1.6));
      cancelAnimationFrame(raf);
      const fr = (now: number) => {
        if (!strip) return;
        const k = Math.min(1, (now - t0) / D);
        const e = 1 - Math.pow(1 - k, 3);
        paint(from + (to - from) * e);
        if (k < 1) raf = requestAnimationFrame(fr);
        else finish(steps);
      };
      fr(t0);
    }

    function onStart(e: TouchEvent) {
      if (e.touches.length !== 1 || !(e.target as Element).closest('#st-months')) {
        mode = '';
        return;
      }
      x0 = last = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      lastT = performance.now();
      dx = 0;
      vel = 0;
      base = 0;
      if (strip) {
        cancelAnimationFrame(raf);
        base = dx = parseFloat(strip.style.translate) || 0;
        mode = 'x';
        return;
      }
      mode = '?';
      slot = slotW();
      step = 0;
    }

    function onMove(e: TouchEvent) {
      if (!mode || mode === 'y') return;
      const t = e.touches[0];
      const mx = t.clientX - x0;
      const my = t.clientY - y0;
      const now = performance.now();
      if (mode === '?') {
        if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
        mode = Math.abs(mx) > Math.abs(my) * 1.2 ? 'x' : 'y';
        if (mode === 'y') return;
        build();
      }
      if (e.cancelable) e.preventDefault();
      const v = (t.clientX - last) / Math.max(1, now - lastT);
      vel = vel * 0.4 + v * 0.6;
      last = t.clientX;
      lastT = now;
      dx = base + mx;
      paint(limit(dx));
    }

    function end(cancel: boolean) {
      const m = mode;
      mode = '';
      if (m !== 'x' || !strip) return;
      if (dx === base && !cancel) {
        const sn = Math.round(base / slot);
        glide(base, Math.max(-maxNew, Math.min(maxOld, sn)));
        return;
      }
      if (performance.now() - lastT > 80) vel = 0;
      const cur = limit(dx);
      const proj = cancel ? cur : cur + vel * 260;
      let steps = Math.max(-maxNew, Math.min(maxOld, Math.round(proj / slot)));
      if (!cancel && steps === Math.round(cur / slot) && Math.abs(vel) > 0.35 && Math.abs(cur - steps * slot) > 8) {
        const s2 = steps + (vel > 0 ? 1 : -1);
        if (s2 <= maxOld && s2 >= -maxNew) steps = s2;
      }
      if ((cur > maxOld * slot + 30 || cur < -maxNew * slot - 30) && !cancel) hap('error');
      glide(cur, steps);
    }

    const onEnd = () => end(false);
    const onCancel = () => end(true);
    card.addEventListener('touchstart', onStart, { passive: true });
    card.addEventListener('touchmove', onMove, { passive: false });
    card.addEventListener('touchend', onEnd);
    card.addEventListener('touchcancel', onCancel);
    return () => {
      cancelAnimationFrame(raf);
      card.removeEventListener('touchstart', onStart);
      card.removeEventListener('touchmove', onMove);
      card.removeEventListener('touchend', onEnd);
      card.removeEventListener('touchcancel', onCancel);
      if (strip) cleanup();
    };
  }, []);
}
