// Fixtures compartidos por los tests de lib/ (no se usa en la app).
import type { Expense, InstallmentExpense, RecurringExpense, Settings, SingleExpense } from '../types';

export function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    baseCurrency: 'ARS',
    rates: [
      { id: 'usd-oficial', currency: 'USD', label: 'Oficial', arsPerUnit: 1450, isDefault: true, autoSource: null, updatedAt: '2026-11-01T12:00:00.000Z' },
      { id: 'usd-tarjeta', currency: 'USD', label: 'Tarjeta', arsPerUnit: 1885, isDefault: false, autoSource: null, updatedAt: '2026-11-01T12:00:00.000Z' },
      { id: 'eur-oficial', currency: 'EUR', label: 'Oficial', arsPerUnit: 1700, isDefault: true, autoSource: null, updatedAt: '2026-11-01T12:00:00.000Z' },
    ],
    rateHistory: [],
    budget: { amountCents: 900_000_00, currency: 'ARS' },
    quickAdd: { lastCategoryId: null, lastPaymentMethod: 'debit', openOnLaunch: false },
    quotes: { autoUpdate: true, lastSyncAt: null, provider: null },
    theme: 'system',
    ...overrides,
  };
}

const baseFields = {
  rateAtCreation: { ARS: 1, USD: 1450, EUR: 1700 },
  categoryId: 'alimentacion',
  createdAt: '2026-11-01T12:00:00.000Z',
  updatedAt: '2026-11-01T12:00:00.000Z',
};

export function single(overrides: Partial<SingleExpense> = {}): SingleExpense {
  return {
    ...baseFields,
    id: 'single-1',
    kind: 'single',
    amountCents: 10_000_00,
    currency: 'ARS',
    paymentMethod: 'debit',
    date: '2026-11-25',
    ...overrides,
  };
}

export function installments(overrides: Partial<InstallmentExpense> = {}): InstallmentExpense {
  return {
    ...baseFields,
    id: 'inst-1',
    kind: 'installments',
    amountCents: 120_000_00,
    currency: 'ARS',
    paymentMethod: 'credit',
    date: '2026-11-10',
    installments: { count: 6, interest: 'none', financedTotalCents: 120_000_00, firstDue: 'this_month' },
    ...overrides,
  };
}

export function recurring(overrides: Partial<RecurringExpense> = {}): RecurringExpense {
  return {
    ...baseFields,
    id: 'rec-1',
    kind: 'recurring',
    amountCents: 35_000_00,
    currency: 'ARS',
    paymentMethod: 'debit',
    date: '2026-09-28',
    recurrence: { frequency: 'monthly', dayOfMonth: 28, endedOn: null },
    ...overrides,
  };
}

export type { Expense };
