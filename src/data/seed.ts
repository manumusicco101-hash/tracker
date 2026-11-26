import { nowTimestamp, todayISO } from '../lib/dates';
import type { AppData } from '../types';
import { createDefaultCategories, createDefaultSettings } from './defaults';
import { SCHEMA_VERSION } from './migrations';
import { createSampleExpenses } from './sampleData';

/** Datos del primer uso: categorías y ajustes por defecto + gastos de ejemplo. */
export function createInitialData(today = todayISO(), now = nowTimestamp()): AppData {
  const settings = createDefaultSettings(now);
  return {
    schemaVersion: SCHEMA_VERSION,
    categories: createDefaultCategories(),
    settings,
    expenses: createSampleExpenses(today, settings),
  };
}
