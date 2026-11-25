import { useKeyboardInset } from '../../hooks/useKeyboardInset';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Squircle } from '../ui/Squircle';
import { DatePickerModal } from '../ui/DatePickerModal';
import { SegmentedControl } from '../ui/SegmentedControl';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useAppStore } from '../../store/useAppStore';
import { toast } from '../../store/useToastStore';
import { haptic } from '../../services/telegram';
import { formatCurrency, groupThousands, symOf } from '../../lib/balance';
import { ICONS, ICONSET } from '../../assets/icons';
import { L } from '../../i18n';
import { Transaction } from '../../types/fin';
import { usePullToClose } from '../../hooks/usePullToClose';

export interface AddTransactionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: 'expense' | 'income';
  editTransaction?: Transaction | null;
  /** кнопка «+» в списке категорий: открыть редактор новой категории */
  onNewCategory?: (type: 'expense' | 'income') => void;
  /** только что созданная категория: выбираем её */
  pickedCategory?: { k: string; n: number } | null;
}

interface Token {
  t: string;
  c: string;
  key: string;
}

const OPS = '+-*/';
const OPSYM: Record<string, string> = { '*': '×', '/': '÷', '+': '+', '-': '−' };

export function evalExpr(e: string): number {
  const pm = e.match(/^([\d,]+)%([\d,]*)$/);
  if (pm) {
    return Math.round(parseFloat(pm[1].replace(',', '.')) * parseFloat((pm[2] || '0').replace(',', '.'))) / 100;
  }
  e = e.replace(/[+\-*\/,]+$/, '').replace(/,/g, '.');
  if (!e || !/^[\d.+\-*\/]+$/.test(e)) return 0;
  let v: number;
  try {
    v = Function('"use strict";return (' + e + ')')();
  } catch (x) {
    return 0;
  }
  return isFinite(v) ? Math.round(v * 100) / 100 : 0;
}

function fmtPlain(v: number): string {
  const c = Math.round(v * 100) % 100;
  return groupThousands(Math.floor(v)) + (c ? ',' + ('0' + c).slice(-2) : '');
}

function numTokens(str: string, withCents: boolean, prefixKey: string): Token[] {
  const p = str.split(',');
  const t: Token[] = [];
  const wholeGrouped = groupThousands(parseInt(p[0] || '0', 10));
  wholeGrouped.split('').forEach((ch, idx) => {
    t.push({
      t: ch,
      c: ch === ' ' || ch === '\u00a0' ? 'sp' : '',
      key: `${prefixKey}-w-${idx}-${ch}`,
    });
  });
  if (p.length > 1) {
    t.push({ t: ',', c: withCents ? 'cents' : '', key: `${prefixKey}-comma` });
    p[1].split('').forEach((ch, idx) => {
      t.push({
        t: ch,
        c: withCents ? 'cents' : '',
        key: `${prefixKey}-c-${idx}-${ch}`,
      });
    });
  }
  return t;
}

function getDateChipLabel(dateTs: number, todayTs: number, lang: string): string {
  const diffDays = Math.round((todayTs - dateTs) / 86400000);
  if (diffDays === 0) return L('Сегодня', undefined, lang as any);
  if (diffDays === 1) return L('Вчера', undefined, lang as any);
  const dt = new Date(dateTs);
  const loc = lang === 'uk' ? 'uk-UA' : lang === 'en' ? 'en-GB' : 'ru-RU';
  return dt.toLocaleDateString(loc, { day: 'numeric', month: 'long' });
}

