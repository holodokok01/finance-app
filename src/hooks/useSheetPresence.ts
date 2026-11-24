import { useEffect, useState } from 'react';
import { useKeyboardInset } from './useKeyboardInset';

/**
 * Показ шита с анимацией: сначала монтируем, на следующем кадре добавляем .show,
 * при закрытии ждём конец анимации. Высота не зависит от клавиатуры: iOS сжимает
 * visualViewport и не всегда возвращает, из-за чего внизу оставалась чёрная полоса.
 */
export function useSheetPresence(open: boolean, onShow?: () => void) {
  const [rendered, setRendered] = useState(open);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (open) {
      setRendered(true);
      let r2 = 0;
      const r1 = requestAnimationFrame(() => {
        r2 = requestAnimationFrame(() => {
          setShow(true);
          if (onShow) onShow();
        });
      });
      return () => {
        cancelAnimationFrame(r1);
        cancelAnimationFrame(r2);
      };
    }
    setShow(false);
    const t = setTimeout(() => setRendered(false), 360);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const { height, kb, oy } = useKeyboardInset(rendered);

  // Страница под шитом не скроллится; счётчик, чтобы вложенные шиты не снимали блок друг у друга
  useEffect(() => {
    if (!open) return;
    const app = document.querySelector('.app');
    if (!app) return;
    const n = Number(app.getAttribute('data-locks') || '0') + 1;
    app.setAttribute('data-locks', String(n));
    app.classList.add('locked');
    return () => {
      const m = Math.max(0, Number(app.getAttribute('data-locks') || '1') - 1);
      app.setAttribute('data-locks', String(m));
      if (m === 0) app.classList.remove('locked');
    };
  }, [open]);

  return { rendered, show, height, kb, oy };
}
