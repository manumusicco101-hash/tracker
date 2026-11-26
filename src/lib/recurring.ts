import type { ISODate, RecurringExpense } from '../types';
import { addMonths, dateInMonth, diffMonths, minDate, monthOf } from './dates';

type RecurringLike = Pick<RecurringExpense, 'date' | 'recurrence'>;

/**
 * Ocurrencias de una serie mensual dentro de [from, to].
 * Cada mes se calcula desde el `dayOfMonth` original (nunca desde la ocurrencia anterior):
 * 31/10 → 30/11 → 31/12 → 31/01 → 28/02 → 31/03.
 * Si la serie está cancelada, no se generan ocurrencias posteriores a `endedOn`.
 */
export function recurringDates(e: RecurringLike, from: ISODate, to: ISODate): ISODate[] {
  const { dayOfMonth, endedOn } = e.recurrence;
  const end = endedOn !== null ? minDate(endedOn, to) : to;
  const out: ISODate[] = [];
  if (end < e.date || end < from) return out;
  const startMonth = monthOf(e.date > from ? e.date : from);
  const endMonth = monthOf(end);
  for (let ym = startMonth; ym <= endMonth; ym = addMonths(ym, 1)) {
    const d = dateInMonth(ym, dayOfMonth);
    if (d >= e.date && d >= from && d <= end) out.push(d);
  }
  return out;
}

/** Número de ocurrencia (1-based) de una fecha dentro de la serie. */
export function recurringOccurrenceNumber(e: RecurringLike, date: ISODate): number {
  return diffMonths(monthOf(e.date), monthOf(date)) + 1;
}

/** Primera ocurrencia estrictamente posterior a `after`, o null si la serie terminó. */
export function nextRecurringDate(e: RecurringLike, after: ISODate): ISODate | null {
  const { dayOfMonth, endedOn } = e.recurrence;
  let candidate: ISODate | null = null;
  if (e.date > after) {
    candidate = e.date;
  } else {
    let ym = monthOf(after);
    for (let i = 0; i < 3 && candidate === null; i += 1) {
      const d = dateInMonth(ym, dayOfMonth);
      if (d > after) candidate = d;
      ym = addMonths(ym, 1);
    }
  }
  if (candidate === null) return null;
  if (endedOn !== null && candidate > endedOn) return null;
  return candidate;
}

export function isRecurringActive(e: RecurringLike): boolean {
  return e.recurrence.endedOn === null;
}

export interface PriceChangePlan {
  /** Fecha de cierre de la serie actual (conserva todo lo ocurrido hasta hoy). */
  endedOn: ISODate;
  /** Fecha de inicio de la nueva serie (la próxima ocurrencia). */
  startDate: ISODate;
}

/**
 * Cambio de precio "desde la próxima ocurrencia": se cierra la serie hoy y se abre otra
 * desde la próxima fecha. Devuelve null si la serie todavía no tuvo ocurrencias
 * (en ese caso alcanza con editar el monto) o si ya terminó.
 */
export function planPriceChange(e: RecurringLike, today: ISODate): PriceChangePlan | null {
  if (e.date > today || !isRecurringActive(e)) return null;
  const startDate = nextRecurringDate(e, today);
  if (startDate === null) return null;
  return { endedOn: today, startDate };
}
