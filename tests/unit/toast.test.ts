import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useToastStore, toast, showUndo, tabbarAway } from '../../src/store/useToastStore';
import { Transaction } from '../../src/types/fin';

describe('Toast & Undo store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToastStore.setState({
      toastText: null,
      toastVisible: false,
      undoItem: null,
      undoVisible: false,
      undoAt: 0,
      tabbarAway: false,
      sheetClosedAt: 0,
    });
  });

  it('shows toast for 2000ms then auto-hides', () => {
    toast('Тестовое сообщение');
    const s1 = useToastStore.getState();
    expect(s1.toastVisible).toBe(true);
    expect(s1.toastText).toBe('Тестовое сообщение');

    vi.advanceTimersByTime(2000);
    const s2 = useToastStore.getState();
    expect(s2.toastVisible).toBe(false);
  });

  it('shows undo for 3000ms then auto-hides', () => {
    const dummyTx: Transaction = {
      id: 101,
      ts: 1700000000000,
      t: '12:00',
      cat: 'food',
      note: 'Test',
      sum: -25,
      d: 0,
    };

    showUndo(dummyTx, 2);
    const s1 = useToastStore.getState();
    expect(s1.undoVisible).toBe(true);
    expect(s1.undoItem?.tx.id).toBe(101);
    expect(s1.undoItem?.index).toBe(2);

    vi.advanceTimersByTime(3000);
    const s2 = useToastStore.getState();
    expect(s2.undoVisible).toBe(false);

    // After animation delay (340ms) undoItem is cleaned
    vi.advanceTimersByTime(350);
    const s3 = useToastStore.getState();
    expect(s3.undoItem).toBeNull();
  });

  it('toggles tabbarAway', () => {
    expect(useToastStore.getState().tabbarAway).toBe(false);
    tabbarAway(true);
    expect(useToastStore.getState().tabbarAway).toBe(true);
    tabbarAway(false);
    expect(useToastStore.getState().tabbarAway).toBe(false);
  });
});
