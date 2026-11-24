import React, { useEffect } from 'react';
import { useSettingsStore } from './store/useSettingsStore';
import { useAppStore } from './store/useAppStore';
import { useRatesStore } from './store/useRatesStore';
import { initTelegramSdk } from './services/telegram';
import { AppLayout } from './components/layout/AppLayout';
import { Squircle } from './components/ui/Squircle';
import { formatBalanceParts } from './lib/balance';
import { L } from './i18n';

export const App: React.FC = () => {
  const themeApply = useSettingsStore(s => s.themeApply);
  const loadStorage = useAppStore(s => s.loadStorage);
  const cloudLoad = useAppStore(s => s.cloudLoad);
  const loadRates = useRatesStore(s => s.loadRates);
  const balance = useAppStore(s => s.balance());
  const base = useSettingsStore(s => s.base);

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

  const balParts = formatBalanceParts(balance, base);

  return (
    <AppLayout>
      <Squircle as="section" r={32} className="panel" aria-label={L('Баланс')}>
        <div className="balance">
          <div className="balance-label">{L('Общий баланс')}</div>
          <h1 className="balance-amount" id="balance">
            {balParts.sign}
            {balParts.pre}
            {balParts.whole}
            <span className="cents">
              {balParts.cents}
              {balParts.post}
            </span>
          </h1>
        </div>
      </Squircle>
    </AppLayout>
  );
};
