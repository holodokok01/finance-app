import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Squircle } from '../ui/Squircle';
import { CategoryTile } from '../ui/CategoryTile';
import { useAppStore } from '../../store/useAppStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useToastStore, showUndo, toast } from '../../store/useToastStore';
import { useKeyboardInset } from '../../hooks/useKeyboardInset';
import { usePullToClose } from '../../hooks/usePullToClose';
import { useHoldToDelete } from '../../hooks/useHoldToDelete';
import { haptic } from '../../services/telegram';
import { formatCurrency, groupThousands, postSym, preSym, symOf } from '../../lib/balance';
import { CHECK } from '../../assets/icons';
import { L } from '../../i18n';
import { dayLabel } from '../../lib/dayLabel';
import { Transaction } from '../../types/fin';

const DAY = 86400000;

export interface TransactionDetailSheetProps {
  txId: number | null;
  onClose: () => void;
  onEdit: (tx: Transaction) => void;
}

/** Сумма по категории за 30 дней (включая сегодня), только того же знака. */
export function monthTotal(t: Transaction, list: Transaction[], todayMidnight: number): number {
  const from = todayMidnight - 29 * DAY;
  const inc = t.sum > 0;
  let s = 0;
  list.forEach(x => {
    if (x.cat === t.cat && x.sum > 0 === inc && x.ts >= from) s += Math.abs(x.sum);
  });
  return s;
}

const PENCIL_PATH =
  'm11.4 18.161l7.396-7.396a10.3 10.3 0 0 1-3.326-2.234a10.3 10.3 0 0 1-2.235-3.327L5.839 12.6c-.577.577-.866.866-1.114 1.184a6.6 6.6 0 0 0-.749 1.211c-.173.364-.302.752-.56 1.526l-1.362 4.083a1.06 1.06 0 0 0 1.342 1.342l4.083-1.362c.775-.258 1.162-.387 1.526-.56q.647-.308 1.211-.749c.318-.248.607-.537 1.184-1.114m9.448-9.448a3.932 3.932 0 0 0-5.561-5.561l-.887.887l.038.111a8.75 8.75 0 0 0 2.092 3.32a8.75 8.75 0 0 0 3.431 2.13z';
const CLOSE_PATH = 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z';
const CHEV_PATH =
  'M15.835 11.63L9.205 5.2C8.79 4.799 8 5.042 8 5.57v12.86c0 .528.79.771 1.205.37l6.63-6.43a.5.5 0 0 0 0-.74';

const Pencil: React.FC = () => (
  <svg className="d-edit" viewBox="0 0 24 24">
    <path d={PENCIL_PATH} />
  </svg>
);

