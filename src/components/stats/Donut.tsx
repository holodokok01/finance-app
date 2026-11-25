import React, { useEffect, useRef } from 'react';

/* Кольцо из капсул: каждое изменение плавно идёт от текущей формы (перенос drawDonut из legacy). */

export interface DonutCat {
  cat: string;
  sum: number;
  color: string;
}

interface Arc {
  a: number;
  s: number;
}

const DR = 96;
const DW = 32;
const DUR = 560;

function dpt(a: number): string {
  const r = ((a - 90) * Math.PI) / 180;
  return (120 + DR * Math.cos(r)).toFixed(2) + ' ' + (120 + DR * Math.sin(r)).toFixed(2);
}

function arcD(a: number, s: number): string {
  if (s >= 359) return 'M' + dpt(a) + ' A' + DR + ' ' + DR + ' 0 1 1 ' + dpt(a + 180) + ' A' + DR + ' ' + DR + ' 0 1 1 ' + dpt(a + 359.9);
  return 'M' + dpt(a) + ' A' + DR + ' ' + DR + ' 0 ' + (s > 180 ? 1 : 0) + ' 1 ' + dpt(a + s);
}

function layout(cats: DonutCat[], total: number): Record<string, Arc> {
  const out: Record<string, Arc> = {};
  const n = cats.length;
  if (!n) return out;
  if (n === 1) {
    out[cats[0].cat] = { a: 0, s: 360 };
    return out;
  }
  const gap = (((DW + 8) / DR) * 180) / Math.PI;
  const avail = 360 - gap * n;
  let a = gap / 2;
  cats.forEach(c => {
    const s = Math.max(1, (c.sum / total) * avail);
    out[c.cat] = { a, s };
    a += s + gap;
  });
  return out;
}

interface DonutProps {
  cats: DonutCat[];
  total: number;
  sel: string | null;
  onPick: (cat: string | null) => void;
}

export const Donut: React.FC<DonutProps> = ({ cats, total, sel, onPick }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const st = useRef<{ cur: Record<string, Arc>; fade: Record<string, number>; paths: Record<string, SVGPathElement>; raf: number }>({
    cur: {},
    fade: {},
    paths: {},
    raf: 0,
  });

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const DN = st.current;
    const target = layout(cats, total);
    const keys = Object.keys(target);
    Object.keys(DN.cur).forEach(k => {
      if (keys.indexOf(k) < 0) keys.push(k);
    });
    const colors: Record<string, string> = {};
    cats.forEach(c => (colors[c.cat] = c.color));
    const from: Record<string, Arc> = {};
    const to: Record<string, Arc> = {};
    const f0: Record<string, number> = {};
    const f1: Record<string, number> = {};
    keys.forEach(k => {
      if (!DN.paths[k]) {
        const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        p.setAttribute('data-cat', k);
        svg.appendChild(p);
        DN.paths[k] = p;
      }
      if (colors[k]) DN.paths[k].setAttribute('stroke', colors[k]);
      const tg = target[k];
      const cu = DN.cur[k];
      from[k] = cu || { a: tg.a + tg.s / 2, s: 0 };
      to[k] = tg || { a: cu.a + cu.s / 2, s: 0 };
      f0[k] = DN.fade[k] === undefined ? 0 : DN.fade[k];
      f1[k] = tg ? 1 : 0;
    });
    cancelAnimationFrame(DN.raf);
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / DUR);
      const e = 1 - Math.pow(1 - k, 3);
      keys.forEach(key => {
        const q = { a: from[key].a + (to[key].a - from[key].a) * e, s: from[key].s + (to[key].s - from[key].s) * e };
        const f = f0[key] + (f1[key] - f0[key]) * e;
        DN.cur[key] = q;
        DN.fade[key] = f;
        const p = DN.paths[key];
        p.setAttribute('d', arcD(q.a, Math.max(0.01, q.s)));
        p.setAttribute('stroke-opacity', String(Math.round(f * 100) / 100));
      });
      if (k < 1) {
        DN.raf = requestAnimationFrame(step);
        return;
      }
      keys.forEach(key => {
        if (target[key]) return;
        DN.paths[key].remove();
        delete DN.paths[key];
        delete DN.cur[key];
        delete DN.fade[key];
      });
    };
    step(t0);
  }, [cats, total]);

  /* выбранная категория: остальные капсулы тускнеют */
  useEffect(() => {
    const P = st.current.paths;
    Object.keys(P).forEach(k => P[k].classList.toggle('dim', !!sel && k !== sel));
  }, [sel, cats]);

  useEffect(() => () => cancelAnimationFrame(st.current.raf), []);

  const onClick = (e: React.MouseEvent) => {
    const p = (e.target as Element).closest('path[data-cat]');
    const k = p && cats.some(c => c.cat === p.getAttribute('data-cat')) ? p.getAttribute('data-cat') : null;
    if (!k && !sel) return;
    onPick(sel === k ? null : k);
  };

  return (
    <svg id="st-svg" ref={svgRef} width="240" height="240" viewBox="0 0 240 240" onClick={onClick}>
      <circle className={'st-track' + (cats.length ? '' : ' on')} id="st-track" cx="120" cy="120" r="96" />
    </svg>
  );
};
