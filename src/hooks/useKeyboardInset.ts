import { useEffect, useState } from 'react';

const inTelegram = () => {
  const w = window as unknown as { Telegram?: { WebApp?: { platform?: string } } };
  const p = w.Telegram && w.Telegram.WebApp && w.Telegram.WebApp.platform;
  return !!p && p !== 'unknown';
};

/**
 * Высота слоя шита.
 * Замеры на iPhone в Telegram: при клавиатуре Telegram сам уменьшает окно приложения
 * (innerHeight 800 → 453), а visualViewport догоняет позже. Поэтому в Telegram верим только
 * innerHeight: шит просто становится ниже вместе с окном, без своих сдвигов.
 * iOS при этом ещё и прокручивает страницу к полю (scrollY 362): пока открыт шит, сразу
 * возвращаем прокрутку на 0, иначе весь слой уезжает вниз.
 * В обычном браузере окно не меняется, там берём visualViewport.
 */
export function useKeyboardInset(active: boolean): { height: number; kb: number; oy: number } {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!active) return;
    const vv = window.visualViewport;
    const tg = inTelegram();
    const measure = () => {
      let h = Math.min(window.innerHeight, document.documentElement.clientHeight || 99999);
      if (!tg && vv) h = Math.min(h, Math.round(vv.height));
      setHeight(prev => (prev === h ? prev : h));
    };
    const unscroll = () => {
      if (window.scrollY !== 0 || (vv && vv.offsetTop !== 0)) {
        try {
          window.scrollTo(0, 0);
        } catch (e) {
          /* ignore */
        }
      }
    };
    let timers: ReturnType<typeof setTimeout>[] = [];
    const later = () => {
      timers.forEach(clearTimeout);
      timers = [setTimeout(measure, 120), setTimeout(measure, 400), setTimeout(measure, 800)];
    };
    measure();
    unscroll();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', unscroll, { passive: true });
    window.addEventListener('orientationchange', later);
    document.addEventListener('focusin', later);
    document.addEventListener('focusout', later);
    vv?.addEventListener('resize', measure);
    vv?.addEventListener('scroll', unscroll);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', unscroll);
      window.removeEventListener('orientationchange', later);
      document.removeEventListener('focusin', later);
      document.removeEventListener('focusout', later);
      vv?.removeEventListener('resize', measure);
      vv?.removeEventListener('scroll', unscroll);
    };
  }, [active]);

  return { height, kb: 0, oy: 0 };
}
