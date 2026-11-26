import type {
  BaseCurrency,
  Budget,
  CurrencyCode,
  ExchangeRate,
  Expense,
  ForeignCurrency,
  ISODate,
  RateHistoryEntry,
  RateTable,
  Settings,
} from '../types';

// Todas las cotizaciones se expresan contra ARS (moneda pivote): "1 USD = 1.450 ARS".
// Convertir de A a B: monto × tabla[A] / tabla[B]. Así cambiar la moneda base
// no requiere tocar ningún registro.

export const FOREIGN_CURRENCIES: ForeignCurrency[] = ['USD', 'EUR'];
export const BASE_CURRENCIES: BaseCurrency[] = ['ARS', 'USD'];

export const CURRENCY_NAMES: Record<CurrencyCode, string> = {
  ARS: 'Pesos',
  USD: 'Dólares',
  EUR: 'Euros',
};

export function isForeign(currency: CurrencyCode): currency is ForeignCurrency {
  return currency !== 'ARS';
}

/** Cotizaciones de una moneda, la por defecto primero. */
export function ratesFor(rates: ExchangeRate[], currency: ForeignCurrency): ExchangeRate[] {
  return rates
    .filter((r) => r.currency === currency)
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.label.localeCompare(b.label, 'es'));
}

export function defaultRate(rates: ExchangeRate[], currency: ForeignCurrency): ExchangeRate | undefined {
  return rates.find((r) => r.currency === currency && r.isDefault) ?? rates.find((r) => r.currency === currency);
}

export function findRate(rates: ExchangeRate[], id: string | null | undefined): ExchangeRate | undefined {
  if (!id) return undefined;
  return rates.find((r) => r.id === id);
}

/** "USD Tarjeta" o "USD" si no tiene etiqueta. */
export function rateDisplayName(rate: Pick<ExchangeRate, 'currency' | 'label'>): string {
  return rate.label ? `${rate.currency} ${rate.label}` : rate.currency;
}

/**
 * Tabla de cotizaciones vigente: cada moneda con su cotización por defecto,
 * salvo `currency`, que usa la cotización elegida (`rateId`) si corresponde a esa moneda.
 */
export function currentRateTable(rates: ExchangeRate[], currency?: CurrencyCode, rateId?: string | null): RateTable {
  const table: RateTable = { ARS: 1, USD: 1, EUR: 1 };
  for (const c of FOREIGN_CURRENCIES) {
    const rate = defaultRate(rates, c);
    if (rate) table[c] = rate.arsPerUnit;
  }
  if (currency && isForeign(currency)) {
    const chosen = findRate(rates, rateId);
    if (chosen && chosen.currency === currency) table[currency] = chosen.arsPerUnit;
  }
  return table;
}

/** Convierte un monto (en unidades) entre monedas usando una tabla contra ARS. */
export function convert(amount: number, from: CurrencyCode, to: CurrencyCode, table: RateTable): number {
  if (from === to) return amount;
  return (amount * table[from]) / table[to];
}

/** Unidades de `to` por cada unidad de `from` según la tabla. */
export function appliedFactor(from: CurrencyCode, to: CurrencyCode, table: RateTable): number {
  return from === to ? 1 : table[from] / table[to];
}

/** Último valor registrado de una cotización con fecha ≤ `date`. */
export function rateValueAt(history: RateHistoryEntry[], rateId: string, date: ISODate): number | null {
  let best: RateHistoryEntry | null = null;
  for (const entry of history) {
    if (entry.rateId !== rateId || entry.date > date) continue;
    if (best === null || entry.date >= best.date) best = entry;
  }
  return best ? best.arsPerUnit : null;
}

/**
 * Cotizaciones con las que se convierte una ocurrencia:
 * - Únicos y cuotas: siempre `rateAtCreation` (la cotización guardada al cargarlos).
 * - Recurrentes: la cotización vigente en la fecha de cada ocurrencia según el historial
 *   (la elegida para su moneda, la por defecto para las demás). Si el historial no tiene
 *   datos para esa fecha, se usa `rateAtCreation`.
 */
export function rateTableForOccurrence(expense: Expense, date: ISODate, settings: Settings): RateTable {
  if (expense.kind !== 'recurring') return expense.rateAtCreation;
  const table: RateTable = { ...expense.rateAtCreation, ARS: 1 };
  for (const c of FOREIGN_CURRENCIES) {
    const rateId = c === expense.currency && expense.rateId ? expense.rateId : defaultRate(settings.rates, c)?.id;
    if (!rateId) continue;
    const value = rateValueAt(settings.rateHistory, rateId, date);
    if (value !== null) table[c] = value;
  }
  return table;
}

/** Presupuesto expresado en la moneda base (convertido con la cotización vigente). */
export function budgetInBase(budget: Budget, settings: Settings): number {
  return convert(budget.amountCents / 100, budget.currency, settings.baseCurrency, currentRateTable(settings.rates));
}
