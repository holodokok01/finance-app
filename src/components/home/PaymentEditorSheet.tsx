import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Squircle } from '../ui/Squircle';
import { SegmentedControl } from '../ui/SegmentedControl';
import { DatePickerModal } from '../ui/DatePickerModal';
import { useAppStore } from '../../store/useAppStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { toast } from '../../store/useToastStore';
import { usePullToClose } from '../../hooks/usePullToClose';
import { useHoldToDelete } from '../../hooks/useHoldToDelete';
import { useSheetPresence } from '../../hooks/useSheetPresence';
import { haptic } from '../../services/telegram';
import { postSym, preSym, symOf } from '../../lib/balance';
import { cleanAmountInput, parseAmount, payAdvance, payDays } from '../../lib/payments';
import { ICONS, ICONSET } from '../../assets/icons';
import { L, LOC } from '../../i18n';
import { RecurringPeriod } from '../../types/fin';

const CLOSE_PATH = 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z';
const CHEV_PATH =
  'M15.835 11.63L9.205 5.2C8.79 4.799 8 5.042 8 5.57v12.86c0 .528.79.771 1.205.37l6.63-6.43a.5.5 0 0 0 0-.74';

export interface PaymentEditorSheetProps {
  /** null: закрыт; {id: null}: новый платёж; {id}: правка */
  target: { id: string | null } | null;
  onClose: () => void;
}

