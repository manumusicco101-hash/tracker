import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import type { CategorySlice } from '../../lib/aggregations';
import { formatMoney } from '../../lib/money';
import type { BaseCurrency, Category } from '../../types';

interface CategoryDonutProps {
  slices: CategorySlice[];
  categoryById: Map<string, Category>;
  base: BaseCurrency;
  total: number;
}

const percentFormat = new Intl.NumberFormat('es-AR', { style: 'percent', maximumFractionDigits: 0 });

/** Dona con el desglose porcentual por categoría + leyenda con montos. */
export function CategoryDonut({ slices, categoryById, base, total }: CategoryDonutProps) {
  const data = slices.map((s) => {
    const category = categoryById.get(s.categoryId);
    return { id: s.categoryId, name: category?.name ?? 'Otros', value: s.total, share: s.share, color: category?.color ?? '#71717a' };
  });

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative mx-auto h-48 w-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="68%"
              outerRadius="100%"
              paddingAngle={data.length > 1 ? 2 : 0}
              cornerRadius={4}
              stroke="none"
              startAngle={90}
              endAngle={-270}
              isAnimationActive
            >
              {data.map((d) => (
                <Cell key={d.id} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Total</span>
          <span className="max-w-[8rem] truncate text-base font-semibold tabular-nums">{formatMoney(total, base)}</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5" aria-label="Gastos por categoría">
        {data.map((d) => (
          <li key={d.id} className="flex items-center gap-2 text-sm">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{d.name}</span>
            <span className="w-10 shrink-0 text-right text-xs text-zinc-500 tabular-nums dark:text-zinc-400">{percentFormat.format(d.share)}</span>
            <span className="shrink-0 text-right font-medium tabular-nums">{formatMoney(d.value, base)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
