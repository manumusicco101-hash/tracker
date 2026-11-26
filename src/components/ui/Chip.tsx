import type { ReactNode } from 'react';

interface ChipProps {
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
  icon?: ReactNode;
  ariaLabel?: string;
}

/** Botón tipo "chip" seleccionable (filtros, cantidad de cuotas, etiquetas). */
export function Chip({ selected = false, onClick, children, icon, ariaLabel }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={ariaLabel}
      className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium skin-press ${
        selected
          ? 'border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500 dark:bg-indigo-500'
          : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300 dark:hover:border-zinc-600'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
