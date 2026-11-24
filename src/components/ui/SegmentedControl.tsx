import React, { useEffect, useRef, useState } from 'react';
import { haptic } from '../../services/telegram';

export interface SegmentOption<T extends string = string> {
  value: T;
  label?: React.ReactNode;
  icon?: React.ReactNode;
  ariaLabel?: string;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (val: T) => void;
  className?: string;
  id?: string;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  className = '',
  id,
}: SegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pillStyle, setPillStyle] = useState<{ width: number; transform: string; isInitial: boolean }>({
    width: 0,
    transform: 'translateX(0px)',
    isInitial: true,
  });
  const [isSquishing, setIsSquishing] = useState(false);
  const prevValRef = useRef<T>(value);

  const updatePill = (animated = true) => {
    const container = containerRef.current;
    if (!container) return;
    const activeButton = container.querySelector('button.on') as HTMLElement | null;
    if (!activeButton || !activeButton.offsetWidth) return;

    const x = activeButton.offsetLeft;
    const w = activeButton.offsetWidth;

    setPillStyle(prev => {
      const isFirst = prev.width === 0;
      return {
        width: w,
        transform: `translateX(${x}px)`,
        isInitial: !animated || isFirst,
      };
    });

    if (animated && prevValRef.current !== value) {
      setIsSquishing(true);
      setTimeout(() => setIsSquishing(false), 450);
    }
    prevValRef.current = value;
  };

  useEffect(() => {
    updatePill(true);
  }, [value]);

  useEffect(() => {
    updatePill(false);
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    const ro = new ResizeObserver(() => updatePill(false));
    ro.observe(container);
    return () => ro.disconnect();
  }, [options]);

  return (
    <div ref={containerRef} className={`seg ${className}`} id={id}>
      <span
        className={`seg-pill ${pillStyle.isInitial ? 'still' : ''} ${isSquishing ? 'squish' : ''}`}
        style={{
          width: pillStyle.width ? `${pillStyle.width}px` : undefined,
          transform: pillStyle.transform,
        }}
        aria-hidden="true"
      />
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            className={active ? 'on' : ''}
            aria-label={opt.ariaLabel}
            onClick={() => {
              if (opt.value !== value) {
                haptic('select');
                onChange(opt.value);
              }
            }}
          >
            {opt.icon || opt.label}
          </button>
        );
      })}
    </div>
  );
}
