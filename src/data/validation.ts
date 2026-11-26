import { BASE_CURRENCIES, FOREIGN_CURRENCIES } from '../lib/currency';
import { isValidISODate } from '../lib/dates';
import { EXPENSE_KINDS, PAYMENT_METHODS } from '../lib/labels';
import { CURRENCY_CODES } from '../lib/money';
import type {
  AppDataContent,
  BaseCurrency,
  Budget,
  Category,
  CurrencyCode,
  ExchangeRate,
  Expense,
  ExpenseKind,
  ForeignCurrency,
  PaymentMethod,
  RateHistoryEntry,
  RateTable,
  Settings,
  ThemePreference,
} from '../types';
import { createOtherCategory, OTHER_CATEGORY_ID } from './defaults';

// Validación manual (sin dependencias) de los datos guardados o importados.
// Es estricta con lo esencial y repara lo que se puede reparar sin perder datos.

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function fail(path: string, expected: string): never {
  throw new ValidationError(`Formato inválido en ${path}: se esperaba ${expected}.`);
}

function obj(v: unknown, path: string): Obj {
  if (!isObj(v)) fail(path, 'un objeto');
  return v;
}

function str(o: Obj, key: string, path: string): string {
  const v = o[key];
  if (typeof v !== 'string') fail(`${path}.${key}`, 'texto');
  return v;
}

function optStr(o: Obj, key: string, path: string): string | undefined {
  const v = o[key];
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v !== 'string') fail(`${path}.${key}`, 'texto');
  return v;
}

function num(o: Obj, key: string, path: string, { int = false, min = -Infinity } = {}): number {
  const v = o[key];
  if (typeof v !== 'number' || !Number.isFinite(v) || (int && !Number.isInteger(v)) || v < min) {
    fail(`${path}.${key}`, int ? `un entero ≥ ${min}` : `un número ≥ ${min}`);
  }
  return v;
}

function oneOf<T extends string>(o: Obj, key: string, path: string, values: readonly T[]): T {
  const v = o[key];
  if (typeof v !== 'string' || !(values as readonly string[]).includes(v)) fail(`${path}.${key}`, values.join(' | '));
  return v as T;
}

function date(o: Obj, key: string, path: string): string {
  const v = o[key];
  if (!isValidISODate(v)) fail(`${path}.${key}`, 'una fecha YYYY-MM-DD');
  return v;
}

function timestamp(o: Obj, key: string): string {
  const v = o[key];
  if (typeof v !== 'string' || Number.isNaN(Date.parse(v))) return new Date().toISOString();
  return v;
}

function arr(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) fail(path, 'una lista');
  return v;
}

function rateTable(v: unknown, path: string): RateTable {
  const o = obj(v, path);
  return {
    ARS: 1,
    USD: num(o, 'USD', path, { min: Number.MIN_VALUE }),
    EUR: num(o, 'EUR', path, { min: Number.MIN_VALUE }),
  };
}

function budget(v: unknown, path: string): Budget {
  const o = obj(v, path);
  return {
    amountCents: num(o, 'amountCents', path, { int: true, min: 0 }),
    currency: oneOf<BaseCurrency>(o, 'currency', path, BASE_CURRENCIES),
  };
}

function validateExpense(v: unknown, path: string): Expense {
  const o = obj(v, path);
  const kind = oneOf<ExpenseKind>(o, 'kind', path, EXPENSE_KINDS);
  const base = {
    id: str(o, 'id', path),
    amountCents: num(o, 'amountCents', path, { int: true, min: 0 }),
    currency: oneOf<CurrencyCode>(o, 'currency', path, CURRENCY_CODES),
    rateAtCreation: rateTable(o.rateAtCreation, `${path}.rateAtCreation`),
    categoryId: str(o, 'categoryId', path),
    date: date(o, 'date', path),
    createdAt: timestamp(o, 'createdAt'),
    updatedAt: timestamp(o, 'updatedAt'),
  };
  const rateId = optStr(o, 'rateId', path);
  const rateLabel = optStr(o, 'rateLabel', path);
  const note = optStr(o, 'note', path);
  const extras = {
    ...(rateId ? { rateId } : {}),
    ...(rateLabel ? { rateLabel } : {}),
    ...(note ? { note } : {}),
    ...(o.isSample === true ? { isSample: true as const } : {}),
  };
  switch (kind) {
    case 'single':
      return { ...base, ...extras, kind, paymentMethod: oneOf<PaymentMethod>(o, 'paymentMethod', path, PAYMENT_METHODS) };
    case 'installments': {
      const p = obj(o.installments, `${path}.installments`);
      const ip = `${path}.installments`;
      return {
        ...base,
        ...extras,
        kind,
        paymentMethod: 'credit',
        installments: {
          count: num(p, 'count', ip, { int: true, min: 1 }),
          interest: oneOf(p, 'interest', ip, ['none', 'financed'] as const),
          financedTotalCents: num(p, 'financedTotalCents', ip, { int: true, min: 0 }),
          firstDue: oneOf(p, 'firstDue', ip, ['this_month', 'next_month'] as const),
        },
      };
    }
    case 'recurring': {
      const r = obj(o.recurrence, `${path}.recurrence`);
      const rp = `${path}.recurrence`;
      const dayOfMonth = num(r, 'dayOfMonth', rp, { int: true, min: 1 });
      if (dayOfMonth > 31) fail(`${rp}.dayOfMonth`, 'un día entre 1 y 31');
      const endedOn = r.endedOn === null || r.endedOn === undefined ? null : date(r, 'endedOn', rp);
      const replacesId = optStr(r, 'replacesId', rp);
      return {
        ...base,
        ...extras,
        kind,
        paymentMethod: oneOf<PaymentMethod>(o, 'paymentMethod', path, PAYMENT_METHODS),
        recurrence: { frequency: 'monthly', dayOfMonth, endedOn, ...(replacesId ? { replacesId } : {}) },
      };
    }
  }
}

