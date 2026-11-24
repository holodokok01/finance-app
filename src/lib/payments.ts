import { RecurringPayment, RecurringPeriod } from '../types/fin';
import { L, plural } from '../i18n';
import { LangCode } from '../types/settings';
import { groupThousands } from './balance';

export const PER_K: Record<RecurringPeriod, number> = {
  week: 52 / 12,
  month: 1,
  year: 1 / 12,
};

export const PER_N: Record<RecurringPeriod, string> = {
  week: 'еженедельно',
  month: 'ежемесячно',
  year: 'ежегодно',
};

export function payAdvance(p: { next: number; per: RecurringPeriod; day?: number }): void {
  const d = new Date(p.next);
  if (p.per === 'week') {
    d.setDate(d.getDate() + 7);
  } else {
    const y = d.getFullYear() + (p.per === 'year' ? 1 : 0);
    const m = d.getMonth() + (p.per === 'year' ? 0 : 1);
    const dim = new Date(y, m + 1, 0).getDate();
    d.setFullYear(y, m, Math.min(p.day || d.getDate(), dim));
  }
  d.setHours(0, 0, 0, 0);
  p.next = d.getTime();
}

export function payDays(p: { next: number }, todayMidnight: number): number {
  return Math.round((p.next - todayMidnight) / 86400000);
}

export function payWhen(p: { next: number }, todayMidnight: number, lang?: LangCode): string {
  const n = payDays(p, todayMidnight);
  if (n < 0) return L('просрочен', undefined, lang);
  if (n === 0) return L('сегодня', undefined, lang);
  if (n === 1) return L('завтра', undefined, lang);
  return L('через {n} {w}', { n, w: plural(n, 'день', 'дня', 'дней', lang) }, lang);
}

export function payMonthly(payments: RecurringPayment[]): number {
  let t = 0;
  for (let i = 0; i < payments.length; i++) {
    const p = payments[i];
    t += p.sum * (PER_K[p.per] || 1);
  }
  return Math.round(t);
}

export function calcFreeBalance(balance: number, payments: RecurringPayment[], todayMidnight: number): number {
  const now = new Date(todayMidnight);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).getTime();
  let b = balance;

  for (let i = 0; i < payments.length; i++) {
    const p = payments[i];
    const q = { next: p.next, per: p.per, day: p.day };
    let g = 0;
    while (q.next <= end && g++ < 60) {
      b -= p.sum;
      payAdvance(q);
    }
  }

  return Math.round(b * 100) / 100;
}

/** Сумма платежа как в списках: 1 200,50 € */
export function fmtMoney(v: number, sym: string): string {
  const a = Math.round(Math.abs(v) * 100);
  const c = a % 100;
  return groupThousands(Math.floor(a / 100)) + (c ? ',' + ('0' + c).slice(-2) : '') + '\u00a0' + sym;
}

/** Чистит ввод суммы: цифры и одна запятая, до 2 знаков после неё, до 7 до неё */
export function cleanAmountInput(raw: string): string {
  let c = raw.replace(/[^\d.,]/g, '').replace('.', ',');
  const i = c.indexOf(',');
  if (i >= 0) c = c.slice(0, i + 1) + c.slice(i + 1).replace(/,/g, '').slice(0, 2);
  if (c.replace(/,.*/, '').length > 7) c = c.slice(0, 7) + (i >= 0 && i <= 7 ? c.slice(i) : '');
  return c;
}

/** Разбор суммы из поля: 0 если пусто или не число */
export function parseAmount(raw: string): number {
  const v = Math.round(parseFloat((raw || '').replace(/\s/g, '').replace(',', '.')) * 100) / 100;
  return v > 0 ? v : 0;
}

/** Платёж по возрастанию даты следующей оплаты */
export function paySorted(list: RecurringPayment[]): RecurringPayment[] {
  return list.slice().sort((a, b) => a.next - b.next);
}
