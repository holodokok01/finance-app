import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { haptic } from '../../services/telegram';
import { Squircle } from '../ui/Squircle';
import { SegmentedControl } from '../ui/SegmentedControl';
import { CHECK } from '../../assets/icons';
import { Donut, DonutCat } from './Donut';
import { periodRange, periodLabel } from '../../lib/stats';
import { groupThousands, preSym, postSym, symOf } from '../../lib/balance';
import { L } from '../../i18n';
import { LangCode } from '../../types/settings';

type StatType = 'expense' | 'income';
type Per = 'week' | 'month' | 'year';
type Dir = 'back' | 'fwd' | 'swap' | null;

const EASE_OUT = 'cubic-bezier(.2, .8, .2, 1)';

/* серый подписи периода: t=0 боковой, t=1 текущий */
function mixGrey(t: number): string {
  const c = Math.round(99 + 156 * t);
  const b = Math.round(102 + 153 * t);
  return 'rgb(' + c + ',' + c + ',' + b + ')';
}

function stripLabel(per: Per, k: number, today: number, lang: LangCode): string {
  const l = periodLabel(per, k, today, lang);
  return per === 'month' ? l.replace(/ \d\d(\d\d)$/, ' ’$1') : l;
}

/* сумма в центре кольца: шрифт уменьшается целыми px, пока ширина не станет не больше 148px */
function paintEurFit(el: HTMLElement, v: number, sym: string): void {
  const a = Math.round(Math.abs(v) * 100);
  el.innerHTML =
    preSym(sym) + groupThousands(Math.floor(a / 100)) + '<span class="cents">,' + ('0' + (a % 100)).slice(-2) + postSym(sym) + '</span>';
  const cents = el.querySelector('.cents') as HTMLElement | null;
  let size = 34;
  el.style.fontSize = '';
  if (cents) cents.style.fontSize = '';
  while (size > 16 && el.offsetWidth > 148) {
    size -= 1;
    el.style.fontSize = size + 'px';
    if (cents) cents.style.fontSize = Math.round((size * 20) / 34) + 'px';
  }
}

