import { describe, it, expect } from 'vitest';
import { evalExpr } from '../../src/components/home/AddTransactionSheet';

describe('evalExpr arithmetic', () => {
  it('evaluates basic numbers', () => {
    expect(evalExpr('100')).toBe(100);
    expect(evalExpr('0')).toBe(0);
    expect(evalExpr('12,5')).toBe(12.5);
    expect(evalExpr('12,50')).toBe(12.5);
    expect(evalExpr('0,99')).toBe(0.99);
  });

  it('evaluates arithmetic operations', () => {
    expect(evalExpr('100+50')).toBe(150);
    expect(evalExpr('200-75')).toBe(125);
    expect(evalExpr('25*4')).toBe(100);
    expect(evalExpr('100/4')).toBe(25);
    expect(evalExpr('10+20*3')).toBe(70);
  });

  it('evaluates trailing operators gracefully', () => {
    expect(evalExpr('100+')).toBe(100);
    expect(evalExpr('200*')).toBe(200);
    expect(evalExpr('50-')).toBe(50);
  });

  it('evaluates percentage expressions (a%b => a% of b)', () => {
    // 10% of 200 = 20
    expect(evalExpr('10%200')).toBe(20);
    // 20% of 500 = 100
    expect(evalExpr('20%500')).toBe(100);
    // 15% of 0 = 0
    expect(evalExpr('15%0')).toBe(0);
  });

  it('returns 0 for empty or invalid strings', () => {
    expect(evalExpr('')).toBe(0);
    expect(evalExpr('abc')).toBe(0);
  });
});
