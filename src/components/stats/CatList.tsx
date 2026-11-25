import React, { useLayoutEffect, useRef } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { CategoryTile } from '../ui/CategoryTile';
import { formatCurrency, groupThousands } from '../../lib/balance';
import { L, plural } from '../../i18n';
import { CatStat, StatData } from '../../lib/statsView';
import { countUp } from '../../lib/countUp';

/* Список категорий под кольцом (stRowHtml, morphList и orderRows из legacy).
   Строки переезжают на новое место, суммы досчитываются, новые строки въезжают, ушедшие гаснут. */

const EASE_OUT = 'cubic-bezier(.2, .8, .2, 1)';

function Delta({ diff, inc, sym }: { diff: number; inc: boolean; sym: string }) {
  const v = Math.round(diff);
  if (!v) return <span className="dl eq">= 0 {sym}</span>;
  return (
    <span className={'dl ' + (diff > 0 !== inc ? 'bad' : 'good')}>
      {(diff > 0 ? '↑ ' : '↓ ') + groupThousands(Math.abs(v)) + ' ' + sym}
    </span>
  );
}

interface Snap {
  top: number;
  height: number;
  sum: number;
  node: HTMLElement;
}

interface CatListProps {
  d: StatData;
  sel: string | null;
  sym: string;
  onOpen?: (cat: string) => void;
}

export const CatList: React.FC<CatListProps> = ({ d, sel, sym, onOpen }) => {
  const categories = useAppStore(s => s.categories);
  const dayRef = useRef<HTMLDivElement>(null);
  const snapRef = useRef<Record<string, Snap>>({});
  /* новые данные (период, тип, операции): строки «морфятся»; смена выбора только переставляет их */
  const dataRef = useRef(d);
  const timerRef = useRef(0);

  const fmt = (v: number) => formatCurrency(v, sym);
  const order = d.cats.map(c => c.cat);
  const si = sel ? order.indexOf(sel) : -1;
  if (si > 0) {
    order.splice(si, 1);
    order.unshift(sel as string);
  }
  const by: Record<string, CatStat> = {};
  d.cats.forEach(c => (by[c.cat] = c));

  useLayoutEffect(() => {
    const day = dayRef.current;
    const old = snapRef.current;
    const morph = dataRef.current !== d;
    dataRef.current = d;
    const next: Record<string, Snap> = {};
    if (!day) {
      snapRef.current = next;
      return;
    }
    const rows = Array.from(day.querySelectorAll<HTMLElement>('.st-row:not(.ghost)'));
    rows.forEach(r => {
      r.style.transition = 'none';
      r.style.transform = '';
    });
    const hadRows = Object.keys(old).length > 0;
    const kept: HTMLElement[] = [];
    const moved: HTMLElement[] = [];
    let fresh = 0;
    rows.forEach(r => {
      const k = r.getAttribute('data-cat') || '';
      const sum = parseFloat(r.getAttribute('data-sum') || '0');
      const o = old[k];
      if (o) {
        kept.push(r);
        const dy = Math.round(o.top - r.offsetTop);
        if (dy) {
          r.style.transform = 'translateY(' + dy + 'px)';
          moved.push(r);
        }
        if (morph) {
          const amt = r.querySelector('.row-amount') as HTMLElement | null;
          if (amt && o.sum !== sum) countUp(amt, o.sum, sum, (e, v) => (e.textContent = fmt(v)));
          r.querySelectorAll('.dl').forEach(x => (x as HTMLElement).animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' }));
        }
      } else if (hadRows && morph) {
        r.animate(
          [
            { opacity: 0, translate: '0 14px', scale: '.96' },
            { opacity: 1, translate: '0 0', scale: '1' },
          ],
          { duration: 360, delay: 90 + Math.min(fresh, 6) * 45, easing: EASE_OUT, fill: 'backwards' }
        );
        fresh++;
      }
      next[k] = { top: r.offsetTop, height: r.offsetHeight, sum, node: r.cloneNode(true) as HTMLElement };
    });
    /* ушедшие строки: копия на старом месте гаснет и уменьшается */
    if (morph) {
      Object.keys(old).forEach(k => {
        if (next[k]) return;
        const o = old[k];
        const g = o.node;
        g.classList.add('ghost');
        g.removeAttribute('data-cat');
        g.style.cssText =
          'position:absolute;left:0;width:100%;top:' + Math.round(o.top) + 'px;height:' + Math.round(o.height) + 'px;pointer-events:none;';
        day.appendChild(g);
        const a = g.animate(
          [
            { opacity: 1, scale: '1' },
            { opacity: 0, scale: '.94' },
          ],
          { duration: 220, easing: 'ease-out', fill: 'forwards' }
        );
        a.onfinish = () => g.remove();
      });
    }
    void day.offsetWidth;
    const dur = morph ? '.44s' : '.42s';
    moved.forEach(r => {
      r.style.transition = 'transform ' + dur + ' ' + EASE_OUT + ', opacity .25s ease';
      r.style.transform = '';
    });
    clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      kept.forEach(r => {
        r.style.transition = '';
        r.style.transform = '';
      });
    }, 520);
    snapRef.current = next;
  });

  if (!d.cats.length) {
    return (
      <div className="st-list" id="st-list">
        <div className="st-empty fx">
          {L(d.inc ? 'Доходов за этот период нет' : 'Расходов за этот период нет')}
        </div>
      </div>
    );
  }

  return (
    <div className={'st-list' + (sel ? ' has-sel' : '')} id="st-list">
      <div className="day" ref={dayRef}>
        {order.map(k => {
          const c = by[k];
          const pct = d.total ? Math.round((c.sum / d.total) * 100) : 0;
          const cat = categories[k];
          return (
            <button
              key={k}
              type="button"
              className={'row st-row' + (sel === k ? ' sel' : '')}
              data-cat={k}
              data-sum={c.sum}
              onClick={() => onOpen?.(k)}
            >
              <CategoryTile cat={cat} radius={16} as="span" />
              <span className="row-main">
                <span className="row-title">{cat?.name || k}</span>
                <span className="row-sub">
                  {c.n + ' ' + plural(c.n, 'операция', 'операции', 'операций') + ' · ' + pct + '%'}
                </span>
              </span>
              <span className="row-end">
                <span className="row-amount">{fmt(c.sum)}</span>
                {d.prev.has && <Delta diff={c.sum - (d.prev.cats[k] || 0)} inc={d.inc} sym={sym} />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
