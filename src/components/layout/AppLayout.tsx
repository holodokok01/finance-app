import React, { useState } from 'react';
import { TabBar, TabKey } from './TabBar';
import { Toast } from '../ui/Toast';
import { usePressFeedback } from '../../hooks/usePressFeedback';
import { useSettingsStore } from '../../store/useSettingsStore';
import { haptic } from '../../services/telegram';
import { L } from '../../i18n';

interface AppLayoutProps {
  children?: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
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

      <main className="page">
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
          <div className="scr-head">
            <h1 className="scr-title">{L('Статистика')}</h1>
          </div>
        </div>

        <div
          className={`screen ${currentTab === 'convert' ? 'on' : ''}`}
          id="scr-convert"
          hidden={currentTab !== 'convert'}
        >
          <div className="scr-head cv-head">
            <div>
              <h1 className="scr-title">{L('Конвертер')}</h1>
              <div className="cv-src" id="cv-src">
                {L('Примерный курс')}
              </div>
            </div>
          </div>
        </div>

        <div
          className={`screen ${currentTab === 'settings' ? 'on' : ''}`}
          id="scr-settings"
          hidden={currentTab !== 'settings'}
        >
          <div className="scr-head">
            <h1 className="scr-title">{L('Настройки')}</h1>
          </div>
        </div>
      </main>

      <TabBar currentTab={currentTab} onTabChange={handleTabChange} />
      <Toast />
    </div>
  );
};
