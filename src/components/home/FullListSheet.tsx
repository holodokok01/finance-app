import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Squircle, squirclePath } from '../ui/Squircle';
import { TransactionRow } from './TransactionRow';
import { useAppStore } from '../../store/useAppStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { getTelegramWebApp, haptic } from '../../services/telegram';
import { formatCurrency, symOf } from '../../lib/balance';
import { EMPTY_FILTER, ListFilter, filterTx, groupByDay, hasFilter } from '../../lib/filters';
import { dayLabel } from '../../lib/dayLabel';
import { ICON_EMPTY, ICON_SEARCH } from '../../assets/listIcons';
import { L } from '../../i18n';
import { Transaction } from '../../types/fin';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  safe: number;
  p: number;
}

export interface FullListSheetProps {
  open: boolean;
  onClose: () => void;
  onSelectTransaction: (tx: Transaction) => void;
}

const CLOSE_PATH = 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z';
const CHEV_PATH =
  'M15.835 11.63L9.205 5.2C8.79 4.799 8 5.042 8 5.57v12.86c0 .528.79.771 1.205.37l6.63-6.43a.5.5 0 0 0 0-.74';

const FIRST_ROWS = 14;
const CHUNK = 30;

const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export const FullListSheet: React.FC<FullListSheetProps> = ({ open, onClose, onSelectTransaction }) => {
  const transactions = useAppStore(s => s.transactions);
  const categories = useAppStore(s => s.categories);
  const balance = useAppStore(s => s.balance());
  const base = useSettingsStore(s => s.base);
  const hapticOn = useSettingsStore(s => s.haptic);

  const [shown, setShown] = useState(false);
  const [searching, setSearching] = useState(false);
  const [caretOff, setCaretOff] = useState(false);
  const [f, setFState] = useState<ListFilter>(EMPTY_FILTER);
  const [limit, setLimit] = useState(FIRST_ROWS);
  const [fxOn, setFxOn] = useState(false);

  const sheetRef = useRef<HTMLDivElement>(null);
  const headARef = useRef<HTMLDivElement>(null);
  const headBRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const caretTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const growTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const totalRef = useRef(0);
  const limitRef = useRef(FIRST_ROWS);
  const st = useRef({ open: false, busy: false });
  const closeFromRef = useRef<Rect | null>(null);
  const searchingRef = useRef(false);
  const exitSearchRef = useRef<() => void>(() => {});
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  searchingRef.current = searching;

  const hp = useCallback((k: Parameters<typeof haptic>[0]) => haptic(k, hapticOn), [hapticOn]);

  const setF = (next: ListFilter) => {
    setFxOn(true);
    setFState(next);
  };

  const rows = useMemo(() => filterTx(transactions, f, categories), [transactions, f, categories]);
  totalRef.current = rows.length;
  limitRef.current = limit;
  const visibleRows = useMemo(() => (limit >= rows.length ? rows : rows.slice(0, limit)), [rows, limit]);
  const groups = useMemo(() => groupByDay(visibleRows), [visibleRows]);

  /* Во время анимации в шите живут только первые строки, остальные добавляются порциями. */
  const stopGrow = () => {
    if (growTimer.current) clearTimeout(growTimer.current);
    growTimer.current = null;
  };
  const growRows = () => {
    stopGrow();
    const tick = () => {
      if (!st.current.open) return;
      setLimit(l => (l >= totalRef.current ? l : l + CHUNK));
      growTimer.current = setTimeout(() => {
        if (limitRef.current < totalRef.current) tick();
      }, 40);
    };
    tick();
  };
  const shrinkRows = () => {
    stopGrow();
    flushSync(() => setLimit(FIRST_ROWS));
  };

  /* ---------- geometry ---------- */
  const viewRect = (): Rect => {
    const W = document.documentElement.clientWidth;
    const H = Math.min(
      window.innerHeight,
      document.documentElement.clientHeight || 99999,
      window.visualViewport ? Math.round(window.visualViewport.height) : 99999
    );
    const w = Math.min(480, W);
    return { x: Math.round((W - w) / 2), y: 0, w, h: H, r: 0, safe: 0, p: 1 };
  };
  const cardEl = () => document.getElementById('ops-card');
  const cardRect = (): Rect => {
    const el = cardEl();
    if (!el) return viewRect();
    const b = el.getBoundingClientRect();
    return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height), r: 32, safe: 0, p: 0 };
  };

  const drawSheet = (q: Rect) => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    sheet.style.left = q.x + 'px';
    sheet.style.top = q.y + 'px';
    sheet.style.width = q.w + 'px';
    sheet.style.height = q.h + 'px';
    sheet.style.clipPath = `path('${squirclePath(q.w, q.h, [q.r, q.r, q.r, q.r])}')`;
    sheet.style.setProperty('--safe', q.safe + 'px');
    sheet.style.setProperty('--lab', String(Math.round(q.p * 40)));
    sheet.style.setProperty('--gap', Math.round(q.p * 8) + 'px');
    if (headARef.current) headARef.current.style.opacity = String(clamp01(1 - q.p * 2.2));
    if (headBRef.current) {
      headBRef.current.style.opacity = String(clamp01((q.p - 0.45) * 1.8));
      headBRef.current.style.pointerEvents = q.p > 0.9 ? 'auto' : 'none';
    }
  };

  const animateSheet = (from: Rect, to: Rect, ms: number, done?: () => void) => {
    const start = performance.now();
    st.current.busy = true;
    if (sheetRef.current) sheetRef.current.style.willChange = 'left, top, width, height, clip-path';
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - t, 3);
      drawSheet({
        x: lerp(from.x, to.x, e),
        y: lerp(from.y, to.y, e),
        w: lerp(from.w, to.w, e),
        h: lerp(from.h, to.h, e),
        r: lerp(from.r, to.r, e),
        safe: lerp(from.safe, to.safe, e),
        p: from.p + (to.p - from.p) * e,
      });
      if (t < 1) requestAnimationFrame(frame);
      else {
        st.current.busy = false;
        if (sheetRef.current) sheetRef.current.style.willChange = '';
        if (done) done();
      }
    };
    requestAnimationFrame(frame);
  };

  const openSheet = () => {
    if (st.current.open || st.current.busy) return;
    const from = cardRect();
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    drawSheet(from);
    setShown(true);
    const card = cardEl();
    if (card) card.style.visibility = 'hidden';
    st.current.open = true;
    hp('light');
    animateSheet(from, viewRect(), 460, () => growRows());
  };

  const closeSheet = (fromQ?: Rect | null) => {
    if (!st.current.open) return;
    if (st.current.busy) {
      setTimeout(() => closeSheet(fromQ), 50);
      return;
    }
    if (searchingRef.current) exitSearchRef.current();
    if (scrollRef.current && scrollRef.current.scrollTop > 0) scrollRef.current.scrollTop = 0;
    // сначала убираем лишние строки, потом анимируем: так сворачивание идёт без рывков
    stopGrow();
    setLimit(FIRST_ROWS);
    st.current.busy = true;
    const to = cardRect();
    hp('light');
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        st.current.busy = false;
        animateSheet(fromQ || viewRect(), to, fromQ ? 280 : 400, () => {
          setShown(false);
          setFxOn(false);
          const card = cardEl();
          if (card) card.style.visibility = '';
          st.current.open = false;
        });
      })
    );
  };

  useEffect(() => {
    if (open) openSheet();
    else {
      closeSheet(closeFromRef.current);
      closeFromRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => stopGrow(), []);

  // keep the full-screen sheet fitted to the viewport
  useEffect(() => {
    const fit = () => {
      if (st.current.open && !st.current.busy) drawSheet(viewRect());
    };
    window.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('resize', fit);
    return () => {
      window.removeEventListener('resize', fit);
      window.visualViewport?.removeEventListener('resize', fit);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Telegram back button
  useEffect(() => {
    if (!open) return;
    const bb = getTelegramWebApp()?.BackButton;
    if (!bb) return;
    const handler = () => {
      if (searchingRef.current) exitSearchRef.current();
      else onCloseRef.current();
    };
    try {
      bb.show();
      bb.onClick(handler);
    } catch (e) {}
    return () => {
      try {
        bb.offClick(handler);
        bb.hide();
      } catch (e) {}
    };
  }, [open]);

  /* ---------- pull down from the top to collapse into the card ---------- */
  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    let y0 = 0;
    let lastY = 0;
    let lastT = 0;
    let vel = 0;
    let dragging = false;
    let armed = false;
    let dq: Rect | null = null;

    const qAt = (t: number): Rect => {
      const a = viewRect();
      const b = cardRect();
      return {
        x: lerp(a.x, b.x, t),
        y: lerp(a.y, b.y, t),
        w: lerp(a.w, b.w, t),
        h: lerp(a.h, b.h, t),
        r: lerp(a.r, b.r, t),
        safe: 0,
        p: 1 - t,
      };
    };
    const onStart = (e: TouchEvent) => {
      if (!st.current.open || st.current.busy || e.touches.length !== 1) return;
      armed = sc.scrollTop <= 0;
      dragging = false;
      y0 = lastY = e.touches[0].clientY;
      lastT = performance.now();
      vel = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (!armed) return;
      const y = e.touches[0].clientY;
      const dy = y - y0;
      if (!dragging) {
        if (sc.scrollTop > 0 || dy < 0) {
          armed = false;
          return;
        }
        if (dy < 8) return;
        dragging = true;
        shrinkRows();
        if (document.activeElement && (document.activeElement as HTMLElement).blur) {
          (document.activeElement as HTMLElement).blur();
        }
      }
      if (e.cancelable) e.preventDefault();
      const now = performance.now();
      vel = (y - lastY) / Math.max(1, now - lastT);
      lastY = y;
      lastT = now;
      dq = qAt(Math.min(1, Math.max(0, dy / 360)));
      drawSheet(dq);
    };
    const onEnd = () => {
      if (!dragging) {
        armed = false;
        return;
      }
      dragging = false;
      armed = false;
      const q = dq;
      if (!q) return;
      const shownPart = 1 - q.p;
      if (shownPart > 0.28 || vel > 0.6) {
        hp('light');
        closeFromRef.current = q;
        onCloseRef.current();
      } else {
        animateSheet(q, viewRect(), 260, () => growRows());
      }
    };
    sc.addEventListener('touchstart', onStart, { passive: true });
    sc.addEventListener('touchmove', onMove, { passive: false });
    sc.addEventListener('touchend', onEnd);
    sc.addEventListener('touchcancel', onEnd);
    return () => {
      sc.removeEventListener('touchstart', onStart);
      sc.removeEventListener('touchmove', onMove);
      sc.removeEventListener('touchend', onEnd);
      sc.removeEventListener('touchcancel', onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- search ---------- */
  const enterSearch = () => {
    setSearching(true);
    setCaretOff(true);
    inputRef.current?.focus();
    if (caretTimer.current) clearTimeout(caretTimer.current);
    caretTimer.current = setTimeout(() => setCaretOff(false), 340);
  };
  const exitSearch = () => {
    setSearching(false);
    setCaretOff(true);
    inputRef.current?.blur();
    setF(EMPTY_FILTER);
  };
  exitSearchRef.current = exitSearch;

  const resetFilters = () => {
    hp('light');
    setF(EMPTY_FILTER);
  };

  const sym = symOf(base);
  const hasF = hasFilter(f);
  const emptyH = Math.max(240, (scrollRef.current ? scrollRef.current.clientHeight : 0) - 48);

  return (
    <div
      ref={sheetRef}
      className={`sheet${shown ? ' show' : ''}${searching ? ' searching' : ''}${caretOff ? ' caret-off' : ''}`}
      id="sheet"
      aria-hidden={!shown}
    >
      <div className="sheet-safe" />
      <div className="sheet-top">
        <div className="card-head head-a" id="head-a" ref={headARef} aria-hidden="true">
          <h2 className="card-title">{L('Операции')}</h2>
          <Squircle as="span" r={99} className="mini">
            <span>{L('Все')}</span>
            <svg viewBox="0 0 24 24">
              <path fill="currentColor" d={CHEV_PATH} />
            </svg>
          </Squircle>
        </div>
        <div className="head-b" id="head-b" ref={headBRef}>
          <div className="hb-main">
            <button
              className="rb"
              type="button"
              id="close-all"
              aria-label={L('Закрыть')}
              onClick={() => onCloseRef.current()}
            >
              <svg viewBox="0 0 24 24">
                <path d={CLOSE_PATH} />
              </svg>
            </button>
            <div className="hb-balance" id="sheet-balance">
              {formatCurrency(balance, sym)}
            </div>
            <button className="rb" type="button" id="open-search" aria-label={L('Поиск')} onClick={enterSearch}>
              <svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: ICON_SEARCH }} />
            </button>
          </div>
          <div className="hb-search">
            <Squircle as="label" r={99} className="field">
              <svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: ICON_SEARCH }} />
              <input
                id="q"
                ref={inputRef}
                type="search"
                placeholder={L('Поиск')}
                autoComplete="off"
                enterKeyHint="search"
                value={f.q}
                onChange={e => setF({ ...f, q: e.target.value })}
              />
            </Squircle>
            <button
              className="rb"
              type="button"
              id="exit-search"
              aria-label={L('Закрыть поиск')}
              onClick={() => {
                hp('light');
                exitSearch();
              }}
            >
              <svg viewBox="0 0 24 24">
                <path d={CLOSE_PATH} />
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div className="sheet-scroll" id="sheet-scroll" ref={scrollRef}>
        <div className={`list${fxOn ? ' fx' : ''}`} id="sheet-list" key={JSON.stringify(f) + ':' + rows.length}>
          {rows.length === 0 ? (
            <div className="empty" style={{ minHeight: emptyH }}>
              <Squircle r={32} className="empty-tile">
                <svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: ICON_EMPTY }} />
              </Squircle>
              <div className="empty-title">{L('Ничего не найдено')}</div>
              <div className="empty-text">
                {L(hasF ? 'Попробуйте изменить запрос или фильтры' : 'Операции появятся здесь после добавления')}
              </div>
              {hasF && (
                <button type="button" className="pbtn" id="reset-filters" onClick={resetFilters}>
                  {L('Сбросить фильтры')}
                </button>
              )}
            </div>
          ) : (
            groups.map(g => (
              <div className="day" key={g.d}>
                <div className="day-label">{dayLabel(g.d)}</div>
                {g.rows.map(tx => (
                  <TransactionRow key={tx.id} tx={tx} onClick={onSelectTransaction} />
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
