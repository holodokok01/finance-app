/**
 * Один общий менеджер клавиатуры для всех модалов.
 *
 * Как ведёт себя Telegram на iPhone: при фокусе окно приложения сразу становится ниже
 * на высоту клавиатуры, а сама клавиатура выезжает ещё ~270 мс. Если слой модала
 * меняет высоту вместе с окном, всё содержимое прыгает за один кадр.
 *
 * Поэтому высота слоя (.detail) идёт плавно, по той же кривой, что и клавиатура iOS:
 * низ панели всё время лежит на верхнем краю клавиатуры. Высота пишется в переменную
 * --app-h прямо на слои, без перерисовки React.
 */

const DUR = 270;
const KB_KEY = 'kb_h';

/* cubic-bezier(.35, .15, .35, 1): подобрана по кадрам записи экрана iPhone */
const bez = (x1: number, y1: number, x2: number, y2: number) => {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x;
      const d = dx(t);
      if (Math.abs(e) < 1e-5 || !d) break;
      t -= e / d;
    }
    return sy(Math.min(1, Math.max(0, t)));
  };
};
const ease = bez(0.35, 0.15, 0.35, 1);

const tgPlatform = () => {
  const w = window as unknown as { Telegram?: { WebApp?: { platform?: string } } };
  return (w.Telegram && w.Telegram.WebApp && w.Telegram.WebApp.platform) || '';
};
const inTelegram = () => {
  const p = tgPlatform();
  return !!p && p !== 'unknown';
};
const onIOS = () => tgPlatform() === 'ios' || /iPhone|iPad|iPod/.test(navigator.userAgent);

export const isTextField = (el: EventTarget | null): el is HTMLElement => {
  const e = el as HTMLElement | null;
  if (!e || !e.tagName) return false;
  if (e.tagName === 'TEXTAREA') return true;
  if (e.tagName !== 'INPUT') return false;
  const t = (e as HTMLInputElement).type;
  return !t || ['text', 'search', 'number', 'tel', 'email', 'url', 'password'].includes(t);
};

const inSheet = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.('.detail, .sheet');

/** Цвет фона Telegram под окном: на время клавиатуры как у модала, чтобы у скруглённых углов клавиатуры не было чёрного */
const setTgBg = (useSheet: boolean) => {
  const w = window as unknown as {
    Telegram?: { WebApp?: { setBackgroundColor?: (c: string) => void; setBottomBarColor?: (c: string) => void } };
  };
  const tg = w.Telegram && w.Telegram.WebApp;
  if (!tg) return;
  const light = document.documentElement.getAttribute('data-theme') === 'light';
  const panel = getComputedStyle(document.documentElement).getPropertyValue('--panel').trim() || (light ? '#ffffff' : '#151619');
  const c = useSheet ? panel : light ? '#f2f2f7' : '#0b0b0d';
  try {
    if (tg.setBackgroundColor) tg.setBackgroundColor(c);
    if (tg.setBottomBarColor) tg.setBottomBarColor(c);
  } catch (e) {
    /* ignore */
  }
};

let users = 0;
let fullH = 0;
let focused = false;
let cur = 0; // текущая высота слоя
let from = 0;
let to = 0;
let t0 = 0;
let dur = DUR;
let raf = 0;
let tg = false;
let armT: ReturnType<typeof setTimeout> | undefined;
let sx = 0;
let sy = 0;
let timers: ReturnType<typeof setTimeout>[] = [];

/* iOS при фокусе в поле, которое закроет клавиатура, сам прокручивает страницу к нему,
   и модал дёргается туда и обратно. Поэтому клавиатуру открываем через невидимое поле
   вверху экрана (его ничто не закрывает), а в настоящее поле фокус переходит,
   когда модал уже поднялся над клавиатурой. */
let proxy: HTMLInputElement | null = null;
let pending: HTMLInputElement | HTMLTextAreaElement | null = null;
let pendT: ReturnType<typeof setTimeout> | undefined;

const getProxy = () => {
  if (proxy && proxy.isConnected) return proxy;
  proxy = document.createElement('input');
  proxy.type = 'text';
  proxy.setAttribute('aria-hidden', 'true');
  proxy.tabIndex = -1;
  proxy.style.cssText =
    'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;border:0;padding:0;margin:0;font-size:16px;pointer-events:none;caret-color:transparent;z-index:-1';
  document.body.appendChild(proxy);
  return proxy;
};

const scrollParent = (el: HTMLElement) => {
  let p = el.parentElement;
  while (p && p !== document.body) {
    const o = getComputedStyle(p).overflowY;
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight + 1) return p;
    p = p.parentElement;
  }
  return null;
};

/* пока модал поднимается, поле едет вместе с ним и не уходит под клавиатуру */
const keepInView = (el: HTMLElement, bottom: number) => {
  const r = el.getBoundingClientRect();
  const over = r.bottom - (bottom - 12);
  if (over <= 0) return;
  const sc = scrollParent(el);
  if (sc) sc.scrollTop += Math.ceil(over);
};

