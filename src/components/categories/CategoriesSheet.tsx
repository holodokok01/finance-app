import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Squircle } from '../ui/Squircle';
import { CategoryTile } from '../ui/CategoryTile';
import { SegmentedControl } from '../ui/SegmentedControl';
import { usePullToClose } from '../../hooks/usePullToClose';
import { useSheetPresence } from '../../hooks/useSheetPresence';
import { useAppStore } from '../../store/useAppStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { toast } from '../../store/useToastStore';
import { haptic } from '../../services/telegram';
import { setRowSwipe, SWIPE_OPEN } from '../../lib/swipeRow';
import { PENCIL, GRIP } from '../converter/ConverterScreen';
import { CV_TRASH } from '../../assets/icons';
import { L, plural } from '../../i18n';
import { CategoryType } from '../../types/fin';

/* Шит «Категории»: список по типу, правка (порядок и удаление), свайп строки с корзиной (перенос из legacy). */

const CLOSE_PATH = 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z';
const CHEV = 'M15.835 11.63L9.205 5.2C8.79 4.799 8 5.042 8 5.57v12.86c0 .528.79.771 1.205.37l6.63-6.43a.5.5 0 0 0 0-.74';
const GLIDE = 'transform .3s cubic-bezier(.2, .9, .25, 1)';
const ty = (y: number) => 'translate3d(0,' + Math.round(y) + 'px,0)';

export interface CategoriesHandle {
  /** строка уезжает влево, схлопывается, потом done */
  fly: (k: string, done: () => void) => void;
  closeRow: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onEdit: (k: string | null, type: CategoryType) => void;
  /** у категории есть операции: решение о переносе принимает диалог */
  onRequestDelete: (k: string) => void;
  /** пустую категорию удаляем сразу */
  onDeleteEmpty: (k: string) => void;
}

