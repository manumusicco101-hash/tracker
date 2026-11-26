import type { CurrencyCode, ExpenseKind, ISODate, Occurrence, PaymentMethod } from '../types';

export interface HistoryFilters {
  query: string;
  categoryIds: string[];
  paymentMethods: PaymentMethod[];
  currencies: CurrencyCode[];
  kinds: ExpenseKind[];
  from: ISODate | null;
  to: ISODate | null;
}

export const EMPTY_FILTERS: HistoryFilters = {
  query: '',
  categoryIds: [],
  paymentMethods: [],
  currencies: [],
  kinds: [],
  from: null,
  to: null,
};

/** Minúsculas y sin acentos, para buscar "cafe" y encontrar "Café". */
export function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

export function applyFilters(
  occurrences: Occurrence[],
  filters: HistoryFilters,
  categoryName: (id: string) => string,
): Occurrence[] {
  const query = normalizeText(filters.query);
  return occurrences.filter((o) => {
    if (filters.categoryIds.length > 0 && !filters.categoryIds.includes(o.categoryId)) return false;
    if (filters.paymentMethods.length > 0 && !filters.paymentMethods.includes(o.paymentMethod)) return false;
    if (filters.currencies.length > 0 && !filters.currencies.includes(o.currency)) return false;
    if (filters.kinds.length > 0 && !filters.kinds.includes(o.kind)) return false;
    if (filters.from && o.date < filters.from) return false;
    if (filters.to && o.date > filters.to) return false;
    if (query) {
      const haystack = normalizeText(`${o.note ?? ''} ${categoryName(o.categoryId)}`);
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

/** Cantidad de filtros activos (sin contar la búsqueda). */
export function countActiveFilters(filters: HistoryFilters): number {
  return (
    filters.categoryIds.length +
    filters.paymentMethods.length +
    filters.currencies.length +
    filters.kinds.length +
    (filters.from ? 1 : 0) +
    (filters.to ? 1 : 0)
  );
}

export function hasAnyFilter(filters: HistoryFilters): boolean {
  return countActiveFilters(filters) > 0 || filters.query.trim() !== '';
}

export function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}
