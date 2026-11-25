import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Squircle } from '../ui/Squircle';
import { Flag } from '../ui/Flag';
import { CvPad } from './CvPad';
import { AddCurrencySheet } from './AddCurrencySheet';
import { useRatesStore } from '../../store/useRatesStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { tabbarAway } from '../../store/useToastStore';
import { RX_FALLBACK } from '../../services/rates';
import { haptic } from '../../services/telegram';
import { setRowSwipe, SWIPE_OPEN } from '../../lib/swipeRow';
import { groupThousands } from '../../lib/balance';
import { CV_DEFAULT, CvState, cvFmt, cvName, loadCv, saveCv } from '../../lib/converter';
import { CV_TRASH } from '../../assets/icons';
import { L, LOC } from '../../i18n';
import { LangCode } from '../../types/settings';

/* Экран «Конвертер»: список валют, ввод суммы с цифровой клавиатурой, добавление валюты,
   правка (удаление, перетаскивание порядка) и свайп строки с корзиной (перенос из legacy). */

const PENCIL =
  'm11.4 18.161l7.396-7.396a10.3 10.3 0 0 1-3.326-2.234a10.3 10.3 0 0 1-2.235-3.327L5.839 12.6c-.577.577-.866.866-1.114 1.184a6.6 6.6 0 0 0-.749 1.211c-.173.364-.302.752-.56 1.526l-1.362 4.083a1.06 1.06 0 0 0 1.342 1.342l4.083-1.362c.775-.258 1.162-.387 1.526-.56q.647-.308 1.211-.749c.318-.248.607-.537 1.184-1.114m9.448-9.448a3.932 3.932 0 0 0-5.561-5.561l-.887.887l.038.111a8.75 8.75 0 0 0 2.092 3.32a8.75 8.75 0 0 0 3.431 2.13z';

const GRIP =
  'M4 8.25a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H4.75A.75.75 0 0 1 4 8.25m0 3.75a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H4.75A.75.75 0 0 1 4 12m.75 3a.75.75 0 0 0 0 1.5h14.5a.75.75 0 0 0 0-1.5z';

const GLIDE = 'transform .3s cubic-bezier(.2, .9, .25, 1)';
const ty = (y: number) => 'translate3d(0,' + Math.round(y) + 'px,0)';

interface Props {
  /** вкладка «Конвертер» открыта; при уходе с неё клавиатура закрывается */
  active: boolean;
}

