import { FileSpreadsheet, ReceiptText, Search, SearchX, SlidersHorizontal, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { FiltersSheet } from '../components/expenses/FiltersSheet';
import { OccurrenceList } from '../components/expenses/OccurrenceList';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { sumBase } from '../lib/aggregations';
import { buildHistoryCsv } from '../lib/csv';
import { formatShortDate, maxDate } from '../lib/dates';
import { applyFilters, countActiveFilters, EMPTY_FILTERS, hasAnyFilter, type HistoryFilters } from '../lib/filters';
import { KIND_SHORT_LABELS, PAYMENT_METHOD_LABELS } from '../lib/labels';
import { formatMoney } from '../lib/money';
import { earliestDate, expandOccurrences, isRealized } from '../lib/occurrences';
import { useAppData } from '../state/AppDataProvider';
import { useToast } from '../state/ToastProvider';
import { useUI } from '../state/UIContext';
import { downloadTextFile } from '../utils/download';

const PAGE_SIZE = 60;

export function HistoryScreen() {
  const { expenses, settings, today, categoryName } = useAppData();
  const { openQuickAdd } = useUI();
  const toast = useToast();
  const [filters, setFilters] = useState<HistoryFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const base = settings.baseCurrency;

  // Cuotas y recurrentes aparecen solo cuando su fecha ya llegó; las futuras están en Compromisos.
  const all = useMemo(() => {
    const to = expenses.reduce((max, e) => maxDate(max, e.date), today);
    return expandOccurrences(expenses, earliestDate(expenses, today), to, settings).filter((o) => isRealized(o, today));
  }, [expenses, settings, today]);

  const filtered = useMemo(() => applyFilters(all, filters, categoryName), [all, filters, categoryName]);
  const total = useMemo(() => sumBase(filtered), [filtered]);
  const activeCount = countActiveFilters(filters);

  const updateFilters = (next: HistoryFilters) => {
    setFilters(next);
    setLimit(PAGE_SIZE);
  };

  const exportCsv = () => {
    const rows = filtered.filter((o) => o.countsInTotals);
    if (rows.length === 0) {
      toast.show({ message: 'No hay movimientos para exportar con estos filtros.', tone: 'error' });
      return;
    }
    downloadTextFile(`gastos-${today}.csv`, buildHistoryCsv(rows, { baseCurrency: base, categoryName }), 'text/csv;charset=utf-8');
    toast.show({ message: `Exportaste ${rows.length} movimientos a CSV`, tone: 'success' });
  };

  const chips: Array<{ key: string; label: string; remove: () => void }> = [
    ...filters.categoryIds.map((id) => ({
      key: `c-${id}`,
      label: categoryName(id),
      remove: () => updateFilters({ ...filters, categoryIds: filters.categoryIds.filter((x) => x !== id) }),
    })),
    ...filters.paymentMethods.map((m) => ({
      key: `m-${m}`,
      label: PAYMENT_METHOD_LABELS[m],
      remove: () => updateFilters({ ...filters, paymentMethods: filters.paymentMethods.filter((x) => x !== m) }),
    })),
    ...filters.currencies.map((c) => ({
      key: `cur-${c}`,
      label: c,
      remove: () => updateFilters({ ...filters, currencies: filters.currencies.filter((x) => x !== c) }),
    })),
    ...filters.kinds.map((k) => ({
      key: `k-${k}`,
      label: KIND_SHORT_LABELS[k],
      remove: () => updateFilters({ ...filters, kinds: filters.kinds.filter((x) => x !== k) }),
    })),
    ...(filters.from || filters.to
      ? [
          {
            key: 'range',
            label: `${filters.from ? formatShortDate(filters.from) : '…'} – ${filters.to ? formatShortDate(filters.to) : '…'}`,
            remove: () => updateFilters({ ...filters, from: null, to: null }),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between gap-3 pt-2">
        <h1 className="text-2xl font-bold tracking-tight">Historial</h1>
        <Button size="sm" variant="secondary" onClick={exportCsv} aria-label="Exportar a CSV para Excel">
          <FileSpreadsheet className="size-4" aria-hidden /> CSV
        </Button>
      </header>

      <div className="sticky top-0 z-20 -mx-4 space-y-2 skin-glass px-4 py-2" style={{ top: 'env(safe-area-inset-top)' }}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
            <label htmlFor="history-search" className="sr-only">
              Buscar por nota o descripción
            </label>
            <input
              id="history-search"
              type="search"
              enterKeyHint="search"
              className="input pr-10 pl-9"
              placeholder="Buscar por nota"
              value={filters.query}
              onChange={(e) => updateFilters({ ...filters, query: e.currentTarget.value })}
            />
            {filters.query && (
              <button
                type="button"
                className="absolute top-1/2 right-0 grid size-11 -translate-y-1/2 place-items-center text-zinc-400 hover:text-zinc-600"
                onClick={() => updateFilters({ ...filters, query: '' })}
                aria-label="Borrar búsqueda"
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className={`relative grid size-11 shrink-0 place-items-center rounded-xl border transition-colors ${
              activeCount > 0
                ? 'border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500 dark:bg-indigo-500'
                : 'border-zinc-200 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200'
            }`}
            aria-label={activeCount > 0 ? `Filtros (${activeCount} activos)` : 'Filtros'}
          >
            <SlidersHorizontal className="size-5" aria-hidden />
            {activeCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-zinc-900 text-[10px] font-bold text-white dark:bg-white dark:text-zinc-900">
                {activeCount}
              </span>
            )}
          </button>
        </div>
        {chips.length > 0 && (
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.remove}
                className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full bg-indigo-50 pr-2 pl-3 text-xs font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
                aria-label={`Quitar filtro ${chip.label}`}
              >
                {chip.label}
                <X className="size-3.5" aria-hidden />
              </button>
            ))}
          </div>
        )}
        {all.length > 0 && (
          <p className="px-1 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
            {filtered.length} {filtered.length === 1 ? 'movimiento' : 'movimientos'} · Total {formatMoney(total, base)}
          </p>
        )}
      </div>

      {all.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<ReceiptText className="size-6" aria-hidden />}
            title="Todavía no hay movimientos"
            description="Los gastos que cargues van a aparecer acá, agrupados por día."
            action={
              <Button size="sm" onClick={openQuickAdd}>
                Cargar el primero
              </Button>
            }
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<SearchX className="size-6" aria-hidden />}
            title="No hay movimientos con estos filtros"
            description="Probá con otra búsqueda o sacá algún filtro."
            action={
              hasAnyFilter(filters) ? (
                <Button size="sm" variant="secondary" onClick={() => updateFilters(EMPTY_FILTERS)}>
                  Limpiar filtros
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <OccurrenceList occurrences={filtered.slice(0, limit)} />
          {filtered.length > limit && (
            <Button variant="secondary" block onClick={() => setLimit((n) => n + PAGE_SIZE)}>
              Mostrar más ({filtered.length - limit} restantes)
            </Button>
          )}
        </>
      )}

      <FiltersSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} filters={filters} onChange={updateFilters} resultCount={filtered.length} />
    </div>
  );
}
