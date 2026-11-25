import { create } from 'zustand';
import { Settings, ThemeSetting, LangCode } from '../types/settings';
import { detectLang, setLanguage } from '../i18n';
import { getTelegramWebApp } from '../services/telegram';
import { topHeaderColor } from '../lib/topColor';

interface SettingsState extends Settings {
  effectiveTheme: 'dark' | 'light';
  setTheme: (theme: ThemeSetting) => void;
  setLang: (lang: LangCode) => void;
  setHaptic: (haptic: boolean) => void;
  setBase: (base: string) => void;
  setOpening: (opening: number) => void;
  setDemoOff: (demoOff: boolean) => void;
  themeApply: (redraw?: boolean) => void;
}

function calcEffectiveTheme(setting: ThemeSetting): 'dark' | 'light' {
  if (setting !== 'system') return setting;
  const tg = getTelegramWebApp();
  if (tg && (tg.colorScheme === 'light' || tg.colorScheme === 'dark')) {
    return tg.colorScheme;
  }
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return 'dark';
}

function loadInitialSettings(): Settings {
  let saved: Partial<Settings> = {};
  try {
    const raw = localStorage.getItem('set_v1');
    if (raw) saved = JSON.parse(raw);
  } catch (e) {}

  return {
    base: saved.base || 'EUR',
    haptic: saved.haptic !== false,
    demoOff: !!saved.demoOff,
    opening: typeof saved.opening === 'number' ? saved.opening : 6000,
    theme: saved.theme || 'system',
    lang: saved.lang || detectLang(),
  };
}

const initial = loadInitialSettings();
const initialEffTheme = calcEffectiveTheme(initial.theme || 'system');
setLanguage(initial.lang || 'ru');

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...initial,
  effectiveTheme: initialEffTheme,

  themeApply: () => {
    const eff = calcEffectiveTheme(get().theme || 'system');
    set({ effectiveTheme: eff });

    if (typeof document !== 'undefined') {
      const html = document.documentElement;
      html.setAttribute('data-theme', eff);

      const color = eff === 'light' ? '#f2f2f7' : '#0b0b0d';
      let meta = document.querySelector('meta[name="theme-color"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'theme-color');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', color);

      const tg = getTelegramWebApp();
      if (tg) {
        try {
          if (tg.setHeaderColor) tg.setHeaderColor(eff === 'light' ? '#ffffff' : topHeaderColor());
          if (tg.setBackgroundColor) tg.setBackgroundColor(color);
        } catch (e) {}
      }
    }
  },

  setTheme: (theme: ThemeSetting) => {
    set({ theme });
    get().themeApply();
    try {
      const current = get();
      localStorage.setItem('set_v1', JSON.stringify({
        base: current.base,
        haptic: current.haptic,
        demoOff: current.demoOff,
        opening: current.opening,
        theme,
        lang: current.lang,
      }));
    } catch (e) {}
  },

  setLang: (lang: LangCode) => {
    setLanguage(lang);
    set({ lang });
    try {
      const current = get();
      localStorage.setItem('set_v1', JSON.stringify({
        base: current.base,
        haptic: current.haptic,
        demoOff: current.demoOff,
        opening: current.opening,
        theme: current.theme,
        lang,
      }));
    } catch (e) {}
  },

  setHaptic: (haptic: boolean) => {
    set({ haptic });
    try {
      const current = get();
      localStorage.setItem('set_v1', JSON.stringify({
        base: current.base,
        haptic,
        demoOff: current.demoOff,
        opening: current.opening,
        theme: current.theme,
        lang: current.lang,
      }));
    } catch (e) {}
  },

  setBase: (base: string) => {
    set({ base });
    try {
      const current = get();
      localStorage.setItem('set_v1', JSON.stringify({
        base,
        haptic: current.haptic,
        demoOff: current.demoOff,
        opening: current.opening,
        theme: current.theme,
        lang: current.lang,
      }));
    } catch (e) {}
  },

  setOpening: (opening: number) => {
    set({ opening });
    try {
      const current = get();
      localStorage.setItem('set_v1', JSON.stringify({
        base: current.base,
        haptic: current.haptic,
        demoOff: current.demoOff,
        opening,
        theme: current.theme,
        lang: current.lang,
      }));
    } catch (e) {}
  },

  setDemoOff: (demoOff: boolean) => {
    set({ demoOff });
    try {
      const current = get();
      localStorage.setItem('set_v1', JSON.stringify({
        base: current.base,
        haptic: current.haptic,
        demoOff,
        opening: current.opening,
        theme: current.theme,
        lang: current.lang,
      }));
    } catch (e) {}
  },
}));
