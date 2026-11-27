import { Plus } from 'lucide-react';

/** Botón flotante "+" visible en toda la app. */
export function FabAdd({ onPress }: { onPress: () => void }) {
  return (
    <div
      className="vv-bottom pointer-events-none fixed inset-x-0 z-40 mx-auto flex max-w-2xl justify-end px-4"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 4.75rem)' }}
    >
      <button
        type="button"
        onClick={onPress}
        aria-label="Agregar gasto"
        className="pointer-events-auto grid size-14 place-items-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 transition-transform hover:bg-indigo-500 active:scale-95 dark:bg-indigo-500 dark:shadow-indigo-500/20"
      >
        <Plus className="size-7" strokeWidth={2.5} aria-hidden />
      </button>
    </div>
  );
}
