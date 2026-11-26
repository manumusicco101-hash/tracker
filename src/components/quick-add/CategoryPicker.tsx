import { useEffect, useRef } from 'react';
import type { Category } from '../../types';
import { CategoryIcon } from '../icons/CategoryIcon';

interface CategoryPickerProps {
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
  /** Cambia cuando se abre el panel, para volver a mostrar la categoría elegida. */
  resetKey?: unknown;
  error?: string;
}

/** Selector visual de categorías con íconos (desplazable horizontalmente, en dos filas). */
export function CategoryPicker({ categories, value, onChange, resetKey, error }: CategoryPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const selected = containerRef.current?.querySelector<HTMLElement>('[aria-checked="true"]');
    selected?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [resetKey]);

  return (
    <div>
      <span className="label" id="category-picker-label">
        Categoría
      </span>
      <div
        ref={containerRef}
        role="radiogroup"
        aria-labelledby="category-picker-label"
        className="no-scrollbar -mx-4 grid snap-x auto-cols-[4.75rem] grid-flow-col grid-rows-2 gap-1.5 overflow-x-auto px-4 pb-1"
      >
        {categories.map((c) => {
          const selected = c.id === value;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(c.id)}
              className={`flex min-h-[4.5rem] snap-start flex-col items-center justify-center gap-1 rounded-2xl border px-1 py-2 transition-colors ${
                selected
                  ? 'border-transparent bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-300'
              }`}
            >
              <CategoryIcon icon={c.icon} color={c.color} size="sm" />
              <span className="w-full truncate text-center text-[11px] leading-tight font-medium">{c.name}</span>
            </button>
          );
        })}
      </div>
      {error && <p className="mt-1.5 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}
