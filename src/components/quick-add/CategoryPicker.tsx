import type { Category } from '../../types';
import { CategoryIcon } from '../icons/CategoryIcon';

interface CategoryPickerProps {
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
  error?: string;
}

/**
 * Selector visual de categorías con íconos, en una grilla que se ve entera.
 * Sin desplazamiento lateral: así nunca se abre corrido ni deja categorías tapadas.
 */
export function CategoryPicker({ categories, value, onChange, error }: CategoryPickerProps) {
  return (
    <div>
      <span className="label" id="category-picker-label">
        Categoría
      </span>
      <div role="radiogroup" aria-labelledby="category-picker-label" className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
        {categories.map((c) => {
          const selected = c.id === value;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(c.id)}
              className={`skin-press flex min-h-[4.5rem] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl border px-1 py-2 ${
                selected
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-500/15 dark:text-indigo-300'
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
