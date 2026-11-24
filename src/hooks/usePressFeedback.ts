import { useEffect } from 'react';

export function usePressFeedback() {
  useEffect(() => {
    if (typeof Element === 'undefined' || !Element.prototype.animate) return;

    const SEL = 'button, .row[data-id], .bcol, .st-donut path[data-cat], .cv-in';
    const SKIP = ".tabbar, .st-m, .cv-list.edit .cv-in, .cv-trash, [aria-disabled='true'], .disabled";
    const EASE_IN = 'cubic-bezier(.2, .8, .2, 1)';
    const still = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function target(el: HTMLElement): HTMLElement {
      return el.classList.contains('bcol') && el.firstElementChild ? (el.firstElementChild as HTMLElement) : el;
    }

    function amount(el: HTMLElement): string {
      if (el.classList.contains('bcol')) return '0.6 0.97';
      if (el.matches('.st-donut path')) return '0.94';
      if (el.matches('.row, .sm-row, .st-tip, .fp-row, .d-row, .mn-row')) return '0.98';
      if (el.matches('.pbtn, .action')) return '0.96';
      if (el.matches('.a-keys button, .a-ops button, .cv-keys button')) return '0.92';
      if (el.matches('.cv-in, .cva-row, .set-row')) return '0.98';
      return '0.93';
    }

    function nowScale(t: HTMLElement): string {
      const v = getComputedStyle(t).scale;
      return v && v !== 'none' ? v : '1';
    }

    interface PressData {
      el: HTMLElement;
      tgt: HTMLElement;
      to: string;
      x: number;
      y: number;
      at: number;
      t: ReturnType<typeof setTimeout> | 0;
      anim: Animation | null;
    }

    let cur: PressData | null = null;

    function down(p: PressData) {
      p.t = 0;
      p.at = performance.now();
      p.anim = p.tgt.animate([{ scale: nowScale(p.tgt) }, { scale: p.to }], {
        duration: 160,
        easing: EASE_IN,
        fill: 'forwards',
      });
    }

    function up(p: PressData) {
      if (!p.anim) return;
      const a = p.tgt.animate([{ scale: nowScale(p.tgt) }, { scale: '1' }], {
        duration: 260,
        easing: EASE_IN,
        fill: 'forwards',
      });
      p.anim.cancel();
      p.anim = null;
      a.onfinish = a.oncancel = () => {
        a.cancel();
      };
    }

    function release() {
      const p = cur;
      if (!p) return;
      cur = null;
      if (p.t) {
        clearTimeout(p.t);
        down(p);
      }
      const wait = Math.max(0, 110 - (performance.now() - p.at));
      if (wait) {
        setTimeout(() => up(p), wait);
      } else {
        up(p);
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      if (still || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const targetEl = e.target as HTMLElement | null;
      const el = targetEl?.closest ? (targetEl.closest(SEL) as HTMLElement | null) : null;
      if (!el || (el as any).disabled || el.closest(SKIP)) return;

      release();
      const p: PressData = (cur = {
        el,
        tgt: target(el),
        to: amount(el),
        x: e.clientX,
        y: e.clientY,
        at: 0,
        t: 0,
        anim: null,
      });

      p.t = setTimeout(() => down(p), 45);
      if (e.pointerType === 'mouse') {
        el.addEventListener('pointerleave', release, { once: true });
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (cur && Math.abs(e.clientX - cur.x) + Math.abs(e.clientY - cur.y) > 12) {
        release();
      }
    };

    const onPointerEnd = () => release();

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointermove', onPointerMove, { passive: true, capture: true });
    document.addEventListener('pointerup', onPointerEnd, true);
    document.addEventListener('pointercancel', onPointerEnd, true);
    document.addEventListener('dragstart', onPointerEnd, true);
    window.addEventListener('blur', release);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointermove', onPointerMove, true);
      document.removeEventListener('pointerup', onPointerEnd, true);
      document.removeEventListener('pointercancel', onPointerEnd, true);
      document.removeEventListener('dragstart', onPointerEnd, true);
      window.removeEventListener('blur', release);
    };
  }, []);
}