export const ConverterScreen: React.FC<Props> = ({ active }) => {
  const rates = useRatesStore(s => s.r);
  const live = useRatesStore(s => s.live);
  const ratesDate = useRatesStore(s => s.date);
  const lang = (useSettingsStore(s => s.lang) || 'ru') as LangCode;
  const hapticOn = useSettingsStore(s => s.haptic);

  const [cv, setCv] = useState<CvState>(loadCv);
  const [str, setStr] = useState('');
  const [fresh, setFresh] = useState(true);
  const [padOpen, setPadOpen] = useState(false);
  const [padH, setPadH] = useState(0);
  const [editing, setEditingState] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const padRef = useRef<HTMLDivElement>(null);
  const editBtnRef = useRef<HTMLButtonElement>(null);
  const openRow = useRef<HTMLElement | null>(null);
  const swipedAt = useRef(0);
  const dragging = useRef(false);
  const hapticRef = useRef(hapticOn);
  hapticRef.current = hapticOn;

  const hp = useCallback((k: Parameters<typeof haptic>[0]) => haptic(k, hapticOn), [hapticOn]);

  const rate = (c: string) => rates[c] || RX_FALLBACK[c] || 0;

  /* валюты без курса не показываются, но в сохранённом списке остаются (курсы могут ещё догружаться) */
  const list = useMemo(() => {
    const l = cv.list.filter(c => rate(c));
    return l.length ? l : CV_DEFAULT.list.slice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cv.list, rates]);
  const base = list.indexOf(cv.base) < 0 ? list[0] : cv.base;

  const value = (c: string) => {
    if (c === base) return cv.amount;
    const b = rate(base);
    const r = rate(c);
    return b && r ? (cv.amount / b) * r : 0;
  };

  /* свежие значения для нативных обработчиков жестов */
  const st = useRef({ list, base, cv, editing, padOpen });
  st.current = { list, base, cv, editing, padOpen };

  const commit = (patch: Partial<CvState>, shown?: string[]) =>
    setCv(prev => {
      let l = prev.list;
      if (shown) l = shown.concat(prev.list.filter(c => shown.indexOf(c) < 0 && !rate(c)));
      const n = { ...prev, ...patch, list: l };
      saveCv(n);
      return n;
    });

  /* ----- клавиатура ----- */
  const openPad = () => {
    if (st.current.padOpen) return;
    setPadOpen(true);
    tabbarAway(true);
    setPadH((padRef.current ? padRef.current.offsetHeight : 0) + 16);
  };
  const closePad = useCallback(() => {
    if (!st.current.padOpen) return;
    setPadOpen(false);
    tabbarAway(false);
    setFresh(true);
    setStr('');
  }, []);
  const closePadRef = useRef(closePad);
  closePadRef.current = closePad;

  useEffect(() => {
    if (!active) closePad();
  }, [active, closePad]);
  useEffect(() => () => tabbarAway(false), []);

  /* тап мимо строк и кнопок закрывает клавиатуру */
  useEffect(() => {
    if (!padOpen) return;
    const app = document.getElementById('app');
    if (!app) return;
    const onClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.cv-row, .cv-btns, .cv-pad')) closePad();
    };
    app.addEventListener('click', onClick);
    return () => app.removeEventListener('click', onClick);
  }, [padOpen, closePad]);

  const pick = (c: string) => {
    const v = c === base ? cv.amount : value(c);
    commit({ amount: Math.round(v * 100) / 100 || 0, base: c });
    setFresh(true);
    setStr('');
  };

  const reveal = (row: HTMLElement) => {
    const app = document.getElementById('app');
    const pad = padRef.current;
    if (!app || !pad) return;
    const r = row.getBoundingClientRect();
    const limit = window.innerHeight - pad.offsetHeight - 16;
    if (r.bottom > limit) app.scrollBy({ top: Math.round(r.bottom - limit), behavior: 'smooth' });
  };

  const onKey = (raw: string) => {
    const mark = raw.charAt(raw.length - 1);
    const ticked = mark === '!' || mark === '~';
    const k = ticked ? raw.slice(0, -1) : raw;
    let s = str;
    let f = fresh;
    if (k === 'del') {
      if (f || s.length <= 1) {
        s = '';
        f = false;
      } else s = s.slice(0, -1);
    } else {
      if (f) {
        s = '';
        f = false;
      }
      if (k === ',') {
        if (s.indexOf(',') >= 0) {
          hp('error');
          return;
        }
        s = (s || '0') + ',';
      } else {
        const p = s.split(',');
        if (p.length > 1 ? p[1].length >= 2 : p[0].replace(/^0+/, '').length >= 12) {
          hp('error');
          return;
        }
        s = s === '0' ? k : s + k;
      }
    }
    if (!ticked) hp('light');
    else if (mark === '~') hp('select');
    setStr(s);
    setFresh(f);
    commit({ amount: parseFloat((s || '0').replace(',', '.')) || 0 });
  };

  const onKeyRef = useRef(onKey);
  onKeyRef.current = onKey;

  const typed = () => {
    const p = str.split(',');
    const i = p[0] ? groupThousands(+p[0]) : '0';
    return i + (str.indexOf(',') >= 0 ? ',' + p[1] : '');
  };

  /* ----- правка ----- */
  const closeRow = useCallback(() => {
    const r = openRow.current;
    openRow.current = null;
    if (r && r.isConnected) setRowSwipe(r, 0, true);
  }, []);

  const setEditing = (on: boolean) => {
    if (on) closePad();
    closeRow();
    setEditingState(on);
    hp('light');
    const b = editBtnRef.current;
    if (b && b.animate) b.animate([{ scale: '.8' }, { scale: '1' }], { duration: 300, easing: 'cubic-bezier(.3, 1.6, .5, 1)' });
  };

  /* удаление строки: схлопывается и уходит из списка; если удалена база, она переходит на первую валюту */
  const removeRow = (row: HTMLElement, c: string) => {
    const s = st.current;
    if (s.list.length <= 1) {
      hp('error');
      return;
    }
    const nl = s.list.filter(x => x !== c);
    row.style.height = row.offsetHeight + 'px';
    row.classList.add('out');
    setTimeout(() => {
      const patch: Partial<CvState> = {};
      if (s.base === c) {
        patch.base = nl[0];
        const a = rate(c);
        const b = rate(nl[0]);
        patch.amount = Math.round((a && b ? (s.cv.amount / a) * b : 0) * 100) / 100;
      }
      commit(patch, nl);
    }, 270);
  };
  const removeRef = useRef(removeRow);
  removeRef.current = removeRow;

  const swipeDelete = (row: HTMLElement) => {
    const c = row.dataset.c || '';
    if (st.current.list.length <= 1) {
      hp('error');
      closeRow();
      return;
    }
    openRow.current = null;
    hp('medium');
    setRowSwipe(row, -row.offsetWidth, true, true);
    setTimeout(() => removeRow(row, c), 240);
  };

  const onListClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const row = target.closest('.cv-row') as HTMLElement | null;
    if (!row) return;
    const c = row.dataset.c || '';
    if (performance.now() - swipedAt.current < 350) return;
    if (target.closest('.cv-trash')) {
      swipeDelete(row);
      return;
    }
    if (openRow.current) {
      const was = openRow.current;
      closeRow();
      if (was === row || !editing) return;
    }
    if (editing) {
      if (target.closest('.cv-minus')) {
        hp('light');
        if (openRow.current && openRow.current !== row) closeRow();
        openRow.current = row;
        setRowSwipe(row, -SWIPE_OPEN, true);
      }
      return;
    }
    hp('select');
    if (c !== base || !padOpen) pick(c);
    openPad();
    reveal(row);
  };

  /* свайп строки влево: короткий показывает корзину, длинный удаляет при отпускании */
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    let row: HTMLElement | null = null;
    let x0 = 0;
    let y0 = 0;
    let mode: '' | '?' | 'x' | 'y' = '';
    let base0 = 0;
    let dx = 0;
    let armed = false;
    let vel = 0;
    let lx = 0;
    let lt = 0;

    const onStart = (e: TouchEvent) => {
      const r = (e.target as HTMLElement).closest('.cv-row') as HTMLElement | null;
      if (!r || e.touches.length !== 1 || (e.target as HTMLElement).closest('.cv-grip') || dragging.current) {
        row = null;
        return;
      }
      row = r;
      mode = '?';
      x0 = lx = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      lt = performance.now();
      vel = 0;
      base0 = r === openRow.current ? -SWIPE_OPEN : 0;
      dx = base0;
      armed = false;
    };
    const onMove = (e: TouchEvent) => {
      if (dragging.current) {
        if (e.cancelable) e.preventDefault();
        return;
      }
      if (!row || mode === 'y') return;
      const t = e.touches[0];
      const mx = t.clientX - x0;
      const my = t.clientY - y0;
      const now = performance.now();
      if (mode === '?') {
        if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
        mode = Math.abs(mx) > Math.abs(my) * 1.2 ? 'x' : 'y';
        if (mode === 'y') {
          row = null;
          return;
        }
        if (openRow.current && openRow.current !== row) closeRow();
        if (st.current.padOpen) closePadRef.current();
      }
      if (e.cancelable) e.preventDefault();
      vel = (t.clientX - lx) / Math.max(1, now - lt);
      lx = t.clientX;
      lt = now;
      dx = base0 + mx;
      if (dx > 0) dx = dx * 0.2;
      if (st.current.list.length <= 1 && dx < -SWIPE_OPEN) dx = -SWIPE_OPEN + (dx + SWIPE_OPEN) * 0.2;
      const a = setRowSwipe(row, dx, false);
      if (a !== armed) {
        armed = a;
        haptic(a ? 'medium' : 'light', hapticRef.current);
      }
    };
    const onEnd = () => {
      if (!row || mode !== 'x') {
        row = null;
        return;
      }
      const r = row;
      row = null;
      swipedAt.current = performance.now();
      if (armed && st.current.list.length > 1) {
        openRow.current = null;
        haptic('medium', hapticRef.current);
        setRowSwipe(r, -r.offsetWidth, true, true);
        const c = r.dataset.c || '';
        setTimeout(() => removeRef.current(r, c), 240);
        return;
      }
      if (dx < -SWIPE_OPEN / 2 || vel < -0.5) {
        openRow.current = r;
        setRowSwipe(r, -SWIPE_OPEN, true);
      } else {
        if (openRow.current === r) openRow.current = null;
        setRowSwipe(r, 0, true);
      }
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [closeRow]);
  /* перетаскивание порядка за ручку: строка поднимается и едет за пальцем, остальные расступаются.
     На телефоне идёт на touch-событиях с preventDefault с первого касания, чтобы iOS не превратил жест в скролл. */
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    let drag: {
      row: HTMLElement;
      rows: HTMLElement[];
      from: number;
      to: number;
      y0: number;
      h: number;
      id: string;
      raf: number;
      y: number;
    } | null = null;
    const hap = (k: Parameters<typeof haptic>[0]) => haptic(k, hapticRef.current);

    function start(g: Element, y: number, id: string) {
      closeRow();
      const row = g.closest('.cv-row') as HTMLElement;
      const rows = Array.prototype.slice.call(el!.children) as HTMLElement[];
      const h = row.offsetHeight;
      drag = { row, rows, from: rows.indexOf(row), to: rows.indexOf(row), y0: y, h, id, raf: 0, y };
      dragging.current = true;
      rows.forEach(r => {
        r.style.transition = 'none';
        r.style.transform = ty(0);
      });
      void el!.offsetWidth;
      rows.forEach(r => {
        if (r !== row) r.style.transition = GLIDE;
      });
      row.classList.add('drag');
      hap('light');
    }
    function move(y: number) {
      if (!drag) return;
      drag.y = y;
      if (drag.raf) return;
      drag.raf = requestAnimationFrame(() => {
        const d = drag;
        if (!d) return;
        d.raf = 0;
        const n = d.rows.length;
        const lo = -d.from * d.h;
        const hi = (n - 1 - d.from) * d.h;
        let dy = d.y - d.y0;
        if (dy < lo) dy = lo + (dy - lo) * 0.25;
        if (dy > hi) dy = hi + (dy - hi) * 0.25;
        d.row.style.transform = ty(dy);
        const to = Math.max(0, Math.min(n - 1, d.from + Math.round(dy / d.h)));
        if (to !== d.to) {
          d.to = to;
          hap('select');
        }
        d.rows.forEach((r, i) => {
          if (r === d.row) return;
          let sh = 0;
          if (d.from < to && i > d.from && i <= to) sh = -d.h;
          if (d.from > to && i < d.from && i >= to) sh = d.h;
          const want = ty(sh);
          if (r.style.transform !== want) r.style.transform = want;
        });
      });
    }
    function end() {
      if (!drag) return;
      const d = drag;
      drag = null;
      cancelAnimationFrame(d.raf);
      d.row.style.transition = GLIDE;
      d.row.style.transform = ty((d.to - d.from) * d.h);
      d.row.classList.remove('drag');
      d.row.classList.add('lift');
      hap('light');
      setTimeout(() => {
        const l = st.current.list.slice();
        const item = l.splice(d.from, 1)[0];
        l.splice(d.to, 0, item);
        flushSync(() => commitRef.current({}, l));
        d.rows.forEach(r => {
          r.style.transition = 'none';
          r.style.transform = '';
        });
        void el!.offsetWidth;
        d.rows.forEach(r => (r.style.transition = ''));
        d.row.classList.remove('lift');
        dragging.current = false;
      }, 320);
    }

    const onTouchStart = (e: TouchEvent) => {
      const g = (e.target as HTMLElement).closest('.cv-grip');
      if (!g || !st.current.editing || drag || dragging.current || e.touches.length !== 1) return;
      if (e.cancelable) e.preventDefault();
      const t = e.changedTouches[0];
      start(g, t.clientY, 't' + t.identifier);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!drag || drag.id.charAt(0) !== 't') return;
      if (e.cancelable) e.preventDefault();
      for (let i = 0; i < e.touches.length; i++) if ('t' + e.touches[i].identifier === drag.id) move(e.touches[i].clientY);
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (!drag || drag.id.charAt(0) !== 't') return;
      for (let i = 0; i < e.changedTouches.length; i++) if ('t' + e.changedTouches[i].identifier === drag.id) end();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const g = (e.target as HTMLElement).closest('.cv-grip');
      if (!g || !st.current.editing || drag || dragging.current) return;
      e.preventDefault();
      try {
        (g as HTMLElement).setPointerCapture(e.pointerId);
      } catch (x) {}
      start(g, e.clientY, 'p' + e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (drag && drag.id === 'p' + e.pointerId) move(e.clientY);
    };
    const onPointerEnd = (e: PointerEvent) => {
      if (drag && drag.id === 'p' + e.pointerId) end();
    };
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
    document.addEventListener('touchcancel', onTouchEnd);
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerEnd);
    el.addEventListener('pointercancel', onPointerEnd);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerEnd);
      el.removeEventListener('pointercancel', onPointerEnd);
    };
  }, [closeRow]);
  const commitRef = useRef(commit);
  commitRef.current = commit;

  /* ----- добавление валюты ----- */
  const openAdd = () => {
    if (editing) setEditingState(false);
    closePad();
    closeRow();
    setAddOpen(true);
  };

  const toggleCurrency = (c: string) => {
    const i = list.indexOf(c);
    if (i >= 0) {
      if (list.length <= 1) {
        hp('error');
        return;
      }
      const nl = list.filter(x => x !== c);
      commit(cv.base === c || base === c ? { base: nl[0] } : {}, nl);
    } else {
      commit({}, list.concat(c));
    }
    hp('select');
  };

  const codes = useMemo(() => Object.keys(rates), [rates]);

  const rxDate = () => {
    if (!ratesDate) return '';
    const p = ratesDate.split('-');
    const dt = new Date(+p[0], +p[1] - 1, +p[2]);
    return new Intl.DateTimeFormat(LOC[lang] || LOC['ru'], { day: 'numeric', month: 'long' }).format(dt);
  };

  return (
    <div className="cv-screen" style={padOpen && padH ? { paddingBottom: padH + 'px' } : undefined}>
      <div className="scr-head cv-head">
        <div>
          <h1 className="scr-title">{L('Конвертер')}</h1>
          <div className="cv-src" id="cv-src">
            {live ? L('Курс на {d}', { d: rxDate() }) : L('Примерный курс')}
          </div>
        </div>
        <div className="cv-btns">
          <button
            className="rb"
            type="button"
            id="cv-add-btn"
            aria-label={L('Добавить валюту')}
            onClick={() => {
              hp('light');
              openAdd();
            }}
          >
            <svg viewBox="0 0 24 24">
              <path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <button
            ref={editBtnRef}
            className={'rb' + (editing ? ' done' : '')}
            type="button"
            id="cv-edit"
            aria-label={L(editing ? 'Готово' : 'Править')}
            onClick={() => setEditing(!editing)}
          >
            <svg viewBox="0 0 24 24">
              {editing ? (
                <path d="M5.5 12.5l4.5 4.5l8.5-9.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <path d={PENCIL} />
              )}
            </svg>
          </button>
        </div>
      </div>
      <Squircle r={32} className={'ops-card cv-card' + (editing ? ' edit' : '')}>
        <div className={'cv-list' + (editing ? ' edit' : '')} id="cv-list" ref={listRef} onClick={onListClick}>
          {list.map(c => {
            const act = c === base && padOpen;
            return (
              <div className={'cv-row' + (act ? ' act' : '')} data-c={c} key={c}>
                <button type="button" className="cv-trash" aria-label={L('Удалить')} dangerouslySetInnerHTML={{ __html: CV_TRASH }} />
                <Squircle r={20} className="cv-in">
                  <button type="button" className="cv-minus" aria-label={L('Убрать')}>
                    <span />
                  </button>
                  <Flag code={c} />
                  <span className="cv-main">
                    <span className="cv-code">{c}</span>
                    <span className="cv-name">{cvName(c, lang)}</span>
                  </span>
                  <span className="cv-val">
                    {act ? (fresh ? cvFmt(cv.amount) : typed()) : cvFmt(value(c))}
                    {act && <i className="cv-caret" />}
                  </span>
                  <span className="cv-grip" aria-label={L('Перетащить')}>
                    <svg viewBox="0 0 24 24">
                      <path d={GRIP} />
                    </svg>
                  </span>
                </Squircle>
              </div>
            );
          })}
        </div>
      </Squircle>
      <CvPad open={padOpen} padRef={padRef} onKey={k => onKeyRef.current(k)} onTick={() => hp('light')} onClose={closePad} />
      <AddCurrencySheet open={addOpen} onClose={() => setAddOpen(false)} codes={codes} selected={list} onToggle={toggleCurrency} />
    </div>
  );
};
