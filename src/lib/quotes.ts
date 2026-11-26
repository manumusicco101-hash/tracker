import type { ForeignCurrency, ISODate, QuoteProvider, QuoteSource, Settings, Timestamp } from '../types';
import { QUOTE_SOURCES } from './quoteSources';
import { recordRateHistory } from './rates';

// Cotizaciones en vivo: interpretar lo que devuelven los servicios y aplicarlo a los ajustes.
// Todo es lógica pura: la consulta de red vive en src/services/quotesApi.ts.

export interface Quote {
  /** ARS por unidad, precio de venta, con 2 decimales. */
  sell: number;
  /** Cuándo la actualizó el servicio, si lo informa. */
  asOf: Timestamp | null;
}

export type Quotes = Partial<Record<QuoteSource, Quote>>;

/** Una cotización nueva se rechaza si se aleja más de esta proporción de la actual (dato roto). */
export const MAX_QUOTE_JUMP = 2;

function toQuote(sell: unknown, asOf: unknown): Quote | null {
  if (typeof sell !== 'number' || !Number.isFinite(sell) || sell <= 0) return null;
  const rounded = Math.round(sell * 100) / 100;
  if (rounded <= 0) return null;
  return { sell: rounded, asOf: typeof asOf === 'string' && !Number.isNaN(Date.parse(asOf)) ? asOf : null };
}

const DOLARAPI_CASAS: Record<string, QuoteSource> = {
  oficial: 'usd-oficial',
  bolsa: 'usd-mep',
  tarjeta: 'usd-tarjeta',
  blue: 'usd-blue',
  contadoconliqui: 'usd-ccl',
  mayorista: 'usd-mayorista',
  cripto: 'usd-cripto',
};

/** DolarApi: `/v1/dolares` (lista) y `/v1/cotizaciones/eur` (objeto). Ignora lo que no entiende. */
export function parseDolarApi(dolares: unknown, euro?: unknown): Quotes {
  const quotes: Quotes = {};
  if (Array.isArray(dolares)) {
    for (const item of dolares) {
      if (typeof item !== 'object' || item === null) continue;
      const { casa, venta, fechaActualizacion } = item as Record<string, unknown>;
      if (typeof casa !== 'string' || !Object.hasOwn(DOLARAPI_CASAS, casa)) continue;
      const quote = toQuote(venta, fechaActualizacion);
      if (quote) quotes[DOLARAPI_CASAS[casa]] = quote;
    }
  }
  if (typeof euro === 'object' && euro !== null) {
    const { venta, fechaActualizacion } = euro as Record<string, unknown>;
    const quote = toQuote(venta, fechaActualizacion);
    if (quote) quotes['eur-oficial'] = quote;
  }
  return quotes;
}

/** Bluelytics (respaldo): solo trae oficial, blue y euro oficial. */
export function parseBluelytics(json: unknown): Quotes {
  const quotes: Quotes = {};
  if (typeof json !== 'object' || json === null) return quotes;
  const root = json as Record<string, unknown>;
  const pairs: Array<[string, QuoteSource]> = [
    ['oficial', 'usd-oficial'],
    ['blue', 'usd-blue'],
    ['oficial_euro', 'eur-oficial'],
  ];
  for (const [key, source] of pairs) {
    const entry = root[key];
    if (typeof entry !== 'object' || entry === null) continue;
    const quote = toQuote((entry as Record<string, unknown>).value_sell, root.last_update);
    if (quote) quotes[source] = quote;
  }
  return quotes;
}

/** ¿El valor nuevo es creíble frente al actual? Evita que un dato roto pise una cotización buena. */
export function isPlausibleQuote(current: number, next: number): boolean {
  if (!Number.isFinite(next) || next <= 0) return false;
  if (!Number.isFinite(current) || current <= 0) return true;
  const ratio = next / current;
  return ratio >= 1 / MAX_QUOTE_JUMP && ratio <= MAX_QUOTE_JUMP;
}

export interface RateChange {
  rateId: string;
  label: string;
  currency: ForeignCurrency;
  from: number;
  to: number;
}

export interface QuoteApplyResult {
  settings: Settings;
  /** Cotizaciones que cambiaron de valor. */
  changes: RateChange[];
  /** Valores descartados por no ser creíbles. */
  rejected: RateChange[];
}

/**
 * Actualiza las cotizaciones que siguen una fuente en vivo. Las manuales no se tocan.
 * Cada cambio queda en el historial con la fecha de hoy (los recurrentes lo usan).
 * Solo afecta a los gastos nuevos: los ya cargados guardan su cotización.
 */
export function applyQuotes(
  settings: Settings,
  quotes: Quotes,
  provider: QuoteProvider,
  today: ISODate,
  now: Timestamp,
): QuoteApplyResult {
  const changes: RateChange[] = [];
  const rejected: RateChange[] = [];
  let history = settings.rateHistory;

  const rates = settings.rates.map((rate) => {
    if (!rate.autoSource) return rate;
    if (QUOTE_SOURCES[rate.autoSource].currency !== rate.currency) return rate;
    const quote = quotes[rate.autoSource];
    if (!quote || quote.sell === rate.arsPerUnit) return rate;
    const change: RateChange = { rateId: rate.id, label: rate.label, currency: rate.currency, from: rate.arsPerUnit, to: quote.sell };
    if (!isPlausibleQuote(rate.arsPerUnit, quote.sell)) {
      rejected.push(change);
      return rate;
    }
    history = recordRateHistory(history, rate.id, today, quote.sell);
    changes.push(change);
    return { ...rate, arsPerUnit: quote.sell, updatedAt: now };
  });

  return {
    settings: { ...settings, rates, rateHistory: history, quotes: { ...settings.quotes, lastSyncAt: now, provider } },
    changes,
    rejected,
  };
}

/** ¿Pasó el tiempo máximo desde la última consulta exitosa? Una hora en el futuro (reloj mal puesto) cuenta como vencida. */
export function isQuoteStale(lastSyncAt: Timestamp | null, nowMs: number, maxAgeMs: number): boolean {
  if (!lastSyncAt) return true;
  const last = Date.parse(lastSyncAt);
  if (Number.isNaN(last)) return true;
  const age = nowMs - last;
  return age < 0 || age >= maxAgeMs;
}

/** "recién", "hace 5 min", "hace 2 h", "hace 3 días". */
export function formatAge(timestamp: Timestamp, nowMs: number): string {
  const diff = nowMs - Date.parse(timestamp);
  if (Number.isNaN(diff)) return '';
  const minutes = Math.floor(Math.max(0, diff) / 60_000);
  if (minutes < 1) return 'recién';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} ${days === 1 ? 'día' : 'días'}`;
}
