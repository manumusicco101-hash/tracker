import type { ExchangeRate, Expense, ForeignCurrency, ISODate, QuoteSource, RateHistoryEntry, RateTable, Settings } from '../types';
import { currentRateTable, defaultRate, findRate, FOREIGN_CURRENCIES, isForeign } from './currency';
import { nowTimestamp } from './dates';
import { createId } from './id';
import { QUOTE_SOURCES } from './quoteSources';

export interface RateInput {
  id?: string;
  currency: ForeignCurrency;
  label: string;
  arsPerUnit: number;
  isDefault: boolean;
  /** Fuente en vivo. undefined = dejar la que tenía; null = pasar a manual. */
  autoSource?: QuoteSource | null;
}

/** Garantiza exactamente una cotización por defecto por moneda. */
function normalizeDefaults(rates: ExchangeRate[], preferredId: string | null): ExchangeRate[] {
  const preferred = preferredId ? rates.find((r) => r.id === preferredId) : undefined;
  const result = rates.map((r) => ({ ...r }));
  for (const currency of FOREIGN_CURRENCIES) {
    const ofCurrency = result.filter((r) => r.currency === currency);
    if (ofCurrency.length === 0) continue;
    let chosen: ExchangeRate | undefined;
    if (preferred && preferred.currency === currency && preferred.isDefault) {
      chosen = ofCurrency.find((r) => r.id === preferred.id);
    }
    chosen ??= ofCurrency.find((r) => r.isDefault) ?? ofCurrency[0];
    for (const r of ofCurrency) r.isDefault = r.id === chosen.id;
  }
  return result;
}

/** Registra el valor de una cotización en una fecha (reemplaza el del mismo día). */
export function recordRateHistory(history: RateHistoryEntry[], rateId: string, date: ISODate, arsPerUnit: number): RateHistoryEntry[] {
  return [...history.filter((h) => !(h.rateId === rateId && h.date === date)), { rateId, date, arsPerUnit }].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );
}

/** Crea o actualiza una cotización. Si cambia el valor, queda registrado en el historial con fecha de hoy. */
export function upsertRate(settings: Settings, input: RateInput, today: ISODate, now: string = nowTimestamp()): Settings {
  if (!Number.isFinite(input.arsPerUnit) || input.arsPerUnit <= 0) {
    throw new Error('La cotización tiene que ser mayor a cero.');
  }
  const existing = findRate(settings.rates, input.id);
  const id = existing?.id ?? createId();
  const currency = existing?.currency ?? input.currency;
  const autoSource = input.autoSource === undefined ? (existing?.autoSource ?? null) : input.autoSource;
  if (autoSource && QUOTE_SOURCES[autoSource].currency !== currency) {
    throw new Error(`Esa fuente no es de ${currency}.`);
  }
  const rate: ExchangeRate = {
    id,
    currency,
    label: input.label.trim(),
    arsPerUnit: input.arsPerUnit,
    isDefault: input.isDefault,
    autoSource,
    updatedAt: now,
  };
  const withRate = existing ? settings.rates.map((r) => (r.id === id ? rate : r)) : [...settings.rates, rate];
  const rates = normalizeDefaults(withRate, rate.isDefault ? id : null);
  const valueChanged = !existing || existing.arsPerUnit !== rate.arsPerUnit;
  const rateHistory = valueChanged ? recordRateHistory(settings.rateHistory, id, today, rate.arsPerUnit) : settings.rateHistory;
  return { ...settings, rates, rateHistory };
}

/** Elimina una cotización (tiene que quedar al menos una por moneda). El historial se conserva. */
export function deleteRate(settings: Settings, id: string): Settings {
  const rate = findRate(settings.rates, id);
  if (!rate) return settings;
  const sameCurrency = settings.rates.filter((r) => r.currency === rate.currency);
  if (sameCurrency.length <= 1) {
    throw new Error(`Tiene que quedar al menos una cotización de ${rate.currency}.`);
  }
  return { ...settings, rates: normalizeDefaults(settings.rates.filter((r) => r.id !== id), null) };
}

export function setDefaultRate(settings: Settings, id: string): Settings {
  const rate = findRate(settings.rates, id);
  if (!rate) return settings;
  const rates = settings.rates.map((r) => (r.currency === rate.currency ? { ...r, isDefault: r.id === id } : r));
  return { ...settings, rates };
}

export interface RateSnapshotUpdate {
  id: string;
  rateAtCreation: RateTable;
  rateId?: string;
  rateLabel?: string;
}

/**
 * "Recalcular todo con la cotización actual": nueva foto de cotizaciones para cada gasto.
 * Un gasto en moneda extranjera mantiene la cotización que eligió (si todavía existe)
 * o pasa a la por defecto de su moneda.
 */
export function rebaseExpenseRates(expenses: Expense[], rates: ExchangeRate[]): RateSnapshotUpdate[] {
  return expenses.map((e) => {
    const chosen = isForeign(e.currency) ? (findRate(rates, e.rateId) ?? defaultRate(rates, e.currency)) : undefined;
    const update: RateSnapshotUpdate = {
      id: e.id,
      rateAtCreation: currentRateTable(rates, e.currency, chosen?.id),
    };
    if (chosen) {
      update.rateId = chosen.id;
      if (chosen.label) update.rateLabel = chosen.label;
    }
    return update;
  });
}
