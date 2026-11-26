import type { ForeignCurrency, QuoteProvider, QuoteSource } from '../types';

export interface QuoteSourceInfo {
  currency: ForeignCurrency;
  /** Nombre corto para mostrar y para etiquetar la cotización. */
  label: string;
}

/** Cotizaciones en vivo disponibles. La clave incluye la moneda: 'usd-mep', 'eur-oficial'… */
export const QUOTE_SOURCES: Record<QuoteSource, QuoteSourceInfo> = {
  'usd-oficial': { currency: 'USD', label: 'Oficial' },
  'usd-mep': { currency: 'USD', label: 'MEP' },
  'usd-tarjeta': { currency: 'USD', label: 'Tarjeta' },
  'usd-blue': { currency: 'USD', label: 'Blue' },
  'usd-ccl': { currency: 'USD', label: 'Contado con liqui' },
  'usd-mayorista': { currency: 'USD', label: 'Mayorista' },
  'usd-cripto': { currency: 'USD', label: 'Cripto' },
  'eur-oficial': { currency: 'EUR', label: 'Oficial' },
};

export const QUOTE_SOURCE_IDS = Object.keys(QUOTE_SOURCES) as QuoteSource[];

export const QUOTE_PROVIDER_NAMES: Record<QuoteProvider, string> = {
  dolarapi: 'DolarApi',
  bluelytics: 'Bluelytics',
};

export function isQuoteSource(value: unknown): value is QuoteSource {
  return typeof value === 'string' && Object.hasOwn(QUOTE_SOURCES, value);
}

/** Fuentes que se pueden elegir para una moneda. */
export function quoteSourcesFor(currency: ForeignCurrency): QuoteSource[] {
  return QUOTE_SOURCE_IDS.filter((id) => QUOTE_SOURCES[id].currency === currency);
}
