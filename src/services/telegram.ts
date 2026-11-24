export interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  disableVerticalSwipes?: () => void;
  lockOrientation?: () => void;
  colorScheme?: 'light' | 'dark';
  themeParams?: Record<string, string>;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  onEvent: (eventType: string, eventHandler: () => void) => void;
  offEvent: (eventType: string, eventHandler: () => void) => void;
  BackButton?: {
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  CloudStorage?: {
    setItem: (key: string, value: string, callback?: (error: Error | null, success: boolean) => void) => void;
    getItem: (key: string, callback: (error: Error | null, value: string) => void) => void;
    getItems: (keys: string[], callback: (error: Error | null, values: Record<string, string>) => void) => void;
    setItems: (items: Record<string, string>, callback?: (error: Error | null, success: boolean) => void) => void;
  };
}

let tgInstance: TelegramWebApp | null = null;
let hapticLabel: HTMLElement | null = null;

export function getTelegramWebApp(): TelegramWebApp | null {
  if (tgInstance) return tgInstance;
  if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
    tgInstance = (window as any).Telegram.WebApp;
  }
  return tgInstance;
}

export function isInsideTelegram(): boolean {
  if (typeof window === 'undefined') return false;
  return /tgWebApp/.test(window.location.hash + window.location.search) || !!(window as any).TelegramWebviewProxy;
}

export function initTelegramSdk(onReady?: (tg: TelegramWebApp) => void): void {
  if (typeof window === 'undefined') return;

  if (isInsideTelegram()) {
    const existing = (window as any).Telegram?.WebApp;
    if (existing) {
      tgInstance = existing;
      try {
        existing.ready();
        existing.expand();
        if (existing.disableVerticalSwipes) existing.disableVerticalSwipes();
        if (existing.lockOrientation) existing.lockOrientation();
      } catch (e) {}
      if (onReady) onReady(existing);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-web-app.js';
    script.onload = () => {
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        tgInstance = tg;
        try {
          tg.ready();
          tg.expand();
          if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
          if (tg.lockOrientation) tg.lockOrientation();
        } catch (e) {}
        if (onReady) onReady(tg);
      }
    };
    document.head.appendChild(script);
  }

  try {
    if (screen.orientation && (screen.orientation as any).lock) {
      (screen.orientation as any).lock('portrait').catch(() => {});
    }
  } catch (e) {}
}

export function haptic(kind: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' | 'error' | 'success' | 'warning' | 'select' = 'light', enabled = true): void {
  if (!enabled) return;
  const tg = getTelegramWebApp();

  if (tg && tg.HapticFeedback) {
    try {
      if (kind === 'success' || kind === 'error' || kind === 'warning') {
        tg.HapticFeedback.notificationOccurred(kind);
      } else if (kind === 'select') {
        tg.HapticFeedback.selectionChanged();
      } else {
        tg.HapticFeedback.impactOccurred(kind);
      }
    } catch (e) {}
    return;
  }

  // Fallback: iOS 18 switch checkbox or navigator.vibrate
  try {
    if (typeof document !== 'undefined') {
      if (!hapticLabel) {
        hapticLabel = document.createElement('label');
        hapticLabel.setAttribute('aria-hidden', 'true');
        hapticLabel.style.cssText = 'position:fixed;left:-99px;top:-99px;width:1px;height:1px;opacity:0;pointer-events:none';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.setAttribute('switch', '');
        cb.tabIndex = -1;
        hapticLabel.appendChild(cb);
        document.body.appendChild(hapticLabel);
      }
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(kind === 'medium' || kind === 'success' ? 20 : 10);
      } else {
        hapticLabel.click();
      }
    }
  } catch (e) {}
}
