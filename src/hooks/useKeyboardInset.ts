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
let fullH = 0;
const KB_KEY = 'kb_h';

const isTextField = (el: EventTarget | null): el is HTMLElement => {
  const e = el as HTMLElement | null;
  if (!e || !e.tagName) return false;
  if (e.tagName === 'TEXTAREA') return true;
  if (e.tagName !== 'INPUT') return false;
  const t = (e as HTMLInputElement).type;
  return !t || ['text', 'search', 'number', 'tel', 'email', 'url', 'password'].includes(t);
};

/** Цвет фона Telegram под окном: на время клавиатуры как у модала, чтобы у скруглённых углов клавиатуры не было чёрного */
const setTgBg = (useSheet: boolean) => {
  const w = window as unknown as {
    Telegram?: { WebApp?: { setBackgroundColor?: (c: string) => void; setBottomBarColor?: (c: string) => void } };
  };
  const tg = w.Telegram && w.Telegram.WebApp;
  if (!tg) return;
  const light = document.documentElement.getAttribute('data-theme') === 'light';
  const panel = getComputedStyle(document.documentElement).getPropertyValue('--panel').trim() || (light ? '#ffffff' : '#0f1012');
  const c = useSheet ? panel : light ? '#f2f2f7' : '#000000';
  try {
    if (tg.setBackgroundColor) tg.setBackgroundColor(c);
    if (tg.setBottomBarColor) tg.setBottomBarColor(c);
  } catch (e) {
    /* ignore */
  }
};

export function useKeyboardInset(active: boolean): { height: number; kb: number; oy: number } {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!active) return;
    const vv = window.visualViewport;
    const tg = inTelegram();
    let focused = false;
    const savedKb = () => {
      try {
        const v = Number(localStorage.getItem(KB_KEY) || 0);
        return v > 80 ? v : 0;
      } catch (e) {
        return 0;
      }
    };
    const measure = () => {
      const cur = Math.min(window.innerHeight, document.documentElement.clientHeight || 99999);
      if (cur > fullH) fullH = cur;
      let h = cur;
      if (!tg && vv) h = Math.min(h, Math.round(vv.height));
      const kb = fullH - h;
      if (focused && kb > 80) {
        try {
          localStorage.setItem(KB_KEY, String(kb));
        } catch (e) {
          /* ignore */
        }
      }
      // клавиатура ещё не открылась (окно полное), а поле уже в фокусе: держим заранее поднятое положение
      if (focused && kb <= 80) {
        const pk = savedKb() || Math.round(fullH * 0.43);
        h = fullH - pk;
      }
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
    const inSheet = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.('.detail, .sheet');
    // Фокус в поле: сразу поднимаем панель на запомненную высоту клавиатуры, не дожидаясь Telegram
    const onFocusIn = (e: FocusEvent) => {
      if (isTextField(e.target) && inSheet(e.target)) {
        focused = true;
        setTgBg(true);
        measure();
      }
      later();
    };
    const onFocusOut = (e: FocusEvent) => {
      if (focused && !isTextField(e.relatedTarget)) {
        focused = false;
        setTgBg(false);
        // сразу опускаем: окно вернётся к полной высоте
        if (tg) setHeight(fullH);
        else measure();
      }
      later();
    };
    measure();
    unscroll();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', unscroll, { passive: true });
    window.addEventListener('orientationchange', later);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    vv?.addEventListener('resize', measure);
    vv?.addEventListener('scroll', unscroll);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', unscroll);
      window.removeEventListener('orientationchange', later);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      if (focused) setTgBg(false);
      vv?.removeEventListener('resize', measure);
      vv?.removeEventListener('scroll', unscroll);
    };
  }, [active]);

  return { height, kb: 0, oy: 0 };
}