export const AddTransactionSheet: React.FC<AddTransactionSheetProps> = ({
  isOpen,
  onClose,
  initialType = 'expense',
  editTransaction = null,
  onNewCategory,
  pickedCategory = null,
}) => {
  const rawLang = useSettingsStore(s => s.lang);
  const lang = rawLang || 'ru';
  const base = useSettingsStore(s => s.base);
  const opening = useAppStore(s => s.opening);
  const transactions = useAppStore(s => s.transactions);
  const categories = useAppStore(s => s.categories);
  const categoryOrder = useAppStore(s => s.categoryOrder);
  const todayMidnight = useAppStore(s => s.todayMidnight);
  const addTransaction = useAppStore(s => s.addTransaction);
  const updateTransaction = useAppStore(s => s.updateTransaction);

  const [type, setType] = useState<'expense' | 'income'>(initialType);
  const [aStr, setAStr] = useState('');
  const [aCat, setACat] = useState('');
  const [aDate, setADate] = useState(todayMidnight);
  const [note, setNote] = useState('');
  const [isDpOpen, setIsDpOpen] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [animKey, setAnimKey] = useState<string | null>(null);
  const [rendered, setRendered] = useState(isOpen);
  const [showClass, setShowClass] = useState(false);

  const prevStrRef = useRef('');
  const wasOverRef = useRef(false);
  const t1Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t2Ref = useRef<ReturnType<typeof setInterval> | null>(null);
  const catsScrollRef = useRef<HTMLDivElement>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  const { panelRef } = usePullToClose({
    onClose,
    enabled: isOpen && !isDpOpen,
  });

  // Calculate available balance (excluding current edited transaction)
  const availableBalance = useMemo(() => {
    let b = opening;
    transactions.forEach(t => {
      if ((!editTransaction || t.id !== editTransaction.id) && !t.demo) {
        b += t.sum;
      }
    });
    return Math.round(b * 100) / 100;
  }, [opening, transactions, editTransaction]);

  const value = useMemo(() => evalExpr(aStr), [aStr]);
  const isOver = type === 'expense' && value > availableBalance;

  // Sync state on open / editTransaction changes
  useEffect(() => {
    if (isOpen) {
      setRendered(true);
      const newType = editTransaction
        ? (editTransaction.sum > 0 ? 'income' : 'expense')
        : (initialType || 'expense');
      setType(newType);

      if (editTransaction) {
        setAStr(String(Math.abs(editTransaction.sum)).replace('.', ','));
        setACat(editTransaction.cat);
        setNote(editTransaction.note || '');
        setADate(editTransaction.ts);
      } else {
        setAStr('');
        const list = categoryOrder[newType] || [];
        setACat(list[0] || 'food');
        setNote('');
        setADate(todayMidnight);
      }
      wasOverRef.current = false;

      const raf = requestAnimationFrame(() => {
        setShowClass(true);
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setShowClass(false);
      const timer = setTimeout(() => {
        setRendered(false);
      }, 360);
      return () => clearTimeout(timer);
    }
  }, [isOpen, editTransaction, initialType, categoryOrder, todayMidnight]);

  // Клавиатура: слой следует за окном Telegram, как у остальных модалов
  const { height: layerH } = useKeyboardInset(isOpen);

  // Over budget shake & haptic error
  useEffect(() => {
    if (isOver && !wasOverRef.current) {
      setIsShaking(true);
      haptic('error');
      const timer = setTimeout(() => setIsShaking(false), 400);
      wasOverRef.current = true;
      return () => clearTimeout(timer);
    }
    wasOverRef.current = isOver;
  }, [isOver]);

  useEffect(() => {
    if (pickedCategory && isOpen) setACat(pickedCategory.k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedCategory && pickedCategory.n]);

  // Auto scroll categories to selected
  useEffect(() => {
    if (isOpen && catsScrollRef.current) {
      const activePill = catsScrollRef.current.querySelector('.cpill.on') as HTMLElement | null;
      if (activePill) {
        catsScrollRef.current.scrollLeft = Math.max(0, activePill.offsetLeft - 16);
      }
    }
  }, [isOpen, aCat, type]);

  if (!rendered && !isOpen) return null;

  const sym = symOf(base);
  const pct = aStr.indexOf('%') >= 0;
  const hasOp = pct || /[+\-*\/]/.test(aStr);

  // Generate tokens
  let tokens: Token[] = [];
  if (!aStr) {
    tokens = [
      { t: sym, c: '', key: 'sym-0' },
      { t: '0', c: '', key: 'zero' },
      { t: ',', c: '', key: 'comma' },
      { t: '0', c: '', key: 'c1' },
      { t: '0', c: '', key: 'c2' },
    ];
  } else if (pct) {
    const pp = aStr.split('%');
    tokens = numTokens(pp[1] || '0', false, 'p2').filter(() => !!pp[1]);
    tokens.push({ t: '%', c: '', key: 'pct' });
    tokens.push({ t: L('от', undefined, lang), c: 'op', key: 'ot' });
    tokens.push({ t: sym, c: '', key: 'sym-pct' });
    tokens = tokens.concat(numTokens(pp[0], false, 'p1'));
  } else if (hasOp) {
    tokens.push({ t: sym, c: '', key: 'sym-op' });
    aStr.split(/([+\-*\/])/).forEach((part, idx) => {
      if (OPSYM[part]) {
        tokens.push({ t: OPSYM[part], c: 'op', key: `op-${idx}-${part}` });
      } else if (part) {
        tokens = tokens.concat(numTokens(part, false, `part-${idx}`));
      }
    });
  } else {
    tokens.push({ t: sym, c: '', key: 'sym-num' });
    tokens = tokens.concat(numTokens(aStr, true, 'num'));
  }

  const tokenCount = tokens.length;
  const amountSizeClass = tokenCount > 18 ? ' tiny' : tokenCount > 11 ? ' small' : '';

  const stopKeyRepeat = () => {
    if (t1Ref.current) {
      clearTimeout(t1Ref.current);
      t1Ref.current = null;
    }
    if (t2Ref.current) {
      clearInterval(t2Ref.current);
      t2Ref.current = null;
    }
  };

  const pressKey = (k: string, quiet = false) => {
    setAStr(prev => {
      let next = prev;
      const last = next.slice(-1);

      if (k === 'del') {
        next = next.slice(0, -1);
      } else if (k === '%') {
        if (!next || !/^[\d,]+$/.test(next) || parseFloat(next.replace(',', '.')) === 0) return prev;
        if (next.slice(-1) === ',') next = next.slice(0, -1);
        next += '%';
      } else if (OPS.indexOf(k) >= 0) {
        if (!next || next.indexOf('%') >= 0) return prev;
        if (OPS.indexOf(last) >= 0 || last === ',') {
          next = next.slice(0, -1) + k;
        } else {
          next += k;
        }
      } else {
        const lastPartMatch = next.match(/[\d,]*$/);
        const m = lastPartMatch ? lastPartMatch[0] : '';
        const p = m.split(',');

        if (k === ',') {
          if (m.indexOf(',') >= 0) return prev;
          next += m ? ',' : '0,';
        } else {
          if (p.length > 1) {
            if (p[1].length >= 2) return prev;
          } else if (p[0].length >= 9) {
            return prev;
          }
          if (m === '0') {
            next = next.slice(0, -1) + k;
          } else {
            next += k;
          }
        }
      }

      if (!quiet) haptic('light');
      prevStrRef.current = prev;
      setAnimKey(k);
      return next;
    });
  };

  const handlePointerDownKey = (k: string, e: React.PointerEvent) => {
    pressKey(k, e.pointerType === 'touch');
    stopKeyRepeat();
    if (k === 'del' || /^\d$/.test(k)) {
      t1Ref.current = setTimeout(() => {
        t2Ref.current = setInterval(() => {
          pressKey(k, true);
          haptic('select');
        }, 90);
      }, 400);
    }
  };

  const handleTouchEndKey = () => {
    haptic('light');
  };

  const handleTypeChange = (newType: 'expense' | 'income') => {
    if (newType === type) return;
    haptic('light');
    setType(newType);
    const list = categoryOrder[newType] || [];
    setACat(list[0] || 'food');
  };

  const handleSave = () => {
    const v = value;
    if (!(v > 0)) {
      haptic('error');
      toast(L('Введи сумму', undefined, lang));
      return;
    }
    if (type === 'expense' && v > availableBalance) {
      haptic('error');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 400);
      toast(L('Недостаточно средств', undefined, lang));
      return;
    }

    const now = new Date();
    const hh = ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2);
    const diffDays = Math.round((todayMidnight - aDate) / 86400000);
    const timeStr = diffDays === 0 ? hh : '12:00';
    const isIncome = type === 'income';
    const finalSum = isIncome ? v : -v;

    if (editTransaction) {
      const moved = editTransaction.ts !== aDate;
      updateTransaction(editTransaction.id, {
        cat: aCat,
        note: note.trim(),
        sum: finalSum,
        ts: aDate,
        ...(moved ? { t: timeStr } : {}),
      });
      haptic('success');
      toast(L('Операция изменена', undefined, lang));
    } else {
      addTransaction({
        cat: aCat,
        note: note.trim(),
        sum: finalSum,
        ts: aDate,
        t: timeStr,
      });
      haptic('success');
      toast(isIncome ? L('Доход добавлен', undefined, lang) : L('Расход добавлен', undefined, lang));
    }

    onClose();
  };

  const currentCategoryList = categoryOrder[type] || [];

  return (
    <>
      <div
        className={`detail ${showClass ? 'show' : ''}`}
        id="add"
        aria-hidden={!isOpen}
        style={{ height: layerH ? layerH + 'px' : '100%' }}
      >
        <div className="detail-dim" id="add-dim" onClick={onClose} />
        <Squircle
          r="32 32 0 0"
          className="detail-panel add-panel sq"
          id="add-panel"
          ref={panelRef as any}
        >
          <div className="d-grab" />
          <div className="a-top">
            <button
              className="rb"
              type="button"
              id="add-close"
              aria-label={L('Закрыть', undefined, lang)}
              onClick={onClose}
            >
              <svg viewBox="0 0 24 24">
                <path fill="currentColor" d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>

            {editTransaction ? (
              <div className="d-top-title" id="a-edit-title">
                {L('Изменить', undefined, lang)}
              </div>
            ) : (
              <SegmentedControl
                id="a-seg"
                value={type}
                onChange={handleTypeChange}
                options={[
                  { value: 'expense', label: L('Расход', undefined, lang) },
                  { value: 'income', label: L('Доход', undefined, lang) },
                ]}
              />
            )}

            <span className="d-spacer" />
          </div>

          <div className={`a-amount-wrap ${isShaking ? 'shake' : ''}`}>
            <div className={`a-avail ${isOver ? 'over' : ''}`} id="a-avail">
              {type === 'income'
                ? L('Баланс {s}', { s: formatCurrency(availableBalance, sym) }, lang)
                : L('Доступно {s}', { s: formatCurrency(availableBalance, sym) }, lang)}
            </div>

            <div className={`a-amount${amountSizeClass}${isOver ? ' over' : ''}`} id="a-amount">
              {tokens.map((k, i) => {
                const isLast = i === tokens.length - 1;
                const animClass = animKey && isLast ? ' pop' : '';
                return (
                  <span key={`${k.key}-${i}`} className={`ch ${k.c}${animClass}`}>
                    {k.t}
                  </span>
                );
              })}
            </div>

            <div className={`a-expr ${hasOp ? 'on' : ''}`} id="a-expr">
              {hasOp ? (value > 0 ? `= ${fmtPlain(value)}` : '= 0') : ''}
            </div>

            <input
              className="a-amt"
              id="a-amt"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              autoCorrect="off"
              aria-label={L('Сумма', undefined, lang)}
              value={aStr}
              readOnly
            />
          </div>

          <div
            className="a-row"
            ref={rowRef}
            onClick={e => {
              if ((e.target as HTMLElement).closest('#a-date') || e.target === noteInputRef.current) return;
              noteInputRef.current?.focus();
            }}
          >
            <svg className="a-row-ic" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="m11.4 18.161l7.396-7.396a10.3 10.3 0 0 1-3.326-2.234a10.3 10.3 0 0 1-2.235-3.327L5.839 12.6c-.577.577-.866.866-1.114 1.184a6.6 6.6 0 0 0-.749 1.211c-.173.364-.302.752-.56 1.526l-1.362 4.083a1.06 1.06 0 0 0 1.342 1.342l4.083-1.362c.775-.258 1.162-.387 1.526-.56q.647-.308 1.211-.749c.318-.248.607-.537 1.184-1.114m9.448-9.448a3.932 3.932 0 0 0-5.561-5.561l-.887.887l.038.111a8.75 8.75 0 0 0 2.092 3.32a8.75 8.75 0 0 0 3.431 2.13z"
              />
            </svg>
            <input
              className="a-note-input"
              id="a-note"
              ref={noteInputRef}
              type="text"
              maxLength={60}
              placeholder={L('Комментарий', undefined, lang)}
              enterKeyHint="done"
              autoComplete="off"
              value={note}
              onChange={e => setNote(e.target.value)}
              onFocus={() => rowRef.current?.classList.add('focus')}
              onBlur={() => rowRef.current?.classList.remove('focus')}
              onKeyDown={e => {
                if (e.key === 'Enter') noteInputRef.current?.blur();
              }}
            />
            <button
              className="chip"
              type="button"
              id="a-date"
              onClick={() => setIsDpOpen(true)}
            >
              <svg viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M7.75 2.5a.75.75 0 0 0-1.5 0v1.58c-1.44.115-2.384.397-3.078 1.092c-.695.694-.977 1.639-1.093 3.078h19.842c-.116-1.44-.398-2.384-1.093-3.078c-.694-.695-1.639-.977-3.078-1.093V2.5a.75.75 0 0 0-1.5 0v1.513C15.585 4 14.839 4 14 4h-4c-.839 0-1.585 0-2.25.013z"
                />
                <path
                  fill="currentColor"
                  fillRule="evenodd"
                  d="M2 12c0-.839 0-1.585.013-2.25h19.974C22 10.415 22 11.161 22 12v2c0 3.771 0 5.657-1.172 6.828S17.771 22 14 22h-4c-3.771 0-5.657 0-6.828-1.172S2 17.771 2 14zm15 2a1 1 0 1 0 0-2a1 1 0 0 0 0 2m0 4a1 1 0 1 0 0-2a1 1 0 0 0 0 2m-4-5a1 1 0 1 1-2 0a1 1 0 0 1 2 0m0 4a1 1 0 1 1-2 0a1 1 0 0 1 2 0m-6-3a1 1 0 1 0 0-2a1 1 0 0 0 0 2m0 4a1 1 0 1 0 0-2a1 1 0 0 0 0 2"
                  clipRule="evenodd"
                />
              </svg>
              <span>{getDateChipLabel(aDate, todayMidnight, lang)}</span>
            </button>
          </div>

          <div className="a-cats" id="a-cats" ref={catsScrollRef}>
            {currentCategoryList.map(catKey => {
              const cat = categories[catKey];
              if (!cat) return null;
              const isSelected = catKey === aCat;
              return (
                <button
                  key={catKey}
                  type="button"
                  className={`cpill ${isSelected ? 'on' : ''}`}
                  data-c={catKey}
                  onClick={() => {
                    setACat(catKey);
                    haptic('light');
                  }}
                >
                  <span className="cp-ic" style={{ color: cat.color }}>
                    {cat.emoji ? (
                      <span className="emo">{cat.emoji}</span>
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        dangerouslySetInnerHTML={{
                          __html: (cat.icon && (ICONS[cat.icon] || ICONSET[cat.icon])) || '',
                        }}
                      />
                    )}
                  </span>
                  {cat.name}
                </button>
              );
            })}
            <button
              type="button"
              className="cpill cp-add"
              data-add="1"
              aria-label={L('Новая категория', undefined, lang)}
              onClick={() => {
                haptic('light');
                if (onNewCategory) onNewCategory(type);
              }}
            >
              <svg viewBox="0 0 24 24">
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  d="M12 5v14M5 12h14"
                />
              </svg>
            </button>
          </div>

          <div className="a-ops" id="a-ops">
            <button type="button" data-k="*" onClick={() => pressKey('*')}>
              ×
            </button>
            <button type="button" data-k="/" onClick={() => pressKey('/')}>
              ÷
            </button>
            <button type="button" data-k="+" onClick={() => pressKey('+')}>
              +
            </button>
            <button type="button" data-k="-" onClick={() => pressKey('-')}>
              −
            </button>
            <button type="button" data-k="%" onClick={() => pressKey('%')}>
              %
            </button>
          </div>

          <div className="a-keys" id="a-keys">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0'].map(k => (
              <button
                key={k}
                type="button"
                data-k={k}
                onPointerDown={e => handlePointerDownKey(k, e)}
                onPointerUp={stopKeyRepeat}
                onPointerLeave={stopKeyRepeat}
                onPointerCancel={stopKeyRepeat}
                onTouchEnd={handleTouchEndKey}
                onContextMenu={e => e.preventDefault()}
              >
                {k}
              </button>
            ))}
            <button
              type="button"
              data-k="del"
              aria-label={L('Стереть', undefined, lang)}
              onPointerDown={e => handlePointerDownKey('del', e)}
              onPointerUp={stopKeyRepeat}
              onPointerLeave={stopKeyRepeat}
              onPointerCancel={stopKeyRepeat}
              onTouchEnd={handleTouchEndKey}
              onContextMenu={e => e.preventDefault()}
            >
              <svg viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  fillRule="evenodd"
                  d="M6.871 19.499c.93.501 2.044.501 4.271.501h2.637c3.875 0 5.813 0 7.017-1.172S22 15.771 22 12s0-5.657-1.204-6.828S17.654 4 13.78 4h-2.637c-2.227 0-3.341 0-4.27.501c-.93.502-1.52 1.42-2.701 3.259L3.49 8.82C2.497 10.366 2 11.14 2 12s.497 1.634 1.49 3.18l.68 1.06c1.181 1.838 1.771 2.757 2.701 3.259m4.16-10.53A.75.75 0 0 0 9.97 10.03L11.94 12l-1.97 1.97a.75.75 0 1 0 1.06 1.06L13 13.06l1.97 1.97a.75.75 0 0 0 1.06-1.06L14.06 12l1.97-1.97a.75.75 0 0 0-1.06-1.06L13 10.94z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>

          <button
            className={`pbtn primary ${isOver ? 'off' : ''}`}
            type="button"
            id="a-save"
            onClick={handleSave}
          >
            {L('Сохранить', undefined, lang)}
          </button>
        </Squircle>
      </div>

      <DatePickerModal
        isOpen={isDpOpen}
        onClose={() => setIsDpOpen(false)}
        selectedDate={aDate}
        onSelectDate={ts => setADate(ts)}
        mode="add"
      />
    </>
  );
};
