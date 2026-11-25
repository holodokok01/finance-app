import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Squircle } from '../ui/Squircle';
import { CountUp } from '../ui/CountUp';
import { Delta } from './CatList';
import { formatCurrency } from '../../lib/balance';
import { haptic } from '../../services/telegram';
import { L, plural, MONTH_L, MONTHS_SHORT_L } from '../../i18n';
import { LangCode } from '../../types/settings';
import { Transaction } from '../../types/fin';
import { StatData, Per } from '../../lib/statsView';
import { barHi, barsFor, dayShort, fmtDay, rowsFor, tilesFor, Tile } from '../../lib/summary';

/* Карточка «Сводка»: плитки (среднее в день, прогноз), столбики по дням или месяцам,
   подпись выбранного столбика и две строки внизу (перенос renderSummary из legacy). */

const BAR_H = 96;

function Arrow() {
  return (
    <svg className="sm-arr" viewBox="0 0 16 16">
      <path d="M5 11L11 5M6 5h5v5" />
    </svg>
  );
}

function TileView({ t, d, sym }: { t: Tile; d: StatData; sym: string }) {
  const live = useRef(false);
  useEffect(() => {
    live.current = true;
  }, []);
  const fmt = (v: number) => formatCurrency(v, sym);
  return (
    <Squircle r={28} className="stat">
      <span className="stat-label">{L(t.label)}</span>
      <CountUp className="stat-value" value={t.value} formatKey={sym} paint={(el, v) => (el.textContent = fmt(v))} />
      {t.delta !== null && <Delta key={String(Math.round(t.delta))} diff={t.delta} inc={d.inc} sym={sym} fade={live.current} />}
    </Squircle>
  );
}

