import { ChartPie } from 'lucide-react';
import type { CategorySlice, DayPoint } from '../../lib/aggregations';
import { formatMoney } from '../../lib/money';
import type { BaseCurrency, Category, ISODate } from '../../types';
import { EmptyState } from '../ui/EmptyState';
import { CategoryDonut } from './CategoryDonut';
import { DailyBars } from './DailyBars';

export interface DashboardChartsProps {
  slices: CategorySlice[];
  monthTotal: number;
  monthName: string;
  days: DayPoint[];
  categoryById: Map<string, Category>;
  base: BaseCurrency;
  today: ISODate;
}

// Se carga de forma diferida (React.lazy) porque Recharts es la dependencia más pesada.
export default function DashboardCharts({ slices, monthTotal, monthName, days, categoryById, base, today }: DashboardChartsProps) {
  const weekTotal = days.reduce((sum, d) => sum + d.total, 0);
  return (
    <div className="grid gap-4">
      <section className="card p-4" aria-labelledby="donut-title">
        <h2 id="donut-title" className="section-title">
          Por categoría <span className="font-normal text-zinc-500 dark:text-zinc-400">· {monthName}</span>
        </h2>
        <div className="mt-3">
          {slices.length === 0 ? (
            <EmptyState compact icon={<ChartPie className="size-6" aria-hidden />} title="Sin gastos este mes" description="Cuando cargues gastos vas a ver el desglose por categoría." />
          ) : (
            <CategoryDonut slices={slices} categoryById={categoryById} base={base} total={monthTotal} />
          )}
        </div>
      </section>
      <section className="card p-4" aria-labelledby="bars-title">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="bars-title" className="section-title">
            Últimos 7 días
          </h2>
          <span className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
            Promedio {formatMoney(weekTotal / Math.max(1, days.length), base)}/día
          </span>
        </div>
        <div className="mt-3">
          <DailyBars days={days} base={base} today={today} />
        </div>
      </section>
    </div>
  );
}
