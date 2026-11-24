import React from 'react';
import { L, MONTH_L, MONTHS_SHORT_L } from '../../i18n';
import { LangCode } from '../../types/settings';

export interface DateDraft {
  from: number | null;
  to: number | null;
  picking: boolean;
}

interface Props {
  draft: DateDraft;
  todayMidnight: number;
  lang: LangCode;
  onPick: (ts: number) => void;
}

const WEEK = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

/** Выбор диапазона по следующему тапу: первый тап начало, второй конец. */
export function pickDay(d: DateDraft, ts: number): DateDraft {
  if (!d.picking) return { from: ts, to: ts, picking: true };
  const from = d.from === null ? ts : d.from;
  return { from: Math.min(from, ts), to: Math.max(from, ts), picking: false };
}

/** Панель «Дата»: текущий и прошлый месяц, выбор диапазона. */
export const ListDatePanel: React.FC<Props> = ({ draft, todayMidnight, lang, onPick }) => {
  const months = MONTH_L[lang];
  const short = MONTHS_SHORT_L[lang];
  const fmtDay = (ts: number) => {
    const d = new Date(ts);
    return d.getDate() + ' ' + short[d.getMonth()];
  };
  let label: string;
  if (draft.from === null || draft.to === null) label = L('Выберите период');
  else if (draft.picking) label = fmtDay(draft.from) + ' – ' + L('выберите конец');
  else label = draft.from === draft.to ? fmtDay(draft.from) : fmtDay(draft.from) + ' – ' + fmtDay(draft.to);

  const now = new Date(todayMidnight);
  return (
    <div id="panel-date">
      <div className="fp-title">
        {L('Дата')}
        <span className="fp-sub">{label}</span>
      </div>
      <div className="cal-week">
        {WEEK.map(x => (
          <span key={x}>{L(x)}</span>
        ))}
      </div>
      {[-1, 0].map(mo => {
        const first = new Date(now.getFullYear(), now.getMonth() + mo, 1);
        const days = new Date(now.getFullYear(), now.getMonth() + mo + 1, 0).getDate();
        const lead = (first.getDay() + 6) % 7;
        const cells: React.ReactNode[] = [];
        for (let i = 0; i < lead; i++) cells.push(<div key={'l' + i} className="cal-day" />);
        for (let d = 1; d <= days; d++) {
          const ts = new Date(first.getFullYear(), first.getMonth(), d).getTime();
          let cls = 'cal-day';
          if (ts > todayMidnight) cls += ' future';
          if (ts === todayMidnight) cls += ' today';
          if (draft.from !== null && draft.to !== null && ts >= draft.from && ts <= draft.to) {
            cls += ts === draft.from || ts === draft.to ? ' sel' : ' mid';
            if (draft.from !== draft.to) {
              if (ts === draft.from) cls += ' st';
              if (ts === draft.to) cls += ' en';
            }
          }
          cells.push(
            <div key={ts} className={cls}>
              <button type="button" onClick={() => onPick(ts)}>
                {d}
              </button>
            </div>
          );
        }
        return (
          <React.Fragment key={mo}>
            <div className="cal-month">{months[first.getMonth()]}</div>
            <div className="cal-grid">{cells}</div>
          </React.Fragment>
        );
      })}
    </div>
  );
};
