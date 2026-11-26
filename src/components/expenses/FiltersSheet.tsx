import type { ReactNode } from 'react';
import { addDays, addMonths, firstDayOfMonth, isValidISODate, lastDayOfMonth, monthOf } from '../../lib/dates';
import { countActiveFilters, EMPTY_FILTERS, toggleValue, type HistoryFilters } from '../../lib/filters';
import { EXPENSE_KINDS, KIND_SHORT_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from '../../lib/labels';
import { CURRENCY_CODES } from '../../lib/money';
import { useAppData } from '../../state/AppDataProvider';
import { CategoryIcon } from '../icons/CategoryIcon';
import { PAYMENT_ICONS } from '../icons/paymentIcons';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';

interface FiltersSheetProps {
  open: boolean;
  onClose: () => void;
  filters: HistoryFilters;
  onChange: (filters: HistoryFilters) => void;
  resultCount: number;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="label">{title}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

export function FiltersSheet({ open, onClose, filters, onChange, resultCount }: FiltersSheetProps) {
  const { categories, today } = useAppData();
  const set = (patch: Partial<HistoryFilters>) => onChange({ ...filters, ...patch });
  const month = monthOf(today);
  const presets = [
    { label: 'Últimos 7 días', from: addDays(today, -6), to: today },
    { label: 'Este mes', from: firstDayOfMonth(month), to: lastDayOfMonth(month) },
    { label: 'Mes pasado', from: firstDayOfMonth(addMonths(month, -1)), to: lastDayOfMonth(addMonths(month, -1)) },
  ];

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Filtros"
      headerAction={
        countActiveFilters(filters) > 0 ? (
          <Button size="sm" variant="ghost" onClick={() => onChange({ ...EMPTY_FILTERS, query: filters.query })}>
            Limpiar
          </Button>
        ) : undefined
      }
      footer={
        <Button block size="lg" onClick={onClose}>
          Ver {resultCount} {resultCount === 1 ? 'resultado' : 'resultados'}
        </Button>
      }
    >
      <div className="space-y-6 pt-1">
        <Section title="Categoría">
          {categories.map((c) => (
            <Chip
              key={c.id}
              selected={filters.categoryIds.includes(c.id)}
              onClick={() => set({ categoryIds: toggleValue(filters.categoryIds, c.id) })}
              icon={<CategoryIcon icon={c.icon} color={c.color} size="sm" />}
            >
              {c.name}
            </Chip>
          ))}
        </Section>

        <Section title="Método de pago">
          {PAYMENT_METHODS.map((m) => {
            const Icon = PAYMENT_ICONS[m];
            return (
              <Chip
                key={m}
                selected={filters.paymentMethods.includes(m)}
                onClick={() => set({ paymentMethods: toggleValue(filters.paymentMethods, m) })}
                icon={<Icon className="size-4" aria-hidden />}
              >
                {PAYMENT_METHOD_LABELS[m]}
              </Chip>
            );
          })}
        </Section>

        <Section title="Moneda">
          {CURRENCY_CODES.map((c) => (
            <Chip key={c} selected={filters.currencies.includes(c)} onClick={() => set({ currencies: toggleValue(filters.currencies, c) })}>
              {c}
            </Chip>
          ))}
        </Section>

        <Section title="Modalidad">
          {EXPENSE_KINDS.map((k) => (
            <Chip key={k} selected={filters.kinds.includes(k)} onClick={() => set({ kinds: toggleValue(filters.kinds, k) })}>
              {KIND_SHORT_LABELS[k]}
            </Chip>
          ))}
        </Section>

        <fieldset>
          <legend className="label">Rango de fechas</legend>
          <div className="mb-3 flex flex-wrap gap-2">
            {presets.map((p) => (
              <Chip key={p.label} selected={filters.from === p.from && filters.to === p.to} onClick={() => set({ from: p.from, to: p.to })}>
                {p.label}
              </Chip>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="filter-from" className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
                Desde
              </label>
              <input
                id="filter-from"
                type="date"
                className="input"
                value={filters.from ?? ''}
                max={filters.to ?? undefined}
                onChange={(e) => set({ from: isValidISODate(e.currentTarget.value) ? e.currentTarget.value : null })}
              />
            </div>
            <div>
              <label htmlFor="filter-to" className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
                Hasta
              </label>
              <input
                id="filter-to"
                type="date"
                className="input"
                value={filters.to ?? ''}
                min={filters.from ?? undefined}
                onChange={(e) => set({ to: isValidISODate(e.currentTarget.value) ? e.currentTarget.value : null })}
              />
            </div>
          </div>
        </fieldset>
      </div>
    </BottomSheet>
  );
}