interface SummaryCardProps {
  d: StatData;
  per: Per;
  k: number;
  today: number;
  sym: string;
  lang: LangCode;
  hapticOn: boolean;
  active: boolean;
  /** выбранный тапом столбик (полночь его первого дня) */
  bar: number | null;
  onPickBar: (from: number) => void;
  onSelectTransaction: (tx: Transaction) => void;
  /** открыть операции за диапазон дней */
  onOpenRange?: (from: number, to: number) => void;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  d,
  per,
  k,
  today,
  sym,
  lang,
  hapticOn,
  active,
  bar,
  onPickBar,
  onSelectTransaction,
  onOpenRange,
}) => {
  const fmt = (v: number) => formatCurrency(v, sym);
  const bars = useMemo(() => barsFor(d, per), [d, per]);
  const tiles = useMemo(() => tilesFor(d, per, k, today), [d, per, k, today]);
  const rows = useMemo(() => rowsFor(d), [d]);
  const hi = barHi(bars, bar, today);
  const hb = bars[hi];

  /* плитки: первая колонка целая в px, вторая занимает остаток */
  const tilesRef = useRef<HTMLDivElement>(null);
  const tilesKey = tiles.map(t => t.label).join('|');
  useLayoutEffect(() => {
    const box = tilesRef.current;
    if (!box) return;
    const fit = () => {
      const w = box.clientWidth;
      box.style.gridTemplateColumns = w && tiles.length > 1 ? Math.floor((w - 8) / 2) + 'px 1fr' : '';
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [tilesKey, active]);

  /* столбики: ширина колонки целая; высота растёт плавно, корень как в legacy (sqrt от доли самого большого) */
  const n = bars.length;
  const W = Math.min(480, document.documentElement.clientWidth) - 64;
  const cw = Math.floor(W / n);
  const bw = cw - 3;
  const barsRef = useRef<HTMLDivElement>(null);
  const prevN = useRef(0);
  const delayTimer = useRef(0);
  useLayoutEffect(() => {
    const el = barsRef.current;
    if (!el) return;
    const fresh = prevN.current !== n;
    prevN.current = n;
    let mx = 0;
    bars.forEach(b => {
      if (b.sum > mx) mx = b.sum;
    });
    const is = Array.from(el.querySelectorAll<HTMLElement>('.bcol > i'));
    if (fresh) {
      is.forEach(i => (i.style.height = '4px'));
      void el.offsetWidth;
    }
    is.forEach((i, idx) => {
      const b = bars[idx];
      const h = mx && b.sum ? Math.max(4, Math.round(Math.sqrt(b.sum / mx) * BAR_H)) : 4;
      i.style.transitionDelay = Math.min(idx * 12, 280) + 'ms';
      i.style.height = h + 'px';
    });
    clearTimeout(delayTimer.current);
    delayTimer.current = window.setTimeout(() => is.forEach(i => (i.style.transitionDelay = '')), 800);
  }, [bars, n]);

  /* водить пальцем по столбикам: горизонтальное движение выделяет столбик под пальцем, вертикальное скроллит страницу */
  const scrub = useRef({ bars, cw, today, hapticOn, onPickBar, cur: -1, pad: 0 });
  scrub.current.bars = bars;
  scrub.current.cw = cw;
  scrub.current.today = today;
  scrub.current.hapticOn = hapticOn;
  scrub.current.onPickBar = onPickBar;
  scrub.current.pad = Math.floor((W - cw * n) / 2);
  const scrubbedAt = useRef(0);
  useEffect(() => {
    const el = barsRef.current;
    if (!el) return;
    let x0 = 0;
    let y0 = 0;
    let mode: '' | '?' | 'x' | 'y' = '';
    const pick = (x: number) => {
      const s = scrub.current;
      const r = el.getBoundingClientRect();
      let i = Math.floor((x - r.left - s.pad) / s.cw);
      i = Math.max(0, Math.min(s.bars.length - 1, i));
      while (i > 0 && s.bars[i].from > s.today) i--;
      if (i === s.cur) return;
      s.cur = i;
      s.onPickBar(s.bars[i].from);
      haptic('select', s.hapticOn);
    };
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        mode = 'y';
        return;
      }
      mode = '?';
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      scrub.current.cur = -1;
    };
    const onMove = (e: TouchEvent) => {
      if (mode === 'y' || mode === '') return;
      const t = e.touches[0];
      if (mode === '?') {
        const mx = t.clientX - x0;
        const my = t.clientY - y0;
        if (Math.abs(mx) < 6 && Math.abs(my) < 6) return;
        mode = Math.abs(mx) > Math.abs(my) * 1.2 ? 'x' : 'y';
        if (mode === 'y') return;
      }
      if (e.cancelable) e.preventDefault();
      scrubbedAt.current = performance.now();
      pick(t.clientX);
    };
    const onEnd = () => {
      if (mode === 'x') scrubbedAt.current = performance.now();
      mode = '';
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
  }, [n]);

  const label = hb ? (per === 'year' ? MONTH_L[lang][hb.mo as number] : dayShort(hb.from, today, lang)) : '';
  const isToday = hb && per !== 'year' && hb.from === today;
  const tipKey = hb
    ? [label, isToday && hb.n ? '' : hb.n, hb.n ? hb.sum : '', lang].join('|')
    : 'none';
  const rowsKey = rows ? [rows.big.id, rows.topTs, d.inc, lang, sym, rows.big.sum].join('|') : 'none';

  return (
    <Squircle r={32} className="ops-card st-card">
      <div className="card-head">
        <h2 className="card-title">{L('Сводка')}</h2>
      </div>
      <div key={tilesKey} ref={tilesRef} className={'st-tiles fx' + (tiles.length === 1 ? ' one' : '')}>
        {tiles.map(t => (
          <TileView key={t.label} t={t} d={d} sym={sym} />
        ))}
      </div>
      <div className="st-bars" key={n} ref={barsRef} style={{ paddingLeft: Math.floor((W - cw * n) / 2) }}>
        {bars.map((b, i) => (
          <button
            key={b.from}
            type="button"
            className={'bcol' + (i === hi ? ' hi' : '') + (b.from > today ? ' future' : '')}
            style={{ width: cw }}
            onClick={() => {
              if (performance.now() - scrubbedAt.current < 350) return;
              onPickBar(b.from);
              haptic('select', hapticOn);
            }}
          >
            <i className={b.sum ? '' : 'zero'} style={{ width: bw }} />
          </button>
        ))}
      </div>
      <div className="st-axis">
        {per === 'year' ? (
          <>
            <span>{MONTHS_SHORT_L[lang][0]}</span>
            <span>{MONTHS_SHORT_L[lang][11]}</span>
          </>
        ) : (
          <>
            <span>{fmtDay(d.r.from, lang)}</span>
            <span>{fmtDay(d.r.to, lang)}</span>
          </>
        )}
      </div>
      <button
        key={tipKey}
        type="button"
        className="st-tip fx"
        disabled={!(hb && hb.n)}
        onClick={() => {
          if (!hb || !hb.n) return;
          haptic('light', hapticOn);
          onOpenRange?.(hb.from, hb.to);
        }}
      >
        {hb ? (
          <>
            <b>{label}</b>
            {!(isToday && hb.n) && (
              <span>
                {'· ' + (hb.n ? hb.n + ' ' + plural(hb.n, 'операция', 'операции', 'операций') : L('нет операций'))}
              </span>
            )}
            {hb.n > 0 && (
              <>
                <span className="tv">{fmt(hb.sum)}</span>
                <Arrow />
              </>
            )}
          </>
        ) : (
          <b>{L('Нет операций')}</b>
        )}
      </button>
      <div className="st-rows fx" key={rowsKey}>
        {rows && (
          <>
            <button
              type="button"
              className="sm-row sm-go"
              onClick={() => {
                haptic('light', hapticOn);
                onSelectTransaction(rows.big);
              }}
            >
              <span className="sm-k">{L(d.inc ? 'Крупнейший доход' : 'Крупнейшая трата')}</span>
              <span className="sm-end">
                <span className="sm-v">{fmt(rows.big.sum)}</span>
                <Arrow />
              </span>
            </button>
            <button
              type="button"
              className="sm-row sm-go"
              onClick={() => {
                haptic('light', hapticOn);
                onOpenRange?.(rows.topTs, rows.topTs);
              }}
            >
              <span className="sm-k">{L(d.inc ? 'Лучший день' : 'Самый дорогой день')}</span>
              <span className="sm-end">
                <span className="sm-v">{dayShort(rows.topTs, today, lang)}</span>
                <Arrow />
              </span>
            </button>
          </>
        )}
      </div>
    </Squircle>
  );
};
