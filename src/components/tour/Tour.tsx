import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import '../../styles/tour.css';
import { L } from '../../i18n';
import { haptic } from '../../services/telegram';
import { useSettingsStore } from '../../store/useSettingsStore';
import { squirclePathAt } from '../ui/Squircle';
import {
  TOUR_EVENT,
  TOUR_PAD,
  TOUR_RING,
  TOUR_ARROW_W,
  TOUR_STEPS,
  Rect,
  TourStep,
  TourTab,
  cutRect,
  isTourDone,
  markTourDone,
  placeCard,
  unionBox,
} from '../../lib/tour';

/* Обучающий тур: затемнение с вырезом под элемент и карточка со стрелкой.
   Вырез и синяя линия рисуются той же squircle-формулой, что и карточки приложения,
   поэтому углы совпадают с элементом, а зазор везде ровно TOUR_PAD. */

interface Props {
  goTab: (tab: TourTab) => void;
}

interface Shape {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}

interface Found {
  els: HTMLElement[];
  r: number;
  pad: number;
}

const frames = (n: number) =>
  new Promise<void>(res => {
    const step = (k: number) => (k <= 0 ? res() : requestAnimationFrame(() => step(k - 1)));
    step(n);
  });

const wait = (ms: number) => new Promise<void>(res => setTimeout(res, ms));

