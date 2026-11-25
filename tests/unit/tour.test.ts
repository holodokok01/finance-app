import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cutRect, unionBox, placeCard, isTourDone, markTourDone, TOUR_KEY, TOUR_STEPS } from '../../src/lib/tour';

function stubStorage(initial: Record<string, string> = {}, broken = false) {
  const data: Record<string, string> = { ...initial };
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => {
      if (broken) throw new Error('denied');
      return k in data ? data[k] : null;
    },
    setItem: (k: string, v: string) => {
      if (broken) throw new Error('denied');
      data[k] = v;
    },
  });
  return data;
}

describe('Тур: вырез', () => {
  it('добавляет отступ и округляет до целых', () => {
    const r = cutRect({ left: 10.4, top: 20.6, width: 100.2, height: 50.5 }, 4);
    expect(r).toEqual({ x: 6, y: 17, w: 108, h: 59 });
    for (const v of Object.values(r)) expect(Number.isInteger(v)).toBe(true);
  });
});

describe('Тур: общая рамка', () => {
  it('объединяет несколько элементов', () => {
    const u = unionBox([
      { left: 10, top: 20, width: 100, height: 80 },
      { left: 130, top: 20, width: 90, height: 86 },
    ]);
    expect(u).toEqual({ left: 10, top: 20, width: 210, height: 86 });
  });
});

describe('Тур: место карточки', () => {
  const vw = 390;
  const vh = 844;

  it('ставит карточку под вырезом, если места хватает', () => {
    const p = placeCard({ x: 16, y: 100, w: 358, h: 80 }, vw, vh, 150);
    expect(p.side).toBe('below');
    expect(p.top).toBe(100 + 80 + 14);
    expect(p.width).toBe(340);
  });

  it('ставит карточку над вырезом у нижнего края', () => {
    const p = placeCard({ x: 100, y: 760, w: 80, h: 64 }, vw, vh, 150);
    expect(p.side).toBe('above');
    expect(p.top).toBe(760 - 14 - 150);
  });

  it('не выходит за края экрана, стрелка смотрит в центр выреза', () => {
    const p = placeCard({ x: 8, y: 100, w: 60, h: 40 }, vw, vh, 150);
    expect(p.left).toBe(16);
    expect(p.arrowX).toBe(36);
    const q = placeCard({ x: 330, y: 100, w: 56, h: 40 }, vw, vh, 150);
    expect(q.left + q.width).toBe(vw - 16);
    expect(q.arrowX).toBe(q.width - 36);
    const m = placeCard({ x: 150, y: 100, w: 90, h: 40 }, vw, vh, 150);
    expect(m.arrowX).toBe(Math.round(195 - m.left));
  });

  it('все числа целые', () => {
    const p = placeCard({ x: 33, y: 101, w: 77, h: 45 }, 391, 845, 151);
    for (const v of [p.left, p.top, p.width, p.arrowX]) expect(Number.isInteger(v)).toBe(true);
  });
});

describe('Тур: флаг пройден', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('по умолчанию не пройден, после отметки пройден', () => {
    const data = stubStorage();
    expect(isTourDone()).toBe(false);
    markTourDone();
    expect(data[TOUR_KEY]).toBe('1');
    expect(isTourDone()).toBe(true);
  });

  it('ключи данных приложения не трогает', () => {
    const data = stubStorage({ fin_v1: '{}', set_v1: '{}' });
    markTourDone();
    expect(data.fin_v1).toBe('{}');
    expect(data.set_v1).toBe('{}');
  });

  it('если хранилище недоступно, тур не показывается', () => {
    stubStorage({}, true);
    expect(isTourDone()).toBe(true);
    expect(() => markTourDone()).not.toThrow();
  });
});

describe('Тур: шаги', () => {
  it('у шагов есть цели, тексты и уникальные id', () => {
    const ids = TOUR_STEPS.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of TOUR_STEPS) {
      expect(s.targets.length).toBeGreaterThan(0);
      expect(s.title && s.text).toBeTruthy();
    }
  });
});
