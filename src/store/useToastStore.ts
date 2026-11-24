import { create } from 'zustand';
import { Transaction } from '../types/fin';
import { L } from '../i18n';

interface UndoItem {
  tx: Transaction;
  index: number;
}

interface ToastState {
  toastText: string | null;
  toastVisible: boolean;
  undoItem: UndoItem | null;
  undoVisible: boolean;
  undoAt: number;
  tabbarAway: boolean;
  sheetClosedAt: number;
  showToast: (text: string) => void;
  hideToast: () => void;
  showUndo: (tx: Transaction, index: number) => void;
  hideUndo: () => void;
  setTabbarAway: (away: boolean) => void;
  markSheetClosed: () => void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;
let undoTimer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set, get) => ({
  toastText: null,
  toastVisible: false,
  undoItem: null,
  undoVisible: false,
  undoAt: 0,
  tabbarAway: false,
  sheetClosedAt: 0,

  showToast: (text: string) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toastText: L(text), toastVisible: true });
    toastTimer = setTimeout(() => {
      set({ toastVisible: false });
    }, 2000);
  },

  hideToast: () => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toastVisible: false });
  },

  showUndo: (tx: Transaction, index: number) => {
    if (undoTimer) clearTimeout(undoTimer);
    set({
      undoItem: { tx, index },
      undoVisible: true,
      undoAt: performance.now(),
    });
    undoTimer = setTimeout(() => {
      get().hideUndo();
    }, 3000);
  },

  hideUndo: () => {
    if (undoTimer) clearTimeout(undoTimer);
    set({ undoVisible: false });
    setTimeout(() => {
      if (!get().undoVisible) {
        set({ undoItem: null });
      }
    }, 340);
  },

  setTabbarAway: (away: boolean) => {
    set({ tabbarAway: away });
  },

  markSheetClosed: () => {
    set({ sheetClosedAt: performance.now() });
  },
}));

export const toast = (text: string) => useToastStore.getState().showToast(text);
export const showUndo = (tx: Transaction, index: number) => useToastStore.getState().showUndo(tx, index);
export const tabbarAway = (on: boolean) => useToastStore.getState().setTabbarAway(on);
