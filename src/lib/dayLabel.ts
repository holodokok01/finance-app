import { L, LOC } from '../i18n';
import { useSettingsStore } from '../store/useSettingsStore';

/** «Сегодня», «Вчера» или «12 ноября» по смещению в днях назад. */
export function dayLabel(offset: number): string {
  if (offset === 0) return L('Сегодня');
  if (offset === 1) return L('Вчера');
  const dt = new Date();
  dt.setDate(dt.getDate() - offset);
  return dt.toLocaleDateString(LOC[useSettingsStore.getState().lang || 'ru'], { day: 'numeric', month: 'long' });
}
