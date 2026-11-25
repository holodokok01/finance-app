import React, { useEffect, useState } from 'react';
import { applyTopHeaderColor } from '../../lib/topColor';
import { useSettingsStore } from '../../store/useSettingsStore';

// ВРЕМЕННО: переключатель вида верхнего блока Главной. Удалить после выбора.
type Variant = 'grad' | 'round';

const LABEL: Record<Variant, string> = {
  grad: 'Верх: градиент',
  round: 'Верх: скруглённый',
};

function read(): Variant {
  try {
    return localStorage.getItem('dbg_top') === 'round' ? 'round' : 'grad';
  } catch (e) {
    return 'grad';
  }
}

export const SectionVariantSwitch: React.FC = () => {
  const [v, setV] = useState<Variant>(read);
  const themeApply = useSettingsStore(s => s.themeApply);

  useEffect(() => {
    document.documentElement.setAttribute('data-top', v);
    try {
      localStorage.setItem('dbg_top', v);
    } catch (e) {}
    themeApply();
    applyTopHeaderColor();
  }, [v]);

  useEffect(() => {
    const app = document.getElementById('app');
    if (!app) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        applyTopHeaderColor();
      });
    };
    app.addEventListener('scroll', onScroll, { passive: true });
    return () => app.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <button
      type="button"
      onClick={() => setV(v === 'grad' ? 'round' : 'grad')}
      style={{
        position: 'fixed',
        right: 16,
        bottom: 'calc(96px + env(safe-area-inset-bottom))',
        height: 32,
        padding: '0 12px',
        borderRadius: 16,
        zIndex: 16,
        fontSize: 13,
        lineHeight: '16px',
        fontWeight: 600,
        color: '#ffffff',
        background: 'rgba(120,120,128,.56)',
      }}
    >
      {LABEL[v]}
    </button>
  );
};
