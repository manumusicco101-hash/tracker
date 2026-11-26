interface ToggleRowProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description?: string;
}

/** Fila con un interruptor (casilla) y su explicación. Toda la fila es el área táctil. */
export function ToggleRow({ checked, onChange, title, description }: ToggleRowProps) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-2xl bg-zinc-50 px-3 py-2 dark:bg-zinc-800/40">
      <span className="text-sm">
        <span className="font-medium">{title}</span>
        {description && <span className="block text-xs text-zinc-500 dark:text-zinc-400">{description}</span>}
      </span>
      <input type="checkbox" role="switch" className="size-5 shrink-0 accent-indigo-600" checked={checked} onChange={(e) => onChange(e.currentTarget.checked)} />
    </label>
  );
}
