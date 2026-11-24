import { create } from 'zustand';
import { fetchRates, RatesData, RX_FALLBACK } from '../services/rates';

interface RatesState extends RatesData {
  loadRates: () => Promise<void>;
}

export const useRatesStore = create<RatesState>((set) => ({
  live: false,
  date: '',
  r: RX_FALLBACK,

  loadRates: async () => {
    const data = await fetchRates();
    set({
      live: data.live,
      date: data.date,
      r: data.r,
    });
  },
}));
