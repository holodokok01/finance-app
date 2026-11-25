import React, { useEffect, useState } from 'react';
import { getTelegramWebApp } from '../../services/telegram';
import { useSettingsStore } from '../../store/useSettingsStore';

// ВРЕМЕННО: переключатель вариантов фона секций на всю ширину. Удалить после выбора.
type Variant = '1' | '3';

const COLORS: Record<Variant, { bg: string; header: string }> = {
  '1': { bg: '#000000', header: '#0f1012' },
  '3': { bg: '#0b0b0d', header: '#151619' },
};

function read(): Variant {
  try {
    return localStorage.getItem('dbg_sec') === '3' ? '3' : '1';
  } catch (e) {
    return '1';
  }
}

export const SectionVariantSwitch: React.FC = () => {
  const [v, setV] = useState<Variant>(read);
  const themeApply = useSettingsStore(s => s.themeApply);

  useEffect(() => {
    document.documentElement.setAttribute('data-sec', v);
    try {
      localStorage.setItem('dbg_sec', v);
    } catch (e) {}
    themeApply();
    const tg = getTelegramWebApp();
    if (tg && document.documentElement.getAttribute('data-theme') === 'dark') {
      try {
        if (tg.setBackgroundColor) tg.setBackgroundColor(COLORS[v].bg);
        if (tg.setHeaderColor) tg.setHeaderColor(COLORS[v].header);
      } catch (e) {}
    }
  }, [v]);

  return (
    <button
      type="button"
      onClick={() => setV(v === '1' ? '3' : '1')}
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
      {'Фон: вариант ' + v}
    </button>
  );
};
