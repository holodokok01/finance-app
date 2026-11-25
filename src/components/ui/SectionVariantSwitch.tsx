import React, { useEffect, useState } from 'react';
import { getTelegramWebApp } from '../../services/telegram';
import { useSettingsStore } from '../../store/useSettingsStore';

// ВРЕМЕННО: переключатель вида верхнего блока Главной. Удалить после выбора.
type Variant = 'grad' | 'round';

const HEADER: Record<Variant, string> = {
  grad: '#082b45',
  round: '#151619',
};
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
    const tg = getTelegramWebApp();
    if (tg && document.documentElement.getAttribute('data-theme') === 'dark') {
      try {
        if (tg.setBackgroundColor) tg.setBackgroundColor('#0b0b0d');
        if (tg.setHeaderColor) tg.setHeaderColor(HEADER[v]);
      } catch (e) {}
    }
  }, [v]);

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
