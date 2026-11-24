import React, { useEffect, useRef, useState } from 'react';
import { useToastStore } from '../../store/useToastStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { haptic } from '../../services/telegram';
import { L } from '../../i18n';

export type TabKey = 'home' | 'stats' | 'convert' | 'settings';

interface TabBarProps {
  currentTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

interface DragState {
  x0: number;
  moved: boolean;
  start: number;
  w: number;
  hoverTab: TabKey;
}

export const TabBar: React.FC<TabBarProps> = ({ currentTab, onTabChange }) => {
  const barRef = useRef<HTMLElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const mapFeRef = useRef<SVGFEImageElement>(null);

  const tabbarAway = useToastStore(s => s.tabbarAway);
  const sheetClosedAt = useToastStore(s => s.sheetClosedAt);
  const hapticEnabled = useSettingsStore(s => s.haptic);

  const [refract, setRefract] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>(currentTab);

  const dragRef = useRef<DragState | null>(null);
  const justDraggedRef = useRef<number>(0);

  // Sync activeTab with currentTab when changed externally
  useEffect(() => {
    setActiveTab(currentTab);
  }, [currentTab]);

  const place = (tab: TabKey, anim = false) => {
    const bar = barRef.current;
    const lens = lensRef.current;
    if (!bar || !lens) return;

    const btn = bar.querySelector<HTMLButtonElement>(`[data-tab="${tab}"]`);
    if (!btn) return;

    const br = bar.getBoundingClientRect();
    const r = btn.getBoundingClientRect();
    const lw = Math.round(r.width);

    lens.style.width = `${lw}px`;
    lens.style.transform = `translateX(${Math.round(r.left - br.left - 4 + (r.width - lw) / 2)}px)`;

    if (anim) {
      lens.classList.remove('squish');
      void lens.offsetWidth;
      lens.classList.add('squish');
    }
  };

  const buildMap = () => {
    const bar = barRef.current;
    const fe = mapFeRef.current;
    if (!bar || !fe) return;

    const w = Math.round(bar.offsetWidth);
    const h = Math.round(bar.offsetHeight);
    const R = h / 2;
    const bez = 18;
    if (!w || !h) return;

    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    const img = ctx.createImageData(w, h);
    const D = img.data;
    const hw = Math.ceil(w / 2);
    const hh = Math.ceil(h / 2);

    for (let y = 0; y < hh; y++) {
      for (let x = 0; x < hw; x++) {
        const cx = Math.max(R - x, 0);
        const cy = Math.max(R - y, 0);
        let dx = 0;
        let dy = 0;
        let dist = 0;

        if (x < R && y < R) {
          const l = Math.hypot(cx, cy);
          dist = R - l;
          if (l > 0) {
            dx = cx / l;
            dy = cy / l;
          }
        } else if (x < R) {
          dist = x;
          dx = 1;
        } else {
          dist = y;
          dy = 1;
        }

        const k = dist < 0 ? 0 : dist < bez ? Math.pow(1 - dist / bez, 2) : 0;
        const vx = dx * k;
        const vy = dy * k;

        const points = [
          [x, y, vx, vy],
          [w - 1 - x, y, -vx, vy],
          [x, h - 1 - y, vx, -vy],
          [w - 1 - x, h - 1 - y, -vx, -vy],
        ];

        points.forEach(p => {
          const i = (p[1] * w + p[0]) * 4;
          D[i] = 128 + Math.round(p[2] * 127);
          D[i + 1] = 128 + Math.round(p[3] * 127);
          D[i + 2] = 128;
          D[i + 3] = 255;
        });
      }
    }

    ctx.putImageData(img, 0, 0);
    fe.setAttribute('width', String(w));
    fe.setAttribute('height', String(h));
    fe.setAttribute('href', c.toDataURL());
  };

  useEffect(() => {
    const isChromium =
      typeof navigator !== 'undefined' &&
      /Chrome\//.test(navigator.userAgent) &&
      !/iPhone|iPad|Mac OS X.*Safari\/(?!.*Chrome)/.test(navigator.userAgent) &&
      !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent);

    if (isChromium) {
      try {
        buildMap();
        setRefract(true);
      } catch (e) {}
    }

    // Place initial lens
    requestAnimationFrame(() => {
      place(currentTab, false);
    });

    const handleResize = () => {
      place(activeTab, false);
      if (isChromium) {
        buildMap();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    place(currentTab, true);
  }, [currentTab]);

  const nearest = (x: number): TabKey => {
    const bar = barRef.current;
    if (!bar) return currentTab;

    const items = Array.from(bar.querySelectorAll<HTMLButtonElement>('.tb-item'));
    let bestTab: TabKey = currentTab;
    let bd = 1e9;

    items.forEach(b => {
      const r = b.getBoundingClientRect();
      const d = Math.abs(r.left + r.width / 2 - x);
      if (d < bd) {
        bd = d;
        bestTab = b.getAttribute('data-tab') as TabKey;
      }
    });

    return bestTab;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (performance.now() - sheetClosedAt < 600) return;
    const bar = barRef.current;
    const lens = lensRef.current;
    if (!bar || !lens) return;

    const on = bar.querySelector<HTMLButtonElement>('.tb-item.on');
    if (!on) return;

    const r = on.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right) {
      dragRef.current = null;
      return;
    }

    const lw = lens.offsetWidth;
    dragRef.current = {
      x0: e.clientX,
      moved: false,
      start: r.left - bar.getBoundingClientRect().left - 4 + (r.width - lw) / 2,
      w: lw,
      hoverTab: currentTab,
    };

    try {
      bar.setPointerCapture(e.pointerId);
    } catch (x) {}
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    const bar = barRef.current;
    const lens = lensRef.current;
    if (!drag || !bar || !lens) return;

    const dx = e.clientX - drag.x0;
    if (!drag.moved) {
      if (Math.abs(dx) < 6) return;
      drag.moved = true;
      lens.classList.remove('squish');
      lens.classList.add('drag');
      haptic('light', hapticEnabled);
    }

    const pad = Math.ceil(drag.w * 0.025) + 2;
    const max = bar.clientWidth - 8 - drag.w - pad;
    let x = drag.start + dx;
    const minX = pad;

    if (x < minX) x = minX - Math.min(3, (minX - x) / 4);
    if (x > max) x = max + Math.min(3, (x - max) / 4);

    lens.style.transform = `translateX(${Math.round(x)}px)`;

    const h = nearest(e.clientX);
    if (h !== drag.hoverTab) {
      drag.hoverTab = h;
      setActiveTab(h);
      haptic('select', hapticEnabled);
    }
  };

  const endDrag = () => {
    const drag = dragRef.current;
    const lens = lensRef.current;
    if (!drag || !lens) return;

    dragRef.current = null;
    if (!drag.moved) return;

    justDraggedRef.current = performance.now();
    lens.classList.remove('drag');

    const tab = drag.hoverTab;
    if (tab === currentTab) {
      place(tab, true);
    } else {
      onTabChange(tab);
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    if (
      performance.now() - sheetClosedAt < 600 ||
      performance.now() - justDraggedRef.current < 350
    ) {
      return;
    }

    const target = e.target as HTMLElement;
    const b = target.closest<HTMLButtonElement>('[data-tab]');
    if (!b) return;

    const tab = b.getAttribute('data-tab') as TabKey;
    if (tab) {
      onTabChange(tab);
    }
  };

  return (
    <>
      <nav
        ref={barRef}
        className={`tabbar ${refract ? 'refract' : ''} ${tabbarAway ? 'away' : ''}`}
        id="tabbar"
        aria-label={L('Навигация')}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="tb-glass" />
        <div className="tb-rim" />
        <div ref={lensRef} className="tb-lens" id="tb-lens">
          <div className="tb-rim lens-rim" />
        </div>

        <button
          className={`tb-item ${activeTab === 'home' ? 'on' : ''}`}
          type="button"
          data-tab="home"
        >
          <svg viewBox="0 0 24 24">
            <path
              fill="currentColor"
              fillRule="evenodd"
              d="M2.52 7.823C2 8.77 2 9.915 2 12.203v1.522c0 3.9 0 5.851 1.172 7.063S6.229 22 10 22h4c3.771 0 5.657 0 6.828-1.212S22 17.626 22 13.725v-1.521c0-2.289 0-3.433-.52-4.381c-.518-.949-1.467-1.537-3.364-2.715l-2-1.241C14.111 2.622 13.108 2 12 2s-2.11.622-4.116 1.867l-2 1.241C3.987 6.286 3.038 6.874 2.519 7.823M11.25 18a.75.75 0 0 0 1.5 0v-3a.75.75 0 0 0-1.5 0z"
              clipRule="evenodd"
            />
          </svg>
          <span>{L('Главная')}</span>
        </button>

        <button
          className={`tb-item ${activeTab === 'stats' ? 'on' : ''}`}
          type="button"
          data-tab="stats"
        >
          <svg viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M6.222 4.601a9.5 9.5 0 0 1 1.395-.771c1.372-.615 2.058-.922 2.97-.33c.913.59.913 1.56.913 3.5v1.5c0 1.886 0 2.828.586 3.414s1.528.586 3.414.586H17c1.94 0 2.91 0 3.5.912c.592.913.285 1.599-.33 2.97a9.5 9.5 0 0 1-10.523 5.435A9.5 9.5 0 0 1 6.222 4.601"
            />
            <path
              fill="currentColor"
              d="M21.446 7.069a8.03 8.03 0 0 0-4.515-4.515C15.389 1.947 14 3.344 14 5v4a1 1 0 0 0 1 1h4c1.657 0 3.053-1.39 2.446-2.931"
            />
          </svg>
          <span>{L('Статистика')}</span>
        </button>

        <button
          className={`tb-item ${activeTab === 'convert' ? 'on' : ''}`}
          type="button"
          data-tab="convert"
        >
          <svg viewBox="0 0 24 24">
            <path
              fill="currentColor"
              fillRule="evenodd"
              d="M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12S6.477 2 12 2s10 4.477 10 10M7 14.75h8l-1.93 1.685a.75.75 0 0 0 .986 1.13l3.437-3A.75.75 0 0 0 17 13.25H7a.75.75 0 0 0 0 1.5m4.003-8.243a.75.75 0 0 1-.072 1.058L9 9.25h8a.75.75 0 0 1 0 1.5H7a.75.75 0 0 1-.493-1.315l3.437-3a.75.75 0 0 1 1.059.072"
              clipRule="evenodd"
            />
          </svg>
          <span>{L('Конвертер')}</span>
        </button>

        <button
          className={`tb-item ${activeTab === 'settings' ? 'on' : ''}`}
          type="button"
          data-tab="settings"
        >
          <svg viewBox="0 0 24 24">
            <path
              fill="currentColor"
              fillRule="evenodd"
              d="M14.279 2.152C13.909 2 13.439 2 12.5 2s-1.408 0-1.779.152a2 2 0 0 0-1.09 1.083c-.094.223-.13.484-.145.863a1.62 1.62 0 0 1-.796 1.353a1.64 1.64 0 0 1-1.579.008c-.338-.178-.583-.276-.825-.308a2.03 2.03 0 0 0-1.49.396c-.318.242-.553.646-1.022 1.453c-.47.807-.704 1.21-.757 1.605c-.07.526.074 1.058.4 1.479c.148.192.357.353.68.555c.477.297.783.803.783 1.361s-.306 1.064-.782 1.36c-.324.203-.533.364-.682.556a2 2 0 0 0-.399 1.479c.053.394.287.798.757 1.605s.704 1.21 1.022 1.453c.424.323.96.465 1.49.396c.242-.032.487-.13.825-.308a1.64 1.64 0 0 1 1.58.008c.486.28.774.795.795 1.353c.015.38.051.64.145.863c.204.49.596.88 1.09 1.083c.37.152.84.152 1.779.152s1.409 0 1.779-.152a2 2 0 0 0 1.09-1.083c.094-.223.13-.483.145-.863c.02-.558.309-1.074.796-1.353a1.64 1.64 0 0 1 1.579-.008c.338.178.583.276.825.308c.53.07 1.066-.073 1.49-.396c.318-.242.553-.646 1.022-1.453c.47-.807.704-1.21.757-1.605a2 2 0 0 0-.4-1.479c-.148-.192-.357-.353-.68-.555c-.477-.297-.783-.803-.783-1.361s.306-1.064.782-1.36c.324-.203.533-.364.682-.556a2 2 0 0 0 .399-1.479c-.053-.394-.287-.798-.757-1.605s-.704-1.21-1.022-1.453a2.03 2.03 0 0 0-1.49-.396c-.242.032-.487.13-.825.308a1.64 1.64 0 0 1-1.58-.008a1.62 1.62 0 0 1-.795-1.353c-.015-.38-.051-.64-.145-.863a2 2 0 0 0-1.09-1.083M12.5 15c1.67 0 3.023-1.343 3.023-3S14.169 9 12.5 9s-3.023 1.343-3.023 3s1.354 3 3.023 3"
              clipRule="evenodd"
            />
          </svg>
          <span>{L('Настройки')}</span>
        </button>
      </nav>

      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <filter
            id="tb-refract"
            x="0"
            y="0"
            width="100%"
            height="100%"
            colorInterpolationFilters="sRGB"
          >
            <feImage ref={mapFeRef} id="tb-map" x="0" y="0" result="map" preserveAspectRatio="none" />
            <feDisplacementMap
              in="SourceGraphic"
              in2="map"
              scale="28"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>
    </>
  );
};
