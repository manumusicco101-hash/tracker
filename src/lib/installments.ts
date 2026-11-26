import type { ISODate, InstallmentExpense, InstallmentPlan } from '../types';
import { addMonths, dateInMonth, monthOf, parseISODate } from './dates';

export const INSTALLMENT_PRESETS = [2, 3, 6, 9, 12, 18] as const;
export const MAX_INSTALLMENTS = 72;

/**
 * Divide un total (en centavos) en `count` cuotas de 2 decimales.
 * Todas las cuotas se truncan al centavo y la última absorbe la diferencia,
 * así la suma coincide exactamente con el total y la última nunca queda menor.
 * Ej.: 10.000.000 (= $100.000) en 3 → [3.333.333, 3.333.333, 3.333.334].
 */
export function splitInstallments(totalCents: number, count: number): number[] {
  if (!Number.isInteger(count) || count < 1) throw new Error(`Cantidad de cuotas inválida: ${count}`);
  const each = Math.floor(totalCents / count);
  return Array.from({ length: count }, (_, i) => (i === count - 1 ? totalCents - each * (count - 1) : each));
}

/**
 * Fechas de cada cuota: el mismo día de la compra, empezando este mes o el siguiente.
 * Si el día no existe en un mes, cae el último día de ese mes.
 */
export function installmentDates(purchaseDate: ISODate, count: number, firstDue: InstallmentPlan['firstDue']): ISODate[] {
  const firstMonth = addMonths(monthOf(purchaseDate), firstDue === 'next_month' ? 1 : 0);
  const day = parseISODate(purchaseDate).d;
  return Array.from({ length: count }, (_, i) => dateInMonth(addMonths(firstMonth, i), day));
}

export interface InstallmentItem {
  /** 1-based. */
  number: number;
  date: ISODate;
  amountCents: number;
}

export function installmentSchedule(e: Pick<InstallmentExpense, 'date' | 'installments'>): InstallmentItem[] {
  const { count, financedTotalCents, firstDue } = e.installments;
  const amounts = splitInstallments(financedTotalCents, count);
  const dates = installmentDates(e.date, count, firstDue);
  return amounts.map((amountCents, i) => ({ number: i + 1, date: dates[i], amountCents }));
}

export interface InstallmentProgress {
  count: number;
  /** Cuotas cuya fecha ya llegó (≤ hoy). */
  paidCount: number;
  paidCents: number;
  remainingCents: number;
  nextDate: ISODate | null;
  nextNumber: number | null;
  lastDate: ISODate;
  isFinished: boolean;
}

export function installmentProgress(e: Pick<InstallmentExpense, 'date' | 'installments'>, today: ISODate): InstallmentProgress {
  const schedule = installmentSchedule(e);
  const paid = schedule.filter((item) => item.date <= today);
  const pending = schedule.filter((item) => item.date > today);
  return {
    count: schedule.length,
    paidCount: paid.length,
    paidCents: paid.reduce((sum, item) => sum + item.amountCents, 0),
    remainingCents: pending.reduce((sum, item) => sum + item.amountCents, 0),
    nextDate: pending[0]?.date ?? null,
    nextNumber: pending[0]?.number ?? null,
    lastDate: schedule[schedule.length - 1].date,
    isFinished: pending.length === 0,
  };
}

/** Interés total (total financiado − precio de contado). */
export function interestCents(e: Pick<InstallmentExpense, 'amountCents' | 'installments'>): number {
  return e.installments.financedTotalCents - e.amountCents;
}

/** Texto de resumen: "6 cuotas de $ 20.000" o "2 × $ 33.333,33 + 1 × $ 33.333,34". */
export function describeSplit(amounts: number[], format: (cents: number) => string): string {
  if (amounts.length === 0) return '';
  const first = amounts[0];
  const last = amounts[amounts.length - 1];
  if (first === last) return `${amounts.length} cuotas de ${format(first)}`;
  return `${amounts.length - 1} × ${format(first)} + 1 × ${format(last)}`;
}
