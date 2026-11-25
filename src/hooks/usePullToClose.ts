import React, { useEffect, useMemo, useState } from 'react';
import { haptic } from '../services/telegram';

interface UsePullToCloseOptions {
  onClose: () => void;
  threshold?: number;
  enabled?: boolean;
  /** Если прокручивается не сама панель, а вложенный блок */
  scrollRef?: React.RefObject<HTMLElement>;
}

type PanelRef = React.RefObject<HTMLDivElement> & ((node: HTMLDivElement | null) => void);

export function usePullToClose({ onClose, threshold = 110, enabled = true, scrollRef }: UsePullToCloseOptions) {
  // Ссылка-функция с полем current: хук узнаёт, когда панель появилась в DOM (шиты монтируются позже открытия)
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  const panelRef = useMemo(() => {
    const f = ((node: HTMLDivElement | null) => {
      (f as any).current = node;
      setPanel(node);
    }) as PanelRef;
    (f as any).current = null;
    return f;
  }, []);

  useEffect(() => {
    if (!panel || !enabled) return;

    let y0 = 0;
    let dy = 0;
    let lastY = 0;
    let lastT = 0;
    let vel = 0;
    let armed = false;
    let dragging = false;
    // Прокрутка важна, только если касание началось внутри прокручиваемого блока; шапка и остальное тянутся всегда
    let inScroll = false;

    const top = () => (inScroll && scrollRef && scrollRef.current ? scrollRef.current.scrollTop : inScroll ? panel.scrollTop : 0);

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || (e.target as HTMLElement).closest('input, textarea, [contenteditable]')) {
        armed = false;
        return;
      }
      inScroll = scrollRef && scrollRef.current ? scrollRef.current.contains(e.target as Node) : true;
      armed = top() <= 0;
      dragging = false;
      y0 = lastY = e.touches[0].clientY;
      lastT = performance.now();
      vel = 0;
      dy = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!armed) return;
      if (e.defaultPrevented) {
        armed = false; // жест забрал вложенный элемент (например, свайп строки)
        return;
      }
      const y = e.touches[0].clientY;
      dy = y - y0;

      if (!dragging) {
        if (top() > 0 || dy < 0) {
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
        // Панель уезжает вниз с анимацией; inline-стиль снимаем, когда она уже закрыта
        panel.style.transform = 'translate(-50%, 100%)';
        onClose();
        setTimeout(() => {
          panel.style.transform = '';
        }, 420);
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
  }, [panel, enabled, onClose, threshold, scrollRef]);

  return { panelRef };
}
