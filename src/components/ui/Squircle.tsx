import React, { useEffect, useRef } from 'react';

const SMOOTHING = 1;

function rad(d: number): number {
  return (d * Math.PI) / 180;
}

function n(v: number): number {
  return Math.round(v * 100) / 100;
}

interface CornerInfo {
  r: number;
  p: number;
  a?: number;
  b?: number;
  c?: number;
  d?: number;
  arc?: number;
}

function corner(r: number, s: number, budget: number): CornerInfo {
  if (!r) return { r: 0, p: 0 };
  r = Math.min(r, budget);
  const cs = Math.max(0, Math.min(s, budget / r - 1));
  const p = Math.min((1 + cs) * r, budget);
  const arcMeasure = 90 * (1 - cs);
  const arc = Math.sin(rad(arcMeasure / 2)) * r * Math.SQRT2;
  const alpha = (90 - arcMeasure) / 2;
  const p3p4 = r * Math.tan(rad(alpha / 2));
  const beta = 45 * cs;
  const c = p3p4 * Math.cos(rad(beta));
  const d = c * Math.tan(rad(beta));
  const b = (p - arc - c - d) / 3;
  const a = 2 * b;
  return { r, p, a, b, c, d, arc };
}

export function squirclePath(w: number, h: number, R: number[], s = SMOOTHING): string {
  const budget = Math.min(w, h) / 2;
  const tl = corner(R[0], s, budget);
  const tr = corner(R[1], s, budget);
  const br = corner(R[2], s, budget);
  const bl = corner(R[3], s, budget);

  function arcTo(k: CornerInfo, x: number, y: number) {
    return 'a ' + n(k.r) + ' ' + n(k.r) + ' 0 0 1 ' + n(x) + ' ' + n(y);
  }

  const out: Array<string | number> = ['M', n(w - tr.p), 0];
  if (tr.r && tr.a !== undefined && tr.b !== undefined && tr.c !== undefined && tr.d !== undefined && tr.arc !== undefined) {
    const a = tr.a, b = tr.b, c = tr.c, d = tr.d;
    const ab = a + b, abc = a + b + c, bc = b + c;
    out.push('c', n(a), 0, n(ab), 0, n(abc), n(d), arcTo(tr, tr.arc, tr.arc), 'c', n(d), n(c), n(d), n(bc), n(d), n(abc));
  }
  out.push('L', w, n(h - br.p));
  if (br.r && br.a !== undefined && br.b !== undefined && br.c !== undefined && br.d !== undefined && br.arc !== undefined) {
    const a = br.a, b = br.b, c = br.c, d = br.d;
    const ab = a + b, abc = a + b + c, bc = b + c;
    out.push('c', 0, n(a), 0, n(ab), n(-d), n(abc), arcTo(br, -br.arc, br.arc), 'c', n(-c), n(d), n(-bc), n(d), n(-abc), n(d));
  }
  out.push('L', n(bl.p), h);
  if (bl.r && bl.a !== undefined && bl.b !== undefined && bl.c !== undefined && bl.d !== undefined && bl.arc !== undefined) {
    const a = bl.a, b = bl.b, c = bl.c, d = bl.d;
    const ab = a + b, abc = a + b + c, bc = b + c;
    out.push('c', n(-a), 0, n(-ab), 0, n(-abc), n(-d), arcTo(bl, -bl.arc, -bl.arc), 'c', n(-d), n(-c), n(-d), n(-bc), n(-d), n(-abc));
  }
  out.push('L', 0, n(tl.p));
  if (tl.r && tl.a !== undefined && tl.b !== undefined && tl.c !== undefined && tl.d !== undefined && tl.arc !== undefined) {
    const a = tl.a, b = tl.b, c = tl.c, d = tl.d;
    const ab = a + b, abc = a + b + c, bc = b + c;
    out.push('c', 0, n(-a), 0, n(-ab), n(d), n(-abc), arcTo(tl, tl.arc, -tl.arc), 'c', n(c), n(-d), n(bc), n(-d), n(abc), n(-d));
  }
  out.push('Z');
  return out.join(' ');
}

export function parseRadii(val?: number | string): number[] {
  if (typeof val === 'number') return [val, val, val, val];
  const parts = String(val || '0').split(/\s+/).map(x => parseInt(x, 10) || 0);
  return parts.length === 4 ? parts : [parts[0], parts[0], parts[0], parts[0]];
}

/* ---------- shared observer and path cache ---------- */
const PATHS = new Map<string, string>();
function cachedPath(w: number, h: number, R: number[]): string {
  const k = w + 'x' + h + '|' + R.join(',');
  let v = PATHS.get(k);
  if (!v) {
    v = `path('${squirclePath(w, h, R, SMOOTHING)}')`;
    if (PATHS.size > 2000) PATHS.clear();
    PATHS.set(k, v);
  }
  return v;
}

const PAINTERS = new WeakMap<Element, (w: number, h: number) => void>();
const sharedRO: ResizeObserver | null =
  typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(entries => {
        for (const e of entries) {
          const fn = PAINTERS.get(e.target);
          if (!fn) continue;
          const bs = e.borderBoxSize && e.borderBoxSize[0];
          if (bs) fn(Math.round(bs.inlineSize), Math.round(bs.blockSize));
          else fn((e.target as HTMLElement).offsetWidth, (e.target as HTMLElement).offsetHeight);
        }
      })
    : null;

export interface SquircleProps extends Omit<React.AllHTMLAttributes<HTMLElement>, 'as'> {
  r: number | string;
  as?: React.ElementType;
  children?: React.ReactNode;
}

export const Squircle = React.forwardRef<HTMLElement, SquircleProps>(({
  r,
  as: Component = 'div',
  className = '',
  style,
  children,
  ...props
}, forwardedRef) => {
  const elRef = useRef<HTMLElement | null>(null);

  const setRef = (node: HTMLElement | null) => {
    elRef.current = node;
    if (typeof forwardedRef === 'function') {
      forwardedRef(node);
    } else if (forwardedRef) {
      (forwardedRef as React.MutableRefObject<HTMLElement | null>).current = node;
    }
  };

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const R = parseRadii(r);
    let last = '';
    const paint = (w: number, h: number) => {
      if (!w || !h) return;
      const key = w + 'x' + h;
      if (key === last) return;
      last = key;
      el.style.setProperty('--sq', cachedPath(w, h, R));
      el.style.setProperty('--sq-in', cachedPath(w - 2, h - 2, R.map(x => Math.max(x - 1, 0))));
      el.classList.add('on');
    };
    if (!sharedRO) {
      // без ResizeObserver: один замер
      paint(el.offsetWidth, el.offsetHeight);
      return;
    }
    // Размер приходит из общего ResizeObserver уже после раскладки, без принудительного замера
    PAINTERS.set(el, paint);
    try {
      sharedRO.observe(el, { box: 'border-box' });
    } catch (e) {
      sharedRO.observe(el);
    }
    return () => {
      PAINTERS.delete(el);
      sharedRO?.unobserve(el);
    };
  }, [r]);

  return (
    <Component
      ref={setRef}
      className={`sq ${className}`}
      data-sq
      data-r={String(r)}
      style={style}
      {...props}
    >
      {children}
    </Component>
  );
});

Squircle.displayName = 'Squircle';
