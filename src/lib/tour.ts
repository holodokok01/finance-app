/* Обучающий тур: шаги, расчёт места карточки и флаг «тур пройден». Чистая логика, без React. */

export type TourTab = 'home' | 'stats' | 'convert' | 'settings';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TourTarget {
  sel: string;
  /* радиус скругления самого элемента, к нему добавится отступ выреза */
  r: number;
  /* true: подсветить сразу все найденные элементы одним общим вырезом */
  all?: boolean;
}

export interface TourStep {
  id: string;
  tab: TourTab;
  /* первый найденный и видимый элемент из списка */
  targets: TourTarget[];
  title: string;
  text: string;
  /* шаг показывается, только если этот элемент есть на Главной и не скрыт */
  needs?: string;
  /* сколько мс ждать после смены вкладки, пока доедет анимация */
  settle?: number;
}

export const TOUR_KEY = 'tour_v1';
export const TOUR_EVENT = 'tour:start';
/* зазор между элементом и синей линией */
export const TOUR_PAD = 4;
/* толщина синей линии, она лежит снаружи зазора */
export const TOUR_RING = 2;
/* от синей линии до карточки: стрелка 10 и 4 воздуха */
export const TOUR_GAP = 14;
export const TOUR_EDGE = 16;
export const TOUR_ARROW_W = 28;
export const TOUR_ARROW_H = 10;
/* стрелка не заходит на скруглённый угол карточки (радиус 20) */
export const TOUR_ARROW_INSET = 36;

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'add',
    tab: 'home',
    targets: [{ sel: '#scr-home .action:not(.disabled)', r: 30, all: true }],
    title: 'Добавь операцию',
    text: 'Нажми «Расход» или «Доход» и впиши сумму.',
  },
  {
    id: 'ops',
    tab: 'home',
    targets: [
      { sel: '#list .row', r: 16 },
      { sel: '#ops-card', r: 32 },
    ],
    title: 'Операции',
    text: 'Свайп влево по операции удаляет её.',
  },
  {
    id: 'pay',
    tab: 'home',
    targets: [{ sel: '#pay-sec .ops-card', r: 32 }],
    needs: '#pay-sec',
    title: 'Платежи',
    text: 'Добавь аренду и подписки, на Главной появится «Свободно».',
  },
  {
    id: 'stats',
    tab: 'stats',
    targets: [{ sel: '#tb-lens', r: 28 }],
    settle: 550,
    title: 'Статистика',
    text: 'Здесь видно, куда уходят деньги.',
  },
  {
    id: 'settings',
    tab: 'settings',
    targets: [{ sel: '#scr-settings .set-card', r: 28 }],
    title: 'Настройки',
    text: 'Здесь основная валюта, категории и обязательные платежи.',
  },
];

export function isTourDone(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === '1';
  } catch (e) {
    /* хранилище недоступно: не донимаем туром при каждом запуске */
    return true;
  }
}

export function markTourDone(): void {
  try {
    localStorage.setItem(TOUR_KEY, '1');
  } catch (e) {}
}

export function startTour(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(TOUR_EVENT));
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/* Общая рамка нескольких элементов */
export function unionBox(boxes: Box[]): Box {
  let l = Infinity;
  let t = Infinity;
  let r = -Infinity;
  let b = -Infinity;
  for (const x of boxes) {
    l = Math.min(l, x.left);
    t = Math.min(t, x.top);
    r = Math.max(r, x.left + x.width);
    b = Math.max(b, x.top + x.height);
  }
  return { left: l, top: t, width: r - l, height: b - t };
}

/* Прямоугольник выреза: размер элемента плюс отступ, все числа целые */
export function cutRect(el: Box, pad = TOUR_PAD): Rect {
  return {
    x: Math.round(el.left) - pad,
    y: Math.round(el.top) - pad,
    w: Math.round(el.width) + pad * 2,
    h: Math.round(el.height) + pad * 2,
  };
}

export interface CardPlace {
  left: number;
  top: number;
  width: number;
  side: 'below' | 'above';
  /* x стрелки внутри карточки, центр стрелки */
  arrowX: number;
}

/* Карточка снизу от выреза, а если места нет, то сверху. Стрелка смотрит в центр выреза. */
export function placeCard(t: Rect, vw: number, vh: number, cardH: number): CardPlace {
  const width = Math.min(vw - TOUR_EDGE * 2, 340);
  const cx = t.x + t.w / 2;
  const left = clamp(Math.round(cx - width / 2), TOUR_EDGE, vw - TOUR_EDGE - width);
  const below = t.y + t.h + TOUR_GAP + cardH <= vh - TOUR_EDGE;
  let top = below ? t.y + t.h + TOUR_GAP : t.y - TOUR_GAP - cardH;
  if (top < TOUR_EDGE) top = TOUR_EDGE;
  const arrowX = clamp(Math.round(cx - left), TOUR_ARROW_INSET, width - TOUR_ARROW_INSET);
  return { left, top: Math.round(top), width, side: below ? 'below' : 'above', arrowX };
}
