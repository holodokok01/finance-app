/* Бюджет по категориям: лимит на календарный месяц в основной валюте.
   Расчёт «потрачено» берётся из статистики месяца (statData), здесь только оценка состояния. */

export type BudgetState = 'ok' | 'warn' | 'over';

/** С какой доли лимита полоска становится предупреждением. */
export const BUDGET_WARN_AT = 0.8;

export function budgetState(spent: number, limit: number): BudgetState {
  if (!(limit > 0)) return 'ok';
  if (spent > limit) return 'over';
  if (spent >= limit * BUDGET_WARN_AT) return 'warn';
  return 'ok';
}

/** Ширина полоски в целых процентах, от 0 до 100. */
export function budgetPct(spent: number, limit: number): number {
  if (!(limit > 0) || !(spent > 0)) return 0;
  return Math.min(100, Math.round((spent / limit) * 100));
}

/** Остаток до лимита (больше нуля) или превышение (меньше нуля), округлено до центов. */
export function budgetLeft(spent: number, limit: number): number {
  return Math.round((limit - spent) * 100) / 100;
}
