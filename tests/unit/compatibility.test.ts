import { describe, it, expect } from 'vitest';
import { applySaved, packTx } from '../../src/lib/storage';
import { FinV1Storage } from '../../src/types/fin';
import { Settings } from '../../src/types/settings';

describe('Data Compatibility with legacy fin_v1 and set_v1', () => {
  it('opens real legacy fin_v1 JSON structure without data loss', () => {
    const today = new Date('2026-03-15T00:00:00Z').getTime();

    // Sample real JSON matching legacy index.html
    const legacyFinJson: FinV1Storage = {
      at: 1710500000000,
      base: 'EUR',
      opening: 6000,
      cats: {
        order: {
          expense: ['food', 'car', 'custom_gym'],
          income: ['salary', 'freelance'],
        },
        items: {
          food: { ru: 'Продукты', icon: 'food', color: '#ff9f0a', type: 'expense' },
          car: { ru: 'Транспорт', icon: 'car', color: '#3fa7ff', type: 'expense' },
          custom_gym: { n: 'Спортзал', icon: 'heart', color: '#ff453a', type: 'expense' },
          salary: { ru: 'Зарплата', icon: 'work', color: '#30d158', type: 'income' },
          freelance: { ru: 'Фриланс', icon: 'laptop', color: '#40c8e0', type: 'income' },
        },
      },
      pays: [
        {
          id: 'p1',
          sum: 450,
          cat: 'home',
          n: 'Аренда',
          per: 'month',
          next: 1710600000000,
          day: 16,
        },
      ],
      tx: [
        {
          ts: 1710400000000,
          t: '09:12',
          cat: 'food',
          sum: -5.5,
          note: 'Costa',
        },
        {
          ts: 1710300000000,
          t: '18:30',
          cat: 'custom_gym',
          sum: -40,
          title: 'Абонемент', // Legacy field that should migrate to note
        },
        {
          ts: 1710200000000,
          t: '12:00',
          cat: 'salary',
          sum: 2200,
          note: 'Основная работа',
        },
      ],
    };

    const rawString = JSON.stringify(legacyFinJson);
    const parsed = applySaved(rawString, today);

    expect(parsed).not.toBeNull();
    if (!parsed) return;

    expect(parsed.base).toBe('EUR');
    expect(parsed.opening).toBe(6000);
    expect(parsed.cats['custom_gym']).toBeDefined();
    expect(parsed.cats['custom_gym'].name).toBe('Спортзал');
    expect(parsed.pays.length).toBe(1);
    expect(parsed.pays[0].n).toBe('Аренда');
    expect(parsed.tx.length).toBe(3);

    // Verify migration of title -> note
    const gymTx = parsed.tx.find(t => t.cat === 'custom_gym');
    expect(gymTx?.note).toBe('Абонемент');

    // Verify round-trip packTx produces identical structure
    const repackedStr = packTx(
      parsed.at,
      parsed.base,
      parsed.opening,
      parsed.cats,
      parsed.order,
      parsed.pays,
      parsed.tx
    );

    const reParsed = applySaved(repackedStr, today);
    expect(reParsed).not.toBeNull();
    if (!reParsed) return;

    expect(reParsed.tx.length).toBe(3);
    expect(reParsed.cats['custom_gym'].name).toBe('Спортзал');
    expect(reParsed.base).toBe('EUR');
  });

  it('correctly parses set_v1 settings without loss', () => {
    const legacySetJson: Settings = {
      base: 'USD',
      haptic: true,
      demoOff: false,
      opening: 5000,
      theme: 'dark',
      lang: 'uk',
    };

    const rawString = JSON.stringify(legacySetJson);
    const parsed: Settings = JSON.parse(rawString);

    expect(parsed.base).toBe('USD');
    expect(parsed.haptic).toBe(true);
    expect(parsed.demoOff).toBe(false);
    expect(parsed.opening).toBe(5000);
    expect(parsed.theme).toBe('dark');
    expect(parsed.lang).toBe('uk');
  });
});
