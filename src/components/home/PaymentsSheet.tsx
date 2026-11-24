import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Squircle } from '../ui/Squircle';
import { CategoryTile } from '../ui/CategoryTile';
import { useAppStore } from '../../store/useAppStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { toast } from '../../store/useToastStore';
import { usePullToClose } from '../../hooks/usePullToClose';
import { useSheetPresence } from '../../hooks/useSheetPresence';
import { haptic } from '../../services/telegram';
import { symOf } from '../../lib/balance';
import { PER_K, PER_N, fmtMoney, payDays, payWhen, paySorted } from '../../lib/payments';
import { setRowSwipe, SWIPE_OPEN } from '../../lib/swipeRow';
import { CV_TRASH } from '../../assets/icons';
import { ICON_EMPTY } from '../../assets/listIcons';
import { L } from '../../i18n';
import { RecurringPayment } from '../../types/fin';

const CLOSE_PATH = 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z';

export interface PaymentsSheetProps {
  open: boolean;
  onClose: () => void;
  /** id платежа или null для нового */
  onEdit: (id: string | null) => void;
}

export const PaymentsSheet: React.FC<PaymentsSheetProps> = ({ open, onClose, onEdit }) => {
  const payments = useAppStore(s => s.payments);
  const categories = useAppStore(s => s.categories);
  const categoryOrder = useAppStore(s => s.categoryOrder);
  const todayMidnight = useAppStore(s => s.todayMidnight);
  const deletePayment = useAppStore(s => s.deletePayment);
  const base = useSettingsStore(s => s.base);
  const hapticOn = useSettingsStore(s => s.haptic);
  useSettingsStore(s => s.lang); // перерисовка при смене языка

  const hp = useCallback((k: Parameters<typeof haptic>[0]) => haptic(k, hapticOn), [hapticOn]);
  const { rendered, show, height } = useSheetPresence(open, () => hp('light'));

  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const openRow = useRef<HTMLElement | null>(null);
  const swipedAt = useRef(0);

  const close = useCallback(() => {
    openRow.current = null;
    onClose();
  }, [onClose]);

  const { panelRef } = usePullToClose({ onClose: close, enabled: open, scrollRef });

  const firstExpense = (categoryOrder.expense || [])[0];
  const catOf = (p: RecurringPayment) => {
    const c = categories[p.cat];
    return c && c.type !== 'income' ? c : categories[firstExpense];
  };

  const sorted = useMemo(() => paySorted(payments), [payments]);
  const sym = symOf(base);

  const summary = useMemo(() => {
    let tot = 0;
    const parts = payments
      .map(p => {
        const v = p.sum * (PER_K[p.per] || 1);
        tot += v;
        const c = categories[p.cat] && categories[p.cat].type !== 'income' ? categories[p.cat] : categories[firstExpense];
        return { id: p.id, v, color: c ? c.color : '#888' };
      })
      .sort((a, b) => b.v - a.v);
    return { tot: Math.round(tot), parts };
  }, [payments, categories, firstExpense]);

  const closeRow = useCallback(() => {
    const r = openRow.current;
    openRow.current = null;
    if (r && r.isConnected) setRowSwipe(r, 0, true);
  }, []);

  // Удаление: строка улетает, потом схлопывается и уходит из хранилища
  const flyRow = useCallback(
    (row: HTMLElement) => {
      openRow.current = null;
      hp('medium');
      setRowSwipe(row, -row.offsetWidth, true, true);
      const id = row.dataset.p || '';
      setTimeout(() => {
        row.style.height = row.offsetHeight + 'px';
        row.classList.add('out');
        setTimeout(() => {
          deletePayment(id);
          toast(L('Платёж удалён'));
        }, 270);
      }, 240);
    },
    [deletePayment, hp]
  );

  // Свайп влево: короткий показывает корзину, длинный удаляет при отпускании
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
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
      if (!r || e.touches.length !== 1) {
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
      const a = setRowSwipe(row, dx, false);
      if (a !== armed) {
        armed = a;
        hp(a ? 'medium' : 'light');
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
      if (armed) {
        flyRow(r);
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
    list.addEventListener('touchstart', onStart, { passive: true });
    list.addEventListener('touchmove', onMove, { passive: false });
    list.addEventListener('touchend', onEnd);
    list.addEventListener('touchcancel', onEnd);
    return () => {
      list.removeEventListener('touchstart', onStart);
      list.removeEventListener('touchmove', onMove);
      list.removeEventListener('touchend', onEnd);
      list.removeEventListener('touchcancel', onEnd);
    };
  }, [rendered, payments.length, closeRow, flyRow, hp]);

  // Шит закрыт: закрываем и открытую строку
  useEffect(() => {
    if (!open) openRow.current = null;
  }, [open]);

  const onListClick = (e: React.MouseEvent) => {
    const row = (e.target as HTMLElement).closest('.cm-row') as HTMLElement | null;
    if (!row) return;
    if (performance.now() - swipedAt.current < 350) return;
    if ((e.target as HTMLElement).closest('.cv-trash')) {
      flyRow(row);
      return;
    }
    if (openRow.current) {
      closeRow();
      return;
    }
    hp('light');
    onEdit(row.dataset.p || null);
  };

  if (!rendered) return null;

  return (
    <div
      className={`detail cs${show ? ' show' : ''}`}
      id="py"
      aria-hidden={!show}
      style={{ height: height ? height + 'px' : undefined }}
    >
      <div className="detail-dim" id="py-dim" onClick={close} />
      <Squircle r="32 32 0 0" className="detail-panel cs-panel cm-panel" id="py-panel" ref={panelRef as any}>
        <div className="cva-head">
          <div className="d-grab" />
          <div className="d-top">
            <span className="d-spacer" />
            <div className="d-top-title">{L('Платежи')}</div>
            <button
              className="rb"
              type="button"
              id="py-close"
              aria-label={L('Закрыть')}
              onClick={() => {
                hp('light');
                close();
              }}
            >
              <svg viewBox="0 0 24 24">
                <path d={CLOSE_PATH} />
              </svg>
            </button>
          </div>
          {payments.length > 0 && (
            <div className="py-sum" id="py-sum">
              <div className="py-tot">
                <span>{L('В месяц')}</span>
                <b>{fmtMoney(summary.tot, sym)}</b>
              </div>
              <div className="py-bar">
                {summary.parts.map(x => (
                  <i key={x.id} style={{ flex: Math.max(1, Math.round(x.v * 100)), background: x.color }} />
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="cm-scroll" id="py-scroll" ref={scrollRef}>
          <div className="cm-list py-list" id="py-list" ref={listRef} onClick={onListClick}>
            {payments.length === 0 ? (
              <div className="empty">
                <Squircle r={32} className="empty-tile">
                  <svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: ICON_EMPTY }} />
                </Squircle>
                <div className="empty-title">{L('Пока нет платежей')}</div>
                <div className="empty-text">{L('Добавь аренду, подписки и другие регулярные траты')}</div>
              </div>
            ) : (
              sorted.map(p => {
                const c = catOf(p);
                const due = payDays(p, todayMidnight) <= 0;
                return (
                  <div className="cm-row" data-p={p.id} key={p.id}>
                    <button
                      type="button"
                      className="cv-trash"
                      aria-label={L('Удалить')}
                      dangerouslySetInnerHTML={{ __html: CV_TRASH }}
                    />
                    <div className="cm-body">
                      <button type="button" className="cm-in">
                        <CategoryTile cat={c} radius={16} as="span" />
                        <span className="row-main">
                          <span className="row-title">{p.n || (c ? c.name : p.cat)}</span>
                          <span className={`row-sub${due ? ' warn' : ''}`}>
                            {payWhen(p, todayMidnight) + ' · ' + L(PER_N[p.per])}
                          </span>
                        </span>
                        <span className="row-amount">{fmtMoney(p.sum, sym)}</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div className="cm-foot">
          <button
            type="button"
            className="pbtn primary cm-add"
            id="py-add"
            onClick={() => {
              hp('light');
              onEdit(null);
            }}
          >
            {L('Новый платёж')}
          </button>
        </div>
      </Squircle>
    </div>
  );
};
