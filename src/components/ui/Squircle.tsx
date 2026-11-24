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

    const paint = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (!w || !h) return;
      const R = parseRadii(r);
      const Ri = R.map(x => Math.max(x - 1, 0));
      el.style.setProperty('--sq', `path('${squirclePath(w, h, R, SMOOTHING)}')`);
      el.style.setProperty('--sq-in', `path('${squirclePath(w - 2, h - 2, Ri, SMOOTHING)}')`);
      el.classList.add('on');
    };

    paint();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => paint());
      try {
        ro.observe(el, { box: 'border-box' });
      } catch (e) {
        ro.observe(el);
      }
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(paint);
    }

    const t1 = setTimeout(paint, 100);
    const t2 = setTimeout(paint, 500);

    return () => {
      if (ro) ro.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
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