export const CategoriesSheet = forwardRef<CategoriesHandle, Props>(({ open, onClose, onEdit, onRequestDelete, onDeleteEmpty }, ref) => {
  const hapticOn = useSettingsStore(s => s.haptic);
  const hapticRef = useRef(hapticOn);
  hapticRef.current = hapticOn;
  const hp = useCallback((k: Parameters<typeof haptic>[0]) => haptic(k, hapticRef.current), []);
  const { rendered, show, height, kb, oy } = useSheetPresence(open, () => hp('light'));

  const categories = useAppStore(s => s.categories);
  const order = useAppStore(s => s.categoryOrder);
  const transactions = useAppStore(s => s.transactions);

  const [type, setType] = useState<CategoryType>('expense');
  const [editing, setEditing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const editBtnRef = useRef<HTMLButtonElement>(null);
  const openRow = useRef<HTMLElement | null>(null);
  const swipedAt = useRef(0);
  const dragging = useRef(false);

  const { panelRef } = usePullToClose({ onClose, enabled: open, scrollRef });

  const ids = useMemo(() => (order[type] || []).filter(k => categories[k]), [order, type, categories]);
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    transactions.forEach(t => {
      m[t.cat] = (m[t.cat] || 0) + 1;
    });
    return m;
  }, [transactions]);

  /* последние значения для нативных обработчиков */
  const st = useRef({ ids, editing, type, counts });
  st.current = { ids, editing, type, counts };

  useEffect(() => {
    if (open) {
      setType('expense');
      setEditing(false);
    }
  }, [open]);

  const closeRow = useCallback(() => {
    const r = openRow.current;
    openRow.current = null;
    if (r && r.isConnected) setRowSwipe(r, 0, true);
  }, []);

  const flyRow = useCallback((row: HTMLElement, done: () => void) => {
    openRow.current = null;
    hp('medium');
    setRowSwipe(row, -row.offsetWidth, true, true);
    setTimeout(() => {
      row.style.height = row.offsetHeight + 'px';
      row.classList.add('out');
      setTimeout(done, 270);
    }, 240);
  }, [hp]);

  useImperativeHandle(ref, () => ({
    fly: (k, done) => {
      const row = listRef.current?.querySelector<HTMLElement>('.cm-row[data-k="' + k + '"]');
      if (row) flyRow(row, done);
      else done();
    },
    closeRow,
  }));

  const toggleEdit = () => {
    hp('light');
    closeRow();
    setEditing(e => !e);
    const b = editBtnRef.current;
    if (b && b.animate) b.animate([{ scale: '.8' }, { scale: '1' }], { duration: 300, easing: 'cubic-bezier(.3, 1.6, .5, 1)' });
  };

  const requestDelete = (row: HTMLElement) => {
    const k = row.dataset.k || '';
    const c = categories[k];
    if (!c) return;
    if (st.current.ids.length <= 1) {
      hp('error');
      toast('Нужна хотя бы одна категория');
      closeRow();
      return;
    }
    if (!(counts[k] || 0)) {
      onDeleteEmpty(k);
      return;
    }
    if (openRow.current && openRow.current !== row) closeRow();
    openRow.current = row;
    setRowSwipe(row, -SWIPE_OPEN, true);
    onRequestDelete(k);
  };
  const requestRef = useRef(requestDelete);
  requestRef.current = requestDelete;

  const onListClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const row = target.closest('.cm-row') as HTMLElement | null;
    if (!row || dragging.current) return;
    const k = row.dataset.k || '';
    if (performance.now() - swipedAt.current < 350) return;
    if (target.closest('.cv-trash')) {
      requestDelete(row);
      return;
    }
    if (openRow.current) {
      const was = openRow.current;
      closeRow();
      if (was === row || !editing) return;
    }
    if (target.closest('.cm-minus')) {
      hp('light');
      if (openRow.current && openRow.current !== row) closeRow();
      openRow.current = row;
      setRowSwipe(row, -SWIPE_OPEN, true);
      return;
    }
    if (editing) return;
    if (target.closest('.cm-in')) {
      hp('light');
      onEdit(k, type);
    }
  };

  /* смена типа: список появляется снизу */
  const firstType = useRef(true);
  useEffect(() => {
    if (firstType.current) {
      firstType.current = false;
      return;
    }
    const el = listRef.current;
    if (!el) return;
    el.classList.remove('fx-up');
    void el.offsetWidth;
    el.classList.add('fx-up');
    const t = setTimeout(() => el.classList.remove('fx-up'), 480);
    return () => clearTimeout(t);
  }, [type]);

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
      const r = (e.target as HTMLElement).closest('.cm-row') as HTMLElement | null;
      if (!r || e.touches.length !== 1 || (e.target as HTMLElement).closest('.cm-grip') || dragging.current) {
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
      }
      if (e.cancelable) e.preventDefault();
      vel = (t.clientX - lx) / Math.max(1, now - lt);
      lx = t.clientX;
      lt = now;
      dx = base0 + mx;
      if (dx > 0) dx = dx * 0.2;
      if (st.current.ids.length <= 1 && dx < -SWIPE_OPEN) dx = -SWIPE_OPEN + (dx + SWIPE_OPEN) * 0.2;
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
      if (armed && st.current.ids.length > 1) {
        requestRef.current(r);
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
  }, [rendered, closeRow]);

  /* перетаскивание порядка за ручку (как в конвертере) */
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
      const row = g.closest('.cm-row') as HTMLElement;
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
        const l = st.current.ids.slice();
        const item = l.splice(d.from, 1)[0];
        l.splice(d.to, 0, item);
        if (d.from !== d.to) flushSync(() => useAppStore.getState().reorderCategories(st.current.type, l));
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
      const g = (e.target as HTMLElement).closest('.cm-grip');
      if (!g || !st.current.editing || drag || dragging.current || e.touches.length !== 1) return;
      if (e.cancelable) e.preventDefault();
      e.stopPropagation(); // шит не должен начать закрываться от этого касания
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
      const g = (e.target as HTMLElement).closest('.cm-grip');
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
  }, [rendered, closeRow]);

  if (!rendered) return null;

  return (
    <div
      className={'detail cs' + (show ? ' show' : '')}
      id="cm"
      aria-hidden={!show}
      style={{ height: height ? height + 'px' : undefined, ['--kb' as string]: kb + 'px', transform: oy ? 'translateY(' + oy + 'px)' : undefined }}
    >
      <div className="detail-dim" id="cm-dim" onClick={onClose} />
      <Squircle r="32 32 0 0" className="detail-panel cs-panel cm-panel" id="cm-panel" ref={panelRef as any}>
        <div className="cva-head">
          <div className="d-grab" />
          <div className="d-top">
            <button
              ref={editBtnRef}
              className={'rb' + (editing ? ' done' : '')}
              type="button"
              id="cm-edit"
              aria-label={L(editing ? 'Готово' : 'Править')}
              onClick={toggleEdit}
            >
              <svg viewBox="0 0 24 24">
                {editing ? (
                  <path d="M5.5 12.5l4.5 4.5l8.5-9.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                ) : (
                  <path d={PENCIL} />
                )}
              </svg>
            </button>
            <div className="d-top-title">{L('Категории')}</div>
            <button
              className="rb"
              type="button"
              id="cm-close"
              aria-label={L('Закрыть')}
              onClick={() => {
                hp('light');
                onClose();
              }}
            >
              <svg viewBox="0 0 24 24">
                <path d={CLOSE_PATH} />
              </svg>
            </button>
          </div>
          <SegmentedControl<CategoryType>
            id="cm-seg"
            className="cm-seg"
            value={type}
            onChange={v => {
              closeRow();
              setType(v);
            }}
            options={[
              { value: 'expense', label: L('Расходы') },
              { value: 'income', label: L('Доходы') },
            ]}
          />
        </div>
        <div className="cm-scroll" id="cm-scroll" ref={scrollRef}>
          <div className={'cm-list' + (editing ? ' edit' : '')} id="cm-list" ref={listRef} onClick={onListClick}>
            {ids.map(k => {
              const c = categories[k];
              const n = counts[k] || 0;
              return (
                <div className="cm-row" data-k={k} key={k}>
                  <button type="button" className="cv-trash" aria-label={L('Удалить')} dangerouslySetInnerHTML={{ __html: CV_TRASH }} />
                  <div className="cm-body">
                    <button type="button" className="cv-minus cm-minus" aria-label={L('Удалить')}>
                      <span />
                    </button>
                    <button type="button" className="cm-in">
                      <CategoryTile cat={c} radius={16} as="span" />
                      <span className="row-main">
                        <span className="row-title">{c.name}</span>
                        <span className="row-sub">{n ? n + ' ' + plural(n, 'операция', 'операции', 'операций') : L('нет операций')}</span>
                      </span>
                      <svg className="set-chev cm-chev" viewBox="0 0 24 24">
                        <path d={CHEV} />
                      </svg>
                    </button>
                    <span className="cv-grip cm-grip" aria-label={L('Перетащить')}>
                      <svg viewBox="0 0 24 24">
                        <path d={GRIP} />
                      </svg>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="cm-foot">
          <button
            type="button"
            className="pbtn primary cm-add"
            id="cm-add"
            onClick={() => {
              hp('light');
              if (editing) toggleEdit();
              onEdit(null, type);
            }}
          >
            <span>{L('Новая категория')}</span>
          </button>
        </div>
      </Squircle>
    </div>
  );
});
