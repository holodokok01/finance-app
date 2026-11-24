import React, { useEffect, useRef, useState } from 'react';
import { Squircle } from './Squircle';
import { MONTH_L, L } from '../../i18n';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useAppStore } from '../../store/useAppStore';
import { haptic } from '../../services/telegram';
import { usePullToClose } from '../../hooks/usePullToClose';

export interface DatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: number;
  onSelectDate: (ts: number) => void;
  mode?: 'add' | 'pay';
}

function midnight(off: number): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - off);
  return d.getTime();
}

export const DatePickerModal: React.FC<DatePickerModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  onSelectDate,
  mode = 'add',
}) => {
  const rawLang = useSettingsStore(s => s.lang);
  const lang = rawLang || 'ru';
  const todayMidnight = useAppStore(s => s.todayMidnight);
  const [rendered, setRendered] = useState(isOpen);
  const [showClass, setShowClass] = useState(false);
  const calRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  usePullToClose({
    onClose,
    enabled: isOpen,
  });

  useEffect(() => {
    if (isOpen) {
      setRendered(true);
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
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && calRef.current) {
      if (mode === 'add') {
        calRef.current.scrollTop = calRef.current.scrollHeight;
      } else {
        calRef.current.scrollTop = 0;
        const se = calRef.current.querySelector('.sel');
        if (se) {
          const mh = se.closest('.cal-grid')?.previousElementSibling as HTMLElement | null;
          if (mh && calRef.current) {
            calRef.current.scrollTop = Math.max(0, Math.round(mh.getBoundingClientRect().top - calRef.current.getBoundingClientRect().top) - 8);
          }
        }
      }
    }
  }, [isOpen, mode]);

  if (!rendered && !isOpen) return null;

  const handlePick = (ts: number) => {
    haptic('light');
    onSelectDate(ts);
    setTimeout(() => {
      onClose();
    }, 160);
  };

  const monthsOffsets = mode === 'pay'
    ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    : [-2, -1, 0];

  const now = new Date(todayMidnight);
  const currentOffset = Math.round((todayMidnight - selectedDate) / 86400000);

  const quick2Offset = mode === 'pay' ? -1 : 1;
  const quick2Label = mode === 'pay' ? L('Завтра', undefined, lang) : L('Вчера', undefined, lang);

  return (
    <div
      className={`detail dp ${showClass ? 'show' : ''}`}
      id="dp"
      aria-hidden={!isOpen}
      style={{ height: '100%' }}
    >
      <div className="detail-dim" id="dp-dim" onClick={onClose} />
      <Squircle
        r="32 32 0 0"
        className="detail-panel dp-panel sq"
        id="dp-panel"
        ref={panelRef as any}
      >
        <div className="d-grab" />
        <div className="d-top">
          <span className="d-spacer" />
          <div className="d-top-title">{L('Дата', undefined, lang)}</div>
          <button
            className="rb"
            type="button"
            id="dp-close"
            aria-label={L('Закрыть', undefined, lang)}
            onClick={onClose}
          >
            <svg viewBox="0 0 24 24">
              <path fill="currentColor" d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        <div className="dp-quick">
          <button
            type="button"
            className={`chip ${currentOffset === 0 ? 'on' : ''}`}
            data-q="0"
            onClick={() => handlePick(midnight(0))}
          >
            {L('Сегодня', undefined, lang)}
          </button>
          <button
            type="button"
            className={`chip ${currentOffset === quick2Offset ? 'on' : ''}`}
            data-q={quick2Offset}
            onClick={() => handlePick(midnight(quick2Offset))}
          >
            {quick2Label}
          </button>
        </div>

        <div className="cal-week">
          <span>{L('пн', undefined, lang)}</span>
          <span>{L('вт', undefined, lang)}</span>
          <span>{L('ср', undefined, lang)}</span>
          <span>{L('чт', undefined, lang)}</span>
          <span>{L('пт', undefined, lang)}</span>
          <span>{L('сб', undefined, lang)}</span>
          <span>{L('вс', undefined, lang)}</span>
        </div>

        <div id="dp-cal" ref={calRef}>
          {monthsOffsets.map(mo => {
            const first = new Date(now.getFullYear(), now.getMonth() + mo, 1);
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + mo + 1, 0).getDate();
            const lead = (first.getDay() + 6) % 7;
            const monthName = (MONTH_L[lang] || MONTH_L['ru'])[first.getMonth()];

            const emptyDays = Array.from({ length: lead }, (_, i) => (
              <div key={`lead-${mo}-${i}`} className="cal-day" />
            ));

            const days = Array.from({ length: daysInMonth }, (_, i) => {
              const d = i + 1;
              const ts = new Date(first.getFullYear(), first.getMonth(), d).getTime();
              const isFuture = mode === 'pay' ? ts < todayMidnight : ts > todayMidnight;
              const isToday = ts === todayMidnight;
              const isSel = ts === selectedDate;
              const cls = `cal-day${isFuture ? ' future' : ''}${isToday ? ' today' : ''}${isSel ? ' sel' : ''}`;

              return (
                <div key={`d-${mo}-${d}`} className={cls}>
                  <button
                    type="button"
                    data-ts={ts}
                    disabled={isFuture}
                    onClick={() => !isFuture && handlePick(ts)}
                  >
                    {d}
                  </button>
                </div>
              );
            });

            return (
              <React.Fragment key={`m-${mo}`}>
                <div className="cal-month">{monthName}</div>
                <div className="cal-grid">
                  {emptyDays}
                  {days}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </Squircle>
    </div>
  );
};
