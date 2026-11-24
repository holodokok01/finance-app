import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Squircle } from '../ui/Squircle';
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

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
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
  const bodyRef = useRef<HTMLDivElement>(null);
  const st = useRef({ open: false, busy: false });
  const pRef = useRef(0);
  const animToken = useRef(0);
  const geo = useRef<{ v: Box; c: Box }>({ v: { x: 0, y: 0, w: 0, h: 0 }, c: { x: 0, y: 0, w: 0, h: 0 } });
  const closeFastRef = useRef(false);
  const rafPending = useRef(false);
  const dragT = useRef(0);
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
  const visibleRows = useMemo(() => (limit >= rows.length ? rows : rows.slice(0, limit)), [rows, limit]);
  const groups = useMemo(() => groupByDay(visibleRows), [visibleRows]);

  /* ---------- geometry ----------
     Шит всегда стоит на весь экран. Движение: clip-path inset (окно карточки раскрывается)
     и transform у содержимого (едет от места карточки наверх). Размер шита не меняется,
     поэтому браузер не перекладывает его каждый кадр. */
  const viewRect = (): Box => {
    const W = document.documentElement.clientWidth;
    const H = Math.min(
      window.innerHeight,
      document.documentElement.clientHeight || 99999,
      window.visualViewport ? Math.round(window.visualViewport.height) : 99999
    );
    const w = Math.min(480, W);
    return { x: Math.round((W - w) / 2), y: 0, w, h: H };
  };
  const cardEl = () => document.getElementById('ops-card');
  const cardRect = (): Box => {
    const el = cardEl();
    if (!el) return viewRect();
    const b = el.getBoundingClientRect();
    return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) };
  };

  const placeSheet = (v: Box) => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    sheet.style.left = v.x + 'px';
    sheet.style.top = v.y + 'px';
    sheet.style.width = v.w + 'px';
    sheet.style.height = v.h + 'px';
  };

  /** p = 0: шит совпадает с карточкой, p = 1: на весь экран. */
  const draw = (p: number) => {
    const sheet = sheetRef.current;
    const body = bodyRef.current;
    if (!sheet || !body) return;
    pRef.current = p;
    const v = geo.current.v;
    const c = geo.current.c;
    const k = 1 - p;
    const top = Math.round(Math.max(0, c.y - v.y) * k);
    const left = Math.round(Math.max(0, c.x - v.x) * k);
    const right = Math.round(Math.max(0, v.x + v.w - c.x - c.w) * k);
    const bottom = Math.round(Math.max(0, v.y + v.h - c.y - c.h) * k);
    const r = Math.round(32 * k);
    sheet.style.clipPath = p >= 1 ? 'none' : `inset(${top}px ${right}px ${bottom}px ${left}px round ${r}px)`;
    body.style.transform = `translate3d(0, ${Math.round((c.y - v.y) * k)}px, 0)`;
    sheet.style.setProperty('--px', Math.round(Math.max(0, c.x - v.x) * k) + 'px');
    sheet.style.setProperty('--lab', String(Math.round(p * 40)));
    // при p = 0 строки лежат ровно как в карточке: зазор между днями 4px, подпись схлопнута без зазора
    sheet.style.setProperty('--gap', Math.round(4 + p * 4) + 'px');
    sheet.style.setProperty('--dm', Math.round((1 - p) * 4) + 'px');
    if (headARef.current) headARef.current.style.opacity = String(clamp01(1 - p * 2.2));
    if (headBRef.current) {
      headBRef.current.style.opacity = String(clamp01((p - 0.45) * 1.8));
      headBRef.current.style.pointerEvents = p > 0.9 ? 'auto' : 'none';
    }
  };

  const animateTo = (to: number, ms: number, done?: () => void) => {
    const from = pRef.current;
    const start = performance.now();
    const token = ++animToken.current;
    st.current.busy = true;
    const frame = (now: number) => {
      if (token !== animToken.current) return;
      const t = clamp01((now - start) / ms);
      const e = 1 - Math.pow(1 - t, 3);
      draw(from + (to - from) * e);
      if (t < 1) requestAnimationFrame(frame);
      else {
        st.current.busy = false;
        if (done) done();
      }
    };
    requestAnimationFrame(frame);
  };

  const openSheet = () => {
    if (st.current.open) return;
    geo.current = { v: viewRect(), c: cardRect() };
    placeSheet(geo.current.v);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    draw(0);
    setShown(true);
    const card = cardEl();
    if (card) card.style.visibility = 'hidden';
    st.current.open = true;
    hp('light');
    animateTo(1, 460, () => {
      // остальные строки дорисовываем, когда движение уже закончилось
      requestAnimationFrame(() => setLimit(Infinity));
    });
  };

  const closeSheet = (fast: boolean) => {
    if (!st.current.open) return;
    if (searchingRef.current) exitSearchRef.current();
    const sc = scrollRef.current;
    const run = () => {
      geo.current = { v: viewRect(), c: cardRect() };
      hp('light');
      animateTo(0, fast ? 280 : 400, () => {
        setShown(false);
        setFxOn(false);
        const card = cardEl();
        if (card) card.style.visibility = '';
        st.current.open = false;
        // пока шит скрыт, возвращаем короткий список для следующего открытия
        setTimeout(() => setLimit(FIRST_ROWS), 50);
      });
    };
    if (sc && sc.scrollTop > 0) {
      // список был прокручен: сначала быстро к началу (240 мс), потом сворачиваем, без скачка
      st.current.busy = true;
      const from = sc.scrollTop;
      const t0 = performance.now();
      const step = (now: number) => {
        const t = clamp01((now - t0) / 240);
        sc.scrollTop = Math.round(from * Math.pow(1 - t, 3));
        if (t < 1) requestAnimationFrame(step);
        else {
          sc.scrollTop = 0;
          st.current.busy = false;
          run();
        }
      };
      requestAnimationFrame(step);
    } else run();
  };

  useEffect(() => {
    if (open) openSheet();
    else {
      closeSheet(closeFastRef.current);
      closeFastRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // keep the full-screen sheet fitted to the viewport
  useEffect(() => {
    const fit = () => {
      if (!st.current.open || st.current.busy) return;
      geo.current = { v: viewRect(), c: cardRect() };
      placeSheet(geo.current.v);
      draw(pRef.current);
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
        geo.current = { v: viewRect(), c: cardRect() };
        if (document.activeElement && (document.activeElement as HTMLElement).blur) {
          (document.activeElement as HTMLElement).blur();
        }
      }
      if (e.cancelable) e.preventDefault();
      const now = performance.now();
      vel = (y - lastY) / Math.max(1, now - lastT);
      lastY = y;
      lastT = now;
      const t = Math.min(1, Math.max(0, dy / 360));
      if (!rafPending.current) {
        rafPending.current = true;
        requestAnimationFrame(() => {
          rafPending.current = false;
          if (dragging) draw(1 - dragT.current);
        });
      }
      dragT.current = t;
    };
    const onEnd = () => {
      if (!dragging) {
        armed = false;
        return;
      }
      dragging = false;
      armed = false;
      draw(1 - dragT.current);
      if (dragT.current > 0.28 || vel > 0.6) {
        hp('light');
        closeFastRef.current = true;
        onCloseRef.current();
      } else {
        animateTo(1, 260);
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
      <div className="sheet-body" ref={bodyRef}>
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
    </div>
  );
};
