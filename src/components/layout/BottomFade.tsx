import React, { useState } from 'react';
import { haptic } from '../../services/telegram';
import { useSettingsStore } from '../../store/useSettingsStore';

/* Затухание контента внизу экрана под таббаром. Переключатель вариантов временный: после выбора уберём. */

const KEY = 'fade_v';
const VARIANTS = ['0', '1', '2', '3'];

function load(): string {
  try {
    const v = localStorage.getItem(KEY);
    return v && VARIANTS.includes(v) ? v : '2';
  } catch (e) {
    return '2';
  }
}

export const BottomFade: React.FC = () => {
  const [v, setV] = useState(load);
  const hapticOn = useSettingsStore(s => s.haptic);
  const pick = (n: string) => {
    setV(n);
    haptic('select', hapticOn);
    try {
      localStorage.setItem(KEY, n);
    } catch (e) {}
  };
  return (
    <>
      <div className="bot-fade" data-v={v} aria-hidden="true" />
      <div className="fade-sw">
        {VARIANTS.map(n => (
          <button key={n} type="button" className={n === v ? 'on' : ''} onClick={() => pick(n)}>
            {n === '0' ? 'Без' : n}
          </button>
        ))}
      </div>
    </>
  );
};
