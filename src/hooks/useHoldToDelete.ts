import { useRef, useCallback } from 'react';
import { haptic } from '../services/telegram';
import { showToast } from '../components/ui/Toast';
import { L } from '../i18n';

interface UseHoldToDeleteOptions {
  duration?: number;
  onDelete: () => void;
  toastText?: string;
}

export function useHoldToDelete({
  duration = 900,
  onDelete,
  toastText = 'Зажми, чтобы удалить',
}: UseHoldToDeleteOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const isTriggeredRef = useRef(false);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (btnRef.current) {
      btnRef.current.classList.remove('holding');
      btnRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const btn = e.currentTarget;
      btnRef.current = btn;
      isTriggeredRef.current = false;
      btn.classList.add('holding');
      haptic('light');

      timerRef.current = setTimeout(() => {
        isTriggeredRef.current = true;
        stop();
        haptic('success');
        onDelete();
      }, duration);
    },
    [duration, onDelete, stop]
  );

  const onPointerUp = useCallback(() => {
    if (btnRef.current && !isTriggeredRef.current) {
      stop();
      showToast(L(toastText));
    } else {
      stop();
    }
  }, [stop, toastText]);

  const onPointerLeave = useCallback(() => {
    stop();
  }, [stop]);

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  return {
    onPointerDown,
    onPointerUp,
    onPointerLeave,
    onPointerCancel: stop,
    onContextMenu,
  };
}
