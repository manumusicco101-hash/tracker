import { RefreshCw, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/** Registra el service worker y avisa cuando hay una versión nueva para actualizar. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.warn('No se pudo registrar el service worker', error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[80] flex justify-center px-4" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
      <div className="flex w-full max-w-md animate-pop-in items-center gap-3 rounded-2xl bg-indigo-600 py-2 pr-2 pl-4 text-sm text-white shadow-lg">
        <RefreshCw className="size-4 shrink-0" aria-hidden />
        <p className="flex-1">Hay una versión nueva de la app.</p>
        <button type="button" className="min-h-11 rounded-xl bg-white/15 px-3 font-semibold hover:bg-white/25" onClick={() => void updateServiceWorker(true)}>
          Actualizar
        </button>
        <button type="button" className="grid size-11 place-items-center rounded-xl hover:bg-white/15" aria-label="Más tarde" onClick={() => setNeedRefresh(false)}>
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
