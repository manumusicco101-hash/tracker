import type { Category, ExchangeRate, Settings } from '../types';

export const OTHER_CATEGORY_ID = 'otros';

/** Paleta de colores para categorías (se leen bien en modo claro y oscuro). */
export const CATEGORY_COLORS = [
  '#f97316',
  '#3b82f6',
  '#14b8a6',
  '#eab308',
  '#ec4899',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#22c55e',
  '#84cc16',
  '#f43f5e',
  '#0ea5e9',
  '#d97706',
  '#a855f7',
  '#64748b',
  '#71717a',
];

/** Categorías iniciales. "Otros" es de sistema: recibe los gastos de categorías eliminadas. */
export function createDefaultCategories(): Category[] {
  const base: Array<Omit<Category, 'order'>> = [
    { id: 'alimentacion', name: 'Alimentación', icon: 'utensils', color: '#f97316', budget: { amountCents: 200_000_00, currency: 'ARS' } },
    { id: 'transporte', name: 'Transporte', icon: 'bus', color: '#3b82f6', budget: null },
    { id: 'vivienda', name: 'Vivienda', icon: 'house', color: '#14b8a6', budget: null },
    { id: 'servicios', name: 'Servicios', icon: 'zap', color: '#eab308', budget: null },
    { id: 'ocio', name: 'Ocio', icon: 'party-popper', color: '#ec4899', budget: { amountCents: 80_000_00, currency: 'ARS' } },
    { id: 'salud', name: 'Salud', icon: 'heart-pulse', color: '#ef4444', budget: null },
    { id: 'compras', name: 'Compras', icon: 'shopping-bag', color: '#8b5cf6', budget: null },
    { id: 'suscripciones', name: 'Suscripciones', icon: 'repeat', color: '#06b6d4', budget: null },
    { id: OTHER_CATEGORY_ID, name: 'Otros', icon: 'ellipsis', color: '#71717a', budget: null, isSystem: true },
  ];
  return base.map((c, order) => ({ ...c, order }));
}

/** Categoría "Otros" por si un backup viejo no la trae. */
export function createOtherCategory(order: number): Category {
  return { id: OTHER_CATEGORY_ID, name: 'Otros', icon: 'ellipsis', color: '#71717a', order, budget: null, isSystem: true };
}

/**
 * Cotizaciones iniciales (ARS por unidad). Son valores de referencia para arrancar:
 * con conexión, la app los reemplaza por los de hoy (cada una sigue su fuente en vivo).
 */
export function createDefaultRates(now: string): ExchangeRate[] {
  return [
    { id: 'usd-oficial', currency: 'USD', label: 'Oficial', arsPerUnit: 1450, isDefault: true, autoSource: 'usd-oficial', updatedAt: now },
    { id: 'usd-mep', currency: 'USD', label: 'MEP', arsPerUnit: 1480, isDefault: false, autoSource: 'usd-mep', updatedAt: now },
    { id: 'usd-tarjeta', currency: 'USD', label: 'Tarjeta', arsPerUnit: 1885, isDefault: false, autoSource: 'usd-tarjeta', updatedAt: now },
    createBlueRate(now),
    { id: 'eur-oficial', currency: 'EUR', label: 'Oficial', arsPerUnit: 1700, isDefault: true, autoSource: 'eur-oficial', updatedAt: now },
  ];
}

/** Dólar blue en vivo (desde el esquema v3). El valor inicial se reemplaza por el de hoy en la primera consulta. */
export function createBlueRate(now: string): ExchangeRate {
  return { id: 'usd-blue', currency: 'USD', label: 'Blue', arsPerUnit: 1710, isDefault: false, autoSource: 'usd-blue', updatedAt: now };
}

export function createDefaultSettings(now: string): Settings {
  return {
    baseCurrency: 'ARS',
    rates: createDefaultRates(now),
    rateHistory: [],
    budget: { amountCents: 900_000_00, currency: 'ARS' },
    quickAdd: { lastCategoryId: 'alimentacion', lastPaymentMethod: 'debit', openOnLaunch: false },
    quotes: { autoUpdate: true, lastSyncAt: null, provider: null },
    theme: 'system',
  };
}
