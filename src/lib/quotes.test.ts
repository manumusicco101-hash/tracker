import { describe, expect, it } from 'vitest';
import type { QuoteSource, Settings } from '../types';
import { applyQuotes, formatAge, isPlausibleQuote, isQuoteStale, parseBluelytics, parseDolarApi, type Quotes } from './quotes';
import { makeSettings } from './testing';

const TODAY = '2026-11-26';
const NOW = '2026-11-26T21:00:00.000Z';
const NOW_MS = Date.parse(NOW);

/** Las tres cotizaciones del fixture siguiendo su fuente en vivo (los ids coinciden con las fuentes). */
function autoSettings(): Settings {
  const base = makeSettings();
  return { ...base, rates: base.rates.map((r) => ({ ...r, autoSource: r.id as QuoteSource })) };
}

const quote = (sell: number) => ({ sell, asOf: null });

describe('parseDolarApi', () => {
  const dolares = [
    { moneda: 'USD', casa: 'oficial', venta: 1625, fechaActualizacion: '2026-11-26T18:00:00.000Z' },
    { moneda: 'USD', casa: 'bolsa', venta: 1666.4, fechaActualizacion: '2026-11-26T20:56:00.000Z' },
    { moneda: 'USD', casa: 'tarjeta', venta: 2112.5, fechaActualizacion: '2026-11-26T18:00:00.000Z' },
    { moneda: 'USD', casa: 'blue', venta: 1710 },
    { moneda: 'USD', casa: 'contadoconliqui', venta: 1767.9 },
    { moneda: 'USD', casa: 'mayorista', venta: 1601.5 },
    { moneda: 'USD', casa: 'cripto', venta: 'caro' },
    { moneda: 'USD', casa: 'inventada', venta: 5 },
    null,
  ];

  it('toma el precio de venta de cada casa y del euro', () => {
    const quotes = parseDolarApi(dolares, { casa: 'oficial', venta: 1759.0876, fechaActualizacion: '2026-11-26T17:54:00.000Z' });
    expect(quotes['usd-oficial']).toEqual({ sell: 1625, asOf: '2026-11-26T18:00:00.000Z' });
    expect(quotes['usd-mep']?.sell).toBe(1666.4);
    expect(quotes['usd-tarjeta']?.sell).toBe(2112.5);
    expect(quotes['usd-blue']).toEqual({ sell: 1710, asOf: null });
    expect(quotes['usd-ccl']?.sell).toBe(1767.9);
    expect(quotes['usd-mayorista']?.sell).toBe(1601.5);
    expect(quotes['eur-oficial']?.sell).toBe(1759.09);
  });

  it('ignora casas desconocidas y precios que no son números', () => {
    const quotes = parseDolarApi(dolares);
    expect(quotes['usd-cripto']).toBeUndefined();
    expect(Object.keys(quotes)).toHaveLength(6);
  });

  it('no se rompe con datos inesperados', () => {
    expect(parseDolarApi(null, 'x')).toEqual({});
    expect(parseDolarApi({ casa: 'oficial' }, [])).toEqual({});
    expect(parseDolarApi([{ casa: 'oficial', venta: 0 }, { casa: 'blue', venta: -3 }, { casa: 'bolsa', venta: Infinity }])).toEqual({});
  });
});

describe('parseBluelytics', () => {
  it('trae oficial, blue y euro oficial', () => {
    const quotes = parseBluelytics({
      oficial: { value_sell: 1625 },
      blue: { value_sell: 1710 },
      oficial_euro: { value_sell: 1786 },
      blue_euro: { value_sell: 1879 },
      last_update: '2026-11-26T19:30:12-03:00',
    });
    expect(quotes['usd-oficial']).toEqual({ sell: 1625, asOf: '2026-11-26T19:30:12-03:00' });
    expect(quotes['usd-blue']?.sell).toBe(1710);
    expect(quotes['eur-oficial']?.sell).toBe(1786);
    expect(Object.keys(quotes)).toHaveLength(3);
  });

  it('no se rompe con datos inesperados', () => {
    expect(parseBluelytics(null)).toEqual({});
    expect(parseBluelytics({ oficial: 'x', blue: null })).toEqual({});
  });
});

