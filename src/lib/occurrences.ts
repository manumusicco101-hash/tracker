import type { Expense, ISODate, Occurrence, Settings } from '../types';
import { convert, rateTableForOccurrence } from './currency';
import { installmentSchedule } from './installments';
import { recurringDates } from './recurring';

// Las cuotas y las ocurrencias recurrentes NO se guardan: se calculan acá a partir
// del registro madre, para el rango de fechas que necesite cada pantalla.

interface OccurrenceExtras {
  installment?: Occurrence['installment'];
  countsInTotals?: boolean;
}

function makeOccurrence(
  e: Expense,
  key: string,
  date: ISODate,
  amountCents: number,
  settings: Settings,
  extras: OccurrenceExtras = {},
): Occurrence {
  const rates = rateTableForOccurrence(e, date, settings);
  const occurrence: Occurrence = {
    key,
    expenseId: e.id,
    kind: e.kind,
    date,
    amountCents,
    currency: e.currency,
    rates,
    amountBase: convert(amountCents / 100, e.currency, settings.baseCurrency, rates),
    categoryId: e.categoryId,
    paymentMethod: e.paymentMethod,
    isSample: e.isSample === true,
    countsInTotals: extras.countsInTotals ?? true,
    createdAt: e.createdAt,
  };
  if (e.note) occurrence.note = e.note;
  if (e.rateLabel) occurrence.rateLabel = e.rateLabel;
  if (extras.installment) occurrence.installment = extras.installment;
  return occurrence;
}

/** Ocurrencias de un gasto dentro de [from, to]. */
export function expandExpense(e: Expense, from: ISODate, to: ISODate, settings: Settings): Occurrence[] {
  const inRange = (d: ISODate) => d >= from && d <= to;
  switch (e.kind) {
    case 'single':
      return inRange(e.date) ? [makeOccurrence(e, e.id, e.date, e.amountCents, settings)] : [];
    case 'installments': {
      const out = installmentSchedule(e)
        .filter((item) => inRange(item.date))
        .map((item) =>
          makeOccurrence(e, `${e.id}#${item.number}`, item.date, item.amountCents, settings, {
            installment: { number: item.number, count: e.installments.count },
          }),
        );
      // Si la primera cuota cae el mes siguiente, el día de la compra se muestra
      // una fila informativa (no suma) para que se vea que quedó cargada.
      if (e.installments.firstDue === 'next_month' && inRange(e.date)) {
        out.push(
          makeOccurrence(e, `${e.id}#compra`, e.date, e.installments.financedTotalCents, settings, {
            countsInTotals: false,
          }),
        );
      }
      return out;
    }
    case 'recurring':
      return recurringDates(e, from, to).map((d) => makeOccurrence(e, `${e.id}@${d}`, d, e.amountCents, settings));
  }
}

/** Orden: fecha descendente, después lo cargado más recientemente primero. */
export function compareOccurrencesDesc(a: Occurrence, b: Occurrence): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return a.key < b.key ? 1 : a.key > b.key ? -1 : 0;
}

export function expandOccurrences(expenses: Expense[], from: ISODate, to: ISODate, settings: Settings): Occurrence[] {
  const out: Occurrence[] = [];
  for (const e of expenses) out.push(...expandExpense(e, from, to, settings));
  return out.sort(compareOccurrencesDesc);
}

/**
 * ¿Ya "llegó"? Los gastos únicos (y la fila informativa de una compra en cuotas)
 * se muestran siempre en su fecha; las cuotas y recurrentes solo cuando fecha ≤ hoy.
 */
export function isRealized(o: Occurrence, today: ISODate): boolean {
  return o.kind === 'single' || !o.countsInTotals || o.date <= today;
}

/** Primera fecha desde la que hay datos (para expandir el historial completo). */
export function earliestDate(expenses: Expense[], fallback: ISODate): ISODate {
  let min = fallback;
  for (const e of expenses) if (e.date < min) min = e.date;
  return min;
}

/** true si la ocurrencia es la fila informativa de una compra en cuotas. */
export function isPurchaseMarker(o: Occurrence): boolean {
  return o.kind === 'installments' && !o.countsInTotals;
}