export const PaymentEditorSheet: React.FC<PaymentEditorSheetProps> = ({ target, onClose }) => {
  const payments = useAppStore(s => s.payments);
  const categories = useAppStore(s => s.categories);
  const categoryOrder = useAppStore(s => s.categoryOrder);
  const todayMidnight = useAppStore(s => s.todayMidnight);
  const addPayment = useAppStore(s => s.addPayment);
  const updatePayment = useAppStore(s => s.updatePayment);
  const deletePayment = useAppStore(s => s.deletePayment);
  const base = useSettingsStore(s => s.base);
  const hapticOn = useSettingsStore(s => s.haptic);
  const lang = useSettingsStore(s => s.lang) || 'ru';

  const open = target !== null;
  const hp = useCallback((k: Parameters<typeof haptic>[0]) => haptic(k, hapticOn), [hapticOn]);
  const { rendered, show, height } = useSheetPresence(open, () => hp('light'));

  const expenseIds = categoryOrder.expense || [];
  const [editId, setEditId] = useState<string | null>(null);
  const [sum, setSum] = useState('');
  const [name, setName] = useState('');
  const [cat, setCat] = useState('');
  const [per, setPer] = useState<RecurringPeriod>('month');
  const [next, setNext] = useState(todayMidnight);
  const [focused, setFocused] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [shake, setShake] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mirRef = useRef<HTMLSpanElement>(null);
  const caretRef = useRef<HTMLElement>(null);
  const catsRef = useRef<HTMLDivElement>(null);

  const existing = editId ? payments.find(p => p.id === editId) || null : null;

  // Заполнение при открытии
  useEffect(() => {
    if (!target) return;
    const p = target.id ? useAppStore.getState().payments.find(x => x.id === target.id) : null;
    setEditId(p ? p.id : null);
    setSum(p ? String(p.sum).replace('.', ',') : '');
    setName(p && p.n ? p.n : '');
    const c = p ? useAppStore.getState().categories[p.cat] : null;
    setCat(p && c && c.type !== 'income' ? p.cat : expenseIds[0] || '');
    setPer(p ? p.per : 'month');
    setNext(p ? p.next : todayMidnight);
    setFocused(false);
    setDateOpen(false);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const close = useCallback(() => {
    if (document.activeElement && (document.activeElement as HTMLElement).blur) {
      (document.activeElement as HTMLElement).blur();
    }
    onClose();
  }, [onClose]);

  const { panelRef } = usePullToClose({ onClose: close, enabled: open && !dateOpen, scrollRef });

  // Ширина поля суммы по тексту и свой курсор
  const fit = useCallback(() => {
    const input = inputRef.current;
    const mir = mirRef.current;
    const caret = caretRef.current;
    if (!input || !mir || !caret) return;
    mir.textContent = input.value || input.placeholder;
    input.style.width = Math.ceil(mir.offsetWidth + (input.value ? 4 : 10)) + 'px';
    mir.textContent = input.value;
    const w = input.value ? Math.round(mir.offsetWidth) : 0;
    caret.style.left = Math.round(input.offsetLeft + (w ? w + 1 : 2)) + 'px';
    caret.style.top = Math.round(input.offsetTop + (input.offsetHeight - 44) / 2) + 'px';
    caret.style.animation = 'none';
    void caret.offsetWidth;
    caret.style.animation = '';
  }, []);

  useLayoutEffect(() => {
    if (rendered) fit();
  }, [rendered, sum, focused, show, lang, base, fit]);

  // Выбранная категория в ленте
  useEffect(() => {
    if (!show || !catsRef.current) return;
    const on = catsRef.current.querySelector('.cpill.on') as HTMLElement | null;
    if (on) catsRef.current.scrollLeft = Math.max(0, on.offsetLeft - 16);
  }, [show]);

  const holdHandlers = useHoldToDelete({
    onDelete: () => {
      if (!editId) return;
      const id = editId;
      close();
      deletePayment(id);
      toast(L('Платёж удалён'));
    },
  });

  const save = () => {
    const v = parseAmount(sum);
    if (!v) {
      setShake(false);
      requestAnimationFrame(() => setShake(true));
      hp('error');
      inputRef.current?.focus();
      return;
    }
    const data = { sum: v, n: name.trim(), cat, per, next, day: new Date(next).getDate() };
    if (editId) updatePayment(editId, data);
    else addPayment({ id: 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), ...data });
    hp('success');
    close();
  };

  const skip = () => {
    if (!existing) return;
    const q = { next: existing.next, per: existing.per, day: existing.day };
    payAdvance(q);
    updatePayment(existing.id, { next: q.next });
    close();
    toast(L('Пропущено'));
  };

  if (!rendered) return null;

  const sym = symOf(base);
  const dateLabel = (() => {
    if (next === todayMidnight) return L('Сегодня');
    if (next === todayMidnight + 86400000) return L('Завтра');
    const d = new Date(next);
    const o: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
    if (d.getFullYear() !== new Date(todayMidnight).getFullYear()) o.year = 'numeric';
    return d.toLocaleDateString(LOC[lang], o);
  })();
  const catName = categories[cat] ? categories[cat].name : '';
  const canSkip = !!existing && payDays(existing, todayMidnight) <= 0;

  return (
    <>
      <div
        className={`detail cs${show ? ' show' : ''}`}
        id="pe"
        aria-hidden={!show}
        style={{ height: height ? height + 'px' : undefined }}
      >
        <div className="detail-dim" id="pe-dim" onClick={close} />
        <Squircle r="32 32 0 0" className="detail-panel ce-panel" id="pe-panel" ref={panelRef as any}>
          <div className="ce-scroll" id="pe-scroll" ref={scrollRef}>
            <div className="d-grab" />
            <div className="d-top">
              <span className="d-spacer" />
              <div className="d-top-title" id="pe-title">
                {L(editId ? 'Платёж' : 'Новый платёж')}
              </div>
              <button
                className="rb"
                type="button"
                id="pe-close"
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
            <div
              className={`pe-amt${focused ? ' f' : ''}${shake ? ' pe-shake' : ''}`}
              id="pe-amt"
             
              onAnimationEnd={e => {
                if (e.animationName === 'shake') setShake(false);
              }}
            >
              <span className="pe-sym" id="pe-pre">
                {preSym(sym)}
              </span>
              <input
                id="pe-sum"
                ref={inputRef}
                inputMode="decimal"
                placeholder="0"
                autoComplete="off"
                value={sum}
                onChange={e => setSum(cleanAmountInput(e.target.value))}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
              />
              <span className="pe-sym" id="pe-post">
                {postSym(sym).trim()}
              </span>
              <span className="pe-mir" id="pe-mir" ref={mirRef} />
              <i className="pe-caret" id="pe-caret" ref={caretRef} />
            </div>
            <Squircle r={20} className="d-group">
              <label className="d-row">
                <span className="d-k">{L('Название')}</span>
                <input
                  id="pe-name"
                  maxLength={40}
                  autoComplete="off"
                  placeholder={catName}
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="d-row pe-date"
                id="pe-date"
                onClick={() => {
                  hp('light');
                  setDateOpen(true);
                }}
              >
                <span className="d-k">{L('Дата')}</span>
                <span className="d-v" id="pe-date-v">
                  {dateLabel}
                </span>
                <svg className="set-chev" viewBox="0 0 24 24">
                  <path d={CHEV_PATH} />
                </svg>
              </button>
            </Squircle>
            <div className="pe-sec">{L('Период')}</div>
            <SegmentedControl<RecurringPeriod>
              id="pe-per"
              className="pe-per"
              value={per}
              onChange={setPer}
              options={[
                { value: 'week', label: L('Неделя') },
                { value: 'month', label: L('Месяц') },
                { value: 'year', label: L('Год') },
              ]}
            />
            <div className="pe-sec">{L('Категория')}</div>
            <div className="a-cats" id="pe-cats" ref={catsRef}>
              {expenseIds.map(k => {
                const c = categories[k];
                if (!c) return null;
                return (
                  <button
                    key={k}
                    type="button"
                    className={`cpill${k === cat ? ' on' : ''}`}
                    data-c={k}
                    onClick={() => {
                      setCat(k);
                      hp('select');
                    }}
                  >
                    <span className="cp-ic" style={{ color: c.color }}>
                      {c.emoji ? (
                        <span className="emo">{c.emoji}</span>
                      ) : (
                        <svg
                          viewBox="0 0 24 24"
                          dangerouslySetInnerHTML={{ __html: (c.icon && (ICONS[c.icon] || ICONSET[c.icon])) || '' }}
                        />
                      )}
                    </span>
                    {c.name}
                  </button>
                );
              })}
            </div>
            {canSkip && (
              <button type="button" className="pbtn pe-skip" id="pe-skip" onClick={skip}>
                {L('Пропустить этот раз')}
              </button>
            )}
          </div>
          <div className="ce-foot">
            {editId && (
              <button className="pbtn danger" type="button" id="pe-del" {...holdHandlers}>
                <span>{L('Удалить')}</span>
              </button>
            )}
            <button type="button" className="pbtn primary" id="pe-save" onClick={save}>
              {L('Сохранить')}
            </button>
          </div>
        </Squircle>
      </div>
      <DatePickerModal
        isOpen={dateOpen}
        onClose={() => setDateOpen(false)}
        selectedDate={next}
        onSelectDate={ts => {
          setNext(ts);
          setDateOpen(false);
        }}
        mode="pay"
      />
    </>
  );
};
