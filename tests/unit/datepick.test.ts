import { describe, it, expect } from 'vitest';
import { pickDay } from '../../src/components/home/ListDatePanel';

const DAY = 86400000;
const a = new Date('2026-11-10T00:00:00').getTime();

describe('pickDay', () => {
  it('first tap starts a one-day range and waits for the end', () => {
    expect(pickDay({ from: null, to: null, picking: false }, a)).toEqual({ from: a, to: a, picking: true });
  });
  it('second tap closes the range in either direction', () => {
    const d1 = pickDay({ from: null, to: null, picking: false }, a);
    expect(pickDay(d1, a + 5 * DAY)).toEqual({ from: a, to: a + 5 * DAY, picking: false });
    expect(pickDay(d1, a - 3 * DAY)).toEqual({ from: a - 3 * DAY, to: a, picking: false });
  });
  it('after a finished range the next tap starts a new one', () => {
    const done = { from: a, to: a + 2 * DAY, picking: false };
    expect(pickDay(done, a + 9 * DAY)).toEqual({ from: a + 9 * DAY, to: a + 9 * DAY, picking: true });
  });
});
