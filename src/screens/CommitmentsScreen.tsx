import { CalendarRange, ChevronDown, CreditCard, Repeat } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CategoryIcon } from '../components/icons/CategoryIcon';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ProgressBar } from '../components/ui/ProgressBar';
import { useExpenseActions } from '../hooks/useExpenseActions';
import { commitmentsByMonth } from '../lib/aggregations';
import { convert, rateTableForOccurrence } from '../lib/currency';
import { addDays, addMonths, formatDayMonth, formatMonthName, lastDayOfMonth, monthOf } from '../lib/dates';
import { expenseTitle } from '../lib/expenses';
import { installmentProgress, installmentSchedule } from '../lib/installments';
import { formatCode, formatMoney } from '../lib/money';
import { expandOccurrences } from '../lib/occurrences';
import { isRecurringActive, nextRecurringDate } from '../lib/recurring';
import { useAppData } from '../state/AppDataProvider';
import { useUI } from '../state/UIContext';
import type { InstallmentExpense, RecurringExpense } from '../types';

const MONTHS_AHEAD = 12;

export function CommitmentsScreen() {
  const { expenses, settings, today, categoryById, categoryName } = useAppData();
  const { openExpenseDetail } = useUI();
  const { cancelRecurringWithUndo } = useExpenseActions();
  const [expanded, setExpanded] = useState<string | null>(null);
  const base = settings.baseCurrency;

  const data = useMemo(() => {
    const end = lastDayOfMonth(addMonths(monthOf(today), MONTHS_AHEAD - 1));
    const future = expandOccurrences(expenses, addDays(today, 1), end, settings);
    const months = commitmentsByMonth(future, today, MONTHS_AHEAD);
    const total = months.reduce((sum, m) => sum + m.total, 0);
    let installmentsTotal = 0;
    let recurringTotal = 0;
    for (const m of months) {
      for (const o of m.items) {
        if (o.kind === 'installments') installmentsTotal += o.amountBase;
        else recurringTotal += o.amountBase;
      }
    }

    const activeInstallments = expenses
      .filter((e): e is InstallmentExpense => e.kind === 'installments')
      .map((e) => {
        const progress = installmentProgress(e, today);
        const next = installmentSchedule(e).find((i) => i.date > today);
        return {
          expense: e,
          progress,
          nextAmount: next ? next.amountCents : 0,
          remainingBase: convert(progress.remainingCents / 100, e.currency, base, e.rateAtCreation),
        };
      })
      .filter((x) => !x.progress.isFinished)
      .sort((a, b) => (a.progress.nextDate ?? '').localeCompare(b.progress.nextDate ?? ''));

    const activeRecurring = expenses
      .filter((e): e is RecurringExpense => e.kind === 'recurring' && isRecurringActive(e))
      .map((e) => {
        const next = nextRecurringDate(e, today);
        const rates = rateTableForOccurrence(e, next ?? today, settings);
        return { expense: e, next, amountBase: convert(e.amountCents / 100, e.currency, base, rates) };
      })
      .sort((a, b) => (a.next ?? '').localeCompare(b.next ?? ''));

    const monthlyRecurring = activeRecurring.reduce((sum, r) => sum + r.amountBase, 0);
    const max = Math.max(1, ...months.map((m) => m.total));
    return { months, total, installmentsTotal, recurringTotal, activeInstallments, activeRecurring, monthlyRecurring, max };
  }, [expenses, settings, today, base]);

  return (
    <div className="space-y-5">
      <header className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight">Compromisos</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Cuotas pendientes y gastos recurrentes de los próximos 12 meses.</p>
      </header>

      <section className="card p-4" aria-label="Total comprometido">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total comprometido · 12 meses</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{formatMoney(data.total, base)}</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600 tabular-nums dark:text-zinc-300">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-indigo-500" aria-hidden /> Cuotas {formatMoney(data.installmentsTotal, base)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-cyan-500" aria-hidden /> Recurrentes {formatMoney(data.recurringTotal, base)}
          </span>
        </div>
      </section>

      <section aria-labelledby="months-title" className="space-y-2">
        <h2 id="months-title" className="section-title px-1">
          Mes por mes
        </h2>
        <ol className="card divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800">
          {data.months.map((m, index) => {
            const isOpen = expanded === m.month;
            const installmentsPart = m.items.filter((o) => o.kind === 'installments').reduce((s, o) => s + o.amountBase, 0);
            return (
              <li key={m.month}>
                <button
                  type="button"
                  className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                  onClick={() => setExpanded(isOpen ? null : m.month)}
                  aria-expanded={isOpen}
                  disabled={m.items.length === 0}
                >
                  <div className="w-24 shrink-0">
                    <p className="text-sm font-medium first-letter:uppercase">{formatMonthName(m.month)}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {m.month.slice(0, 4)} · {index === 0 ? 'lo que falta' : `${m.items.length} ${m.items.length === 1 ? 'pago' : 'pagos'}`}
                    </p>
                  </div>
                  <div className="flex h-2 min-w-6 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800" aria-hidden>
                    <div className="h-full bg-indigo-500" style={{ width: `${(installmentsPart / data.max) * 100}%` }} />
                    <div className="h-full bg-cyan-500" style={{ width: `${((m.total - installmentsPart) / data.max) * 100}%` }} />
                  </div>
                  <span className="min-w-20 shrink-0 text-right text-sm font-semibold tabular-nums">{formatMoney(m.total, base)}</span>
                  <ChevronDown
                    className={`size-4 shrink-0 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''} ${m.items.length === 0 ? 'opacity-0' : ''}`}
                    aria-hidden
                  />
                </button>
                {isOpen && (
                  <ul className="bg-zinc-50 px-4 py-1 dark:bg-zinc-800/30">
                    {m.items.map((o) => (
                      <li key={o.key}>
                        <button
                          type="button"
                          onClick={() => openExpenseDetail(o.expenseId, o)}
                          className="flex min-h-11 w-full items-center gap-2 py-1.5 text-left text-sm"
                        >
                          <span className="w-12 shrink-0 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">{formatDayMonth(o.date)}</span>
                          <span className="min-w-0 flex-1 truncate">{expenseTitle(o.note, categoryName(o.categoryId))}</span>
                          {o.installment ? (
                            <Badge tone="indigo">
                              {o.installment.number}/{o.installment.count}
                            </Badge>
                          ) : (
                            <Badge tone="cyan">Rec.</Badge>
                          )}
                          <span className="w-24 shrink-0 text-right font-medium tabular-nums">{formatMoney(o.amountBase, base)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
        {data.total === 0 && (
          <p className="px-1 text-sm text-zinc-500 dark:text-zinc-400">No tenés cuotas ni recurrentes pendientes para los próximos meses.</p>
        )}
      </section>

      <section aria-labelledby="installments-title" className="space-y-2">
        <h2 id="installments-title" className="section-title px-1">
          Compras en cuotas activas
        </h2>
        {data.activeInstallments.length === 0 ? (
          <div className="card">
            <EmptyState
              compact
              icon={<CreditCard className="size-6" aria-hidden />}
              title="No tenés compras en cuotas pendientes"
              description="Cuando cargues una compra con Crédito en cuotas, vas a ver su progreso acá."
            />
          </div>
        ) : (
          <ul className="card divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800">
            {data.activeInstallments.map(({ expense: e, progress, nextAmount, remainingBase }) => {
              const category = categoryById.get(e.categoryId);
              // 1 cuota = un solo pago: sin "/cuota", sin barra de progreso ni saldo (es el mismo monto).
              const single = progress.count === 1;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => openExpenseDetail(e.id)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                  >
                    <CategoryIcon icon={category?.icon ?? 'ellipsis'} color={category?.color ?? '#71717a'} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate font-medium">{expenseTitle(e.note, category?.name ?? 'Otros')}</p>
                        <p className="shrink-0 text-sm font-semibold tabular-nums">
                          {formatMoney(convert(nextAmount / 100, e.currency, base, e.rateAtCreation), base)}
                          {!single && <span className="font-normal text-zinc-500 dark:text-zinc-400">/cuota</span>}
                        </p>
                      </div>
                      <p className="mt-0.5 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
                        {single
                          ? `1 cuota · se paga el ${progress.nextDate ? formatDayMonth(progress.nextDate) : '—'}`
                          : `${progress.paidCount} de ${progress.count} pagadas · próxima ${progress.nextDate ? formatDayMonth(progress.nextDate) : '—'}`}
                      </p>
                      {!single && (
                        <>
                          <div className="mt-2">
                            <ProgressBar percent={(progress.paidCount / progress.count) * 100} label="Cuotas pagadas" colorClass="bg-indigo-500" size="sm" />
                          </div>
                          <p className="mt-1.5 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
                            Restan {formatMoney(remainingBase, base)}
                            {e.currency !== base && ` (${formatCode(progress.remainingCents / 100, e.currency)})`}
                          </p>
                        </>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="recurring-title" className="space-y-2">
        <div className="flex items-baseline justify-between px-1">
          <h2 id="recurring-title" className="section-title">
            Recurrentes activos
          </h2>
          {data.activeRecurring.length > 0 && (
            <span className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">{formatMoney(data.monthlyRecurring, base)}/mes</span>
          )}
        </div>
        {data.activeRecurring.length === 0 ? (
          <div className="card">
            <EmptyState
              compact
              icon={<Repeat className="size-6" aria-hidden />}
              title="No tenés gastos recurrentes"
              description="Cargá suscripciones o gastos fijos eligiendo la modalidad Recurrente."
            />
          </div>
        ) : (
          <ul className="card divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800">
            {data.activeRecurring.map(({ expense: e, next, amountBase }) => {
              const category = categoryById.get(e.categoryId);
              return (
                <li key={e.id} className="flex items-center gap-2 pr-2">
                  <button
                    type="button"
                    onClick={() => openExpenseDetail(e.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left"
                  >
                    <CategoryIcon icon={category?.icon ?? 'ellipsis'} color={category?.color ?? '#71717a'} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{expenseTitle(e.note, category?.name ?? 'Otros')}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Día {e.recurrence.dayOfMonth} · próxima {next ? formatDayMonth(next) : '—'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums">{formatMoney(amountBase, base)}</p>
                      {e.currency !== base && (
                        <p className="text-[11px] text-zinc-500 tabular-nums dark:text-zinc-400">{formatCode(e.amountCents / 100, e.currency)}</p>
                      )}
                    </div>
                  </button>
                  <Button size="sm" variant="ghost" className="shrink-0 text-rose-600 dark:text-rose-400" onClick={() => void cancelRecurringWithUndo(e)}>
                    Cancelar
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="flex items-start gap-2 px-1 pb-2 text-xs text-zinc-500 dark:text-zinc-400">
        <CalendarRange className="mt-0.5 size-4 shrink-0" aria-hidden />
        Las cuotas y ocurrencias futuras no aparecen en el historial hasta que llega su fecha.
      </p>
    </div>
  );
}
