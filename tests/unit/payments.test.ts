import { describe, it, expect } from 'vitest';
import { cleanAmountInput, parseAmount, payAdvance, paySorted, fmtMoney } from '../../src/lib/payments';

describe('cleanAmountInput', () => {
  it('оставляет цифры и одну запятую, точка становится запятой', () => {
    expect(cleanAmountInput('12.5')).toBe('12,5');
    expect(cleanAmountInput('1a2b')).toBe('12');
    expect(cleanAmountInput('1,2,3')).toBe('1,23');
  });
  it('обрезает до двух знаков после запятой и до семи до неё', () => {
    expect(cleanAmountInput('1,2345')).toBe('1,23');
    expect(cleanAmountInput('123456789')).toBe('1234567');
  });
});

describe('parseAmount', () => {
  it('разбирает запятую и пробелы', () => {
    expect(parseAmount('1 200,5')).toBe(1200.5);
    expect(parseAmount('15')).toBe(15);
  });
  it('пусто и ноль дают 0', () => {
    expect(parseAmount('')).toBe(0);
    expect(parseAmount('0')).toBe(0);
    expect(parseAmount(',')).toBe(0);
  });
});

describe('payAdvance', () => {
  const d = (y: number, m: number, day: number) => new Date(y, m, day).getTime();
  it('неделя: +7 дней', () => {
    const p = { next: d(2026, 10, 24), per: 'week' as const, day: 24 };
    payAdvance(p);
    expect(p.next).toBe(d(2026, 11, 1));
  });
  it('месяц: держит нужный день, в коротком месяце берёт последний', () => {
    const p = { next: d(2026, 0, 31), per: 'month' as const, day: 31 };
    payAdvance(p);
    expect(p.next).toBe(d(2026, 1, 28));
    payAdvance(p);
    expect(p.next).toBe(d(2026, 2, 31));
  });
  it('год: тот же день и месяц', () => {
    const p = { next: d(2026, 5, 15), per: 'year' as const, day: 15 };
    payAdvance(p);
    expect(p.next).toBe(d(2027, 5, 15));
  });
});

describe('paySorted и fmtMoney', () => {
  it('сортирует по дате и не меняет исходный массив', () => {
    const a = { id: 'a', sum: 1, cat: 'x', per: 'month' as const, next: 20 };
    const b = { id: 'b', sum: 1, cat: 'x', per: 'month' as const, next: 10 };
    const src = [a, b];
    expect(paySorted(src).map(p => p.id)).toEqual(['b', 'a']);
    expect(src[0].id).toBe('a');
  });
  it('форматирует сумму: неразрывный пробел разряда и перед символом', () => {
    expect(fmtMoney(1200.5, '€')).toBe('1\u00a0200,50\u00a0€');
    expect(fmtMoney(15, '€')).toBe('15\u00a0€');
  });
});
