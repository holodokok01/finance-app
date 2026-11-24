import { L, LOC } from '../i18n';
import { useSettingsStore } from '../store/useSettingsStore';

const FMT: Record<string, Intl.DateTimeFormat> = {};

/** «Сегодня», «Вчера» или «12 ноября» по смещению в днях назад. */
export function dayLabel(offset: number): string {
  if (offset === 0) return L('Сегодня');
  if (offset === 1) return L('Вчера');
  const loc = LOC[useSettingsStore.getState().lang || 'ru'];
  const f = FMT[loc] || (FMT[loc] = new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long' }));
  const dt = new Date();
  dt.setDate(dt.getDate() - offset);
  return f.format(dt);
}
