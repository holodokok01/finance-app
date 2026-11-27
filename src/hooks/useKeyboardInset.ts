import { useEffect } from 'react';
import { keyboardAcquire, keyboardRelease } from '../lib/keyboard';

/**
 * Модал подписывается на общий менеджер клавиатуры (src/lib/keyboard.ts).
 * Высоту слоя менеджер пишет сам в --app-h, без перерисовки React, поэтому
 * здесь всегда нули: inline-высота слою не нужна.
 */
export function useKeyboardInset(active: boolean): { height: number; kb: number; oy: number } {
  useEffect(() => {
    if (!active) return;
    keyboardAcquire();
    return () => keyboardRelease();
  }, [active]);

  return { height: 0, kb: 0, oy: 0 };
}
