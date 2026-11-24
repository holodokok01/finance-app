import React, { useEffect } from 'react';
import { useSettingsStore } from './store/useSettingsStore';
import { useAppStore } from './store/useAppStore';
import { useRatesStore } from './store/useRatesStore';
import { initTelegramSdk } from './services/telegram';
import { AppLayout } from './components/layout/AppLayout';
import { HomeScreen } from './components/home/HomeScreen';

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
    <AppLayout>
      <HomeScreen />
    </AppLayout>
  );
};
