import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import type { DayPoint } from '../../lib/aggregations';
import { formatDayLabel, formatWeekdayShort } from '../../lib/dates';
import { formatMoney } from '../../lib/money';
import type { BaseCurrency, ISODate } from '../../types';

interface DailyBarsProps {
  days: DayPoint[];
  base: BaseCurrency;
  today: ISODate;
}

interface TooltipPayload {
  payload?: { date: ISODate; total: number };
}

function DayTooltip({ active, payload, base, today }: { active?: boolean; payload?: TooltipPayload[]; base: BaseCurrency; today: ISODate }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-xl bg-zinc-900 px-3 py-2 text-xs text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900">
      <p className="first-letter:uppercase opacity-70">{formatDayLabel(point.date, today)}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{formatMoney(point.total, base)}</p>
    </div>
  );
}

/** Barras con el gasto de cada uno de los últimos 7 días (hoy resaltado). */
export function DailyBars({ days, base, today }: DailyBarsProps) {
  const data = days.map((d) => ({ ...d, label: d.date === today ? 'Hoy' : formatWeekdayShort(d.date) }));
  return (
    <div className="h-44 w-full text-zinc-500 dark:text-zinc-400">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'currentColor', fontSize: 12 }} interval={0} />
          <Tooltip cursor={{ fill: 'currentColor', opacity: 0.08 }} content={<DayTooltip base={base} today={today} />} />
          <Bar dataKey="total" radius={[6, 6, 2, 2]} maxBarSize={36} minPointSize={2}>
            {data.map((d) => (
              <Cell key={d.date} className={d.date === today ? 'fill-indigo-600 dark:fill-indigo-400' : 'fill-indigo-200 dark:fill-indigo-900'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
