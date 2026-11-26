import type { ISODate, Occurrence, YearMonth } from '../types';
import { addMonths, dateRange, monthOf } from './dates';
import { isRealized } from './occurrences';

// Reglas de cómputo:
// - Una cuota suma solo su valor, en el mes de su fecha, cuando esa fecha ya llegó.
// - Un recurrente suma en el mes cuando su ocurrencia ya llegó (fecha ≤ hoy).
// - La fila informativa de una compra en cuotas nunca suma.

export function sumBase(occurrences: Occurrence[]): number {
  let total = 0;
  for (const o of occurrences) if (o.countsInTotals) total += o.amountBase;
  return total;
}

/** "Total de hoy": únicos de hoy + cuotas con fecha hoy + recurrentes cuya ocurrencia es hoy. */
export function totalOn(occurrences: Occurrence[], date: ISODate): number {
  return sumBase(occurrences.filter((o) => o.date === date));
}

/** Ocurrencias del mes que ya llegaron (lo que se ve en el historial y suma en el total del mes). */
export function realizedInMonth(occurrences: Occurrence[], month: YearMonth, today: ISODate): Occurrence[] {
  return occurrences.filter((o) => o.countsInTotals && monthOf(o.date) === month && isRealized(o, today));
}

export interface CategorySlice {
  categoryId: string;
  total: number;
  /** 0–1 */
  share: number;
}

export function byCategory(occurrences: Occurrence[]): CategorySlice[] {
  const totals = new Map<string, number>();
  for (const o of occurrences) {
    if (!o.countsInTotals) continue;
    totals.set(o.categoryId, (totals.get(o.categoryId) ?? 0) + o.amountBase);
  }
  const grand = [...totals.values()].reduce((a, b) => a + b, 0);
  return [...totals.entries()]
    .map(([categoryId, total]) => ({ categoryId, total, share: grand > 0 ? total / grand : 0 }))
    .filter((s) => s.total > 0)
    .sort((a, b) => b.total - a.total);
}

export interface DayPoint {
  date: ISODate;
  total: number;
}

/** Totales por día en [from, to], incluyendo los días sin gastos (en 0). */
export function dailyTotals(occurrences: Occurrence[], from: ISODate, to: ISODate): DayPoint[] {
  const totals = new Map<ISODate, number>();
  for (const o of occurrences) {
    if (!o.countsInTotals || o.date < from || o.date > to) continue;
    totals.set(o.date, (totals.get(o.date) ?? 0) + o.amountBase);
  }
  return dateRange(from, to).map((date) => ({ date, total: totals.get(date) ?? 0 }));
}

export interface MonthCommitment {
  month: YearMonth;
  total: number;
  items: Occurrence[];
}

/**
 * Compromisos futuros (cuotas pendientes y recurrentes) mes por mes, desde el mes actual
 * (solo lo que falta, fecha > hoy) y los `months - 1` siguientes.
 */
export function commitmentsByMonth(occurrences: Occurrence[], today: ISODate, months = 12): MonthCommitment[] {
  const first = monthOf(today);
  const result: MonthCommitment[] = Array.from({ length: months }, (_, i) => ({
    month: addMonths(first, i),
    total: 0,
    items: [],
  }));
  const index = new Map(result.map((m, i) => [m.month, i]));
  const ascending = [...occurrences].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  for (const o of ascending) {
    if (!o.countsInTotals || o.kind === 'single' || o.date <= today) continue;
    const i = index.get(monthOf(o.date));
    if (i === undefined) continue;
    result[i].items.push(o);
    result[i].total += o.amountBase;
  }
  return result;
}

export type BudgetLevel = 'ok' | 'warning' | 'over';

export interface BudgetStatus {
  limit: number;
  spent: number;
  remaining: number;
  /** Porcentaje usado (0–∞). */
  percent: number;
  level: BudgetLevel;
}

/** Verde < 75 %, amarillo 75 %–99 %, rojo ≥ 100 %. */
export function budgetLevel(percent: number): BudgetLevel {
  if (percent >= 100) return 'over';
  if (percent >= 75) return 'warning';
  return 'ok';
}

export function budgetStatus(spent: number, limit: number): BudgetStatus {
  const percent = limit > 0 ? (spent / limit) * 100 : spent > 0 ? 100 : 0;
  return { limit, spent, remaining: limit - spent, percent, level: budgetLevel(percent) };
}
