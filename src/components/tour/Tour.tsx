import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import '../../styles/tour.css';
import { L } from '../../i18n';
import { haptic } from '../../services/telegram';
import { useSettingsStore } from '../../store/useSettingsStore';
import {
  TOUR_EVENT,
  TOUR_PAD,
  TOUR_ARROW,
  TOUR_STEPS,
  Rect,
  TourStep,
  TourTab,
  cutRect,
  isTourDone,
  markTourDone,
  placeCard,
} from '../../lib/tour';

/* Обучающий тур: затемнение с вырезом под элемент и карточка со стрелкой.
   Один раз при первом запуске и по кнопке «Показать обучение» в Настройках. */

interface Props {
  goTab: (tab: TourTab) => void;
}

const frames = (n: number) =>
  new Promise<void>(res => {
    const step = (k: number) => (k <= 0 ? res() : requestAnimationFrame(() => step(k - 1)));
    step(n);
  });

const wait = (ms: number) => new Promise<void>(res => setTimeout(res, ms));

const isShown = (el: Element | null): el is HTMLElement => !!el && (el as HTMLElement).getClientRects().length > 0;

function findTarget(step: TourStep): { el: HTMLElement; r: number } | null {
  for (const t of step.targets) {
    const el = document.querySelector(t.sel);
    if (isShown(el)) return { el, r: t.r };
  }
  return null;
}

export const Tour: React.FC<Props> = ({ goTab }) => {
  const hapticOn = useSettingsStore(s => s.haptic);
  const lang = useSettingsStore(s => s.lang);
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [i, setI] = useState(0);
  const [cut, setCut] = useState<Rect | null>(null);
  const [radius, setRadius] = useState(28);
  const [ready, setReady] = useState(false);
  const [cardH, setCardH] = useState(150);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const cardRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<{ el: HTMLElement; r: number } | null>(null);
  const goTabRef = useRef(goTab);
  goTabRef.current = goTab;
  const activeRef = useRef(false);
  const runRef = useRef(0);

  const finish = useCallback(() => {
    runRef.current++;
    markTourDone();
    activeRef.current = false;
    targetRef.current = null;
    setSteps(null);
    setCut(null);
    setReady(false);
    setI(0);
    goTabRef.current('home');
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
    if (!t || !t.el.isConnected) return;
    const b = t.el.getBoundingClientRect();
    setCut(cutRect(b, TOUR_PAD));
    setRadius(t.r + TOUR_PAD);
  }, []);

  /* переход на шаг: нужная вкладка, прокрутка к элементу, замер */
  useEffect(() => {
    if (!steps) return;
    const step = steps[i];
    if (!step) return;
    const run = ++runRef.current;
    setReady(false);
    (async () => {
      goTabRef.current(step.tab);
      await frames(2);
      let found = findTarget(step);
      for (let k = 0; !found && k < 5; k++) {
        await wait(50);
        if (run !== runRef.current) return;
        found = findTarget(step);
      }
      if (run !== runRef.current) return;
      if (!found) {
        /* элемента нет: пропускаем шаг */
        if (i < steps.length - 1) setI(i + 1);
        else finish();
        return;
      }
      targetRef.current = found;
      const inBar = !!found.el.closest('.tabbar');
      if (!inBar) {
        const app = document.getElementById('app');
        const b = found.el.getBoundingClientRect();
        const vh = window.innerHeight;
        if (app && (b.top < 24 || b.bottom > vh - 140)) {
          const want = Math.round(vh * 0.22);
          app.scrollTop = Math.max(0, Math.round(app.scrollTop + b.top - want));
          await frames(2);
          if (run !== runRef.current) return;
        }
      }
      measure();
      await wait(60);
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
      ro.observe(t.el);
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

  if (!steps || !cut) return null;
  const step = steps[i];
  if (!step) return null;
  const last = i === steps.length - 1;
  const place = placeCard(cut, vp.w, vp.h, cardH);

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
      <div
        className="tour-cut"
        style={{ left: cut.x, top: cut.y, width: cut.w, height: cut.h, borderRadius: radius }}
      />
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
        <div className="tour-arrow" style={{ left: place.arrowX - TOUR_ARROW / 2 }} />
        <h2 className="tour-title">{L(step.title)}</h2>
        <p className="tour-text">{L(step.text)}</p>
        <div className="tour-foot">
          <button type="button" className={'tour-skip' + (last ? ' off' : '')} onClick={skip} tabIndex={last ? -1 : 0}>
            {L('Пропустить')}
          </button>
          <div className="tour-dots" aria-hidden="true">
            {steps.map((s, k) => (
              <i key={s.id} className={k === i ? 'on' : ''} />
            ))}
          </div>
          <button type="button" className="tour-next" onClick={next}>
            {L(last ? 'Поехали' : 'Далее')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
