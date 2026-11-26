import { useMemo } from 'react';
import { sumBase } from '../../lib/aggregations';
import { formatDayLabel } from '../../lib/dates';
import { formatMoney } from '../../lib/money';
import { useAppData } from '../../state/AppDataProvider';
import { useUI } from '../../state/UIContext';
import type { ISODate, Occurrence } from '../../types';
import { OccurrenceRow } from './OccurrenceRow';

interface OccurrenceListProps {
  occurrences: Occurrence[];
  /** Mostrar el total de cada día en el encabezado. */
  showDayTotals?: boolean;
  /** Ocultar los encabezados de día (cuando la sección ya dice de qué día es). */
  showHeaders?: boolean;
}

/** Lista agrupada por fecha: "Hoy", "Ayer", "lunes 23 de noviembre"… */
export function OccurrenceList({ occurrences, showDayTotals = true, showHeaders = true }: OccurrenceListProps) {
  const { today, settings } = useAppData();
  const { openExpenseDetail } = useUI();

  const groups = useMemo(() => {
    const map = new Map<ISODate, Occurrence[]>();
    for (const o of occurrences) {
      const list = map.get(o.date);
      if (list) list.push(o);
      else map.set(o.date, [o]);
    }
    return [...map.entries()];
  }, [occurrences]);

  return (
    <div className="space-y-4">
      {groups.map(([date, items]) => (
        <section key={date} aria-label={formatDayLabel(date, today)}>
          {showHeaders && (
            <header className="flex items-baseline justify-between px-1 pb-1.5">
              <h3 className="text-sm font-semibold text-zinc-700 first-letter:uppercase dark:text-zinc-300">{formatDayLabel(date, today)}</h3>
              {showDayTotals && (
                <span className="text-xs font-medium text-zinc-500 tabular-nums dark:text-zinc-400">{formatMoney(sumBase(items), settings.baseCurrency)}</span>
              )}
            </header>
          )}
          <div className="card divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800">
            {items.map((o) => (
              <OccurrenceRow key={o.key} occurrence={o} onClick={() => openExpenseDetail(o.expenseId, o)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