describe('applyQuotes', () => {
  const quotes: Quotes = { 'usd-oficial': quote(1625), 'usd-tarjeta': quote(2112.5), 'eur-oficial': quote(1759.09) };

  it('actualiza las cotizaciones en vivo y deja constancia en el historial de hoy', () => {
    const result = applyQuotes(autoSettings(), quotes, 'dolarapi', TODAY, NOW);
    const byId = Object.fromEntries(result.settings.rates.map((r) => [r.id, r]));
    expect(byId['usd-oficial'].arsPerUnit).toBe(1625);
    expect(byId['usd-oficial'].updatedAt).toBe(NOW);
    expect(byId['usd-tarjeta'].arsPerUnit).toBe(2112.5);
    expect(byId['eur-oficial'].arsPerUnit).toBe(1759.09);
    expect(result.settings.rateHistory).toHaveLength(3);
    expect(result.settings.rateHistory.filter((h) => h.rateId === 'usd-oficial')).toEqual([
      { rateId: 'usd-oficial', date: TODAY, arsPerUnit: 1625 },
    ]);
    expect(result.changes.map((c) => [c.rateId, c.from, c.to])).toEqual([
      ['usd-oficial', 1450, 1625],
      ['usd-tarjeta', 1885, 2112.5],
      ['eur-oficial', 1700, 1759.09],
    ]);
    expect(result.rejected).toEqual([]);
  });

  it('dos consultas el mismo día dejan un solo registro por cotización', () => {
    const first = applyQuotes(autoSettings(), quotes, 'dolarapi', TODAY, NOW);
    const second = applyQuotes(first.settings, { ...quotes, 'usd-oficial': quote(1630) }, 'dolarapi', TODAY, NOW);
    expect(second.settings.rateHistory.filter((h) => h.rateId === 'usd-oficial')).toEqual([
      { rateId: 'usd-oficial', date: TODAY, arsPerUnit: 1630 },
    ]);
  });

  it('no toca las cotizaciones manuales', () => {
    const settings = autoSettings();
    settings.rates = settings.rates.map((r) => (r.id === 'usd-tarjeta' ? { ...r, autoSource: null } : r));
    const result = applyQuotes(settings, quotes, 'dolarapi', TODAY, NOW);
    expect(result.settings.rates.find((r) => r.id === 'usd-tarjeta')?.arsPerUnit).toBe(1885);
    expect(result.settings.rateHistory.some((h) => h.rateId === 'usd-tarjeta')).toBe(false);
  });

  it('si el valor no cambió, no hay cambios ni historial ni nueva fecha de actualización', () => {
    const result = applyQuotes(autoSettings(), { 'usd-oficial': quote(1450) }, 'dolarapi', TODAY, NOW);
    expect(result.changes).toEqual([]);
    expect(result.settings.rateHistory).toEqual([]);
    expect(result.settings.rates.find((r) => r.id === 'usd-oficial')?.updatedAt).toBe('2026-11-01T12:00:00.000Z');
  });

  it('descarta un valor que se aleja demasiado del actual', () => {
    const result = applyQuotes(autoSettings(), { 'usd-oficial': quote(5000), 'usd-tarjeta': quote(2112.5) }, 'dolarapi', TODAY, NOW);
    expect(result.rejected.map((r) => [r.rateId, r.to])).toEqual([['usd-oficial', 5000]]);
    expect(result.settings.rates.find((r) => r.id === 'usd-oficial')?.arsPerUnit).toBe(1450);
    expect(result.settings.rates.find((r) => r.id === 'usd-tarjeta')?.arsPerUnit).toBe(2112.5);
  });

  it('si la fuente no trae una cotización, la deja como estaba', () => {
    const result = applyQuotes(autoSettings(), { 'usd-oficial': quote(1625) }, 'bluelytics', TODAY, NOW);
    expect(result.settings.rates.find((r) => r.id === 'usd-tarjeta')?.arsPerUnit).toBe(1885);
    expect(result.settings.rates.find((r) => r.id === 'eur-oficial')?.arsPerUnit).toBe(1700);
  });

  it('ignora una fuente que no es de la moneda de la cotización', () => {
    const settings = autoSettings();
    settings.rates = settings.rates.map((r) => (r.id === 'usd-oficial' ? { ...r, autoSource: 'eur-oficial' as const } : r));
    const result = applyQuotes(settings, { 'eur-oficial': quote(1759.09) }, 'dolarapi', TODAY, NOW);
    expect(result.settings.rates.find((r) => r.id === 'usd-oficial')?.arsPerUnit).toBe(1450);
  });

  it('registra cuándo y con qué servicio se consultó, aunque nada haya cambiado', () => {
    const result = applyQuotes(autoSettings(), {}, 'bluelytics', TODAY, NOW);
    expect(result.settings.quotes).toEqual({ autoUpdate: true, lastSyncAt: NOW, provider: 'bluelytics' });
  });

  it('no modifica los ajustes originales', () => {
    const settings = autoSettings();
    applyQuotes(settings, quotes, 'dolarapi', TODAY, NOW);
    expect(settings.rates[0].arsPerUnit).toBe(1450);
    expect(settings.rateHistory).toEqual([]);
    expect(settings.quotes.lastSyncAt).toBeNull();
  });
});

