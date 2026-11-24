import { Transaction, Category } from '../types/fin';

export function generateDemoHistory(
  todayMidnight: number,
  cats: Record<string, Category>,
  existingTx: Transaction[],
  demoOff: boolean = false
): Transaction[] {
  if (demoOff || existingTx.some(t => t.d > 25)) {
    return existingTx.slice();
  }

  const result: Transaction[] = existingTx.slice();
  const now = new Date(todayMidnight);
  let seed = 7;
  const y0 = now.getFullYear() - 1;
  let maxId = existingTx.reduce((acc, t) => Math.max(acc, t.id), 0);

  function rnd(n: number): number {
    seed = (seed * 9301 + 49297) % 233280;
    return Math.floor((seed / 233280) * n);
  }

  function put(y: number, m: number, day: number, cat: string, sum: number, note: string) {
    const dt = new Date(y, m, day);
    if (dt.getMonth() !== m) return;
    dt.setHours(0, 0, 0, 0);
    const ts = dt.getTime();
    if (ts >= todayMidnight - 25 * 86400000 || !cats[cat]) return;
    maxId++;
    result.push({
      id: maxId,
      d: Math.round((todayMidnight - ts) / 86400000),
      t: ('0' + (8 + rnd(14))).slice(-2) + ':' + ('0' + rnd(60)).slice(-2),
      cat,
      note: note || '',
      sum,
      ts,
      demo: 1,
    });
  }

  for (let y = y0; y <= now.getFullYear(); y++) {
    for (let m = 0; m < 12; m++) {
      if (y === now.getFullYear() && m >= now.getMonth()) break;
      put(y, m, 2, 'home', -450, 'Квартира');
      put(y, m, 3, 'salary', 2200, 'Основная работа');
      if (rnd(10) < 4) put(y, m, 10 + rnd(10), 'freelance', 300 + rnd(5) * 100, 'Заказ на сайт');
      for (let i = 0; i < 4 + rnd(3); i++) {
        put(y, m, 1 + rnd(28), 'food', -(35 + rnd(60)), rnd(2) ? 'Lidl' : 'Kaufland');
      }
      for (let i = 0; i < 2 + rnd(3); i++) {
        put(y, m, 1 + rnd(28), 'coffee', -(4 + rnd(4)), 'Costa');
      }
      for (let i = 0; i < 1 + rnd(3); i++) {
        put(y, m, 1 + rnd(28), 'car', -(10 + rnd(40)), rnd(2) ? 'Бензин' : 'Bolt');
      }
      for (let i = 0; i < 1 + rnd(2); i++) {
        put(y, m, 1 + rnd(28), 'fun', -(12 + rnd(30)), '');
      }
      if (rnd(10) < 4) {
        put(y, m, 1 + rnd(28), 'health', -(15 + rnd(40)), 'Аптека');
      }
    }
  }

  result.sort((a, b) => a.d - b.d || (a.t < b.t ? 1 : a.t > b.t ? -1 : b.id - a.id));
  return result;
}
