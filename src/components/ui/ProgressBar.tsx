import { budgetLevel, type BudgetLevel } from '../../lib/aggregations';

const LEVEL_COLORS: Record<BudgetLevel, string> = {
  ok: 'bg-emerald-500',
  warning: 'bg-amber-400',
  over: 'bg-rose-500',
};

export const LEVEL_TEXT: Record<BudgetLevel, string> = {
  ok: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  over: 'text-rose-600 dark:text-rose-400',
};

interface ProgressBarProps {
  /** Porcentaje usado (puede superar 100). */
  percent: number;
  label: string;
  /** Si no se pasa, el color sale del nivel de presupuesto (verde/amarillo/rojo). */
  colorClass?: string;
  size?: 'sm' | 'md';
}

export function ProgressBar({ percent, label, colorClass, size = 'md' }: ProgressBarProps) {
  const level = budgetLevel(percent);
  const width = Math.min(100, Math.max(0, percent));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(Math.min(percent, 100))}
      aria-valuetext={`${Math.floor(percent)} %`}
      className={`w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800 ${size === 'sm' ? 'h-1.5' : 'h-2.5'}`}
    >
      <div className={`h-full rounded-full transition-[width] duration-500 ${colorClass ?? LEVEL_COLORS[level]}`} style={{ width: `${width}%` }} />
    </div>
  );
}
