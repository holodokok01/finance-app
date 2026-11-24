import { useEffect, useState } from 'react';

let fullH = 0;

const readFull = () => {
  const h = Math.min(window.innerHeight, document.documentElement.clientHeight || 99999);
  if (h > fullH) fullH = h;
  return fullH;
};

/**
 * Высота шита всегда полная и не зависит от клавиатуры (иначе при открытии и закрытии
 * клавиатуры шит прыгает, а под ним остаётся незатемнённый кусок страницы).
 * Клавиатура учитывается отдельно: kb это высота, на которую панель шита поднимается над ней.
 * iOS не всегда присылает resize при закрытии клавиатуры, поэтому на focusout kb сбрасывается сразу
 * и проверяется ещё раз позже.
 */
export function useKeyboardInset(active: boolean): { height: number; kb: number } {
  const [state, setState] = useState({ height: 0, kb: 0 });

  useEffect(() => {
    if (!active) return;
    const vv = window.visualViewport;
    const measure = () => {
      const full = readFull();
      let kb = 0;
      if (vv) {
        const shrink = Math.round(full - vv.height - vv.offsetTop);
        kb = shrink > 80 ? shrink : 0;
      }
      setState(s => (s.height === full && s.kb === kb ? s : { height: full, kb }));
    };
    const onOrient = () => {
      fullH = 0;
      setTimeout(measure, 300);
    };
    let timers: ReturnType<typeof setTimeout>[] = [];
    const onFocusOut = () => {
      setState(s => (s.kb === 0 ? s : { ...s, kb: 0 }));
      timers.forEach(clearTimeout);
      timers = [setTimeout(measure, 250), setTimeout(measure, 700)];
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', onOrient);
    document.addEventListener('focusout', onFocusOut);
    vv?.addEventListener('resize', measure);
    vv?.addEventListener('scroll', measure);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', onOrient);
      document.removeEventListener('focusout', onFocusOut);
      vv?.removeEventListener('resize', measure);
      vv?.removeEventListener('scroll', measure);
    };
  }, [active]);

  return state;
}
