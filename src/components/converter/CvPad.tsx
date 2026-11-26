import React, { useEffect, useRef } from 'react';
import { Squircle } from '../ui/Squircle';
import { L } from '../../i18n';

/* Цифровая клавиатура конвертера: выезжает снизу, свайп вниз по ней закрывает (перенос из legacy). */

const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', ',', '0', 'del'];
const DEL_PATH = "M6.871 19.499c.93.501 2.044.501 4.271.501h2.637c3.875 0 5.813 0 7.017-1.172S22 15.771 22 12s0-5.657-1.204-6.828S17.654 4 13.78 4h-2.637c-2.227 0-3.341 0-4.27.501c-.93.502-1.52 1.42-2.701 3.259L3.49 8.82C2.497 10.366 2 11.14 2 12s.497 1.634 1.49 3.18l.68 1.06c1.181 1.838 1.771 2.757 2.701 3.259m4.16-10.53A.75.75 0 0 0 9.97 10.03L11.94 12l-1.97 1.97a.75.75 0 1 0 1.06 1.06L13 13.06l1.97 1.97a.75.75 0 0 0 1.06-1.06L14.06 12l1.97-1.97a.75.75 0 0 0-1.06-1.06L13 10.94z";

interface CvPadProps {
  open: boolean;
  padRef: React.RefObject<HTMLDivElement>;
  onKey: (k: string) => void;
  onTick: () => void;
  onClose: () => void;
  /** поверх шитов (у них z-index 40) */
  zIndex?: number;
}

export const CvPad: React.FC<CvPadProps> = ({ open, padRef, onKey, onTick, onClose, zIndex }) => {
  const t1 = useRef(0);
  const t2 = useRef(0);
  const stopRepeat = () => {
    clearTimeout(t1.current);
    clearInterval(t2.current);
  };
  useEffect(() => stopRepeat, []);
  const tick = useRef(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const pad = padRef.current;
    if (!pad) return;
    let y0 = 0;
    let dy = 0;
    let on = false;
    let t0 = 0;
    const start = (e: TouchEvent) => {
      on = !!(e.target as HTMLElement).closest('.d-grab') || !(e.target as HTMLElement).closest('button');
      y0 = e.touches[0].clientY;
      dy = 0;
      t0 = performance.now();
    };
    const move = (e: TouchEvent) => {
      if (!on) return;
      dy = Math.max(0, e.touches[0].clientY - y0);
      if (e.cancelable) e.preventDefault();
      pad.classList.add('drag');
      pad.style.transform = 'translate(-50%, ' + Math.round(dy) + 'px)';
    };
    const end = () => {
      if (!on) return;
      on = false;
      pad.classList.remove('drag');
      const fast = dy / Math.max(1, performance.now() - t0) > 0.5;
      if (dy > 80 || (fast && dy > 24)) closeRef.current();
      pad.style.transform = '';
    };
    pad.addEventListener('touchstart', start, { passive: true });
    pad.addEventListener('touchmove', move, { passive: false });
    pad.addEventListener('touchend', end);
    pad.addEventListener('touchcancel', end);
    return () => {
      pad.removeEventListener('touchstart', start);
      pad.removeEventListener('touchmove', move);
      pad.removeEventListener('touchend', end);
      pad.removeEventListener('touchcancel', end);
    };
  }, [padRef]);

  return (
    <Squircle r="32 32 0 0" className={'cv-pad' + (open ? ' show' : '')} id="cv-pad" ref={padRef as any} aria-hidden={!open} style={zIndex ? { zIndex } : undefined}>
      <div className="d-grab" />
      <div
        className="cv-keys"
        id="cv-keys"
        onTouchEnd={e => {
          if ((e.target as HTMLElement).closest('[data-k]')) {
            tick.current = true;
            onTick();
            setTimeout(() => (tick.current = false), 400);
          }
        }}
      >
        {KEYS.map(k =>
          k === 'del' ? (
            <button
              key={k}
              type="button"
              data-k="del"
              aria-label={L('Стереть')}
              onPointerDown={e => {
                /* как на добавлении операции: стирает сразу, при удержании стирает по символу каждые 90 мс */
                onKey('del' + (e.pointerType === 'touch' ? '!' : ''));
                stopRepeat();
                t1.current = window.setTimeout(() => {
                  t2.current = window.setInterval(() => onKey('del~'), 90);
                }, 400);
              }}
              onPointerUp={stopRepeat}
              onPointerCancel={stopRepeat}
              onPointerLeave={stopRepeat}
              onContextMenu={e => e.preventDefault()}
            >
              <svg viewBox="0 0 24 24">
                <path fill="currentColor" fillRule="evenodd" d={DEL_PATH} clipRule="evenodd" />
              </svg>
            </button>
          ) : (
            <button key={k} type="button" data-k={k} onClick={() => onKey(k + (tick.current ? '!' : ''))}>
              {k}
            </button>
          )
        )}
      </div>
    </Squircle>
  );
};
