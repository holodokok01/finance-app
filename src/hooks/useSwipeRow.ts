import { useRef, useState, useCallback, useEffect } from 'react';
import { haptic } from '../services/telegram';

interface UseSwipeRowOptions {
  openWidth?: number;
  onDelete: () => void;
  enabled?: boolean;
}

const CV_OPEN = 88;
const CV_SPRING = 'cubic-bezier(.25, 1.25, .4, 1)';

export function useSwipeRow({ openWidth = CV_OPEN, onDelete, enabled = true }: UseSwipeRowOptions) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [dx, setDx] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isArmed, setIsArmed] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const stateRef = useRef({
    x0: 0,
    y0: 0,
    lx: 0,
    lt: 0,
    vel: 0,
    mode: '?' as '?' | 'x' | 'y',
    base: 0,
    dx: 0,
    armed: false,
    active: false,
  });

  const closeSwipe = useCallback(() => {
    setIsAnimating(true);
    setDx(0);
    setIsOpen(false);
    setIsArmed(false);
    stateRef.current.base = 0;
    stateRef.current.dx = 0;
  }, []);

  const openSwipe = useCallback(() => {
    setIsAnimating(true);
    setDx(-openWidth);
    setIsOpen(true);
    setIsArmed(false);
    stateRef.current.base = -openWidth;
    stateRef.current.dx = -openWidth;
  }, [openWidth]);

  useEffect(() => {
    const el = rowRef.current;
    if (!el || !enabled) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || (e.target as HTMLElement).closest('.cv-grip, .cv-trash')) {
        stateRef.current.active = false;
        return;
      }
      stateRef.current = {
        x0: e.touches[0].clientX,
        y0: e.touches[0].clientY,
        lx: e.touches[0].clientX,
        lt: performance.now(),
        vel: 0,
        mode: '?',
        base: isOpen ? -openWidth : 0,
        dx: isOpen ? -openWidth : 0,
        armed: false,
        active: true,
      };
      setIsAnimating(false);
    };

    const onTouchMove = (e: TouchEvent) => {
      const s = stateRef.current;
      if (!s.active || s.mode === 'y') return;

      const t = e.touches[0];
      const mx = t.clientX - s.x0;
      const my = t.clientY - s.y0;
      const now = performance.now();

      if (s.mode === '?') {
        if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
        s.mode = Math.abs(mx) > Math.abs(my) * 1.2 ? 'x' : 'y';
        if (s.mode === 'y') {
          s.active = false;
          return;
        }
      }

      if (e.cancelable) e.preventDefault();

      s.vel = (t.clientX - s.lx) / Math.max(1, now - s.lt);
      s.lx = t.clientX;
      s.lt = now;

      let nextDx = s.base + mx;
      if (nextDx > 0) nextDx = nextDx * 0.2; // Rubber resistance to right
      s.dx = nextDx;

      const width = el.offsetWidth;
      const armed = -nextDx > width * 0.75;

      if (armed !== s.armed) {
        s.armed = armed;
        setIsArmed(armed);
        haptic(armed ? 'medium' : 'light');
      }

      setDx(nextDx);
    };

    const onTouchEnd = () => {
      const s = stateRef.current;
      if (!s.active || s.mode !== 'x') {
        s.active = false;
        return;
      }
      s.active = false;
      setIsAnimating(true);

      if (s.armed) {
        const width = el.offsetWidth;
        setDx(-width);
        haptic('medium');
        setTimeout(() => {
          onDelete();
        }, 240);
        return;
      }

      if (s.dx < -openWidth / 2 || s.vel < -0.5) {
        setDx(-openWidth);
        setIsOpen(true);
        s.base = -openWidth;
      } else {
        setDx(0);
        setIsOpen(false);
        s.base = 0;
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [enabled, isOpen, openWidth, onDelete]);

  return {
    rowRef,
    dx,
    isOpen,
    isArmed,
    isAnimating,
    openSwipe,
    closeSwipe,
    springEase: CV_SPRING,
  };
}