function validateCategory(v: unknown, path: string, index: number): Category {
  const o = obj(v, path);
  const id = str(o, 'id', path);
  return {
    id,
    name: str(o, 'name', path).trim() || 'Sin nombre',
    icon: typeof o.icon === 'string' ? o.icon : 'ellipsis',
    color: typeof o.color === 'string' && /^#[0-9a-f]{6}$/i.test(o.color) ? o.color : '#71717a',
    order: typeof o.order === 'number' && Number.isFinite(o.order) ? o.order : index,
    budget: o.budget === null || o.budget === undefined ? null : budget(o.budget, `${path}.budget`),
    ...(o.isSystem === true || id === OTHER_CATEGORY_ID ? { isSystem: true as const } : {}),
  };
}

function validateRate(v: unknown, path: string): ExchangeRate {
  const o = obj(v, path);
  return {
    id: str(o, 'id', path),
    currency: oneOf<ForeignCurrency>(o, 'currency', path, FOREIGN_CURRENCIES),
    label: typeof o.label === 'string' ? o.label : '',
    arsPerUnit: num(o, 'arsPerUnit', path, { min: Number.MIN_VALUE }),
    isDefault: o.isDefault === true,
    updatedAt: timestamp(o, 'updatedAt'),
  };
}

function validateHistoryEntry(v: unknown, path: string): RateHistoryEntry {
  const o = obj(v, path);
  return {
    rateId: str(o, 'rateId', path),
    date: date(o, 'date', path),
    arsPerUnit: num(o, 'arsPerUnit', path, { min: Number.MIN_VALUE }),
  };
}

function validateSettings(v: unknown, path: string): Settings {
  const o = obj(v, path);
  const rates = arr(o.rates, `${path}.rates`).map((r, i) => validateRate(r, `${path}.rates[${i}]`));
  for (const currency of FOREIGN_CURRENCIES) {
    const ofCurrency = rates.filter((r) => r.currency === currency);
    if (ofCurrency.length === 0) fail(`${path}.rates`, `al menos una cotización de ${currency}`);
    if (!ofCurrency.some((r) => r.isDefault)) ofCurrency[0].isDefault = true;
    let seenDefault = false;
    for (const r of ofCurrency) {
      if (r.isDefault && seenDefault) r.isDefault = false;
      if (r.isDefault) seenDefault = true;
    }
  }
  const quick = isObj(o.quickAdd) ? o.quickAdd : {};
  return {
    baseCurrency: oneOf<BaseCurrency>(o, 'baseCurrency', path, BASE_CURRENCIES),
    rates,
    rateHistory: o.rateHistory === undefined ? [] : arr(o.rateHistory, `${path}.rateHistory`).map((h, i) => validateHistoryEntry(h, `${path}.rateHistory[${i}]`)),
    budget: budget(o.budget, `${path}.budget`),
    quickAdd: {
      lastCategoryId: typeof quick.lastCategoryId === 'string' ? quick.lastCategoryId : null,
      lastPaymentMethod: (PAYMENT_METHODS as string[]).includes(quick.lastPaymentMethod as string)
        ? (quick.lastPaymentMethod as PaymentMethod)
        : 'debit',
    },
    theme: (['system', 'light', 'dark'] as const).includes(o.theme as ThemePreference) ? (o.theme as ThemePreference) : 'system',
  };
}

/** Valida y repara el contenido completo (gastos, categorías y ajustes). */
export function validateContent(raw: unknown): AppDataContent {
  const o = obj(raw, 'datos');
  const categories = arr(o.categories, 'categories').map((c, i) => validateCategory(c, `categories[${i}]`, i));
  if (!categories.some((c) => c.id === OTHER_CATEGORY_ID)) categories.push(createOtherCategory(categories.length));

  const ids = new Set<string>();
  const expenses = arr(o.expenses, 'expenses').map((e, i) => {
    const expense = validateExpense(e, `expenses[${i}]`);
    if (ids.has(expense.id)) throw new ValidationError(`Hay dos gastos con el mismo id (${expense.id}).`);
    ids.add(expense.id);
    return expense;
  });

  // Gastos con una categoría que no existe → "Otros".
  const categoryIds = new Set(categories.map((c) => c.id));
  for (const e of expenses) if (!categoryIds.has(e.categoryId)) e.categoryId = OTHER_CATEGORY_ID;

  const settings = validateSettings(o.settings, 'settings');
  if (settings.quickAdd.lastCategoryId && !categoryIds.has(settings.quickAdd.lastCategoryId)) {
    settings.quickAdd.lastCategoryId = null;
  }
  return { expenses, categories, settings };
}