describe('isPlausibleQuote', () => {
  it('acepta variaciones normales y rechaza valores rotos', () => {
    expect(isPlausibleQuote(1450, 1625)).toBe(true);
    expect(isPlausibleQuote(1000, 2000)).toBe(true);
    expect(isPlausibleQuote(1000, 500)).toBe(true);
    expect(isPlausibleQuote(1000, 2001)).toBe(false);
    expect(isPlausibleQuote(1000, 499)).toBe(false);
    expect(isPlausibleQuote(1000, 0)).toBe(false);
    expect(isPlausibleQuote(1000, -5)).toBe(false);
    expect(isPlausibleQuote(1000, Number.NaN)).toBe(false);
  });

  it('sin valor actual válido, acepta cualquier valor positivo', () => {
    expect(isPlausibleQuote(0, 1625)).toBe(true);
    expect(isPlausibleQuote(Number.NaN, 1625)).toBe(true);
  });
});

describe('isQuoteStale', () => {
  const MIN = 60_000;
  it('sin consulta previa está vencida', () => {
    expect(isQuoteStale(null, NOW_MS, 30 * MIN)).toBe(true);
  });

  it('compara la antigüedad con el máximo', () => {
    expect(isQuoteStale(new Date(NOW_MS - 29 * MIN).toISOString(), NOW_MS, 30 * MIN)).toBe(false);
    expect(isQuoteStale(new Date(NOW_MS - 30 * MIN).toISOString(), NOW_MS, 30 * MIN)).toBe(true);
  });

  it('una fecha futura o inválida (reloj mal puesto) cuenta como vencida', () => {
    expect(isQuoteStale(new Date(NOW_MS + 5 * MIN).toISOString(), NOW_MS, 30 * MIN)).toBe(true);
    expect(isQuoteStale('no es una fecha', NOW_MS, 30 * MIN)).toBe(true);
  });
});

describe('formatAge', () => {
  const ago = (ms: number) => new Date(NOW_MS - ms).toISOString();
  it('describe la antigüedad en palabras', () => {
    expect(formatAge(ago(30_000), NOW_MS)).toBe('recién');
    expect(formatAge(ago(5 * 60_000), NOW_MS)).toBe('hace 5 min');
    expect(formatAge(ago(2 * 3_600_000 + 1000), NOW_MS)).toBe('hace 2 h');
    expect(formatAge(ago(24 * 3_600_000), NOW_MS)).toBe('hace 1 día');
    expect(formatAge(ago(3 * 24 * 3_600_000), NOW_MS)).toBe('hace 3 días');
  });

  it('una fecha futura se muestra como "recién" y una inválida queda vacía', () => {
    expect(formatAge(new Date(NOW_MS + 60_000).toISOString(), NOW_MS)).toBe('recién');
    expect(formatAge('nada', NOW_MS)).toBe('');
  });
});
