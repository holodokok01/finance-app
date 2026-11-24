import { useRef, useEffect } from 'react';
import { haptic } from '../services/telegram';

interface UsePullToCloseOptions {
  onClose: () => void;
  threshold?: number;
  enabled?: boolean;
}

export function usePullToClose({ onClose, threshold = 110, enabled = true }: UsePullToCloseOptions) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || !enabled) return;

    let y0 = 0;
    let dy = 0;
    let lastY = 0;
    let lastT = 0;
    let vel = 0;
    let armed = false;
    let dragging = false;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || (e.target as HTMLElement).closest('input, textarea, [contenteditable]')) {
        armed = false;
        return;
      }
      armed = panel.scrollTop <= 0;
      dragging = false;
      y0 = lastY = e.touches[0].clientY;
      lastT = performance.now();
      vel = 0;
      dy = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!armed) return;
      const y = e.touches[0].clientY;
      dy = y - y0;

      if (!dragging) {
        if (panel.scrollTop > 0 || dy < 0) {
          armed = false;
          return;
        }
        if (dy < 8) return;
        dragging = true;
        panel.classList.add('drag');
      }

      if (e.cancelable) e.preventDefault();
      const now = performance.now();
      vel = (y - lastY) / Math.max(1, now - lastT);
      lastY = y;
      lastT = now;

      panel.style.transform = `translate(-50%, ${Math.round(dy)}px)`;
    };

    const onTouchEnd = () => {
      if (!dragging) {
        armed = false;
        return;
      }
      dragging = false;
      armed = false;
      panel.classList.remove('drag');

      if (dy > threshold || vel > 0.5) {
        haptic('light');
        onClose();
      } else {
        panel.style.transform = '';
      }
    };

    panel.addEventListener('touchstart', onTouchStart, { passive: true });
    panel.addEventListener('touchmove', onTouchMove, { passive: false });
    panel.addEventListener('touchend', onTouchEnd);
    panel.addEventListener('touchcancel', onTouchEnd);

    return () => {
      panel.removeEventListener('touchstart', onTouchStart);
      panel.removeEventListener('touchmove', onTouchMove);
      panel.removeEventListener('touchend', onTouchEnd);
      panel.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [enabled, onClose, threshold]);

  return { panelRef };
}