/* Плавная прокрутка тем же ease-out, что и у выреза: страница и рамка едут вместе */
const SCROLL_MS = 420;
const tweenScroll = (el: HTMLElement, from: number, to: number, cancelled: () => boolean) =>
  new Promise<void>(res => {
    const t0 = performance.now();
    const tick = (now: number) => {
      if (cancelled()) return res();
      const k = Math.min(1, (now - t0) / SCROLL_MS);
      const e = 1 - Math.pow(1 - k, 3);
      el.scrollTop = Math.round(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(tick);
      else res();
    };
    requestAnimationFrame(tick);
  });

const isShown = (el: Element | null): el is HTMLElement => !!el && (el as HTMLElement).getClientRects().length > 0;

function findTarget(step: TourStep): Found | null {
  for (const t of step.targets) {
    const list = Array.from(document.querySelectorAll(t.sel)).filter(isShown);
    if (list.length) return { els: t.all ? list : [list[0]], r: t.r, pad: t.pad ?? TOUR_PAD };
  }
  return null;
}

const same = (a: Rect | null, b: Rect) => !!a && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

const sq = (s: Shape, grow: number) => {
  const r = s.r + grow;
  return squirclePathAt(s.x - grow, s.y - grow, s.w + grow * 2, s.h + grow * 2, [r, r, r, r]);
};

export const Tour: React.FC<Props> = ({ goTab }) => {
  const hapticOn = useSettingsStore(s => s.haptic);
  const lang = useSettingsStore(s => s.lang);
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [i, setI] = useState(0);
  const [cut, setCut] = useState<Rect | null>(null);
  const [radius, setRadius] = useState(32);
  const [shape, setShape] = useState<Shape | null>(null);
  const [ready, setReady] = useState(false);
  const [cardH, setCardH] = useState(160);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const cardRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<Found | null>(null);
  const shapeRef = useRef<Shape | null>(null);
  const rafRef = useRef(0);
  const goTabRef = useRef(goTab);
  goTabRef.current = goTab;
  const activeRef = useRef(false);
  const runRef = useRef(0);
  const scrollingRef = useRef(false);

  const finish = useCallback(() => {
    runRef.current++;
    scrollingRef.current = false;
    markTourDone();
    activeRef.current = false;
    targetRef.current = null;
    shapeRef.current = null;
    cancelAnimationFrame(rafRef.current);
    setSteps(null);
    setCut(null);
    setShape(null);
    setReady(false);
    setI(0);
    goTabRef.current('home');
    document.getElementById('app')?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  /* старт: уходим на Главную, смотрим какие шаги реально есть на экране */
  const begin = useCallback(async () => {
    if (activeRef.current) return;
    activeRef.current = true;
    goTabRef.current('home');
    await frames(2);
    await wait(80);
    if (!activeRef.current) return;
    const list = TOUR_STEPS.filter(s => !s.needs || isShown(document.querySelector(s.needs)));
    setI(0);
    setReady(false);
    setSteps(list);
  }, []);

  useEffect(() => {
    const onStart = () => {
      begin();
    };
    window.addEventListener(TOUR_EVENT, onStart);
    let timer: number | undefined;
    if (!isTourDone()) timer = window.setTimeout(begin, 700);
    return () => {
      window.removeEventListener(TOUR_EVENT, onStart);
      if (timer) window.clearTimeout(timer);
    };
  }, [begin]);

  const measure = useCallback(() => {
    const t = targetRef.current;
    /* пока едет прокрутка, рамка уже стоит на конечном месте */
    if (scrollingRef.current) return;
    /* скрытый экран даёт нулевой прямоугольник в углу: такой замер игнорируем */
    if (!t || !t.els.every(e => e.isConnected && e.getClientRects().length > 0)) return;
    const box = unionBox(t.els.map(e => e.getBoundingClientRect()));
    if (box.width < 1 || box.height < 1) return;
    const next = cutRect(box, t.pad);
    setCut(prev => (same(prev, next) ? prev : next));
    setRadius(t.r + t.pad);
  }, []);

  /* вырез плавно переезжает к новому элементу, все значения целые */
  useEffect(() => {
    if (!cut) return;
    const to: Shape = { x: cut.x, y: cut.y, w: cut.w, h: cut.h, r: radius };
    const from = shapeRef.current;
    cancelAnimationFrame(rafRef.current);
    if (!from) {
      shapeRef.current = to;
      setShape(to);
      return;
    }
    const t0 = performance.now();
    const D = 420;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / D);
      const e = 1 - Math.pow(1 - k, 3);
      const m = (a: number, b: number) => Math.round(a + (b - a) * e);
      const cur: Shape = { x: m(from.x, to.x), y: m(from.y, to.y), w: m(from.w, to.w), h: m(from.h, to.h), r: m(from.r, to.r) };
      shapeRef.current = cur;
      setShape(cur);
      if (k < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [cut, radius]);

  /* переход на шаг: нужная вкладка, прокрутка к элементу, замер */
  useEffect(() => {
    if (!steps) return;
    const step = steps[i];
    if (!step) return;
    const run = ++runRef.current;
    /* старая цель больше не нужна: иначе замеры по скрытому экрану уводят рамку в угол */
    targetRef.current = null;
    setReady(false);
    (async () => {
      /* цель в таб-баре видна на любом экране: рамка сразу едет к ней, пока страница меняется */
      const pre = findTarget(step);
      const early = !!pre && !!pre.els[0].closest('.tabbar');
      const hadShape = !!shapeRef.current;
      let found: Found | null = null;
      if (early) {
        found = pre;
        targetRef.current = pre;
        measure();
        goTabRef.current(step.tab);
      } else {
        goTabRef.current(step.tab);
        await frames(2);
        if (run !== runRef.current) return;
        found = findTarget(step);
        for (let k = 0; !found && k < 5; k++) {
          await wait(50);
          if (run !== runRef.current) return;
          found = findTarget(step);
        }
      }
      if (run !== runRef.current) return;
      if (!found) {
        /* элемента нет: пропускаем шаг */
        if (i < steps.length - 1) setI(i + 1);
        else finish();
        return;
      }
      targetRef.current = found;
      let scrolled = false;
      const inBar = !!found.els[0].closest('.tabbar');
      if (!inBar) {
        const app = document.getElementById('app');
        const box = unionBox(found.els.map(e => e.getBoundingClientRect()));
        const vh = window.innerHeight;
        if (app && (box.top < 24 || box.top + box.height > vh - 140)) {
          const want = Math.round(vh * 0.22);
          const s0 = app.scrollTop;
          const max = Math.max(0, app.scrollHeight - app.clientHeight);
          const s1 = Math.max(0, Math.min(max, Math.round(s0 + box.top - want)));
          const delta = s1 - s0;
          if (delta !== 0) {
            /* рамка сразу едет на место, где элемент окажется после прокрутки */
            scrolled = true;
            scrollingRef.current = true;
            const next = cutRect({ ...box, top: box.top - delta }, found.pad);
            setCut(prev => (same(prev, next) ? prev : next));
            setRadius(found.r + found.pad);
            await tweenScroll(app, s0, s1, () => run !== runRef.current);
            scrollingRef.current = false;
            if (run !== runRef.current) return;
          }
        }
      }
      measure();
      /* карточка появляется, когда рамка доехала: без перекрытия в пути */
      await wait(hadShape && !scrolled ? SCROLL_MS - 40 : 60);
      if (run !== runRef.current) return;
      setReady(true);
    })();
  }, [steps, i, measure, finish]);

  /* размеры окна и самого элемента могут поменяться (Telegram, шрифты, облако) */
  useEffect(() => {
    if (!steps) return;
    const onResize = () => {
      setVp({ w: window.innerWidth, h: window.innerHeight });
      measure();
    };
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    let ro: ResizeObserver | null = null;
    const t = targetRef.current;
    if (t && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => measure());
      t.els.forEach(e => ro!.observe(e));
    }
    const late = window.setTimeout(measure, 400);
    return () => {
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
      ro?.disconnect();
      window.clearTimeout(late);
    };
  }, [steps, i, ready, measure]);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (el && el.offsetHeight && el.offsetHeight !== cardH) setCardH(el.offsetHeight);
  });

  if (!steps || !cut || !shape) return null;
  const step = steps[i];
  if (!step) return null;
  const last = i === steps.length - 1;
  /* карточка отступает от внешнего края синей линии */
  const place = placeCard(
    { x: cut.x - TOUR_RING, y: cut.y - TOUR_RING, w: cut.w + TOUR_RING * 2, h: cut.h + TOUR_RING * 2 },
    vp.w,
    vp.h,
    cardH
  );

  const next = () => {
    haptic('light', hapticOn);
    if (last) finish();
    else setI(i + 1);
  };
  const skip = () => {
    haptic('light', hapticOn);
    finish();
  };

  return createPortal(
    <div className="tour" data-lang={lang} role="dialog" aria-modal="true" onTouchMove={e => e.preventDefault()}>
      <svg className="tour-svg" aria-hidden="true">
        <path className="tour-dim" d={`M-2000 -2000H4000V4000H-2000Z ${sq(shape, 0)}`} />
        <path className="tour-ring" d={sq(shape, 1)} />
      </svg>
      <div
        key={i}
        ref={cardRef}
        className={`tour-card ${place.side}${ready ? ' ready' : ''}`}
        style={{
          left: place.left,
          top: place.top,
          width: place.width,
          transformOrigin: `${place.arrowX}px ${place.side === 'below' ? '0' : '100%'}`,
        }}
      >
        <svg
          className="tour-arrow"
          width={TOUR_ARROW_W}
          height={10}
          viewBox="0 0 28 10"
          style={{ left: place.arrowX - TOUR_ARROW_W / 2 }}
          aria-hidden="true"
        >
          <path d="M0 10 C8 10 10 7 11 5 C12 3 13 2 14 2 C15 2 16 3 17 5 C18 7 20 10 28 10 Z" />
        </svg>
        <h2 className="tour-title">{L(step.title)}</h2>
        <p className="tour-text">{L(step.text)}</p>
        <div className="tour-foot">
          <div className="tour-dots" aria-hidden="true">
            {steps.map((s, k) => (
              <i key={s.id} className={k === i ? 'on' : ''} />
            ))}
          </div>
          <div className="tour-btns">
            {!last && (
              <button type="button" className="tour-skip" onClick={skip}>
                {L('Пропустить')}
              </button>
            )}
            <button type="button" className="tour-next" onClick={next}>
              {L(last ? 'Поехали' : 'Далее')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
