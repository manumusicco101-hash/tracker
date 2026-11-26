import type { ReactNode } from 'react';

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  title?: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  /** Apila ícono arriba y texto abajo (para 4 opciones con ícono en pantallas chicas). */
  stacked?: boolean;
}

export function SegmentedControl<T extends string>({ options, value, onChange, ariaLabel, stacked = false }: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="grid gap-1 rounded-2xl bg-zinc-100 p-1 dark:bg-zinc-800/70"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={option.disabled}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={`flex min-h-11 min-w-0 items-center justify-center rounded-xl px-2 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
              stacked ? 'flex-col gap-0.5 py-1.5 text-xs' : 'gap-1.5'
            } ${
              selected
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
            }`}
          >
            {option.icon}
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
