export const RX_FALLBACK: Record<string, number> = {
  EUR: 1, USD: 1.1025, UAH: 50.1, GBP: 0.865, CHF: 0.935, PLN: 4.25, CZK: 24.6, HUF: 395,
  RON: 5.07, BGN: 1.95583, SEK: 11.1, NOK: 11.7, DKK: 7.46, ISK: 145, TRY: 47, GEL: 3.15,
  AMD: 440, AZN: 1.87, MDL: 19.6, RSD: 117, KZT: 590, UZS: 13900, TJS: 11.8, BYN: 3.7,
  RUB: 92, CNY: 8.0, JPY: 168, KRW: 1560, INR: 96, IDR: 18300, THB: 36, VND: 29000,
  SGD: 1.44, HKD: 8.6, PHP: 64, MYR: 4.75, TWD: 34, AED: 4.05, SAR: 4.14, ILS: 3.8,
  EGP: 54, ZAR: 19.8, CAD: 1.55, AUD: 1.7, NZD: 1.9, MXN: 20.8, BRL: 6.1, ARS: 1350,
  CLP: 1060, COP: 4500,
};

export interface RatesData {
  live: boolean;
  date: string;
  r: Record<string, number>;
  fetchedAt: number;
}

export const RATES_TTL = 12 * 60 * 60 * 1000;

export function localDay(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}

let ISO: string[] | null = null;
try {
  ISO = (Intl as any).supportedValuesOf ? (Intl as any).supportedValuesOf('currency') : null;
} catch (e) {}

export function parseRatesApi(j: any): RatesData {
  const src = j && j.eur;
  const out: Record<string, number> = { EUR: 1 };
  let n = 0;
  if (!src) throw new Error('Invalid rates payload');

  Object.keys(src).forEach(k => {
    if (!/^[a-z]{3}$/.test(k) || /^x(au|ag|pt|pd|dr|ts)$/.test(k)) return;
    const K = k.toUpperCase();
    const v = +src[k];
    if (!(v > 0) || (ISO && ISO.indexOf(K) < 0 && !RX_FALLBACK[K])) return;
    out[K] = v;
    n++;
  });

  if (n < 30) throw new Error('Too few currencies received');
  return { live: true, date: j.date || '', r: out, fetchedAt: Date.now() };
}

const RATES_URLS = [
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.min.json',
  'https://latest.currency-api.pages.dev/v1/currencies/eur.min.json',
];

async function fetchOne(url: string): Promise<RatesData> {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), 7000) : 0;
  try {
    const res = await fetch(url, ctl ? { signal: ctl.signal } : undefined);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return parseRatesApi(await res.json());
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function loadCachedRates(): RatesData | null {
  try {
    const cached = JSON.parse(localStorage.getItem('rx_v1') || '');
    if (cached && cached.r && cached.r.USD) {
      return { live: true, date: cached.date || '', r: cached.r, fetchedAt: +cached.ts || 0 };
    }
  } catch (e) {}
  return null;
}

export async function fetchRates(): Promise<RatesData> {
  // Оба зеркала сразу: jsdelivr может отдавать устаревшие данные, берём то, где дата новее.
  const results = await Promise.allSettled(RATES_URLS.map(fetchOne));
  const ok: RatesData[] = [];
  results.forEach(r => {
    if (r.status === 'fulfilled') ok.push(r.value);
  });

  if (ok.length) {
    ok.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const best = ok[0];
    try {
      localStorage.setItem('rx_v1', JSON.stringify({ date: best.date, r: best.r, ts: best.fetchedAt }));
    } catch (e) {}
    return best;
  }

  const cached = loadCachedRates();
  if (cached) return cached;

  return { live: false, date: '', r: RX_FALLBACK, fetchedAt: 0 };
}
