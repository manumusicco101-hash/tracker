import { CalendarClock, Repeat } from 'lucide-react';
import { formatDayMonth } from '../../lib/dates';
import { expenseTitle } from '../../lib/expenses';
import { installmentCountLabel, installmentDates } from '../../lib/installments';
import { PAYMENT_METHOD_LABELS } from '../../lib/labels';
import { formatCode, formatMoney } from '../../lib/money';
import { isPurchaseMarker } from '../../lib/occurrences';
import { useAppData } from '../../state/AppDataProvider';
import type { Occurrence } from '../../types';
import { CategoryIcon } from '../icons/CategoryIcon';
import { Badge } from '../ui/Badge';

interface OccurrenceRowProps {
  occurrence: Occurrence;
  onClick: () => void;
  /** Muestra la fecha corta (para listas que no están agrupadas por día). */
  showDate?: boolean;
}

export function OccurrenceRow({ occurrence: o, onClick, showDate = false }: OccurrenceRowProps) {
  const { categoryById, expenseById, settings } = useAppData();
  const category = categoryById.get(o.categoryId);
  const base = settings.baseCurrency;
  const marker = isPurchaseMarker(o);
  const expense = expenseById.get(o.expenseId);
  const categoryName = category?.name ?? 'Otros';
  const title = expenseTitle(o.note, categoryName);

  let markerText = '';
  if (marker && expense?.kind === 'installments') {
    const first = installmentDates(expense.date, expense.installments.count, expense.installments.firstDue)[0];
    const count = expense.installments.count;
    markerText = `${installmentCountLabel(count)} · ${count === 1 ? 'se paga' : '1ª'} el ${formatDayMonth(first)}`;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:hover:bg-zinc-800/40 dark:active:bg-zinc-800/70"
    >
      <CategoryIcon icon={category?.icon ?? 'ellipsis'} color={category?.color ?? '#71717a'} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">{title}</p>
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="truncate">
            {showDate && `${formatDayMonth(o.date)} · `}
            {o.note ? `${categoryName} · ` : ''}
            {PAYMENT_METHOD_LABELS[o.paymentMethod]}
          </span>
          {o.kind === 'recurring' && (
            <Badge tone="cyan" icon={<Repeat className="size-3" aria-hidden />}>
              Recurrente
            </Badge>
          )}
          {o.installment && (
            <Badge tone="indigo">
              {o.installment.count === 1 ? '1 cuota' : `Cuota ${o.installment.number}/${o.installment.count}`}
            </Badge>
          )}
          {marker && (
            <Badge tone="amber" icon={<CalendarClock className="size-3" aria-hidden />}>
              {markerText || 'En cuotas'}
            </Badge>
          )}
          {o.isSample && <Badge>Ejemplo</Badge>}
        </div>
      </div>
      <div className="shrink-0 text-right">
        {marker ? (
          <>
            <p className="text-sm font-medium text-zinc-400 tabular-nums dark:text-zinc-500">{formatMoney(o.amountBase, base)}</p>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">total · no suma</p>
          </>
        ) : (
          <p className="font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">{formatMoney(o.amountBase, base)}</p>
        )}
        {o.currency !== base && (
          <p className="mt-0.5 text-[11px] font-medium text-zinc-500 tabular-nums dark:text-zinc-400">{formatCode(o.amountCents / 100, o.currency)}</p>
        )}
      </div>
    </button>
  );
}
