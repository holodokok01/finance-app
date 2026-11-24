import React, { useEffect } from 'react';
import { useSettingsStore } from './store/useSettingsStore';
import { useAppStore } from './store/useAppStore';
import { useRatesStore } from './store/useRatesStore';
import { initTelegramSdk } from './services/telegram';

export const App: React.FC = () => {
  const themeApply = useSettingsStore(s => s.themeApply);
  const loadStorage = useAppStore(s => s.loadStorage);
  const cloudLoad = useAppStore(s => s.cloudLoad);
  const loadRates = useRatesStore(s => s.loadRates);

  useEffect(() => {
    themeApply();
    loadStorage();
    loadRates();

    initTelegramSdk((tg) => {
      themeApply();
      cloudLoad();
      tg.onEvent('themeChanged', () => {
        themeApply();
      });
    });
  }, []);

  return (
    <div className="app" id="app">
      <div className="land" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99M17 19H7V5h10z"
          />
        </svg>
        <span>Поверните телефон вертикально</span>
      </div>
      <main className="page">
        {/* Placeholder for Step 1 base check: verifies mounting, theme, squircle and styles */}
        <div style={{ padding: '24px 16px', color: 'var(--text)' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>Финансы</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 15 }}>Базовая настройка React 18 + TypeScript завершена.</p>
        </div>
      </main>
    </div>
  );
};
