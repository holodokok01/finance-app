import { create } from 'zustand';
import { fetchRates, loadCachedRates, localDay, RatesData, RATES_TTL, RX_FALLBACK } from '../services/rates';

interface RatesState extends RatesData {
  checkedDate: string;
  loadRates: () => Promise<void>;
}

let inflight = false;

export const useRatesStore = create<RatesState>((set) => {
  const apply = (data: RatesData) =>
    set({
      live: data.live,
      date: data.date,
      r: data.r,
      fetchedAt: data.fetchedAt,
      checkedDate: localDay(data.fetchedAt),
    });

  return {
    live: false,
    date: '',
    r: RX_FALLBACK,
    fetchedAt: 0,
    checkedDate: '',

    loadRates: async () => {
      if (inflight) return;
      const cached = loadCachedRates();
      if (cached) {
        apply(cached);
        if (Date.now() - cached.fetchedAt < RATES_TTL) return;
      }
      inflight = true;
      try {
        apply(await fetchRates());
      } finally {
        inflight = false;
      }
    },
  };
});
