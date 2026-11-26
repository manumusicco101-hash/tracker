import { currentRateTable, findRate } from '../lib/currency';
import { addDays, parseISODate, timestampAt } from '../lib/dates';
import { createId } from '../lib/id';
import type { CurrencyCode, Expense, ISODate, InstallmentPlan, PaymentMethod, Settings } from '../types';

// 18 gastos ficticios generados en relación a la fecha actual (últimos 10 días),
// todos marcados con isSample: true para poder borrarlos con un botón.

interface SampleBase {
  daysAgo: number;
  hour: number;
  note: string;
  categoryId: string;
  amount: number;
  currency?: CurrencyCode;
  rateId?: string;
  paymentMethod: PaymentMethod;
}

type SampleSpec =
  | (SampleBase & { kind: 'single' })
  | (SampleBase & { kind: 'installments'; plan: Omit<InstallmentPlan, 'financedTotalCents'> & { financedTotal?: number } })
  | (SampleBase & { kind: 'recurring' });

const SPECS: SampleSpec[] = [
  { kind: 'single', daysAgo: 0, hour: 9, note: 'Café y medialunas', categoryId: 'alimentacion', amount: 4800, paymentMethod: 'debit' },
  { kind: 'single', daysAgo: 0, hour: 8, note: 'Viaje en auto al trabajo', categoryId: 'transporte', amount: 6200, paymentMethod: 'debit' },
  { kind: 'single', daysAgo: 1, hour: 19, note: 'Supermercado', categoryId: 'alimentacion', amount: 58300, paymentMethod: 'debit' },
  { kind: 'single', daysAgo: 1, hour: 8, note: 'Carga SUBE', categoryId: 'transporte', amount: 10000, paymentMethod: 'transfer' },
  { kind: 'single', daysAgo: 2, hour: 18, note: 'Farmacia', categoryId: 'salud', amount: 18750.5, paymentMethod: 'cash' },
  {
    kind: 'single',
    daysAgo: 2,
    hour: 22,
    note: 'Compra online',
    categoryId: 'compras',
    amount: 25,
    currency: 'USD',
    rateId: 'usd-tarjeta',
    paymentMethod: 'credit',
  },
  {
    kind: 'recurring',
    daysAgo: 3,
    hour: 10,
    note: 'Streaming',
    categoryId: 'suscripciones',
    amount: 9.99,
    currency: 'USD',
    rateId: 'usd-tarjeta',
    paymentMethod: 'credit',
  },
  { kind: 'single', daysAgo: 3, hour: 21, note: 'Cena con amigos', categoryId: 'ocio', amount: 42000, paymentMethod: 'cash' },
  { kind: 'single', daysAgo: 4, hour: 11, note: 'Luz', categoryId: 'servicios', amount: 38900, paymentMethod: 'transfer' },
  {
    kind: 'installments',
    daysAgo: 5,
    hour: 17,
    note: 'Heladera',
    categoryId: 'vivienda',
    amount: 1200000,
    paymentMethod: 'credit',
    plan: { count: 6, interest: 'none', firstDue: 'this_month' },
  },
  { kind: 'single', daysAgo: 5, hour: 12, note: 'Verdulería', categoryId: 'alimentacion', amount: 12400, paymentMethod: 'cash' },
  { kind: 'recurring', daysAgo: 6, hour: 7, note: 'Gimnasio', categoryId: 'salud', amount: 35000, paymentMethod: 'debit' },
  { kind: 'single', daysAgo: 6, hour: 20, note: 'Nafta', categoryId: 'transporte', amount: 45000, paymentMethod: 'credit' },
  {
    kind: 'installments',
    daysAgo: 7,
    hour: 16,
    note: 'Zapatillas',
    categoryId: 'compras',
    amount: 180000,
    paymentMethod: 'credit',
    plan: { count: 3, interest: 'financed', financedTotal: 210000, firstDue: 'next_month' },
  },
  { kind: 'single', daysAgo: 7, hour: 22, note: 'Cine', categoryId: 'ocio', amount: 14000, paymentMethod: 'debit' },
  { kind: 'single', daysAgo: 8, hour: 15, note: 'Libro importado', categoryId: 'ocio', amount: 18, currency: 'EUR', paymentMethod: 'credit' },
  { kind: 'single', daysAgo: 9, hour: 10, note: 'Expensas', categoryId: 'vivienda', amount: 95000, paymentMethod: 'transfer' },
  { kind: 'single', daysAgo: 9, hour: 13, note: 'Internet', categoryId: 'servicios', amount: 27500, paymentMethod: 'debit' },
];

export function createSampleExpenses(today: ISODate, settings: Settings): Expense[] {
  return SPECS.map((spec) => {
    const date = addDays(today, -spec.daysAgo);
    const currency = spec.currency ?? 'ARS';
    const chosen = findRate(settings.rates, spec.rateId);
    const timestamp = timestampAt(date, spec.hour);
    const common = {
      id: createId(),
      amountCents: Math.round(spec.amount * 100),
      currency,
      rateAtCreation: currentRateTable(settings.rates, currency, chosen?.id),
      ...(chosen ? { rateId: chosen.id, rateLabel: chosen.label } : {}),
      categoryId: spec.categoryId,
      date,
      note: spec.note,
      isSample: true as const,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    switch (spec.kind) {
      case 'single':
        return { ...common, kind: 'single', paymentMethod: spec.paymentMethod };
      case 'installments':
        return {
          ...common,
          kind: 'installments',
          paymentMethod: 'credit',
          installments: {
            count: spec.plan.count,
            interest: spec.plan.interest,
            financedTotalCents: Math.round((spec.plan.financedTotal ?? spec.amount) * 100),
            firstDue: spec.plan.firstDue,
          },
        };
      case 'recurring':
        return {
          ...common,
          kind: 'recurring',
          paymentMethod: spec.paymentMethod,
          recurrence: { frequency: 'monthly', dayOfMonth: parseISODate(date).d, endedOn: null },
        };
    }
  });
}