export const StatsScreen: React.FC<{ active: boolean }> = ({ active }) => {
  const transactions = useAppStore(s => s.transactions);
  const categories = useAppStore(s => s.categories);
  const today = useAppStore(s => s.todayMidnight);
  const base = useSettingsStore(s => s.base);
  const lang = (useSettingsStore(s => s.lang) || 'ru') as LangCode;
  const hapticOn = useSettingsStore(s => s.haptic);
  const sym = symOf(base);

  const [type, setType] = useState<StatType>('expense');
  const [per, setPer] = useState<Per>('month');
  const [k, setK] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const shownRef = useRef<number | null>(null);
  const tweenRef = useRef(0);

  const ctlRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLElement>(null);
  const monthsRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const totalRef = useRef<HTMLDivElement>(null);
  const typeTextRef = useRef<HTMLSpanElement>(null);
  const dirRef = useRef<Dir>(null);
  const [perW, setPerW] = useState(0);
  const [slot, setSlot] = useState(0);
  const [pad, setPad] = useState(0);

  const minTs = useMemo(() => {
    let m = today;
    for (const t of transactions) if (t.ts < m) m = t.ts;
    return m;
  }, [transactions, today]);

  const canGoK = (kk: number) => kk >= 0 && periodRange(per, kk, today).to >= minTs;

  const data = useMemo(() => {
    const r = periodRange(per, k, today);
    const inc = type === 'income';
    const by: Record<string, DonutCat> = {};
    for (const t of transactions) {
      if (t.sum > 0 !== inc || t.ts < r.from || t.ts > r.to) continue;
      const b = by[t.cat] || (by[t.cat] = { cat: t.cat, sum: 0, color: categories[t.cat]?.color || '#8e8e93' });
      b.sum = Math.round((b.sum + Math.abs(t.sum)) * 100) / 100;
    }
    const cats = Object.keys(by)
      .map(key => by[key])
      .sort((a, b) => b.sum - a.sum);
    let total = 0;
    cats.forEach(c => (total += c.sum));
    return { inc, cats, total: Math.round(total * 100) / 100 };
  }, [transactions, categories, per, k, today, type]);

  /* выбор сбрасывается, если категории больше нет в периоде */
  const selCat = sel ? data.cats.find(c => c.cat === sel) || null : null;
  useEffect(() => {
    if (sel && !selCat) setSel(null);
  }, [sel, selCat]);
  const shown = selCat ? selCat.sum : data.total;

  /* кнопки периода получают целую ширину, заполняющую строку; полоса месяцев делится на 3 целых слота */
  useLayoutEffect(() => {
    const fit = () => {
      const w = ctlRef.current?.clientWidth || 0;
      if (w) setPerW(Math.max(50, Math.floor((w - 128 - 8 - 16) / 3)));
      const mw = monthsRef.current?.clientWidth || 0;
      if (mw) {
        const s = Math.floor(mw / 3) || 120;
        setSlot(s);
        setPad(Math.floor((mw - s * 3) / 2));
      }
    };
    fit();
    if (typeof ResizeObserver === 'undefined' || !ctlRef.current) return;
    const ro = new ResizeObserver(fit);
    ro.observe(ctlRef.current);
    return () => ro.disconnect();
  }, [active]);

  /* закрытие меню тапом мимо */
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element;
      if (!t.closest('#st-menu, #st-type-btn')) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [menuOpen]);

  /* анимация полосы после смены периода */
  useLayoutEffect(() => {
    const dir = dirRef.current;
    dirRef.current = null;
    const strip = stripRef.current;
    if (!strip || !dir) return;
    strip.getAnimations?.().forEach(a => a.cancel());
    if (dir === 'swap') {
      strip.animate([{ opacity: 0, scale: '.94' }, { opacity: 1, scale: '1' }], { duration: 320, easing: EASE_OUT });
      return;
    }
    const sign = dir === 'back' ? -1 : 1;
    const cfg = { duration: 440, easing: EASE_OUT };
    const items = strip.children;
    strip.animate([{ translate: Math.round(sign * slot) + 'px 0' }, { translate: '0 0' }], cfg);
    const nc = items[2] as HTMLElement | undefined;
    const oc = items[dir === 'back' ? 3 : 1] as HTMLElement | undefined;
    nc?.animate([{ scale: '.88', color: mixGrey(0) }, { scale: '1', color: mixGrey(1) }], cfg);
    oc?.animate([{ scale: '1', color: mixGrey(1) }, { scale: '.88', color: mixGrey(0) }], cfg);
  }, [k, per]);

  /* сумма в центре досчитывается до нового значения за 450 мс */
  useLayoutEffect(() => {
    const el = totalRef.current;
    if (!el) return;
    const from = shownRef.current;
    shownRef.current = shown;
    cancelAnimationFrame(tweenRef.current);
    if (from === null || from === shown || !active) {
      paintEurFit(el, shown, sym);
      return;
    }
    const t0 = performance.now();
    const step = (now: number) => {
      const q = Math.min(1, (now - t0) / 450);
      const e = 1 - Math.pow(1 - q, 3);
      paintEurFit(el, Math.round((from + (shown - from) * e) * 100) / 100, sym);
      if (q < 1) tweenRef.current = requestAnimationFrame(step);
    };
    step(t0);
  }, [shown, sym, active]);

  const goPeriod = (dk: number) => {
    const nk = k + dk;
    if (nk < 0 || (dk > 0 && !canGoK(nk))) {
      haptic('error', hapticOn);
      return;
    }
    haptic('select', hapticOn);
    dirRef.current = dk > 0 ? 'back' : 'fwd';
    setSel(null);
    setK(nk);
  };

  const pickType = (t: StatType) => {
    haptic('select', hapticOn);
    setMenuOpen(false);
    if (t === type) return;
    setSel(null);
    setType(t);
    const el = typeTextRef.current;
    if (el) {
      el.classList.remove('fx');
      void el.offsetWidth;
      el.classList.add('fx');
    }
  };

  const strip = [2, 1, 0, -1, -2].map(o => {
    const kk = k + o;
    const label = stripLabel(per, kk, today, lang);
    const ok = o === 0 || canGoK(kk);
    if (o === 0) return <div key={o} className="st-m cur">{label}</div>;
    if (Math.abs(o) === 2) return <div key={o} className={'st-m edge' + (ok ? '' : ' off')}>{label}</div>;
    return (
      <button key={o} type="button" className={'st-m' + (ok ? '' : ' off')} onClick={() => goPeriod(o)}>
        {label}
      </button>
    );
  });

  const perOptions = useMemo(
    () => [
      { value: 'week' as Per, label: L('Неделя') },
      { value: 'month' as Per, label: L('Месяц') },
      { value: 'year' as Per, label: L('Год') },
    ],
    [lang]
  );

  const label = selCat
    ? categories[selCat.cat]?.name || selCat.cat
    : data.cats.length
      ? L(data.inc ? 'Все доходы' : 'Все расходы')
      : L(data.inc ? 'Нет доходов' : 'Нет расходов');

  /* подпись под суммой мягко проявляется при смене текста */
  const lastLabel = useRef(label);
  useLayoutEffect(() => {
    if (lastLabel.current === label) return;
    lastLabel.current = label;
    const el = labelRef.current;
    if (!el) return;
    el.classList.remove('fx');
    void el.offsetWidth;
    el.classList.add('fx');
  }, [label]);

  const pick = (c: string | null) => {
    haptic('select', hapticOn);
    setSel(c);
  };

  return (
    <>
      <div className="scr-head">
        <h1 className="scr-title">{L('Статистика')}</h1>
      </div>
      <div className="st-ctl" ref={ctlRef}>
        <button
          type="button"
          className={'st-pill' + (menuOpen ? ' open' : '')}
          id="st-type-btn"
          ref={btnRef}
          aria-haspopup="true"
          aria-expanded={menuOpen}
          onClick={() => {
            setMenuOpen(o => !o);
            haptic('light', hapticOn);
          }}
        >
          <span id="st-type-text" ref={typeTextRef}>
            {L(type === 'income' ? 'Доходы' : 'Расходы')}
          </span>
          <svg className="st-chev" viewBox="0 0 24 24">
            <path d="M15.835 11.63L9.205 5.2C8.79 4.799 8 5.042 8 5.57v12.86c0 .528.79.771 1.205.37l6.63-6.43a.5.5 0 0 0 0-.74" />
          </svg>
        </button>
        <div className="st-mw">
          <Squircle r={24} className={'st-menu' + (menuOpen ? ' open' : '')} id="st-menu" role="menu" ref={menuRef}>
            {(['expense', 'income'] as StatType[]).map(t => (
              <button
                key={t}
                type="button"
                className="fp-row mn-row"
                role="menuitem"
                aria-pressed={type === t}
                onClick={() => pickType(t)}
              >
                <span className="row-title">{L(t === 'income' ? 'Доходы' : 'Расходы')}</span>
                <svg className="fp-check" viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: CHECK }} />
              </button>
            ))}
          </Squircle>
        </div>
        <div style={perW ? ({ ['--per-w' as string]: perW + 'px' } as React.CSSProperties) : undefined}>
          <SegmentedControl<Per>
            className="st-per"
            id="st-per"
            value={per}
            options={perOptions}
            onChange={p => {
              dirRef.current = 'swap';
              setSel(null);
              setPer(p);
              setK(0);
            }}
          />
        </div>
      </div>
      <Squircle r={32} className="ops-card st-card" id="st-card">
        <div
          className="st-months"
          id="st-months"
          ref={monthsRef}
          style={{ ['--slot' as string]: slot ? slot + 'px' : undefined, ['--pad' as string]: pad + 'px' } as React.CSSProperties}
        >
          <div className="st-strip" ref={stripRef}>
            {strip}
          </div>
        </div>
        <div className="st-donut">
          <Donut cats={data.cats} total={data.total} sel={selCat ? selCat.cat : null} onPick={pick} />
          <div className="st-center">
            <div className="st-total" id="st-total" ref={totalRef} />
            <div className="st-label" id="st-label" ref={labelRef} style={selCat ? { color: selCat.color } : undefined}>
              {label}
            </div>
          </div>
        </div>
      </Squircle>
    </>
  );
};