export const TransactionDetailSheet: React.FC<TransactionDetailSheetProps> = ({ txId, onClose, onEdit }) => {
  const transactions = useAppStore(s => s.transactions);
  const categories = useAppStore(s => s.categories);
  const categoryOrder = useAppStore(s => s.categoryOrder);
  const todayMidnight = useAppStore(s => s.todayMidnight);
  const updateTransaction = useAppStore(s => s.updateTransaction);
  const deleteTransaction = useAppStore(s => s.deleteTransaction);
  const base = useSettingsStore(s => s.base);
  const hapticOn = useSettingsStore(s => s.haptic);
  const markSheetClosed = useToastStore(s => s.markSheetClosed);

  const [shownId, setShownId] = useState<number | null>(txId);
  const [rendered, setRendered] = useState(txId !== null);
  const [show, setShow] = useState(false);
  const [view, setView] = useState<'main' | 'pick'>('main');
  const [fade, setFade] = useState(false);
  const [note, setNote] = useState('');

  const switchingRef = useRef(false);
  const heightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOpen = txId !== null;

  const tx = useMemo(() => transactions.find(t => t.id === shownId) || null, [transactions, shownId]);

  const hp = useCallback((k: Parameters<typeof haptic>[0]) => haptic(k, hapticOn), [hapticOn]);

  const close = useCallback(() => {
    markSheetClosed();
    if (document.activeElement && (document.activeElement as HTMLElement).blur) {
      (document.activeElement as HTMLElement).blur();
    }
    onClose();
  }, [markSheetClosed, onClose]);

  const { panelRef } = usePullToClose({ onClose: close, enabled: isOpen });

  // Открытие и закрытие с анимацией
  useEffect(() => {
    if (isOpen) {
      const t = transactions.find(x => x.id === txId);
      setShownId(txId);
      setNote(t ? t.note || '' : '');
      setView('main');
      setFade(false);
      switchingRef.current = false;
      setRendered(true);
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setShow(true);
          hp('light');
        });
      });
      return () => cancelAnimationFrame(raf);
    }
    setShow(false);
    const timer = setTimeout(() => {
      setRendered(false);
      setShownId(null);
    }, 360);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txId]);

  // Блокировка скролла страницы под шитом
  useEffect(() => {
    const app = document.querySelector('.app');
    if (!app) return;
    if (isOpen) app.classList.add('locked');
    return () => app.classList.remove('locked');
  }, [isOpen]);

  // Высота шита полная, клавиатура поднимает панель через --kb
  const { height, kb, oy } = useKeyboardInset(rendered);

  // Операция удалена снаружи (например undo-цепочкой): закрываем
  useEffect(() => {
    if (isOpen && shownId !== null && !tx) close();
  }, [isOpen, shownId, tx, close]);

  useEffect(() => {
    return () => {
      if (heightTimerRef.current) clearTimeout(heightTimerRef.current);
    };
  }, []);

  const switchView = (next: 'main' | 'pick') => {
    if (switchingRef.current) return;
    switchingRef.current = true;
    setFade(true);
    setTimeout(() => {
      const panel = panelRef.current;
      const h0 = panel ? panel.offsetHeight : 0;
      setView(next);
      // высота меняется после рендера нового вида
      requestAnimationFrame(() => {
        if (!panel) {
          switchingRef.current = false;
          setFade(false);
          return;
        }
        panel.style.height = '';
        const h1 = panel.offsetHeight;
        panel.style.height = h0 + 'px';
        void panel.offsetHeight;
        panel.style.height = h1 + 'px';
        setFade(false);
        heightTimerRef.current = setTimeout(() => {
          panel.style.height = '';
          switchingRef.current = false;
        }, 300);
      });
    }, 140);
  };

  const holdHandlers = useHoldToDelete({
    onDelete: () => {
      if (!tx) return;
      const index = useAppStore.getState().transactions.findIndex(x => x.id === tx.id);
      const removed = deleteTransaction(tx.id);
      close();
      if (removed) showUndo(removed, index);
    },
  });

  if (!rendered) return null;

  const sym = symOf(base);
  const c = tx ? categories[tx.cat] : undefined;
  const inc = !!tx && tx.sum > 0;
  const absCents = tx ? Math.round(Math.abs(tx.sum) * 100) : 0;
  const cents = ('0' + (absCents % 100)).slice(-2);
  const catIds = categoryOrder[inc ? 'income' : 'expense'] || [];
  const catName = c ? c.name : tx ? tx.cat : '';

  return (
    <div
      className={`detail ${show ? 'show' : ''}`}
      id="detail"
      aria-hidden={!show}
      style={{ height: height ? height + 'px' : undefined, ['--kb' as string]: kb + 'px', transform: oy ? 'translateY(' + oy + 'px)' : undefined }}
    >
      <div className="detail-dim" id="detail-dim" onClick={close} />
      <Squircle r="32 32 0 0" className="detail-panel" id="detail-panel" ref={panelRef as any}>
        <div className="d-grab" />
        <div id="detail-body" style={{ opacity: fade ? 0 : 1 }}>
          {tx && view === 'main' && (
            <>
              <div className="d-top">
                <button
                  className="rb"
                  type="button"
                  id="d-close"
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
              <div className="d-hero">
                <CategoryTile cat={c} radius={24} className="big" />
                <div className="d-title">{catName}</div>
                <div className="d-date">
                  {dayLabel(tx.d)}, {tx.t}
                </div>
                <div className={`d-amount${inc ? ' plus' : ''}`}>
                  {inc ? '+' : '−'}
                  {preSym(sym)}
                  {groupThousands(Math.floor(absCents / 100))}
                  <span className="cents">
                    ,{cents}
                    {postSym(sym)}
                  </span>
                </div>
                <div className="d-month">
                  {L('{c} за 30 дней: {s}', {
                    c: catName,
                    s: formatCurrency(monthTotal(tx, transactions, todayMidnight), sym),
                  })}
                </div>
              </div>
              <Squircle r={24} className="d-group">
                <button
                  className="d-row"
                  type="button"
                  id="d-cat"
                  onClick={() => {
                    hp('select');
                    switchView('pick');
                  }}
                >
                  <span className="d-k">{L('Категория')}</span>
                  <span className="d-v">{catName}</span>
                  <Pencil />
                </button>
                <label className="d-row">
                  <span className="d-k">{L('Комментарий')}</span>
                  <input
                    id="d-note"
                    type="text"
                    maxLength={140}
                    placeholder={L('Добавить')}
                    autoComplete="off"
                    value={note}
                    onChange={e => {
                      setNote(e.target.value);
                      updateTransaction(tx.id, { note: e.target.value });
                    }}
                  />
                  <Pencil />
                </label>
                <button
                  className="d-row disabled"
                  type="button"
                  id="d-receipt"
                  aria-disabled="true"
                  onClick={() => toast('Скан чеков добавим позже')}
                >
                  <span className="d-k">{L('Чек')}</span>
                  <span className="d-v">{L('Прикрепить')}</span>
                </button>
              </Squircle>
              <div className="d-actions">
                <button
                  className="pbtn"
                  type="button"
                  id="d-edit"
                  onClick={() => {
                    close();
                    onEdit(tx);
                  }}
                >
                  {L('Изменить')}
                </button>
                <button className="pbtn danger" type="button" id="d-del" {...holdHandlers}>
                  <span>{L('Удалить')}</span>
                </button>
              </div>
            </>
          )}
          {tx && view === 'pick' && (
            <>
              <div className="d-top">
                <button
                  className="rb"
                  type="button"
                  id="d-back"
                  aria-label={L('Назад')}
                  onClick={() => {
                    hp('select');
                    switchView('main');
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    style={{ transform: 'scaleX(-1)', margin: 0, fill: 'currentColor', width: 24, height: 24 }}
                  >
                    <path d={CHEV_PATH} />
                  </svg>
                </button>
                <div className="d-top-title">{L('Изменить категорию')}</div>
                <span className="d-spacer" />
              </div>
              <div className="d-pick">
                {catIds.map(k => {
                  const ck = categories[k];
                  if (!ck) return null;
                  return (
                    <button
                      key={k}
                      className="fp-row"
                      type="button"
                      aria-pressed={tx.cat === k}
                      onClick={() => {
                        updateTransaction(tx.id, { cat: k });
                        hp('select');
                        switchView('main');
                      }}
                    >
                      <CategoryTile cat={ck} radius={16} as="span" />
                      <span className="row-title">{ck.name}</span>
                      <svg className="fp-check" viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: CHECK }} />
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </Squircle>
    </div>
  );
};
