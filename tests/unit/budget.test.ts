import { describe, it, expect } from 'vitest';
import { budgetState, budgetPct, budgetLeft } from '../../src/lib/budget';
import { applySaved, packTx, getDefaultCategories } from '../../src/lib/storage';

describe('budgetState', () => {
  it('до 80% лимита это норма', () => {
    expect(budgetState(0, 300)).toBe('ok');
    expect(budgetState(239, 300)).toBe('ok');
  });
  it('с 80% до 100% включительно это предупреждение', () => {
    expect(budgetState(240, 300)).toBe('warn');
    expect(budgetState(300, 300)).toBe('warn');
  });
  it('больше лимита это превышение', () => {
    expect(budgetState(300.01, 300)).toBe('over');
  });
  it('без лимита всегда норма', () => {
    expect(budgetState(999, 0)).toBe('ok');
  });
});

describe('budgetPct и budgetLeft', () => {
  it('процент целый и не больше 100', () => {
    expect(budgetPct(120, 300)).toBe(40);
    expect(budgetPct(500, 300)).toBe(100);
    expect(budgetPct(0, 300)).toBe(0);
    expect(budgetPct(10, 0)).toBe(0);
  });
  it('остаток и превышение считаются до центов', () => {
    expect(budgetLeft(120, 300)).toBe(180);
    expect(budgetLeft(340.5, 300)).toBe(-40.5);
    expect(budgetLeft(0.1 + 0.2, 1)).toBe(0.7);
  });
});

describe('хранение лимитов (bud в fin_v1)', () => {
  const today = new Date('2026-03-15T00:00:00Z').getTime();
  const base = { at: 1, base: 'EUR', opening: 0, cats: { order: { expense: ['food'], income: ['salary'] }, items: {
    food: { ru: 'Продукты', icon: 'food', color: '#ff9f0a', type: 'expense' },
    salary: { ru: 'Зарплата', icon: 'work', color: '#30d158', type: 'income' },
  } }, pays: [], tx: [] };

  it('старые данные без bud открываются с пустыми лимитами', () => {
    const r = applySaved(JSON.stringify(base), today);
    expect(r?.bud).toEqual({});
  });

  it('оставляет только лимиты расходных категорий с положительной суммой', () => {
    const raw = JSON.stringify({ ...base, bud: { food: 300, salary: 100, ghost: 50, bad: 'x' } });
    expect(applySaved(raw, today)?.bud).toEqual({ food: 300 });
    const raw2 = JSON.stringify({ ...base, bud: { food: 0 } });
    expect(applySaved(raw2, today)?.bud).toEqual({});
  });

  it('packTx пишет bud и округляет туда и обратно без потерь', () => {
    const { cats, order } = getDefaultCategories();
    const str = packTx(5, 'EUR', 0, cats, order, [], [], { food: 300.5 });
    expect(JSON.parse(str).bud).toEqual({ food: 300.5 });
    expect(applySaved(str, today)?.bud).toEqual({ food: 300.5 });
  });

  it('пустые лимиты в JSON не попадают', () => {
    const { cats, order } = getDefaultCategories();
    const str = packTx(5, 'EUR', 0, cats, order, [], []);
    expect('bud' in JSON.parse(str)).toBe(false);
  });
});
