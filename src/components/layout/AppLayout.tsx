import React, { useState } from 'react';
import { TabBar, TabKey } from './TabBar';
import { Toast } from '../ui/Toast';
import { usePressFeedback } from '../../hooks/usePressFeedback';
import { useSettingsStore } from '../../store/useSettingsStore';
import { haptic } from '../../services/telegram';
import { L } from '../../i18n';
import { StatsScreen } from '../stats/StatsScreen';
import { ConverterScreen } from '../converter/ConverterScreen';
import { SettingsScreen } from '../settings/SettingsScreen';
import { Transaction } from '../../types/fin';
import { refreshTopColor } from '../../lib/topColor';
import { BottomFade } from './BottomFade';
import { Tour } from '../tour/Tour';

interface AppLayoutProps {
  children?: React.ReactNode;
  onSelectTransaction: (tx: Transaction) => void;
  onOpenPayments: () => void;
  onOpenCategories: () => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children, onSelectTransaction, onOpenPayments, onOpenCategories }) => {
  usePressFeedback();

  const [currentTab, setCurrentTab] = useState<TabKey>('home');
  const hapticEnabled = useSettingsStore(s => s.haptic);

  const handleTabChange = (tab: TabKey) => {
    if (tab === currentTab) {
      document.getElementById('app')?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setCurrentTab(tab);
    haptic('select', hapticEnabled);
    const app = document.getElementById('app');
    if (app) app.scrollTop = 0;
    requestAnimationFrame(refreshTopColor);
  };

  /* тур переключает вкладки сам, без вибрации */
  const tourGoTab = (tab: TabKey) => {
    /* та же вкладка: ничего не сбрасываем, иначе страница дёргается */
    if (tab === currentTab) return;
    setCurrentTab(tab);
    const app = document.getElementById('app');
    if (app) app.scrollTop = 0;
    requestAnimationFrame(refreshTopColor);
  };

  return (
    <div className="app" id="app">
      <div className="land" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99M17 19H7V5h10z"
          />
        </svg>
        <span>{L('Поверните телефон вертикально')}</span>
      </div>

      <main className={'page' + (currentTab === 'home' ? ' is-home' : '')}>
        <div
          className={`screen ${currentTab === 'home' ? 'on' : ''}`}
          id="scr-home"
          hidden={currentTab !== 'home'}
        >
          {children}
        </div>

        <div
          className={`screen ${currentTab === 'stats' ? 'on' : ''}`}
          id="scr-stats"
          hidden={currentTab !== 'stats'}
        >
          <StatsScreen active={currentTab === 'stats'} onSelectTransaction={onSelectTransaction} />
        </div>

        <div
          className={`screen ${currentTab === 'convert' ? 'on' : ''}`}
          id="scr-convert"
          hidden={currentTab !== 'convert'}
        >
          <ConverterScreen active={currentTab === 'convert'} />
        </div>

        <div
          className={`screen ${currentTab === 'settings' ? 'on' : ''}`}
          id="scr-settings"
          hidden={currentTab !== 'settings'}
        >
          <SettingsScreen onOpenPayments={onOpenPayments} onOpenCategories={onOpenCategories} />
        </div>
      </main>

      <BottomFade />
      <TabBar currentTab={currentTab} onTabChange={handleTabChange} />
      <Toast />
      <Tour goTab={tourGoTab} />
    </div>
  );
};
