import React, { useCallback, useMemo, useRef } from 'react';
import { Squircle } from '../ui/Squircle';
import { TransactionRow } from '../home/TransactionRow';
import { useAppStore } from '../../store/useAppStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { usePullToClose } from '../../hooks/usePullToClose';
import { useSheetPresence } from '../../hooks/useSheetPresence';
import { haptic } from '../../services/telegram';
import { dayLabel } from '../../lib/dayLabel';
import { groupByDay } from '../../lib/filters';
import { DAY, StatData } from '../../lib/statsView';
import { L, LOC, MONTH_L } from '../../i18n';
import { LangCode } from '../../types/settings';
import { Transaction } from '../../types/fin';

/* Шит «Операции за период»: операции одной категории или диапазона дней внутри выбранного периода
   (перенос renderCatSheet / openList из legacy). */

export type RangeSpec = { kind: 'cat'; cat: string } | { kind: 'range'; from: number; to: number };

interface RangeSheetProps {
  spec: RangeSpec | null;
  /** данные выбранного периода Статистики */
  d: StatData;
  today: number;
  onClose: () => void;
  onSelectTransaction: (tx: Transaction) => void;
}

function longDay(ts: number, y: boolean, lang: LangCode): string {
  return new Date(ts)
    .toLocaleDateString(LOC[lang], y ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'long' })
    .replace(/\s*(г|р)\.$/, '');
}

function rangeText(from: number, to: number, today: number, lang: LangCode): string {
  to = Math.min(to, today);
  const a = new Date(from);
  const b = new Date(to);
  if (from === to) return longDay(from, true, lang);
  if (a.getFullYear() !== b.getFullYear()) return longDay(from, true, lang) + ' – ' + longDay(to, true, lang);
  if (a.getMonth() === b.getMonth()) return a.getDate() + ' – ' + longDay(to, true, lang);
  return longDay(from, false, lang) + ' – ' + longDay(to, true, lang);
}

export const RangeSheet: React.FC<RangeSheetProps> = ({ spec, d, today, onClose, onSelectTransaction }) => {
  const categories = useAppStore(s => s.categories);
  const hapticOn = useSettingsStore(s => s.haptic);
  const lang = (useSettingsStore(s => s.lang) || 'ru') as LangCode;

  const open = !!spec;
  /* на время анимации закрытия держим последнюю спецификацию */
  const last = useRef<RangeSpec | null>(null);
  if (spec) last.current = spec;
  const s = spec || last.current;

  const hp = useCallback((k: Parameters<typeof haptic>[0]) => haptic(k, hapticOn), [hapticOn]);
  const { rendered, show, height, kb, oy } = useSheetPresence(open, () => hp('light'));
  const { panelRef } = usePullToClose({ onClose, enabled: open });

  const view = useMemo(() => {
    if (!s) return null;
    const cat = s.kind === 'cat';
    const items = d.items
      .filter(t => (cat ? t.cat === s.cat : t.ts >= s.from && t.ts <= s.to))
      .sort((a, b) => b.ts - a.ts || (a.t < b.t ? 1 : a.t > b.t ? -1 : 0));
    const from = cat ? d.r.from : s.from;
    const to = cat ? d.r.to : s.to;
    const end = new Date(Math.min(to, today));
    const start = new Date(from);
    const multi = start.getMonth() !== end.getMonth() || start.getFullYear() !== end.getFullYear();
    const title = cat
      ? categories[s.cat]
        ? categories[s.cat].name
        : s.cat
      : s.from === s.to
        ? dayLabel(Math.round((today - s.from) / DAY))
        : MONTH_L[lang][start.getMonth()];
    return { cat, items, from, to, multi, title };
  }, [s, d, today, categories, lang]);

  if (!rendered || !s || !view) return null;

  const y = new Date(today).getFullYear();
  const row = (t: Transaction) => <TransactionRow key={t.id} tx={t} onClick={onSelectTransaction} />;

  let list: React.ReactNode;
  if (!view.items.length) {
    list = <div className="st-empty">{L('Операций нет')}</div>;
  } else if (!view.cat && s.kind === 'range' && s.from === s.to) {
    list = <div className="day">{view.items.map(row)}</div>;
  } else if (view.multi) {
    const groups: { key: number; label: string; rows: Transaction[] }[] = [];
    view.items.forEach(t => {
      const dt = new Date(t.ts);
      const key = dt.getFullYear() * 12 + dt.getMonth();
      let g = groups[groups.length - 1];
      if (!g || g.key !== key) {
        g = { key, label: MONTH_L[lang][dt.getMonth()] + (dt.getFullYear() !== y ? ' ' + dt.getFullYear() : ''), rows: [] };
        groups.push(g);
      }
      g.rows.push(t);
    });
    list = groups.map(g => (
      <div className="day" key={g.key}>
        <div className="day-label">{g.label}</div>
        {g.rows.map(row)}
      </div>
    ));
  } else {
    list = groupByDay(view.items).map(g => (
      <div className="day" key={g.d + '_' + g.rows[0].id}>
        <div className="day-label">{dayLabel(g.d)}</div>
        {g.rows.map(row)}
      </div>
    ));
  }

  return (
    <div
      className={`detail cs${show ? ' show' : ''}`}
      id="cs"
      aria-hidden={!show}
      style={{ height: height ? height + 'px' : undefined, ['--kb' as string]: kb + 'px', transform: oy ? 'translateY(' + oy + 'px)' : undefined }}
    >
      <div className="detail-dim" id="cs-dim" onClick={onClose} />
      <Squircle r="32 32 0 0" className="detail-panel cs-panel" id="cs-panel" ref={panelRef as any}>
        <div className="d-top">
          <button
            className="rb"
            type="button"
            id="cs-close"
            aria-label={L('Назад')}
            onClick={() => {
              hp('light');
              onClose();
            }}
          >
            <svg viewBox="0 0 24 24" style={{ fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
              <path d="M20 12H4m0 0l6-6m-6 6l6 6" />
            </svg>
          </button>
        </div>
        <div className="cs-title">{view.title}</div>
        <div className="cs-sub">{rangeText(view.from, view.to, today, lang)}</div>
        <div className="list cs-list">{list}</div>
      </Squircle>
    </div>
  );
};
