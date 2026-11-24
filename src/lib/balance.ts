import { Transaction } from '../types/fin';

export function symOf(c: string): string {
  try {
    const parts = new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: c,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0);
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].type === 'currency') return parts[i].value;
    }
  } catch (e) {}
  return c;
}

export function preSym(sym: string): string {
  return sym.length === 1 ? sym : '';
}

export function postSym(sym: string): string {
  return sym.length === 1 ? '' : '\u00a0' + sym;
}

export function groupThousands(v: number): string {
  return String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function formatCurrency(v: number, sym: string): string {
  const a = Math.round(Math.abs(v) * 100);
  const c = a % 100;
  return groupThousands(Math.floor(a / 100)) + (c ? ',' + ('0' + c).slice(-2) : '') + ' ' + sym;
}

export function formatBalanceParts(v: number, base: string): { sign: string; pre: string; whole: string; cents: string; post: string } {
  const sym = symOf(base);
  const total = Math.round(v * 100);
  const abs = Math.abs(total);
  const cents = ('0' + (abs % 100)).slice(-2);
  return {
    sign: total < 0 ? '−' : '',
    pre: preSym(sym),
    whole: groupThousands(Math.floor(abs / 100)),
    cents: ',' + cents,
    post: postSym(sym),
  };
}

export function calcBalance(opening: number, txList: Transaction[]): number {
  let all = 0;
  for (let i = 0; i < txList.length; i++) {
    const t = txList[i];
    if (!t.demo) all += t.sum;
  }
  return Math.round((opening + all) * 100) / 100;
}

export function calcTotals30Days(txList: Transaction[], nowMidnight: number): { income: number; expense: number } {
  let inc = 0;
  let exp = 0;
  const from = nowMidnight - 29 * 86400000;
  for (let i = 0; i < txList.length; i++) {
    const t = txList[i];
    if (t.ts < from) continue;
    if (t.sum > 0) inc += t.sum;
    else exp += -t.sum;
  }
  return {
    income: Math.round(inc * 100) / 100,
    expense: Math.round(exp * 100) / 100,
  };
}
