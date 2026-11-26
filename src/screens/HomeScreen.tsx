import { ArrowRight, CalendarCheck, FlaskConical, Wallet } from 'lucide-react';
import { lazy, Suspense, useMemo } from 'react';
import { CategoryIcon } from '../components/icons/CategoryIcon';
import { OccurrenceList } from '../components/expenses/OccurrenceList';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { LEVEL_TEXT, ProgressBar } from '../components/ui/ProgressBar';
import { budgetStatus, byCategory, dailyTotals, realizedInMonth, sumBase, totalOn } from '../lib/aggregations';
import { budgetInBase } from '../lib/currency';
import { addDays, firstDayOfMonth, formatLongDate, formatMonthName, lastDayOfMonth, minDate, monthOf } from '../lib/dates';
import { formatMoney } from '../lib/money';
import { expandOccurrences, isRealized } from '../lib/occurrences';
import { useAppData } from '../state/AppDataProvider';
import { useConfirm } from '../state/ConfirmProvider';
import { useToast } from '../state/ToastProvider';
import { useUI } from '../state/UIContext';
import { errorMessage } from '../utils/download';

const DashboardCharts = lazy(() => import('../components/charts/DashboardCharts'));

const RECENT_LIMIT = 8;

export function HomeScreen() {
  const { expenses, settings, categories, categoryById, today, actions } = useAppData();
  const { navigate, openQuickAdd } = useUI();
  const confirm = useConfirm();
  const toast = useToast();
  const base = settings.baseCurrency;
  const month = monthOf(today);
  const weekStart = addDays(today, -6);

  const stats = useMemo(() => {
    const occurrences = expandOccurrences(expenses, minDate(firstDayOfMonth(month), weekStart), lastDayOfMonth(month), settings);
    const monthOccurrences = realizedInMonth(occurrences, month, today);
    const monthTotal = sumBase(monthOccurrences);
    const budget = budgetStatus(monthTotal, budgetInBase(settings.budget, settings));
    const categoryBudgets = categories
      .filter((c) => c.budget && c.budget.amountCents > 0)
      .map((c) => ({
        category: c,
        status: budgetStatus(
          sumBase(monthOccurrences.filter((o) => o.categoryId === c.id)),
          budgetInBase(c.budget!, settings),
        ),
      }));
    const visible = occurrences.filter((o) => isRealized(o, today) && o.date <= today);
    return {
      todayTotal: totalOn(occurrences, today),
      monthTotal,
      budget,
      categoryBudgets,
      slices: byCategory(monthOccurrences),
      days: dailyTotals(occurrences, weekStart, today),
      todayItems: visible.filter((o) => o.date === today),
      recent: visible.filter((o) => o.date < today).slice(0, RECENT_LIMIT),
    };
  }, [expenses, settings, categories, month, today, weekStart]);

  const hasSamples = expenses.some((e) => e.isSample);

  const removeSamples = async () => {
    const ok = await confirm({
      title: '¿Borrar los datos de ejemplo?',
      message: 'Se eliminan solo los gastos marcados como ejemplo. Lo que cargaste vos queda intacto.',
      confirmLabel: 'Borrar ejemplos',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      const count = await actions.removeSampleData();
      toast.show({ message: `Se borraron ${count} gastos de ejemplo`, tone: 'success' });
    } catch (error) {
      toast.show({ message: errorMessage(error), tone: 'error' });
    }
  };

  const { budget } = stats;

  return (
    <div className="space-y-5">
      <header className="pt-2">
        <p className="text-sm text-zinc-500 first-letter:uppercase dark:text-zinc-400">{formatLongDate(today, today)}</p>
        <h1 className="text-2xl font-bold tracking-tight">Resumen</h1>
      </header>

      {hasSamples && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-500/20 dark:bg-amber-500/10">
          <FlaskConical className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-amber-900 dark:text-amber-200">Estás viendo datos de ejemplo</p>
            <p className="text-amber-800/80 dark:text-amber-200/70">Sirven para probar la app. Borralos cuando quieras empezar.</p>
          </div>
          <Button size="sm" variant="ghost" className="shrink-0 text-amber-900 dark:text-amber-200" onClick={() => void removeSamples()}>
            Borrar
          </Button>
        </div>
      )}

      {/* Tarjetas superiores */}
      <div className="grid grid-cols-2 gap-3">
        <section className="card p-4" aria-label="Total de hoy">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Hoy</p>
          <p className="mt-1 truncate text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">{formatMoney(stats.todayTotal, base)}</p>
        </section>
        <section className="card p-4" aria-label="Total del mes">
          <p className="text-xs font-medium text-zinc-500 first-letter:uppercase dark:text-zinc-400">{formatMonthName(month)}</p>
          <p className="mt-1 truncate text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">{formatMoney(stats.monthTotal, base)}</p>
        </section>
        <section className="card col-span-2 p-4" aria-label="Presupuesto mensual">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{budget.remaining >= 0 ? 'Disponible del presupuesto' : 'Te pasaste del presupuesto'}</p>
              <p className={`mt-1 truncate text-2xl font-semibold tracking-tight tabular-nums ${budget.remaining < 0 ? LEVEL_TEXT.over : ''}`}>
                {formatMoney(Math.abs(budget.remaining), base)}
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold tabular-nums ${LEVEL_TEXT[budget.level]} bg-current/10`}>
              {Math.floor(budget.percent)} %
            </span>
          </div>
          <div className="mt-3">
            <ProgressBar percent={budget.percent} label="Presupuesto mensual usado" />
          </div>
          <p className="mt-2 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
            {formatMoney(budget.spent, base)} de {formatMoney(budget.limit, base)}
          </p>
        </section>
      </div>

      <Suspense fallback={<div className="grid gap-4"><div className="card h-64 animate-pulse" /><div className="card h-56 animate-pulse" /></div>}>
        <DashboardCharts
          slices={stats.slices}
          monthTotal={stats.monthTotal}
          monthName={formatMonthName(month)}
          days={stats.days}
          categoryById={categoryById}
          base={base}
          today={today}
        />
      </Suspense>

      {stats.categoryBudgets.length > 0 && (
        <section className="card p-4" aria-labelledby="category-budgets-title">
          <h2 id="category-budgets-title" className="section-title">
            Presupuestos por categoría
          </h2>
          <ul className="mt-3 space-y-4">
            {stats.categoryBudgets.map(({ category, status }) => (
              <li key={category.id} className="flex items-center gap-3">
                <CategoryIcon icon={category.icon} color={category.color} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{category.name}</span>
                    <span className="shrink-0 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
                      <span className={LEVEL_TEXT[status.level]}>{formatMoney(status.spent, base)}</span> / {formatMoney(status.limit, base)}
                    </span>
                  </div>
                  <ProgressBar percent={status.percent} label={`Presupuesto de ${category.name}`} size="sm" />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="today-title" className="space-y-2">
        <h2 id="today-title" className="section-title px-1">
          Movimientos de hoy
        </h2>
        {stats.todayItems.length === 0 ? (
          <div className="card">
            <EmptyState
              compact
              icon={<CalendarCheck className="size-6" aria-hidden />}
              title="Todavía no cargaste gastos hoy"
              description="Tocá + para registrar uno en segundos."
              action={
                <Button size="sm" variant="secondary" onClick={openQuickAdd}>
                  Cargar gasto
                </Button>
              }
            />
          </div>
        ) : (
          <OccurrenceList occurrences={stats.todayItems} showHeaders={false} />
        )}
      </section>

      <section aria-labelledby="recent-title" className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 id="recent-title" className="section-title">
            Recientes
          </h2>
          <Button size="sm" variant="ghost" onClick={() => navigate('historial')}>
            Ver historial <ArrowRight className="size-4" aria-hidden />
          </Button>
        </div>
        {stats.recent.length === 0 ? (
          <div className="card">
            <EmptyState compact icon={<Wallet className="size-6" aria-hidden />} title="Sin movimientos anteriores" description="Acá vas a ver lo último que cargaste." />
          </div>
        ) : (
          <OccurrenceList occurrences={stats.recent} />
        )}
      </section>
    </div>
  );
}