const handOver = () => {
  if (pendT) clearTimeout(pendT);
  pendT = undefined;
  const el = pending;
  pending = null;
  if (!el || !el.isConnected || document.activeElement !== proxy) return;
  keepInView(el, cur);
  const typed = proxy ? proxy.value : '';
  el.focus({ preventScroll: true });
  if (typed) {
    // что успели набрать до перехода, дописываем в поле (React узнаёт через событие input)
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const set = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    const max = el.maxLength > 0 ? el.maxLength : 9999;
    if (set) set.call(el, (el.value + typed).slice(0, max));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  if (proxy) proxy.value = '';
  try {
    const n = el.value.length;
    el.setSelectionRange(n, n);
  } catch (e) {
    /* ignore */
  }
};

/* поле, к которому относится касание: само поле или строка-подпись вокруг него */
const fieldOf = (t: HTMLElement | null) => {
  if (!t || !t.closest) return null;
  const own = t.closest('input, textarea') as HTMLElement | null;
  if (own) return own;
  if (t.closest('button, a, [role="button"]')) return null;
  const box = t.closest('label, [data-kb-box]');
  return box ? (box.querySelector('input:not([readonly]), textarea:not([readonly])') as HTMLElement | null) : null;
};

const winH = () => Math.min(window.innerHeight, document.documentElement.clientHeight || 99999);

const savedKb = () => {
  try {
    const v = Number(localStorage.getItem(KB_KEY) || 0);
    return v > 80 ? v : 0;
  } catch (e) {
    return 0;
  }
};

const unscroll = () => {
  const vv = window.visualViewport;
  if (window.scrollY !== 0 || (vv && vv.offsetTop !== 0)) {
    try {
      window.scrollTo(0, 0);
    } catch (e) {
      /* ignore */
    }
  }
};

const write = (h: number, atRest: boolean) => {
  const px = Math.round(h) + 'px';
  const root = document.documentElement;
  // переменную снимаем, только когда клавиатуры нет совсем: слой снова просто 100% окна
  const free = atRest && !focused && Math.abs(h - fullH) < 1 && Math.abs(h - winH()) < 1;
  document.querySelectorAll<HTMLElement>('.detail').forEach(el => {
    if (free) el.style.removeProperty('--app-h');
    else el.style.setProperty('--app-h', px);
  });
  // в покое значение лежит и на корне: модал, открытый уже при клавиатуре, сразу встанет на место
  if (free) root.style.removeProperty('--app-h');
  else if (atRest) root.style.setProperty('--app-h', px);
};

const frame = () => {
  raf = 0;
  /* Замер на iPhone: после тапа по полю страница ~100 мс стоит без кадров (iOS готовит клавиатуру).
     Отсчёт идёт от первого кадра после паузы, иначе подъём сразу перескакивает на середину. */
  if (t0 < 0) t0 = performance.now() - 16;
  const p = Math.min(1, (performance.now() - t0) / dur);
  cur = from + (to - from) * ease(p);
  unscroll();
  write(cur, p >= 1);
  if (pending) keepInView(pending, cur);
  if (p < 1) raf = requestAnimationFrame(frame);
  else if (pending) handOver();
};

const animateTo = (target: number) => {
  target = Math.round(target);
  if (raf && Math.abs(target - to) < 2) return;
  if (!raf && Math.abs(target - cur) < 2) {
    cur = target;
    to = target;
    write(cur, true);
    return;
  }
  const now = performance.now();
  // поправка во время движения (настоящая высота клавиатуры отличилась от запомненной): доезжаем за оставшееся время
  const moving = raf && t0 >= 0;
  const left = moving ? dur - (now - t0) : 0;
  from = cur;
  to = target;
  t0 = moving ? now : -1;
  dur = moving ? Math.max(140, left) : DUR;
  if (!raf) raf = requestAnimationFrame(frame);
};

const measure = () => {
  const vv = window.visualViewport;
  let h = winH();
  if (!focused && h > fullH) fullH = h;
  if (!fullH) fullH = h;
  if (!tg && vv) h = Math.min(h, Math.round(vv.height));
  const kb = fullH - h;
  if (focused && kb > 80) {
    try {
      localStorage.setItem(KB_KEY, String(kb));
    } catch (e) {
      /* ignore */
    }
  }
  // поле уже в фокусе, а окно ещё полное: поднимаемся на запомненную высоту клавиатуры вместе с ней
  if (focused && kb <= 80) h = fullH - (savedKb() || Math.round(fullH * 0.42));
  // клавиатура убрана, а окно ещё не вернулось: сразу едем вниз вместе с ней
  if (!focused && tg) h = Math.max(h, fullH);
  animateTo(h);
};

const later = () => {
  timers.forEach(clearTimeout);
  timers = [setTimeout(measure, 150), setTimeout(measure, 450), setTimeout(measure, 900)];
};

const onResize = () => {
  if (!focused) {
    const h = winH();
    // окно стало выше без клавиатуры (поворот, панель Telegram): это новая полная высота
    if (h > fullH || Math.abs(h - fullH) > 160) fullH = h;
  }
  measure();
};

const onFocusIn = (e: FocusEvent) => {
  if (isTextField(e.target) && inSheet(e.target)) {
    if (!focused) setTgBg(true);
    focused = true;
    measure();
  }
  later();
};

const onTouchStart = (e: TouchEvent) => {
  sx = e.touches[0].clientX;
  sy = e.touches[0].clientY;
};

// Подъём на отпускании пальца над полем: клавиатура стартует в этот же момент
const onTouchEnd = (e: TouchEvent) => {
  const field = fieldOf(e.target as HTMLElement | null);
  if (!field || !isTextField(field) || !inSheet(field) || focused) return;
  if ((field as HTMLInputElement).readOnly || (field as HTMLInputElement).disabled) return;
  const c = e.changedTouches[0];
  if (!c || Math.abs(c.clientX - sx) > 10 || Math.abs(c.clientY - sy) > 10) return;
  const kbH = savedKb() || Math.round(fullH * 0.42);
  // поле окажется под клавиатурой: открываем её через невидимое поле вверху, без прокрутки iOS
  if (onIOS() && e.cancelable && field.getBoundingClientRect().bottom > fullH - kbH - 12) {
    e.preventDefault();
    const px = getProxy();
    const f = field as HTMLInputElement;
    px.value = '';
    px.enterKeyHint = f.enterKeyHint || '';
    px.autocapitalize = f.autocapitalize || 'sentences';
    px.inputMode = f.inputMode || '';
    px.focus({ preventScroll: true });
    if (document.activeElement === px) {
      pending = f;
      focused = true;
      setTgBg(true);
      measure();
      if (pendT) clearTimeout(pendT);
      pendT = setTimeout(handOver, DUR + 150);
      return;
    }
  }
  focused = true;
  setTgBg(true);
  measure();
  if (armT) clearTimeout(armT);
  armT = setTimeout(() => {
    if (document.activeElement !== field && !isTextField(document.activeElement)) {
      focused = false;
      setTgBg(false);
      measure();
    }
  }, 500);
};

const onFocusOut = (e: FocusEvent) => {
  if (focused && !isTextField(e.relatedTarget)) {
    pending = null;
    focused = false;
    setTgBg(false);
    measure();
  }
  later();
};

const start = () => {
  tg = inTelegram();
  const h = winH();
  if (h > fullH) fullH = h;
  cur = to = h;
  unscroll();
  const vv = window.visualViewport;
  window.addEventListener('resize', onResize);
  window.addEventListener('scroll', unscroll, { passive: true });
  window.addEventListener('orientationchange', later);
  document.addEventListener('focusin', onFocusIn);
  document.addEventListener('focusout', onFocusOut);
  document.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
  document.addEventListener('touchend', onTouchEnd, { passive: false, capture: true });
  vv?.addEventListener('resize', onResize);
  vv?.addEventListener('scroll', unscroll);
  // модал открылся, когда поле уже в фокусе (редко): подхватываем
  if (isTextField(document.activeElement) && inSheet(document.activeElement)) {
    focused = true;
    setTgBg(true);
  }
  measure();
};

const stop = () => {
  const vv = window.visualViewport;
  window.removeEventListener('resize', onResize);
  window.removeEventListener('scroll', unscroll);
  window.removeEventListener('orientationchange', later);
  document.removeEventListener('focusin', onFocusIn);
  document.removeEventListener('focusout', onFocusOut);
  document.removeEventListener('touchstart', onTouchStart, { capture: true } as EventListenerOptions);
  document.removeEventListener('touchend', onTouchEnd, { capture: true } as EventListenerOptions);
  vv?.removeEventListener('resize', onResize);
  vv?.removeEventListener('scroll', unscroll);
  timers.forEach(clearTimeout);
  timers = [];
  if (armT) clearTimeout(armT);
  if (pendT) clearTimeout(pendT);
  pending = null;
  if (proxy && document.activeElement === proxy) proxy.blur();
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  if (focused) setTgBg(false);
  focused = false;
  cur = to = winH();
  document.documentElement.style.removeProperty('--app-h');
};

/** Высота слоя без системной клавиатуры: к ней слой придёт, когда клавиатура уберётся */
export function keyboardRestHeight() {
  return fullH || winH();
}

/** Модал открыт: менеджер слушает клавиатуру, пока открыт хоть один */
export function keyboardAcquire() {
  users++;
  if (users === 1) start();
  else write(cur, !raf);
}

export function keyboardRelease() {
  users = Math.max(0, users - 1);
  if (users === 0) stop();
}
