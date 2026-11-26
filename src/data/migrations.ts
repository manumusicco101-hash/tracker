import type { AppData } from '../types';
import { createBlueRate } from './defaults';
import { validateContent, ValidationError } from './validation';

/** Versión actual del esquema. Subirla junto con una migración en MIGRATIONS. */
export const SCHEMA_VERSION = 3;

type Obj = Record<string, unknown>;

function isRecord(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Cotizaciones que la v1 traía de fábrica: pasan a seguirse en vivo (la fuente tiene el mismo id). */
const V1_FACTORY_RATES = ['usd-oficial', 'usd-mep', 'usd-tarjeta', 'eur-oficial'];

/**
 * Migraciones: MIGRATIONS[n] convierte datos de la versión n a la n + 1.
 */
const MIGRATIONS: Record<number, (data: Obj) => Obj> = {
  // v1 → v2: cotizaciones en vivo (autoSource + quotes) y apertura directa de la carga rápida.
  1: (data) => {
    const settings = isRecord(data.settings) ? data.settings : {};
    const rates = Array.isArray(settings.rates)
      ? settings.rates.map((rate: unknown) => {
          if (!isRecord(rate)) return rate;
          const id = typeof rate.id === 'string' ? rate.id : '';
          return { ...rate, autoSource: V1_FACTORY_RATES.includes(id) ? id : null };
        })
      : settings.rates;
    const quickAdd = isRecord(settings.quickAdd) ? settings.quickAdd : {};
    return {
      ...data,
      schemaVersion: 2,
      settings: {
        ...settings,
        rates,
        quickAdd: { ...quickAdd, openOnLaunch: false },
        quotes: { autoUpdate: true, lastSyncAt: null, provider: null },
      },
    };
  },

  // v2 → v3: se suma el dólar blue en vivo. Si ya había una cotización "Blue" manual, pasa a en vivo (no se duplica).
  2: (data) => {
    const settings = isRecord(data.settings) ? data.settings : {};
    if (!Array.isArray(settings.rates)) return { ...data, schemaVersion: 3 };
    const rates: unknown[] = settings.rates;
    const followsBlue = rates.some((r) => isRecord(r) && (r.autoSource === 'usd-blue' || r.id === 'usd-blue'));
    let nextRates = rates;
    if (!followsBlue) {
      const labeled = rates.findIndex(
        (r) => isRecord(r) && r.currency === 'USD' && typeof r.label === 'string' && r.label.trim().toLowerCase() === 'blue',
      );
      nextRates =
        labeled >= 0
          ? rates.map((r, i) => (i === labeled && isRecord(r) ? { ...r, autoSource: 'usd-blue' } : r))
          : [...rates, createBlueRate(new Date().toISOString())];
    }
    return { ...data, schemaVersion: 3, settings: { ...settings, rates: nextRates } };
  },
};

/** Lleva cualquier versión anterior a la actual y valida el resultado. */
export function migrate(raw: unknown): AppData {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new ValidationError('Los datos no tienen el formato esperado.');
  }
  let data = raw as Obj;
  let version = data.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new ValidationError('Falta la versión del esquema (schemaVersion).');
  }
  if (version > SCHEMA_VERSION) {
    throw new ValidationError(
      `Los datos son de una versión más nueva de la app (esquema ${version}). Actualizá la app para abrirlos.`,
    );
  }
  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new ValidationError(`No hay migración desde la versión ${version}.`);
    data = step(data);
    version += 1;
  }
  return { schemaVersion: SCHEMA_VERSION, ...validateContent(data) };
}
