import { CircleCheck, CircleAlert, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export interface ToastOptions {
  message: string;
  tone?: 'default' | 'success' | 'error';
  action?: { label: string; onClick: () => void };
  /** ms. Por defecto 5 s si tiene acción ("Deshacer"), 3 s si no. */
  duration?: number;
}

interface ToastState extends ToastOptions {
  id: number;
  duration: number;
}

interface ToastContextValue {
  show: (options: ToastOptions) => void;
  dismiss: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const counter = useRef(0);

  const dismiss = useCallback(() => {
    window.clearTimeout(timer.current);
    setToast(null);
  }, []);

  const show = useCallback((options: ToastOptions) => {
    window.clearTimeout(timer.current);
    counter.current += 1;
    const id = counter.current;
    const duration = options.duration ?? (options.action ? 5000 : 3000);
    setToast({ ...options, id, duration });
    timer.current = window.setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, duration);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 z-[70] flex justify-center px-4"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 6.5rem)' }}
        role="status"
        aria-live="polite"
      >
        {toast && (
          <div
            key={toast.id}
            className="pointer-events-auto relative flex w-full max-w-md animate-pop-in items-center gap-3 overflow-hidden rounded-2xl bg-zinc-900 py-2 pr-2 pl-4 text-sm text-white shadow-xl shadow-black/20 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {toast.tone === 'success' && <CircleCheck className="size-5 shrink-0 text-emerald-400 dark:text-emerald-600" aria-hidden />}
            {toast.tone === 'error' && <CircleAlert className="size-5 shrink-0 text-rose-400 dark:text-rose-600" aria-hidden />}
            <p className="min-w-0 flex-1 py-2 leading-snug">{toast.message}</p>
            {toast.action && (
              <button
                type="button"
                className="min-h-11 shrink-0 rounded-xl px-3 font-semibold text-indigo-300 hover:bg-white/10 dark:text-indigo-600 dark:hover:bg-black/5"
                onClick={() => {
                  toast.action?.onClick();
                  dismiss();
                }}
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              className="grid size-11 shrink-0 place-items-center rounded-xl text-white/60 hover:bg-white/10 dark:text-zinc-500 dark:hover:bg-black/5"
              onClick={dismiss}
              aria-label="Cerrar aviso"
            >
              <X className="size-4" aria-hidden />
            </button>
            {toast.action && (
              <span
                className="absolute bottom-0 left-0 h-0.5 bg-indigo-400 dark:bg-indigo-600"
                style={{ animation: `toast-countdown ${toast.duration}ms linear forwards` }}
                aria-hidden
              />
            )}
          </div>
        )}
      </div>
      <style>{'@keyframes toast-countdown { from { width: 100%; } to { width: 0%; } }'}</style>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast tiene que usarse dentro de <ToastProvider>.');
  return ctx;
}
