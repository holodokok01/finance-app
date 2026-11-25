import React, { useLayoutEffect, useRef } from 'react';
import { countUp, firstShow } from '../../lib/countUp';

/* Число с досчётом. Содержимое рисует paint, React его не трогает.
   fromZeroId: при первом показе в этом запуске приложения счёт идёт от нуля. */

interface CountUpProps extends React.HTMLAttributes<HTMLElement> {
  value: number;
  paint: (el: HTMLElement, v: number) => void;
  /** меняется, когда меняется формат (валюта, язык): тогда перерисовать без досчёта */
  formatKey?: string;
  fromZeroId?: string;
  as?: 'span' | 'div' | 'h1';
}

export const CountUp: React.FC<CountUpProps> = ({ value, paint, formatKey = '', fromZeroId, as = 'span', ...rest }) => {
  const ref = useRef<HTMLElement>(null);
  const prev = useRef<{ v: number; f: string } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const p = prev.current;
    prev.current = { v: value, f: formatKey };
    if (!p) {
      if (fromZeroId && firstShow(fromZeroId) && value) countUp(el, 0, value, paint);
      else countUp(el, value, value, paint);
      return;
    }
    if (p.f !== formatKey) countUp(el, value, value, paint);
    else countUp(el, p.v, value, paint);
  }, [value, formatKey]);

  const Tag = as as React.ElementType;
  return <Tag ref={ref} {...rest} />;
};
